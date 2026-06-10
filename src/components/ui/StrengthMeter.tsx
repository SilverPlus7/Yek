interface Props { password: string }

function score(pw: string): number {
  let s = 0
  if (pw.length >= 12) s++
  if (pw.length >= 16) s++
  if (/[A-Z]/.test(pw)) s++
  if (/[0-9]/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  return s
}

const LEVELS = [
  { label: 'Weak',   color: 'bg-red-500',    pct: 20 },
  { label: 'Fair',   color: 'bg-orange-400',  pct: 40 },
  { label: 'Good',   color: 'bg-yellow-400',  pct: 60 },
  { label: 'Strong', color: 'bg-green-400',   pct: 80 },
  { label: 'Strong', color: 'bg-green-500',   pct: 100 },
]

export function StrengthMeter({ password }: Props) {
  if (!password) return null
  const s = Math.min(score(password), 4)
  const level = LEVELS[s]
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-400">Strength</span>
        <span className="font-semibold text-green-400">{level.label}</span>
      </div>
      <div role="progressbar" aria-valuenow={level.pct} aria-valuemin={0} aria-valuemax={100}
        className="h-1 rounded-full bg-slate-700 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${level.color}`} style={{ width: `${level.pct}%` }} />
      </div>
    </div>
  )
}
