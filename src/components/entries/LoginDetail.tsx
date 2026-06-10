import { MaskedField } from '../ui/MaskedField'
import { TagBadge } from '../ui/TagBadge'
import { useClipboard } from '../../hooks/useClipboard'
import type { LoginFields } from '../../types'

interface Props {
  name: string; icon?: string; tags: string[]; notes: string
  fields: LoginFields; onEdit: () => void; onDelete: () => void
}

export function LoginDetail({ name, icon, tags, notes, fields, onEdit, onDelete }: Props) {
  const { copy, copied } = useClipboard()
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-slate-700">
        <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center text-xl">
          {icon ? <img src={icon} className="w-6 h-6" alt="" /> : '🔑'}
        </div>
        <div className="flex-1"><h2 className="text-slate-100 font-semibold">{name}</h2><p className="text-xs text-slate-500">Login</p></div>
        <button onClick={onEdit} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded">Edit</button>
        <button onClick={onDelete} className="text-xs bg-red-900/40 hover:bg-red-900/70 text-red-400 px-3 py-1.5 rounded">Delete</button>
      </div>
      {fields.url && <div><p className="text-xs text-slate-500 uppercase tracking-widest mb-1">URL</p><p className="text-sm text-blue-400 truncate">{fields.url}</p></div>}
      {fields.username && <div><p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Username</p><div className="flex items-center justify-between bg-slate-800 rounded px-3 py-2"><span className="text-sm text-slate-200">{fields.username}</span><button onClick={() => copy(fields.username)} className="text-xs text-blue-400">Copy</button></div></div>}
      <MaskedField label="Password" value={fields.password} onCopy={copy} />
      {copied && <p className="text-xs text-green-400">✅ Copied — clears in 30s</p>}
      {tags.length > 0 && <div className="flex flex-wrap gap-1.5">{tags.map(t => <TagBadge key={t} tag={t} />)}</div>}
      {notes && <div><p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Notes</p><p className="text-sm text-slate-400 whitespace-pre-wrap">{notes}</p></div>}
    </div>
  )
}
