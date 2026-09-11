import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ConflictDialog } from './ConflictDialog'

describe('ConflictDialog', () => {
  it('keeps this session’s data when asked', async () => {
    const onKeepMine = vi.fn().mockResolvedValue(undefined)
    render(<ConflictDialog onKeepMine={onKeepMine} onLoadFromDisk={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /keep mine/i }))
    await waitFor(() => expect(onKeepMine).toHaveBeenCalledTimes(1))
  })

  it('asks for the password inline and reloads with it', async () => {
    const onLoadFromDisk = vi.fn().mockResolvedValue(undefined)
    render(<ConflictDialog onKeepMine={vi.fn()} onLoadFromDisk={onLoadFromDisk} />)
    fireEvent.click(screen.getByRole('button', { name: /load from disk/i }))
    fireEvent.change(screen.getByPlaceholderText(/master password/i), { target: { value: 'hunter2hunter2' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    await waitFor(() => expect(onLoadFromDisk).toHaveBeenCalledWith('hunter2hunter2'))
  })

  it('stays open with a clear message when the password is wrong', async () => {
    const onLoadFromDisk = vi.fn().mockRejectedValue('decryption failed')
    render(<ConflictDialog onKeepMine={vi.fn()} onLoadFromDisk={onLoadFromDisk} />)
    fireEvent.click(screen.getByRole('button', { name: /load from disk/i }))
    fireEvent.change(screen.getByPlaceholderText(/master password/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))
    expect(await screen.findByText('Wrong password. Please try again.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm/i })).not.toBeDisabled()
  })
})
