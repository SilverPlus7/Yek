import { invoke } from '@tauri-apps/api/core'
import type { EntryListItem, VaultInfo } from '../types'

export const tauriApi = {
  createVault: (dir: string, password: string, hint?: string) =>
    invoke<VaultInfo>('create_vault', { dir, password, hint }),

  unlockVault: (path: string, password: string) =>
    invoke<VaultInfo>('unlock_vault', { path, password }),

  lockVault: () =>
    invoke<void>('lock_vault'),

  getEntries: () =>
    invoke<EntryListItem[]>('get_entries'),

  getVaultInfo: () =>
    invoke<VaultInfo | null>('get_vault_info'),
}
