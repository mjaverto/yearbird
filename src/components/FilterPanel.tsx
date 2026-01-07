import { Dialog } from '@headlessui/react'
import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { CustomCategoryInput, CustomCategoryResult } from '../services/customCategories'
import type { BuiltInCategoryConfig, CustomCategory } from '../types/categories'
import type {
  BuiltInCategory,
  CustomCategoryId,
  GoogleCalendarListEntry,
} from '../types/calendar'
import type { EventFilter } from '../services/filters'
import { secondaryActionClasses } from '../styles/secondaryActions'
import { CloudSyncToggle } from './CloudSyncToggle'
import { CustomCategoryManager } from './CustomCategoryManager'
import { Button } from './ui/button'

type SettingsTab = 'hidden' | 'calendars' | 'categories'

interface FilterPanelProps {
  filters: EventFilter[]
  onAddFilter: (pattern: string) => void
  onRemoveFilter: (id: string) => void
  builtInCategories: BuiltInCategoryConfig[]
  disabledBuiltInCategories: BuiltInCategory[]
  onDisableBuiltInCategory: (category: BuiltInCategory) => void
  onEnableBuiltInCategory: (category: BuiltInCategory) => void
  calendars: GoogleCalendarListEntry[]
  disabledCalendars: string[]
  onDisableCalendar: (id: string) => void
  onEnableCalendar: (id: string) => void
  isCalendarsLoading: boolean
  calendarError: string | null
  onRetryCalendars: () => void
  customCategories: CustomCategory[]
  onAddCustomCategory: (input: CustomCategoryInput) => CustomCategoryResult
  onUpdateCustomCategory: (id: CustomCategoryId, input: CustomCategoryInput) => CustomCategoryResult
  onRemoveCustomCategory: (id: CustomCategoryId) => void
  isOpen: boolean
  onClose: () => void
}

export function FilterPanel({
  filters,
  onAddFilter,
  onRemoveFilter,
  builtInCategories,
  disabledBuiltInCategories,
  onDisableBuiltInCategory,
  onEnableBuiltInCategory,
  calendars,
  disabledCalendars,
  onDisableCalendar,
  onEnableCalendar,
  isCalendarsLoading,
  calendarError,
  onRetryCalendars,
  customCategories,
  onAddCustomCategory,
  onUpdateCustomCategory,
  onRemoveCustomCategory,
  isOpen,
  onClose,
}: FilterPanelProps) {
  const [newPattern, setNewPattern] = useState('')
  const [customResetToken, setCustomResetToken] = useState(0)
  const [activeTab, setActiveTab] = useState<SettingsTab>('hidden')
  const hiddenTabRef = useRef<HTMLButtonElement | null>(null)
  const calendarsTabRef = useRef<HTMLButtonElement | null>(null)
  const categoriesTabRef = useRef<HTMLButtonElement | null>(null)
  const disabledBuiltInSet = useMemo(
    () => new Set(disabledBuiltInCategories),
    [disabledBuiltInCategories]
  )
  const disabledCalendarSet = useMemo(() => new Set(disabledCalendars), [disabledCalendars])
  const visibleCalendarCount = calendars.filter(
    (calendar) => !disabledCalendarSet.has(calendar.id)
  ).length

  const tabs: SettingsTab[] = ['hidden', 'calendars', 'categories']

  const handleAdd = () => {
    const trimmed = newPattern.trim()
    if (!trimmed) {
      return
    }
    onAddFilter(trimmed)
    setNewPattern('')
  }

  const handleClose = () => {
    setNewPattern('')
    setCustomResetToken((prev) => prev + 1)
    setActiveTab('hidden')
    onClose()
  }

  const tabButtonClasses = (isActive: boolean) =>
    [
      'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition',
      isActive ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700',
    ].join(' ')

  const setActiveAndFocus = (nextTab: SettingsTab) => {
    setActiveTab(nextTab)
    const target =
      nextTab === 'hidden'
        ? hiddenTabRef.current
        : nextTab === 'calendars'
          ? calendarsTabRef.current
          : categoriesTabRef.current
    target?.focus()
  }

  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = tabs.indexOf(activeTab)
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      const nextTab = tabs[(currentIndex + 1) % tabs.length]
      if (nextTab) {
        setActiveAndFocus(nextTab)
      }
      return
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      const nextTab = tabs[(currentIndex - 1 + tabs.length) % tabs.length]
      if (nextTab) {
        setActiveAndFocus(nextTab)
      }
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      setActiveAndFocus(tabs[0]!)
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      setActiveAndFocus(tabs[tabs.length - 1]!)
    }
  }

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-zinc-950/20 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="flex w-full max-w-md flex-col rounded-2xl bg-white p-4 shadow-xl max-h-[calc(100vh-2rem)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Dialog.Title className="text-base font-semibold text-zinc-900">Filters</Dialog.Title>
              <p className="mt-1 text-xs text-zinc-500">
                Tune calendars, hidden events, and category matching.
              </p>
            </div>
            <Button plain onClick={handleClose} aria-label="Close filters">
              Close
            </Button>
          </div>

          <div
            className="mt-3"
            role="tablist"
            aria-label="Filter sections"
            onKeyDown={handleTabKeyDown}
          >
            <div className="flex rounded-lg bg-zinc-100 p-1">
              <button
                type="button"
                role="tab"
                id="settings-tab-hidden"
                aria-selected={activeTab === 'hidden'}
                aria-controls="settings-panel-hidden"
                tabIndex={activeTab === 'hidden' ? 0 : -1}
                className={tabButtonClasses(activeTab === 'hidden')}
                ref={hiddenTabRef}
                onClick={() => setActiveTab('hidden')}
              >
                Hidden events
              </button>
              <button
                type="button"
                role="tab"
                id="settings-tab-calendars"
                aria-selected={activeTab === 'calendars'}
                aria-controls="settings-panel-calendars"
                tabIndex={activeTab === 'calendars' ? 0 : -1}
                className={tabButtonClasses(activeTab === 'calendars')}
                ref={calendarsTabRef}
                onClick={() => setActiveTab('calendars')}
              >
                Calendars
              </button>
              <button
                type="button"
                role="tab"
                id="settings-tab-categories"
                aria-selected={activeTab === 'categories'}
                aria-controls="settings-panel-categories"
                tabIndex={activeTab === 'categories' ? 0 : -1}
                className={tabButtonClasses(activeTab === 'categories')}
                ref={categoriesTabRef}
                onClick={() => setActiveTab('categories')}
              >
                Categories
              </button>
            </div>
          </div>

          <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
            <div
              id="settings-panel-hidden"
              role="tabpanel"
              aria-labelledby="settings-tab-hidden"
              aria-hidden={activeTab !== 'hidden'}
              hidden={activeTab !== 'hidden'}
              className="space-y-3"
            >
              <div className="flex gap-2">
                <input
                  className="w-full rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-900 focus:border-sky-400 focus:outline-none"
                  placeholder="Event name to hide"
                  aria-label="Event name to hide"
                  value={newPattern}
                  onChange={(event) => setNewPattern(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      handleAdd()
                    }
                  }}
                />
                <Button onClick={handleAdd}>Hide</Button>
              </div>

              <div>
                {filters.length === 0 ? (
                  <p className="text-xs text-zinc-500">
                    No hidden events yet. Add a title to filter your calendar.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {filters.map((filter) => (
                      <li
                        key={filter.id}
                        className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-1.5"
                      >
                        <span className="text-xs text-zinc-700">{filter.pattern}</span>
                        <Button plain onClick={() => onRemoveFilter(filter.id)}>
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div
              id="settings-panel-calendars"
              role="tabpanel"
              aria-labelledby="settings-tab-calendars"
              aria-hidden={activeTab !== 'calendars'}
              hidden={activeTab !== 'calendars'}
            >
              <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">Calendars</h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    Choose which calendars feed the year view.
                  </p>
                </div>

                {isCalendarsLoading ? (
                  <p className="mt-2 text-xs text-zinc-500">Loading calendars...</p>
                ) : calendarError ? (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-zinc-500">
                      Calendar list unavailable{calendarError ? ` (${calendarError})` : ''}.
                    </p>
                    <Button plain onClick={onRetryCalendars} className={secondaryActionClasses}>
                      Try again
                    </Button>
                  </div>
                ) : calendars.length === 0 ? (
                  <p className="mt-2 text-xs text-zinc-500">
                    No calendars found for this account.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {visibleCalendarCount === 0 ? (
                      <p className="text-xs text-amber-600">
                        No calendars selected. Enable at least one to show events.
                      </p>
                    ) : null}
                    <ul className="space-y-1.5">
                      {calendars.map((calendar) => {
                        const isDisabled = disabledCalendarSet.has(calendar.id)
                        const label = calendar.summary?.trim() || calendar.id
                        const swatch = calendar.backgroundColor ?? '#E5E7EB'
                        return (
                          <li
                            key={calendar.id}
                            className="flex items-center justify-between rounded-lg border border-zinc-100 bg-white px-3 py-1.5"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="h-3 w-3 rounded-sm"
                                style={{ backgroundColor: swatch }}
                              />
                              <div className="flex flex-col">
                                <span
                                  className={
                                    isDisabled
                                      ? 'text-xs text-zinc-400 line-through'
                                      : 'text-xs text-zinc-700'
                                  }
                                >
                                  {label}
                                </span>
                                {calendar.primary ? (
                                  <span className="text-[0.65rem] text-zinc-400">Primary</span>
                                ) : null}
                              </div>
                            </div>
                            <Button
                              plain
                              onClick={() =>
                                isDisabled
                                  ? onEnableCalendar(calendar.id)
                                  : onDisableCalendar(calendar.id)
                              }
                              className={secondaryActionClasses}
                            >
                              {isDisabled ? 'Show' : 'Hide'}
                            </Button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            <div
              id="settings-panel-categories"
              role="tabpanel"
              aria-labelledby="settings-tab-categories"
              aria-hidden={activeTab !== 'categories'}
              hidden={activeTab !== 'categories'}
            >
              <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900">Built-in categories</h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    Remove built-ins to keep them out of matching and the legend.
                  </p>
                </div>
                <ul className="mt-2 space-y-1.5">
                  {builtInCategories.map((category) => {
                    const isDisabled = disabledBuiltInSet.has(category.category)
                    return (
                      <li
                        key={category.category}
                        className="flex items-center justify-between rounded-lg border border-zinc-100 bg-white px-3 py-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 rounded-sm"
                            style={{ backgroundColor: category.color }}
                          />
                          <span
                            className={
                              isDisabled
                                ? 'text-xs text-zinc-400 line-through'
                                : 'text-xs text-zinc-700'
                            }
                          >
                            {category.label}
                          </span>
                        </div>
                        <Button
                          plain
                          onClick={() =>
                            isDisabled
                              ? onEnableBuiltInCategory(category.category)
                              : onDisableBuiltInCategory(category.category)
                          }
                          className={secondaryActionClasses}
                        >
                          {isDisabled ? 'Restore' : 'Remove'}
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              </div>

              <CustomCategoryManager
                key={customResetToken}
                customCategories={customCategories}
                onAddCustomCategory={onAddCustomCategory}
                onUpdateCustomCategory={onUpdateCustomCategory}
                onRemoveCustomCategory={onRemoveCustomCategory}
              />
            </div>
          </div>

          <div className="mt-3 border-t border-zinc-100 pt-3">
            <CloudSyncToggle />
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
}
