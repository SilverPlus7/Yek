import { useVaultStore } from '../../store/vault'
import { useUiStore } from '../../store/ui'
import type { SidebarFilter } from '../../store/ui'

interface Folder {
  id: string
  name: string
  has_password: boolean
}

interface Props {
  folders: Folder[]
  entryCounts: Record<string, number>
  onLock: () => void
  onNewFolder: () => void
}

const TYPE_ITEMS: Array<{
  filter: SidebarFilter
  emoji: string
  label: string
  key: string
}> = [
  { filter: 'login', emoji: '🔑', label: 'Logins', key: 'login' },
  { filter: 'api_key', emoji: '⚡', label: 'API Keys', key: 'api_key' },
  { filter: 'note', emoji: '📝', label: 'Notes', key: 'note' },
  { filter: 'ssh_key', emoji: '🔒', label: 'SSH Keys', key: 'ssh_key' },
  { filter: 'card', emoji: '💳', label: 'Cards', key: 'card' },
]

export function Sidebar({
  folders,
  entryCounts,
  onLock,
  onNewFolder,
}: Props) {
  const { sidebarFilter, setSidebarFilter, setSelectedFolderId } = useUiStore()
  const totalEntries = useVaultStore((s) => s.entries.length)

  const setFilter = (f: SidebarFilter) => {
    setSidebarFilter(f)
    setSelectedFolderId(null)
  }

  const navItem = (
    filter: SidebarFilter,
    emoji: string,
    label: string,
    count?: number
  ) => (
    <button
      key={filter}
      onClick={() => setFilter(filter)}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors
        ${
          sidebarFilter === filter
            ? 'bg-blue-600 text-white font-semibold'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
        }`}
    >
      <span>{emoji}</span>
      <span className="flex-1 text-left">{label}</span>
      {count !== undefined && (
        <span
          className={`text-xs rounded-full px-1.5 ${
            sidebarFilter === filter
              ? 'bg-blue-500'
              : 'bg-slate-700 text-slate-500'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  )

  return (
    <aside className="w-48 bg-slate-800 border-r border-slate-700 flex flex-col shrink-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3.5 border-b border-slate-700">
        <span className="text-xl">🔐</span>
        <span className="font-bold tracking-widest text-slate-100">YEK</span>
        <button disabled className="ml-auto text-slate-500 text-sm opacity-50 cursor-not-allowed">
          ⚙️
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-md px-2.5 py-1.5 text-xs text-slate-500 cursor-pointer">
          🔍{' '}
          <span>
            Search <kbd className="text-slate-600">⌘K</kbd>
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        <p className="px-2 pt-2 pb-1 text-xs font-semibold uppercase tracking-widest text-slate-600">
          Library
        </p>
        {navItem('favorites', '⭐', 'Favorites')}
        {navItem('all', '🗂️', 'All Items', totalEntries)}

        <p className="px-2 pt-3 pb-1 text-xs font-semibold uppercase tracking-widest text-slate-600">
          Types
        </p>
        {TYPE_ITEMS.map(({ filter, emoji, label, key }) =>
          navItem(filter, emoji, label, entryCounts[key] ?? 0)
        )}

        <p className="px-2 pt-3 pb-1 text-xs font-semibold uppercase tracking-widest text-slate-600">
          Folders
        </p>
        {folders.map((f) => (
          <button
            key={f.id}
            onClick={() => {
              setSidebarFilter('folder')
              setSelectedFolderId(f.id)
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
          >
            <span>{f.has_password ? '🔐' : '📁'}</span>
            <span className="flex-1 text-left truncate">{f.name}</span>
            {f.has_password && (
              <span className="text-yellow-500 text-xs">🔒</span>
            )}
          </button>
        ))}
        <button
          onClick={onNewFolder}
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-slate-600 hover:text-slate-400 transition-colors"
        >
          ＋ New Folder
        </button>
      </nav>

      {/* Footer */}
      <div className="px-3 py-2.5 border-t border-slate-700 flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
          D
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-slate-200">Vault</p>
          <p className="text-xs text-slate-500">Unlocked</p>
        </div>
        <button
          onClick={onLock}
          title="Lock vault"
          className="text-slate-500 hover:text-slate-300 text-base"
        >
          🔒
        </button>
      </div>
    </aside>
  )
}
