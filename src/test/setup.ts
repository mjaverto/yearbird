import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock IntersectionObserver for scroll-triggered animations
class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null
  readonly rootMargin: string = ''
  readonly thresholds: ReadonlyArray<number> = []

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  constructor(private callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    // Immediately trigger callback with all entries as intersecting
    // This simulates elements being in view for test purposes
    setTimeout(() => {
      this.callback([], this)
    }, 0)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  observe(target: Element): void {
    // No-op in tests
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  unobserve(target: Element): void {
    // No-op in tests
  }

  disconnect(): void {
    // No-op in tests
  }

  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  value: MockIntersectionObserver,
})
