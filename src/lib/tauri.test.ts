import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { EntryListItem, VaultInfo } from '../types'

const invoke = vi.fn()
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => invoke(...args) }))

const { tauriApi, describeUnlockError, CONFLICT_MESSAGE, VAULT_CONFLICT_EVENT } = await import('./tauri')

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

describe('vault writes', () => {
  beforeEach(() => { invoke.mockReset() })

  it('turns a backend conflict into the conflict event and a readable error', async () => {
    invoke.mockRejectedValue('VAULT_CONFLICT')
    const onConflict = vi.fn()
    window.addEventListener(VAULT_CONFLICT_EVENT, onConflict)
    await expect(tauriApi.moveToTrash('id-1')).rejects.toBe(CONFLICT_MESSAGE)
    expect(onConflict).toHaveBeenCalledTimes(1)
    window.removeEventListener(VAULT_CONFLICT_EVENT, onConflict)
  })

  it('passes other errors through unchanged', async () => {
    invoke.mockRejectedValue('Entry not found')
    await expect(tauriApi.deleteFromTrash('id-1')).rejects.toBe('Entry not found')
  })

  it('sends folder and favorite when updating an entry', async () => {
    invoke.mockResolvedValue({})
    await tauriApi.updateEntry({ id: 'e1', name: 'n', folder_id: 'f1', tags: [], notes: '', favorite: true, fields: {} })
    expect(invoke).toHaveBeenCalledWith('update_entry', {
      payload: { id: 'e1', name: 'n', folder_id: 'f1', tags: [], notes: '', favorite: true, fields: {} },
    })
  })
})

describe('describeUnlockError', () => {
  it('reports a wrong password only for decryption failures', () => {
    expect(describeUnlockError('decryption failed')).toBe('Wrong password. Please try again.')
    expect(describeUnlockError('The system cannot find the path specified. (os error 3)'))
      .toBe('Could not open the vault: The system cannot find the path specified. (os error 3)')
  })
})
