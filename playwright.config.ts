import { defineConfig } from '@playwright/test'

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? '5173')
const baseURL = `http://127.0.0.1:${PORT}/`
const snapshotPlatform = process.env.PLAYWRIGHT_SNAPSHOT_PLATFORM ?? process.platform

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
    },
  },
  snapshotPathTemplate: `e2e/{testFileName}-snapshots/{arg}-${snapshotPlatform}{ext}`,
  use: {
    baseURL,
    headless: true,
    colorScheme: 'light',
    locale: 'en-US',
    reducedMotion: 'reduce',
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    env: {
      VITE_USE_FIXTURE_EVENTS: 'true',
      VITE_FIXED_DATE: '2026-01-15',
    },
  },
  reporter: process.env.CI ? [['list']] : [['html', { open: 'never' }], ['list']],
})
