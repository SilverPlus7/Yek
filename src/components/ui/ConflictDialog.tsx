import { useState } from 'react'
import { describeUnlockError } from '../../lib/tauri'

interface Props {
  onKeepMine: () => Promise<void>
  onLoadFromDisk: (password: string) => Promise<void>
}

export function ConflictDialog({ onKeepMine, onLoadFromDisk }: Props) {
  const [phase, setPhase] = useState<'choice' | 'password'>('choice')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // On success the parent closes the dialog, so `busy` only needs resetting on failure.
  const handleKeepMine = async () => {
    setBusy(true)
    setErr(null)
    try {
      await onKeepMine()
    } catch (e) {
      setErr(`Could not save: ${String(e)}`)
      setBusy(false)
    }
  }

  const handleConfirm = async () => {
    if (!pw || busy) return
    setBusy(true)
    setErr(null)
    try {
      await onLoadFromDisk(pw)
    } catch (e) {
      setErr(describeUnlockError(e))
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-slate-800 border border-yellow-600 rounded-xl p-6 w-full max-w-sm mx-4 shadow-2xl">
        <div className="text-center mb-4">
          <div className="text-3xl mb-2">⚠️</div>
          <h2 className="text-slate-100 font-semibold">Vault changed on another device</h2>
          <p className="text-slate-400 text-sm mt-2">
            The vault file was saved somewhere else after this window loaded it. Choose which version to keep.
          </p>
        </div>

        {phase === 'choice' ? (
          <div className="space-y-2">
            <button
              onClick={() => { setErr(null); setPhase('password') }}
              disabled={busy}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg text-sm disabled:opacity-50"
            >
              Load from disk (use other device&apos;s version)
            </button>
            <button
              onClick={handleKeepMine}
              disabled={busy}
              className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 py-2.5 rounded-lg text-sm disabled:opacity-50"
            >
              {busy ? 'Saving…' : "Keep mine (overwrite with this session's data)"}
            </button>
            {err && <p className="text-xs text-red-400 text-center">{err}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-slate-400 text-sm text-center">Enter master password to reload vault:</p>
            <input
              type="password"
              autoFocus
              value={pw}
              onChange={e => setPw(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleConfirm() }}
              placeholder="Master password"
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-blue-500"
            />
            {err && <p className="text-xs text-red-400 text-center">{err}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => { setPhase('choice'); setPw(''); setErr(null) }}
                disabled={busy}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 py-2 rounded-lg text-sm disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={handleConfirm}
                disabled={busy || !pw}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 rounded-lg text-sm disabled:opacity-50"
              >
                {busy ? 'Loading…' : 'Confirm'}
              </button>
            </div>
          </div>
        )}

        <p className="text-xs text-slate-600 text-center mt-3">
          Keeping yours discards the other device&apos;s changes.
        </p>
      </div>
    </div>
  )
}
