import { useState } from 'react'
import { StrengthMeter } from '../ui/StrengthMeter'
import { open } from '@tauri-apps/plugin-dialog'

interface Props {
  onCreate: (dir: string, password: string, hint?: string) => Promise<void>
  onOpenExisting: (vaultPath: string) => void
  onCancel?: () => void
}

export function SetupWizard({ onCreate, onOpenExisting, onCancel }: Props) {
  const [step, setStep] = useState(0)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [hint, setHint] = useState('')
  const [dir, setDir] = useState('')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)

  const pickFolder = async () => {
    const selected = await open({ directory: true, multiple: false, title: 'Choose sync folder' })
    if (selected && typeof selected === 'string') setDir(selected)
  }

  const openExisting = async () => {
    const selected = await open({
      directory: false,
      multiple: false,
      title: 'Open vault.yek',
      filters: [{ name: 'Yek vault', extensions: ['yek'] }],
    })
    if (selected && typeof selected === 'string') onOpenExisting(selected)
  }

  const create = async () => {
    setCreating(true)
    setError('')
    try {
      await onCreate(dir, password, hint || undefined)
    } catch (e) {
      setError(String(e))
      setCreating(false)
    }
  }

  const step1Valid = password.length >= 12 && password === confirm

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {step === 0 && (
          <div className="space-y-5 text-center">
            <div>
              <div className="text-5xl mb-2">🔐</div>
              <h1 className="text-2xl font-bold tracking-widest text-slate-100">YEK</h1>
            </div>
            <div className="space-y-2">
              <button onClick={openExisting}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition-colors">
                📂 Open existing vault
              </button>
              <p className="text-xs text-slate-500">
                Pick the <code className="text-blue-300">vault.yek</code> file in your synced folder — use this on a second device.
              </p>
            </div>
            <button onClick={() => setStep(1)}
              className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 py-3 rounded-lg transition-colors">
              ＋ Create a new vault
            </button>
            {onCancel && (
              <button onClick={onCancel} className="text-xs text-slate-500 hover:text-slate-300">
                ← Back to unlock
              </button>
            )}
          </div>
        )}

        {step > 0 && (
          <div className="flex items-center justify-center gap-3">
            {[1, 2, 3].map(n => (
              <div key={n} className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                  ${step === n ? 'bg-blue-600 text-white' : step > n ? 'bg-green-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
                  {step > n ? '✓' : n}
                </div>
                {n < 3 && <div className="w-8 h-0.5 bg-slate-700" />}
              </div>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Create your master password</h2>
              <p className="text-xs text-slate-400 mt-1">This cannot be recovered if lost. Minimum 12 characters.</p>
            </div>
            <input type="password" placeholder="Master password" value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            <StrengthMeter password={password} />
            <input type="password" placeholder="Confirm password" value={confirm}
              onChange={e => setConfirm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
            <div>
              <label className="text-xs text-slate-400">Hint <span className="text-slate-600">(optional, stored unencrypted)</span></label>
              <input type="text" placeholder="Something only you know" value={hint}
                onChange={e => setHint(e.target.value)}
                className="mt-1 w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(0)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-3 rounded-lg text-sm">Back</button>
              <button disabled={!step1Valid}
                onClick={() => { setError(''); setStep(2) }}
                className="flex-[2] bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors">
                Continue → Sync Folder
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Choose your sync folder</h2>
              <p className="text-xs text-slate-400 mt-1">Pick any folder synced by Google Drive, Dropbox, OneDrive, or iCloud. Yek will store <code className="text-blue-300">vault.yek</code> there.</p>
            </div>
            <button onClick={pickFolder}
              className="w-full bg-slate-700 hover:bg-slate-600 border border-slate-500 rounded-lg px-4 py-3 text-left text-sm transition-colors">
              {dir ? <span className="text-slate-100 truncate block">{dir}</span> : <span className="text-slate-400">📂 Click to choose folder...</span>}
            </button>
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded-lg text-sm">Back</button>
              <button disabled={!dir} onClick={() => setStep(3)}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold py-2 rounded-lg transition-colors">
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Ready to create your vault</h2>
            </div>
            <div className="bg-slate-800 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-400 shrink-0">Vault location</span>
                <span className="text-slate-200 text-xs truncate">{dir}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Encryption</span>
                <span className="text-slate-200">AES-256-GCM</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Key derivation</span>
                <span className="text-slate-200">Argon2id</span>
              </div>
              {hint && <div className="flex justify-between">
                <span className="text-slate-400">Hint set</span>
                <span className="text-green-400">✓</span>
              </div>}
            </div>
            {error && (
              <div className="space-y-2">
                <p className="text-sm text-red-400">{error}</p>
                <button onClick={() => { setError(''); setStep(0) }} className="text-xs text-blue-400 hover:underline">
                  ← Open an existing vault instead
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setStep(2)} disabled={creating}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded-lg text-sm disabled:opacity-50">Back</button>
              <button onClick={create} disabled={creating}
                className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold py-2 rounded-lg transition-colors">
                {creating ? 'Creating…' : 'Create Vault'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
