import { useState } from 'react'

interface Props {
  vaultPath: string
  hint?: string
  error?: string
  onUnlock: (password: string) => void
  onOpenOther: () => void
}

export function UnlockScreen({ vaultPath, hint, error, onUnlock, onOpenOther }: Props) {
  const [password, setPassword] = useState('')
  const [showHint, setShowHint] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const submit = () => { if (password) onUnlock(password) }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div>
          <div className="text-5xl mb-2">🔐</div>
          <h1 className="text-2xl font-bold tracking-widest text-slate-100">YEK</h1>
          <p className="text-xs text-slate-500 mt-1 truncate">{vaultPath}</p>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="Master password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              autoFocus
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 pr-10 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <button type="button" onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
              {showPw ? '🙈' : '👁'}
            </button>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button onClick={submit}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition-colors">
            Unlock Vault
          </button>
        </div>

        <div className="space-y-2 text-xs text-slate-500">
          {hint && (
            <div>
              <button onClick={() => setShowHint(v => !v)} className="text-blue-400 hover:underline">
                {showHint ? 'Hide hint' : 'View hint'}
              </button>
              {showHint && <p className="mt-1 text-slate-400">{hint}</p>}
            </div>
          )}
          <button onClick={onOpenOther} className="hover:text-slate-300">
            📂 Open different vault...
          </button>
        </div>
      </div>
    </div>
  )
}
