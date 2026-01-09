import type { ComponentProps } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { EventFilter } from '../services/filters'
import type { Category } from '../types/categories'
import { FilterPanel } from './FilterPanel'

type FilterPanelProps = ComponentProps<typeof FilterPanel>

// Build test categories
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

const setup = async (overrides: Partial<FilterPanelProps> = {}) => {
  const props: FilterPanelProps = {
    filters: [],
    categories: [],
    removedDefaults: [],
    onAddFilter: vi.fn(),
    onRemoveFilter: vi.fn(),
    onAddCategory: vi.fn().mockReturnValue({ category: null, error: null }),
    onUpdateCategory: vi.fn().mockReturnValue({ category: null, error: null }),
    onRemoveCategory: vi.fn(),
    onRestoreDefault: vi.fn().mockReturnValue({ category: null, error: null }),
    onResetToDefaults: vi.fn(),
    calendars: [],
    disabledCalendars: [],
    onDisableCalendar: vi.fn(),
    onEnableCalendar: vi.fn(),
    isCalendarsLoading: false,
    calendarError: null,
    onRetryCalendars: vi.fn(),
    isOpen: true,
    onClose: vi.fn(),
    showTimedEvents: false,
    onSetShowTimedEvents: vi.fn(),
    matchDescription: false,
    onSetMatchDescription: vi.fn(),
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

  it('creates categories and clears the form on success', async () => {
    const onAddCategory = vi.fn().mockReturnValue({
      category: buildCategory('custom-1', 'Trips', ['flight'], '#123456'),
      error: null,
    })
    await setup({ onAddCategory })

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Categories' }))
    })

    const nameInput = screen.getByLabelText('Category name')
    const keywordInput = screen.getByLabelText('Category keywords')

    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Trips' } })
      fireEvent.change(keywordInput, { target: { value: 'flight' } })
      fireEvent.click(screen.getByText('Add'))
      fireEvent.click(screen.getByRole('button', { name: 'Add category' }))
    })

    expect(onAddCategory).toHaveBeenCalledWith({
      label: 'Trips',
      color: '#3B82F6',
      keywords: ['flight'],
      matchMode: 'any',
    })
    expect(nameInput).toHaveValue('')
  })

  it('edits and removes existing categories', async () => {
    const onUpdateCategory = vi.fn().mockReturnValue({
      category: buildCategory('custom-1', 'Big Trips', ['flight', 'family'], '#123456'),
      error: null,
    })
    const onRemoveCategory = vi.fn()
    const categories: Category[] = [
      buildCategory('custom-1', 'Trips', ['flight'], '#123456'),
    ]

    await setup({
      categories,
      onUpdateCategory,
      onRemoveCategory,
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Categories' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByText('Edit'))
    })

    const nameInput = screen.getByLabelText('Category name')
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Big Trips' } })
      fireEvent.change(screen.getByLabelText('Category keywords'), {
        target: { value: 'family' },
      })
      fireEvent.click(screen.getByText('Add'))
      fireEvent.change(screen.getByDisplayValue('Any word (OR)'), {
        target: { value: 'all' },
      })
      fireEvent.click(screen.getByText('Save category'))
    })

    expect(onUpdateCategory).toHaveBeenCalledWith('custom-1', {
      label: 'Big Trips',
      color: '#123456',
      keywords: ['flight', 'family'],
      matchMode: 'all',
    })

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await act(async () => {
      // Click the Remove button for the category (not the filter Remove)
      const removeButtons = screen.getAllByRole('button', { name: 'Remove' })
      fireEvent.click(removeButtons[removeButtons.length - 1]!)
    })
    confirmSpy.mockRestore()

    expect(onRemoveCategory).toHaveBeenCalledWith('custom-1')
  })

  it('surfaces category errors', async () => {
    const onAddCategory = vi.fn().mockReturnValue({
      category: null,
      error: 'Name is required.',
    })
    await setup({ onAddCategory })

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Categories' }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Add category' }))
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

  it('preserves category form state across tabs', async () => {
    await setup()

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Categories' }))
    })

    const nameInput = screen.getByLabelText('Category name')
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Trips' } })
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Hidden events' }))
      fireEvent.click(screen.getByRole('tab', { name: 'Categories' }))
    })

    expect(screen.getByLabelText('Category name')).toHaveValue('Trips')
  })

  it('displays keywords for categories', async () => {
    const categories = [
      buildCategory('birthdays', 'Birthdays', ['birthday', 'bday'], '#F59E0B', true),
    ]
    await setup({ categories })

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Categories' }))
    })

    expect(screen.getByText('birthday, bday')).toBeInTheDocument()
  })

  it('shows removed defaults in a collapsible section and restores them', async () => {
    const categories = [
      buildCategory('birthdays', 'Birthdays', ['birthday'], '#F59E0B', true),
    ]
    const removedDefaults = [
      buildCategory('work', 'Work', ['meeting'], '#8B5CF6', true),
    ]
    const onRestoreDefault = vi.fn().mockReturnValue({
      category: buildCategory('work', 'Work', ['meeting'], '#8B5CF6', true),
      error: null,
    })
    await setup({
      categories,
      removedDefaults,
      onRestoreDefault,
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Categories' }))
    })

    // Active category is visible
    expect(screen.getByText('Birthdays')).toBeInTheDocument()

    // Removed section is collapsed by default
    expect(screen.getByText('Removed (1)')).toBeInTheDocument()
    expect(screen.queryByText('Work')).not.toBeInTheDocument()

    // Expand the Removed section
    await act(async () => {
      fireEvent.click(screen.getByText('Removed (1)'))
    })

    expect(screen.getByText('Work')).toBeInTheDocument()
    expect(screen.getByText('Restore')).toBeInTheDocument()

    // Click Restore
    await act(async () => {
      fireEvent.click(screen.getByText('Restore'))
    })
    expect(onRestoreDefault).toHaveBeenCalledWith('work')
  })

  describe('Display Settings', () => {
    it('renders display settings section with both toggles', async () => {
      // Use showTimedEvents: true to avoid duplicate text (label + sr-only enabledLabel)
      await setup({ showTimedEvents: true })

      expect(screen.getByText('Display Settings')).toBeInTheDocument()
      expect(screen.getByText('Show timed events')).toBeInTheDocument()
      expect(screen.getByText('Match descriptions')).toBeInTheDocument()
    })

    it('calls onSetShowTimedEvents when timed events toggle is clicked', async () => {
      const onSetShowTimedEvents = vi.fn()
      // Use showTimedEvents: true so sr-only text is "Hide timed events" (unique)
      await setup({ showTimedEvents: true, onSetShowTimedEvents })

      const switches = screen.getAllByRole('switch')
      const timedEventsSwitch = switches.find(
        (s) => s.textContent?.includes('timed events')
      )

      await act(async () => {
        fireEvent.click(timedEventsSwitch!)
      })

      expect(onSetShowTimedEvents).toHaveBeenCalledWith(false)
    })

    it('calls onSetMatchDescription when match descriptions toggle is clicked', async () => {
      const onSetMatchDescription = vi.fn()
      await setup({ matchDescription: false, onSetMatchDescription })

      const switches = screen.getAllByRole('switch')
      const matchDescSwitch = switches.find(
        (s) => s.textContent?.includes('description matching')
      )

      await act(async () => {
        fireEvent.click(matchDescSwitch!)
      })

      expect(onSetMatchDescription).toHaveBeenCalledWith(true)
    })

    it('shows correct toggle states based on props', async () => {
      await setup({ showTimedEvents: true, matchDescription: true })

      const switches = screen.getAllByRole('switch')
      // Display settings switches should be checked (CloudSyncToggle state varies)
      const checkedCount = switches.filter((s) => s.getAttribute('aria-checked') === 'true').length
      expect(checkedCount).toBeGreaterThanOrEqual(2)
    })

    it('shows unchecked states when settings are disabled', async () => {
      await setup({ showTimedEvents: false, matchDescription: false })

      const switches = screen.getAllByRole('switch')
      // Find switches by their sr-only text content
      const timedEventsSwitch = switches.find((s) => s.textContent?.includes('timed events'))
      const descriptionSwitch = switches.find((s) => s.textContent?.includes('description'))

      expect(timedEventsSwitch).toHaveAttribute('aria-checked', 'false')
      expect(descriptionSwitch).toHaveAttribute('aria-checked', 'false')
    })
  })
})
