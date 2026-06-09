# Yek — Implementation Plan (Phase 2: Core UI)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full three-panel vault UI — sidebar, entry list, detail panels, add/edit forms for all 5 entry types, folder management, and tags.

**Prerequisite:** Phase 1 (`2026-06-09-yek-foundation.md`) must be complete. The vault unlocks and shows the "Vault Unlocked" placeholder.

**Architecture:** React components wired to Zustand stores. New Tauri commands added for CRUD operations (add/update/delete entry, folder management). All mutations go through Rust which re-encrypts and saves.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Zustand (existing), Tauri invoke() wrappers (existing)

---

## File Map (new files in this phase)

```
src-tauri/src/
  commands.rs        # extend with entry CRUD + folder commands

src/
  components/
    layout/
      AppShell.tsx         # Three-panel layout wrapper
      Sidebar.tsx          # Left nav — types, folders, favorites
      EntryList.tsx        # Middle panel — filtered entry rows
      DetailPanel.tsx      # Right panel — routes to type-specific detail
    entries/
      EntryRow.tsx         # Single row in the list (icon + name + quick-copy)
      LoginDetail.tsx      # Detail view for Login entries
      ApiKeyDetail.tsx
      NoteDetail.tsx
      SshKeyDetail.tsx
      CardDetail.tsx
    forms/
      EntryFormModal.tsx   # Modal wrapper for add/edit
      LoginForm.tsx
      ApiKeyForm.tsx
      NoteForm.tsx
      SshKeyForm.tsx
      CardForm.tsx
    ui/
      MaskedField.tsx      # Field row: masked value + Show + Copy buttons
      TagBadge.tsx         # Colored tag chip
      Modal.tsx            # Reusable modal wrapper
```

---

## Task 10: Extend Tauri commands for entry CRUD

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: Add entry CRUD commands to commands.rs**

Append to `src-tauri/src/commands.rs`:
```rust
use crate::entries::{Entry, EntryFields};
use uuid::Uuid;

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
        entry_type: format!("{:?}", entry.base.entry_type).to_lowercase(),
        icon: entry.base.icon.clone(),
        folder_id: entry.base.folder_id.map(|id| id.to_string()),
        tags: entry.base.tags.clone(),
        favorite: entry.base.favorite,
        updated_at: entry.base.updated_at.clone(),
    };

    contents.entries.push(entry);

    // save
    let path = s.vault_path.clone().ok_or("No vault path")?;
    let key = s.key.as_ref().ok_or("No key")?;
    let salt = s.salt.clone().ok_or("No salt")?;
    let hint = s.hint.clone();
    let created_at = s.created_at.clone().ok_or("No created_at")?;
    vault::save_vault(&path, key, &salt, hint, &created_at, s.contents.as_ref().unwrap())?;

    Ok(item)
}

#[tauri::command]
pub fn delete_entry(id: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut s = state.0.lock().unwrap();
    let contents = s.contents.as_mut().ok_or("Vault is locked")?;
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    contents.entries.retain(|e| e.base.id != uuid);
    let path = s.vault_path.clone().ok_or("No vault path")?;
    let key = s.key.as_ref().ok_or("No key")?;
    let salt = s.salt.clone().ok_or("No salt")?;
    let hint = s.hint.clone();
    let created_at = s.created_at.clone().ok_or("No created_at")?;
    vault::save_vault(&path, key, &salt, hint, &created_at, s.contents.as_ref().unwrap())?;
    Ok(())
}

/// Get full entry (including secrets) by id — only called when user opens detail panel.
#[tauri::command]
pub fn get_entry(id: String, state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let s = state.0.lock().unwrap();
    let contents = s.contents.as_ref().ok_or("Vault is locked")?;
    let uuid = Uuid::parse_str(&id).map_err(|e| e.to_string())?;
    let entry = contents.entries.iter().find(|e| e.base.id == uuid).ok_or("Entry not found")?;
    serde_json::to_value(entry).map_err(|e| e.to_string())
}

/// Folder commands
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
    let key = s.key.as_ref().ok_or("No key")?;
    let salt = s.salt.clone().ok_or("No salt")?;
    let hint = s.hint.clone();
    let created_at = s.created_at.clone().ok_or("No created_at")?;
    vault::save_vault(&path, key, &salt, hint, &created_at, s.contents.as_ref().unwrap())?;
    Ok(result)
}
```

- [ ] **Step 2: Register new commands in main.rs**

Add to the `invoke_handler!` macro in `main.rs`:
```rust
commands::create_entry,
commands::delete_entry,
commands::get_entry,
commands::get_folders,
commands::create_folder,
```

- [ ] **Step 3: Add to TypeScript wrappers in src/lib/tauri.ts**

Append to the `tauriApi` object:
```ts
  createEntry: (payload: {
    name: string; folder_id?: string; tags: string[]; notes: string
    favorite: boolean; icon?: string; entry_type: string; fields: unknown
  }) => invoke<EntryListItem>('create_entry', { payload }),

  deleteEntry: (id: string) => invoke<void>('delete_entry', { id }),

  getEntry: (id: string) => invoke<unknown>('get_entry', { id }),

  getFolders: () => invoke<Array<{ id: string; name: string; has_password: boolean }>>('get_folders'),

  createFolder: (name: string) =>
    invoke<{ id: string; name: string; has_password: boolean }>('create_folder', { name }),
```

- [ ] **Step 4: Verify compilation**

```bash
cd src-tauri && cargo check
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd .. && git add src-tauri/src/commands.rs src-tauri/src/main.rs src/lib/tauri.ts
git commit -m "feat: Tauri CRUD commands for entries and folders"
```

---

## Task 11: MaskedField + TagBadge + Modal components

**Files:**
- Create: `src/components/ui/MaskedField.tsx`
- Create: `src/components/ui/MaskedField.test.tsx`
- Create: `src/components/ui/TagBadge.tsx`
- Create: `src/components/ui/Modal.tsx`

- [ ] **Step 1: Write MaskedField tests**

Create `src/components/ui/MaskedField.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MaskedField } from './MaskedField'

describe('MaskedField', () => {
  it('masks value by default', () => {
    render(<MaskedField label="Password" value="secret123" onCopy={vi.fn()} />)
    expect(screen.queryByText('secret123')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('reveals value on Show click', () => {
    render(<MaskedField label="Password" value="secret123" onCopy={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /show/i }))
    expect(screen.getByText('secret123')).toBeInTheDocument()
  })

  it('calls onCopy when Copy is clicked', () => {
    const onCopy = vi.fn()
    render(<MaskedField label="Password" value="secret123" onCopy={onCopy} />)
    fireEvent.click(screen.getByRole('button', { name: /copy/i }))
    expect(onCopy).toHaveBeenCalledWith('secret123')
  })
})
```

- [ ] **Step 2: Run test — verify fails**

```bash
npm test -- MaskedField
```

- [ ] **Step 3: Implement MaskedField**

Create `src/components/ui/MaskedField.tsx`:
```tsx
import { useState } from 'react'

interface Props {
  label: string
  value: string
  onCopy: (value: string) => void
  monospace?: boolean
}

export function MaskedField({ label, value, onCopy, monospace = false }: Props) {
  const [revealed, setRevealed] = useState(false)

  return (
    <div>
      <label id={`field-${label}`} className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">
        {label}
      </label>
      <div aria-labelledby={`field-${label}`}
        className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-md px-3 py-2">
        <span className={`flex-1 text-sm text-slate-200 truncate ${monospace ? 'font-mono' : ''}`}>
          {revealed ? value : '•'.repeat(Math.min(value.length, 20))}
        </span>
        <button aria-label={revealed ? 'Hide' : 'Show'}
          onClick={() => setRevealed(v => !v)}
          className="text-xs text-blue-400 hover:text-blue-300 bg-slate-700 px-2 py-0.5 rounded shrink-0">
          {revealed ? 'Hide' : 'Show'}
        </button>
        <button aria-label="Copy"
          onClick={() => onCopy(value)}
          className="text-xs text-blue-400 hover:text-blue-300 bg-slate-700 px-2 py-0.5 rounded shrink-0">
          Copy
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Implement TagBadge**

Create `src/components/ui/TagBadge.tsx`:
```tsx
interface Props { tag: string; onRemove?: () => void }

export function TagBadge({ tag, onRemove }: Props) {
  return (
    <span className="inline-flex items-center gap-1 bg-blue-900/40 text-blue-300 text-xs px-2.5 py-0.5 rounded-full">
      {tag}
      {onRemove && (
        <button onClick={onRemove} className="hover:text-red-400 leading-none">&times;</button>
      )}
    </span>
  )
}
```

- [ ] **Step 5: Implement Modal**

Create `src/components/ui/Modal.tsx`:
```tsx
import { ReactNode, useEffect } from 'react'

interface Props { title: string; onClose: () => void; children: ReactNode }

export function Modal({ title, onClose, children }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h2 className="text-slate-100 font-semibold">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 text-xl leading-none">&times;</button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Run all tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/MaskedField.tsx src/components/ui/MaskedField.test.tsx src/components/ui/TagBadge.tsx src/components/ui/Modal.tsx
git commit -m "feat: MaskedField, TagBadge, Modal UI components"
```

---

## Task 12: useClipboard hook

**Files:**
- Create: `src/hooks/useClipboard.ts`
- Create: `src/hooks/useClipboard.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/hooks/useClipboard.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useClipboard } from './useClipboard'

describe('useClipboard', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
    })
  })

  it('copies text and sets copied=true', async () => {
    const { result } = renderHook(() => useClipboard(1000))
    await act(async () => { await result.current.copy('hello') })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello')
    expect(result.current.copied).toBe(true)
  })

  it('resets copied after delay', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useClipboard(500))
    await act(async () => { await result.current.copy('hello') })
    expect(result.current.copied).toBe(true)
    act(() => { vi.advanceTimersByTime(600) })
    expect(result.current.copied).toBe(false)
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Run test — verify fails**

```bash
npm test -- useClipboard
```

- [ ] **Step 3: Implement useClipboard**

Create `src/hooks/useClipboard.ts`:
```ts
import { useState, useRef } from 'react'

export function useClipboard(clearAfterMs = 30_000) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setCopied(false)
      navigator.clipboard.writeText('').catch(() => {})
    }, clearAfterMs)
  }

  return { copy, copied }
}
```

- [ ] **Step 4: Run all tests**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useClipboard.ts src/hooks/useClipboard.test.ts
git commit -m "feat: useClipboard hook with auto-clear"
```

---

## Task 13: EntryRow component

**Files:**
- Create: `src/components/entries/EntryRow.tsx`
- Create: `src/components/entries/EntryRow.test.tsx`

- [ ] **Step 1: Write test**

Create `src/components/entries/EntryRow.test.tsx`:
```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { EntryRow } from './EntryRow'
import type { EntryListItem } from '../../types'

const entry: EntryListItem = {
  id: '1', name: 'GitHub Token', entry_type: 'api_key',
  tags: ['work'], favorite: false, updated_at: '2026-01-01',
}

describe('EntryRow', () => {
  it('renders entry name', () => {
    render(<EntryRow entry={entry} selected={false} onSelect={vi.fn()} onCopy={vi.fn()} />)
    expect(screen.getByText('GitHub Token')).toBeInTheDocument()
  })

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn()
    render(<EntryRow entry={entry} selected={false} onSelect={onSelect} onCopy={vi.fn()} />)
    fireEvent.click(screen.getByText('GitHub Token'))
    expect(onSelect).toHaveBeenCalledWith('1')
  })

  it('shows selected style when selected=true', () => {
    const { container } = render(
      <EntryRow entry={entry} selected={true} onSelect={vi.fn()} onCopy={vi.fn()} />
    )
    expect(container.firstChild).toHaveClass('border-blue-500')
  })
})
```

- [ ] **Step 2: Run test — verify fails**

```bash
npm test -- EntryRow
```

- [ ] **Step 3: Implement EntryRow**

Create `src/components/entries/EntryRow.tsx`:
```tsx
import type { EntryListItem } from '../../types'
import { TagBadge } from '../ui/TagBadge'

const TYPE_EMOJI: Record<string, string> = {
  login: '🔑', api_key: '⚡', note: '📝', ssh_key: '🔒', card: '💳',
}
const TYPE_LABEL: Record<string, string> = {
  login: 'Login', api_key: 'API Key', note: 'Note', ssh_key: 'SSH Key', card: 'Card',
}

interface Props {
  entry: EntryListItem
  selected: boolean
  onSelect: (id: string) => void
  onCopy: (id: string) => void
}

export function EntryRow({ entry, selected, onSelect, onCopy }: Props) {
  return (
    <div
      onClick={() => onSelect(entry.id)}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md cursor-pointer border group transition-colors
        ${selected
          ? 'bg-slate-700 border-blue-500'
          : 'border-transparent hover:bg-slate-800'}`}
    >
      {/* Icon */}
      <div className="w-7 h-7 rounded shrink-0 flex items-center justify-center text-base bg-slate-700">
        {entry.icon
          ? <img src={entry.icon} className="w-5 h-5 rounded" alt="" />
          : TYPE_EMOJI[entry.entry_type] ?? '🔐'}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200 truncate">{entry.name}</p>
        <p className="text-xs text-slate-500 truncate">
          {TYPE_LABEL[entry.entry_type]}
          {entry.tags[0] && <> · <TagBadge tag={entry.tags[0]} /></>}
        </p>
      </div>

      {/* Quick copy (hover only) */}
      <button
        aria-label="Quick copy"
        onClick={e => { e.stopPropagation(); onCopy(entry.id) }}
        className="opacity-0 group-hover:opacity-100 text-xs text-blue-400 hover:text-blue-300 shrink-0 transition-opacity"
      >
        📋
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run all tests**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add src/components/entries/EntryRow.tsx src/components/entries/EntryRow.test.tsx
git commit -m "feat: EntryRow component with quick-copy hover action"
```

---

## Task 14: Sidebar component

**Files:**
- Create: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Implement Sidebar**

Create `src/components/layout/Sidebar.tsx`:
```tsx
import { useVaultStore } from '../../store/vault'
import { useUiStore } from '../../store/ui'
import type { SidebarFilter } from '../../store/ui'

interface Folder { id: string; name: string; has_password: boolean }

interface Props {
  folders: Folder[]
  entryCounts: Record<string, number>
  onLock: () => void
  onNewFolder: () => void
}

const TYPE_ITEMS: Array<{ filter: SidebarFilter; emoji: string; label: string; key: string }> = [
  { filter: 'login',   emoji: '🔑', label: 'Logins',   key: 'login' },
  { filter: 'api_key', emoji: '⚡', label: 'API Keys', key: 'api_key' },
  { filter: 'note',    emoji: '📝', label: 'Notes',    key: 'note' },
  { filter: 'ssh_key', emoji: '🔒', label: 'SSH Keys', key: 'ssh_key' },
  { filter: 'card',    emoji: '💳', label: 'Cards',    key: 'card' },
]

export function Sidebar({ folders, entryCounts, onLock, onNewFolder }: Props) {
  const { sidebarFilter, setSidebarFilter, setSelectedFolderId } = useUiStore()
  const totalEntries = useVaultStore(s => s.entries.length)

  const setFilter = (f: SidebarFilter) => {
    setSidebarFilter(f)
    setSelectedFolderId(null)
  }

  const navItem = (filter: SidebarFilter, emoji: string, label: string, count?: number) => (
    <button key={filter}
      onClick={() => setFilter(filter)}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors
        ${sidebarFilter === filter
          ? 'bg-blue-600 text-white font-semibold'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'}`}>
      <span>{emoji}</span>
      <span className="flex-1 text-left">{label}</span>
      {count !== undefined && (
        <span className={`text-xs rounded-full px-1.5 ${sidebarFilter === filter ? 'bg-blue-500' : 'bg-slate-700 text-slate-500'}`}>
          {count}
        </span>
      )}
    </button>
  )

  return (
    <aside className="w-48 bg-slate-800 border-r border-slate-700 flex flex-col shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-3.5 border-b border-slate-700">
        <span className="text-xl">🔐</span>
        <span className="font-bold tracking-widest text-slate-100">YEK</span>
        <button className="ml-auto text-slate-500 hover:text-slate-300 text-sm">⚙️</button>
      </div>

      {/* Search hint */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-500 cursor-pointer">
          🔍 <span>Search <kbd className="text-slate-600">⌘K</kbd></span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        <p className="px-2 pt-2 pb-1 text-xs font-semibold uppercase tracking-widest text-slate-600">Library</p>
        {navItem('favorites', '⭐', 'Favorites')}
        {navItem('all', '🗂️', 'All Items', totalEntries)}

        <p className="px-2 pt-3 pb-1 text-xs font-semibold uppercase tracking-widest text-slate-600">Types</p>
        {TYPE_ITEMS.map(({ filter, emoji, label, key }) =>
          navItem(filter, emoji, label, entryCounts[key] ?? 0)
        )}

        <p className="px-2 pt-3 pb-1 text-xs font-semibold uppercase tracking-widest text-slate-600">Folders</p>
        {folders.map(f => (
          <button key={f.id}
            onClick={() => { setSidebarFilter('folder'); setSelectedFolderId(f.id) }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors">
            <span>{f.has_password ? '🔐' : '📁'}</span>
            <span className="flex-1 text-left truncate">{f.name}</span>
            {f.has_password && <span className="text-yellow-500 text-xs">🔒</span>}
          </button>
        ))}
        <button onClick={onNewFolder}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-slate-600 hover:text-slate-400 transition-colors">
          ＋ New Folder
        </button>
      </nav>

      {/* Footer */}
      <div className="px-3 py-2.5 border-t border-slate-700 flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">D</div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-200">Vault</p>
          <p className="text-xs text-slate-500">Unlocked</p>
        </div>
        <button onClick={onLock} title="Lock vault" className="text-slate-500 hover:text-slate-300 text-base">🔒</button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat: Sidebar component with library, types, and folders navigation"
```

---

## Task 15: Entry detail panels (all 5 types)

**Files:**
- Create: `src/components/entries/LoginDetail.tsx`
- Create: `src/components/entries/ApiKeyDetail.tsx`
- Create: `src/components/entries/NoteDetail.tsx`
- Create: `src/components/entries/SshKeyDetail.tsx`
- Create: `src/components/entries/CardDetail.tsx`
- Create: `src/components/entries/DetailPanel.tsx`

- [ ] **Step 1: Create LoginDetail**

Create `src/components/entries/LoginDetail.tsx`:
```tsx
import { MaskedField } from '../ui/MaskedField'
import { TagBadge } from '../ui/TagBadge'
import { useClipboard } from '../../hooks/useClipboard'
import type { LoginFields } from '../../types'

interface Props {
  name: string; icon?: string; tags: string[]; notes: string
  fields: LoginFields; onEdit: () => void; onDelete: () => void
}

export function LoginDetail({ name, icon, tags, notes, fields, onEdit, onDelete }: Props) {
  const { copy, copied } = useClipboard()
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-slate-700">
        <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center text-xl">
          {icon ? <img src={icon} className="w-6 h-6" alt="" /> : '🔑'}
        </div>
        <div className="flex-1"><h2 className="text-slate-100 font-semibold">{name}</h2><p className="text-xs text-slate-500">Login</p></div>
        <button onClick={onEdit} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded">Edit</button>
        <button onClick={onDelete} className="text-xs bg-red-900/40 hover:bg-red-900/70 text-red-400 px-3 py-1.5 rounded">Delete</button>
      </div>
      {fields.url && <div><p className="text-xs text-slate-500 uppercase tracking-widest mb-1">URL</p><p className="text-sm text-blue-400 truncate">{fields.url}</p></div>}
      {fields.username && <div><p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Username</p><div className="flex items-center justify-between bg-slate-800 rounded px-3 py-2"><span className="text-sm text-slate-200">{fields.username}</span><button onClick={() => copy(fields.username)} className="text-xs text-blue-400">Copy</button></div></div>}
      <MaskedField label="Password" value={fields.password} onCopy={copy} />
      {copied && <p className="text-xs text-green-400">✅ Copied — clears in 30s</p>}
      {tags.length > 0 && <div className="flex flex-wrap gap-1.5">{tags.map(t => <TagBadge key={t} tag={t} />)}</div>}
      {notes && <div><p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Notes</p><p className="text-sm text-slate-400 whitespace-pre-wrap">{notes}</p></div>}
    </div>
  )
}
```

- [ ] **Step 2: Create ApiKeyDetail**

Create `src/components/entries/ApiKeyDetail.tsx`:
```tsx
import { MaskedField } from '../ui/MaskedField'
import { TagBadge } from '../ui/TagBadge'
import { useClipboard } from '../../hooks/useClipboard'
import type { ApiKeyFields } from '../../types'

interface Props {
  name: string; icon?: string; tags: string[]; notes: string
  fields: ApiKeyFields; onEdit: () => void; onDelete: () => void
}

export function ApiKeyDetail({ name, icon, tags, notes, fields, onEdit, onDelete }: Props) {
  const { copy, copied } = useClipboard()
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-slate-700">
        <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center text-xl">
          {icon ? <img src={icon} className="w-6 h-6" alt="" /> : '⚡'}
        </div>
        <div className="flex-1"><h2 className="text-slate-100 font-semibold">{name}</h2><p className="text-xs text-slate-500">API Key · {fields.service}</p></div>
        <button onClick={onEdit} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded">Edit</button>
        <button onClick={onDelete} className="text-xs bg-red-900/40 hover:bg-red-900/70 text-red-400 px-3 py-1.5 rounded">Delete</button>
      </div>
      <MaskedField label="API Key" value={fields.key} onCopy={copy} monospace />
      {fields.secret && <MaskedField label="Secret" value={fields.secret} onCopy={copy} monospace />}
      {fields.token && <MaskedField label="Token" value={fields.token} onCopy={copy} monospace />}
      {fields.expires_at && <div><p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Expires</p><p className="text-sm text-slate-300">{fields.expires_at}</p></div>}
      {copied && <p className="text-xs text-green-400">✅ Copied — clears in 30s</p>}
      {tags.length > 0 && <div className="flex flex-wrap gap-1.5">{tags.map(t => <TagBadge key={t} tag={t} />)}</div>}
      {notes && <div><p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Notes</p><p className="text-sm text-slate-400 whitespace-pre-wrap">{notes}</p></div>}
    </div>
  )
}
```

- [ ] **Step 3: Create NoteDetail**

Create `src/components/entries/NoteDetail.tsx`:
```tsx
import { TagBadge } from '../ui/TagBadge'
import type { NoteFields } from '../../types'

interface Props {
  name: string; tags: string[]; fields: NoteFields
  onEdit: () => void; onDelete: () => void
}

export function NoteDetail({ name, tags, fields, onEdit, onDelete }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-slate-700">
        <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center text-xl">📝</div>
        <div className="flex-1"><h2 className="text-slate-100 font-semibold">{name}</h2><p className="text-xs text-slate-500">Secure Note</p></div>
        <button onClick={onEdit} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded">Edit</button>
        <button onClick={onDelete} className="text-xs bg-red-900/40 hover:bg-red-900/70 text-red-400 px-3 py-1.5 rounded">Delete</button>
      </div>
      <div className="bg-slate-800 rounded-md p-3 min-h-[120px]">
        <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono">{fields.content}</pre>
      </div>
      {tags.length > 0 && <div className="flex flex-wrap gap-1.5">{tags.map(t => <TagBadge key={t} tag={t} />)}</div>}
    </div>
  )
}
```

- [ ] **Step 4: Create SshKeyDetail**

Create `src/components/entries/SshKeyDetail.tsx`:
```tsx
import { MaskedField } from '../ui/MaskedField'
import { TagBadge } from '../ui/TagBadge'
import { useClipboard } from '../../hooks/useClipboard'
import type { SshKeyFields } from '../../types'

interface Props {
  name: string; tags: string[]; notes: string
  fields: SshKeyFields; onEdit: () => void; onDelete: () => void
}

export function SshKeyDetail({ name, tags, notes, fields, onEdit, onDelete }: Props) {
  const { copy, copied } = useClipboard()
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-slate-700">
        <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center text-xl">🔒</div>
        <div className="flex-1"><h2 className="text-slate-100 font-semibold">{name}</h2><p className="text-xs text-slate-500">SSH Key{fields.host ? ` · ${fields.host}` : ''}</p></div>
        <button onClick={onEdit} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded">Edit</button>
        <button onClick={onDelete} className="text-xs bg-red-900/40 hover:bg-red-900/70 text-red-400 px-3 py-1.5 rounded">Delete</button>
      </div>
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Public Key</p>
        <div className="bg-slate-800 rounded px-3 py-2 flex items-start justify-between gap-2">
          <pre className="text-xs text-slate-400 font-mono truncate flex-1">{fields.public_key.slice(0, 60)}...</pre>
          <button onClick={() => copy(fields.public_key)} className="text-xs text-blue-400 shrink-0">Copy</button>
        </div>
      </div>
      <MaskedField label="Private Key" value={fields.private_key} onCopy={copy} monospace />
      {fields.passphrase && <MaskedField label="Passphrase" value={fields.passphrase} onCopy={copy} />}
      {copied && <p className="text-xs text-green-400">✅ Copied — clears in 30s</p>}
      {tags.length > 0 && <div className="flex flex-wrap gap-1.5">{tags.map(t => <TagBadge key={t} tag={t} />)}</div>}
      {notes && <div><p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Notes</p><p className="text-sm text-slate-400">{notes}</p></div>}
    </div>
  )
}
```

- [ ] **Step 5: Create CardDetail**

Create `src/components/entries/CardDetail.tsx`:
```tsx
import { MaskedField } from '../ui/MaskedField'
import { useClipboard } from '../../hooks/useClipboard'
import type { CardFields } from '../../types'

interface Props {
  name: string; fields: CardFields; onEdit: () => void; onDelete: () => void
}

export function CardDetail({ name, fields, onEdit, onDelete }: Props) {
  const { copy, copied } = useClipboard()
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-slate-700">
        <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center text-xl">💳</div>
        <div className="flex-1"><h2 className="text-slate-100 font-semibold">{name}</h2><p className="text-xs text-slate-500">Card · {fields.cardholder}</p></div>
        <button onClick={onEdit} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded">Edit</button>
        <button onClick={onDelete} className="text-xs bg-red-900/40 hover:bg-red-900/70 text-red-400 px-3 py-1.5 rounded">Delete</button>
      </div>
      <MaskedField label="Card Number" value={fields.number} onCopy={copy} monospace />
      <div className="grid grid-cols-2 gap-3">
        <div><p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Expiry</p><p className="text-sm text-slate-200">{fields.expiry}</p></div>
        <MaskedField label="CVV" value={fields.cvv} onCopy={copy} />
      </div>
      {copied && <p className="text-xs text-green-400">✅ Copied — clears in 30s</p>}
      {fields.billing_address && <div><p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Billing Address</p><p className="text-sm text-slate-400">{fields.billing_address}</p></div>}
    </div>
  )
}
```

- [ ] **Step 6: Create DetailPanel router**

Create `src/components/entries/DetailPanel.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { tauriApi } from '../../lib/tauri'
import { LoginDetail } from './LoginDetail'
import { ApiKeyDetail } from './ApiKeyDetail'
import { NoteDetail } from './NoteDetail'
import { SshKeyDetail } from './SshKeyDetail'
import { CardDetail } from './CardDetail'

interface Props {
  entryId: string | null
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export function DetailPanel({ entryId, onEdit, onDelete }: Props) {
  const [entry, setEntry] = useState<any>(null)

  useEffect(() => {
    if (!entryId) { setEntry(null); return }
    tauriApi.getEntry(entryId).then(setEntry).catch(console.error)
  }, [entryId])

  if (!entryId) return (
    <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
      Select an entry to view
    </div>
  )

  if (!entry) return (
    <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
      Loading...
    </div>
  )

  const commonProps = {
    name: entry.base?.name ?? '',
    icon: entry.base?.icon,
    tags: entry.base?.tags ?? [],
    notes: entry.base?.notes ?? '',
    onEdit: () => onEdit(entryId),
    onDelete: () => onDelete(entryId),
  }

  const type = entry.base?.entry_type
  if (type === 'Login') return <div className="flex-1 p-4 overflow-y-auto"><LoginDetail {...commonProps} fields={entry.fields.Login} /></div>
  if (type === 'ApiKey') return <div className="flex-1 p-4 overflow-y-auto"><ApiKeyDetail {...commonProps} fields={entry.fields.ApiKey} /></div>
  if (type === 'Note') return <div className="flex-1 p-4 overflow-y-auto"><NoteDetail {...commonProps} fields={entry.fields.Note} /></div>
  if (type === 'SshKey') return <div className="flex-1 p-4 overflow-y-auto"><SshKeyDetail {...commonProps} fields={entry.fields.SshKey} /></div>
  if (type === 'Card') return <div className="flex-1 p-4 overflow-y-auto"><CardDetail {...commonProps} fields={entry.fields.Card} /></div>

  return <div className="flex-1 p-4 text-slate-500">Unknown entry type</div>
}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/entries/
git commit -m "feat: detail panels for all 5 entry types (Login, ApiKey, Note, SSH, Card)"
```

---

## Task 16: Entry forms (all 5 types) + EntryFormModal

**Files:**
- Create: `src/components/forms/LoginForm.tsx`
- Create: `src/components/forms/ApiKeyForm.tsx`
- Create: `src/components/forms/NoteForm.tsx`
- Create: `src/components/forms/SshKeyForm.tsx`
- Create: `src/components/forms/CardForm.tsx`
- Create: `src/components/forms/EntryFormModal.tsx`

- [ ] **Step 1: Create shared form field helper**

Create `src/components/forms/Field.tsx`:
```tsx
import { ReactNode } from 'react'

interface Props { label: string; required?: boolean; children: ReactNode }

export function Field({ label, required, children }: Props) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

export const inputCls = "w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
export const textareaCls = `${inputCls} resize-none min-h-[80px]`
```

- [ ] **Step 2: Create LoginForm**

Create `src/components/forms/LoginForm.tsx`:
```tsx
import { useState } from 'react'
import { Field, inputCls } from './Field'
import type { LoginFields } from '../../types'

interface Props { initial?: LoginFields; onChange: (f: LoginFields) => void }

export function LoginForm({ initial, onChange }: Props) {
  const [f, setF] = useState<LoginFields>(initial ?? { url: '', username: '', password: '' })
  const update = (patch: Partial<LoginFields>) => { const next = { ...f, ...patch }; setF(next); onChange(next) }
  return (
    <div className="space-y-3">
      <Field label="URL"><input className={inputCls} placeholder="https://example.com" value={f.url} onChange={e => update({ url: e.target.value })} /></Field>
      <Field label="Username" required><input className={inputCls} placeholder="user@example.com" value={f.username} onChange={e => update({ username: e.target.value })} /></Field>
      <Field label="Password" required><input className={inputCls} type="password" placeholder="Password" value={f.password} onChange={e => update({ password: e.target.value })} /></Field>
    </div>
  )
}
```

- [ ] **Step 3: Create ApiKeyForm**

Create `src/components/forms/ApiKeyForm.tsx`:
```tsx
import { useState } from 'react'
import { Field, inputCls } from './Field'
import type { ApiKeyFields } from '../../types'

interface Props { initial?: ApiKeyFields; onChange: (f: ApiKeyFields) => void }

export function ApiKeyForm({ initial, onChange }: Props) {
  const [f, setF] = useState<ApiKeyFields>(initial ?? { service: '', key: '' })
  const update = (patch: Partial<ApiKeyFields>) => { const next = { ...f, ...patch }; setF(next); onChange(next) }
  return (
    <div className="space-y-3">
      <Field label="Service" required><input className={inputCls} placeholder="GitHub" value={f.service} onChange={e => update({ service: e.target.value })} /></Field>
      <Field label="API Key" required><input className={inputCls} placeholder="sk-..." value={f.key} onChange={e => update({ key: e.target.value })} /></Field>
      <Field label="Secret"><input className={inputCls} placeholder="Optional secret" value={f.secret ?? ''} onChange={e => update({ secret: e.target.value || undefined })} /></Field>
      <Field label="Token"><input className={inputCls} placeholder="Optional token" value={f.token ?? ''} onChange={e => update({ token: e.target.value || undefined })} /></Field>
      <Field label="Expires At"><input className={inputCls} type="date" value={f.expires_at ?? ''} onChange={e => update({ expires_at: e.target.value || undefined })} /></Field>
    </div>
  )
}
```

- [ ] **Step 4: Create NoteForm**

Create `src/components/forms/NoteForm.tsx`:
```tsx
import { useState } from 'react'
import { Field, textareaCls } from './Field'
import type { NoteFields } from '../../types'

interface Props { initial?: NoteFields; onChange: (f: NoteFields) => void }

export function NoteForm({ initial, onChange }: Props) {
  const [f, setF] = useState<NoteFields>(initial ?? { content: '' })
  const update = (patch: Partial<NoteFields>) => { const next = { ...f, ...patch }; setF(next); onChange(next) }
  return (
    <div>
      <Field label="Content" required>
        <textarea className={textareaCls} placeholder="Your secure note..." rows={8} value={f.content} onChange={e => update({ content: e.target.value })} />
      </Field>
    </div>
  )
}
```

- [ ] **Step 5: Create SshKeyForm**

Create `src/components/forms/SshKeyForm.tsx`:
```tsx
import { useState } from 'react'
import { Field, inputCls, textareaCls } from './Field'
import type { SshKeyFields } from '../../types'

interface Props { initial?: SshKeyFields; onChange: (f: SshKeyFields) => void }

export function SshKeyForm({ initial, onChange }: Props) {
  const [f, setF] = useState<SshKeyFields>(initial ?? { public_key: '', private_key: '' })
  const update = (patch: Partial<SshKeyFields>) => { const next = { ...f, ...patch }; setF(next); onChange(next) }
  return (
    <div className="space-y-3">
      <Field label="Host"><input className={inputCls} placeholder="github.com" value={f.host ?? ''} onChange={e => update({ host: e.target.value || undefined })} /></Field>
      <Field label="Public Key" required><textarea className={textareaCls} placeholder="ssh-ed25519 AAAA..." rows={3} value={f.public_key} onChange={e => update({ public_key: e.target.value })} /></Field>
      <Field label="Private Key" required><textarea className={textareaCls} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" rows={5} value={f.private_key} onChange={e => update({ private_key: e.target.value })} /></Field>
      <Field label="Passphrase"><input className={inputCls} type="password" placeholder="Optional passphrase" value={f.passphrase ?? ''} onChange={e => update({ passphrase: e.target.value || undefined })} /></Field>
    </div>
  )
}
```

- [ ] **Step 6: Create CardForm**

Create `src/components/forms/CardForm.tsx`:
```tsx
import { useState } from 'react'
import { Field, inputCls, textareaCls } from './Field'
import type { CardFields } from '../../types'

interface Props { initial?: CardFields; onChange: (f: CardFields) => void }

export function CardForm({ initial, onChange }: Props) {
  const [f, setF] = useState<CardFields>(initial ?? { cardholder: '', number: '', expiry: '', cvv: '' })
  const update = (patch: Partial<CardFields>) => { const next = { ...f, ...patch }; setF(next); onChange(next) }
  return (
    <div className="space-y-3">
      <Field label="Cardholder Name" required><input className={inputCls} placeholder="John Doe" value={f.cardholder} onChange={e => update({ cardholder: e.target.value })} /></Field>
      <Field label="Card Number" required><input className={inputCls} placeholder="•••• •••• •••• ••••" value={f.number} onChange={e => update({ number: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Expiry" required><input className={inputCls} placeholder="MM/YY" value={f.expiry} onChange={e => update({ expiry: e.target.value })} /></Field>
        <Field label="CVV" required><input className={inputCls} placeholder="123" value={f.cvv} onChange={e => update({ cvv: e.target.value })} /></Field>
      </div>
      <Field label="Billing Address"><textarea className={textareaCls} placeholder="Optional" rows={2} value={f.billing_address ?? ''} onChange={e => update({ billing_address: e.target.value || undefined })} /></Field>
    </div>
  )
}
```

- [ ] **Step 7: Create EntryFormModal**

Create `src/components/forms/EntryFormModal.tsx`:
```tsx
import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Field, inputCls } from './Field'
import { LoginForm } from './LoginForm'
import { ApiKeyForm } from './ApiKeyForm'
import { NoteForm } from './NoteForm'
import { SshKeyForm } from './SshKeyForm'
import { CardForm } from './CardForm'
import { TagBadge } from '../ui/TagBadge'
import type { EntryType } from '../../types'

const TYPES: Array<{ value: EntryType; label: string; emoji: string }> = [
  { value: 'login',   label: 'Login',   emoji: '🔑' },
  { value: 'api_key', label: 'API Key', emoji: '⚡' },
  { value: 'note',    label: 'Note',    emoji: '📝' },
  { value: 'ssh_key', label: 'SSH Key', emoji: '🔒' },
  { value: 'card',    label: 'Card',    emoji: '💳' },
]

interface Props {
  onClose: () => void
  onSave: (data: {
    name: string; entry_type: EntryType; tags: string[]
    notes: string; favorite: boolean; fields: unknown
  }) => Promise<void>
}

export function EntryFormModal({ onClose, onSave }: Props) {
  const [type, setType] = useState<EntryType>('login')
  const [name, setName] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [notes, setNotes] = useState('')
  const [fields, setFields] = useState<unknown>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags(prev => [...prev, t])
    setTagInput('')
  }

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true)
    try {
      await onSave({ name: name.trim(), entry_type: type, tags, notes, favorite: false, fields })
      onClose()
    } catch (e) { setError(String(e)) }
    finally { setSaving(false) }
  }

  return (
    <Modal title="Add New Entry" onClose={onClose}>
      <div className="space-y-4">
        {/* Type selector */}
        <div className="flex gap-1.5 flex-wrap">
          {TYPES.map(t => (
            <button key={t.value} onClick={() => setType(t.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors
                ${type === t.value ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>

        <Field label="Name" required>
          <input className={inputCls} placeholder="e.g. GitHub Token" value={name} onChange={e => setName(e.target.value)} autoFocus />
        </Field>

        {/* Type-specific fields */}
        {type === 'login'   && <LoginForm   onChange={setFields} />}
        {type === 'api_key' && <ApiKeyForm  onChange={setFields} />}
        {type === 'note'    && <NoteForm    onChange={setFields} />}
        {type === 'ssh_key' && <SshKeyForm  onChange={setFields} />}
        {type === 'card'    && <CardForm    onChange={setFields} />}

        {/* Tags */}
        <Field label="Tags">
          <div className="flex gap-2 flex-wrap mb-2">
            {tags.map(t => <TagBadge key={t} tag={t} onRemove={() => setTags(prev => prev.filter(x => x !== t))} />)}
          </div>
          <div className="flex gap-2">
            <input className={inputCls} placeholder="Add tag..." value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTag()} />
            <button onClick={addTag} className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 rounded-md text-sm">Add</button>
          </div>
        </Field>

        <Field label="Notes">
          <textarea className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none"
            rows={3} placeholder="Optional notes" value={notes} onChange={e => setNotes(e.target.value)} />
        </Field>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-2 pt-2 border-t border-slate-700">
          <button onClick={onClose} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded-md text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2 rounded-md text-sm">
            {saving ? 'Saving...' : 'Save Entry'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 8: Commit**

```bash
git add src/components/forms/
git commit -m "feat: entry forms for all 5 types + EntryFormModal"
```

---

## Task 17: EntryList + AppShell — wire everything together

**Files:**
- Create: `src/components/layout/EntryList.tsx`
- Create: `src/components/layout/AppShell.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create EntryList**

Create `src/components/layout/EntryList.tsx`:
```tsx
import { useMemo } from 'react'
import { EntryRow } from '../entries/EntryRow'
import { useVaultStore } from '../../store/vault'
import { useUiStore } from '../../store/ui'
import type { EntryListItem } from '../../types'

interface Props {
  onAdd: () => void
  onSelect: (id: string) => void
  onCopy: (id: string) => void
}

export function EntryList({ onAdd, onSelect, onCopy }: Props) {
  const entries = useVaultStore(s => s.entries)
  const selectedId = useVaultStore(s => s.selectedEntryId)
  const { sidebarFilter, selectedFolderId } = useUiStore()

  const filtered = useMemo(() => {
    return entries.filter((e: EntryListItem) => {
      if (sidebarFilter === 'favorites') return e.favorite
      if (sidebarFilter === 'folder') return e.folder_id === selectedFolderId
      if (sidebarFilter === 'all') return true
      return e.entry_type === sidebarFilter
    })
  }, [entries, sidebarFilter, selectedFolderId])

  const title = sidebarFilter === 'all' ? 'All Items'
    : sidebarFilter === 'favorites' ? 'Favorites'
    : sidebarFilter === 'folder' ? 'Folder'
    : sidebarFilter.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) + 's'

  return (
    <div className="w-60 border-r border-slate-700 flex flex-col bg-slate-900 shrink-0">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-700">
        <span className="text-sm font-semibold text-slate-200">{title}</span>
        <button onClick={onAdd} title="Add entry"
          className="text-blue-400 hover:text-blue-300 text-2xl leading-none font-light">＋</button>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {filtered.length === 0
          ? <p className="text-xs text-slate-600 text-center py-8">No entries</p>
          : filtered.map(e => (
            <EntryRow key={e.id} entry={e} selected={selectedId === e.id} onSelect={onSelect} onCopy={onCopy} />
          ))
        }
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create AppShell**

Create `src/components/layout/AppShell.tsx`:
```tsx
import { useEffect, useState } from 'react'
import { Sidebar } from './Sidebar'
import { EntryList } from './EntryList'
import { DetailPanel } from '../entries/DetailPanel'
import { EntryFormModal } from '../forms/EntryFormModal'
import { tauriApi } from '../../lib/tauri'
import { useVaultStore } from '../../store/vault'
import type { EntryType } from '../../types'

interface Props { onLock: () => void }

export function AppShell({ onLock }: Props) {
  const { entries, setEntries, selectedEntryId, setSelectedEntryId } = useVaultStore()
  const [folders, setFolders] = useState<Array<{ id: string; name: string; has_password: boolean }>>([])
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    tauriApi.getFolders().then(setFolders).catch(console.error)
  }, [])

  const entryCounts = entries.reduce((acc, e) => {
    acc[e.entry_type] = (acc[e.entry_type] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const handleSaveEntry = async (data: {
    name: string; entry_type: EntryType; tags: string[]
    notes: string; favorite: boolean; fields: unknown
  }) => {
    const item = await tauriApi.createEntry({
      name: data.name,
      entry_type: data.entry_type,
      tags: data.tags,
      notes: data.notes,
      favorite: data.favorite,
      fields: data.fields,
    })
    setEntries([...entries, item])
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this entry?')) return
    await tauriApi.deleteEntry(id)
    setEntries(entries.filter(e => e.id !== id))
    if (selectedEntryId === id) setSelectedEntryId(null)
  }

  const handleNewFolder = async () => {
    const name = prompt('Folder name:')
    if (!name?.trim()) return
    const folder = await tauriApi.createFolder(name.trim())
    setFolders(prev => [...prev, folder])
  }

  const handleLock = async () => {
    await tauriApi.lockVault()
    onLock()
  }

  const handleCopy = async (id: string) => {
    // fetch entry and copy primary field
    const entry = await tauriApi.getEntry(id) as any
    const fields = entry?.fields
    if (!fields) return
    const val = fields.Login?.password ?? fields.ApiKey?.key ?? fields.Card?.number ?? fields.SshKey?.private_key ?? fields.Note?.content ?? ''
    if (val) await navigator.clipboard.writeText(val)
  }

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">
      <Sidebar folders={folders} entryCounts={entryCounts} onLock={handleLock} onNewFolder={handleNewFolder} />
      <EntryList onAdd={() => setShowAdd(true)} onSelect={setSelectedEntryId} onCopy={handleCopy} />
      <div className="flex-1 flex overflow-hidden">
        <DetailPanel entryId={selectedEntryId} onEdit={() => {}} onDelete={handleDelete} />
      </div>
      {showAdd && <EntryFormModal onClose={() => setShowAdd(false)} onSave={handleSaveEntry} />}
    </div>
  )
}
```

- [ ] **Step 3: Update App.tsx to use AppShell**

Replace the vault screen placeholder in `src/App.tsx` with:
```tsx
// Add import at top:
import { AppShell } from './components/layout/AppShell'

// Replace the vault screen return:
if (screen === 'vault') return (
  <AppShell onLock={() => {
    useVaultStore.getState().lock()
    setScreen('unlock')
  }} />
)
```

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all pass.

- [ ] **Step 5: Run the app end-to-end**

```bash
npm run tauri dev
```

Walk through: create vault → add a Login entry → add an API Key entry → view detail → delete → lock → unlock.

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/ src/App.tsx
git commit -m "feat: AppShell, EntryList, full vault UI wired end-to-end (Phase 2 complete)"
```

---

## Phase 2 Complete ✓

At this point you have a fully working vault app:
- ✅ Three-panel layout (Sidebar + EntryList + DetailPanel)
- ✅ All 5 entry types — view and add
- ✅ Folders (create, navigate)
- ✅ Tags (add on entry creation)
- ✅ MaskedField with show/hide + copy
- ✅ Clipboard auto-clear (30s)
- ✅ Delete entries
- ✅ Lock/unlock

**Next:** See `2026-06-09-yek-polish.md` for Phase 3 (service icons, 4 themes, command palette, settings panel, sync/conflict, local backups).
