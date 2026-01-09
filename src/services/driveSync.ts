/**
 * Google Drive appDataFolder service for cloud config sync.
 *
 * The appDataFolder is a special hidden folder in Google Drive:
 * - Private to this app only
 * - Hidden from user's Drive UI
 * - Per-user isolated storage
 * - Uses normal Drive quota (but configs are tiny)
 *
 * @see https://developers.google.com/workspace/drive/api/guides/appdata
 */

import type {
  CloudConfig,
  CloudConfigV1,
  CloudConfigV2,
  CloudCategory,
  CloudCustomCategory,
  EventFilter,
} from '../types/cloudConfig'
import { getStoredAuth } from './auth'

/** Maximum allowed length for string fields to prevent abuse */
const MAX_STRING_LENGTH = 1000
/** Maximum number of items in arrays */
const MAX_ARRAY_LENGTH = 500

/**
 * Validate and sanitize a CloudConfig from Drive.
 * Supports both v1 (legacy) and v2 (unified) schemas.
 * Returns null if the config is invalid or malformed.
 */
function validateCloudConfig(data: unknown): CloudConfig | null {
  if (!data || typeof data !== 'object') {
    return null
  }

  const config = data as Record<string, unknown>

  // Validate version
  if (config.version !== 1 && config.version !== 2) {
    console.warn('Invalid cloud config version:', config.version)
    return null
  }

  // Validate common fields
  if (typeof config.updatedAt !== 'number' || !Number.isFinite(config.updatedAt)) {
    return null
  }

  if (typeof config.deviceId !== 'string' || config.deviceId.length > MAX_STRING_LENGTH) {
    return null
  }

  // Validate filters array
  if (!Array.isArray(config.filters) || config.filters.length > MAX_ARRAY_LENGTH) {
    return null
  }
  const filters: EventFilter[] = []
  for (const f of config.filters) {
    if (!isValidFilter(f)) continue
    filters.push(f as EventFilter)
  }

  // Validate disabledCalendars array
  if (!Array.isArray(config.disabledCalendars) || config.disabledCalendars.length > MAX_ARRAY_LENGTH) {
    return null
  }
  const disabledCalendars: string[] = []
  for (const cal of config.disabledCalendars) {
    if (typeof cal === 'string' && cal.length <= MAX_STRING_LENGTH) {
      disabledCalendars.push(cal)
    }
  }

  // Version-specific validation
  if (config.version === 2) {
    return validateV2Config(config, filters, disabledCalendars)
  } else {
    return validateV1Config(config, filters, disabledCalendars)
  }
}

/**
 * Validate v1 (legacy) config schema
 */
function validateV1Config(
  config: Record<string, unknown>,
  filters: EventFilter[],
  disabledCalendars: string[]
): CloudConfigV1 | null {
  // Validate disabledBuiltInCategories array
  if (!Array.isArray(config.disabledBuiltInCategories) || config.disabledBuiltInCategories.length > MAX_ARRAY_LENGTH) {
    return null
  }
  const validBuiltInCategories = ['birthdays', 'family', 'holidays', 'adventures', 'races', 'work']
  const disabledBuiltInCategories: string[] = []
  for (const cat of config.disabledBuiltInCategories) {
    if (typeof cat === 'string' && validBuiltInCategories.includes(cat)) {
      disabledBuiltInCategories.push(cat)
    }
  }

  // Validate customCategories array
  if (!Array.isArray(config.customCategories) || config.customCategories.length > MAX_ARRAY_LENGTH) {
    return null
  }
  const customCategories: CloudCustomCategory[] = []
  for (const cat of config.customCategories) {
    if (!isValidCustomCategory(cat)) continue
    customCategories.push(cat as CloudCustomCategory)
  }

  return {
    version: 1,
    updatedAt: config.updatedAt as number,
    deviceId: config.deviceId as string,
    filters,
    disabledCalendars,
    disabledBuiltInCategories,
    customCategories,
  }
}

/**
 * Validate v2 (unified) config schema
 */
function validateV2Config(
  config: Record<string, unknown>,
  filters: EventFilter[],
  disabledCalendars: string[]
): CloudConfigV2 | null {
  // Validate categories array
  if (!Array.isArray(config.categories) || config.categories.length > MAX_ARRAY_LENGTH) {
    return null
  }
  const categories: CloudCategory[] = []
  for (const cat of config.categories) {
    if (!isValidCategory(cat)) continue
    categories.push(cat as CloudCategory)
  }

  return {
    version: 2,
    updatedAt: config.updatedAt as number,
    deviceId: config.deviceId as string,
    filters,
    disabledCalendars,
    categories,
  }
}

function isValidFilter(f: unknown): boolean {
  if (!f || typeof f !== 'object') return false
  const filter = f as Record<string, unknown>
  return (
    typeof filter.id === 'string' &&
    filter.id.length <= MAX_STRING_LENGTH &&
    typeof filter.pattern === 'string' &&
    filter.pattern.length <= MAX_STRING_LENGTH &&
    typeof filter.createdAt === 'number' &&
    Number.isFinite(filter.createdAt)
  )
}

function isValidCustomCategory(c: unknown): boolean {
  if (!c || typeof c !== 'object') return false
  const cat = c as Record<string, unknown>
  return (
    typeof cat.id === 'string' &&
    cat.id.length <= MAX_STRING_LENGTH &&
    typeof cat.label === 'string' &&
    cat.label.length <= MAX_STRING_LENGTH &&
    typeof cat.color === 'string' &&
    cat.color.length <= 20 &&
    Array.isArray(cat.keywords) &&
    cat.keywords.length <= MAX_ARRAY_LENGTH &&
    cat.keywords.every((k: unknown) => typeof k === 'string' && (k as string).length <= MAX_STRING_LENGTH) &&
    (cat.matchMode === 'any' || cat.matchMode === 'all') &&
    typeof cat.createdAt === 'number' &&
    Number.isFinite(cat.createdAt) &&
    typeof cat.updatedAt === 'number' &&
    Number.isFinite(cat.updatedAt)
  )
}

/**
 * Validate a v2 unified category (includes isDefault flag)
 */
function isValidCategory(c: unknown): boolean {
  if (!c || typeof c !== 'object') return false
  const cat = c as Record<string, unknown>
  return (
    typeof cat.id === 'string' &&
    cat.id.length <= MAX_STRING_LENGTH &&
    typeof cat.label === 'string' &&
    cat.label.length <= MAX_STRING_LENGTH &&
    typeof cat.color === 'string' &&
    cat.color.length <= 20 &&
    Array.isArray(cat.keywords) &&
    cat.keywords.length <= MAX_ARRAY_LENGTH &&
    cat.keywords.every((k: unknown) => typeof k === 'string' && (k as string).length <= MAX_STRING_LENGTH) &&
    (cat.matchMode === 'any' || cat.matchMode === 'all') &&
    typeof cat.createdAt === 'number' &&
    Number.isFinite(cat.createdAt) &&
    typeof cat.updatedAt === 'number' &&
    Number.isFinite(cat.updatedAt) &&
    (cat.isDefault === undefined || typeof cat.isDefault === 'boolean')
  )
}

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3'
const CONFIG_FILENAME = 'yearbird-config.json'
const MIME_TYPE = 'application/json'

/** Maximum retry attempts for transient failures */
const MAX_RETRIES = 3
/** Base delay for exponential backoff (ms) */
const BASE_RETRY_DELAY_MS = 1000

export interface DriveError {
  code: number
  message: string
  status?: string
}

export interface DriveSyncResult<T> {
  success: boolean
  data?: T
  error?: DriveError
}

/**
 * Get authorization headers for Drive API requests
 */
function getAuthHeaders(): HeadersInit | null {
  const auth = getStoredAuth()
  if (!auth) {
    return null
  }
  return {
    Authorization: `Bearer ${auth.accessToken}`,
  }
}

/**
 * Check if an error is retryable (transient)
 */
function isRetryableError(code: number): boolean {
  // 5xx server errors and specific retryable codes
  return code >= 500 || code === 429 || code === 0 // 0 = network error
}

/**
 * Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Make an authenticated request to the Drive API with retry logic.
 * Retries on transient failures (5xx, 429, network errors) with exponential backoff.
 * Does NOT retry on 401 (auth errors) - caller should handle token refresh.
 */
async function driveRequest<T>(
  url: string,
  options: RequestInit = {},
  retryCount = 0
): Promise<DriveSyncResult<T>> {
  const authHeaders = getAuthHeaders()
  if (!authHeaders) {
    return {
      success: false,
      error: { code: 401, message: 'Not authenticated' },
    }
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...authHeaders,
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorCode = response.status
      const error: DriveError = {
        code: errorCode,
        message: errorData.error?.message || response.statusText,
        status: errorData.error?.status,
      }

      // Retry transient errors with exponential backoff
      if (isRetryableError(errorCode) && retryCount < MAX_RETRIES) {
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, retryCount)
        console.warn(`Drive API error ${errorCode}, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)
        await sleep(delay)
        return driveRequest<T>(url, options, retryCount + 1)
      }

      return { success: false, error }
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return { success: true }
    }

    const data = await response.json()
    return { success: true, data }
  } catch (error) {
    const networkError: DriveError = {
      code: 0,
      message: error instanceof Error ? error.message : 'Network error',
    }

    // Retry network errors with exponential backoff
    if (retryCount < MAX_RETRIES) {
      const delay = BASE_RETRY_DELAY_MS * Math.pow(2, retryCount)
      console.warn(`Network error, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)
      await sleep(delay)
      return driveRequest<T>(url, options, retryCount + 1)
    }

    return { success: false, error: networkError }
  }
}

interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime?: string
}

interface DriveFileList {
  files: DriveFile[]
  nextPageToken?: string
}

/**
 * Find the config file in appDataFolder
 */
export async function findConfigFile(): Promise<DriveSyncResult<DriveFile | null>> {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    fields: 'files(id,name,mimeType,modifiedTime)',
    q: `name='${CONFIG_FILENAME}'`,
  })

  const result = await driveRequest<DriveFileList>(
    `${DRIVE_API_BASE}/files?${params.toString()}`
  )

  if (!result.success) {
    return { success: false, error: result.error }
  }

  const file = result.data?.files?.[0] || null
  return { success: true, data: file }
}

/**
 * Read the cloud config from appDataFolder.
 * Validates the config structure before returning.
 */
export async function readCloudConfig(): Promise<DriveSyncResult<CloudConfig | null>> {
  // First, find the config file
  const findResult = await findConfigFile()
  if (!findResult.success) {
    return { success: false, error: findResult.error }
  }

  if (!findResult.data) {
    // No config file exists yet
    return { success: true, data: null }
  }

  // Download the file content
  const params = new URLSearchParams({
    alt: 'media',
  })

  const result = await driveRequest<unknown>(
    `${DRIVE_API_BASE}/files/${findResult.data.id}?${params.toString()}`
  )

  if (!result.success) {
    return { success: false, error: result.error }
  }

  // Validate the config structure
  const validatedConfig = validateCloudConfig(result.data)
  if (!validatedConfig) {
    return {
      success: false,
      error: {
        code: 400,
        message: 'Invalid cloud config structure',
      },
    }
  }

  return { success: true, data: validatedConfig }
}

/**
 * Write the cloud config to appDataFolder.
 * Creates the file if it doesn't exist, updates it otherwise.
 */
export async function writeCloudConfig(
  config: CloudConfig
): Promise<DriveSyncResult<DriveFile>> {
  const authHeaders = getAuthHeaders()
  if (!authHeaders) {
    return {
      success: false,
      error: { code: 401, message: 'Not authenticated' },
    }
  }

  // First, check if the file exists
  const findResult = await findConfigFile()
  if (!findResult.success) {
    return { success: false, error: findResult.error }
  }

  const fileId = findResult.data?.id
  const configJson = JSON.stringify(config, null, 2)

  if (fileId) {
    // Update existing file
    return updateConfigFile(fileId, configJson, authHeaders)
  } else {
    // Create new file
    return createConfigFile(configJson, authHeaders)
  }
}

/**
 * Create a new config file in appDataFolder
 */
async function createConfigFile(
  content: string,
  authHeaders: HeadersInit
): Promise<DriveSyncResult<DriveFile>> {
  // Use multipart upload for simplicity
  const metadata = {
    name: CONFIG_FILENAME,
    mimeType: MIME_TYPE,
    parents: ['appDataFolder'],
  }

  const boundary = '-------yearbird_boundary'
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${MIME_TYPE}`,
    '',
    content,
    `--${boundary}--`,
  ].join('\r\n')

  try {
    const response = await fetch(
      `${DRIVE_UPLOAD_BASE}/files?uploadType=multipart&fields=id,name,mimeType,modifiedTime`,
      {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: {
          code: response.status,
          message: errorData.error?.message || response.statusText,
          status: errorData.error?.status,
        },
      }
    }

    const data = await response.json()
    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 0,
        message: error instanceof Error ? error.message : 'Network error',
      },
    }
  }
}

/**
 * Update an existing config file
 */
async function updateConfigFile(
  fileId: string,
  content: string,
  authHeaders: HeadersInit
): Promise<DriveSyncResult<DriveFile>> {
  try {
    const response = await fetch(
      `${DRIVE_UPLOAD_BASE}/files/${fileId}?uploadType=media&fields=id,name,mimeType,modifiedTime`,
      {
        method: 'PATCH',
        headers: {
          ...authHeaders,
          'Content-Type': MIME_TYPE,
        },
        body: content,
      }
    )

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: {
          code: response.status,
          message: errorData.error?.message || response.statusText,
          status: errorData.error?.status,
        },
      }
    }

    const data = await response.json()
    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: {
        code: 0,
        message: error instanceof Error ? error.message : 'Network error',
      },
    }
  }
}

/**
 * Delete the config file from appDataFolder.
 * Used when user disables cloud sync.
 */
export async function deleteCloudConfig(): Promise<DriveSyncResult<void>> {
  const findResult = await findConfigFile()
  if (!findResult.success) {
    return { success: false, error: findResult.error }
  }

  if (!findResult.data) {
    // No file to delete
    return { success: true }
  }

  const result = await driveRequest<void>(
    `${DRIVE_API_BASE}/files/${findResult.data.id}`,
    { method: 'DELETE' }
  )

  return result
}

/**
 * Check if Drive API is accessible (online and authenticated)
 */
export async function checkDriveAccess(): Promise<boolean> {
  const auth = getStoredAuth()
  if (!auth) {
    return false
  }

  if (!navigator.onLine) {
    return false
  }

  // Quick check by listing appDataFolder (minimal quota usage)
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    pageSize: '1',
    fields: 'files(id)',
  })

  const result = await driveRequest<DriveFileList>(
    `${DRIVE_API_BASE}/files?${params.toString()}`
  )

  return result.success
}
