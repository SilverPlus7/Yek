export interface PasswordOptions {
  length: number
  uppercase: boolean
  lowercase: boolean
  numbers: boolean
  symbols: boolean
}

const CHAR_SETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
} as const

type CharSet = keyof typeof CHAR_SETS

export function hasCharSet(opts: PasswordOptions): boolean {
  return (Object.keys(CHAR_SETS) as CharSet[]).some(k => opts[k])
}

// Uniform integer in [0, max) from the OS CSPRNG, using rejection sampling to avoid modulo bias.
function randomInt(max: number): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max
  const buf = new Uint32Array(1)
  do { crypto.getRandomValues(buf) } while (buf[0] >= limit)
  return buf[0] % max
}

/** Random password containing at least one character from every selected set. */
export function generatePassword(opts: PasswordOptions): string {
  const sets = (Object.keys(CHAR_SETS) as CharSet[]).filter(k => opts[k]).map(k => CHAR_SETS[k])
  const pool = sets.join('') || CHAR_SETS.lowercase
  // Seed one character per selected set so sites that require e.g. a digit accept the result.
  const chars = sets.map(set => set[randomInt(set.length)])
  while (chars.length < opts.length) chars.push(pool[randomInt(pool.length)])
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    const tmp = chars[i]
    chars[i] = chars[j]
    chars[j] = tmp
  }
  return chars.join('')
}
