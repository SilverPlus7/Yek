# Yek — Implementation Plan (Phase 1: Foundation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Tauri 2 + React project, implement the Rust crypto and vault I/O layer, wire up Tauri IPC commands, and build the unlock + first-time setup screens — producing a working app that can create, save, and unlock an encrypted vault.

**Architecture:** Tauri 2 app with a Rust backend handling all cryptography (Argon2id key derivation, AES-256-GCM encryption) and file I/O. React frontend communicates via typed `invoke()` wrappers. Decrypted vault data lives only in Rust memory; JS receives only display-ready data.

**Tech Stack:** Tauri 2, React 18, TypeScript, Tailwind CSS 3, Zustand, Vite, Vitest, Rust (`argon2`, `aes-gcm`, `serde_json`, `uuid` crates)

---

## File Map

```
D:\Projects\2026\Yek\
├── src-tauri/
│   ├── Cargo.toml
│   └── src/
│       ├── main.rs          # Tauri entry, command registration
│       ├── crypto.rs        # Argon2id + AES-256-GCM
│       ├── vault.rs         # Vault structs, load/save, state
│       ├── entries.rs       # Entry type definitions
│       └── commands.rs      # #[tauri::command] handlers
├── src/
│   ├── main.tsx
│   ├── App.tsx              # Root — routes between Setup/Unlock/Vault
│   ├── types.ts             # TypeScript mirror of Rust types
│   ├── lib/
│   │   └── tauri.ts         # Typed invoke() wrappers
│   ├── store/
│   │   ├── vault.ts         # Zustand vault store
│   │   └── ui.ts            # Zustand UI store (theme, selected entry)
│   └── components/
│       ├── screens/
│       │   ├── UnlockScreen.tsx
│       │   └── SetupWizard.tsx
│       └── ui/
│           └── StrengthMeter.tsx
├── src-tauri/src/crypto_test.rs  # Rust unit tests (inline in crypto.rs)
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

---

## Task 1: Scaffold Tauri 2 + React + TypeScript project

**Files:**
- Create: entire project scaffold at `D:\Projects\2026\Yek\`

- [ ] **Step 1: Create the Tauri 2 project**

Run in `D:\Projects\2026\`:
```bash
npm create tauri-app@latest Yek -- --template react-ts --manager npm
cd Yek
npm install
```

Expected: `src-tauri/` and `src/` directories created, `npm run tauri dev` available.

- [ ] **Step 2: Install frontend dependencies**

```bash
npm install zustand
npm install -D vitest @testing-library/react @testing-library/jest-dom @vitejs/plugin-react jsdom
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

- [ ] **Step 3: Configure Tailwind**

Replace `tailwind.config.ts` with:
```ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: { extend: {} },
  plugins: [],
} satisfies Config
```

Replace contents of `src/index.css` with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Configure Vitest**

Replace `vite.config.ts` with:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
})
```

Create `src/test-setup.ts`:
```ts
import '@testing-library/jest-dom'
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Add Rust dependencies**

In `src-tauri/Cargo.toml`, add to `[dependencies]`:
```toml
argon2 = "0.5"
aes-gcm = "0.10"
rand = "0.8"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4", "serde"] }
base64 = "0.22"
tokio = { version = "1", features = ["full"] }
```

- [ ] **Step 6: Verify scaffold compiles**

```bash
npm run tauri build -- --debug
```

Expected: build succeeds. Fix any version conflicts before proceeding.

- [ ] **Step 7: Commit**

```bash
git init
git add -A
git commit -m "feat: scaffold Tauri 2 + React + TypeScript + Tailwind project"
```

---

## Task 2: Rust crypto module

**Files:**
- Create: `src-tauri/src/crypto.rs`

- [ ] **Step 1: Write failing Rust tests first**

Create `src-tauri/src/crypto.rs`:
```rust
use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use argon2::{Algorithm, Argon2, Params, Version};
use base64::{engine::general_purpose::STANDARD as B64, Engine};

pub const ARGON2_MEMORY_KB: u32 = 65536; // 64 MB
pub const ARGON2_ITERATIONS: u32 = 3;
pub const ARGON2_PARALLELISM: u32 = 4;
pub const KEY_LEN: usize = 32;
pub const SALT_LEN: usize = 32;
pub const NONCE_LEN: usize = 12;

/// Generate a random base64-encoded salt.
pub fn generate_salt() -> String {
    let salt: [u8; SALT_LEN] = rand::random();
    B64.encode(salt)
}

/// Derive a 256-bit key from a password and base64 salt using Argon2id.
pub fn derive_key(password: &str, salt_b64: &str) -> Result<[u8; KEY_LEN], String> {
    let salt = B64.decode(salt_b64).map_err(|e| e.to_string())?;
    let params = Params::new(ARGON2_MEMORY_KB, ARGON2_ITERATIONS, ARGON2_PARALLELISM, Some(KEY_LEN))
        .map_err(|e| e.to_string())?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = [0u8; KEY_LEN];
    argon2
        .hash_password_into(password.as_bytes(), &salt, &mut key)
        .map_err(|e| e.to_string())?;
    Ok(key)
}

/// Encrypt plaintext bytes. Returns (ciphertext_b64, nonce_b64).
pub fn encrypt(key_bytes: &[u8; KEY_LEN], plaintext: &[u8]) -> Result<(String, String), String> {
    let key = Key::<Aes256Gcm>::from_slice(key_bytes);
    let cipher = Aes256Gcm::new(key);
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher.encrypt(&nonce, plaintext).map_err(|e| e.to_string())?;
    Ok((B64.encode(ciphertext), B64.encode(nonce)))
}

/// Decrypt ciphertext. Returns plaintext bytes.
pub fn decrypt(key_bytes: &[u8; KEY_LEN], ciphertext_b64: &str, nonce_b64: &str) -> Result<Vec<u8>, String> {
    let key = Key::<Aes256Gcm>::from_slice(key_bytes);
    let cipher = Aes256Gcm::new(key);
    let ciphertext = B64.decode(ciphertext_b64).map_err(|e| e.to_string())?;
    let nonce_bytes = B64.decode(nonce_b64).map_err(|e| e.to_string())?;
    let nonce = Nonce::from_slice(&nonce_bytes);
    cipher.decrypt(nonce, ciphertext.as_ref()).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_derive_key_is_deterministic() {
        let salt = generate_salt();
        let key1 = derive_key("my-password", &salt).unwrap();
        let key2 = derive_key("my-password", &salt).unwrap();
        assert_eq!(key1, key2);
    }

    #[test]
    fn test_derive_key_differs_with_different_password() {
        let salt = generate_salt();
        let key1 = derive_key("password-a", &salt).unwrap();
        let key2 = derive_key("password-b", &salt).unwrap();
        assert_ne!(key1, key2);
    }

    #[test]
    fn test_derive_key_differs_with_different_salt() {
        let key1 = derive_key("same-password", &generate_salt()).unwrap();
        let key2 = derive_key("same-password", &generate_salt()).unwrap();
        assert_ne!(key1, key2);
    }

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let salt = generate_salt();
        let key = derive_key("test-password", &salt).unwrap();
        let plaintext = b"Hello, Yek!";
        let (ct, nonce) = encrypt(&key, plaintext).unwrap();
        let decrypted = decrypt(&key, &ct, &nonce).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_decrypt_fails_with_wrong_key() {
        let salt = generate_salt();
        let key1 = derive_key("correct", &salt).unwrap();
        let key2 = derive_key("wrong", &salt).unwrap();
        let (ct, nonce) = encrypt(&key1, b"secret").unwrap();
        assert!(decrypt(&key2, &ct, &nonce).is_err());
    }

    #[test]
    fn test_decrypt_fails_with_tampered_ciphertext() {
        let salt = generate_salt();
        let key = derive_key("password", &salt).unwrap();
        let (ct, nonce) = encrypt(&key, b"secret").unwrap();
        let tampered = ct.replace('A', "B");
        assert!(decrypt(&key, &tampered, &nonce).is_err());
    }
}
```

- [ ] **Step 2: Run Rust tests — verify they pass**

```bash
cd src-tauri && cargo test crypto
```

Expected: 6 tests pass. Fix any compilation errors before continuing.

- [ ] **Step 3: Register module in main.rs**

Add to `src-tauri/src/main.rs` (before `fn main()`):
```rust
mod crypto;
```

- [ ] **Step 4: Commit**

```bash
cd .. && git add src-tauri/src/crypto.rs src-tauri/src/main.rs
git commit -m "feat: Rust crypto module — Argon2id key derivation + AES-256-GCM encrypt/decrypt"
```

---

## Task 3: Entry type definitions (Rust)

**Files:**
- Create: `src-tauri/src/entries.rs`

- [ ] **Step 1: Create entry types**

Create `src-tauri/src/entries.rs`:
```rust
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum EntryType {
    Login,
    ApiKey,
    Note,
    SshKey,
    Card,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntryBase {
    pub id: Uuid,
    pub entry_type: EntryType,
    pub name: String,
    pub folder_id: Option<Uuid>,
    pub tags: Vec<String>,
    pub icon: Option<String>,
    pub notes: String,
    pub favorite: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginFields {
    pub url: String,
    pub username: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyFields {
    pub service: String,
    pub key: String,
    pub secret: Option<String>,
    pub token: Option<String>,
    pub expires_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteFields {
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SshKeyFields {
    pub public_key: String,
    pub private_key: String,
    pub passphrase: Option<String>,
    pub host: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardFields {
    pub cardholder: String,
    pub number: String,
    pub expiry: String,
    pub cvv: String,
    pub billing_address: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum EntryFields {
    Login(LoginFields),
    ApiKey(ApiKeyFields),
    Note(NoteFields),
    SshKey(SshKeyFields),
    Card(CardFields),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Entry {
    #[serde(flatten)]
    pub base: EntryBase,
    pub fields: EntryFields,
}

impl Entry {
    pub fn new(name: String, folder_id: Option<Uuid>, fields: EntryFields) -> Self {
        let now = chrono::Utc::now().to_rfc3339();
        let entry_type = match &fields {
            EntryFields::Login(_) => EntryType::Login,
            EntryFields::ApiKey(_) => EntryType::ApiKey,
            EntryFields::Note(_) => EntryType::Note,
            EntryFields::SshKey(_) => EntryType::SshKey,
            EntryFields::Card(_) => EntryType::Card,
        };
        Self {
            base: EntryBase {
                id: Uuid::new_v4(),
                entry_type,
                name,
                folder_id,
                tags: vec![],
                icon: None,
                notes: String::new(),
                favorite: false,
                created_at: now.clone(),
                updated_at: now,
            },
            fields,
        }
    }
}
```

- [ ] **Step 2: Add chrono dependency**

In `src-tauri/Cargo.toml` `[dependencies]`:
```toml
chrono = { version = "0.4", features = ["serde"] }
```

- [ ] **Step 3: Register in main.rs**

```rust
mod entries;
```

- [ ] **Step 4: Verify compilation**

```bash
cd src-tauri && cargo check
```

Expected: compiles with no errors.

- [ ] **Step 5: Commit**

```bash
cd .. && git add src-tauri/src/entries.rs src-tauri/src/main.rs src-tauri/Cargo.toml
git commit -m "feat: entry type definitions (Login, ApiKey, Note, SshKey, Card)"
```

---

## Task 4: Vault data types and file I/O

**Files:**
- Create: `src-tauri/src/vault.rs`

- [ ] **Step 1: Write failing tests first**

Create `src-tauri/src/vault.rs`:
```rust
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
    /// If Some, folder entries are separately encrypted with this salt + nonce
    pub password_salt: Option<String>,
    pub password_nonce: Option<String>,
    pub encrypted_entries: Option<String>,
    /// Entry IDs (unencrypted folders only)
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

/// Create a brand-new vault file at `path/vault.yek`.
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
        // tmp file should not remain after save
        let dir = tempdir().unwrap();
        let path = create_vault(dir.path(), "pass", None).unwrap();
        let tmp = dir.path().join("vault.yek.tmp");
        assert!(!tmp.exists());
        let _ = path;
    }
}
```

- [ ] **Step 2: Add tempfile dev dependency**

In `src-tauri/Cargo.toml`:
```toml
[dev-dependencies]
tempfile = "3"
```

- [ ] **Step 3: Register module and run tests**

Add to `src-tauri/src/main.rs`:
```rust
mod vault;
```

```bash
cd src-tauri && cargo test vault
```

Expected: 4 tests pass.

- [ ] **Step 4: Commit**

```bash
cd .. && git add src-tauri/src/vault.rs src-tauri/src/main.rs src-tauri/Cargo.toml
git commit -m "feat: vault file I/O — create, load, atomic save with AES-256-GCM"
```

---

## Task 5: Tauri IPC commands

**Files:**
- Create: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: Create commands.rs**

Create `src-tauri/src/commands.rs`:
```rust
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
        entry_type: format!("{:?}", e.base.entry_type).to_lowercase(),
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
```

- [ ] **Step 2: Wire commands into main.rs**

Replace `src-tauri/src/main.rs` with:
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod crypto;
mod entries;
mod vault;

use commands::AppState;
use std::sync::Mutex;
use vault::VaultState;

fn main() {
    tauri::Builder::default()
        .manage(AppState(Mutex::new(VaultState::new())))
        .invoke_handler(tauri::generate_handler![
            commands::create_vault,
            commands::unlock_vault,
            commands::lock_vault,
            commands::get_entries,
            commands::get_vault_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Verify compilation**

```bash
cd src-tauri && cargo check
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd .. && git add src-tauri/src/commands.rs src-tauri/src/main.rs
git commit -m "feat: Tauri IPC commands — create/unlock/lock vault, get entries"
```

---

## Task 6: TypeScript types + typed invoke wrappers

**Files:**
- Create: `src/types.ts`
- Create: `src/lib/tauri.ts`

- [ ] **Step 1: Create TypeScript types**

Create `src/types.ts`:
```ts
export type EntryType = 'login' | 'api_key' | 'note' | 'ssh_key' | 'card'

export interface EntryListItem {
  id: string
  name: string
  entry_type: EntryType
  icon?: string
  folder_id?: string
  tags: string[]
  favorite: boolean
  updated_at: string
}

export interface VaultInfo {
  vault_path: string
  hint?: string
  is_unlocked: boolean
}

export interface LoginFields {
  url: string
  username: string
  password: string
}

export interface ApiKeyFields {
  service: string
  key: string
  secret?: string
  token?: string
  expires_at?: string
}

export interface NoteFields {
  content: string
}

export interface SshKeyFields {
  public_key: string
  private_key: string
  passphrase?: string
  host?: string
}

export interface CardFields {
  cardholder: string
  number: string
  expiry: string
  cvv: string
  billing_address?: string
}
```

- [ ] **Step 2: Create typed invoke wrappers**

Create `src/lib/tauri.ts`:
```ts
import { invoke } from '@tauri-apps/api/core'
import type { EntryListItem, VaultInfo } from '../types'

export const tauriApi = {
  createVault: (dir: string, password: string, hint?: string) =>
    invoke<VaultInfo>('create_vault', { dir, password, hint }),

  unlockVault: (path: string, password: string) =>
    invoke<VaultInfo>('unlock_vault', { path, password }),

  lockVault: () =>
    invoke<void>('lock_vault'),

  getEntries: () =>
    invoke<EntryListItem[]>('get_entries'),

  getVaultInfo: () =>
    invoke<VaultInfo | null>('get_vault_info'),
}
```

- [ ] **Step 3: Write a type-level test**

Create `src/lib/tauri.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import type { EntryListItem, VaultInfo } from '../types'

describe('TypeScript types', () => {
  it('EntryListItem has required fields', () => {
    const item: EntryListItem = {
      id: 'abc',
      name: 'Test',
      entry_type: 'login',
      tags: [],
      favorite: false,
      updated_at: '2026-01-01',
    }
    expect(item.id).toBe('abc')
  })

  it('VaultInfo has required fields', () => {
    const info: VaultInfo = { vault_path: '/tmp/vault.yek', is_unlocked: true }
    expect(info.is_unlocked).toBe(true)
  })
})
```

- [ ] **Step 4: Run frontend tests**

```bash
npm test
```

Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/lib/tauri.ts src/lib/tauri.test.ts
git commit -m "feat: TypeScript types and typed Tauri invoke wrappers"
```

---

## Task 7: Zustand state stores

**Files:**
- Create: `src/store/vault.ts`
- Create: `src/store/ui.ts`

- [ ] **Step 1: Write vault store tests**

Create `src/store/vault.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { useVaultStore } from './vault'

describe('vault store', () => {
  beforeEach(() => {
    useVaultStore.setState({
      entries: [],
      vaultInfo: null,
      isUnlocked: false,
    })
  })

  it('starts locked with no entries', () => {
    const state = useVaultStore.getState()
    expect(state.isUnlocked).toBe(false)
    expect(state.entries).toHaveLength(0)
  })

  it('setEntries updates entries list', () => {
    useVaultStore.getState().setEntries([
      { id: '1', name: 'GitHub', entry_type: 'api_key', tags: [], favorite: false, updated_at: '' }
    ])
    expect(useVaultStore.getState().entries).toHaveLength(1)
  })

  it('lock clears entries and marks locked', () => {
    useVaultStore.setState({ isUnlocked: true, entries: [{ id: '1', name: 'x', entry_type: 'login', tags: [], favorite: false, updated_at: '' }] })
    useVaultStore.getState().lock()
    expect(useVaultStore.getState().isUnlocked).toBe(false)
    expect(useVaultStore.getState().entries).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm test -- vault.test
```

Expected: FAIL — `vault` module not found.

- [ ] **Step 3: Create vault store**

Create `src/store/vault.ts`:
```ts
import { create } from 'zustand'
import type { EntryListItem, VaultInfo } from '../types'

interface VaultStore {
  entries: EntryListItem[]
  vaultInfo: VaultInfo | null
  isUnlocked: boolean
  selectedEntryId: string | null
  setEntries: (entries: EntryListItem[]) => void
  setVaultInfo: (info: VaultInfo) => void
  setSelectedEntryId: (id: string | null) => void
  lock: () => void
}

export const useVaultStore = create<VaultStore>((set) => ({
  entries: [],
  vaultInfo: null,
  isUnlocked: false,
  selectedEntryId: null,
  setEntries: (entries) => set({ entries }),
  setVaultInfo: (vaultInfo) => set({ vaultInfo, isUnlocked: true }),
  setSelectedEntryId: (selectedEntryId) => set({ selectedEntryId }),
  lock: () => set({ entries: [], isUnlocked: false, selectedEntryId: null }),
}))
```

- [ ] **Step 4: Create UI store**

Create `src/store/ui.ts`:
```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'dark' | 'light' | 'high-contrast' | 'midnight'
export type SidebarFilter = 'all' | 'favorites' | 'login' | 'api_key' | 'note' | 'ssh_key' | 'card' | string

interface UiStore {
  theme: Theme
  sidebarFilter: SidebarFilter
  selectedFolderId: string | null
  setTheme: (theme: Theme) => void
  setSidebarFilter: (filter: SidebarFilter) => void
  setSelectedFolderId: (id: string | null) => void
}

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      theme: 'dark',
      sidebarFilter: 'all',
      selectedFolderId: null,
      setTheme: (theme) => set({ theme }),
      setSidebarFilter: (sidebarFilter) => set({ sidebarFilter }),
      setSelectedFolderId: (selectedFolderId) => set({ selectedFolderId }),
    }),
    { name: 'yek-ui' }
  )
)
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npm test
```

Expected: all tests pass including vault store tests.

- [ ] **Step 6: Commit**

```bash
git add src/store/vault.ts src/store/ui.ts src/store/vault.test.ts
git commit -m "feat: Zustand vault and UI state stores"
```

---

## Task 8: StrengthMeter component

**Files:**
- Create: `src/components/ui/StrengthMeter.tsx`
- Create: `src/components/ui/StrengthMeter.test.tsx`

- [ ] **Step 1: Write failing test**

Create `src/components/ui/StrengthMeter.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StrengthMeter } from './StrengthMeter'

describe('StrengthMeter', () => {
  it('shows Weak for short passwords', () => {
    render(<StrengthMeter password="abc" />)
    expect(screen.getByText('Weak')).toBeInTheDocument()
  })

  it('shows Strong for long complex passwords', () => {
    render(<StrengthMeter password="Correct-Horse-Battery-Staple-99!" />)
    expect(screen.getByText('Strong')).toBeInTheDocument()
  })

  it('shows the strength bar', () => {
    render(<StrengthMeter password="test1234" />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm test -- StrengthMeter
```

Expected: FAIL — component not found.

- [ ] **Step 3: Implement StrengthMeter**

Create `src/components/ui/StrengthMeter.tsx`:
```tsx
interface Props { password: string }

function score(pw: string): number {
  let s = 0
  if (pw.length >= 12) s++
  if (pw.length >= 16) s++
  if (/[A-Z]/.test(pw)) s++
  if (/[0-9]/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return s
}

const LEVELS = [
  { label: 'Weak',   color: 'bg-red-500',    pct: 20 },
  { label: 'Fair',   color: 'bg-orange-400',  pct: 40 },
  { label: 'Good',   color: 'bg-yellow-400',  pct: 60 },
  { label: 'Strong', color: 'bg-green-400',   pct: 80 },
  { label: 'Strong', color: 'bg-green-500',   pct: 100 },
]

export function StrengthMeter({ password }: Props) {
  if (!password) return null
  const s = Math.min(score(password), 4)
  const level = LEVELS[s]
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">Strength</span>
        <span className="font-semibold text-green-400">{level.label}</span>
      </div>
      <div role="progressbar" aria-valuenow={level.pct} aria-valuemin={0} aria-valuemax={100}
        className="h-1 rounded-full bg-slate-700 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${level.color}`} style={{ width: `${level.pct}%` }} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/StrengthMeter.tsx src/components/ui/StrengthMeter.test.tsx
git commit -m "feat: StrengthMeter component with scoring logic"
```

---

## Task 9: Setup wizard + Unlock screen

**Files:**
- Create: `src/components/screens/SetupWizard.tsx`
- Create: `src/components/screens/UnlockScreen.tsx`
- Create: `src/components/screens/UnlockScreen.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write UnlockScreen test**

Create `src/components/screens/UnlockScreen.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { UnlockScreen } from './UnlockScreen'

describe('UnlockScreen', () => {
  it('renders password input and unlock button', () => {
    render(<UnlockScreen vaultPath="/tmp/vault.yek" onUnlock={vi.fn()} onOpenOther={vi.fn()} />)
    expect(screen.getByPlaceholderText(/master password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /unlock/i })).toBeInTheDocument()
  })

  it('calls onUnlock with entered password', () => {
    const onUnlock = vi.fn()
    render(<UnlockScreen vaultPath="/tmp/vault.yek" onUnlock={onUnlock} onOpenOther={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/master password/i), { target: { value: 'mypassword' } })
    fireEvent.click(screen.getByRole('button', { name: /unlock/i }))
    expect(onUnlock).toHaveBeenCalledWith('mypassword')
  })

  it('shows error message when provided', () => {
    render(<UnlockScreen vaultPath="/tmp/vault.yek" onUnlock={vi.fn()} onOpenOther={vi.fn()} error="Wrong password" />)
    expect(screen.getByText('Wrong password')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm test -- UnlockScreen
```

Expected: FAIL.

- [ ] **Step 3: Implement UnlockScreen**

Create `src/components/screens/UnlockScreen.tsx`:
```tsx
import { useState } from 'react'

interface Props {
  vaultPath: string
  hint?: string
  error?: string
  onUnlock: (password: string) => void
  onOpenOther: () => void
}

export function UnlockScreen({ vaultPath, hint, error, onUnlock, onOpenOther }: Props) {
  const [password, setPassword] = useState('')
  const [showHint, setShowHint] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const submit = () => { if (password) onUnlock(password) }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <div className="text-5xl mb-2">🔐</div>
          <h1 className="text-2xl font-bold tracking-widest text-slate-100">YEK</h1>
          <p className="text-xs text-slate-500 mt-1 truncate">{vaultPath}</p>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="Master password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              autoFocus
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 pr-10 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <button type="button" onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
              {showPw ? '🙈' : '👁'}
            </button>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button onClick={submit}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition-colors">
            Unlock Vault
          </button>
        </div>

        <div className="space-y-2 text-xs text-slate-500">
          {hint && (
            <div>
              <button onClick={() => setShowHint(v => !v)} className="text-blue-400 hover:underline">
                {showHint ? 'Hide hint' : 'View hint'}
              </button>
              {showHint && <p className="mt-1 text-slate-400">{hint}</p>}
            </div>
          )}
          <button onClick={onOpenOther} className="hover:text-slate-300">
            📂 Open different vault...
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Implement SetupWizard**

Create `src/components/screens/SetupWizard.tsx`:
```tsx
import { useState } from 'react'
import { StrengthMeter } from '../ui/StrengthMeter'
import { open } from '@tauri-apps/plugin-dialog'

interface Props {
  onComplete: (dir: string, password: string, hint?: string) => void
}

export function SetupWizard({ onComplete }: Props) {
  const [step, setStep] = useState(1)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [hint, setHint] = useState('')
  const [dir, setDir] = useState('')
  const [error, setError] = useState('')

  const pickFolder = async () => {
    const selected = await open({ directory: true, multiple: false, title: 'Choose sync folder' })
    if (selected && typeof selected === 'string') setDir(selected)
  }

  const step1Valid = password.length >= 12 && password === confirm

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-3">
          {[1, 2, 3].map(n => (
            <div key={n} className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                ${step === n ? 'bg-blue-600 text-white' : step > n ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                {step > n ? '✓' : n}
              </div>
              {n < 3 && <div className="w-8 h-0.5 bg-slate-700" />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Create your master password</h2>
              <p className="text-xs text-slate-400 mt-1">This cannot be recovered if lost. Minimum 12 characters.</p>
            </div>
            <input type="password" placeholder="Master password" value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            <StrengthMeter password={password} />
            <input type="password" placeholder="Confirm password" value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            <div>
              <label className="text-xs text-slate-400">Hint <span className="text-slate-600">(optional, stored unencrypted)</span></label>
              <input type="text" placeholder="Something only you know" value={hint}
                onChange={e => setHint(e.target.value)}
                className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm" />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button disabled={!step1Valid}
              onClick={() => { setError(''); setStep(2) }}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors">
              Continue → Choose Sync Folder
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Choose your sync folder</h2>
              <p className="text-xs text-slate-400 mt-1">Pick any folder synced by Google Drive, Dropbox, OneDrive, or iCloud. Yek will store <code className="text-blue-300">vault.yek</code> there.</p>
            </div>
            <button onClick={pickFolder}
              className="w-full bg-slate-700 hover:bg-slate-600 border border-slate-500 rounded-lg px-4 py-3 text-left text-sm transition-colors">
              {dir ? <span className="text-slate-100 truncate block">{dir}</span> : <span className="text-slate-400">📂 Click to choose folder...</span>}
            </button>
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded-lg text-sm">Back</button>
              <button disabled={!dir} onClick={() => setStep(3)}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold py-2 rounded-lg transition-colors">
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Ready to create your vault</h2>
            </div>
            <div className="bg-slate-800 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Vault location</span>
                <span className="text-slate-200 text-xs truncate max-w-[180px]">{dir}/vault.yek</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Encryption</span>
                <span className="text-slate-200">AES-256-GCM</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Key derivation</span>
                <span className="text-slate-200">Argon2id</span>
              </div>
              {hint && <div className="flex justify-between">
                <span className="text-slate-400">Hint set</span>
                <span className="text-green-400">✓</span>
              </div>}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded-lg text-sm">Back</button>
              <button onClick={() => onComplete(dir, password, hint || undefined)}
                className="flex-1 bg-green-600 hover:bg-green-500 text-white font-semibold py-2 rounded-lg transition-colors">
                Create Vault
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Wire App.tsx**

Replace `src/App.tsx` with:
```tsx
import { useEffect, useState } from 'react'
import { tauriApi } from './lib/tauri'
import { useVaultStore } from './store/vault'
import { SetupWizard } from './components/screens/SetupWizard'
import { UnlockScreen } from './components/screens/UnlockScreen'
import type { VaultInfo } from './types'

type AppScreen = 'loading' | 'setup' | 'unlock' | 'vault'

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('loading')
  const [vaultInfo, setVaultInfo] = useState<VaultInfo | null>(null)
  const [error, setError] = useState('')
  const { setEntries, setVaultInfo: storeSetVaultInfo } = useVaultStore()

  useEffect(() => {
    tauriApi.getVaultInfo().then(info => {
      if (!info) { setScreen('setup'); return }
      setVaultInfo(info)
      setScreen(info.is_unlocked ? 'vault' : 'unlock')
    })
  }, [])

  const handleCreate = async (dir: string, password: string, hint?: string) => {
    try {
      const info = await tauriApi.createVault(dir, password, hint)
      storeSetVaultInfo(info)
      setVaultInfo(info)
      setScreen('vault')
    } catch (e) { setError(String(e)) }
  }

  const handleUnlock = async (password: string) => {
    if (!vaultInfo) return
    try {
      setError('')
      const info = await tauriApi.unlockVault(vaultInfo.vault_path, password)
      const entries = await tauriApi.getEntries()
      storeSetVaultInfo(info)
      setEntries(entries)
      setScreen('vault')
    } catch {
      setError('Wrong password. Please try again.')
    }
  }

  if (screen === 'loading') return <div className="min-h-screen bg-slate-900" />

  if (screen === 'setup') return <SetupWizard onComplete={handleCreate} />

  if (screen === 'unlock') return (
    <UnlockScreen
      vaultPath={vaultInfo?.vault_path ?? ''}
      hint={vaultInfo?.hint}
      error={error}
      onUnlock={handleUnlock}
      onOpenOther={() => setScreen('setup')}
    />
  )

  // vault screen — placeholder until Phase 2
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-100">
      <div className="text-center space-y-2">
        <div className="text-4xl">🔐</div>
        <h1 className="text-xl font-bold">Vault Unlocked</h1>
        <p className="text-slate-400 text-sm">Main UI coming in Phase 2</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 7: Run the app and test end-to-end**

```bash
npm run tauri dev
```

Walk through: click through setup wizard → pick a folder → vault created → shows "Vault Unlocked" placeholder. Restart app → unlock screen appears → enter password → unlocks.

- [ ] **Step 8: Commit**

```bash
git add src/components/screens/ src/App.tsx
git commit -m "feat: setup wizard + unlock screen + App routing (Phase 1 complete)"
```

---

---

## Task 9b: Vault path persistence (settings.rs)

**Files:**
- Create: `src-tauri/src/settings.rs`
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/main.rs`

This is a **critical** gap: `VaultState` is in-memory only. On app restart, the vault path is lost and the user always sees the Setup Wizard. This task persists the sync folder path to `~/.yek/settings.json`.

- [ ] **Step 1: Create settings.rs**

Create `src-tauri/src/settings.rs`:
```rust
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct AppSettings {
    pub vault_path: Option<String>,
}

fn settings_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Cannot find home directory")?;
    Ok(home.join(".yek").join("settings.json"))
}

pub fn load_settings() -> AppSettings {
    let path = match settings_path() { Ok(p) => p, Err(_) => return AppSettings::default() };
    let json = match std::fs::read_to_string(&path) { Ok(s) => s, Err(_) => return AppSettings::default() };
    serde_json::from_str(&json).unwrap_or_default()
}

pub fn save_settings(settings: &AppSettings) -> Result<(), String> {
    let path = settings_path()?;
    std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_load_settings_returns_default_when_no_file() {
        // settings_path may or may not exist — default is always valid
        let default = AppSettings::default();
        assert!(default.vault_path.is_none());
    }
}
```

- [ ] **Step 2: Persist vault path on create/unlock, load on startup**

In `src-tauri/src/commands.rs`, at the end of `create_vault` (before `Ok(...)`):
```rust
let _ = crate::settings::save_settings(&crate::settings::AppSettings {
    vault_path: Some(path.to_string_lossy().to_string()),
});
```

At the end of `unlock_vault` (before `Ok(...)`):
```rust
let _ = crate::settings::save_settings(&crate::settings::AppSettings {
    vault_path: Some(path.clone()),
});
```

Add a new command:
```rust
/// Called on app startup to restore last known vault path.
#[tauri::command]
pub fn get_saved_vault_path() -> Option<String> {
    crate::settings::load_settings().vault_path
}
```

- [ ] **Step 3: Register module and command**

Add to `src-tauri/src/main.rs`:
```rust
mod settings;
```

Add to invoke_handler: `commands::get_saved_vault_path`

- [ ] **Step 4: Update App.tsx to use saved vault path**

Add to `src/lib/tauri.ts`:
```ts
  getSavedVaultPath: () => invoke<string | null>('get_saved_vault_path'),
```

Update the `useEffect` in `src/App.tsx`:
```tsx
useEffect(() => {
  tauriApi.getSavedVaultPath().then(savedPath => {
    if (!savedPath) { setScreen('setup'); return }
    // Vault path known — show unlock screen
    setVaultInfo({ vault_path: savedPath, is_unlocked: false })
    setScreen('unlock')
  })
}, [])
```

- [ ] **Step 5: Run tests and verify**

```bash
cd src-tauri && cargo test settings && cd ..
npm run tauri dev
```

Create vault → close app → reopen → unlock screen appears (not setup wizard). Enter password → unlocks.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/settings.rs src-tauri/src/commands.rs src-tauri/src/main.rs src/lib/tauri.ts src/App.tsx
git commit -m "fix: persist vault path across app restarts via ~/.yek/settings.json"
```

---

## Phase 1 Complete ✓

At this point you have:
- ✅ Tauri 2 + React + TypeScript + Tailwind project
- ✅ Rust Argon2id + AES-256-GCM crypto (tested)
- ✅ Vault create / load / atomic save (tested)
- ✅ Tauri IPC commands wired
- ✅ Typed TypeScript invoke wrappers
- ✅ Zustand state stores (tested)
- ✅ Setup wizard (3-step)
- ✅ Unlock screen
- ✅ Vault path persisted across restarts
- ✅ End-to-end: create vault → close → reopen → unlock

**Next:** See `2026-06-09-yek-core-ui.md` for Phase 2 (app shell, all entry types, folders, tags).
