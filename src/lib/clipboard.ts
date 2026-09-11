export const CLIPBOARD_CLEAR_MS = 30_000

// Module-level so the wipe still happens after the component that copied the secret unmounts
// (switching entries, opening Trash, locking the vault).
let clearTimer: ReturnType<typeof setTimeout> | null = null

/** Copy a secret and wipe it from the clipboard after `clearAfterMs`. */
export async function copySecret(text: string, clearAfterMs = CLIPBOARD_CLEAR_MS): Promise<void> {
  await navigator.clipboard.writeText(text)
  if (clearTimer) clearTimeout(clearTimer)
  clearTimer = setTimeout(clearCopiedSecret, clearAfterMs)
}

/** Wipe a secret copied with `copySecret` right away. Does nothing if none is pending. */
export function clearCopiedSecret(): void {
  if (!clearTimer) return
  clearTimeout(clearTimer)
  clearTimer = null
  navigator.clipboard.writeText('').catch(() => {})
}
