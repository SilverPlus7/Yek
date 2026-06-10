import { describe, it, expect, beforeEach } from 'vitest'
import { useVaultStore } from './vault'

describe('vault store', () => {
  beforeEach(() => {
    useVaultStore.setState({
      entries: [],
      vaultInfo: null,
      isUnlocked: false,
    })
  })

  it('starts locked with no entries', () => {
    const state = useVaultStore.getState()
    expect(state.isUnlocked).toBe(false)
    expect(state.entries).toHaveLength(0)
  })

  it('setEntries updates entries list', () => {
    useVaultStore.getState().setEntries([
      { id: '1', name: 'GitHub', entry_type: 'api_key', tags: [], favorite: false, updated_at: '' }
    ])
    expect(useVaultStore.getState().entries).toHaveLength(1)
  })

  it('lock clears entries and marks locked', () => {
    useVaultStore.setState({ isUnlocked: true, entries: [{ id: '1', name: 'x', entry_type: 'login', tags: [], favorite: false, updated_at: '' }] })
    useVaultStore.getState().lock()
    expect(useVaultStore.getState().isUnlocked).toBe(false)
    expect(useVaultStore.getState().entries).toHaveLength(0)
  })
})
