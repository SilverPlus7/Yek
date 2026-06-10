import { useState } from 'react'
import { Field, inputCls } from './Field'
import type { LoginFields } from '../../types'

interface Props { initial?: LoginFields; onChange: (f: LoginFields) => void }

export function LoginForm({ initial, onChange }: Props) {
  const [f, setF] = useState<LoginFields>(initial ?? { url: '', username: '', password: '' })
  const update = (patch: Partial<LoginFields>) => { const next = { ...f, ...patch }; setF(next); onChange(next) }
  return (
    <div className="space-y-3">
      <Field label="URL"><input className={inputCls} placeholder="https://example.com" value={f.url} onChange={e => update({ url: e.target.value })} /></Field>
      <Field label="Username" required><input className={inputCls} placeholder="user@example.com" value={f.username} onChange={e => update({ username: e.target.value })} /></Field>
      <Field label="Password" required><input className={inputCls} type="password" placeholder="Password" value={f.password} onChange={e => update({ password: e.target.value })} /></Field>
    </div>
  )
}
