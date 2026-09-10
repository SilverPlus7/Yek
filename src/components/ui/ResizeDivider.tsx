import { useRef } from 'react'

interface Props {
  onResize: (delta: number) => void
}

export function ResizeDivider({ onResize }: Props) {
  const startX = useRef<number | null>(null)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    startX.current = e.clientX

    const onMove = (ev: MouseEvent) => {
      if (startX.current === null) return
      const delta = ev.clientX - startX.current
      startX.current = ev.clientX
      onResize(delta)
    }

    const onUp = () => {
      startX.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      className="w-1 shrink-0 cursor-col-resize bg-slate-700 hover:bg-blue-500 transition-colors select-none"
      title="Drag to resize"
    />
  )
}
