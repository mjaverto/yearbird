/**
 * TV Browser Detection Utility
 *
 * Detects TV browsers where Google Identity Services (GIS) library
 * typically fails to load, requiring the fallback redirect-based OAuth flow.
 *
 * Supported TV platforms:
 * - Google TV / Android TV (TVBro, Puffin TV, sideloaded Chrome)
 * - Amazon Fire TV
 * - Samsung Tizen
 * - LG webOS
 * - Roku
 * - PlayStation/Xbox browsers
 */

const TV_MODE_STORAGE_KEY = 'yearbird:tvMode'

/**
 * Known TV browser user agent patterns.
 * These patterns match common TV browsers and smart TV platforms.
 */
const TV_USER_AGENT_PATTERNS = [
  // Android TV / Google TV
  /Android.*TV/i,
  /Android.*AFT/i, // Amazon Fire TV
  /\bAFT[A-Z]\b/, // Fire TV device codes (AFTA, AFTB, etc.)

  // Smart TV platforms
  /Tizen/i, // Samsung Smart TV
  /Web0S/i, // LG Smart TV (note: Web0S with zero)
  /webOS/i, // LG Smart TV alternate
  /SMART-TV/i,
  /SmartTV/i,

  // TV browsers
  /TV Safari/i,
  /TVBro/i,
  /Puffin TV/i,

  // Gaming consoles (browser mode)
  /PlayStation/i,
  /Xbox/i,
  /Nintendo/i,

  // Roku
  /Roku/i,

  // Generic TV indicators
  /\bTV\b/i, // Generic "TV" in UA
  /CrKey/i, // Chromecast
  /BRAVIA/i, // Sony Bravia
  /Vizio/i,
  /Hisense/i,
  /Philips/i,
]

/**
 * Detects if the current browser is running on a TV device.
 *
 * @returns true if the user agent matches known TV browser patterns
 */
export function isTVBrowser(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }

  const ua = navigator.userAgent
  return TV_USER_AGENT_PATTERNS.some((pattern) => pattern.test(ua))
}

/**
 * Gets the persisted TV mode preference from localStorage.
 *
 * @returns true if user has manually enabled TV mode, false otherwise
 */
export function getTvModePreference(): boolean {
  if (typeof localStorage === 'undefined') {
    return false
  }

  try {
    return localStorage.getItem(TV_MODE_STORAGE_KEY) === 'true'
  } catch {
    // localStorage may be unavailable in private mode
    return false
  }
}

/**
 * Sets the TV mode preference in localStorage.
 *
 * @param enabled - Whether to enable or disable TV mode
 */
export function setTvModePreference(enabled: boolean): void {
  if (typeof localStorage === 'undefined') {
    return
  }

  try {
    if (enabled) {
      localStorage.setItem(TV_MODE_STORAGE_KEY, 'true')
    } else {
      localStorage.removeItem(TV_MODE_STORAGE_KEY)
    }
  } catch {
    // Ignore storage access issues
  }
}

/**
 * Clears the TV mode preference from localStorage.
 */
export function clearTvModePreference(): void {
  setTvModePreference(false)
}
