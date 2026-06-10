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
