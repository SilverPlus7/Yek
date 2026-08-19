import { useEffect, useRef, useState } from 'react'
import { Sidebar } from './Sidebar'
import { EntryList } from './EntryList'
import { DetailPanel } from '../entries/DetailPanel'
import { TrashPanel } from '../entries/TrashPanel'
import { EntryFormModal } from '../forms/EntryFormModal'
import { CommandPalette } from '../ui/CommandPalette'
import { ConflictDialog } from '../ui/ConflictDialog'
import { SettingsPanel } from '../settings/SettingsPanel'
import { tauriApi } from '../../lib/tauri'
import { useVaultStore } from '../../store/vault'
import { useUiStore } from '../../store/ui'
import type { EntryListItem, EntryType } from '../../types'

interface Props { onLock: () => void }

export function AppShell({ onLock }: Props) {
  const { entries, setEntries, selectedEntryId, setSelectedEntryId } = useVaultStore()
  const { sidebarFilter } = useUiStore()
  const [folders, setFolders] = useState<Array<{ id: string; name: string; has_password: boolean }>>([])
  const [trashItems, setTrashItems] = useState<EntryListItem[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [editingEntry, setEditingEntry] = useState<any | null>(null)
  const [showPalette, setShowPalette] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showConflict, setShowConflict] = useState(false)
  const lastKnownMtime = useRef(0)

  useEffect(() => {
    tauriApi.getFolders().then(setFolders).catch(console.error)
    tauriApi.getTrash().then(setTrashItems).catch(console.error)
  }, [])

  useEffect(() => {
    const onFocus = async () => {
      try {
        const mtime = await tauriApi.checkVaultChanged()
        if (mtime > 0 && lastKnownMtime.current > 0 && mtime !== lastKnownMtime.current) {
          setShowConflict(true)
        }
        if (mtime > 0 && lastKnownMtime.current === 0) {
          lastKnownMtime.current = mtime
        }
      } catch {}
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
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

  const refreshMtime = () => {
    tauriApi.checkVaultChanged().then(m => { lastKnownMtime.current = m }).catch(() => {})
  }

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
    refreshMtime()
  }

  const handleEdit = async (id: string) => {
    try {
      const entry = await tauriApi.getEntry(id)
      setEditingEntry(entry)
    } catch (e) {
      console.error('Failed to load entry for edit', e)
    }
  }

  const handleUpdate = async (data: {
    name: string; tags: string[]; notes: string; favorite: boolean; fields: unknown
  }) => {
    if (!editingEntry) return
    const updated = await tauriApi.updateEntry({
      id: editingEntry.id,
      name: data.name,
      tags: data.tags,
      notes: data.notes,
      favorite: data.favorite,
      icon: editingEntry.icon,
      fields: data.fields,
    })
    setEntries(entries.map(e => e.id === updated.id ? updated : e))
    setEditingEntry(null)
    refreshMtime()
  }

  const handleMoveToTrash = async (id: string) => {
    await tauriApi.moveToTrash(id)
    const moved = entries.find(e => e.id === id)
    setEntries(entries.filter(e => e.id !== id))
    if (moved) setTrashItems(prev => [...prev, moved])
    if (selectedEntryId === id) setSelectedEntryId(null)
    refreshMtime()
  }

  const handleRestore = async (id: string) => {
    await tauriApi.restoreFromTrash(id)
    const restored = trashItems.find(e => e.id === id)
    setTrashItems(prev => prev.filter(e => e.id !== id))
    if (restored) setEntries([...entries, restored])
    refreshMtime()
  }

  const handleDeleteForever = async (id: string) => {
    await tauriApi.deleteFromTrash(id)
    setTrashItems(prev => prev.filter(e => e.id !== id))
    refreshMtime()
  }

  const handleEmptyTrash = async () => {
    await tauriApi.emptyTrash()
    setTrashItems([])
    refreshMtime()
  }

  const handleNewFolder = async () => {
    const name = prompt('Folder name:')
    if (!name?.trim()) return
    const folder = await tauriApi.createFolder(name.trim())
    setFolders(prev => [...prev, folder])
    refreshMtime()
  }

  const handleLock = async () => {
    await tauriApi.lockVault()
    onLock()
  }

  const handleCopy = async (id: string) => {
    try {
      const entry = await tauriApi.getEntry(id) as any
      const fields = entry?.fields?.fields
      if (!fields) return
      const fieldType = entry?.fields?.type
      const val = fieldType === 'login' ? fields.password
        : fieldType === 'api_key' ? fields.key
        : fieldType === 'card' ? fields.number
        : fieldType === 'ssh_key' ? fields.private_key
        : fieldType === 'note' ? fields.content
        : ''
      if (val) await navigator.clipboard.writeText(val)
    } catch {
      // vault may be locked or entry may not exist
    }
  }

  return (
    <div className="flex h-screen bg-slate-900 overflow-hidden">
      <Sidebar
        folders={folders}
        entryCounts={entryCounts}
        trashCount={trashItems.length}
        onLock={handleLock}
        onNewFolder={handleNewFolder}
        onSettings={() => setShowSettings(true)}
      />

      {sidebarFilter === 'trash' ? (
        <TrashPanel
          items={trashItems}
          onRestore={handleRestore}
          onDeleteForever={handleDeleteForever}
          onEmptyTrash={handleEmptyTrash}
        />
      ) : (
        <>
          <EntryList onAdd={() => setShowAdd(true)} onSelect={setSelectedEntryId} onCopy={handleCopy} />
          <div className="flex-1 flex overflow-hidden">
            <DetailPanel entryId={selectedEntryId} onEdit={handleEdit} onDelete={handleMoveToTrash} />
          </div>
        </>
      )}

      {showAdd && <EntryFormModal onClose={() => setShowAdd(false)} onSave={handleSaveEntry} />}
      {editingEntry && (
        <EntryFormModal
          onClose={() => setEditingEntry(null)}
          initialEntry={editingEntry}
          onUpdate={handleUpdate}
        />
      )}
      {showPalette && (
        <CommandPalette
          entries={entries}
          onSelect={id => {
            setSelectedEntryId(id)
            setShowPalette(false)
          }}
          onClose={() => setShowPalette(false)}
        />
      )}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} onLock={handleLock} />}
      {showConflict && (
        <ConflictDialog
          onKeepMine={async () => {
            setShowConflict(false)
            try {
              const mtime = await tauriApi.checkVaultChanged()
              lastKnownMtime.current = mtime
            } catch {}
          }}
          onLoadFromDisk={async () => {
            const pw = prompt('Enter master password to reload vault:')
            if (!pw) return
            try {
              const reloaded = await tauriApi.reloadVault(pw)
              setEntries(reloaded)
              setShowConflict(false)
              const mtime = await tauriApi.checkVaultChanged()
              lastKnownMtime.current = mtime
            } catch { alert('Wrong password or vault error') }
          }}
        />
      )}
    </div>
  )
}
