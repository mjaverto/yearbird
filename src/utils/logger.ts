/**
 * Simple logger utility that adapts output based on environment.
 *
 * - Development: All log levels output to console
 * - Production: Only errors are logged (to catch critical issues)
 *
 * Usage:
 *   import { log } from '@/utils/logger'
 *   log.info('User logged in', { userId: 123 })
 *   log.error('Failed to fetch data', error)
 */

const isDev = import.meta.env.DEV

const noop = () => {}

export const log = {
  /** Log informational messages (dev only) */
  info: isDev ? console.info.bind(console) : noop,

  /** Log warnings (dev only) */
  warn: isDev ? console.warn.bind(console) : noop,

  /** Log errors (always - production errors should be visible) */
  error: console.error.bind(console),

  /** Log debug messages (dev only) */
  debug: isDev ? console.log.bind(console) : noop,
}
