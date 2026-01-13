import { useEffect, useMemo, useRef, useState } from 'react'
import { AuthenticatedLayout } from './components/AuthenticatedLayout'
import { CalendarLoadingScreen } from './components/CalendarLoadingScreen'
import { ColorLegend } from './components/ColorLegend'
import { FilterPanel } from './components/FilterPanel'
import { SettingsIcon } from './components/icons/SettingsIcon'
import { MonthScrollIcon } from './components/icons/MonthScrollIcon'
import { WeekViewIcon } from './components/icons/WeekViewIcon'
import { LandingPage } from './components/LandingPage'
import { LoadingSpinner } from './components/LoadingSpinner'
import { YearPicker } from './components/YearPicker'
import { DayHeader } from './components/calendar/DayHeader'
import { WeekGrid } from './components/calendar/WeekGrid'
import { YearGrid } from './components/calendar/YearGrid'
import { Button } from './components/ui/button'
import { useCalendarEvents } from './hooks/useCalendarEvents'
import { useCalendarList } from './hooks/useCalendarList'
import { useCalendarVisibility } from './hooks/useCalendarVisibility'
import { useAuth } from './hooks/useAuth'
import { useCategories } from './hooks/useCategories'
import { useFilters } from './hooks/useFilters'
import {
  getMatchDescription,
  getShowTimedEvents,
  setMatchDescription as saveMatchDescription,
  setShowTimedEvents as saveShowTimedEvents,
  getWeekViewEnabled,
  setWeekViewEnabled as saveWeekViewEnabled,
  getMonthScrollEnabled,
  setMonthScrollEnabled as saveMonthScrollEnabled,
  getMonthScrollDensity,
  setMonthScrollDensity as saveMonthScrollDensity,
} from './services/displaySettings'
import { scheduleSyncToCloud, performSync, isSyncEnabled } from './services/syncManager'
import type { EventCategory, YearbirdEvent } from './types/calendar'
import { categorizeEvent, getAllCategories, getCategoryMatchList } from './utils/categorize'
import { resolveCalendarId, type CalendarMeta } from './utils/calendarUtils'
import { getFixedDate } from './utils/env'
import { log } from './utils/logger'

const HIDDEN_CATEGORIES_KEY = 'yearbird:hidden-categories'
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
  } catch (error) {
    log.debug('Parse error loading hidden categories:', error)
    try {
      localStorage.removeItem(HIDDEN_CATEGORIES_KEY)
    } catch (removeError) {
      log.debug('Storage access error removing hidden categories:', removeError)
    }
    return []
  }
}

const clampScrollDensity = (value: number) => Math.min(100, Math.max(0, Math.round(value / 10) * 10))

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
  const [isMonthScrollEnabled, setIsMonthScrollEnabled] = useState(() => getMonthScrollEnabled())
  const [monthScrollDensity, setMonthScrollDensity] = useState(() => getMonthScrollDensity())
  const [isWeekViewEnabled, setIsWeekViewEnabled] = useState(() => getWeekViewEnabled())
  const [showTimedEvents, setShowTimedEvents] = useState(() => getShowTimedEvents())
  const [matchDescription, setMatchDescription] = useState(() => getMatchDescription())
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
    categories,
    removedDefaults,
    addCategory,
    updateCategory,
    removeCategory,
    restoreDefault,
    resetToDefaults,
  } = useCategories()
  const { filters, addFilter, removeFilter, filterEvents } = useFilters()
  const categoryList = useMemo(() => getAllCategories(categories), [categories])
  const categoryMatchList = useMemo(() => getCategoryMatchList(categories), [categories])
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
  const hasInitialSynced = useRef(false)

  // Auto-sync from cloud on authentication
  // This loads user's categories, calendar visibility, and display settings from Google Drive
  useEffect(() => {
    if (!isAuthenticated || !isReady || hasInitialSynced.current) {
      return
    }

    // Only sync if cloud sync is enabled (user has drive scope and hasn't disabled it)
    if (!isSyncEnabled()) {
      hasInitialSynced.current = true
      return
    }

    hasInitialSynced.current = true

    performSync().then((result) => {
      if (result.status === 'success') {
        // Update React state from the now-populated in-memory state
        setIsMonthScrollEnabled(getMonthScrollEnabled())
        setMonthScrollDensity(getMonthScrollDensity())
        setIsWeekViewEnabled(getWeekViewEnabled())
        setShowTimedEvents(getShowTimedEvents())
        setMatchDescription(getMatchDescription())
      }
    }).catch((error) => {
      log.error('Cloud sync error:', error)
    })
  }, [isAuthenticated, isReady])

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
      const { category, color } = categorizeEvent(event.title, categoryMatchList, {
        description: event.description,
        matchDescription,
      })
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
  }, [events, categoryMatchList, calendarMetaById, matchDescription])
  const visibleEvents = useMemo(() => {
    let filtered = filterEvents(categorizedEvents)

    // Filter single-day timed events unless showTimedEvents is enabled
    if (!showTimedEvents) {
      filtered = filtered.filter((event) => !event.isSingleDayTimed)
    }

    if (resolvedHiddenCategories.length === 0) {
      return filtered
    }
    const hiddenSet = new Set(resolvedHiddenCategories)
    return filtered.filter((event) => !hiddenSet.has(event.category))
  }, [categorizedEvents, filterEvents, resolvedHiddenCategories, showTimedEvents])

  // Timed events for popover (always available, regardless of showTimedEvents setting)
  const timedEventsByDate = useMemo(() => {
    const filtered = filterEvents(categorizedEvents)
    const hiddenSet = new Set(resolvedHiddenCategories)
    const map = new Map<string, YearbirdEvent[]>()

    for (const event of filtered) {
      if (!event.isSingleDayTimed) continue
      if (hiddenSet.has(event.category)) continue

      const dateKey = event.startDate
      const existing = map.get(dateKey) ?? []
      existing.push(event)
      map.set(dateKey, existing)
    }

    return map
  }, [categorizedEvents, filterEvents, resolvedHiddenCategories])

  useEffect(() => {
    try {
      if (resolvedHiddenCategories.length === 0) {
        localStorage.removeItem(HIDDEN_CATEGORIES_KEY)
        return
      }
      localStorage.setItem(HIDDEN_CATEGORIES_KEY, JSON.stringify(resolvedHiddenCategories))
    } catch (error) {
      log.debug('Storage access error saving hidden categories:', error)
    }
  }, [resolvedHiddenCategories])

  // Handlers for display settings that sync to cloud
  const handleSetMonthScrollEnabled = (value: boolean) => {
    setIsMonthScrollEnabled(value)
    saveMonthScrollEnabled(value)
    scheduleSyncToCloud()
  }

  const handleSetMonthScrollDensity = (value: number) => {
    const clamped = clampScrollDensity(value)
    setMonthScrollDensity(clamped)
    saveMonthScrollDensity(clamped)
    scheduleSyncToCloud()
  }

  const handleSetWeekViewEnabled = (value: boolean) => {
    setIsWeekViewEnabled(value)
    saveWeekViewEnabled(value)
    scheduleSyncToCloud()
  }

  // Track whether initial calendar data has loaded
  const hasInitialLoad = useRef(false)
  // Once we start hiding, we commit to it (don't stop if data becomes unavailable during refetch)
  const hasStartedHiding = useRef(false)
  // Two-phase overlay: first fade out, then remove from DOM
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(true)
  const [isHidingOverlay, setIsHidingOverlay] = useState(false)
  // Track when YearGrid has fully rendered (all MonthRows measured by ResizeObserver)
  const [isGridReady, setIsGridReady] = useState(false)

  // Determine what we have to show the user
  const hasCalendarData = calendars.length > 0
  const hasEventsLoaded = !isLoading
  const calendarsStillLoading = isCalendarsLoading
  const hasError = calendarError != null || error != null
  const hasCachedEvents = isFromCache && events.length > 0

  // Data is ready when:
  // 1. Calendar list has loaded (not still loading) - prevents race condition where
  //    events refetch when calendar IDs change from ['primary'] to actual IDs
  // 2. AND calendar data exists AND events have loaded
  // 3. OR we have an error
  // 4. OR we have cached events
  const dataIsReady = (!calendarsStillLoading && hasCalendarData && hasEventsLoaded) || hasError || hasCachedEvents

  // Track when data has become ready (for initial load detection)
  useEffect(() => {
    if (dataIsReady) {
      hasInitialLoad.current = true
    }
  }, [dataIsReady])

  // Called when YearGrid has finished rendering all months with correct dimensions
  const handleGridReady = () => {
    setIsGridReady(true)
  }

  // When data is ready AND grid has rendered, wait for stability then start fade
  // The 150ms debounce prevents starting fade during brief "ready" states that occur
  // between calendar list loading and events refetching with new calendar IDs
  useEffect(() => {
    // Once we've started hiding, don't do anything else
    if (hasStartedHiding.current) return

    if (dataIsReady && isGridReady && showLoadingOverlay && !isHidingOverlay) {
      const startFade = () => {
        // Double-check we're still ready (in case of race condition)
        if (!hasStartedHiding.current) {
          hasStartedHiding.current = true
          setIsHidingOverlay(true)
        }
      }

      // Wait 150ms for data to stabilize (prevents flash during refetch cascade)
      const stabilityTimeout = setTimeout(() => {
        requestAnimationFrame(startFade)
      }, 150)

      return () => clearTimeout(stabilityTimeout)
    }
  }, [dataIsReady, isGridReady, showLoadingOverlay, isHidingOverlay])

  // Called when fade-out animation completes
  const handleOverlayHidden = () => {
    setShowLoadingOverlay(false)
  }

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

  const handleSetShowTimedEvents = (value: boolean) => {
    setShowTimedEvents(value)
    saveShowTimedEvents(value)
    scheduleSyncToCloud()
  }

  const handleSetMatchDescription = (value: boolean) => {
    setMatchDescription(value)
    saveMatchDescription(value)
    scheduleSyncToCloud()
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
        <div className="group relative">
          <Button
            plain
            onClick={() => handleSetWeekViewEnabled(!isWeekViewEnabled)}
            className={`px-2 py-1 ${isWeekViewEnabled ? 'bg-amber-100 text-amber-700' : 'text-zinc-500'}`}
            aria-pressed={isWeekViewEnabled}
          >
            <WeekViewIcon />
            <span className="sr-only">{isWeekViewEnabled ? 'Month view' : 'Week view'}</span>
          </Button>
          <span className="pointer-events-none absolute left-1/2 top-full z-50 mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
            {isWeekViewEnabled ? 'Month view' : 'Week view'}
          </span>
        </div>
        {!isWeekViewEnabled && (
          <Button
            plain
            onClick={() => {
              handleSetMonthScrollEnabled(!isMonthScrollEnabled)
              handleSetMonthScrollDensity(DEFAULT_SCROLL_DENSITY)
            }}
            className={`px-2 py-1 ${isMonthScrollEnabled ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-500'}`}
            aria-pressed={isMonthScrollEnabled}
            title={widthToggleTitle}
          >
            <MonthScrollIcon />
            <span className="sr-only">{widthToggleLabel}</span>
          </Button>
        )}
        {!isWeekViewEnabled && isMonthScrollEnabled ? (
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
                handleSetMonthScrollDensity(Number(event.target.value))
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
    <>
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
            {isWeekViewEnabled ? (
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
                <WeekGrid
                  year={selectedYear}
                  events={visibleEvents}
                  timedEventsByDate={timedEventsByDate}
                  today={today}
                  onHideEvent={addFilter}
                  categories={categoryList}
                  onReady={handleGridReady}
                />
              </div>
            ) : (
              <div
                className={`min-h-0 flex-1 ${isMonthScrollEnabled ? 'overflow-y-auto overflow-x-hidden' : 'overflow-hidden'}`}
              >
                {isMonthScrollEnabled ? <DayHeader /> : null}
                <YearGrid
                  year={selectedYear}
                  events={visibleEvents}
                  timedEventsByDate={timedEventsByDate}
                  today={today}
                  onHideEvent={addFilter}
                  categories={categoryList}
                  isScrollable={isMonthScrollEnabled}
                  scrollDensity={monthScrollDensity}
                  showDayHeader={!isMonthScrollEnabled}
                  onReady={handleGridReady}
                />
              </div>
            )}
          </div>
        </div>
        <FilterPanel
          filters={filters}
          onAddFilter={addFilter}
          onRemoveFilter={removeFilter}
          categories={categories}
          removedDefaults={removedDefaults}
          onAddCategory={addCategory}
          onUpdateCategory={updateCategory}
          onRemoveCategory={removeCategory}
          onRestoreDefault={restoreDefault}
          onResetToDefaults={resetToDefaults}
          calendars={calendars}
          disabledCalendars={disabledCalendarIds}
          onDisableCalendar={disableCalendar}
          onEnableCalendar={enableCalendar}
          isCalendarsLoading={isCalendarsLoading}
          calendarError={calendarError}
          onRetryCalendars={refetchCalendars}
          isOpen={showFilters}
          onClose={() => setShowFilters(false)}
          showTimedEvents={showTimedEvents}
          onSetShowTimedEvents={handleSetShowTimedEvents}
          matchDescription={matchDescription}
          onSetMatchDescription={handleSetMatchDescription}
        />
      </AuthenticatedLayout>
      {/* Loading overlay - fades out after content has painted */}
      {showLoadingOverlay ? (
        <CalendarLoadingScreen isHiding={isHidingOverlay} onHidden={handleOverlayHidden} />
      ) : null}
    </>
  )
}

export default App
