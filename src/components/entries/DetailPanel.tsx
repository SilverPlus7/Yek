import { useEffect, useState, type ReactNode } from 'react'
import { tauriApi } from '../../lib/tauri'
import { LoginDetail } from './LoginDetail'
import { ApiKeyDetail } from './ApiKeyDetail'
import { NoteDetail } from './NoteDetail'
import { SshKeyDetail } from './SshKeyDetail'
import { CardDetail } from './CardDetail'
import { AttachmentSection } from './AttachmentSection'

interface Props {
  entryId: string | null
  reloadKey?: number
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export function DetailPanel({ entryId, reloadKey, onEdit, onDelete }: Props) {
  const [entry, setEntry] = useState<any>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attachmentsVersion, setAttachmentsVersion] = useState(0)

  useEffect(() => {
    if (!entryId) { setEntry(null); return }
    let stale = false
    setLoadError(null)
    tauriApi.getEntry(entryId)
      .then(e => { if (!stale) setEntry(e) })
      .catch(e => { if (!stale) setLoadError(String(e)) })
    return () => { stale = true }
  }, [entryId, reloadKey, attachmentsVersion])

  if (!entryId) return (
    <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
      Select an entry to view
    </div>
  )

  if (loadError) return (
    <div className="flex-1 flex items-center justify-center text-red-400 text-sm px-4 text-center">
      Could not load this entry: {loadError}
    </div>
  )

  // Until the selected entry has loaded, never show the previous one under the new entry's buttons.
  if (!entry || entry.id !== entryId) return (
    <div className="flex-1 flex items-center justify-center text-slate-600 text-sm">
      Loading...
    </div>
  )

  // Entry struct uses #[serde(flatten)] on base, so top-level fields are flat:
  // { id, name, tags, icon, notes, favorite, created_at, updated_at, attachments, fields: { type, fields } }
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

  const withAttachments = (detail: ReactNode) => (
    <div className="flex-1 p-4 overflow-y-auto space-y-4">
      {detail}
      <hr className="border-slate-700" />
      <AttachmentSection
        key={entryId}
        entryId={entryId}
        attachments={entry.attachments ?? []}
        onChanged={() => setAttachmentsVersion(v => v + 1)}
      />
    </div>
  )

  if (type === 'login') return withAttachments(<LoginDetail {...commonProps} fields={typeFields} />)
  if (type === 'api_key') return withAttachments(<ApiKeyDetail {...commonProps} fields={typeFields} />)
  if (type === 'note') return withAttachments(<NoteDetail {...commonProps} fields={typeFields} />)
  if (type === 'ssh_key') return withAttachments(<SshKeyDetail {...commonProps} fields={typeFields} />)
  if (type === 'card') return withAttachments(<CardDetail {...commonProps} fields={typeFields} />)

  return <div className="flex-1 p-4 text-slate-500">Unknown entry type</div>
}
