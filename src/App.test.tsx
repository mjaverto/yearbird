import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import App from './App'
import { useCalendarEvents } from './hooks/useCalendarEvents'
import { useCalendarList } from './hooks/useCalendarList'
import { useCalendarVisibility } from './hooks/useCalendarVisibility'
import { useCategories } from './hooks/useCategories'
import { useAuth } from './hooks/useAuth'
import { useFilters } from './hooks/useFilters'
import { DEFAULT_CATEGORIES } from './config/categories'
import type { Category } from './types/categories'
import type { EventCategory } from './types/calendar'

vi.mock('./hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))
vi.mock('./hooks/useCalendarEvents', () => ({
  useCalendarEvents: vi.fn(),
}))
vi.mock('./hooks/useCalendarList', () => ({
  useCalendarList: vi.fn(),
}))
vi.mock('./hooks/useCalendarVisibility', () => ({
  useCalendarVisibility: vi.fn(),
}))
vi.mock('./hooks/useCategories', () => ({
  useCategories: vi.fn(),
}))
vi.mock('./hooks/useFilters', () => ({
  useFilters: vi.fn(),
}))

// Mock displaySettings - use actual module with spyable functions
vi.mock('./services/displaySettings', () => ({
  getTimedEventMinHours: vi.fn(() => 3),
  setTimedEventMinHours: vi.fn(),
  getMatchDescription: vi.fn(() => false),
  setMatchDescription: vi.fn(),
  getWeekViewEnabled: vi.fn(() => false),
  setWeekViewEnabled: vi.fn(),
  getMonthScrollEnabled: vi.fn(() => false),
  setMonthScrollEnabled: vi.fn(),
  getMonthScrollDensity: vi.fn(() => 60),
  setMonthScrollDensity: vi.fn(),
}))

const useAuthMock = vi.mocked(useAuth)
const useCalendarEventsMock = vi.mocked(useCalendarEvents)
const useCalendarListMock = vi.mocked(useCalendarList)
const useCalendarVisibilityMock = vi.mocked(useCalendarVisibility)
const useCategoriesMock = vi.mocked(useCategories)
const useFiltersMock = vi.mocked(useFilters)

// Build default categories for mocking
const buildDefaultCategories = (): Category[] => {
  const now = Date.now()
  return DEFAULT_CATEGORIES.map((cat) => ({
    ...cat,
    createdAt: now,
    updatedAt: now,
  }))
}

const TEST_YEAR = 2026

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

const buildEvent = (id: string, title: string, category: EventCategory = 'uncategorized') => {
  return {
    id,
    title,
    startDate: `${TEST_YEAR}-02-10`,
    endDate: `${TEST_YEAR}-02-12`,
    isAllDay: true,
    isMultiDay: true,
    durationDays: 3,
    googleLink: '',
    category,
    color: '#9CA3AF',
  }
}

const setupAuthenticatedEvents = (events: ReturnType<typeof buildEvent>[]) => {
  useAuthMock.mockReturnValue({
    isAuthenticated: true,
    isReady: true,
    authNotice: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    user: null,
    accessToken: 'token',
    expiresAt: Date.now() + 60_000,
  })
  useCalendarEventsMock.mockReturnValue({
    events,
    isLoading: false,
    error: null,
    lastUpdated: null,
    isFromCache: false,
    refetch: vi.fn(),
  })
  useFiltersMock.mockReturnValue({
    filters: [],
    addFilter: vi.fn(),
    removeFilter: vi.fn(),
    filterEvents: (eventList) => eventList,
  })
}

beforeEach(() => {
  useAuthMock.mockReset()
  useCalendarEventsMock.mockReset()
  useCalendarListMock.mockReset()
  useCalendarVisibilityMock.mockReset()
  useCategoriesMock.mockReset()
  useFiltersMock.mockReset()
  localStorage.clear()
  useCategoriesMock.mockReturnValue({
    categories: buildDefaultCategories(),
    allCategories: buildDefaultCategories(),
    removedDefaults: [],
    addCategory: vi.fn(),
    updateCategory: vi.fn(),
    removeCategory: vi.fn(),
    restoreDefault: vi.fn(),
    resetToDefaults: vi.fn(),
  })
  useCalendarListMock.mockReturnValue({
    calendars: [{ id: 'primary', summary: 'Test Calendar', primary: true }],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })
  useCalendarVisibilityMock.mockReturnValue({
    disabledCalendarIds: [],
    visibleCalendarIds: [],
    disableCalendar: vi.fn(),
    enableCalendar: vi.fn(),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('renders the landing page when signed out', async () => {
  useAuthMock.mockReturnValue({
    isAuthenticated: false,
    isReady: true,
    authNotice: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    user: null,
    accessToken: null,
    expiresAt: null,
  })
  useCalendarEventsMock.mockReturnValue({
    events: [],
    isLoading: false,
    error: null,
    lastUpdated: null,
    isFromCache: false,
    refetch: vi.fn(),
  })
  useFiltersMock.mockReturnValue({
    filters: [],
    addFilter: vi.fn(),
    removeFilter: vi.fn(),
    filterEvents: (events) => events,
  })

  render(<App />)

  // Multiple sign-in buttons may exist (hero + mid-page CTA)
  const signInButtons = await screen.findAllByRole('button', { name: /sign in with google/i })
  expect(signInButtons.length).toBeGreaterThanOrEqual(1)
  expect(screen.getByText('Yearbird')).toBeInTheDocument()
})

test('renders the authenticated layout when signed in', async () => {
  useAuthMock.mockReturnValue({
    isAuthenticated: true,
    isReady: true,
    authNotice: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    user: null,
    accessToken: 'token',
    expiresAt: Date.now() + 60_000,
  })
  useCalendarEventsMock.mockReturnValue({
    events: [],
    isLoading: false,
    error: null,
    lastUpdated: null,
    isFromCache: false,
    refetch: vi.fn(),
  })
  useFiltersMock.mockReturnValue({
    filters: [],
    addFilter: vi.fn(),
    removeFilter: vi.fn(),
    filterEvents: (events) => events,
  })

  render(<App />)

  expect(await screen.findByText('Jan')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /open settings menu/i })).toBeInTheDocument()
})

test('shows the loading spinner while auth initializes', () => {
  useAuthMock.mockReturnValue({
    isAuthenticated: false,
    isReady: false,
    authNotice: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    user: null,
    accessToken: null,
    expiresAt: null,
  })
  useCalendarEventsMock.mockReturnValue({
    events: [],
    isLoading: false,
    error: null,
    lastUpdated: null,
    isFromCache: false,
    refetch: vi.fn(),
  })
  useFiltersMock.mockReturnValue({
    filters: [],
    addFilter: vi.fn(),
    removeFilter: vi.fn(),
    filterEvents: (events) => events,
  })

  render(<App />)

  expect(screen.getByText('Loading your year')).toBeInTheDocument()
})

test('shows calendar errors in the header', async () => {
  useAuthMock.mockReturnValue({
    isAuthenticated: true,
    isReady: true,
    authNotice: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    user: null,
    accessToken: 'token',
    expiresAt: Date.now() + 60_000,
  })
  useCalendarEventsMock.mockReturnValue({
    events: [],
    isLoading: false,
    error: 'Fetch failed',
    lastUpdated: null,
    isFromCache: false,
    refetch: vi.fn(),
  })
  useFiltersMock.mockReturnValue({
    filters: [],
    addFilter: vi.fn(),
    removeFilter: vi.fn(),
    filterEvents: (events) => events,
  })

  render(<App />)

  expect(await screen.findByText('Fetch failed')).toBeInTheDocument()
})

describe('month scroll preferences', () => {
  beforeEach(() => {
    localStorage.setItem('yearbird:month-scroll-enabled', 'true')
    setupAuthenticatedEvents([])
  })

  test('restores month scroll preferences from displaySettings', async () => {
    // Import mocked module
    const displaySettings = await import('./services/displaySettings')

    // Mock displaySettings to return custom density and enabled
    vi.mocked(displaySettings.getMonthScrollDensity).mockReturnValue(80)
    vi.mocked(displaySettings.getMonthScrollEnabled).mockReturnValue(true)

    render(<App />)

    const slider = await screen.findByLabelText('Month density')
    expect((slider as HTMLInputElement).value).toBe('80')

    // Reset mocks
    vi.mocked(displaySettings.getMonthScrollDensity).mockReturnValue(60)
    vi.mocked(displaySettings.getMonthScrollEnabled).mockReturnValue(false)
  })

  test('uses default density when displaySettings returns default', async () => {
    // Import mocked module
    const displaySettings = await import('./services/displaySettings')

    // displaySettings returns default value
    vi.mocked(displaySettings.getMonthScrollDensity).mockReturnValue(60)
    vi.mocked(displaySettings.getMonthScrollEnabled).mockReturnValue(true)

    render(<App />)

    const slider = await screen.findByLabelText('Month density')
    expect((slider as HTMLInputElement).value).toBe('60')

    // Reset mocks
    vi.mocked(displaySettings.getMonthScrollEnabled).mockReturnValue(false)
  })
})

test('shows filter count in the header', async () => {
  useAuthMock.mockReturnValue({
    isAuthenticated: true,
    isReady: true,
    authNotice: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    user: null,
    accessToken: 'token',
    expiresAt: Date.now() + 60_000,
  })
  useCalendarEventsMock.mockReturnValue({
    events: [],
    isLoading: false,
    error: null,
    lastUpdated: null,
    isFromCache: false,
    refetch: vi.fn(),
  })
  useFiltersMock.mockReturnValue({
    filters: [
      { id: '1', pattern: 'rent', createdAt: Date.now() },
      { id: '2', pattern: 'sync', createdAt: Date.now() },
    ],
    addFilter: vi.fn(),
    removeFilter: vi.fn(),
    filterEvents: (events) => events,
  })

  render(<App />)

  expect(await screen.findByText('(2)')).toBeInTheDocument()
})

test('allows hiding events from the event bars', async () => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  useAuthMock.mockReturnValue({
    isAuthenticated: true,
    isReady: true,
    authNotice: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    user: null,
    accessToken: 'token',
    expiresAt: Date.now() + 60_000,
  })
  useCalendarEventsMock.mockReturnValue({
    events: ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((title, index) =>
      buildEvent(`${index + 1}`, title)
    ),
    isLoading: false,
    error: null,
    lastUpdated: null,
    isFromCache: false,
    refetch: vi.fn(),
  })
  const addFilter = vi.fn()
  useFiltersMock.mockReturnValue({
    filters: [],
    addFilter,
    removeFilter: vi.fn(),
    filterEvents: (events) => events,
  })

  render(<App />)

  // Click event bar to show tooltip
  fireEvent.click(screen.getByRole('button', { name: 'A' }), {
    clientX: 140,
    clientY: 90,
  })
  // Wait for tooltip and click hide button
  fireEvent.click(await screen.findByRole('button', { name: /hide events like a/i }))
  expect(addFilter).toHaveBeenCalledWith('A')
})

test('toggles category legend to hide event suggestions', async () => {
  setupAuthenticatedEvents([
    buildEvent('1', 'Work sync', 'work'),
    buildEvent('2', 'Family dinner', 'family'),
  ])

  render(<App />)

  expect(screen.getByText('Work sync')).toBeInTheDocument()
  expect(screen.getByText('Family dinner')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /hide work/i }))

  expect(screen.queryByText('Work sync')).not.toBeInTheDocument()
  expect(screen.getByText('Family dinner')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: /show work/i }))

  expect(screen.getByText('Work sync')).toBeInTheDocument()
})

test('restores hidden categories from storage', async () => {
  localStorage.setItem('yearbird:hidden-categories', JSON.stringify(['work']))
  setupAuthenticatedEvents([
    buildEvent('1', 'Work sync', 'work'),
    buildEvent('2', 'Family dinner', 'family'),
  ])

  render(<App />)

  expect(screen.queryByText('Work sync')).not.toBeInTheDocument()
  expect(screen.getByText('Family dinner')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /show work/i })).toBeInTheDocument()
})
