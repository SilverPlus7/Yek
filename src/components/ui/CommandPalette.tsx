import { useState, useEffect, useMemo, useRef } from 'react'
import type { EntryListItem } from '../../types'
import { ServiceIcon } from './ServiceIcon'

interface Props {
  entries: EntryListItem[]
  onSelect: (id: string) => void
  onClose: () => void
}

export function CommandPalette({ entries, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [highlighted, setHighlighted] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const filtered = useMemo(() => {
    if (!query.trim()) return entries.slice(0, 20)
    const q = query.toLowerCase()
    return entries.filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.entry_type.includes(q) ||
      e.tags.some(t => t.includes(q))
    ).slice(0, 20)
  }, [entries, query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted(h => Math.min(h + 1, filtered.length - 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted(h => Math.max(h - 1, 0))
    }
    if (e.key === 'Enter' && filtered[highlighted]) {
      onSelect(filtered[highlighted].id)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60" onClick={onClose}>
      <div className="w-full max-w-lg bg-slate-800 border border-slate-600 rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-700">
          <span className="text-slate-400">🔍</span>
          <input
            ref={inputRef}
            placeholder="Search entries..."
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setHighlighted(0)
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-slate-100 placeholder-slate-500 outline-none text-sm"
          />
          <kbd className="text-xs text-slate-600 bg-slate-900 px-1.5 py-0.5 rounded">ESC</kbd>
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0
            ? <p className="text-center text-slate-500 text-sm py-6">No results</p>
            : filtered.map((e, i) => (
              <button
                key={e.id}
                onClick={() => {
                  onSelect(e.id)
                  onClose()
                }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors
                  ${i === highlighted ? 'bg-blue-600/30' : 'hover:bg-slate-700'}`}>
                <ServiceIcon name={e.name} entryType={e.entry_type} customIcon={e.icon} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{e.name}</p>
                  <p className="text-xs text-slate-500">{e.entry_type.replace('_', ' ')}</p>
                </div>
                <span className="text-xs text-slate-600">↵ open</span>
              </button>
            ))
          }
        </div>
        <div className="px-4 py-2 border-t border-slate-700 flex gap-4 text-xs text-slate-600">
          <span>↑↓ navigate</span><span>↵ open</span><span>ESC close</span>
        </div>
      </div>
    </div>
  )
}
