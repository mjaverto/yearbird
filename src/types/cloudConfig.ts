import type { BuiltInCategory, CustomCategoryId } from './calendar'
import type { CategoryMatchMode } from './categories'

/**
 * Event filter pattern for hiding specific events
 */
export interface EventFilter {
  id: string
  pattern: string
  createdAt: number
}

/**
 * Custom category definition (matches existing CustomCategory type)
 */
export interface CloudCustomCategory {
  id: CustomCategoryId
  label: string
  color: string
  keywords: string[]
  matchMode: CategoryMatchMode
  createdAt: number
  updatedAt: number
}

/**
 * Cloud configuration stored in Google Drive appDataFolder.
 * Single file for atomic updates and simpler sync logic.
 */
export interface CloudConfig {
  /** Schema version for future migrations */
  version: 1
  /** Timestamp of last update (ms since epoch) */
  updatedAt: number
  /** Device identifier that last wrote this config */
  deviceId: string

  /** Hidden event patterns */
  filters: EventFilter[]
  /** Disabled calendar IDs */
  disabledCalendars: string[]
  /** Disabled built-in category names */
  disabledBuiltInCategories: BuiltInCategory[]
  /** User-defined category rules */
  customCategories: CloudCustomCategory[]
}

/**
 * Cloud sync settings stored in localStorage
 */
export interface CloudSyncSettings {
  /** Whether cloud sync is enabled */
  enabled: boolean
  /** Timestamp of last successful sync */
  lastSyncedAt: number | null
  /** Device ID for conflict resolution */
  deviceId: string
}

/**
 * Status of the cloud sync feature
 */
export type SyncStatus =
  | 'disabled'
  | 'synced'
  | 'syncing'
  | 'offline'
  | 'error'
  | 'needs-consent'
