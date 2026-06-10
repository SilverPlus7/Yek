import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CommandPalette } from './CommandPalette'
import type { EntryListItem } from '../../types'

const entries: EntryListItem[] = [
  { id: '1', name: 'GitHub Token', entry_type: 'api_key', tags: ['work'], favorite: false, updated_at: '' },
  { id: '2', name: 'AWS Secret',   entry_type: 'api_key', tags: [],       favorite: false, updated_at: '' },
  { id: '3', name: 'Gmail Login',  entry_type: 'login',   tags: [],       favorite: false, updated_at: '' },
]

describe('CommandPalette', () => {
  it('shows all entries when query is empty', () => {
    render(<CommandPalette entries={entries} onSelect={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('GitHub Token')).toBeInTheDocument()
    expect(screen.getByText('AWS Secret')).toBeInTheDocument()
  })

  it('filters entries by query', () => {
    render(<CommandPalette entries={entries} onSelect={vi.fn()} onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'github' } })
    expect(screen.getByText('GitHub Token')).toBeInTheDocument()
    expect(screen.queryByText('AWS Secret')).not.toBeInTheDocument()
  })

  it('calls onClose on Escape', () => {
    const onClose = vi.fn()
    render(<CommandPalette entries={entries} onSelect={vi.fn()} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onSelect when entry is clicked', () => {
    const onSelect = vi.fn()
    render(<CommandPalette entries={entries} onSelect={onSelect} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('GitHub Token'))
    expect(onSelect).toHaveBeenCalledWith('1')
  })
})
