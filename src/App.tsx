import { useEffect, useState } from 'react'
import { tauriApi } from './lib/tauri'
import { useVaultStore } from './store/vault'
import { SetupWizard } from './components/screens/SetupWizard'
import { UnlockScreen } from './components/screens/UnlockScreen'
import { AppShell } from './components/layout/AppShell'
import type { VaultInfo } from './types'

type AppScreen = 'loading' | 'setup' | 'unlock' | 'vault'

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('loading')
  const [vaultInfo, setVaultInfo] = useState<VaultInfo | null>(null)
  const [error, setError] = useState('')
  const { setEntries, setVaultInfo: storeSetVaultInfo } = useVaultStore()

  useEffect(() => {
    tauriApi.getSavedVaultPath().then(savedPath => {
      if (!savedPath) { setScreen('setup'); return }
      setVaultInfo({ vault_path: savedPath, is_unlocked: false })
      setScreen('unlock')
    })
  }, [])

  const handleCreate = async (dir: string, password: string, hint?: string) => {
    try {
      const info = await tauriApi.createVault(dir, password, hint)
      storeSetVaultInfo(info)
      setVaultInfo(info)
      setScreen('vault')
    } catch (e) { setError(String(e)) }
  }

  const handleUnlock = async (password: string) => {
    if (!vaultInfo) return
    try {
      setError('')
      const info = await tauriApi.unlockVault(vaultInfo.vault_path, password)
      const entries = await tauriApi.getEntries()
      storeSetVaultInfo(info)
      setEntries(entries)
      setScreen('vault')
    } catch {
      setError('Wrong password. Please try again.')
    }
  }

  if (screen === 'loading') return <div className="min-h-screen bg-slate-900" />

  if (screen === 'setup') return <SetupWizard onComplete={handleCreate} />

  if (screen === 'unlock') return (
    <UnlockScreen
      vaultPath={vaultInfo?.vault_path ?? ''}
      hint={vaultInfo?.hint}
      error={error}
      onUnlock={handleUnlock}
      onOpenOther={() => setScreen('setup')}
    />
  )

  if (screen === 'vault') return (
    <AppShell onLock={() => {
      useVaultStore.getState().lock()
      setScreen('unlock')
    }} />
  )
}
