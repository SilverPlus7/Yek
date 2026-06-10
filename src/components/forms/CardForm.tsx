import { useState } from 'react'
import { Field, inputCls, textareaCls } from './Field'
import type { CardFields } from '../../types'

interface Props { initial?: CardFields; onChange: (f: CardFields) => void }

export function CardForm({ initial, onChange }: Props) {
  const [f, setF] = useState<CardFields>(initial ?? { cardholder: '', number: '', expiry: '', cvv: '' })
  const update = (patch: Partial<CardFields>) => { const next = { ...f, ...patch }; setF(next); onChange(next) }
  return (
    <div className="space-y-3">
      <Field label="Cardholder Name" required><input className={inputCls} placeholder="John Doe" value={f.cardholder} onChange={e => update({ cardholder: e.target.value })} /></Field>
      <Field label="Card Number" required><input className={inputCls} placeholder="•••• •••• •••• ••••" value={f.number} onChange={e => update({ number: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Expiry" required><input className={inputCls} placeholder="MM/YY" value={f.expiry} onChange={e => update({ expiry: e.target.value })} /></Field>
        <Field label="CVV" required><input className={inputCls} placeholder="123" value={f.cvv} onChange={e => update({ cvv: e.target.value })} /></Field>
      </div>
      <Field label="Billing Address"><textarea className={textareaCls} placeholder="Optional" rows={2} value={f.billing_address ?? ''} onChange={e => update({ billing_address: e.target.value || undefined })} /></Field>
    </div>
  )
}
