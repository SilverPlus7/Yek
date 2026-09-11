import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Field, inputCls } from './Field'
import { LoginForm } from './LoginForm'
import { ApiKeyForm } from './ApiKeyForm'
import { NoteForm } from './NoteForm'
import { SshKeyForm } from './SshKeyForm'
import { CardForm } from './CardForm'
import { TagBadge } from '../ui/TagBadge'
import type { EntryType, Folder } from '../../types'

const TYPES: Array<{ value: EntryType; label: string; emoji: string }> = [
  { value: 'login',   label: 'Login',   emoji: '🔑' },
  { value: 'api_key', label: 'API Key', emoji: '⚡' },
  { value: 'note',    label: 'Note',    emoji: '📝' },
  { value: 'ssh_key', label: 'SSH Key', emoji: '🔒' },
  { value: 'card',    label: 'Card',    emoji: '💳' },
]

const DEFAULT_FIELDS: Record<EntryType, unknown> = {
  login:   { url: '', username: '', password: '' },
  api_key: { service: '', key: '' },
  note:    { content: '' },
  ssh_key: { public_key: '', private_key: '' },
  card:    { cardholder: '', number: '', expiry: '', cvv: '' },
}

export interface EntryFormData {
  name: string
  folder_id?: string
  tags: string[]
  notes: string
  favorite: boolean
  fields: unknown
}

interface CreateProps {
  folders: Folder[]
  defaultFolderId?: string | null
  onClose: () => void
  onSave: (data: EntryFormData & { entry_type: EntryType }) => Promise<void>
  initialEntry?: undefined
  onUpdate?: undefined
}

interface EditProps {
  folders: Folder[]
  onClose: () => void
  initialEntry: any
  onUpdate: (data: EntryFormData) => Promise<void>
  defaultFolderId?: undefined
  onSave?: undefined
}

type Props = CreateProps | EditProps

export function EntryFormModal({ folders, defaultFolderId, onClose, onSave, initialEntry, onUpdate }: Props) {
  const isEdit = !!initialEntry
  const initType: EntryType = isEdit ? (initialEntry.fields?.type as EntryType) : 'login'
  const initFields = isEdit ? (initialEntry.fields?.fields ?? DEFAULT_FIELDS[initType]) : DEFAULT_FIELDS['login']

  const [type, setType] = useState<EntryType>(initType)
  const [name, setName] = useState(isEdit ? initialEntry.name : '')
  const [folderId, setFolderId] = useState<string>(isEdit ? (initialEntry.folder_id ?? '') : (defaultFolderId ?? ''))
  const [favorite, setFavorite] = useState<boolean>(isEdit ? !!initialEntry.favorite : false)
  const [tags, setTags] = useState<string[]>(isEdit ? (initialEntry.tags ?? []) : [])
  const [tagInput, setTagInput] = useState('')
  const [notes, setNotes] = useState(isEdit ? (initialEntry.notes ?? '') : '')
  const [fields, setFields] = useState<unknown>(initFields)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleTypeChange = (t: EntryType) => {
    if (isEdit) return
    setType(t)
    setFields(DEFAULT_FIELDS[t])
  }

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags(prev => [...prev, t])
    setTagInput('')
  }

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    // A tag typed but not yet added with Enter/Add is still meant to be saved.
    const pendingTag = tagInput.trim().toLowerCase()
    const allTags = pendingTag && !tags.includes(pendingTag) ? [...tags, pendingTag] : tags
    const data: EntryFormData = {
      name: name.trim(), folder_id: folderId || undefined, tags: allTags, notes, favorite, fields,
    }
    setSaving(true)
    setError('')
    try {
      if (isEdit && onUpdate) {
        await onUpdate(data)
      } else if (onSave) {
        await onSave({ ...data, entry_type: type })
      }
      onClose()
    } catch (e) { setError(String(e)) }
    finally { setSaving(false) }
  }

  return (
    <Modal title={isEdit ? 'Edit Entry' : 'Add New Entry'} onClose={onClose}>
      <div className="space-y-4">
        <div className="flex gap-1.5 flex-wrap">
          {TYPES.map(t => (
            <button key={t.value} onClick={() => handleTypeChange(t.value)}
              disabled={isEdit}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors
                ${type === t.value ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}
                ${isEdit ? 'opacity-50 cursor-default' : ''}`}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>

        <Field label="Name" required>
          <input className={inputCls} placeholder="e.g. GitHub Token" value={name} onChange={e => setName(e.target.value)} autoFocus />
        </Field>

        <div className="flex gap-3 items-end">
          <div className="flex-1 min-w-0">
            <Field label="Folder">
              <select className={inputCls} value={folderId} onChange={e => setFolderId(e.target.value)}>
                <option value="">No folder</option>
                {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </Field>
          </div>
          <button type="button" onClick={() => setFavorite(v => !v)} aria-pressed={favorite}
            className={`shrink-0 px-3 py-2 rounded-md text-sm border transition-colors
              ${favorite ? 'border-yellow-500 text-yellow-400 bg-yellow-500/10' : 'border-slate-600 text-slate-400 hover:text-slate-200'}`}>
            {favorite ? '★ Favorite' : '☆ Favorite'}
          </button>
        </div>

        {type === 'login'   && <LoginForm   onChange={setFields} initial={isEdit ? initFields as any : undefined} />}
        {type === 'api_key' && <ApiKeyForm  onChange={setFields} initial={isEdit ? initFields as any : undefined} />}
        {type === 'note'    && <NoteForm    onChange={setFields} initial={isEdit ? initFields as any : undefined} />}
        {type === 'ssh_key' && <SshKeyForm  onChange={setFields} initial={isEdit ? initFields as any : undefined} />}
        {type === 'card'    && <CardForm    onChange={setFields} initial={isEdit ? initFields as any : undefined} />}

        <Field label="Tags">
          <div className="flex gap-2 flex-wrap mb-2">
            {tags.map(t => <TagBadge key={t} tag={t} onRemove={() => setTags(prev => prev.filter(x => x !== t))} />)}
          </div>
          <div className="flex gap-2">
            <input className={inputCls} placeholder="Add tag..." value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addTag()} />
            <button onClick={addTag} className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 rounded-md text-sm">Add</button>
          </div>
        </Field>

        <Field label="Notes">
          <textarea className="w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none"
            rows={3} placeholder="Optional notes" value={notes} onChange={e => setNotes(e.target.value)} />
        </Field>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-2 pt-2 border-t border-slate-700">
          <button onClick={onClose} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded-md text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2 rounded-md text-sm">
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Entry'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
