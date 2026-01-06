import { parseDateValue } from './dateUtils'

const FIXTURE_MODE = import.meta.env.VITE_USE_FIXTURE_EVENTS === 'true'
const FIXED_DATE_VALUE = import.meta.env.VITE_FIXED_DATE
const FIXTURE_ALLOWED = import.meta.env.DEV || import.meta.env.MODE === 'test'

export const isFixtureMode = () => {
  if (!FIXTURE_MODE) {
    return false
  }

  if (FIXTURE_ALLOWED) {
    return true
  }

  console.warn('Fixture mode is disabled outside dev/test builds.')
  return false
}

export const getFixedDate = (): Date | null => {
  if (!FIXED_DATE_VALUE || !isFixtureMode()) {
    return null
  }

  return parseDateValue(FIXED_DATE_VALUE)
}
