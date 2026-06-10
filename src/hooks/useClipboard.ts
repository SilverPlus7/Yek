import { useState, useRef, useEffect } from 'react'

export function useClipboard(clearAfterMs = 30_000) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [])

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setCopied(false)
      navigator.clipboard.writeText('').catch(() => {})
    }, clearAfterMs)
  }

  return { copy, copied }
}
