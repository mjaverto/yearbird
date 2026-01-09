/**
 * Display settings service for persisting user preferences.
 *
 * Provides localStorage-backed settings for:
 * - `showTimedEvents` - Whether to include single-day timed events (default: false)
 * - `matchDescription` - Whether to match event descriptions for categorization (default: false)
 *
 * @module displaySettings
 */

const SHOW_TIMED_EVENTS_KEY = 'yearbird:show-timed-events'
const MATCH_DESCRIPTION_KEY = 'yearbird:match-description'

const getStorage = (): Storage | null => {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * Gets whether single-day timed events should be shown in the calendar.
 *
 * @returns {boolean} True if timed events should be shown, false otherwise (default: false)
 *
 * @example
 * if (getShowTimedEvents()) {
 *   // Include meetings, appointments, etc.
 * }
 */
export function getShowTimedEvents(): boolean {
  const storage = getStorage()
  if (!storage) {
    return false
  }

  try {
    return storage.getItem(SHOW_TIMED_EVENTS_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Sets whether single-day timed events should be shown in the calendar.
 *
 * @param {boolean} value - True to show timed events, false to hide them
 *
 * @example
 * setShowTimedEvents(true) // Show meetings, appointments, etc.
 */
export function setShowTimedEvents(value: boolean): void {
  const storage = getStorage()
  if (!storage) {
    return
  }

  try {
    if (value) {
      storage.setItem(SHOW_TIMED_EVENTS_KEY, 'true')
    } else {
      storage.removeItem(SHOW_TIMED_EVENTS_KEY)
    }
  } catch {
    // Ignore storage failures.
  }
}

/**
 * Gets whether event descriptions should be matched for categorization.
 *
 * When enabled, the categorization engine will search both the event title
 * and description for matching keywords.
 *
 * @returns {boolean} True if description matching is enabled, false otherwise (default: false)
 *
 * @example
 * const options = {
 *   description: event.description,
 *   matchDescription: getMatchDescription(),
 * }
 * categorizeEvent(event.title, categories, options)
 */
export function getMatchDescription(): boolean {
  const storage = getStorage()
  if (!storage) {
    return false
  }

  try {
    return storage.getItem(MATCH_DESCRIPTION_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Sets whether event descriptions should be matched for categorization.
 *
 * @param {boolean} value - True to enable description matching, false to disable
 *
 * @example
 * setMatchDescription(true) // Also search descriptions for category keywords
 */
export function setMatchDescription(value: boolean): void {
  const storage = getStorage()
  if (!storage) {
    return
  }

  try {
    if (value) {
      storage.setItem(MATCH_DESCRIPTION_KEY, 'true')
    } else {
      storage.removeItem(MATCH_DESCRIPTION_KEY)
    }
  } catch {
    // Ignore storage failures.
  }
}
