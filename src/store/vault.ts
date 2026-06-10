import { create } from 'zustand'
import type { EntryListItem, VaultInfo } from '../types'

interface VaultStore {
  entries: EntryListItem[]
  vaultInfo: VaultInfo | null
  isUnlocked: boolean
  selectedEntryId: string | null
  setEntries: (entries: EntryListItem[]) => void
  setVaultInfo: (info: VaultInfo) => void
  setSelectedEntryId: (id: string | null) => void
  lock: () => void
}

export const useVaultStore = create<VaultStore>((set) => ({
  entries: [],
  vaultInfo: null,
  isUnlocked: false,
  selectedEntryId: null,
  setEntries: (entries) => set({ entries }),
  setVaultInfo: (vaultInfo) => set({ vaultInfo, isUnlocked: true }),
  setSelectedEntryId: (selectedEntryId) => set({ selectedEntryId }),
  lock: () => set({ entries: [], isUnlocked: false, selectedEntryId: null }),
}))
