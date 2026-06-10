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
