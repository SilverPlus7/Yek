use crate::vault::{self, VaultState};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

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
