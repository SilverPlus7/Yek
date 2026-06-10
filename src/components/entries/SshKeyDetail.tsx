import { MaskedField } from '../ui/MaskedField'
import { TagBadge } from '../ui/TagBadge'
import { useClipboard } from '../../hooks/useClipboard'
import type { SshKeyFields } from '../../types'

interface Props {
  name: string; tags: string[]; notes: string
  fields: SshKeyFields; onEdit: () => void; onDelete: () => void
}

export function SshKeyDetail({ name, tags, notes, fields, onEdit, onDelete }: Props) {
  const { copy, copied } = useClipboard()
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-slate-700">
        <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center text-xl">🔒</div>
        <div className="flex-1"><h2 className="text-slate-100 font-semibold">{name}</h2><p className="text-xs text-slate-500">SSH Key{fields.host ? ` · ${fields.host}` : ''}</p></div>
        <button onClick={onEdit} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded">Edit</button>
        <button onClick={onDelete} className="text-xs bg-red-900/40 hover:bg-red-900/70 text-red-400 px-3 py-1.5 rounded">Delete</button>
      </div>
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Public Key</p>
        <div className="bg-slate-800 rounded px-3 py-2 flex items-start justify-between gap-2">
          <pre className="text-xs text-slate-400 font-mono truncate flex-1">{fields.public_key.length > 60 ? fields.public_key.slice(0, 60) + '...' : fields.public_key}</pre>
          <button onClick={() => copy(fields.public_key)} className="text-xs text-blue-400 shrink-0">Copy</button>
        </div>
      </div>
      <MaskedField label="Private Key" value={fields.private_key} onCopy={copy} monospace />
      {fields.passphrase && <MaskedField label="Passphrase" value={fields.passphrase} onCopy={copy} />}
      {copied && <p className="text-xs text-green-400">✅ Copied — clears in 30s</p>}
      {tags.length > 0 && <div className="flex flex-wrap gap-1.5">{tags.map(t => <TagBadge key={t} tag={t} />)}</div>}
      {notes && <div><p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Notes</p><p className="text-sm text-slate-400">{notes}</p></div>}
    </div>
  )
}
