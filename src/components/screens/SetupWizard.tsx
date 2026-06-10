import { useState } from 'react'
import { StrengthMeter } from '../ui/StrengthMeter'
import { open } from '@tauri-apps/plugin-dialog'

interface Props {
  onComplete: (dir: string, password: string, hint?: string) => void
}

export function SetupWizard({ onComplete }: Props) {
  const [step, setStep] = useState(1)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [hint, setHint] = useState('')
  const [dir, setDir] = useState('')
  const [error, setError] = useState('')

  const pickFolder = async () => {
    const selected = await open({ directory: true, multiple: false, title: 'Choose sync folder' })
    if (selected && typeof selected === 'string') setDir(selected)
  }

  const step1Valid = password.length >= 12 && password === confirm

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        {/* Step indicator */}
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
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button disabled={!step1Valid}
              onClick={() => { setError(''); setStep(2) }}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors">
              Continue → Choose Sync Folder
            </button>
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
              <div className="flex justify-between">
                <span className="text-slate-400">Vault location</span>
                <span className="text-slate-200 text-xs truncate max-w-[180px]">{dir}/vault.yek</span>
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
            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded-lg text-sm">Back</button>
              <button onClick={() => onComplete(dir, password, hint || undefined)}
                className="flex-1 bg-green-600 hover:bg-green-500 text-white font-semibold py-2 rounded-lg transition-colors">
                Create Vault
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
