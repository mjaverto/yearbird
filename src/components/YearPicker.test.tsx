import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { YearPicker } from './YearPicker'

describe('YearPicker', () => {
  it('renders the current year', () => {
    render(<YearPicker year={2025} onChange={() => {}} />)

    expect(screen.getByText('2025')).toBeInTheDocument()
  })

  it('calls onChange with previous year when clicking back button', () => {
    const onChange = vi.fn()
    render(<YearPicker year={2025} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Previous year' }))

    expect(onChange).toHaveBeenCalledWith(2024)
  })

  it('calls onChange with next year when clicking forward button', () => {
    const onChange = vi.fn()
    render(<YearPicker year={2025} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Next year' }))

    expect(onChange).toHaveBeenCalledWith(2026)
  })

  it('disables back button at minimum year', () => {
    const onChange = vi.fn()
    render(<YearPicker year={2020} onChange={onChange} minYear={2020} />)

    const backButton = screen.getByRole('button', { name: 'Previous year' })
    expect(backButton).toBeDisabled()

    fireEvent.click(backButton)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('disables forward button at maximum year', () => {
    const onChange = vi.fn()
    render(<YearPicker year={2030} onChange={onChange} maxYear={2030} />)

    const forwardButton = screen.getByRole('button', { name: 'Next year' })
    expect(forwardButton).toBeDisabled()

    fireEvent.click(forwardButton)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('enables both buttons when within valid range', () => {
    render(<YearPicker year={2025} onChange={() => {}} minYear={2020} maxYear={2030} />)

    expect(screen.getByRole('button', { name: 'Previous year' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next year' })).not.toBeDisabled()
  })

  it('renders in compact size with smaller styling', () => {
    const { container } = render(<YearPicker year={2025} onChange={() => {}} size="compact" />)

    const yearSpan = screen.getByText('2025')
    expect(yearSpan).toHaveClass('text-sm')
    expect(yearSpan).toHaveClass('min-w-[3rem]')

    const buttons = container.querySelectorAll('button')
    buttons.forEach((button) => {
      expect(button).toHaveClass('text-xs')
    })
  })

  it('renders in default size with larger styling', () => {
    const { container } = render(<YearPicker year={2025} onChange={() => {}} size="default" />)

    const yearSpan = screen.getByText('2025')
    expect(yearSpan).toHaveClass('text-lg')
    expect(yearSpan).toHaveClass('min-w-[4rem]')

    const buttons = container.querySelectorAll('button')
    buttons.forEach((button) => {
      expect(button).not.toHaveClass('text-xs')
    })
  })

  it('uses default minYear and maxYear when not specified', () => {
    render(<YearPicker year={2020} onChange={() => {}} />)

    // Default minYear is 2020, so back should be disabled
    expect(screen.getByRole('button', { name: 'Previous year' })).toBeDisabled()

    // Default maxYear is 2030, so forward should be enabled
    expect(screen.getByRole('button', { name: 'Next year' })).not.toBeDisabled()
  })

  it('uses default size when not specified', () => {
    render(<YearPicker year={2025} onChange={() => {}} />)

    // Default size is 'default', should have larger styling
    const yearSpan = screen.getByText('2025')
    expect(yearSpan).toHaveClass('text-lg')
  })

  it('renders arrow symbols in buttons', () => {
    render(<YearPicker year={2025} onChange={() => {}} />)

    expect(screen.getByRole('button', { name: 'Previous year' })).toHaveTextContent('←')
    expect(screen.getByRole('button', { name: 'Next year' })).toHaveTextContent('→')
  })
})
