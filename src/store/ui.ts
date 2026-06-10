import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'dark' | 'light' | 'high-contrast' | 'midnight'
export type SidebarFilter = 'all' | 'favorites' | 'login' | 'api_key' | 'note' | 'ssh_key' | 'card' | string

interface UiStore {
  theme: Theme
  sidebarFilter: SidebarFilter
  selectedFolderId: string | null
  setTheme: (theme: Theme) => void
  setSidebarFilter: (filter: SidebarFilter) => void
  setSelectedFolderId: (id: string | null) => void
}

export const useUiStore = create<UiStore>()(
  persist(
    (set) => ({
      theme: 'dark',
      sidebarFilter: 'all',
      selectedFolderId: null,
      setTheme: (theme) => set({ theme }),
      setSidebarFilter: (sidebarFilter) => set({ sidebarFilter }),
      setSelectedFolderId: (selectedFolderId) => set({ selectedFolderId }),
    }),
    { name: 'yek-ui' }
  )
)
