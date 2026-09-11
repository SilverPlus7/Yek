import { useEffect, useState } from 'react'
import { describeUnlockError, tauriApi } from './lib/tauri'
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

  // The hint is stored unencrypted in the vault file, so it can be shown before unlocking.
  const showUnlock = async (vaultPath: string) => {
    const hint = await tauriApi.readVaultHint(vaultPath).catch(() => null)
    setVaultInfo({ vault_path: vaultPath, hint: hint ?? undefined, is_unlocked: false })
    setError('')
    setScreen('unlock')
  }

  useEffect(() => {
    tauriApi.getSavedVaultPath()
      .then(savedPath => (savedPath ? showUnlock(savedPath) : setScreen('setup')))
      .catch(() => setScreen('setup'))
  }, [])

  const handleCreate = async (dir: string, password: string, hint?: string) => {
    const info = await tauriApi.createVault(dir, password, hint)
    storeSetVaultInfo(info)
    setVaultInfo(info)
    setEntries([])
    setScreen('vault')
  }

  const handleUnlock = async (password: string) => {
    if (!vaultInfo) return
    try {
      setError('')
      const info = await tauriApi.unlockVault(vaultInfo.vault_path, password)
      const entries = await tauriApi.getEntries()
      storeSetVaultInfo(info)
      setVaultInfo(info)
      setEntries(entries)
      setScreen('vault')
    } catch (e) {
      setError(describeUnlockError(e))
    }
  }

  if (screen === 'loading') return <div className="min-h-screen bg-slate-900" />

  if (screen === 'setup') return (
    <SetupWizard
      onCreate={handleCreate}
      onOpenExisting={showUnlock}
      onCancel={vaultInfo ? () => setScreen('unlock') : undefined}
    />
  )

  if (screen === 'unlock') return (
    <UnlockScreen
      vaultPath={vaultInfo?.vault_path ?? ''}
      hint={vaultInfo?.hint}
      error={error}
      onUnlock={handleUnlock}
      onOpenOther={() => setScreen('setup')}
    />
  )

  return (
    <AppShell onLock={() => {
      useVaultStore.getState().lock()
      setScreen('unlock')
    }} />
  )
}
