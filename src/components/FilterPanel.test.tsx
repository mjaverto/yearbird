import type { ComponentProps } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { EventFilter } from '../services/filters'
import type { CustomCategory } from '../types/categories'
import { FilterPanel } from './FilterPanel'

type FilterPanelProps = ComponentProps<typeof FilterPanel>

const setup = async (overrides: Partial<FilterPanelProps> = {}) => {
  const props: FilterPanelProps = {
    filters: [],
    builtInCategories: [],
    disabledBuiltInCategories: [],
    onAddFilter: vi.fn(),
    onRemoveFilter: vi.fn(),
    onDisableBuiltInCategory: vi.fn(),
    onEnableBuiltInCategory: vi.fn(),
    calendars: [],
    disabledCalendars: [],
    onDisableCalendar: vi.fn(),
    onEnableCalendar: vi.fn(),
    isCalendarsLoading: false,
    calendarError: null,
    onRetryCalendars: vi.fn(),
    customCategories: [],
    onAddCustomCategory: vi.fn().mockReturnValue({ category: null, error: null }),
    onUpdateCustomCategory: vi.fn().mockReturnValue({ category: null, error: null }),
    onRemoveCustomCategory: vi.fn(),
    isOpen: true,
    onClose: vi.fn(),
    ...overrides,
  }

  await act(async () => {
    render(<FilterPanel {...props} />)
  })

  return { props }
}

describe('FilterPanel', () => {
  it('shows empty state and adds filters', async () => {
    const { props } = await setup()

    expect(
      screen.getByText('No hidden events yet. Add a title to filter your calendar.')
    ).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByText('Hide'))
    })
    expect(props.onAddFilter).not.toHaveBeenCalled()

    const input = screen.getByLabelText('Event name to hide')
    await act(async () => {
      fireEvent.change(input, {
        target: { value: '  Rent ' },
      })
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    expect(props.onAddFilter).toHaveBeenCalledWith('Rent')
  })

  it('renders filters and removes entries', async () => {
    const filters: EventFilter[] = [
      { id: '1', pattern: 'Rent', createdAt: 1 },
      { id: '2', pattern: 'Sync', createdAt: 2 },
    ]

    const { props } = await setup({ filters })

    expect(screen.getAllByText('Rent')).toHaveLength(1)
    expect(screen.getByText('Sync')).toBeInTheDocument()

    const removeButtons = screen.getAllByText('Remove')
    await act(async () => {
      fireEvent.click(removeButtons[0]!)
    })
    expect(props.onRemoveFilter).toHaveBeenCalledWith('1')

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Close filters'))
    })
    expect(props.onClose).toHaveBeenCalled()
  })



  it('shows empty calendar list state', async () => {
    await setup()

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Calendars' }))
    })

    expect(screen.getByText('No calendars found for this account.')).toBeInTheDocument()
  })

  it('shows when all calendars are hidden', async () => {
    const calendars = [
      { id: 'primary', summary: 'Personal', primary: true, accessRole: 'owner' },
      { id: 'team@example.com', summary: 'Team', accessRole: 'reader' },
    ]

    await setup({ calendars, disabledCalendars: ['primary', 'team@example.com'] })

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Calendars' }))
    })

    expect(screen.getByText('No calendars selected. Enable at least one to show events.')).toBeInTheDocument()
  })
  it('shows calendar loading state', async () => {
    await setup({ isCalendarsLoading: true })

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Calendars' }))
    })

    expect(screen.getByText('Loading calendars...')).toBeInTheDocument()
  })

  it('shows calendar error state and retries', async () => {
    const onRetryCalendars = vi.fn()
    await setup({ calendarError: 'NOPE', onRetryCalendars })

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Calendars' }))
    })

    expect(screen.getByText('Calendar list unavailable (NOPE).')).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByText('Try again'))
    })
    expect(onRetryCalendars).toHaveBeenCalled()
  })
  it('renders calendar toggles and fires handlers', async () => {
    const calendars = [
      { id: 'primary', summary: 'Personal', primary: true, accessRole: 'owner' },
      { id: 'team@example.com', summary: 'Team', accessRole: 'reader' },
    ]
    const onDisableCalendar = vi.fn()
    await setup({ calendars, onDisableCalendar })

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Calendars' }))
    })

    const panel = screen.getByRole('tabpanel', { name: 'Calendars' })
    expect(within(panel).getByText('Personal')).toBeInTheDocument()

    await act(async () => {
      const hideButtons = within(panel).getAllByRole('button', { name: 'Hide' })
      fireEvent.click(hideButtons[0]!)
    })
    expect(onDisableCalendar).toHaveBeenCalledWith('primary')
  })

  it('creates custom categories and clears the form on success', async () => {
    const onAddCustomCategory = vi.fn().mockReturnValue({
      category: {
        id: 'custom-1',
        label: 'Trips',
        color: '#123456',
        keywords: ['flight'],
        matchMode: 'any',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      error: null,
    })
    await setup({ onAddCustomCategory })

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Categories' }))
    })

    const nameInput = screen.getByLabelText('Custom category name')
    const keywordInput = screen.getByLabelText('Custom category keywords')

    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Trips' } })
      fireEvent.change(keywordInput, { target: { value: 'flight' } })
      fireEvent.click(screen.getByText('Add'))
      fireEvent.click(screen.getByText('Add category'))
    })

    expect(onAddCustomCategory).toHaveBeenCalledWith({
      label: 'Trips',
      color: '#3B82F6',
      keywords: ['flight'],
      matchMode: 'any',
    })
    expect(nameInput).toHaveValue('')
  })

  it('edits and deletes existing custom categories', async () => {
    const onUpdateCustomCategory = vi.fn().mockReturnValue({
      category: {
        id: 'custom-1',
        label: 'Big Trips',
        color: '#123456',
        keywords: ['flight'],
        matchMode: 'all',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      error: null,
    })
    const onRemoveCustomCategory = vi.fn()
    const customCategories: CustomCategory[] = [
      {
        id: 'custom-1',
        label: 'Trips',
        color: '#123456',
        keywords: ['flight'],
        matchMode: 'any',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ]

    await setup({
      customCategories,
      onUpdateCustomCategory,
      onRemoveCustomCategory,
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Categories' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByText('Edit'))
    })

    const nameInput = screen.getByLabelText('Custom category name')
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Big Trips' } })
      fireEvent.change(screen.getByLabelText('Custom category keywords'), {
        target: { value: 'family' },
      })
      fireEvent.click(screen.getByText('Add'))
      fireEvent.change(screen.getByDisplayValue('Any word (OR)'), {
        target: { value: 'all' },
      })
      fireEvent.click(screen.getByText('Save category'))
    })

    expect(onUpdateCustomCategory).toHaveBeenCalledWith('custom-1', {
      label: 'Big Trips',
      color: '#123456',
      keywords: ['flight', 'family'],
      matchMode: 'all',
    })

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await act(async () => {
      fireEvent.click(screen.getByText('Delete'))
    })
    confirmSpy.mockRestore()

    expect(onRemoveCustomCategory).toHaveBeenCalledWith('custom-1')
  })

  it('surfaces custom category errors', async () => {
    const onAddCustomCategory = vi.fn().mockReturnValue({
      category: null,
      error: 'Name is required.',
    })
    await setup({ onAddCustomCategory })

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Categories' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByText('Add category'))
    })

    expect(screen.getByText('Name is required.')).toBeInTheDocument()
  })

  it('supports keyboard navigation between tabs', async () => {
    await setup()

    const tablist = screen.getByRole('tablist', { name: 'Filter sections' })
    const hiddenTab = screen.getByRole('tab', { name: 'Hidden events' })
    const calendarsTab = screen.getByRole('tab', { name: 'Calendars' })
    const categoriesTab = screen.getByRole('tab', { name: 'Categories' })

    expect(hiddenTab).toHaveAttribute('aria-selected', 'true')

    await act(async () => {
      fireEvent.keyDown(tablist, { key: 'ArrowRight' })
    })
    expect(calendarsTab).toHaveAttribute('aria-selected', 'true')

    await act(async () => {
      fireEvent.keyDown(tablist, { key: 'ArrowRight' })
    })
    expect(categoriesTab).toHaveAttribute('aria-selected', 'true')

    await act(async () => {
      fireEvent.keyDown(tablist, { key: 'ArrowLeft' })
    })
    expect(calendarsTab).toHaveAttribute('aria-selected', 'true')

    await act(async () => {
      fireEvent.keyDown(tablist, { key: 'End' })
    })
    expect(categoriesTab).toHaveAttribute('aria-selected', 'true')

    await act(async () => {
      fireEvent.keyDown(tablist, { key: 'Home' })
    })
    expect(hiddenTab).toHaveAttribute('aria-selected', 'true')
  })

  it('preserves custom category form state across tabs', async () => {
    await setup()

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Categories' }))
    })

    const nameInput = screen.getByLabelText('Custom category name')
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Trips' } })
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Hidden events' }))
      fireEvent.click(screen.getByRole('tab', { name: 'Categories' }))
    })

    expect(screen.getByLabelText('Custom category name')).toHaveValue('Trips')
  })
})
