# Yek — Password & API Key Manager: Design Spec

**Date:** 2026-06-09  
**Status:** Approved  
**Project path:** `D:\Projects\2026\Yek`

---

## 1. Overview

Yek is a lightweight, multi-platform, open-source, free desktop application for storing passwords, API keys, SSH keys, secure notes, and payment cards. All data is encrypted locally. Sync is achieved by writing a single encrypted vault file to any cloud-synced folder (Google Drive, Dropbox, OneDrive, iCloud, etc.) — no custom backend required.

**Core principles:**
- Local-first: no account, no server, no internet required
- Zero-knowledge: only the user's master password can decrypt data
- Simple sync: one file, any folder, any cloud drive
- Fast to use: icons, quick-copy, keyboard shortcuts

---

## 2. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| App shell | Tauri 2 | Lightweight binary (~10MB), native Windows/Mac/Linux, Android/iOS in v2 |
| Frontend | React 18 + TypeScript | Familiar stack, component-based UI |
| Styling | Tailwind CSS | Utility-first, easy theming |
| Crypto | Rust (`argon2`, `aes-gcm` crates) | Crypto stays in Rust memory, never exposed to JS |
| Icons | Bundled service icon lookup + favicon fallback | Auto-detected from service name/URL |

**Security boundary:** All cryptographic operations (key derivation, encryption, decryption) happen in Rust. The JS/React layer receives only the data needed to render the current view. Raw keys and full decrypted vault JSON never cross into JavaScript.

**Mobile:** Tauri 2 supports Android and iOS. Mobile is a planned v2 feature — desktop ships first. Sync on mobile requires platform file API integration (Google Drive API / iCloud CloudKit), not folder-based.

---

## 3. Architecture

### 3.1 Vault File

A single `vault.yek` file lives in the user's chosen sync folder. It is a JSON document encrypted with AES-256-GCM.

**Plaintext structure (before encryption):**
```json
{
  "version": 1,
  "created_at": "ISO8601",
  "updated_at": "ISO8601",
  "hint": "optional unencrypted password hint",
  "salt": "base64-encoded Argon2 salt",
  "nonce": "base64-encoded AES-GCM nonce",
  "folders": [
    {
      "id": "uuid",
      "name": "Work",
      "has_password": false,
      "encrypted_entries": null,
      "entries": ["entry-uuid-1", "entry-uuid-2"]
    },
    {
      "id": "uuid",
      "name": "Finance",
      "has_password": true,
      "salt": "base64",
      "nonce": "base64",
      "encrypted_entries": "base64-AES-GCM-ciphertext"
    }
  ],
  "entries": [ /* unfoldered entries — see entry schema */ ],
  "tags": ["work", "prod", "personal"]
}
```

### 3.2 Encryption Design

**Unlock flow:**
1. User enters master password
2. Rust: `key = Argon2id(password, salt, m=65536, t=3, p=4)` → 256-bit key
3. Rust: `plaintext = AES-256-GCM.decrypt(key, nonce, ciphertext)`
4. Decrypted vault JSON held in Rust memory only

**Per-folder passwords (optional):**
- Folders with a password store their entries as a nested AES-256-GCM ciphertext
- Key derived from folder password via same Argon2id params with a different salt
- Folder key held in Rust only while folder is unlocked
- Folders without a password are plain organizational containers; entries stored in the top-level vault

**Password change:** Re-derives new key from new password, re-encrypts full vault, writes atomically.

### 3.3 Sync & Conflict Resolution

- **Write:** atomic (`vault.yek.tmp` → rename to `vault.yek`)
- **Read:** on app focus, check file `updated_at` vs in-memory timestamp; silently reload if changed and no local unsaved edits
- **Conflict:** if remote `updated_at` is newer but local has unsaved changes → prompt: **Keep mine / Load from disk / Show diff**
- **Local backups:** rolling last-10-versions stored in `~/.yek/backups/` (not synced)

---

## 4. Entry Types & Data Model

All entries share a common base:

```
id            uuid
type          "login" | "api_key" | "note" | "ssh_key" | "card"
name          string
folder_id     uuid | null
tags          string[]
icon          string  (auto-detected service slug or custom URL)
notes         string
favorite      boolean
created_at    ISO8601
updated_at    ISO8601
```

Type-specific fields:

| Type | Fields |
|---|---|
| Login | `url`, `username`, `password` |
| API Key | `service`, `key`, `secret?`, `token?`, `expires_at?` |
| Secure Note | `content` (plain text or markdown) |
| SSH Key | `public_key`, `private_key`, `passphrase?`, `host?` |
| Card | `cardholder`, `number`, `expiry`, `cvv`, `billing_address?` |

**Smart icons:** Auto-detected from `name`/`url` via a bundled lookup table (GitHub, AWS, Google, Vercel, Stripe, Cloudflare, etc.) — works fully offline. Falls back to a type emoji icon. Live favicon fetching (HTTP request to the service's domain) is opt-in (Settings → Privacy → "Fetch favicons for unrecognized services").

---

## 5. UI/UX

### 5.1 Layout — Sidebar + List + Detail (three-panel)

- **Sidebar (left, ~200px):** Logo, search bar, Library section (Favorites, All Items), Types section (Logins, API Keys, Notes, SSH Keys, Cards with counts), Folders section (user folders, locked folders show 🔒), New Folder button, user avatar + lock button at bottom
- **Entry list (middle, ~240px):** Filtered by sidebar selection. Each row: service icon, name, type badge + tags. One-click selects entry, hover shows quick-copy button.
- **Detail panel (right, flex):** Entry header (icon, name, type, last updated), field rows (masked by default, Show/Copy per field), tags, notes, Edit/Delete buttons.

### 5.2 Quick Actions

- **Hover on list row:** Copy button for primary field (password / key / card number)
- **Keyboard:** `Ctrl+K` / `Cmd+K` — command palette (search + copy without opening entry)
- **Global hotkey:** `Ctrl+Shift+Y` / `Cmd+Shift+Y` — bring Yek to front from anywhere (rebindable)
- **Clipboard auto-clear:** 30s default (configurable: 15s / 30s / 60s / never)

### 5.3 Themes

| Theme | Description |
|---|---|
| Dark (default) | Deep navy, as shown in mockups |
| Light | White/light gray, high readability |
| High Contrast | Pure black bg, bright white text, no transparency, WCAG AAA |
| Midnight | Deep blue-black, softer on eyes for night use |

Theme stored in local settings, not synced — each device keeps its own preference.

---

## 6. Key Screens & Flows

### 6.1 First-time Setup (3-step wizard)
1. **Create master password** — input + confirm + strength meter + optional hint
2. **Choose sync folder** — OS file picker, any local folder
3. **Summary** — shows vault path, creates `vault.yek`, opens app

### 6.2 Unlock Screen
- Centered minimal layout: logo, vault file path, password field, Unlock button
- "View hint" link (shown only if hint was set)
- "Open different vault…" link for multi-vault users

### 6.3 Locked Folder
- Clicking a password-protected folder prompts for the folder password inline
- Folder key held in memory until app locks or user manually re-locks the folder

---

## 7. Security Behavior

| Behavior | Detail |
|---|---|
| Auto-lock | Configurable idle timeout (default 15 min); immediate on sleep/screen lock |
| On lock | Decrypted vault wiped from Rust memory; JS state cleared |
| Master password | Min 12 chars; no recovery; optional hint stored unencrypted in vault header |
| Clipboard | Auto-clears after configurable delay; uses OS clipboard API |
| Telemetry | None. No network calls except optional favicon fetching (opt-in). |
| Export | Unencrypted JSON (emergency/migration) or encrypted `.yek` |

---

## 8. Local Settings (`~/.yek/settings.json`)

Not synced. Per-device:
- Sync folder path
- Theme
- Auto-lock timeout
- Clipboard clear delay
- Global hotkey binding
- Favicon fetching enabled/disabled
- Language/locale

---

## 9. Open Source & Distribution

- License: MIT
- Repository: GitHub (public)
- Releases: GitHub Releases with pre-built binaries for Windows (.msi), macOS (.dmg), Linux (.AppImage / .deb)
- No installer telemetry, no license keys

---

## 10. Out of Scope (v1)

- Mobile app (Android/iOS) — planned v2
- Browser extension / autofill
- Password generator (can add in v1.1)
- Team/shared vaults
- Import from 1Password/Bitwarden (can add in v1.1)
