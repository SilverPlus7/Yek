import { useState } from 'react'
import { open, save } from '@tauri-apps/plugin-dialog'
import { tauriApi } from '../../lib/tauri'
import type { FileAttachment } from '../../types'

interface Props {
  entryId: string
  attachments: FileAttachment[]
  onChanged: () => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function AttachmentSection({ entryId, attachments, onChanged }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAttach = async () => {
    setError(null)
    const result = await open({ multiple: false, directory: false })
    if (!result) return
    const filePath = typeof result === 'string' ? result : (result as any).path ?? String(result)
    setBusy(true)
    try {
      await tauriApi.attachFile(entryId, filePath)
      onChanged()
    } catch (e: any) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleDownload = async (att: FileAttachment) => {
    setError(null)
    const dest = await save({ defaultPath: att.name })
    if (!dest) return
    const destPath = typeof dest === 'string' ? dest : (dest as any).path ?? String(dest)
    setBusy(true)
    try {
      await tauriApi.downloadAttachment(entryId, att.name, destPath)
    } catch (e: any) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async (name: string) => {
    if (!confirm(`Remove attachment "${name}"?`)) return
    setError(null)
    setBusy(true)
    try {
      await tauriApi.removeAttachment(entryId, name)
      onChanged()
    } catch (e: any) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-slate-500 uppercase tracking-widest">Attachments</p>
        <button
          onClick={handleAttach}
          disabled={busy}
          className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded disabled:opacity-50"
        >
          + Attach File
        </button>
      </div>

      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}

      {attachments.length === 0 ? (
        <p className="text-xs text-slate-600 py-2">No attachments</p>
      ) : (
        <ul className="space-y-1">
          {attachments.map(att => (
            <li key={att.name} className="flex items-center gap-2 bg-slate-800 rounded px-3 py-2">
              <span className="text-base leading-none">📎</span>
              <span className="flex-1 min-w-0">
                <span className="text-sm text-slate-200 truncate block">{att.name}</span>
                <span className="text-xs text-slate-500">{formatSize(att.size)}</span>
              </span>
              <button
                onClick={() => handleDownload(att)}
                disabled={busy}
                className="text-xs text-blue-400 hover:text-blue-300 shrink-0 disabled:opacity-50"
              >
                Download
              </button>
              <button
                onClick={() => handleRemove(att.name)}
                disabled={busy}
                className="text-xs text-red-400 hover:text-red-300 shrink-0 disabled:opacity-50"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
