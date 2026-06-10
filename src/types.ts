export type EntryType = 'login' | 'api_key' | 'note' | 'ssh_key' | 'card'

export interface EntryListItem {
  id: string
  name: string
  entry_type: EntryType
  icon?: string
  folder_id?: string
  tags: string[]
  favorite: boolean
  updated_at: string
}

export interface VaultInfo {
  vault_path: string
  hint?: string
  is_unlocked: boolean
}

export interface LoginFields {
  url: string
  username: string
  password: string
}

export interface ApiKeyFields {
  service: string
  key: string
  secret?: string
  token?: string
  expires_at?: string
}

export interface NoteFields {
  content: string
}

export interface SshKeyFields {
  public_key: string
  private_key: string
  passphrase?: string
  host?: string
}

export interface CardFields {
  cardholder: string
  number: string
  expiry: string
  cvv: string
  billing_address?: string
}
