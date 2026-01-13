import { test, type Page } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'

// Human-like mouse movement with easing
async function humanMove(page: Page, targetX: number, targetY: number, steps = 30) {
  // Get current mouse position (default to center if unknown)
  const currentPos = await page.evaluate(() => {
    return {
      x: (window as unknown as { __mouseX?: number }).__mouseX ?? window.innerWidth / 2,
      y: (window as unknown as { __mouseY?: number }).__mouseY ?? window.innerHeight / 2,
    }
  })

  for (let i = 1; i <= steps; i++) {
    // Ease-out cubic for natural deceleration
    const t = i / steps
    const ease = 1 - Math.pow(1 - t, 3)

    const newX = currentPos.x + (targetX - currentPos.x) * ease
    const newY = currentPos.y + (targetY - currentPos.y) * ease

    await page.mouse.move(newX, newY)
    await page.waitForTimeout(16) // ~60fps
  }

  // Store final position
  await page.evaluate(
    ({ x, y }) => {
      ;(window as unknown as { __mouseX: number }).__mouseX = x
      ;(window as unknown as { __mouseY: number }).__mouseY = y
    },
    { x: targetX, y: targetY }
  )
}

// Add visible cursor that follows mouse movements
async function addFakeCursor(page: Page) {
  await page.addStyleTag({
    content: `
      .playwright-cursor {
        position: fixed;
        width: 24px;
        height: 32px;
        pointer-events: none;
        z-index: 999999;
        transform: translate(-2px, -2px);
        transition: left 0.03s ease-out, top 0.03s ease-out;
      }
      .playwright-cursor::before {
        content: '';
        position: absolute;
        width: 0;
        height: 0;
        /* macOS-style cursor: black fill with white border */
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-top: none;
        border-bottom: none;
        /* Use SVG for accurate cursor shape */
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='24' viewBox='0 0 20 24'%3E%3Cpath d='M0 0 L0 21 L5 16 L9 24 L12 23 L8 15 L15 15 Z' fill='black' stroke='white' stroke-width='1.5'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-size: contain;
        width: 20px;
        height: 24px;
        filter: drop-shadow(1px 2px 2px rgba(0,0,0,0.3));
      }
      .playwright-cursor.clicking::after {
        content: '';
        position: absolute;
        top: 4px;
        left: 4px;
        width: 16px;
        height: 16px;
        background: rgba(59, 130, 246, 0.5);
        border-radius: 50%;
        animation: click-ripple 0.3s ease-out forwards;
      }
      @keyframes click-ripple {
        0% { transform: scale(0.5); opacity: 1; }
        100% { transform: scale(2.5); opacity: 0; }
      }
    `,
  })

  await page.evaluate(() => {
    const cursor = document.createElement('div')
    cursor.className = 'playwright-cursor'
    cursor.id = 'playwright-cursor'
    document.body.appendChild(cursor)

    // Initialize position
    cursor.style.left = window.innerWidth / 2 + 'px'
    cursor.style.top = window.innerHeight / 2 + 'px'

    document.addEventListener('mousemove', (e) => {
      cursor.style.left = e.clientX + 'px'
      cursor.style.top = e.clientY + 'px'
    })

    document.addEventListener('mousedown', () => {
      cursor.classList.add('clicking')
    })

    document.addEventListener('mouseup', () => {
      setTimeout(() => cursor.classList.remove('clicking'), 300)
    })
  })
}

// Human-like click with visual feedback
async function humanClick(page: Page, x: number, y: number) {
  await humanMove(page, x, y)
  await page.waitForTimeout(100) // Brief pause before click
  await page.mouse.click(x, y)
  await page.waitForTimeout(200) // Let click animation play
}

// Wait for fixtures to load
const waitForFixtures = async (page: Page) => {
  await page.getByRole('button', { name: 'Executive strategy review' }).first().waitFor()
}

// Configure video recording at top level (required by Playwright)
test.use({
  viewport: { width: 1440, height: 810 },
  video: {
    mode: 'on',
    size: { width: 1440, height: 810 },
  },
})

test.describe('marketing GIF generation', () => {
  test('day-click-event-tooltip-flow', async ({ page }) => {
    await page.goto('/')
    await waitForFixtures(page)

    // Add the fake cursor
    await addFakeCursor(page)

    // Initialize mouse position (center-ish, away from any elements)
    await page.mouse.move(640, 400)
    await page.waitForTimeout(500) // Let page settle

    // Find January 13, 2026 cell position
    const dayCell = page.locator('[data-date="2026-01-13"]').first()
    const dayBox = await dayCell.boundingBox()

    if (!dayBox) throw new Error('Could not find day cell')

    // Step 1: Hover over the day (move to it slowly)
    const dayCenterX = dayBox.x + dayBox.width / 2
    const dayCenterY = dayBox.y + dayBox.height / 2

    await page.waitForTimeout(300)
    await humanMove(page, dayCenterX, dayCenterY, 40)
    await page.waitForTimeout(600) // Pause to show hover state

    // Step 2: Click on the day to open the day detail popover
    await humanClick(page, dayCenterX, dayCenterY)
    await page.waitForTimeout(400) // Wait for popover animation

    // Wait for popover to be visible
    await page.getByText("Sarah Chen's birthday").waitFor()
    await page.waitForTimeout(500) // Let user see the popover

    // Step 3: Find and click on "Design review session" event
    const designReview = page.getByRole('button', { name: 'Design review session' })
    await designReview.waitFor()
    const eventBox = await designReview.boundingBox()

    if (!eventBox) throw new Error('Could not find event button')

    const eventCenterX = eventBox.x + eventBox.width / 2
    const eventCenterY = eventBox.y + eventBox.height / 2

    // Move to event and hover
    await humanMove(page, eventCenterX, eventCenterY, 35)
    await page.waitForTimeout(400)

    // Click to show tooltip
    await humanClick(page, eventCenterX, eventCenterY)

    // Wait for tooltip to appear
    await page
      .getByRole('tooltip', { name: 'Design review session details' })
      .waitFor({ timeout: 5000 })
    await page.waitForTimeout(1200) // Let user read the tooltip

    // Move mouse away slightly to signal "done"
    await humanMove(page, eventCenterX + 100, eventCenterY - 50, 20)
    await page.waitForTimeout(500)
  })
})

// After test runs, we need to convert the video to GIF
// This is handled by the npm script: npm run gif:generate
