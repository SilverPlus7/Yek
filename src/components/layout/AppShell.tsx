import { useCallback, useEffect, useState } from 'react'
import { Sidebar } from './Sidebar'
import { EntryList } from './EntryList'
import { DetailPanel } from '../entries/DetailPanel'
import { TrashPanel } from '../entries/TrashPanel'
import { EntryFormModal, type EntryFormData } from '../forms/EntryFormModal'
import { PasswordGenerator } from '../tools/PasswordGenerator'
import { ResizeDivider } from '../ui/ResizeDivider'
import { CommandPalette } from '../ui/CommandPalette'
import { ConflictDialog } from '../ui/ConflictDialog'
import { SettingsPanel } from '../settings/SettingsPanel'
import { CONFLICT_MESSAGE, VAULT_CONFLICT_EVENT, tauriApi } from '../../lib/tauri'
import { clearCopiedSecret, copySecret } from '../../lib/clipboard'
import { useVaultStore } from '../../store/vault'
import { useUiStore } from '../../store/ui'
import type { EntryListItem, EntryType, Folder } from '../../types'

const SIDEBAR_MIN = 160
const SIDEBAR_MAX = 360
const ENTRY_LIST_MIN = 180
const ENTRY_LIST_MAX = 480

function loadWidth(key: string, fallback: number, min: number, max: number): number {
  try {
    const saved = parseInt(localStorage.getItem(key) ?? '', 10)
    return Math.min(max, Math.max(min, Number.isNaN(saved) ? fallback : saved))
  } catch { return fallback }
}

function saveWidth(key: string, width: number) {
  try { localStorage.setItem(key, String(width)) } catch {}
}

// Handlers read the store after their await instead of the render-time `entries` snapshot,
// otherwise two overlapping operations would overwrite each other's list update.
const latestEntries = () => useVaultStore.getState().entries

function reportError(action: string, e: unknown) {
  // A conflict already opens the conflict dialog, which explains what happened.
  if (e === CONFLICT_MESSAGE) return
  alert(`${action} failed: ${String(e)}`)
}

interface Props { onLock: () => void }

export function AppShell({ onLock }: Props) {
  const { entries, setEntries, selectedEntryId, setSelectedEntryId } = useVaultStore()
  const { sidebarFilter, setSidebarFilter, selectedFolderId } = useUiStore()

  const [folders, setFolders] = useState<Folder[]>([])
  const [trashItems, setTrashItems] = useState<EntryListItem[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [showPasswordGen, setShowPasswordGen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<any | null>(null)
  const [detailReloadKey, setDetailReloadKey] = useState(0)
  const [showPalette, setShowPalette] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showConflict, setShowConflict] = useState(false)

  const [sidebarWidth, setSidebarWidth] = useState(() => loadWidth('yek-sidebar-w', 192, SIDEBAR_MIN, SIDEBAR_MAX))
  const [entryListWidth, setEntryListWidth] = useState(() => loadWidth('yek-entrylist-w', 240, ENTRY_LIST_MIN, ENTRY_LIST_MAX))

  const resizeSidebar = (delta: number) =>
    setSidebarWidth(w => {
      const next = Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, w + delta))
      saveWidth('yek-sidebar-w', next)
      return next
    })

  const resizeEntryList = (delta: number) =>
    setEntryListWidth(w => {
      const next = Math.max(ENTRY_LIST_MIN, Math.min(ENTRY_LIST_MAX, w + delta))
      saveWidth('yek-entrylist-w', next)
      return next
    })

  const loadFoldersAndTrash = useCallback(() => {
    tauriApi.getFolders().then(setFolders).catch(console.error)
    tauriApi.getTrash().then(setTrashItems).catch(console.error)
  }, [])

  useEffect(() => { loadFoldersAndTrash() }, [loadFoldersAndTrash])

  // The backend tracks which version of the vault file it last loaded or saved, so this
  // only fires for changes made elsewhere — never for this window's own saves.
  useEffect(() => {
    const onFocus = () => {
      tauriApi.checkVaultChanged().then(changed => { if (changed) setShowConflict(true) }).catch(() => {})
    }
    const onConflict = () => setShowConflict(true)
    window.addEventListener('focus', onFocus)
    window.addEventListener(VAULT_CONFLICT_EVENT, onConflict)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener(VAULT_CONFLICT_EVENT, onConflict)
    }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowPalette(v => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const entryCounts = entries.reduce((acc, e) => {
    acc[e.entry_type] = (acc[e.entry_type] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const currentFolderId = sidebarFilter === 'folder' ? selectedFolderId : null

  const handleSaveEntry = async (data: EntryFormData & { entry_type: EntryType }) => {
    const item = await tauriApi.createEntry(data)
    setEntries([...latestEntries(), item])
  }

  const handleEdit = async (id: string) => {
    try {
      setEditingEntry(await tauriApi.getEntry(id))
    } catch (e) {
      reportError('Opening the entry', e)
    }
  }

  const handleUpdate = async (data: EntryFormData) => {
    if (!editingEntry) return
    const updated = await tauriApi.updateEntry({ ...data, id: editingEntry.id, icon: editingEntry.icon ?? undefined })
    setEntries(latestEntries().map(e => e.id === updated.id ? updated : e))
    setEditingEntry(null)
    setDetailReloadKey(k => k + 1)
  }

  const handleCreateLogin = async (data: { name: string; username: string; url: string; password: string }) => {
    const item = await tauriApi.createEntry({
      name: data.name, entry_type: 'login', tags: [], notes: '', favorite: false,
      folder_id: currentFolderId ?? undefined,
      fields: { url: data.url, username: data.username, password: data.password },
    })
    setEntries([...latestEntries(), item])
  }

  const handleMoveToTrash = async (id: string) => {
    try {
      await tauriApi.moveToTrash(id)
    } catch (e) {
      reportError('Moving the entry to trash', e)
      return
    }
    setEntries(latestEntries().filter(e => e.id !== id))
    if (useVaultStore.getState().selectedEntryId === id) setSelectedEntryId(null)
    tauriApi.getTrash().then(setTrashItems).catch(console.error)
  }

  const handleRestore = async (id: string) => {
    try {
      const restored = await tauriApi.restoreFromTrash(id)
      setTrashItems(prev => prev.filter(e => e.id !== id))
      setEntries([...latestEntries(), restored])
    } catch (e) {
      reportError('Restoring the entry', e)
    }
  }

  const handleDeleteForever = async (id: string) => {
    try {
      await tauriApi.deleteFromTrash(id)
      setTrashItems(prev => prev.filter(e => e.id !== id))
    } catch (e) {
      reportError('Deleting the entry', e)
    }
  }

  const handleEmptyTrash = async () => {
    try {
      await tauriApi.emptyTrash()
      setTrashItems([])
    } catch (e) {
      reportError('Emptying the trash', e)
    }
  }

  const handleNewFolder = async () => {
    const name = prompt('Folder name:')
    if (!name?.trim()) return
    try {
      const folder = await tauriApi.createFolder(name.trim())
      setFolders(prev => [...prev, folder])
    } catch (e) {
      reportError('Creating the folder', e)
    }
  }

  const handleLock = async () => {
    clearCopiedSecret()
    await tauriApi.lockVault()
    onLock()
  }

  const handleCopy = async (id: string) => {
    try {
      const entry = await tauriApi.getEntry(id) as any
      const fields = entry?.fields?.fields
      const type = entry?.fields?.type
      const value = type === 'login' ? fields?.password
        : type === 'api_key' ? fields?.key
        : type === 'card' ? fields?.number
        : type === 'ssh_key' ? fields?.private_key
        : type === 'note' ? fields?.content
        : ''
      if (value) await copySecret(value)
    } catch (e) {
      reportError('Copying', e)
    }
  }

  const handlePaletteSelect = (id: string) => {
    // The detail panel is hidden while Trash is open, so show the entry in All Items.
    if (sidebarFilter === 'trash') setSidebarFilter('all')
    setSelectedEntryId(id)
  }

  const handleKeepMine = async () => {
    await tauriApi.overwriteVault()
    setShowConflict(false)
  }

  const handleLoadFromDisk = async (password: string) => {
    const reloaded = await tauriApi.reloadVault(password)
    setEntries(reloaded)
    const selected = useVaultStore.getState().selectedEntryId
    if (selected && !reloaded.some(e => e.id === selected)) setSelectedEntryId(null)
    loadFoldersAndTrash()
    setDetailReloadKey(k => k + 1)
    setShowConflict(false)
  }

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">
      {/* Sidebar — resizable */}
      <div style={{ width: sidebarWidth }} className="shrink-0 flex flex-col overflow-hidden">
        <Sidebar
          folders={folders}
          entryCounts={entryCounts}
          trashCount={trashItems.length}
          onLock={handleLock}
          onNewFolder={handleNewFolder}
          onSettings={() => setShowSettings(true)}
          onSearch={() => setShowPalette(true)}
        />
      </div>

      <ResizeDivider onResize={resizeSidebar} />

      {sidebarFilter === 'trash' ? (
        <TrashPanel
          items={trashItems}
          onRestore={handleRestore}
          onDeleteForever={handleDeleteForever}
          onEmptyTrash={handleEmptyTrash}
        />
      ) : (
        <>
          {/* Entry list — resizable */}
          <div style={{ width: entryListWidth }} className="shrink-0 flex flex-col overflow-hidden">
            <EntryList
              folders={folders}
              onAdd={() => setShowAdd(true)}
              onGeneratePassword={() => setShowPasswordGen(true)}
              onSelect={setSelectedEntryId}
              onCopy={handleCopy}
            />
          </div>

          <ResizeDivider onResize={resizeEntryList} />

          {/* Detail panel — takes remaining space */}
          <div className="flex-1 flex overflow-hidden">
            <DetailPanel
              entryId={selectedEntryId}
              reloadKey={detailReloadKey}
              onEdit={handleEdit}
              onDelete={handleMoveToTrash}
            />
          </div>
        </>
      )}

      {showAdd && (
        <EntryFormModal
          folders={folders}
          defaultFolderId={currentFolderId}
          onClose={() => setShowAdd(false)}
          onSave={handleSaveEntry}
        />
      )}
      {showPasswordGen && (
        <PasswordGenerator onClose={() => setShowPasswordGen(false)} onCreateLogin={handleCreateLogin} />
      )}
      {editingEntry && (
        <EntryFormModal
          folders={folders}
          initialEntry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onUpdate={handleUpdate}
        />
      )}
      {showPalette && (
        <CommandPalette
          entries={entries}
          onSelect={handlePaletteSelect}
          onClose={() => setShowPalette(false)}
        />
      )}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} onLock={handleLock} />}
      {showConflict && (
        <ConflictDialog onKeepMine={handleKeepMine} onLoadFromDisk={handleLoadFromDisk} />
      )}
    </div>
  )
}
