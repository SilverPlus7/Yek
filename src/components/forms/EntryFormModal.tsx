import { useState } from 'react'
import { Modal } from '../ui/Modal'
import { Field, inputCls } from './Field'
import { LoginForm } from './LoginForm'
import { ApiKeyForm } from './ApiKeyForm'
import { NoteForm } from './NoteForm'
import { SshKeyForm } from './SshKeyForm'
import { CardForm } from './CardForm'
import { TagBadge } from '../ui/TagBadge'
import type { EntryType } from '../../types'

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

interface Props {
  onClose: () => void
  onSave: (data: {
    name: string; entry_type: EntryType; tags: string[]
    notes: string; favorite: boolean; fields: unknown
  }) => Promise<void>
}

export function EntryFormModal({ onClose, onSave }: Props) {
  const [type, setType] = useState<EntryType>('login')
  const [name, setName] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [notes, setNotes] = useState('')
  const [fields, setFields] = useState<unknown>(DEFAULT_FIELDS['login'])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleTypeChange = (t: EntryType) => {
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
    setSaving(true)
    try {
      await onSave({ name: name.trim(), entry_type: type, tags, notes, favorite: false, fields })
      onClose()
    } catch (e) { setError(String(e)) }
    finally { setSaving(false) }
  }

  return (
    <Modal title="Add New Entry" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex gap-1.5 flex-wrap">
          {TYPES.map(t => (
            <button key={t.value} onClick={() => handleTypeChange(t.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors
                ${type === t.value ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
              {t.emoji} {t.label}
            </button>
          ))}
        </div>

        <Field label="Name" required>
          <input className={inputCls} placeholder="e.g. GitHub Token" value={name} onChange={e => setName(e.target.value)} autoFocus />
        </Field>

        {type === 'login'   && <LoginForm   onChange={setFields} />}
        {type === 'api_key' && <ApiKeyForm  onChange={setFields} />}
        {type === 'note'    && <NoteForm    onChange={setFields} />}
        {type === 'ssh_key' && <SshKeyForm  onChange={setFields} />}
        {type === 'card'    && <CardForm    onChange={setFields} />}

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
            {saving ? 'Saving...' : 'Save Entry'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
