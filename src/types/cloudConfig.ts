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
 * Unified category definition for cloud storage (v2).
 */
export interface CloudCategory {
  id: string
  label: string
  color: string
  keywords: string[]
  matchMode: CategoryMatchMode
  createdAt: number
  updatedAt: number
  isDefault?: boolean
}

/**
 * Legacy custom category definition (v1).
 */
export interface CloudCustomCategory {
  id: string
  label: string
  color: string
  keywords: string[]
  matchMode: CategoryMatchMode
  createdAt: number
  updatedAt: number
}

/**
 * Cloud configuration v1 (legacy format).
 * Kept for backward compatibility and migration.
 */
export interface CloudConfigV1 {
  version: 1
  updatedAt: number
  deviceId: string
  filters: EventFilter[]
  disabledCalendars: string[]
  disabledBuiltInCategories: string[]
  customCategories: CloudCustomCategory[]

  /** Display settings */
  /** Show single-day timed events (default: false) */
  showTimedEvents?: boolean
  /** Match event descriptions for categorization (default: false) */
  matchDescription?: boolean
}

/**
 * Cloud configuration v2 (unified categories).
 */
export interface CloudConfigV2 {
  version: 2
  updatedAt: number
  deviceId: string
  filters: EventFilter[]
  disabledCalendars: string[]
  categories: CloudCategory[]
}

/**
 * Cloud configuration stored in Google Drive appDataFolder.
 * Single file for atomic updates and simpler sync logic.
 * Supports both v1 (legacy) and v2 (unified) schemas.
 */
export type CloudConfig = CloudConfigV1 | CloudConfigV2

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
