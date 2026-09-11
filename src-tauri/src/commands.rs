use crate::entries::{Entry, EntryFields, FileAttachment};
use crate::vault::{self, VaultState};
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

const MAX_ATTACHMENT_BYTES: usize = 500 * 1024;

fn mime_for_filename(name: &str) -> String {
    let ext = name.rsplit('.').next().unwrap_or("").to_lowercase();
    match ext.as_str() {
        "pem" | "key" | "crt" | "cer" | "csr" => "application/x-pem-file",
        "pub" => "text/plain",
        "p12" | "pfx" => "application/x-pkcs12",
        "pdf" => "application/pdf",
        "txt" | "md" => "text/plain",
        "json" => "application/json",
        "xml" => "application/xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        "zip" => "application/zip",
        _ => "application/octet-stream",
    }
    .to_string()
}

pub struct AppState(pub Mutex<VaultState>);

#[derive(Serialize)]
pub struct EntryListItem {
    pub id: String,
    pub name: String,
    pub entry_type: String,
    pub icon: Option<String>,
    pub folder_id: Option<String>,
    pub tags: Vec<String>,
    pub favorite: bool,
    pub updated_at: String,
}

#[derive(Serialize)]
pub struct VaultInfo {
    pub vault_path: String,
    pub hint: Option<String>,
    pub is_unlocked: bool,
}

fn list_item(e: &Entry) -> EntryListItem {
    EntryListItem {
        id: e.base.id.to_string(),
        name: e.base.name.clone(),
        entry_type: e.entry_type().as_str().to_string(),
        icon: e.base.icon.clone(),
        folder_id: e.base.folder_id.map(|id| id.to_string()),
        tags: e.base.tags.clone(),
        favorite: e.base.favorite,
        updated_at: e.base.updated_at.clone(),
    }
}

fn parse_id(id: &str) -> Result<Uuid, String> {
    Uuid::parse_str(id).map_err(|e| e.to_string())
}

fn parse_folder_id(id: Option<&str>) -> Option<Uuid> {
    id.and_then(|f| Uuid::parse_str(f).ok())
}

fn parse_fields(entry_type: &str, value: serde_json::Value) -> Result<EntryFields, String> {
    fn de<T: serde::de::DeserializeOwned>(value: serde_json::Value) -> Result<T, String> {
        serde_json::from_value(value).map_err(|e| e.to_string())
    }
    Ok(match entry_type {
        "login" => EntryFields::Login(de(value)?),
        "api_key" => EntryFields::ApiKey(de(value)?),
        "note" => EntryFields::Note(de(value)?),
        "ssh_key" => EntryFields::SshKey(de(value)?),
        "card" => EntryFields::Card(de(value)?),
        other => return Err(format!("Unknown entry type: {other}")),
    })
}

fn now() -> String {
    chrono::Utc::now().to_rfc3339()
}

/// Create a new vault at the given directory.
#[tauri::command]
pub fn create_vault(
    dir: String,
    password: String,
    hint: Option<String>,
    state: State<'_, AppState>,
) -> Result<VaultInfo, String> {
    let path = vault::create_vault(Path::new(&dir), &password, hint.clone())?;
    let loaded = vault::load_vault(&path, &password)?;
    let vault_path = path.to_string_lossy().to_string();
    state.0.lock().unwrap().install(path, loaded);
    let _ = crate::settings::save_settings(&crate::settings::AppSettings {
        vault_path: Some(vault_path.clone()),
    });
    Ok(VaultInfo { vault_path, hint, is_unlocked: true })
}

/// Unlock an existing vault.
#[tauri::command]
pub fn unlock_vault(
    path: String,
    password: String,
    state: State<'_, AppState>,
) -> Result<VaultInfo, String> {
    let loaded = vault::load_vault(Path::new(&path), &password)?;
    let hint = loaded.hint.clone();
    state.0.lock().unwrap().install(PathBuf::from(&path), loaded);
    let _ = crate::settings::save_settings(&crate::settings::AppSettings {
        vault_path: Some(path.clone()),
    });
    Ok(VaultInfo { vault_path: path, hint, is_unlocked: true })
}

/// Lock the vault — clears key and contents from memory.
#[tauri::command]
pub fn lock_vault(state: State<'_, AppState>) -> Result<(), String> {
    state.0.lock().unwrap().lock();
    Ok(())
}

/// Return display-ready entry list (no secrets).
#[tauri::command]
pub fn get_entries(state: State<'_, AppState>) -> Result<Vec<EntryListItem>, String> {
    let s = state.0.lock().unwrap();
    let contents = s.contents.as_ref().ok_or("Vault is locked")?;
    Ok(contents.entries.iter().map(list_item).collect())
}

/// Called on app startup to restore last known vault path.
#[tauri::command]
pub fn get_saved_vault_path() -> Option<String> {
    crate::settings::load_settings().vault_path
}

/// Password hint of a vault file (stored unencrypted), shown on the unlock screen.
#[tauri::command]
pub fn read_vault_hint(path: String) -> Option<String> {
    vault::read_hint(Path::new(&path)).ok().flatten()
}

/// Get vault status (path, hint, locked state).
#[tauri::command]
pub fn get_vault_info(state: State<'_, AppState>) -> Option<VaultInfo> {
    let s = state.0.lock().unwrap();
    s.vault_path.as_ref().map(|p| VaultInfo {
        vault_path: p.to_string_lossy().to_string(),
        hint: s.hint.clone(),
        is_unlocked: s.is_unlocked(),
    })
}

#[derive(Deserialize)]
pub struct CreateEntryPayload {
    pub name: String,
    pub folder_id: Option<String>,
    pub tags: Vec<String>,
    pub notes: String,
    pub favorite: bool,
    pub icon: Option<String>,
    pub fields: serde_json::Value,
    pub entry_type: String,
}

/// Create a new entry and save the vault.
#[tauri::command]
pub fn create_entry(
    payload: CreateEntryPayload,
    state: State<'_, AppState>,
) -> Result<EntryListItem, String> {
    let fields = parse_fields(&payload.entry_type, payload.fields)?;
    let mut entry = Entry::new(payload.name, parse_folder_id(payload.folder_id.as_deref()), fields);
    entry.base.tags = payload.tags;
    entry.base.notes = payload.notes;
    entry.base.favorite = payload.favorite;
    entry.base.icon = payload.icon;
    let item = list_item(&entry);
    state.0.lock().unwrap().commit(|c| {
        c.entries.push(entry);
        Ok(())
    })?;
    Ok(item)
}

/// Delete an entry by id and save the vault.
#[tauri::command]
pub fn delete_entry(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let uuid = parse_id(&id)?;
    state.0.lock().unwrap().commit(|c| {
        let before = c.entries.len();
        c.entries.retain(|e| e.base.id != uuid);
        if c.entries.len() == before {
            return Err("Entry not found".to_string());
        }
        Ok(())
    })
}

/// Get full entry details (including secrets) by id. Attachment bytes stay in Rust:
/// the UI only needs names and sizes, and downloads go through `download_attachment`.
#[tauri::command]
pub fn get_entry(id: String, state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let uuid = parse_id(&id)?;
    let s = state.0.lock().unwrap();
    let contents = s.contents.as_ref().ok_or("Vault is locked")?;
    let entry = contents.entries.iter().find(|e| e.base.id == uuid).ok_or("Entry not found")?;
    let mut value = serde_json::to_value(entry).map_err(|e| e.to_string())?;
    if let Some(attachments) = value.get_mut("attachments").and_then(|a| a.as_array_mut()) {
        for attachment in attachments {
            if let Some(obj) = attachment.as_object_mut() {
                obj.remove("content");
            }
        }
    }
    Ok(value)
}

/// List all folders (without encrypted entry details).
#[tauri::command]
pub fn get_folders(state: State<'_, AppState>) -> Result<Vec<serde_json::Value>, String> {
    let s = state.0.lock().unwrap();
    let contents = s.contents.as_ref().ok_or("Vault is locked")?;
    Ok(contents.folders.iter()
        .map(|f| serde_json::json!({
            "id": f.id.to_string(),
            "name": f.name,
            "has_password": f.password_salt.is_some(),
        }))
        .collect())
}

/// True when another device has replaced the vault file since this session last loaded or saved it.
#[tauri::command]
pub fn check_vault_changed(state: State<'_, AppState>) -> bool {
    state.0.lock().unwrap().changed_on_disk()
}

/// Resolve a conflict by writing this session's data over the file on disk ("Keep mine").
#[tauri::command]
pub fn overwrite_vault(state: State<'_, AppState>) -> Result<(), String> {
    let mut s = state.0.lock().unwrap();
    let contents = s.contents.clone().ok_or("Vault is locked")?;
    s.write(contents, false)
}

/// Reload vault from disk after conflict resolution ("Load from disk").
#[tauri::command]
pub fn reload_vault(password: String, state: State<'_, AppState>) -> Result<Vec<EntryListItem>, String> {
    let mut s = state.0.lock().unwrap();
    let path = s.vault_path.clone().ok_or("No vault path")?;
    let loaded = vault::load_vault(&path, &password)?;
    let items: Vec<EntryListItem> = loaded.contents.entries.iter().map(list_item).collect();
    s.install(path, loaded);
    Ok(items)
}

/// List all local backup file paths (newest first).
#[tauri::command]
pub fn list_backups() -> Result<Vec<String>, String> {
    crate::backup::list_backups()
}

#[derive(Deserialize)]
pub struct UpdateEntryPayload {
    pub id: String,
    pub name: String,
    pub folder_id: Option<String>,
    pub tags: Vec<String>,
    pub notes: String,
    pub favorite: bool,
    pub icon: Option<String>,
    pub fields: serde_json::Value,
}

/// Update an existing entry (name, folder, tags, notes, fields) and save the vault.
#[tauri::command]
pub fn update_entry(
    payload: UpdateEntryPayload,
    state: State<'_, AppState>,
) -> Result<EntryListItem, String> {
    let uuid = parse_id(&payload.id)?;
    state.0.lock().unwrap().commit(|c| {
        let entry = c.entries.iter_mut().find(|e| e.base.id == uuid).ok_or("Entry not found")?;
        entry.fields = parse_fields(entry.entry_type().as_str(), payload.fields)?;
        entry.base.name = payload.name;
        entry.base.folder_id = parse_folder_id(payload.folder_id.as_deref());
        entry.base.tags = payload.tags;
        entry.base.notes = payload.notes;
        entry.base.favorite = payload.favorite;
        entry.base.icon = payload.icon;
        entry.base.updated_at = now();
        Ok(list_item(entry))
    })
}

/// Move an entry to trash (soft delete).
#[tauri::command]
pub fn move_to_trash(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let uuid = parse_id(&id)?;
    state.0.lock().unwrap().commit(|c| {
        let pos = c.entries.iter().position(|e| e.base.id == uuid).ok_or("Entry not found")?;
        let mut entry = c.entries.remove(pos);
        // The trash list shows this as the deletion date.
        entry.base.updated_at = now();
        c.trash.push(entry);
        Ok(())
    })
}

/// Restore an entry from trash back to the main entries list.
#[tauri::command]
pub fn restore_from_trash(id: String, state: State<'_, AppState>) -> Result<EntryListItem, String> {
    let uuid = parse_id(&id)?;
    state.0.lock().unwrap().commit(|c| {
        let pos = c.trash.iter().position(|e| e.base.id == uuid).ok_or("Entry not found in trash")?;
        let entry = c.trash.remove(pos);
        let item = list_item(&entry);
        c.entries.push(entry);
        Ok(item)
    })
}

/// Permanently delete one entry from trash.
#[tauri::command]
pub fn delete_from_trash(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let uuid = parse_id(&id)?;
    state.0.lock().unwrap().commit(|c| {
        let before = c.trash.len();
        c.trash.retain(|e| e.base.id != uuid);
        if c.trash.len() == before {
            return Err("Entry not found in trash".to_string());
        }
        Ok(())
    })
}

/// Permanently delete all items in trash.
#[tauri::command]
pub fn empty_trash(state: State<'_, AppState>) -> Result<(), String> {
    state.0.lock().unwrap().commit(|c| {
        c.trash.clear();
        Ok(())
    })
}

/// Return display-ready trash item list.
#[tauri::command]
pub fn get_trash(state: State<'_, AppState>) -> Result<Vec<EntryListItem>, String> {
    let s = state.0.lock().unwrap();
    let contents = s.contents.as_ref().ok_or("Vault is locked")?;
    Ok(contents.trash.iter().map(list_item).collect())
}

/// Attach a file (by path) to an entry — reads, base64-encodes, stores inside vault.
#[tauri::command]
pub fn attach_file(entry_id: String, path: String, state: State<'_, AppState>) -> Result<(), String> {
    let uuid = parse_id(&entry_id)?;
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    if bytes.len() > MAX_ATTACHMENT_BYTES {
        return Err(format!("File too large: {} KB (max 500 KB)", bytes.len() / 1024));
    }
    let name = Path::new(&path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "file".to_string());
    let attachment = FileAttachment {
        mime: mime_for_filename(&name),
        content: base64::engine::general_purpose::STANDARD.encode(&bytes),
        size: bytes.len(),
        name,
    };
    state.0.lock().unwrap().commit(|c| {
        let entry = c.entries.iter_mut().find(|e| e.base.id == uuid).ok_or("Entry not found")?;
        if entry.base.attachments.iter().any(|a| a.name == attachment.name) {
            return Err(format!("An attachment named '{}' already exists", attachment.name));
        }
        entry.base.attachments.push(attachment);
        entry.base.updated_at = now();
        Ok(())
    })
}

/// Write an attachment's decoded bytes to dest_path on disk.
#[tauri::command]
pub fn download_attachment(
    entry_id: String,
    name: String,
    dest_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let uuid = parse_id(&entry_id)?;
    let s = state.0.lock().unwrap();
    let contents = s.contents.as_ref().ok_or("Vault is locked")?;
    let entry = contents.entries.iter().find(|e| e.base.id == uuid).ok_or("Entry not found")?;
    let att = entry.base.attachments.iter().find(|a| a.name == name).ok_or("Attachment not found")?;
    let bytes = base64::engine::general_purpose::STANDARD.decode(&att.content).map_err(|e| e.to_string())?;
    std::fs::write(&dest_path, &bytes).map_err(|e| e.to_string())?;
    Ok(())
}

/// Remove an attachment from an entry and save the vault.
#[tauri::command]
pub fn remove_attachment(entry_id: String, name: String, state: State<'_, AppState>) -> Result<(), String> {
    let uuid = parse_id(&entry_id)?;
    state.0.lock().unwrap().commit(|c| {
        let entry = c.entries.iter_mut().find(|e| e.base.id == uuid).ok_or("Entry not found")?;
        let before = entry.base.attachments.len();
        entry.base.attachments.retain(|a| a.name != name);
        if entry.base.attachments.len() == before {
            return Err("Attachment not found".to_string());
        }
        entry.base.updated_at = now();
        Ok(())
    })
}

/// Create a new folder and save the vault.
#[tauri::command]
pub fn create_folder(name: String, state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let folder = crate::vault::Folder {
        id: Uuid::new_v4(),
        name,
        password_salt: None,
        password_nonce: None,
        encrypted_entries: None,
        entry_ids: vec![],
    };
    let result = serde_json::json!({ "id": folder.id.to_string(), "name": folder.name, "has_password": false });
    state.0.lock().unwrap().commit(|c| {
        c.folders.push(folder);
        Ok(())
    })?;
    Ok(result)
}
