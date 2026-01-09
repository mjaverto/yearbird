import type { ComponentProps } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { Category } from '../types/categories'
import { CategoryManager } from './CategoryManager'

type CategoryManagerProps = ComponentProps<typeof CategoryManager>

// Helper to build test categories
const buildCategory = (
  id: string,
  label: string,
  keywords: string[],
  color = '#3B82F6',
  isDefault = false
): Category => ({
  id,
  label,
  color,
  keywords,
  matchMode: 'any',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  isDefault,
})

const defaultProps = (): CategoryManagerProps => ({
  categories: [],
  removedDefaults: [],
  onAddCategory: vi.fn().mockReturnValue({ category: null, error: null }),
  onUpdateCategory: vi.fn().mockReturnValue({ category: null, error: null }),
  onRemoveCategory: vi.fn(),
  onRestoreDefault: vi.fn().mockReturnValue({ category: null, error: null }),
  onResetToDefaults: vi.fn(),
})

const setup = async (overrides: Partial<CategoryManagerProps> = {}) => {
  const props = { ...defaultProps(), ...overrides }

  await act(async () => {
    render(<CategoryManager {...props} />)
  })

  return { props }
}

describe('CategoryManager', () => {
  describe('parseKeywordInput helper', () => {
    it('parses comma-separated keywords', async () => {
      const onAddCategory = vi.fn().mockReturnValue({
        category: buildCategory('test', 'Test', ['one', 'two', 'three']),
        error: null,
      })
      await setup({ onAddCategory })

      const nameInput = screen.getByLabelText('Category name')
      const keywordInput = screen.getByLabelText('Category keywords')

      await act(async () => {
        fireEvent.change(nameInput, { target: { value: 'Test' } })
        fireEvent.change(keywordInput, { target: { value: 'one, two, three' } })
        fireEvent.click(screen.getByRole('button', { name: 'Add category' }))
      })

      expect(onAddCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          keywords: ['one', 'two', 'three'],
        })
      )
    })

    it('parses newline-separated keywords via save (pending input)', async () => {
      // Test that newline-separated keywords work by using the pending input
      // that gets parsed when saving a category (handleSaveCategory parses keywordInput)
      const onAddCategory = vi.fn().mockReturnValue({
        category: buildCategory('test', 'Test', ['alpha', 'beta', 'gamma']),
        error: null,
      })
      await setup({ onAddCategory })

      const nameInput = screen.getByLabelText('Category name')
      const keywordInput = screen.getByLabelText('Category keywords') as HTMLInputElement

      await act(async () => {
        fireEvent.change(nameInput, { target: { value: 'Test' } })
      })

      // Directly set the value with newlines to simulate paste/multiline input
      await act(async () => {
        Object.defineProperty(keywordInput, 'value', { value: 'alpha\nbeta\ngamma', writable: true })
        fireEvent.change(keywordInput, { target: { value: 'alpha\nbeta\ngamma' } })
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Add category' }))
      })

      // The component's parseKeywordInput should split on newlines
      expect(onAddCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          keywords: ['alpha', 'beta', 'gamma'],
        })
      )
    })

    it('handles mixed comma and newline separators via save', async () => {
      const onAddCategory = vi.fn().mockReturnValue({
        category: buildCategory('test', 'Test', ['first', 'second', 'third', 'fourth']),
        error: null,
      })
      await setup({ onAddCategory })

      const nameInput = screen.getByLabelText('Category name')
      const keywordInput = screen.getByLabelText('Category keywords') as HTMLInputElement

      await act(async () => {
        fireEvent.change(nameInput, { target: { value: 'Test' } })
      })

      // Simulate mixed separator input
      await act(async () => {
        Object.defineProperty(keywordInput, 'value', { value: 'first, second\nthird, fourth', writable: true })
        fireEvent.change(keywordInput, { target: { value: 'first, second\nthird, fourth' } })
      })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Add category' }))
      })

      expect(onAddCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          keywords: ['first', 'second', 'third', 'fourth'],
        })
      )
    })

    it('trims whitespace from keywords', async () => {
      const onAddCategory = vi.fn().mockReturnValue({
        category: buildCategory('test', 'Test', ['trim', 'me']),
        error: null,
      })
      await setup({ onAddCategory })

      const nameInput = screen.getByLabelText('Category name')
      const keywordInput = screen.getByLabelText('Category keywords')

      await act(async () => {
        fireEvent.change(nameInput, { target: { value: 'Test' } })
        fireEvent.change(keywordInput, { target: { value: '  trim  ,  me  ' } })
        fireEvent.click(screen.getByRole('button', { name: 'Add category' }))
      })

      expect(onAddCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          keywords: ['trim', 'me'],
        })
      )
    })

    it('filters empty strings from keywords', async () => {
      const onAddCategory = vi.fn().mockReturnValue({
        category: buildCategory('test', 'Test', ['valid']),
        error: null,
      })
      await setup({ onAddCategory })

      const nameInput = screen.getByLabelText('Category name')
      const keywordInput = screen.getByLabelText('Category keywords')

      await act(async () => {
        fireEvent.change(nameInput, { target: { value: 'Test' } })
        fireEvent.change(keywordInput, { target: { value: ',,,valid,,,' } })
        fireEvent.click(screen.getByRole('button', { name: 'Add category' }))
      })

      expect(onAddCategory).toHaveBeenCalledWith(
        expect.objectContaining({
          keywords: ['valid'],
        })
      )
    })

    it('does not add keywords when input is empty', async () => {
      await setup()

      const keywordInput = screen.getByLabelText('Category keywords')
      const addButton = screen.getByRole('button', { name: 'Add' })

      await act(async () => {
        fireEvent.change(keywordInput, { target: { value: '' } })
        fireEvent.click(addButton)
      })

      // No keyword chips should be visible
      expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
    })

    it('does not add keywords when input is only whitespace and commas', async () => {
      await setup()

      const keywordInput = screen.getByLabelText('Category keywords')
      const addButton = screen.getByRole('button', { name: 'Add' })

      await act(async () => {
        fireEvent.change(keywordInput, { target: { value: '  , ,  ,  ' } })
        fireEvent.click(addButton)
      })

      // No keyword chips should be visible
      expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
    })
  })

  describe('dedupeKeywords helper', () => {
    it('removes case-insensitive duplicates keeping first occurrence', async () => {
      await setup()

      const keywordInput = screen.getByLabelText('Category keywords')
      const addButton = screen.getByRole('button', { name: 'Add' })

      await act(async () => {
        fireEvent.change(keywordInput, { target: { value: 'Birthday, BIRTHDAY, birthday' } })
        fireEvent.click(addButton)
      })

      // Only one keyword chip should be visible
      const removeButtons = screen.getAllByRole('button', { name: /Remove/ })
      expect(removeButtons).toHaveLength(1)
      expect(screen.getByText('Birthday')).toBeInTheDocument()
    })

    it('preserves original casing of first occurrence', async () => {
      await setup()

      const keywordInput = screen.getByLabelText('Category keywords')
      const addButton = screen.getByRole('button', { name: 'Add' })

      await act(async () => {
        fireEvent.change(keywordInput, { target: { value: 'MyEvent, myevent, MYEVENT' } })
        fireEvent.click(addButton)
      })

      expect(screen.getByText('MyEvent')).toBeInTheDocument()
      expect(screen.queryByText('myevent')).not.toBeInTheDocument()
      expect(screen.queryByText('MYEVENT')).not.toBeInTheDocument()
    })

    it('dedupes across multiple add operations', async () => {
      await setup()

      const keywordInput = screen.getByLabelText('Category keywords')
      const addButton = screen.getByRole('button', { name: 'Add' })

      await act(async () => {
        fireEvent.change(keywordInput, { target: { value: 'first' } })
        fireEvent.click(addButton)
      })

      await act(async () => {
        fireEvent.change(keywordInput, { target: { value: 'FIRST, second' } })
        fireEvent.click(addButton)
      })

      const removeButtons = screen.getAllByRole('button', { name: /Remove/ })
      expect(removeButtons).toHaveLength(2)
      expect(screen.getByText('first')).toBeInTheDocument()
      expect(screen.getByText('second')).toBeInTheDocument()
    })
  })

  describe('Category CRUD operations', () => {
    describe('Adding a category', () => {
      it('adds a category with all fields', async () => {
        const onAddCategory = vi.fn().mockReturnValue({
          category: buildCategory('new-1', 'Holidays', ['christmas', 'easter'], '#FF0000'),
          error: null,
        })
        await setup({ onAddCategory })

        const nameInput = screen.getByLabelText('Category name')
        const colorInput = screen.getByLabelText('Category color')
        const keywordInput = screen.getByLabelText('Category keywords')

        await act(async () => {
          fireEvent.change(nameInput, { target: { value: 'Holidays' } })
          fireEvent.change(colorInput, { target: { value: '#FF0000' } })
        })

        // Add first keyword
        await act(async () => {
          fireEvent.change(keywordInput, { target: { value: 'christmas' } })
        })
        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Add' }))
        })

        // Add second keyword
        await act(async () => {
          fireEvent.change(keywordInput, { target: { value: 'easter' } })
        })
        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Add' }))
        })

        // Change match mode and save
        await act(async () => {
          fireEvent.change(screen.getByDisplayValue('Any word (OR)'), { target: { value: 'all' } })
        })
        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Add category' }))
        })

        expect(onAddCategory).toHaveBeenCalledWith({
          label: 'Holidays',
          color: '#ff0000', // Browser normalizes hex colors to lowercase
          keywords: ['christmas', 'easter'],
          matchMode: 'all',
        })
      })

      it('clears form after successful add', async () => {
        const onAddCategory = vi.fn().mockReturnValue({
          category: buildCategory('new-1', 'Test', ['keyword']),
          error: null,
        })
        await setup({ onAddCategory })

        const nameInput = screen.getByLabelText('Category name')
        const keywordInput = screen.getByLabelText('Category keywords')

        await act(async () => {
          fireEvent.change(nameInput, { target: { value: 'Test' } })
          fireEvent.change(keywordInput, { target: { value: 'keyword' } })
          fireEvent.click(screen.getByRole('button', { name: 'Add' }))
          fireEvent.click(screen.getByRole('button', { name: 'Add category' }))
        })

        expect(nameInput).toHaveValue('')
        expect(keywordInput).toHaveValue('')
        expect(screen.queryByText('keyword')).not.toBeInTheDocument()
      })

      it('includes pending keywords from input when saving', async () => {
        const onAddCategory = vi.fn().mockReturnValue({
          category: buildCategory('new-1', 'Test', ['existing', 'pending']),
          error: null,
        })
        await setup({ onAddCategory })

        const nameInput = screen.getByLabelText('Category name')
        const keywordInput = screen.getByLabelText('Category keywords')

        await act(async () => {
          fireEvent.change(nameInput, { target: { value: 'Test' } })
          fireEvent.change(keywordInput, { target: { value: 'existing' } })
          fireEvent.click(screen.getByRole('button', { name: 'Add' }))
        })

        // Type another keyword but don't click Add
        await act(async () => {
          fireEvent.change(keywordInput, { target: { value: 'pending' } })
          fireEvent.click(screen.getByRole('button', { name: 'Add category' }))
        })

        expect(onAddCategory).toHaveBeenCalledWith(
          expect.objectContaining({
            keywords: ['existing', 'pending'],
          })
        )
      })
    })

    describe('Editing a category', () => {
      it('populates form with category data when editing', async () => {
        const categories = [
          buildCategory('cat-1', 'Work', ['meeting', 'standup'], '#8B5CF6'),
        ]
        await setup({ categories })

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
        })

        expect(screen.getByLabelText('Category name')).toHaveValue('Work')
        expect(screen.getByLabelText('Category color')).toHaveValue('#8b5cf6')
        expect(screen.getByText('meeting')).toBeInTheDocument()
        expect(screen.getByText('standup')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: 'Edit category' })).toBeInTheDocument()
      })

      it('calls onUpdateCategory with correct payload', async () => {
        const categories = [buildCategory('cat-1', 'Work', ['meeting'], '#8B5CF6')]
        const onUpdateCategory = vi.fn().mockReturnValue({
          category: buildCategory('cat-1', 'Updated Work', ['meeting', 'call'], '#8B5CF6'),
          error: null,
        })
        await setup({ categories, onUpdateCategory })

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
        })

        const nameInput = screen.getByLabelText('Category name')
        const keywordInput = screen.getByLabelText('Category keywords')

        await act(async () => {
          fireEvent.change(nameInput, { target: { value: 'Updated Work' } })
          fireEvent.change(keywordInput, { target: { value: 'call' } })
          fireEvent.click(screen.getByRole('button', { name: 'Add' }))
          fireEvent.click(screen.getByRole('button', { name: 'Save category' }))
        })

        expect(onUpdateCategory).toHaveBeenCalledWith('cat-1', {
          label: 'Updated Work',
          color: '#8B5CF6',
          keywords: ['meeting', 'call'],
          matchMode: 'any',
        })
      })

      it('shows Cancel button when editing', async () => {
        const categories = [buildCategory('cat-1', 'Work', ['meeting'], '#8B5CF6')]
        await setup({ categories })

        expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
        })

        expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
      })

      it('resets form when Cancel is clicked', async () => {
        const categories = [buildCategory('cat-1', 'Work', ['meeting'], '#8B5CF6')]
        await setup({ categories })

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
        })

        const nameInput = screen.getByLabelText('Category name')
        expect(nameInput).toHaveValue('Work')

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
        })

        expect(nameInput).toHaveValue('')
        expect(screen.getByRole('heading', { name: 'Add category' })).toBeInTheDocument()
      })

      it('changes match mode from any to all', async () => {
        const categories = [buildCategory('cat-1', 'Work', ['meeting'], '#8B5CF6')]
        const onUpdateCategory = vi.fn().mockReturnValue({
          category: { ...categories[0], matchMode: 'all' },
          error: null,
        })
        await setup({ categories, onUpdateCategory })

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
        })

        await act(async () => {
          fireEvent.change(screen.getByDisplayValue('Any word (OR)'), { target: { value: 'all' } })
          fireEvent.click(screen.getByRole('button', { name: 'Save category' }))
        })

        expect(onUpdateCategory).toHaveBeenCalledWith('cat-1', expect.objectContaining({ matchMode: 'all' }))
      })
    })

    describe('Removing a category', () => {
      let confirmSpy: ReturnType<typeof vi.spyOn>

      beforeEach(() => {
        confirmSpy = vi.spyOn(window, 'confirm')
      })

      afterEach(() => {
        confirmSpy.mockRestore()
      })

      it('shows confirmation dialog for custom category', async () => {
        confirmSpy.mockReturnValue(true)
        const categories = [buildCategory('cat-1', 'Custom', ['test'], '#123456', false)]
        const onRemoveCategory = vi.fn()
        await setup({ categories, onRemoveCategory })

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
        })

        expect(confirmSpy).toHaveBeenCalledWith('Delete "Custom"? This cannot be undone.')
        expect(onRemoveCategory).toHaveBeenCalledWith('cat-1')
      })

      it('shows different confirmation for default category', async () => {
        confirmSpy.mockReturnValue(true)
        const categories = [buildCategory('cat-1', 'Birthdays', ['birthday'], '#F59E0B', true)]
        const onRemoveCategory = vi.fn()
        await setup({ categories, onRemoveCategory })

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
        })

        expect(confirmSpy).toHaveBeenCalledWith(
          'Remove "Birthdays"? You can restore it later from "Removed".'
        )
        expect(onRemoveCategory).toHaveBeenCalledWith('cat-1')
      })

      it('does not remove when confirmation is cancelled', async () => {
        confirmSpy.mockReturnValue(false)
        const categories = [buildCategory('cat-1', 'Test', ['test'], '#123456')]
        const onRemoveCategory = vi.fn()
        await setup({ categories, onRemoveCategory })

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
        })

        expect(onRemoveCategory).not.toHaveBeenCalled()
      })

      it('resets form if editing the removed category', async () => {
        confirmSpy.mockReturnValue(true)
        const categories = [buildCategory('cat-1', 'Test', ['test'], '#123456')]
        const onRemoveCategory = vi.fn()
        await setup({ categories, onRemoveCategory })

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
        })

        expect(screen.getByLabelText('Category name')).toHaveValue('Test')

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
        })

        expect(screen.getByLabelText('Category name')).toHaveValue('')
      })
    })

    describe('Restoring a default category', () => {
      it('calls onRestoreDefault with category id', async () => {
        const removedDefaults = [buildCategory('birthdays', 'Birthdays', ['birthday'], '#F59E0B', true)]
        const onRestoreDefault = vi.fn().mockReturnValue({
          category: removedDefaults[0],
          error: null,
        })
        await setup({ removedDefaults, onRestoreDefault })

        // Expand the Removed section
        await act(async () => {
          fireEvent.click(screen.getByText('Removed (1)'))
        })

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Restore' }))
        })

        expect(onRestoreDefault).toHaveBeenCalledWith('birthdays')
      })

      it('displays error from restore operation', async () => {
        const removedDefaults = [buildCategory('work', 'Work', ['meeting'], '#8B5CF6', true)]
        const onRestoreDefault = vi.fn().mockReturnValue({
          category: null,
          error: 'Failed to restore category',
        })
        await setup({ removedDefaults, onRestoreDefault })

        await act(async () => {
          fireEvent.click(screen.getByText('Removed (1)'))
        })

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Restore' }))
        })

        expect(screen.getByText('Failed to restore category')).toBeInTheDocument()
      })
    })

    describe('Reset to defaults', () => {
      let confirmSpy: ReturnType<typeof vi.spyOn>

      beforeEach(() => {
        confirmSpy = vi.spyOn(window, 'confirm')
      })

      afterEach(() => {
        confirmSpy.mockRestore()
      })

      it('shows confirmation dialog before resetting', async () => {
        confirmSpy.mockReturnValue(true)
        const onResetToDefaults = vi.fn()
        await setup({ onResetToDefaults })

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }))
        })

        expect(confirmSpy).toHaveBeenCalledWith(
          'Reset all categories to defaults? Your custom categories will be removed.'
        )
        expect(onResetToDefaults).toHaveBeenCalled()
      })

      it('does not reset when confirmation is cancelled', async () => {
        confirmSpy.mockReturnValue(false)
        const onResetToDefaults = vi.fn()
        await setup({ onResetToDefaults })

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }))
        })

        expect(onResetToDefaults).not.toHaveBeenCalled()
      })

      it('clears form when resetting', async () => {
        confirmSpy.mockReturnValue(true)
        const categories = [buildCategory('cat-1', 'Test', ['test'], '#123456')]
        const onResetToDefaults = vi.fn()
        await setup({ categories, onResetToDefaults })

        // Start editing
        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
        })

        expect(screen.getByLabelText('Category name')).toHaveValue('Test')

        await act(async () => {
          fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }))
        })

        expect(screen.getByLabelText('Category name')).toHaveValue('')
      })
    })
  })

  describe('Form state management', () => {
    it('clears error when name input changes', async () => {
      const onAddCategory = vi.fn().mockReturnValue({
        category: null,
        error: 'Name is required',
      })
      await setup({ onAddCategory })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Add category' }))
      })

      expect(screen.getByText('Name is required')).toBeInTheDocument()

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Category name'), { target: { value: 'Test' } })
      })

      expect(screen.queryByText('Name is required')).not.toBeInTheDocument()
    })

    it('clears error when color input changes', async () => {
      const onAddCategory = vi.fn().mockReturnValue({
        category: null,
        error: 'Some error',
      })
      await setup({ onAddCategory })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Add category' }))
      })

      expect(screen.getByText('Some error')).toBeInTheDocument()

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Category color'), { target: { value: '#FF0000' } })
      })

      expect(screen.queryByText('Some error')).not.toBeInTheDocument()
    })

    it('clears error when match mode changes', async () => {
      const onAddCategory = vi.fn().mockReturnValue({
        category: null,
        error: 'Some error',
      })
      await setup({ onAddCategory })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Add category' }))
      })

      expect(screen.getByText('Some error')).toBeInTheDocument()

      await act(async () => {
        fireEvent.change(screen.getByDisplayValue('Any word (OR)'), { target: { value: 'all' } })
      })

      expect(screen.queryByText('Some error')).not.toBeInTheDocument()
    })

    it('clears error when keywords are added', async () => {
      const onAddCategory = vi.fn().mockReturnValue({
        category: null,
        error: 'Keywords required',
      })
      await setup({ onAddCategory })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Add category' }))
      })

      expect(screen.getByText('Keywords required')).toBeInTheDocument()

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Category keywords'), { target: { value: 'test' } })
        fireEvent.click(screen.getByRole('button', { name: 'Add' }))
      })

      expect(screen.queryByText('Keywords required')).not.toBeInTheDocument()
    })

    it('removes individual keywords', async () => {
      await setup()

      const keywordInput = screen.getByLabelText('Category keywords')

      await act(async () => {
        fireEvent.change(keywordInput, { target: { value: 'one, two, three' } })
        fireEvent.click(screen.getByRole('button', { name: 'Add' }))
      })

      expect(screen.getByText('one')).toBeInTheDocument()
      expect(screen.getByText('two')).toBeInTheDocument()
      expect(screen.getByText('three')).toBeInTheDocument()

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Remove two' }))
      })

      expect(screen.getByText('one')).toBeInTheDocument()
      expect(screen.queryByText('two')).not.toBeInTheDocument()
      expect(screen.getByText('three')).toBeInTheDocument()
    })
  })

  describe('Disclosure panel for removed defaults', () => {
    it('shows removed defaults count', async () => {
      const removedDefaults = [
        buildCategory('work', 'Work', ['meeting'], '#8B5CF6', true),
        buildCategory('birthdays', 'Birthdays', ['birthday'], '#F59E0B', true),
      ]
      await setup({ removedDefaults })

      expect(screen.getByText('Removed (2)')).toBeInTheDocument()
    })

    it('does not show removed section when empty', async () => {
      await setup({ removedDefaults: [] })

      expect(screen.queryByText(/Removed/)).not.toBeInTheDocument()
    })

    it('expands and collapses removed defaults list', async () => {
      const removedDefaults = [buildCategory('work', 'Work', ['meeting'], '#8B5CF6', true)]
      await setup({ removedDefaults })

      // Initially collapsed
      expect(screen.queryByText('Work')).not.toBeInTheDocument()

      // Expand
      await act(async () => {
        fireEvent.click(screen.getByText('Removed (1)'))
      })
      expect(screen.getByText('Work')).toBeInTheDocument()

      // Collapse
      await act(async () => {
        fireEvent.click(screen.getByText('Removed (1)'))
      })
      expect(screen.queryByText('Work')).not.toBeInTheDocument()
    })

    it('shows category color in removed list', async () => {
      const removedDefaults = [buildCategory('work', 'Work', ['meeting'], '#8B5CF6', true)]
      await setup({ removedDefaults })

      await act(async () => {
        fireEvent.click(screen.getByText('Removed (1)'))
      })

      const listItem = screen.getByText('Work').closest('li')
      const colorSwatch = listItem?.querySelector('span[style]')
      expect(colorSwatch).toHaveStyle({ backgroundColor: '#8B5CF6' })
    })
  })

  describe('Empty category list message', () => {
    it('shows empty state when no categories exist', async () => {
      await setup({ categories: [] })

      expect(
        screen.getByText('No categories yet. Add one below or reset to defaults.')
      ).toBeInTheDocument()
    })

    it('does not show empty state when categories exist', async () => {
      const categories = [buildCategory('cat-1', 'Test', ['test'], '#123456')]
      await setup({ categories })

      expect(
        screen.queryByText('No categories yet. Add one below or reset to defaults.')
      ).not.toBeInTheDocument()
    })
  })

  describe('Keyword add via Enter key', () => {
    it('adds keywords when Enter is pressed', async () => {
      await setup()

      const keywordInput = screen.getByLabelText('Category keywords')

      await act(async () => {
        fireEvent.change(keywordInput, { target: { value: 'enter-test' } })
        fireEvent.keyDown(keywordInput, { key: 'Enter' })
      })

      expect(screen.getByText('enter-test')).toBeInTheDocument()
      expect(keywordInput).toHaveValue('')
    })

    it('prevents form submission when pressing Enter', async () => {
      const onAddCategory = vi.fn().mockReturnValue({ category: null, error: null })
      await setup({ onAddCategory })

      const keywordInput = screen.getByLabelText('Category keywords')

      await act(async () => {
        fireEvent.change(keywordInput, { target: { value: 'keyword' } })
        fireEvent.keyDown(keywordInput, { key: 'Enter' })
      })

      // Category should not be added, only keyword
      expect(onAddCategory).not.toHaveBeenCalled()
      expect(screen.getByText('keyword')).toBeInTheDocument()
    })

    it('does not add empty keywords via Enter', async () => {
      await setup()

      const keywordInput = screen.getByLabelText('Category keywords')

      await act(async () => {
        fireEvent.change(keywordInput, { target: { value: '' } })
        fireEvent.keyDown(keywordInput, { key: 'Enter' })
      })

      expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
    })

    it('does not trigger on other keys', async () => {
      await setup()

      const keywordInput = screen.getByLabelText('Category keywords')

      await act(async () => {
        fireEvent.change(keywordInput, { target: { value: 'test' } })
        fireEvent.keyDown(keywordInput, { key: 'Tab' })
      })

      // Keyword should not be added
      expect(screen.queryByText('test')).not.toBeInTheDocument()
      expect(keywordInput).toHaveValue('test')
    })
  })

  describe('Error display', () => {
    it('displays error from add operation', async () => {
      const onAddCategory = vi.fn().mockReturnValue({
        category: null,
        error: 'Category name already exists',
      })
      await setup({ onAddCategory })

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Category name'), { target: { value: 'Duplicate' } })
        fireEvent.click(screen.getByRole('button', { name: 'Add category' }))
      })

      expect(screen.getByText('Category name already exists')).toBeInTheDocument()
    })

    it('displays error from update operation', async () => {
      const categories = [buildCategory('cat-1', 'Test', ['test'], '#123456')]
      const onUpdateCategory = vi.fn().mockReturnValue({
        category: null,
        error: 'Update failed',
      })
      await setup({ categories, onUpdateCategory })

      // Click Edit first to enter edit mode
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
      })

      // Now click Save category (which appears after entering edit mode)
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Save category' }))
      })

      expect(screen.getByText('Update failed')).toBeInTheDocument()
    })

    it('keeps form populated when save fails', async () => {
      const onAddCategory = vi.fn().mockReturnValue({
        category: null,
        error: 'Validation error',
      })
      await setup({ onAddCategory })

      await act(async () => {
        fireEvent.change(screen.getByLabelText('Category name'), { target: { value: 'My Category' } })
        fireEvent.change(screen.getByLabelText('Category keywords'), { target: { value: 'keyword' } })
        fireEvent.click(screen.getByRole('button', { name: 'Add' }))
        fireEvent.click(screen.getByRole('button', { name: 'Add category' }))
      })

      // Form should still have the values
      expect(screen.getByLabelText('Category name')).toHaveValue('My Category')
      expect(screen.getByText('keyword')).toBeInTheDocument()
    })
  })

  describe('Category list sorting', () => {
    it('sorts categories alphabetically by label', async () => {
      const categories = [
        buildCategory('c', 'Zebra', ['z'], '#000'),
        buildCategory('a', 'Alpha', ['a'], '#111'),
        buildCategory('b', 'Middle', ['m'], '#222'),
      ]
      await setup({ categories })

      const categoryLabels = screen.getAllByText(/Alpha|Middle|Zebra/)
      expect(categoryLabels[0]).toHaveTextContent('Alpha')
      expect(categoryLabels[1]).toHaveTextContent('Middle')
      expect(categoryLabels[2]).toHaveTextContent('Zebra')
    })

    it('sorts case-insensitively', async () => {
      const categories = [
        buildCategory('a', 'zebra', ['z'], '#000'),
        buildCategory('b', 'Alpha', ['a'], '#111'),
      ]
      await setup({ categories })

      const categoryLabels = screen.getAllByText(/Alpha|zebra/)
      expect(categoryLabels[0]).toHaveTextContent('Alpha')
      expect(categoryLabels[1]).toHaveTextContent('zebra')
    })
  })

  describe('Category display', () => {
    it('shows Default badge for default categories', async () => {
      const categories = [buildCategory('cat-1', 'Birthdays', ['birthday'], '#F59E0B', true)]
      await setup({ categories })

      expect(screen.getByText('Default')).toBeInTheDocument()
    })

    it('does not show Default badge for custom categories', async () => {
      const categories = [buildCategory('cat-1', 'Custom', ['custom'], '#123456', false)]
      await setup({ categories })

      expect(screen.queryByText('Default')).not.toBeInTheDocument()
    })

    it('displays category keywords as comma-separated list', async () => {
      const categories = [buildCategory('cat-1', 'Test', ['one', 'two', 'three'], '#123456')]
      await setup({ categories })

      expect(screen.getByText('one, two, three')).toBeInTheDocument()
    })

    it('displays category color swatch', async () => {
      const categories = [buildCategory('cat-1', 'Test', ['test'], '#FF5733')]
      await setup({ categories })

      const listItem = screen.getByText('Test').closest('li')
      const colorSwatch = listItem?.querySelector('span[style]')
      expect(colorSwatch).toHaveStyle({ backgroundColor: '#FF5733' })
    })
  })

  describe('Handling window.confirm absence', () => {
    it('proceeds with removal when window.confirm is undefined', async () => {
      const originalConfirm = window.confirm
      // @ts-expect-error - testing edge case
      delete window.confirm

      const categories = [buildCategory('cat-1', 'Test', ['test'], '#123456')]
      const onRemoveCategory = vi.fn()
      await setup({ categories, onRemoveCategory })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
      })

      expect(onRemoveCategory).toHaveBeenCalledWith('cat-1')

      window.confirm = originalConfirm
    })

    it('proceeds with reset when window.confirm is undefined', async () => {
      const originalConfirm = window.confirm
      // @ts-expect-error - testing edge case
      delete window.confirm

      const onResetToDefaults = vi.fn()
      await setup({ onResetToDefaults })

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Reset to defaults' }))
      })

      expect(onResetToDefaults).toHaveBeenCalled()

      window.confirm = originalConfirm
    })
  })
})
