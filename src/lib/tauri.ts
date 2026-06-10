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

  getSavedVaultPath: () => invoke<string | null>('get_saved_vault_path'),

  createEntry: (payload: {
    name: string; folder_id?: string; tags: string[]; notes: string;
    favorite: boolean; icon?: string; entry_type: string; fields: unknown
  }) => invoke<EntryListItem>('create_entry', { payload }),

  deleteEntry: (id: string) => invoke<void>('delete_entry', { id }),

  getEntry: (id: string) => invoke<unknown>('get_entry', { id }),

  getFolders: () => invoke<Array<{ id: string; name: string; has_password: boolean }>>('get_folders'),

  createFolder: (name: string) =>
    invoke<{ id: string; name: string; has_password: boolean }>('create_folder', { name }),

  checkVaultChanged: () => invoke<number>('check_vault_changed'),
  reloadVault: (password: string) => invoke<EntryListItem[]>('reload_vault', { password }),
}
