import React, { useEffect, useState } from 'react'
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
  onVaultSaved?: () => void
}

export function DetailPanel({ entryId, reloadKey, onEdit, onDelete, onVaultSaved }: Props) {
  const [entry, setEntry] = useState<any>(null)

  const fetchEntry = (id: string) => tauriApi.getEntry(id).then(setEntry).catch(console.error)

  useEffect(() => {
    if (!entryId) { setEntry(null); return }
    fetchEntry(entryId)
  }, [entryId, reloadKey])

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

  const attachmentSection = (
    <AttachmentSection
      entryId={entryId}
      attachments={entry.attachments ?? []}
      onChanged={() => fetchEntry(entryId)}
      onVaultSaved={onVaultSaved}
    />
  )

  const wrapDetail = (children: React.ReactNode) => (
    <div className="flex-1 p-4 overflow-y-auto space-y-4">
      {children}
      <hr className="border-slate-700" />
      {attachmentSection}
    </div>
  )

  if (type === 'login') return wrapDetail(<LoginDetail {...commonProps} fields={typeFields} />)
  if (type === 'api_key') return wrapDetail(<ApiKeyDetail {...commonProps} fields={typeFields} />)
  if (type === 'note') return wrapDetail(<NoteDetail {...commonProps} fields={typeFields} />)
  if (type === 'ssh_key') return wrapDetail(<SshKeyDetail {...commonProps} fields={typeFields} />)
  if (type === 'card') return wrapDetail(<CardDetail {...commonProps} fields={typeFields} />)

  return <div className="flex-1 p-4 text-slate-500">Unknown entry type</div>
}
