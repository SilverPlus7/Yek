import { useState } from 'react'
import { Field, textareaCls } from './Field'
import type { NoteFields } from '../../types'

interface Props { initial?: NoteFields; onChange: (f: NoteFields) => void }

export function NoteForm({ initial, onChange }: Props) {
  const [f, setF] = useState<NoteFields>(initial ?? { content: '' })
  const update = (patch: Partial<NoteFields>) => { const next = { ...f, ...patch }; setF(next); onChange(next) }
  return (
    <div>
      <Field label="Content" required>
        <textarea className={textareaCls} placeholder="Your secure note..." rows={8} value={f.content} onChange={e => update({ content: e.target.value })} />
      </Field>
    </div>
  )
}
