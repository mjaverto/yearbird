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

import type { CloudConfig } from '../types/cloudConfig'
import { getStoredAuth } from './auth'

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3'
const CONFIG_FILENAME = 'yearbird-config.json'
const MIME_TYPE = 'application/json'

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
 * Make an authenticated request to the Drive API
 */
async function driveRequest<T>(
  url: string,
  options: RequestInit = {}
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
      return {
        success: false,
        error: {
          code: response.status,
          message: errorData.error?.message || response.statusText,
          status: errorData.error?.status,
        },
      }
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return { success: true }
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
 * Read the cloud config from appDataFolder
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

  const result = await driveRequest<CloudConfig>(
    `${DRIVE_API_BASE}/files/${findResult.data.id}?${params.toString()}`
  )

  if (!result.success) {
    return { success: false, error: result.error }
  }

  return { success: true, data: result.data ?? null }
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
