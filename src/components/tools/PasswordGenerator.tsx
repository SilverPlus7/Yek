import { useState, useCallback } from 'react'
import { Modal } from '../ui/Modal'
import { inputCls } from '../forms/Field'
import { copySecret } from '../../lib/clipboard'
import { generatePassword as generate, hasCharSet, type PasswordOptions as Options } from '../../lib/password'

function strength(opts: Options): { label: string; bars: number; color: string } {
  let s = 0
  if (opts.uppercase) s++
  if (opts.lowercase) s++
  if (opts.numbers)   s++
  if (opts.symbols)   s++
  if (opts.length >= 16) s++
  if (opts.length >= 24) s++
  if (s <= 2) return { label: 'Weak',   bars: 1, color: 'bg-red-500 text-red-400' }
  if (s <= 4) return { label: 'Good',   bars: 2, color: 'bg-yellow-500 text-yellow-400' }
  return              { label: 'Strong', bars: 3, color: 'bg-green-500 text-green-400' }
}

const DEFAULT_OPTS: Options = { length: 20, uppercase: true, lowercase: true, numbers: true, symbols: true }

interface Props {
  onClose: () => void
  onCreateLogin: (data: { name: string; username: string; url: string; password: string }) => Promise<void>
}

export function PasswordGenerator({ onClose, onCreateLogin }: Props) {
  const [opts, setOpts] = useState<Options>(DEFAULT_OPTS)
  const [password, setPassword] = useState(() => generate(DEFAULT_OPTS))
  const [showPw, setShowPw] = useState(false)
  const [copied, setCopied] = useState(false)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const str = strength(opts)

  const updateOpt = <K extends keyof Options>(k: K, v: Options[K]) => {
    const next = { ...opts, [k]: v }
    if (!hasCharSet(next)) return // keep at least one character type selected
    setOpts(next)
    setPassword(generate(next))
    setCopied(false)
  }

  const regenerate = useCallback(() => {
    setPassword(generate(opts))
    setCopied(false)
  }, [opts])

  const copy = async () => {
    await copySecret(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSave = async () => {
    if (!name.trim()) { setSaveError('Entry name is required'); return }
    setSaving(true)
    setSaveError('')
    try {
      await onCreateLogin({ name: name.trim(), username, url, password })
      onClose()
    } catch (e) {
      setSaveError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Password Generator" onClose={onClose}>
      <div className="space-y-4">
        {/* Password display */}
        <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
          <div className="flex items-center gap-2 min-h-[2rem]">
            <code className="flex-1 text-sm font-mono text-slate-100 break-all select-all leading-relaxed">
              {showPw ? password : '•'.repeat(password.length)}
            </code>
            <button onClick={() => setShowPw(v => !v)}
              className="text-slate-500 hover:text-slate-300 text-xs px-2 py-1 rounded shrink-0">
              {showPw ? 'Hide' : 'Show'}
            </button>
            <button onClick={copy}
              className={`text-xs px-2.5 py-1.5 rounded font-medium shrink-0 transition-colors
                ${copied ? 'bg-green-800 text-green-300' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>
              {copied ? '✓' : 'Copy'}
            </button>
          </div>
          {/* Strength bar */}
          <div className="flex items-center gap-2 mt-2.5">
            <div className="flex gap-1">
              {[1, 2, 3].map(i => (
                <div key={i} className={`h-1.5 w-8 rounded-full ${i <= str.bars ? str.color.split(' ')[0] : 'bg-slate-700'}`} />
              ))}
            </div>
            <span className={`text-xs font-medium ${str.color.split(' ')[1]}`}>{str.label}</span>
          </div>
        </div>

        <button onClick={regenerate}
          className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-sm font-semibold py-2 rounded-md transition-colors">
          ↻  Generate New Password
        </button>

        {/* Options */}
        <div className="space-y-2.5 bg-slate-800/50 rounded-lg p-3">
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm text-slate-300 shrink-0">
              Length: <span className="font-mono font-bold text-slate-100 ml-1">{opts.length}</span>
            </label>
            <input type="range" min={8} max={64} value={opts.length}
              onChange={e => updateOpt('length', Number(e.target.value))}
              className="flex-1 accent-blue-500 cursor-pointer" />
          </div>
          {([
            ['uppercase', 'A–Z Uppercase'],
            ['lowercase', 'a–z Lowercase'],
            ['numbers',   '0–9 Numbers'],
            ['symbols',   '!@# Symbols'],
          ] as const).map(([k, label]) => (
            <label key={k} className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-slate-300">{label}</span>
              <input type="checkbox" checked={opts[k]} onChange={e => updateOpt(k, e.target.checked)}
                className="w-4 h-4 accent-blue-500" />
            </label>
          ))}
        </div>

        {/* Save as login section */}
        <div className="border-t border-slate-700 pt-3 space-y-2">
          <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">
            Save as Login Entry (optional)
          </p>
          <input className={inputCls} placeholder="Entry name, e.g. GitHub" value={name}
            onChange={e => { setName(e.target.value); setSaveError('') }} />
          <input className={inputCls} placeholder="Username / email" value={username}
            onChange={e => setUsername(e.target.value)} />
          <input className={inputCls} placeholder="URL (optional)" value={url}
            onChange={e => setUrl(e.target.value)} />
          {saveError && <p className="text-xs text-red-400">{saveError}</p>}
          <button onClick={handleSave} disabled={saving}
            className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white text-sm font-semibold py-2 rounded-md transition-colors">
            {saving ? 'Saving…' : '+ Save Login Entry'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
