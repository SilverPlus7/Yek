import { useEffect, useState } from 'react'
import { tauriApi } from './lib/tauri'
import { useVaultStore } from './store/vault'
import { SetupWizard } from './components/screens/SetupWizard'
import { UnlockScreen } from './components/screens/UnlockScreen'
import type { VaultInfo } from './types'

type AppScreen = 'loading' | 'setup' | 'unlock' | 'vault'

export default function App() {
  const [screen, setScreen] = useState<AppScreen>('loading')
  const [vaultInfo, setVaultInfo] = useState<VaultInfo | null>(null)
  const [error, setError] = useState('')
  const { setEntries, setVaultInfo: storeSetVaultInfo } = useVaultStore()

  useEffect(() => {
    tauriApi.getVaultInfo().then(info => {
      if (!info) { setScreen('setup'); return }
      setVaultInfo(info)
      setScreen(info.is_unlocked ? 'vault' : 'unlock')
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

  // vault screen — placeholder until Phase 2
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-100">
      <div className="text-center space-y-2">
        <div className="text-4xl">🔐</div>
        <h1 className="text-xl font-bold">Vault Unlocked</h1>
        <p className="text-slate-400 text-sm">Main UI coming in Phase 2</p>
      </div>
    </div>
  )
}
