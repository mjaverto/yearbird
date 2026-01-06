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
    await bar.hover()
    await expect(
      page.getByRole('tooltip', { name: 'Executive strategy review details' })
    ).toBeVisible()

    await expect(page.locator('#root')).toHaveScreenshot('layout-desktop-tooltip.png', {
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
