use crate::entries::{Entry, EntryFields};
use crate::vault::{self, VaultState};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;
use uuid::Uuid;

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

/// Create a new vault at the given directory.
#[tauri::command]
pub fn create_vault(
    dir: String,
    password: String,
    hint: Option<String>,
    state: State<'_, AppState>,
) -> Result<VaultInfo, String> {
    let path = vault::create_vault(std::path::Path::new(&dir), &password, hint.clone())?;
    let (contents, key, salt, _, created_at) = vault::load_vault(&path, &password)?;
    let mut s = state.0.lock().unwrap();
    s.vault_path = Some(path.clone());
    s.key = Some(key);
    s.salt = Some(salt);
    s.hint = hint.clone();
    s.created_at = Some(created_at);
    s.contents = Some(contents);
    let _ = crate::settings::save_settings(&crate::settings::AppSettings {
        vault_path: Some(path.to_string_lossy().to_string()),
    });
    Ok(VaultInfo {
        vault_path: path.to_string_lossy().to_string(),
        hint,
        is_unlocked: true,
    })
}

/// Unlock an existing vault.
#[tauri::command]
pub fn unlock_vault(
    path: String,
    password: String,
    state: State<'_, AppState>,
) -> Result<VaultInfo, String> {
    let p = PathBuf::from(&path);
    let (contents, key, salt, hint, created_at) = vault::load_vault(&p, &password)?;
    let mut s = state.0.lock().unwrap();
    s.vault_path = Some(p);
    s.key = Some(key);
    s.salt = Some(salt);
    s.hint = hint.clone();
    s.created_at = Some(created_at);
    s.contents = Some(contents);
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
    Ok(contents.entries.iter().map(|e| EntryListItem {
        id: e.base.id.to_string(),
        name: e.base.name.clone(),
        entry_type: format!("{:?}", e.entry_type()).to_lowercase(),
        icon: e.base.icon.clone(),
        folder_id: e.base.folder_id.map(|id| id.to_string()),
        tags: e.base.tags.clone(),
        favorite: e.base.favorite,
        updated_at: e.base.updated_at.clone(),
    }).collect())
}

/// Called on app startup to restore last known vault path.
#[tauri::command]
pub fn get_saved_vault_path() -> Option<String> {
    crate::settings::load_settings().vault_path
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
    let mut s = state.0.lock().unwrap();
    let contents = s.contents.as_mut().ok_or("Vault is locked")?;

    let fields: EntryFields = match payload.entry_type.as_str() {
        "login" => EntryFields::Login(serde_json::from_value(payload.fields).map_err(|e| e.to_string())?),
        "api_key" => EntryFields::ApiKey(serde_json::from_value(payload.fields).map_err(|e| e.to_string())?),
        "note" => EntryFields::Note(serde_json::from_value(payload.fields).map_err(|e| e.to_string())?),
        "ssh_key" => EntryFields::SshKey(serde_json::from_value(payload.fields).map_err(|e| e.to_string())?),
        "card" => EntryFields::Card(serde_json::from_value(payload.fields).map_err(|e| e.to_string())?),
        _ => return Err(format!("Unknown entry type: {}", payload.entry_type)),
    };

    let folder_id = payload.folder_id.as_deref().and_then(|s| Uuid::parse_str(s).ok());
    let mut entry = Entry::new(payload.name, folder_id, fields);
    entry.base.tags = payload.tags;
    entry.base.notes = payload.notes;
    entry.base.favorite = payload.favorite;
    entry.base.icon = payload.icon;

    let item = EntryListItem {
        id: entry.base.id.to_string(),
        name: entry.base.name.clone(),
        entry_type: format!("{:?}", entry.entry_type()).to_lowercase(),
        icon: entry.base.icon.clone(),
        folder_id: entry.base.folder_id.map(|id| id.to_string()),
        tags: entry.base.tags.clone(),
        favorite: entry.base.favorite,
        updated_at: entry.base.updated_at.clone(),
    };

    contents.entries.push(entry);

    let path = s.vault_path.clone().ok_or("No vault path")?;
    let key = *s.key.as_ref().ok_or("No key")?;
    let salt = s.salt.clone().ok_or("No salt")?;
    let hint = s.hint.clone();
    let created_at = s.created_at.clone().ok_or("No created_at")?;
    vault::save_vault(&path, &key, &salt, hint, &created_at, s.contents.as_ref().unwrap())?;

    Ok(item)
}

/// Delete an entry by id and save the vault.
#[tauri::command]
pub fn delete_entry(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut s = state.0.lock().unwrap();
    let contents = s.contents.as_mut().ok_or("Vault is locked")?;
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    contents.entries.retain(|e| e.base.id != uuid);
    let path = s.vault_path.clone().ok_or("No vault path")?;
    let key = *s.key.as_ref().ok_or("No key")?;
    let salt = s.salt.clone().ok_or("No salt")?;
    let hint = s.hint.clone();
    let created_at = s.created_at.clone().ok_or("No created_at")?;
    vault::save_vault(&path, &key, &salt, hint, &created_at, s.contents.as_ref().unwrap())?;
    Ok(())
}

/// Get full entry details (including secrets) by id.
#[tauri::command]
pub fn get_entry(id: String, state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let s = state.0.lock().unwrap();
    let contents = s.contents.as_ref().ok_or("Vault is locked")?;
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let entry = contents.entries.iter().find(|e| e.base.id == uuid).ok_or("Entry not found")?;
    serde_json::to_value(entry).map_err(|e| e.to_string())
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

/// Create a new folder and save the vault.
#[tauri::command]
pub fn create_folder(name: String, state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let mut s = state.0.lock().unwrap();
    let contents = s.contents.as_mut().ok_or("Vault is locked")?;
    let folder = crate::vault::Folder {
        id: Uuid::new_v4(),
        name: name.clone(),
        password_salt: None,
        password_nonce: None,
        encrypted_entries: None,
        entry_ids: vec![],
    };
    let result = serde_json::json!({ "id": folder.id.to_string(), "name": folder.name, "has_password": false });
    contents.folders.push(folder);
    let path = s.vault_path.clone().ok_or("No vault path")?;
    let key = *s.key.as_ref().ok_or("No key")?;
    let salt = s.salt.clone().ok_or("No salt")?;
    let hint = s.hint.clone();
    let created_at = s.created_at.clone().ok_or("No created_at")?;
    vault::save_vault(&path, &key, &salt, hint, &created_at, s.contents.as_ref().unwrap())?;
    Ok(result)
}
