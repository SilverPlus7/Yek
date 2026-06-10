import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { UnlockScreen } from './UnlockScreen'

describe('UnlockScreen', () => {
  it('renders password input and unlock button', () => {
    render(<UnlockScreen vaultPath="/tmp/vault.yek" onUnlock={vi.fn()} onOpenOther={vi.fn()} />)
    expect(screen.getByPlaceholderText(/master password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /unlock/i })).toBeInTheDocument()
  })

  it('calls onUnlock with entered password', () => {
    const onUnlock = vi.fn()
    render(<UnlockScreen vaultPath="/tmp/vault.yek" onUnlock={onUnlock} onOpenOther={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/master password/i), { target: { value: 'mypassword' } })
    fireEvent.click(screen.getByRole('button', { name: /unlock/i }))
    expect(onUnlock).toHaveBeenCalledWith('mypassword')
  })

  it('shows error message when provided', () => {
    render(<UnlockScreen vaultPath="/tmp/vault.yek" onUnlock={vi.fn()} onOpenOther={vi.fn()} error="Wrong password" />)
    expect(screen.getByText('Wrong password')).toBeInTheDocument()
  })
})
