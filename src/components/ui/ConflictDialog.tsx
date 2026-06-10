interface Props {
  onKeepMine: () => void
  onLoadFromDisk: () => void
}

export function ConflictDialog({ onKeepMine, onLoadFromDisk }: Props) {
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
        <div className="space-y-2">
          <button onClick={onLoadFromDisk}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-lg text-sm">
            Load from disk (use other device&apos;s version)
          </button>
          <button onClick={onKeepMine}
            className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 py-2.5 rounded-lg text-sm">
            Keep mine (overwrite with this session&apos;s data)
          </button>
        </div>
        <p className="text-xs text-slate-600 text-center mt-3">Last-write wins if you keep yours.</p>
      </div>
    </div>
  )
}
