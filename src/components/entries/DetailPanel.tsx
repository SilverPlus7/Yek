import { useEffect, useState } from 'react'
import { tauriApi } from '../../lib/tauri'
import { LoginDetail } from './LoginDetail'
import { ApiKeyDetail } from './ApiKeyDetail'
import { NoteDetail } from './NoteDetail'
import { SshKeyDetail } from './SshKeyDetail'
import { CardDetail } from './CardDetail'

interface Props {
  entryId: string | null
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export function DetailPanel({ entryId, onEdit, onDelete }: Props) {
  const [entry, setEntry] = useState<any>(null)

  useEffect(() => {
    if (!entryId) { setEntry(null); return }
    tauriApi.getEntry(entryId).then(setEntry).catch(console.error)
  }, [entryId])

  if (!entryId) return (
    <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
      Select an entry to view
    </div>
  )

  if (!entry) return (
    <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
      Loading...
    </div>
  )

  // Entry struct uses #[serde(flatten)] on base, so top-level fields are flat:
  // { id, name, tags, icon, notes, favorite, created_at, updated_at, fields: { type, fields } }
  // EntryFields uses adjacent tagging: #[serde(tag = "type", content = "fields", rename_all = "snake_case")]
  // So entry.fields = { type: "login" | "api_key" | "note" | "ssh_key" | "card", fields: { ... } }
  const commonProps = {
    name: entry.name ?? '',
    icon: entry.icon,
    tags: entry.tags ?? [],
    notes: entry.notes ?? '',
    onEdit: () => onEdit(entryId),
    onDelete: () => onDelete(entryId),
  }

  const type = entry.fields?.type
  const typeFields = entry.fields?.fields

  if (type === 'login') return <div className="flex-1 p-4 overflow-y-auto"><LoginDetail {...commonProps} fields={typeFields} /></div>
  if (type === 'api_key') return <div className="flex-1 p-4 overflow-y-auto"><ApiKeyDetail {...commonProps} fields={typeFields} /></div>
  if (type === 'note') return <div className="flex-1 p-4 overflow-y-auto"><NoteDetail {...commonProps} fields={typeFields} /></div>
  if (type === 'ssh_key') return <div className="flex-1 p-4 overflow-y-auto"><SshKeyDetail {...commonProps} fields={typeFields} /></div>
  if (type === 'card') return <div className="flex-1 p-4 overflow-y-auto"><CardDetail {...commonProps} fields={typeFields} /></div>

  return <div className="flex-1 p-4 text-slate-500">Unknown entry type</div>
}
