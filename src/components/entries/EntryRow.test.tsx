import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { EntryRow } from './EntryRow'
import type { EntryListItem } from '../../types'

const entry: EntryListItem = {
  id: '1', name: 'GitHub Token', entry_type: 'api_key',
  tags: ['work'], favorite: false, updated_at: '2026-01-01',
}

describe('EntryRow', () => {
  it('renders entry name', () => {
    render(<EntryRow entry={entry} selected={false} onSelect={vi.fn()} onCopy={vi.fn()} />)
    expect(screen.getByText('GitHub Token')).toBeInTheDocument()
  })

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn()
    render(<EntryRow entry={entry} selected={false} onSelect={onSelect} onCopy={vi.fn()} />)
    fireEvent.click(screen.getByText('GitHub Token'))
    expect(onSelect).toHaveBeenCalledWith('1')
  })

  it('shows selected style when selected=true', () => {
    const { container } = render(
      <EntryRow entry={entry} selected={true} onSelect={vi.fn()} onCopy={vi.fn()} />
    )
    expect(container.firstChild).toHaveClass('border-blue-500')
  })
})
