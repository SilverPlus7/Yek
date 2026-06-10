import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MaskedField } from './MaskedField'

describe('MaskedField', () => {
  it('masks value by default', () => {
    render(<MaskedField label="Password" value="secret123" onCopy={vi.fn()} />)
    expect(screen.queryByText('secret123')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  })

  it('reveals value on Show click', () => {
    render(<MaskedField label="Password" value="secret123" onCopy={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /show/i }))
    expect(screen.getByText('secret123')).toBeInTheDocument()
  })

  it('calls onCopy when Copy is clicked', () => {
    const onCopy = vi.fn()
    render(<MaskedField label="Password" value="secret123" onCopy={onCopy} />)
    fireEvent.click(screen.getByRole('button', { name: /copy/i }))
    expect(onCopy).toHaveBeenCalledWith('secret123')
  })
})
