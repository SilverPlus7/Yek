import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StrengthMeter } from './StrengthMeter'

describe('StrengthMeter', () => {
  it('shows Weak for short passwords', () => {
    render(<StrengthMeter password="abc" />)
    expect(screen.getByText('Weak')).toBeInTheDocument()
  })

  it('shows Strong for long complex passwords', () => {
    render(<StrengthMeter password="Correct-Horse-Battery-Staple-99!" />)
    expect(screen.getByText('Strong')).toBeInTheDocument()
  })

  it('shows the strength bar', () => {
    render(<StrengthMeter password="test1234" />)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })
})
