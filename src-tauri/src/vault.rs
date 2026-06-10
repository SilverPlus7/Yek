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
}

/// Runtime vault state held by the Tauri app.
pub struct VaultState {
    pub vault_path: Option<PathBuf>,
    pub key: Option<[u8; KEY_LEN]>,
    pub contents: Option<VaultContents>,
    pub salt: Option<String>,
    pub hint: Option<String>,
    pub created_at: Option<String>,
}

impl VaultState {
    pub fn new() -> Self {
        Self { vault_path: None, key: None, contents: None, salt: None, hint: None, created_at: None }
    }

    pub fn is_unlocked(&self) -> bool {
        self.key.is_some() && self.contents.is_some()
    }

    pub fn lock(&mut self) {
        self.key = None;
        self.contents = None;
    }
}

/// Create a brand-new vault file at `dir/vault.yek`.
pub fn create_vault(dir: &Path, password: &str, hint: Option<String>) -> Result<PathBuf, String> {
    let salt = generate_salt();
    let key = derive_key(password, &salt)?;
    let now = chrono::Utc::now().to_rfc3339();
    let contents = VaultContents { folders: vec![], entries: vec![], tags: vec![] };
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
    let path = dir.join(VAULT_FILE_NAME);
    let tmp = dir.join("vault.yek.tmp");
    let json = serde_json::to_vec_pretty(&vault_data).map_err(|e| e.to_string())?;
    std::fs::write(&tmp, &json).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| e.to_string())?;
    Ok(path)
}

/// Load and decrypt a vault file. Returns (VaultContents, key, salt, hint, created_at).
pub fn load_vault(path: &Path, password: &str) -> Result<(VaultContents, [u8; KEY_LEN], String, Option<String>, String), String> {
    let json = std::fs::read(path).map_err(|e| e.to_string())?;
    let vault_data: VaultData = serde_json::from_slice(&json).map_err(|e| e.to_string())?;
    let key = derive_key(password, &vault_data.salt)?;
    let plaintext = decrypt(&key, &vault_data.ciphertext, &vault_data.nonce)?;
    let contents: VaultContents = serde_json::from_slice(&plaintext).map_err(|e| e.to_string())?;
    Ok((contents, key, vault_data.salt, vault_data.hint, vault_data.created_at))
}

/// Re-encrypt and atomically save the vault.
pub fn save_vault(path: &Path, key: &[u8; KEY_LEN], salt: &str, hint: Option<String>, created_at: &str, contents: &VaultContents) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();
    let plaintext = serde_json::to_vec(contents).map_err(|e| e.to_string())?;
    let (ciphertext, nonce) = encrypt(key, &plaintext)?;
    let vault_data = VaultData {
        version: VAULT_VERSION,
        created_at: created_at.to_string(),
        updated_at: now,
        hint,
        salt: salt.to_string(),
        nonce,
        ciphertext,
    };
    let tmp = path.with_extension("yek.tmp");
    let json = serde_json::to_vec_pretty(&vault_data).map_err(|e| e.to_string())?;
    std::fs::write(&tmp, &json).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, path).map_err(|e| e.to_string())?;
    Ok(())
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
        let (contents, _, _, hint, _) = load_vault(&path, "correct-horse").unwrap();
        assert_eq!(hint, Some("my hint".to_string()));
        assert!(contents.entries.is_empty());
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
        let (mut contents, key, salt, hint, created_at) = load_vault(&path, "pass").unwrap();
        contents.tags.push("work".to_string());
        save_vault(&path, &key, &salt, hint, &created_at, &contents).unwrap();
        let (reloaded, _, _, _, _) = load_vault(&path, "pass").unwrap();
        assert_eq!(reloaded.tags, vec!["work"]);
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
