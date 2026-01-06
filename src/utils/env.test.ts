import { afterEach, describe, expect, it, vi } from 'vitest'

const loadEnv = async () => {
  vi.resetModules()
  return await import('./env')
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('env utilities', () => {
  it('returns null when fixture date is missing', async () => {
    vi.stubEnv('VITE_USE_FIXTURE_EVENTS', 'true')
    vi.stubEnv('VITE_FIXED_DATE', '')

    const env = await loadEnv()

    expect(env.getFixedDate()).toBeNull()
  })

  it('parses fixed date when fixture mode is enabled', async () => {
    vi.stubEnv('VITE_USE_FIXTURE_EVENTS', 'true')
    vi.stubEnv('VITE_FIXED_DATE', '2026-01-15')

    const env = await loadEnv()

    expect(env.isFixtureMode()).toBe(true)
    expect(env.getFixedDate()?.getFullYear()).toBe(2026)
  })
})
