import { describe, it, expect } from 'vitest'
import { generatePassword, hasCharSet } from './password'

const ALL = { length: 8, uppercase: true, lowercase: true, numbers: true, symbols: true }

describe('generatePassword', () => {
  it('always contains every selected character type, even at the minimum length', () => {
    for (let i = 0; i < 500; i++) {
      const pw = generatePassword(ALL)
      expect(pw).toHaveLength(8)
      expect(pw).toMatch(/[A-Z]/)
      expect(pw).toMatch(/[a-z]/)
      expect(pw).toMatch(/[0-9]/)
      expect(pw).toMatch(/[^A-Za-z0-9]/)
    }
  })

  it('only uses the selected character types', () => {
    const pw = generatePassword({ ...ALL, length: 64, uppercase: false, lowercase: false, symbols: false })
    expect(pw).toMatch(/^[0-9]{64}$/)
  })

  it('reports when no character type is selected', () => {
    expect(hasCharSet(ALL)).toBe(true)
    expect(hasCharSet({ ...ALL, uppercase: false, lowercase: false, numbers: false, symbols: false })).toBe(false)
  })
})
