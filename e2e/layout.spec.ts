import { expect, test, type Page } from '@playwright/test'

const waitForFixtures = async (page: Page) => {
  await page.getByRole('button', { name: 'Executive strategy review' }).first().waitFor()
}

test.describe('layout snapshots (desktop)', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForFixtures(page)
  })

  test('year grid', async ({ page }) => {
    await expect(page.locator('#root')).toHaveScreenshot('layout-desktop.png', {
      animations: 'disabled',
    })
  })

  test('filter panel', async ({ page }) => {
    await page.getByRole('button', { name: 'Open filters', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Event name to hide' })).toBeVisible()

    await expect(page.locator('#root')).toHaveScreenshot('layout-desktop-filters.png', {
      animations: 'disabled',
    })
  })

  test('event tooltip', async ({ page }) => {
    const bar = page.getByRole('button', { name: 'Executive strategy review' }).first()
    await bar.click()
    await expect(
      page.getByRole('tooltip', { name: 'Executive strategy review details' })
    ).toBeVisible()

    await expect(page.locator('#root')).toHaveScreenshot('layout-desktop-tooltip.png', {
      animations: 'disabled',
    })
  })

  test('month scroll', async ({ page }) => {
    await page.getByRole('button', { name: 'Focus months' }).click()
    // Wait for layout to stabilize
    await page.waitForTimeout(100)

    await expect(page.locator('#root')).toHaveScreenshot('layout-desktop-month-scroll.png', {
      animations: 'disabled',
    })
  })
})

// Marketing screenshots at 1280x831 (matches existing marketing images)
test.describe('marketing snapshots (1280)', () => {
  test.use({ viewport: { width: 1280, height: 831 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForFixtures(page)
  })

  test('year grid', async ({ page }) => {
    await expect(page.locator('#root')).toHaveScreenshot('marketing-year-grid-1280.png', {
      animations: 'disabled',
    })
  })

  test('month scroll', async ({ page }) => {
    await page.getByRole('button', { name: 'Focus months' }).click()
    await page.waitForTimeout(100)

    await expect(page.locator('#root')).toHaveScreenshot('marketing-month-scroll-1280.png', {
      animations: 'disabled',
    })
  })

  test('event tooltip', async ({ page }) => {
    const bar = page.getByRole('button', { name: 'Executive strategy review' }).first()
    await bar.click()
    await expect(
      page.getByRole('tooltip', { name: 'Executive strategy review details' })
    ).toBeVisible()

    await expect(page.locator('#root')).toHaveScreenshot('marketing-event-tooltip-1280.png', {
      animations: 'disabled',
    })
  })

  test('filters categories', async ({ page }) => {
    await page.getByRole('button', { name: 'Open filters', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Event name to hide' })).toBeVisible()

    await expect(page.locator('#root')).toHaveScreenshot('marketing-filters-categories-1280.png', {
      animations: 'disabled',
    })
  })

  test('week view', async ({ page }) => {
    // Click the week view toggle button
    await page.getByRole('button', { name: 'Week view' }).click()
    await page.waitForTimeout(100)

    await expect(page.locator('#root')).toHaveScreenshot('marketing-week-view-1280.png', {
      animations: 'disabled',
    })
  })

  test('day detail popover', async ({ page }) => {
    // Click on January 13, 2026 which has rich event data
    const dayCell = page.locator('[data-date="2026-01-13"]').first()
    await dayCell.click()
    // Wait for popover to appear with events
    await expect(page.getByText("Sarah Chen's birthday")).toBeVisible()
    await page.waitForTimeout(100)

    await expect(page.locator('#root')).toHaveScreenshot('marketing-day-detail-1280.png', {
      animations: 'disabled',
    })
  })

  test('day detail with event tooltip', async ({ page }) => {
    // Click on January 13, 2026 which has rich event data
    const dayCell = page.locator('[data-date="2026-01-13"]').first()
    await dayCell.click()
    // Wait for popover to appear
    await expect(page.getByText("Sarah Chen's birthday")).toBeVisible()
    await page.waitForTimeout(100)

    // Click on a timed event in the schedule to show tooltip
    const designReview = page.getByRole('button', { name: 'Design review session' })
    await designReview.click()
    // Wait for tooltip to appear
    await expect(
      page.getByRole('tooltip', { name: 'Design review session details' })
    ).toBeVisible()

    await expect(page.locator('#root')).toHaveScreenshot('marketing-day-detail-tooltip-1280.png', {
      animations: 'disabled',
    })
  })
})

// Open Graph / Social sharing images (1200x630 - standard OG ratio 1.91:1)
test.describe('og social images', () => {
  test.use({ viewport: { width: 1200, height: 630 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForFixtures(page)
  })

  test('og-image', async ({ page }) => {
    await expect(page.locator('#root')).toHaveScreenshot('og-image.png', {
      animations: 'disabled',
    })
  })
})

// Marketing screenshots at 1920x1080 for high-res displays
test.describe('marketing snapshots (1920)', () => {
  test.use({ viewport: { width: 1920, height: 1080 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForFixtures(page)
  })

  test('year grid', async ({ page }) => {
    await expect(page.locator('#root')).toHaveScreenshot('marketing-year-grid-1920.png', {
      animations: 'disabled',
    })
  })

  test('month scroll', async ({ page }) => {
    await page.getByRole('button', { name: 'Focus months' }).click()
    await page.waitForTimeout(100)

    await expect(page.locator('#root')).toHaveScreenshot('marketing-month-scroll-1920.png', {
      animations: 'disabled',
    })
  })

  test('event tooltip', async ({ page }) => {
    const bar = page.getByRole('button', { name: 'Executive strategy review' }).first()
    await bar.click()
    await expect(
      page.getByRole('tooltip', { name: 'Executive strategy review details' })
    ).toBeVisible()

    await expect(page.locator('#root')).toHaveScreenshot('marketing-event-tooltip-1920.png', {
      animations: 'disabled',
    })
  })

  test('filters categories', async ({ page }) => {
    await page.getByRole('button', { name: 'Open filters', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Event name to hide' })).toBeVisible()

    await expect(page.locator('#root')).toHaveScreenshot('marketing-filters-categories-1920.png', {
      animations: 'disabled',
    })
  })

  test('week view', async ({ page }) => {
    // Click the week view toggle button
    await page.getByRole('button', { name: 'Week view' }).click()
    await page.waitForTimeout(100)

    await expect(page.locator('#root')).toHaveScreenshot('marketing-week-view-1920.png', {
      animations: 'disabled',
    })
  })

  test('day detail popover', async ({ page }) => {
    // Click on January 13, 2026 which has rich event data
    const dayCell = page.locator('[data-date="2026-01-13"]').first()
    await dayCell.click()
    // Wait for popover to appear with events
    await expect(page.getByText("Sarah Chen's birthday")).toBeVisible()
    await page.waitForTimeout(100)

    await expect(page.locator('#root')).toHaveScreenshot('marketing-day-detail-1920.png', {
      animations: 'disabled',
    })
  })

  test('day detail with event tooltip', async ({ page }) => {
    // Click on January 13, 2026 which has rich event data
    const dayCell = page.locator('[data-date="2026-01-13"]').first()
    await dayCell.click()
    // Wait for popover to appear
    await expect(page.getByText("Sarah Chen's birthday")).toBeVisible()
    await page.waitForTimeout(100)

    // Click on a timed event in the schedule to show tooltip
    const designReview = page.getByRole('button', { name: 'Design review session' })
    await designReview.click()
    // Wait for tooltip to appear
    await expect(
      page.getByRole('tooltip', { name: 'Design review session details' })
    ).toBeVisible()

    await expect(page.locator('#root')).toHaveScreenshot('marketing-day-detail-tooltip-1920.png', {
      animations: 'disabled',
    })
  })
})

test.describe('layout snapshots (mobile)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForFixtures(page)
  })

  test('year grid', async ({ page }) => {
    await expect(page.locator('#root')).toHaveScreenshot('layout-mobile.png', {
      animations: 'disabled',
    })
  })

  test('filter panel', async ({ page }) => {
    await page.getByRole('button', { name: 'Open filters', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'Event name to hide' })).toBeVisible()

    await expect(page.locator('#root')).toHaveScreenshot('layout-mobile-filters.png', {
      animations: 'disabled',
    })
  })
})
