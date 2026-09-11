use crate::crypto::{decrypt, derive_key, encrypt, generate_salt, KEY_LEN};
use crate::entries::Entry;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use uuid::Uuid;

pub const VAULT_FILE_NAME: &str = "vault.yek";
pub const VAULT_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Folder {
    pub id: Uuid,
    pub name: String,
    pub password_salt: Option<String>,
    pub password_nonce: Option<String>,
    pub encrypted_entries: Option<String>,
    pub entry_ids: Vec<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultData {
    pub version: u32,
    pub created_at: String,
    pub updated_at: String,
    pub hint: Option<String>,
    pub salt: String,
    pub nonce: String,
    pub ciphertext: String,
}

/// The decrypted vault contents — lives only in Rust memory.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultContents {
    pub folders: Vec<Folder>,
    pub entries: Vec<Entry>,
    pub tags: Vec<String>,
    #[serde(default)]
    pub trash: Vec<Entry>,
}

/// Error returned when another device replaced the vault file since this session last read or wrote it.
pub const CONFLICT_ERROR: &str = "VAULT_CONFLICT";

/// Runtime vault state held by the Tauri app.
pub struct VaultState {
    pub vault_path: Option<PathBuf>,
    pub key: Option<[u8; KEY_LEN]>,
    pub contents: Option<VaultContents>,
    pub salt: Option<String>,
    pub hint: Option<String>,
    pub created_at: Option<String>,
    /// Nonce of the vault file this session last loaded or saved. Every save writes a fresh
    /// random nonce, so a different nonce on disk means another device wrote the file.
    pub disk_nonce: Option<String>,
}

/// A decrypted vault as read from disk.
pub struct LoadedVault {
    pub contents: VaultContents,
    pub key: [u8; KEY_LEN],
    pub salt: String,
    pub hint: Option<String>,
    pub created_at: String,
    pub nonce: String,
}

impl VaultState {
    pub fn new() -> Self {
        Self { vault_path: None, key: None, contents: None, salt: None, hint: None, created_at: None, disk_nonce: None }
    }

    pub fn is_unlocked(&self) -> bool {
        self.key.is_some() && self.contents.is_some()
    }

    pub fn lock(&mut self) {
        self.key = None;
        self.contents = None;
        self.disk_nonce = None;
    }

    pub fn install(&mut self, path: PathBuf, vault: LoadedVault) {
        self.vault_path = Some(path);
        self.key = Some(vault.key);
        self.salt = Some(vault.salt);
        self.hint = vault.hint;
        self.created_at = Some(vault.created_at);
        self.contents = Some(vault.contents);
        self.disk_nonce = Some(vault.nonce);
    }

    /// True when another device has replaced the vault file since this session last loaded or saved it.
    pub fn changed_on_disk(&self) -> bool {
        match (self.vault_path.as_deref(), self.disk_nonce.as_deref()) {
            (Some(path), Some(known)) => changed_on_disk(path, known),
            _ => false,
        }
    }

    /// Encrypt `contents` to disk and, only once that succeeds, make it the in-memory vault.
    /// With `check_conflict`, refuses to overwrite a file another device has written.
    pub fn write(&mut self, contents: VaultContents, check_conflict: bool) -> Result<(), String> {
        let path = self.vault_path.clone().ok_or("No vault path")?;
        let key = self.key.ok_or("Vault is locked")?;
        let salt = self.salt.clone().ok_or("No salt")?;
        let created_at = self.created_at.clone().ok_or("No created_at")?;
        if check_conflict && self.changed_on_disk() {
            return Err(CONFLICT_ERROR.to_string());
        }
        let nonce = save_vault(&path, &key, &salt, self.hint.clone(), &created_at, &contents)?;
        self.contents = Some(contents);
        self.disk_nonce = Some(nonce);
        Ok(())
    }

    /// Apply `change` to a copy of the vault and save it. Memory only changes if the save succeeds,
    /// so a failed write (e.g. the file is locked by a sync app) never leaves memory and disk out of step.
    pub fn commit<R>(&mut self, change: impl FnOnce(&mut VaultContents) -> Result<R, String>) -> Result<R, String> {
        let mut next = self.contents.as_ref().ok_or("Vault is locked")?.clone();
        let result = change(&mut next)?;
        self.write(next, true)?;
        Ok(result)
    }
}

/// Create a brand-new vault file at `dir/vault.yek`. Never replaces an existing vault.
pub fn create_vault(dir: &Path, password: &str, hint: Option<String>) -> Result<PathBuf, String> {
    let path = dir.join(VAULT_FILE_NAME);
    if path.exists() {
        return Err("This folder already contains a vault. Use \"Open existing vault\" to unlock it instead.".to_string());
    }
    let salt = generate_salt();
    let key = derive_key(password, &salt)?;
    let now = chrono::Utc::now().to_rfc3339();
    let contents = VaultContents { folders: vec![], entries: vec![], tags: vec![], trash: vec![] };
    let plaintext = serde_json::to_vec(&contents).map_err(|e| e.to_string())?;
    let (ciphertext, nonce) = encrypt(&key, &plaintext)?;
    let vault_data = VaultData {
        version: VAULT_VERSION,
        created_at: now.clone(),
        updated_at: now,
        hint,
        salt,
        nonce,
        ciphertext,
    };
    let tmp = dir.join("vault.yek.tmp");
    let json = serde_json::to_vec_pretty(&vault_data).map_err(|e| e.to_string())?;
    std::fs::write(&tmp, &json).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(path)
}

/// Load and decrypt a vault file.
pub fn load_vault(path: &Path, password: &str) -> Result<LoadedVault, String> {
    let json = std::fs::read(path).map_err(|e| e.to_string())?;
    let vault_data: VaultData = serde_json::from_slice(&json).map_err(|e| e.to_string())?;
    let key = derive_key(password, &vault_data.salt)?;
    let plaintext = decrypt(&key, &vault_data.ciphertext, &vault_data.nonce)?;
    let contents: VaultContents = serde_json::from_slice(&plaintext).map_err(|e| e.to_string())?;
    Ok(LoadedVault {
        contents,
        key,
        salt: vault_data.salt,
        hint: vault_data.hint,
        created_at: vault_data.created_at,
        nonce: vault_data.nonce,
    })
}

/// Re-encrypt and atomically save the vault. Returns the nonce written to disk.
pub fn save_vault(path: &Path, key: &[u8; KEY_LEN], salt: &str, hint: Option<String>, created_at: &str, contents: &VaultContents) -> Result<String, String> {
    let now = chrono::Utc::now().to_rfc3339();
    let plaintext = serde_json::to_vec(contents).map_err(|e| e.to_string())?;
    let (ciphertext, nonce) = encrypt(key, &plaintext)?;
    let vault_data = VaultData {
        version: VAULT_VERSION,
        created_at: created_at.to_string(),
        updated_at: now,
        hint,
        salt: salt.to_string(),
        nonce: nonce.clone(),
        ciphertext,
    };
    let tmp = path.with_extension("yek.tmp");
    let json = serde_json::to_vec_pretty(&vault_data).map_err(|e| e.to_string())?;
    std::fs::write(&tmp, &json).map_err(|e| e.to_string())?;
    if let Err(e) = replace_file(&tmp, path) {
        let _ = std::fs::remove_file(&tmp);
        return Err(e);
    }
    // Best-effort backup — don't fail the save if backup fails. Skipped in unit tests so they never touch ~/.yek.
    #[cfg(not(test))]
    let _ = crate::backup::backup_vault(path);
    Ok(nonce)
}

/// Rename `from` over `to`, retrying briefly: on Windows the rename fails while a sync
/// client or antivirus scanner has the vault file open.
fn replace_file(from: &Path, to: &Path) -> Result<(), String> {
    let mut attempts = 0;
    loop {
        match std::fs::rename(from, to) {
            Ok(()) => return Ok(()),
            Err(_) if attempts < 5 => {
                attempts += 1;
                std::thread::sleep(std::time::Duration::from_millis(200));
            }
            Err(e) => return Err(format!("Could not save the vault file (it may be in use by a sync app): {e}")),
        }
    }
}

/// Read the nonce of the vault file on disk without decrypting it.
pub fn read_nonce(path: &Path) -> Result<String, String> {
    #[derive(Deserialize)]
    struct NonceOnly {
        nonce: String,
    }
    let json = std::fs::read(path).map_err(|e| e.to_string())?;
    let data: NonceOnly = serde_json::from_slice(&json).map_err(|e| e.to_string())?;
    Ok(data.nonce)
}

/// True when the vault file on disk is no longer the version with `known_nonce`.
/// A missing or unreadable file is not treated as a conflict.
pub fn changed_on_disk(path: &Path, known_nonce: &str) -> bool {
    read_nonce(path).map(|nonce| nonce != known_nonce).unwrap_or(false)
}

/// Read the password hint, which is stored unencrypted so the unlock screen can show it.
pub fn read_hint(path: &Path) -> Result<Option<String>, String> {
    #[derive(Deserialize)]
    struct HintOnly {
        hint: Option<String>,
    }
    let json = std::fs::read(path).map_err(|e| e.to_string())?;
    let data: HintOnly = serde_json::from_slice(&json).map_err(|e| e.to_string())?;
    Ok(data.hint)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_create_and_load_vault() {
        let dir = tempdir().unwrap();
        let path = create_vault(dir.path(), "correct-horse", Some("my hint".to_string())).unwrap();
        assert!(path.exists());
        let loaded = load_vault(&path, "correct-horse").unwrap();
        assert_eq!(loaded.hint, Some("my hint".to_string()));
        assert!(loaded.contents.entries.is_empty());
    }

    #[test]
    fn test_load_vault_wrong_password_fails() {
        let dir = tempdir().unwrap();
        let path = create_vault(dir.path(), "correct", None).unwrap();
        assert!(load_vault(&path, "wrong").is_err());
    }

    #[test]
    fn test_save_and_reload_vault_with_data() {
        let dir = tempdir().unwrap();
        let path = create_vault(dir.path(), "pass", None).unwrap();
        let mut v = load_vault(&path, "pass").unwrap();
        v.contents.tags.push("work".to_string());
        save_vault(&path, &v.key, &v.salt, v.hint.clone(), &v.created_at, &v.contents).unwrap();
        let reloaded = load_vault(&path, "pass").unwrap();
        assert_eq!(reloaded.contents.tags, vec!["work"]);
    }

    #[test]
    fn test_create_vault_never_overwrites_existing_vault() {
        let dir = tempdir().unwrap();
        let path = create_vault(dir.path(), "original", None).unwrap();
        assert!(create_vault(dir.path(), "replacement", None).is_err());
        assert!(load_vault(&path, "original").is_ok());
    }

    #[test]
    fn test_changed_on_disk_tracks_last_write() {
        let dir = tempdir().unwrap();
        let path = create_vault(dir.path(), "pass", None).unwrap();
        let v = load_vault(&path, "pass").unwrap();
        assert!(!changed_on_disk(&path, &v.nonce));
        let written = save_vault(&path, &v.key, &v.salt, None, &v.created_at, &v.contents).unwrap();
        assert!(!changed_on_disk(&path, &written));
        assert!(changed_on_disk(&path, &v.nonce));
        assert!(!changed_on_disk(&dir.path().join("missing.yek"), &v.nonce));
    }

    #[test]
    fn test_read_hint_without_password() {
        let dir = tempdir().unwrap();
        let path = create_vault(dir.path(), "pass", Some("first pet".to_string())).unwrap();
        assert_eq!(read_hint(&path).unwrap(), Some("first pet".to_string()));
    }

    fn unlocked_state(dir: &Path) -> VaultState {
        let path = create_vault(dir, "pass", None).unwrap();
        let loaded = load_vault(&path, "pass").unwrap();
        let mut state = VaultState::new();
        state.install(path, loaded);
        state
    }

    #[test]
    fn test_commit_saves_and_updates_memory() {
        let dir = tempdir().unwrap();
        let mut state = unlocked_state(dir.path());
        state.commit(|c| { c.tags.push("x".to_string()); Ok(()) }).unwrap();
        assert_eq!(state.contents.as_ref().unwrap().tags, vec!["x"]);
        let reloaded = load_vault(state.vault_path.as_ref().unwrap(), "pass").unwrap();
        assert_eq!(reloaded.contents.tags, vec!["x"]);
    }

    #[test]
    fn test_commit_keeps_memory_when_change_fails() {
        let dir = tempdir().unwrap();
        let mut state = unlocked_state(dir.path());
        let result: Result<(), String> = state.commit(|c| {
            c.tags.push("x".to_string());
            Err("rejected".to_string())
        });
        assert!(result.is_err());
        assert!(state.contents.as_ref().unwrap().tags.is_empty());
    }

    #[test]
    fn test_commit_keeps_memory_when_save_fails() {
        let dir = tempdir().unwrap();
        let mut state = unlocked_state(dir.path());
        state.vault_path = Some(dir.path().join("no-such-dir").join(VAULT_FILE_NAME));
        assert!(state.commit(|c| { c.tags.push("x".to_string()); Ok(()) }).is_err());
        assert!(state.contents.as_ref().unwrap().tags.is_empty());
    }

    #[test]
    fn test_commit_refuses_to_overwrite_another_devices_save() {
        let dir = tempdir().unwrap();
        let mut state = unlocked_state(dir.path());
        let path = state.vault_path.clone().unwrap();
        let other = load_vault(&path, "pass").unwrap();
        save_vault(&path, &other.key, &other.salt, None, &other.created_at, &other.contents).unwrap();
        assert!(state.changed_on_disk());
        let err = state.commit(|c| { c.tags.push("x".to_string()); Ok(()) }).unwrap_err();
        assert_eq!(err, CONFLICT_ERROR);
        // "Keep mine" writes this session's data over the other device's version.
        let mine = state.contents.clone().unwrap();
        state.write(mine, false).unwrap();
        assert!(!state.changed_on_disk());
        assert!(state.commit(|c| { c.tags.push("x".to_string()); Ok(()) }).is_ok());
    }

    #[test]
    fn test_vault_file_written_atomically() {
        let dir = tempdir().unwrap();
        let path = create_vault(dir.path(), "pass", None).unwrap();
        let tmp = dir.path().join("vault.yek.tmp");
        assert!(!tmp.exists());
        let _ = path;
    }
}
