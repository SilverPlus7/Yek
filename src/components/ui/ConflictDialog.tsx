import { useState } from 'react'

interface Props {
  onKeepMine: () => void
  onLoadFromDisk: (password: string) => Promise<void>
}

export function ConflictDialog({ onKeepMine, onLoadFromDisk }: Props) {
  const [phase, setPhase] = useState<'choice' | 'password'>('choice')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const handleConfirm = async () => {
    if (!pw) return
    setBusy(true)
    setErr(null)
    try {
      await onLoadFromDisk(pw)
    } catch {
      setErr('Wrong password or vault error')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-slate-800 border border-yellow-600 rounded-xl p-6 w-full max-w-sm shadow-2xl">
        <div className="text-center mb-4">
          <div className="text-3xl mb-2">⚠️</div>
          <h2 className="text-slate-100 font-semibold">Vault conflict detected</h2>
          <p className="text-slate-400 text-sm mt-2">
            The vault file on disk was modified by another device while this session was open.
          </p>
        </div>

        {phase === 'choice' ? (
          <div className="space-y-2">
            <button
              onClick={() => setPhase('password')}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg text-sm"
            >
              Load from disk (use other device&apos;s version)
            </button>
            <button
              onClick={onKeepMine}
              className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 py-2.5 rounded-lg text-sm"
            >
              Keep mine (overwrite with this session&apos;s data)
            </button>
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

        <p className="text-xs text-slate-600 text-center mt-3">Last-write wins if you keep yours.</p>
      </div>
    </div>
  )
}
