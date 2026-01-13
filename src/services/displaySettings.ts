/**
 * Display Settings Service (In-Memory)
 *
 * Stores display preferences in memory only.
 * Populated from cloud sync if enabled, otherwise uses defaults.
 */

// In-memory storage with defaults
let timedEventMinHours = 3
let matchDescription = false
let weekViewEnabled = false
let monthScrollEnabled = false
let monthScrollDensity = 60

/**
 * Gets the minimum duration (in hours) for timed events to be shown.
 * Events shorter than this threshold are hidden from the year view.
 * Default is 3 hours. Set to 0 to show all timed events.
 */
export function getTimedEventMinHours(): number {
  return timedEventMinHours
}

/**
 * Sets the minimum duration (in hours) for timed events to be shown.
 * Value is clamped to 0-24 range.
 */
export function setTimedEventMinHours(value: number): void {
  timedEventMinHours = Math.max(0, Math.min(24, value))
}

/**
 * Gets whether event descriptions should be matched for categorization.
 */
export function getMatchDescription(): boolean {
  return matchDescription
}

/**
 * Sets whether event descriptions should be matched for categorization.
 */
export function setMatchDescription(value: boolean): void {
  matchDescription = value
}

/**
 * Gets whether week view (Mon-Sun columns) is enabled instead of month view.
 */
export function getWeekViewEnabled(): boolean {
  return weekViewEnabled
}

/**
 * Sets whether week view is enabled.
 */
export function setWeekViewEnabled(value: boolean): void {
  weekViewEnabled = value
}

/**
 * Gets whether month scroll mode is enabled.
 */
export function getMonthScrollEnabled(): boolean {
  return monthScrollEnabled
}

/**
 * Sets whether month scroll mode is enabled.
 */
export function setMonthScrollEnabled(value: boolean): void {
  monthScrollEnabled = value
}

/**
 * Gets the month scroll density (row height in pixels).
 */
export function getMonthScrollDensity(): number {
  return monthScrollDensity
}

/**
 * Sets the month scroll density (row height in pixels).
 */
export function setMonthScrollDensity(value: number): void {
  monthScrollDensity = value
}
