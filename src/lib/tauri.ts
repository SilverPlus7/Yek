import { invoke } from '@tauri-apps/api/core'
import type { EntryListItem, Folder, VaultInfo } from '../types'

/** Dispatched on `window` when a save was refused because another device changed the vault. */
export const VAULT_CONFLICT_EVENT = 'yek:vault-conflict'

export const CONFLICT_MESSAGE =
  'The vault was changed on another device. Choose which version to keep, then try again.'

// Commands that write the vault. The backend refuses to overwrite a file another device
// has saved; surface that as the conflict dialog instead of a raw error code.
async function write<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args)
  } catch (e) {
    if (e === 'VAULT_CONFLICT') {
      window.dispatchEvent(new Event(VAULT_CONFLICT_EVENT))
      throw CONFLICT_MESSAGE
    }
    throw e
  }
}

/** Human-readable reason an unlock/reload failed. */
export function describeUnlockError(e: unknown): string {
  const message = String(e)
  if (message.includes('decryption failed')) return 'Wrong password. Please try again.'
  return `Could not open the vault: ${message}`
}

export interface EntryPayload {
  name: string
  folder_id?: string
  tags: string[]
  notes: string
  favorite: boolean
  icon?: string
  fields: unknown
}

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

  readVaultHint: (path: string) => invoke<string | null>('read_vault_hint', { path }),

  createEntry: (payload: EntryPayload & { entry_type: string }) =>
    write<EntryListItem>('create_entry', { payload }),

  deleteEntry: (id: string) => write<void>('delete_entry', { id }),

  getEntry: (id: string) => invoke<unknown>('get_entry', { id }),

  getFolders: () => invoke<Folder[]>('get_folders'),

  createFolder: (name: string) => write<Folder>('create_folder', { name }),

  /** True when another device replaced the vault file since this session loaded or saved it. */
  checkVaultChanged: () => invoke<boolean>('check_vault_changed'),
  /** "Keep mine": write this session's data over the other device's version. */
  overwriteVault: () => invoke<void>('overwrite_vault'),
  reloadVault: (password: string) => invoke<EntryListItem[]>('reload_vault', { password }),
  listBackups: () => invoke<string[]>('list_backups'),

  updateEntry: (payload: EntryPayload & { id: string }) =>
    write<EntryListItem>('update_entry', { payload }),

  moveToTrash: (id: string) => write<void>('move_to_trash', { id }),
  restoreFromTrash: (id: string) => write<EntryListItem>('restore_from_trash', { id }),
  deleteFromTrash: (id: string) => write<void>('delete_from_trash', { id }),
  emptyTrash: () => write<void>('empty_trash'),
  getTrash: () => invoke<EntryListItem[]>('get_trash'),

  attachFile: (entryId: string, path: string) =>
    write<void>('attach_file', { entryId, path }),
  downloadAttachment: (entryId: string, name: string, destPath: string) =>
    invoke<void>('download_attachment', { entryId, name, destPath }),
  removeAttachment: (entryId: string, name: string) =>
    write<void>('remove_attachment', { entryId, name }),
}
