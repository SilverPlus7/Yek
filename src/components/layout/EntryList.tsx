import { useMemo } from 'react'
import { EntryRow } from '../entries/EntryRow'
import { useVaultStore } from '../../store/vault'
import { useUiStore } from '../../store/ui'
import type { EntryListItem } from '../../types'

interface Props {
  onAdd: () => void
  onGeneratePassword: () => void
  onSelect: (id: string) => void
  onCopy: (id: string) => void
}

export function EntryList({ onAdd, onGeneratePassword, onSelect, onCopy }: Props) {
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
    <div className="w-full h-full border-r border-slate-700 flex flex-col bg-slate-900">
      <div className="flex items-center gap-1 px-3 py-2.5 border-b border-slate-700">
        <span className="text-sm font-semibold text-slate-200 flex-1 truncate">{title}</span>
        <button onClick={onGeneratePassword} title="Generate password"
          className="text-slate-400 hover:text-slate-200 text-base leading-none px-1">🔑</button>
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
