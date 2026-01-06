import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CustomCategory } from '../types/categories'
import type { CustomCategoryInput, CustomCategoryResult } from '../services/customCategories'
import { CustomCategoryManager } from './CustomCategoryManager'

const buildCategory = (overrides: Partial<CustomCategory> = {}): CustomCategory => ({
  id: 'cat-1',
  label: 'Test Category',
  color: '#FF0000',
  keywords: ['test', 'example'],
  matchMode: 'any',
  ...overrides,
})

describe('CustomCategoryManager', () => {
  const mockOnAdd = vi.fn<[CustomCategoryInput], CustomCategoryResult>()
  const mockOnUpdate = vi.fn<[string, CustomCategoryInput], CustomCategoryResult>()
  const mockOnRemove = vi.fn<[string], void>()

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnAdd.mockReturnValue({ category: buildCategory() })
    mockOnUpdate.mockReturnValue({ category: buildCategory() })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders empty state when no categories exist', () => {
    render(
      <CustomCategoryManager
        customCategories={[]}
        onAddCustomCategory={mockOnAdd}
        onUpdateCustomCategory={mockOnUpdate}
        onRemoveCustomCategory={mockOnRemove}
      />
    )

    expect(screen.getByText('No custom categories yet.')).toBeInTheDocument()
  })

  it('renders list of existing categories sorted alphabetically', () => {
    const categories = [
      buildCategory({ id: 'z', label: 'Zebra' }),
      buildCategory({ id: 'a', label: 'Apple' }),
      buildCategory({ id: 'm', label: 'Mango' }),
    ]

    render(
      <CustomCategoryManager
        customCategories={categories}
        onAddCustomCategory={mockOnAdd}
        onUpdateCustomCategory={mockOnUpdate}
        onRemoveCustomCategory={mockOnRemove}
      />
    )

    const listItems = screen.getAllByRole('listitem')
    expect(within(listItems[0]).getByText('Apple')).toBeInTheDocument()
    expect(within(listItems[1]).getByText('Mango')).toBeInTheDocument()
    expect(within(listItems[2]).getByText('Zebra')).toBeInTheDocument()
  })

  it('displays category color, label, match mode and keywords', () => {
    const category = buildCategory({
      label: 'Work Events',
      color: '#0000FF',
      keywords: ['meeting', 'standup'],
      matchMode: 'all',
    })

    render(
      <CustomCategoryManager
        customCategories={[category]}
        onAddCustomCategory={mockOnAdd}
        onUpdateCustomCategory={mockOnUpdate}
        onRemoveCustomCategory={mockOnRemove}
      />
    )

    expect(screen.getByText('Work Events')).toBeInTheDocument()
    expect(screen.getByText('All words')).toBeInTheDocument()
    expect(screen.getByText('meeting')).toBeInTheDocument()
    expect(screen.getByText('standup')).toBeInTheDocument()
  })

  it('adds keywords via Add button', () => {
    render(
      <CustomCategoryManager
        customCategories={[]}
        onAddCustomCategory={mockOnAdd}
        onUpdateCustomCategory={mockOnUpdate}
        onRemoveCustomCategory={mockOnRemove}
      />
    )

    const keywordInput = screen.getByLabelText('Custom category keywords')
    fireEvent.change(keywordInput, { target: { value: 'birthday' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(screen.getByText('birthday')).toBeInTheDocument()
    expect(keywordInput).toHaveValue('')
  })

  it('adds keywords via Enter key', () => {
    render(
      <CustomCategoryManager
        customCategories={[]}
        onAddCustomCategory={mockOnAdd}
        onUpdateCustomCategory={mockOnUpdate}
        onRemoveCustomCategory={mockOnRemove}
      />
    )

    const keywordInput = screen.getByLabelText('Custom category keywords')
    fireEvent.change(keywordInput, { target: { value: 'party' } })
    fireEvent.keyDown(keywordInput, { key: 'Enter' })

    expect(screen.getByText('party')).toBeInTheDocument()
  })

  it('adds multiple comma-separated keywords at once', () => {
    render(
      <CustomCategoryManager
        customCategories={[]}
        onAddCustomCategory={mockOnAdd}
        onUpdateCustomCategory={mockOnUpdate}
        onRemoveCustomCategory={mockOnRemove}
      />
    )

    const keywordInput = screen.getByLabelText('Custom category keywords')
    fireEvent.change(keywordInput, { target: { value: 'one, two, three' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(screen.getByText('one')).toBeInTheDocument()
    expect(screen.getByText('two')).toBeInTheDocument()
    expect(screen.getByText('three')).toBeInTheDocument()
  })

  it('deduplicates keywords case-insensitively', () => {
    render(
      <CustomCategoryManager
        customCategories={[]}
        onAddCustomCategory={mockOnAdd}
        onUpdateCustomCategory={mockOnUpdate}
        onRemoveCustomCategory={mockOnRemove}
      />
    )

    const keywordInput = screen.getByLabelText('Custom category keywords')

    fireEvent.change(keywordInput, { target: { value: 'Test' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    fireEvent.change(keywordInput, { target: { value: 'test, TEST' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    // Should only show one instance
    const testKeywords = screen.getAllByText('Test')
    expect(testKeywords).toHaveLength(1)
  })

  it('removes keywords when clicking x button', () => {
    render(
      <CustomCategoryManager
        customCategories={[]}
        onAddCustomCategory={mockOnAdd}
        onUpdateCustomCategory={mockOnUpdate}
        onRemoveCustomCategory={mockOnRemove}
      />
    )

    const keywordInput = screen.getByLabelText('Custom category keywords')
    fireEvent.change(keywordInput, { target: { value: 'removeme' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(screen.getByText('removeme')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Remove removeme' }))

    expect(screen.queryByText('removeme')).not.toBeInTheDocument()
  })

  it('does not add empty keywords', () => {
    render(
      <CustomCategoryManager
        customCategories={[]}
        onAddCustomCategory={mockOnAdd}
        onUpdateCustomCategory={mockOnUpdate}
        onRemoveCustomCategory={mockOnRemove}
      />
    )

    const keywordInput = screen.getByLabelText('Custom category keywords')
    fireEvent.change(keywordInput, { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    // No remove buttons should appear (one per keyword chip)
    expect(screen.queryAllByRole('button', { name: /^Remove / })).toHaveLength(0)
  })

  it('creates a new category with form data', () => {
    render(
      <CustomCategoryManager
        customCategories={[]}
        onAddCustomCategory={mockOnAdd}
        onUpdateCustomCategory={mockOnUpdate}
        onRemoveCustomCategory={mockOnRemove}
      />
    )

    fireEvent.change(screen.getByLabelText('Custom category name'), {
      target: { value: 'My Category' },
    })
    fireEvent.change(screen.getByLabelText('Custom category color'), {
      target: { value: '#00FF00' },
    })
    fireEvent.change(screen.getByLabelText('Custom category keywords'), {
      target: { value: 'keyword1' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    fireEvent.click(screen.getByRole('button', { name: 'Add category' }))

    expect(mockOnAdd).toHaveBeenCalledWith({
      label: 'My Category',
      color: '#00ff00', // Browser normalizes color input to lowercase
      keywords: ['keyword1'],
      matchMode: 'any',
    })
  })

  it('includes pending keywords in input when saving', () => {
    render(
      <CustomCategoryManager
        customCategories={[]}
        onAddCustomCategory={mockOnAdd}
        onUpdateCustomCategory={mockOnUpdate}
        onRemoveCustomCategory={mockOnRemove}
      />
    )

    fireEvent.change(screen.getByLabelText('Custom category name'), {
      target: { value: 'Test' },
    })

    // Add a keyword first
    fireEvent.change(screen.getByLabelText('Custom category keywords'), {
      target: { value: 'first' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    // Leave a pending keyword in the input
    fireEvent.change(screen.getByLabelText('Custom category keywords'), {
      target: { value: 'pending' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add category' }))

    expect(mockOnAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        keywords: ['first', 'pending'],
      })
    )
  })

  it('displays error when add fails', () => {
    mockOnAdd.mockReturnValue({ error: 'Category name is required' })

    render(
      <CustomCategoryManager
        customCategories={[]}
        onAddCustomCategory={mockOnAdd}
        onUpdateCustomCategory={mockOnUpdate}
        onRemoveCustomCategory={mockOnRemove}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add category' }))

    expect(screen.getByText('Category name is required')).toBeInTheDocument()
  })

  it('clears error when modifying name input', () => {
    mockOnAdd.mockReturnValue({ error: 'Error message' })

    render(
      <CustomCategoryManager
        customCategories={[]}
        onAddCustomCategory={mockOnAdd}
        onUpdateCustomCategory={mockOnUpdate}
        onRemoveCustomCategory={mockOnRemove}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add category' }))
    expect(screen.getByText('Error message')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Custom category name'), {
      target: { value: 'New name' },
    })

    expect(screen.queryByText('Error message')).not.toBeInTheDocument()
  })

  it('clears error when modifying color input', () => {
    mockOnAdd.mockReturnValue({ error: 'Error message' })

    render(
      <CustomCategoryManager
        customCategories={[]}
        onAddCustomCategory={mockOnAdd}
        onUpdateCustomCategory={mockOnUpdate}
        onRemoveCustomCategory={mockOnRemove}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add category' }))
    expect(screen.getByText('Error message')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Custom category color'), {
      target: { value: '#FF0000' },
    })

    expect(screen.queryByText('Error message')).not.toBeInTheDocument()
  })

  it('clears error when modifying match mode', () => {
    mockOnAdd.mockReturnValue({ error: 'Error message' })

    render(
      <CustomCategoryManager
        customCategories={[]}
        onAddCustomCategory={mockOnAdd}
        onUpdateCustomCategory={mockOnUpdate}
        onRemoveCustomCategory={mockOnRemove}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add category' }))
    expect(screen.getByText('Error message')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'all' } })

    expect(screen.queryByText('Error message')).not.toBeInTheDocument()
  })

  it('populates form when editing a category', () => {
    const category = buildCategory({
      label: 'Birthdays',
      color: '#FF00FF',
      keywords: ['bday', 'birthday'],
      matchMode: 'all',
    })

    render(
      <CustomCategoryManager
        customCategories={[category]}
        onAddCustomCategory={mockOnAdd}
        onUpdateCustomCategory={mockOnUpdate}
        onRemoveCustomCategory={mockOnRemove}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

    expect(screen.getByLabelText('Custom category name')).toHaveValue('Birthdays')
    expect(screen.getByLabelText('Custom category color')).toHaveValue('#ff00ff')
    expect(screen.getByRole('button', { name: 'Save category' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('updates category when saving edit', () => {
    const category = buildCategory({ id: 'cat-123', label: 'Original' })

    render(
      <CustomCategoryManager
        customCategories={[category]}
        onAddCustomCategory={mockOnAdd}
        onUpdateCustomCategory={mockOnUpdate}
        onRemoveCustomCategory={mockOnRemove}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Custom category name'), {
      target: { value: 'Updated' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save category' }))

    expect(mockOnUpdate).toHaveBeenCalledWith(
      'cat-123',
      expect.objectContaining({ label: 'Updated' })
    )
  })

  it('resets form when clicking Cancel during edit', () => {
    const category = buildCategory({ label: 'Original' })

    render(
      <CustomCategoryManager
        customCategories={[category]}
        onAddCustomCategory={mockOnAdd}
        onUpdateCustomCategory={mockOnUpdate}
        onRemoveCustomCategory={mockOnRemove}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Custom category name'), {
      target: { value: 'Changed' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByLabelText('Custom category name')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Add category' })).toBeInTheDocument()
  })

  it('deletes category when confirmed', () => {
    const category = buildCategory({ id: 'delete-me', label: 'Delete Me' })
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(
      <CustomCategoryManager
        customCategories={[category]}
        onAddCustomCategory={mockOnAdd}
        onUpdateCustomCategory={mockOnUpdate}
        onRemoveCustomCategory={mockOnRemove}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(window.confirm).toHaveBeenCalledWith('Delete "Delete Me"? This cannot be undone.')
    expect(mockOnRemove).toHaveBeenCalledWith('delete-me')
  })

  it('does not delete category when confirmation is cancelled', () => {
    const category = buildCategory({ id: 'keep-me' })
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(
      <CustomCategoryManager
        customCategories={[category]}
        onAddCustomCategory={mockOnAdd}
        onUpdateCustomCategory={mockOnUpdate}
        onRemoveCustomCategory={mockOnRemove}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(mockOnRemove).not.toHaveBeenCalled()
  })

  it('resets form when deleting the category being edited', () => {
    const category = buildCategory({ id: 'editing', label: 'Editing' })
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(
      <CustomCategoryManager
        customCategories={[category]}
        onAddCustomCategory={mockOnAdd}
        onUpdateCustomCategory={mockOnUpdate}
        onRemoveCustomCategory={mockOnRemove}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByRole('button', { name: 'Save category' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(screen.getByRole('button', { name: 'Add category' })).toBeInTheDocument()
  })

  it('changes match mode via select', () => {
    render(
      <CustomCategoryManager
        customCategories={[]}
        onAddCustomCategory={mockOnAdd}
        onUpdateCustomCategory={mockOnUpdate}
        onRemoveCustomCategory={mockOnRemove}
      />
    )

    const select = screen.getByRole('combobox')
    expect(select).toHaveValue('any')

    fireEvent.change(select, { target: { value: 'all' } })
    expect(select).toHaveValue('all')

    fireEvent.change(screen.getByLabelText('Custom category name'), {
      target: { value: 'Test' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add category' }))

    expect(mockOnAdd).toHaveBeenCalledWith(
      expect.objectContaining({ matchMode: 'all' })
    )
  })

  it('displays match mode text for existing categories', () => {
    const categories = [
      buildCategory({ id: '1', label: 'Any Match', matchMode: 'any' }),
      buildCategory({ id: '2', label: 'All Match', matchMode: 'all' }),
    ]

    render(
      <CustomCategoryManager
        customCategories={categories}
        onAddCustomCategory={mockOnAdd}
        onUpdateCustomCategory={mockOnUpdate}
        onRemoveCustomCategory={mockOnRemove}
      />
    )

    expect(screen.getByText('Any word')).toBeInTheDocument()
    expect(screen.getByText('All words')).toBeInTheDocument()
  })
})
