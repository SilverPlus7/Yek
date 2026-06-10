import { describe, it, expect } from 'vitest'
import { resolveIconUrl } from './icons'

describe('resolveIconUrl', () => {
  it('resolves github by name', () => {
    expect(resolveIconUrl('GitHub Token')).toContain('github')
  })

  it('resolves aws by name', () => {
    expect(resolveIconUrl('AWS Secret Key')).toContain('aws')
  })

  it('resolves stripe by service', () => {
    expect(resolveIconUrl('stripe api key')).toContain('stripe')
  })

  it('returns null for unknown services', () => {
    expect(resolveIconUrl('my random thing xyz')).toBeNull()
  })

  it('is case-insensitive', () => {
    expect(resolveIconUrl('GITHUB')).toContain('github')
  })
})
