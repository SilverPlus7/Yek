import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useClipboard } from './useClipboard'

describe('useClipboard', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) }
    })
  })

  it('copies text and sets copied=true', async () => {
    const { result } = renderHook(() => useClipboard(1000))
    await act(async () => { await result.current.copy('hello') })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello')
    expect(result.current.copied).toBe(true)
  })

  it('resets copied after delay', async () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useClipboard(500))
    await act(async () => { await result.current.copy('hello') })
    expect(result.current.copied).toBe(true)
    act(() => { vi.advanceTimersByTime(600) })
    expect(result.current.copied).toBe(false)
    vi.useRealTimers()
  })
})
