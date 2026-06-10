import { ReactNode } from 'react'

interface Props { label: string; required?: boolean; children: ReactNode }

export function Field({ label, required, children }: Props) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest text-slate-500 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

export const inputCls = "w-full bg-slate-900 border border-slate-600 rounded-md px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
export const textareaCls = `${inputCls} resize-none min-h-[80px]`
