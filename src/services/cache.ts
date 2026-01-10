/**
 * Cache Service (No-op)
 *
 * Previously cached events in localStorage.
 * Now disabled - events are fetched fresh each session.
 */

import type { YearbirdEvent } from '../types/calendar'

/**
 * Get cached events (always returns null - caching disabled).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getCachedEvents(_year: number, _suffix?: string): YearbirdEvent[] | null {
  return null
}

/**
 * Set cached events (no-op - caching disabled).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function setCachedEvents(_year: number, _events: YearbirdEvent[], _suffix?: string): void {
  // No-op: caching disabled
}

/**
 * Clear cached events for a year (no-op - caching disabled).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function clearCachedEvents(_year: number, _suffix?: string): void {
  // No-op: caching disabled
}

/**
 * Clear all caches (no-op - caching disabled).
 */
export function clearAllCaches(): void {
  // No-op: caching disabled
}

/**
 * Clear all event caches (no-op - caching disabled).
 */
export function clearEventCaches(): void {
  // No-op: caching disabled
}

/**
 * Get cache timestamp (always returns null - caching disabled).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getCacheTimestamp(_year: number, _suffix?: string): Date | null {
  return null
}
