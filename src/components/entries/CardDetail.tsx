import { MaskedField } from '../ui/MaskedField'
import { useClipboard } from '../../hooks/useClipboard'
import type { CardFields } from '../../types'

interface Props {
  name: string; fields: CardFields; onEdit: () => void; onDelete: () => void
}

export function CardDetail({ name, fields, onEdit, onDelete }: Props) {
  const { copy, copied } = useClipboard()
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-slate-700">
        <div className="w-9 h-9 rounded-lg bg-slate-700 flex items-center justify-center text-xl">💳</div>
        <div className="flex-1"><h2 className="text-slate-100 font-semibold">{name}</h2><p className="text-xs text-slate-500">Card · {fields.cardholder}</p></div>
        <button onClick={onEdit} className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded">Edit</button>
        <button onClick={onDelete} className="text-xs bg-red-900/40 hover:bg-red-900/70 text-red-400 px-3 py-1.5 rounded">Delete</button>
      </div>
      <MaskedField label="Card Number" value={fields.number} onCopy={copy} monospace />
      <div className="grid grid-cols-2 gap-3">
        <div><p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Expiry</p><p className="text-sm text-slate-200">{fields.expiry}</p></div>
        <MaskedField label="CVV" value={fields.cvv} onCopy={copy} />
      </div>
      {copied && <p className="text-xs text-green-400">✅ Copied — clears in 30s</p>}
      {fields.billing_address && <div><p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Billing Address</p><p className="text-sm text-slate-400">{fields.billing_address}</p></div>}
    </div>
  )
}
