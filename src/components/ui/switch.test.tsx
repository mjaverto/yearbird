import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Switch } from './switch'

describe('Switch', () => {
  it('renders as unchecked by default', () => {
    render(<Switch checked={false} onChange={() => {}} label="test" />)

    const switchEl = screen.getByRole('switch')
    expect(switchEl).toHaveAttribute('aria-checked', 'false')
  })

  it('renders as checked when checked prop is true', () => {
    render(<Switch checked={true} onChange={() => {}} label="test" />)

    const switchEl = screen.getByRole('switch')
    expect(switchEl).toHaveAttribute('aria-checked', 'true')
  })

  it('calls onChange with inverted value when clicked', () => {
    const onChange = vi.fn()

    render(<Switch checked={false} onChange={onChange} label="test" />)

    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('calls onChange with false when checked and clicked', () => {
    const onChange = vi.fn()

    render(<Switch checked={true} onChange={onChange} label="test" />)

    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('uses custom enabledLabel for screen reader when unchecked', () => {
    render(
      <Switch
        checked={false}
        onChange={() => {}}
        label="feature"
        enabledLabel="Turn on feature"
      />
    )

    expect(screen.getByText('Turn on feature')).toBeInTheDocument()
  })

  it('uses custom disabledLabel for screen reader when checked', () => {
    render(
      <Switch
        checked={true}
        onChange={() => {}}
        label="feature"
        disabledLabel="Turn off feature"
      />
    )

    expect(screen.getByText('Turn off feature')).toBeInTheDocument()
  })

  it('generates default screen reader text from label', () => {
    const { rerender } = render(
      <Switch checked={false} onChange={() => {}} label="dark mode" />
    )
    expect(screen.getByText('Enable dark mode')).toBeInTheDocument()

    rerender(<Switch checked={true} onChange={() => {}} label="dark mode" />)
    expect(screen.getByText('Disable dark mode')).toBeInTheDocument()
  })
})
