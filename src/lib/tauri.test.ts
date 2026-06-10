import { describe, it, expect } from 'vitest'
import type { EntryListItem, VaultInfo } from '../types'

describe('TypeScript types', () => {
  it('EntryListItem has required fields', () => {
    const item: EntryListItem = {
      id: 'abc',
      name: 'Test',
      entry_type: 'login',
      tags: [],
      favorite: false,
      updated_at: '2026-01-01',
    }
    expect(item.id).toBe('abc')
  })

  it('VaultInfo has required fields', () => {
    const info: VaultInfo = { vault_path: '/tmp/vault.yek', is_unlocked: true }
    expect(info.is_unlocked).toBe(true)
  })
})
