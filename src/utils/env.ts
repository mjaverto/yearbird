import { parseDateValue } from './dateUtils'
import { log } from './logger'

const FIXTURE_MODE = import.meta.env.VITE_USE_FIXTURE_EVENTS === 'true'
const FIXED_DATE_VALUE = import.meta.env.VITE_FIXED_DATE
const IS_DEV_OR_TEST = import.meta.env.DEV || import.meta.env.MODE === 'test'
const IS_PRODUCTION = import.meta.env.PROD

// Security: Validate fixture mode cannot be enabled in production at module load time
if (FIXTURE_MODE && IS_PRODUCTION && !IS_DEV_OR_TEST) {
  throw new Error(
    'SECURITY: Fixture mode cannot be enabled in production builds. ' +
    'Remove VITE_USE_FIXTURE_EVENTS from your production environment.',
  )
}

export const isFixtureMode = () => {
  if (!FIXTURE_MODE) {
    return false
  }

  if (IS_DEV_OR_TEST) {
    return true
  }

  // This should never be reached due to the check above, but defense in depth
  log.warn('Fixture mode is disabled outside dev/test builds.')
  return false
}

export const getFixedDate = (): Date | null => {
  if (!FIXED_DATE_VALUE || !isFixtureMode()) {
    return null
  }

  return parseDateValue(FIXED_DATE_VALUE)
}
