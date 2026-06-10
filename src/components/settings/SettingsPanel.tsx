import { ThemePicker } from './ThemePicker'
import { Modal } from '../ui/Modal'
import { useVaultStore } from '../../store/vault'

interface Props {
  onClose: () => void
  onLock: () => void
}

export function SettingsPanel({ onClose, onLock }: Props) {
  const vaultInfo = useVaultStore(s => s.vaultInfo)

  return (
    <Modal title="⚙️ Settings" onClose={onClose}>
      <div className="space-y-6">
        <ThemePicker />

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Vault</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-400">
              <span>Location</span>
              <span className="text-slate-300 text-xs truncate max-w-[220px]">{vaultInfo?.vault_path ?? '—'}</span>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Security</p>
          <div className="space-y-2">
            <button
              onClick={onLock}
              className="w-full text-left text-sm bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md px-3 py-2.5 text-slate-300 flex items-center gap-2"
            >
              🔒 Lock vault now
            </button>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">Data</p>
          <div className="space-y-2">
            <button
              onClick={() => alert('Export: coming in a future update.')}
              className="w-full text-left text-sm bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md px-3 py-2.5 text-yellow-400 flex items-center gap-2"
            >
              ⚠️ Export unencrypted JSON
            </button>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-700 text-center">
          <p className="text-xs text-slate-600">Yek — Open source password manager</p>
          <p className="text-xs text-slate-700">MIT License · No telemetry</p>
        </div>
      </div>
    </Modal>
  )
}
