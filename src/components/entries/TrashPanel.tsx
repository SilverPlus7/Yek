import type { EntryListItem } from '../../types'

const TYPE_EMOJI: Record<string, string> = {
  login: '🔑', api_key: '⚡', note: '📝', ssh_key: '🔒', card: '💳',
}

interface Props {
  items: EntryListItem[]
  onRestore: (id: string) => Promise<void>
  onDeleteForever: (id: string) => Promise<void>
  onEmptyTrash: () => Promise<void>
}

export function TrashPanel({ items, onRestore, onDeleteForever, onEmptyTrash }: Props) {
  const handleDeleteForever = async (id: string) => {
    if (!confirm('Permanently delete this entry? This cannot be undone.')) return
    await onDeleteForever(id)
  }

  const handleEmptyTrash = async () => {
    if (!confirm(`Permanently delete all ${items.length} item(s) in trash? This cannot be undone.`)) return
    await onEmptyTrash()
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Trash</h2>
          <p className="text-xs text-slate-500 mt-0.5">{items.length} item{items.length !== 1 ? 's' : ''}</p>
        </div>
        {items.length > 0 && (
          <button
            onClick={handleEmptyTrash}
            className="text-xs text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded-md border border-red-800 hover:border-red-600"
          >
            Empty Trash
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-4xl mb-3">🗑️</p>
            <p className="text-slate-500 text-sm">Trash is empty</p>
            <p className="text-slate-600 text-xs mt-1">Deleted items appear here</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-800/50 transition-colors">
              <span className="text-xl shrink-0">{TYPE_EMOJI[item.entry_type] ?? '📄'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">{item.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {item.entry_type.replace('_', ' ')} · deleted {new Date(item.updated_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => onRestore(item.id)}
                  className="text-xs text-blue-400 hover:text-blue-300 px-2.5 py-1 rounded border border-blue-800 hover:border-blue-600 transition-colors"
                >
                  Restore
                </button>
                <button
                  onClick={() => handleDeleteForever(item.id)}
                  className="text-xs text-red-400 hover:text-red-300 px-2.5 py-1 rounded border border-red-900 hover:border-red-700 transition-colors"
                >
                  Delete Forever
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
