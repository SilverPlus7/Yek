import { TagBadge } from '../ui/TagBadge'
import type { NoteFields } from '../../types'

interface Props {
  name: string; tags: string[]; fields: NoteFields
  onEdit: () => void; onDelete: () => void
}

export function NoteDetail({ name, tags, fields, onEdit, onDelete }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-slate-700">
        <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center text-xl">📝</div>
        <div className="flex-1"><h2 className="text-slate-100 font-semibold">{name}</h2><p className="text-xs text-slate-500">Secure Note</p></div>
        <button onClick={onEdit} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded">Edit</button>
        <button onClick={onDelete} className="text-xs bg-red-900/40 hover:bg-red-900/70 text-red-400 px-3 py-1.5 rounded">Delete</button>
      </div>
      <div className="bg-slate-800 rounded-md p-3 min-h-[120px]">
        <pre className="text-sm text-slate-300 whitespace-pre-wrap font-mono">{fields.content}</pre>
      </div>
      {tags.length > 0 && <div className="flex flex-wrap gap-1.5">{tags.map(t => <TagBadge key={t} tag={t} />)}</div>}
    </div>
  )
}
