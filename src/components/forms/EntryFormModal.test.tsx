import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { EntryFormModal } from './EntryFormModal'

const folders = [
  { id: 'f-work', name: 'Work', has_password: false },
  { id: 'f-home', name: 'Home', has_password: false },
]

describe('EntryFormModal', () => {
  it('creates an entry in the chosen folder, as a favorite, keeping a tag that was typed but not added', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    render(<EntryFormModal folders={folders} defaultFolderId="f-work" onClose={onClose} onSave={onSave} />)

    expect(screen.getByRole('combobox')).toHaveValue('f-work')
    fireEvent.change(screen.getByPlaceholderText(/github token/i), { target: { value: 'GitHub' } })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'f-home' } })
    fireEvent.click(screen.getByRole('button', { name: /favorite/i }))
    fireEvent.change(screen.getByPlaceholderText(/add tag/i), { target: { value: 'Dev' } })
    fireEvent.click(screen.getByRole('button', { name: /save entry/i }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    expect(onSave.mock.calls[0][0]).toMatchObject({
      name: 'GitHub', entry_type: 'login', folder_id: 'f-home', favorite: true, tags: ['dev'],
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('keeps the entry’s folder and favorite flag when editing', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    const entry = {
      id: 'e1', name: 'Mail', folder_id: 'f-home', favorite: true, tags: [], notes: '',
      fields: { type: 'login', fields: { url: '', username: 'me', password: 'pw' } },
    }
    render(<EntryFormModal folders={folders} initialEntry={entry} onClose={vi.fn()} onUpdate={onUpdate} />)
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1))
    expect(onUpdate.mock.calls[0][0]).toMatchObject({ name: 'Mail', folder_id: 'f-home', favorite: true })
  })

  it('shows a save error and stays open', async () => {
    const onClose = vi.fn()
    render(<EntryFormModal folders={folders} onClose={onClose} onSave={vi.fn().mockRejectedValue('disk full')} />)
    fireEvent.change(screen.getByPlaceholderText(/github token/i), { target: { value: 'X' } })
    fireEvent.click(screen.getByRole('button', { name: /save entry/i }))
    expect(await screen.findByText('disk full')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
})
