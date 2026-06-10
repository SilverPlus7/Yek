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
