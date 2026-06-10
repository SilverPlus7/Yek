import type { EntryListItem } from '../../types'
import { TagBadge } from '../ui/TagBadge'
import { ServiceIcon } from '../ui/ServiceIcon'
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
      <ServiceIcon name={entry.name} entryType={entry.entry_type} customIcon={entry.icon} size="sm" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-200 truncate">{entry.name}</p>
        <p className="text-xs text-slate-500 truncate">
          {TYPE_LABEL[entry.entry_type]}
          {entry.tags[0] && <> · <TagBadge tag={entry.tags[0]} /></>}
        </p>
      </div>

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
