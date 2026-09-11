import { useState, useRef, useEffect } from 'react'
import { CLIPBOARD_CLEAR_MS, copySecret } from '../lib/clipboard'

export function useClipboard(clearAfterMs = CLIPBOARD_CLEAR_MS) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [])

  const copy = async (text: string) => {
    await copySecret(text, clearAfterMs)
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), clearAfterMs)
  }

  return { copy, copied }
}
