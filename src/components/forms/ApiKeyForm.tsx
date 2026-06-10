import { useState } from 'react'
import { Field, inputCls } from './Field'
import type { ApiKeyFields } from '../../types'

interface Props { initial?: ApiKeyFields; onChange: (f: ApiKeyFields) => void }

export function ApiKeyForm({ initial, onChange }: Props) {
  const [f, setF] = useState<ApiKeyFields>(initial ?? { service: '', key: '' })
  const update = (patch: Partial<ApiKeyFields>) => { const next = { ...f, ...patch }; setF(next); onChange(next) }
  return (
    <div className="space-y-3">
      <Field label="Service" required><input className={inputCls} placeholder="GitHub" value={f.service} onChange={e => update({ service: e.target.value })} /></Field>
      <Field label="API Key" required><input className={inputCls} placeholder="sk-..." value={f.key} onChange={e => update({ key: e.target.value })} /></Field>
      <Field label="Secret"><input className={inputCls} placeholder="Optional secret" value={f.secret ?? ''} onChange={e => update({ secret: e.target.value || undefined })} /></Field>
      <Field label="Token"><input className={inputCls} placeholder="Optional token" value={f.token ?? ''} onChange={e => update({ token: e.target.value || undefined })} /></Field>
      <Field label="Expires At"><input className={inputCls} type="date" value={f.expires_at ?? ''} onChange={e => update({ expires_at: e.target.value || undefined })} /></Field>
    </div>
  )
}
