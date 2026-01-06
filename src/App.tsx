import { useEffect, useMemo, useState } from 'react'
import { AuthenticatedLayout } from './components/AuthenticatedLayout'
import { ColorLegend } from './components/ColorLegend'
import { FilterPanel } from './components/FilterPanel'
import { SettingsIcon } from './components/icons/SettingsIcon'
import { MonthScrollIcon } from './components/icons/MonthScrollIcon'
import { LandingPage } from './components/LandingPage'
import { LoadingSpinner } from './components/LoadingSpinner'
import { YearPicker } from './components/YearPicker'
import { DayHeader } from './components/calendar/DayHeader'
import { YearGrid } from './components/calendar/YearGrid'
import { Button } from './components/ui/button'
import { CATEGORIES } from './config/categories'
import { useCalendarEvents } from './hooks/useCalendarEvents'
import { useCalendarList } from './hooks/useCalendarList'
import { useCalendarVisibility } from './hooks/useCalendarVisibility'
import { useAuth } from './hooks/useAuth'
import { useBuiltInCategories } from './hooks/useBuiltInCategories'
import { useCustomCategories } from './hooks/useCustomCategories'
import { useFilters } from './hooks/useFilters'
import type { EventCategory } from './types/calendar'
import { categorizeEvent, getAllCategories, getCategoryMatchList } from './utils/categorize'
import { resolveCalendarId, type CalendarMeta } from './utils/calendarUtils'
import { getFixedDate } from './utils/env'

const HIDDEN_CATEGORIES_KEY = 'yearbird:hidden-categories'
const SCROLL_ENABLED_KEY = 'yearbird:month-scroll-enabled'
const SCROLL_DENSITY_KEY = 'yearbird:month-scroll-density'
const DEFAULT_SCROLL_DENSITY = 60
const loadHiddenCategories = (knownCategories: Set<string>): EventCategory[] => {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const stored = localStorage.getItem(HIDDEN_CATEGORIES_KEY)
    if (!stored) {
      return []
    }
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) {
      throw new Error('Stored hidden categories is not an array')
    }

    return parsed.filter(
      (category): category is EventCategory =>
        typeof category === 'string' && knownCategories.has(category)
    )
  } catch {
    try {
      localStorage.removeItem(HIDDEN_CATEGORIES_KEY)
    } catch {
      // Ignore storage access errors (e.g. private browsing restrictions).
    }
    return []
  }
}

const clampScrollDensity = (value: number) => Math.min(100, Math.max(0, Math.round(value / 10) * 10))

const loadScrollEnabled = () => {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    const stored = localStorage.getItem(SCROLL_ENABLED_KEY)
    if (!stored) {
      return false
    }
    return stored === 'true'
  } catch {
    return false
  }
}

const loadScrollDensity = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_SCROLL_DENSITY
  }

  try {
    const stored = localStorage.getItem(SCROLL_DENSITY_KEY)
    if (!stored) {
      return DEFAULT_SCROLL_DENSITY
    }
    const parsed = Number(stored)
    if (!Number.isFinite(parsed)) {
      return DEFAULT_SCROLL_DENSITY
    }
    return clampScrollDensity(parsed)
  } catch {
    return DEFAULT_SCROLL_DENSITY
  }
}

function App() {
  const {
    isAuthenticated,
    isReady,
    isSigningIn,
    authNotice,
    signIn,
    signOut,
    accessToken,
    useTvMode,
    isGisUnavailable,
    tvSignIn,
    toggleTvMode,
  } = useAuth()
  const fixedDate = getFixedDate()
  const now = fixedDate ?? new Date()
  const currentYear = now.getFullYear()
  const today = now
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [isMonthScrollEnabled, setIsMonthScrollEnabled] = useState(() => loadScrollEnabled())
  const [monthScrollDensity, setMonthScrollDensity] = useState(() => loadScrollDensity())
  const {
    calendars,
    isLoading: isCalendarsLoading,
    error: calendarError,
    refetch: refetchCalendars,
  } = useCalendarList(accessToken)
  const {
    disabledCalendarIds,
    visibleCalendarIds,
    disableCalendar,
    enableCalendar,
  } = useCalendarVisibility(calendars)
  const calendarMetaById = useMemo(() => {
    const meta = new Map<string, CalendarMeta>()
    for (const calendar of calendars) {
      const name = calendar.summary?.trim()
      meta.set(calendar.id, {
        name: name || (calendar.primary ? 'Primary calendar' : undefined),
        color: calendar.backgroundColor,
      })
    }
    return meta
  }, [calendars])
  const calendarIdsForEvents = useMemo(() => {
    if (calendars.length > 0) {
      return visibleCalendarIds
    }
    if (isCalendarsLoading || calendarError) {
      return ['primary']
    }
    return []
  }, [calendars.length, visibleCalendarIds, isCalendarsLoading, calendarError])
  const { events, isLoading, lastUpdated, isFromCache, error, refetch } = useCalendarEvents(
    accessToken,
    selectedYear,
    calendarIdsForEvents
  )
  const {
    customCategories,
    addCustomCategory,
    updateCustomCategory,
    removeCustomCategory,
  } = useCustomCategories()
  const {
    disabledBuiltInCategories,
    disableBuiltInCategory,
    enableBuiltInCategory,
  } = useBuiltInCategories()
  const { filters, addFilter, removeFilter, filterEvents } = useFilters()
  const categoryList = useMemo(
    () => getAllCategories(customCategories, disabledBuiltInCategories),
    [customCategories, disabledBuiltInCategories]
  )
  const categoryMatchList = useMemo(
    () => getCategoryMatchList(customCategories, disabledBuiltInCategories),
    [customCategories, disabledBuiltInCategories]
  )
  const knownCategorySet = useMemo(
    () => new Set<string>(categoryList.map((category) => category.category)),
    [categoryList]
  )
  const [hiddenCategories, setHiddenCategories] = useState<EventCategory[]>(() =>
    loadHiddenCategories(knownCategorySet)
  )
  const resolvedHiddenCategories = useMemo(
    () => hiddenCategories.filter((category) => knownCategorySet.has(category)),
    [hiddenCategories, knownCategorySet]
  )
  const [showFilters, setShowFilters] = useState(false)
  const widthToggleLabel = isMonthScrollEnabled ? 'Fit full year' : 'Focus months'
  const widthToggleTitle = isMonthScrollEnabled
    ? 'Fit full year'
    : 'Focus months (enable vertical scroll)'
  const densityLabel =
    monthScrollDensity < 35 ? 'Compact' : monthScrollDensity < 70 ? 'Balanced' : 'Comfortable'
  const densityTitle = `Density: ${densityLabel}`
  const categorizedEvents = useMemo(() => {
    if (events.length === 0) {
      return events
    }

    return events.map((event) => {
      const { category, color } = categorizeEvent(event.title, categoryMatchList)
      const resolvedCalendarId = resolveCalendarId(event, calendarMetaById)
      const calendarMeta = resolvedCalendarId ? calendarMetaById.get(resolvedCalendarId) : undefined
      const calendarName = calendarMeta?.name ?? event.calendarName ?? resolvedCalendarId
      const calendarColor = calendarMeta?.color ?? event.calendarColor
      if (
        event.category === category &&
        event.color === color &&
        event.calendarName === calendarName &&
        event.calendarColor === calendarColor &&
        event.calendarId === resolvedCalendarId
      ) {
        return event
      }
      return {
        ...event,
        category,
        color,
        calendarId: resolvedCalendarId,
        calendarName,
        calendarColor,
      }
    })
  }, [events, categoryMatchList, calendarMetaById])
  const visibleEvents = useMemo(() => {
    const filteredByTitle = filterEvents(categorizedEvents)
    if (resolvedHiddenCategories.length === 0) {
      return filteredByTitle
    }
    const hiddenSet = new Set(resolvedHiddenCategories)
    return filteredByTitle.filter((event) => !hiddenSet.has(event.category))
  }, [categorizedEvents, filterEvents, resolvedHiddenCategories])
  useEffect(() => {
    try {
      if (resolvedHiddenCategories.length === 0) {
        localStorage.removeItem(HIDDEN_CATEGORIES_KEY)
        return
      }
      localStorage.setItem(HIDDEN_CATEGORIES_KEY, JSON.stringify(resolvedHiddenCategories))
    } catch {
      // Ignore storage access errors (e.g. private browsing restrictions).
    }
  }, [resolvedHiddenCategories])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    try {
      localStorage.setItem(SCROLL_ENABLED_KEY, isMonthScrollEnabled.toString())
    } catch {
      // Ignore storage access errors (e.g. private browsing restrictions).
    }
  }, [isMonthScrollEnabled])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    try {
      localStorage.setItem(SCROLL_DENSITY_KEY, clampScrollDensity(monthScrollDensity).toString())
    } catch {
      // Ignore storage access errors (e.g. private browsing restrictions).
    }
  }, [monthScrollDensity])

  const showSpinner = !isReady && !authNotice && !isAuthenticated
  if (showSpinner) {
    return <LoadingSpinner />
  }

  if (!isAuthenticated) {
    return (
      <LandingPage
        onSignIn={signIn}
        authNotice={authNotice}
        isReady={isReady}
        isSigningIn={isSigningIn}
        useTvMode={useTvMode}
        isGisUnavailable={isGisUnavailable}
        onTvSignIn={tvSignIn}
        onToggleTvMode={toggleTvMode}
      />
    )
  }

  const handleRefresh = () => {
    void refetch()
    void refetchCalendars()
  }

  const handleToggleCategory = (category: EventCategory) => {
    setHiddenCategories((prev) => {
      const cleanPrev = prev.filter((entry) => knownCategorySet.has(entry))
      const isHidden = cleanPrev.includes(category)
      return isHidden ? cleanPrev.filter((entry) => entry !== category) : [...cleanPrev, category]
    })
  }

  const headerToolbar = (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
        <YearPicker year={selectedYear} onChange={setSelectedYear} size="compact" />
        {isLoading ? (
          <span className="text-[0.6rem] uppercase tracking-[0.3em] text-zinc-400">Loading</span>
        ) : null}
        <div className="h-5 w-px bg-zinc-200/80" aria-hidden="true" />
        <ColorLegend
          categories={categoryList}
          hiddenCategories={resolvedHiddenCategories}
          onToggleCategory={handleToggleCategory}
          density="compact"
          wrap={false}
          className="min-w-0"
        />
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          plain
          onClick={() => {
            setIsMonthScrollEnabled((prev) => !prev)
            setMonthScrollDensity(DEFAULT_SCROLL_DENSITY)
          }}
          className={`px-2 py-1 ${isMonthScrollEnabled ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-500'}`}
          aria-pressed={isMonthScrollEnabled}
          title={widthToggleTitle}
        >
          <MonthScrollIcon />
          <span className="sr-only">{widthToggleLabel}</span>
        </Button>
        {isMonthScrollEnabled ? (
          <div className="flex items-center gap-2 rounded-full border border-zinc-200/70 bg-white/90 px-2 py-1 shadow-sm">
            <span className="text-[0.55rem] uppercase tracking-[0.2em] text-zinc-500">
              Density
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={10}
              value={monthScrollDensity}
              onChange={(event) =>
                setMonthScrollDensity(clampScrollDensity(Number(event.target.value)))
              }
              className="w-20 cursor-pointer accent-zinc-600"
              aria-label="Month density"
              aria-valuetext={densityLabel}
              title={densityTitle}
            />
            <span className="text-[0.55rem] text-zinc-400">{densityLabel}</span>
          </div>
        ) : null}
        <Button plain onClick={() => setShowFilters(true)} className="px-2 py-1 text-zinc-500">
          <SettingsIcon />
          <span className="sr-only">Open filters</span>
          {filters.length > 0 ? (
            <span className="text-[0.6rem] text-zinc-400">({filters.length})</span>
          ) : null}
        </Button>
      </div>
    </div>
  )

  return (
    <AuthenticatedLayout
      onSignOut={signOut}
      onRefresh={handleRefresh}
      isRefreshing={isLoading}
      lastUpdated={lastUpdated}
      isFromCache={isFromCache}
      error={error}
      toolbar={headerToolbar}
    >
      <div className="h-full w-full overflow-hidden p-3 sm:p-4">
        <div className="relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white">
          <div
            className={`min-h-0 flex-1 ${isMonthScrollEnabled ? 'overflow-y-auto overflow-x-hidden' : 'overflow-hidden'}`}
          >
            {isMonthScrollEnabled ? <DayHeader /> : null}
            <YearGrid
              year={selectedYear}
              events={visibleEvents}
              today={today}
              onHideEvent={addFilter}
              categories={categoryList}
              isScrollable={isMonthScrollEnabled}
              scrollDensity={monthScrollDensity}
              showDayHeader={!isMonthScrollEnabled}
            />
          </div>
        </div>
      </div>
      <FilterPanel
        filters={filters}
        onAddFilter={addFilter}
        onRemoveFilter={removeFilter}
        builtInCategories={CATEGORIES}
        disabledBuiltInCategories={disabledBuiltInCategories}
        onDisableBuiltInCategory={disableBuiltInCategory}
        onEnableBuiltInCategory={enableBuiltInCategory}
        calendars={calendars}
        disabledCalendars={disabledCalendarIds}
        onDisableCalendar={disableCalendar}
        onEnableCalendar={enableCalendar}
        isCalendarsLoading={isCalendarsLoading}
        calendarError={calendarError}
        onRetryCalendars={refetchCalendars}
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        customCategories={customCategories}
        onAddCustomCategory={addCustomCategory}
        onUpdateCustomCategory={updateCustomCategory}
        onRemoveCustomCategory={removeCustomCategory}
      />
    </AuthenticatedLayout>
  )
}

export default App
