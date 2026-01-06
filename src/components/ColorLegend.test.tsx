import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getAllCategories } from '../utils/categorize'
import { ColorLegend } from './ColorLegend'

describe('ColorLegend', () => {
  it('marks hidden categories and triggers toggle', () => {
    const [category] = getAllCategories()
    if (!category) {
      throw new Error('Expected at least one category')
    }
    const onToggleCategory = vi.fn()

    render(
      <ColorLegend
        categories={getAllCategories()}
        hiddenCategories={[category.category]}
        onToggleCategory={onToggleCategory}
      />
    )

    const button = screen.getByRole('button', { name: `Show ${category.label} events` })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button).toHaveClass('opacity-60')

    fireEvent.click(button)
    expect(onToggleCategory).toHaveBeenCalledWith(category.category)
  })

  it('renders static legend when no handler is provided', () => {
    const [category] = getAllCategories()
    if (!category) {
      throw new Error('Expected at least one category')
    }

    render(<ColorLegend categories={getAllCategories()} hiddenCategories={[category.category]} />)

    expect(screen.queryByRole('button', { name: /events$/i })).toBeNull()
    const label = screen.getByText(category.label)
    expect(label).toBeInTheDocument()
    expect(label.parentElement).toHaveClass('opacity-60')
  })
})
