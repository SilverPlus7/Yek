import { useState } from 'react'
import { Field, inputCls, textareaCls } from './Field'
import type { SshKeyFields } from '../../types'

interface Props { initial?: SshKeyFields; onChange: (f: SshKeyFields) => void }

export function SshKeyForm({ initial, onChange }: Props) {
  const [f, setF] = useState<SshKeyFields>(initial ?? { public_key: '', private_key: '' })
  const update = (patch: Partial<SshKeyFields>) => { const next = { ...f, ...patch }; setF(next); onChange(next) }
  return (
    <div className="space-y-3">
      <Field label="Host"><input className={inputCls} placeholder="github.com" value={f.host ?? ''} onChange={e => update({ host: e.target.value || undefined })} /></Field>
      <Field label="Public Key" required><textarea className={textareaCls} placeholder="ssh-ed25519 AAAA..." rows={3} value={f.public_key} onChange={e => update({ public_key: e.target.value })} /></Field>
      <Field label="Private Key" required><textarea className={textareaCls} placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" rows={5} value={f.private_key} onChange={e => update({ private_key: e.target.value })} /></Field>
      <Field label="Passphrase"><input className={inputCls} type="password" placeholder="Optional passphrase" value={f.passphrase ?? ''} onChange={e => update({ passphrase: e.target.value || undefined })} /></Field>
    </div>
  )
}
