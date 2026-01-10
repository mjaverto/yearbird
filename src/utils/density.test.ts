import { describe, expect, it } from 'vitest'
import { getDensityScale } from './density'

describe('getDensityScale', () => {
  it('returns 0 for density 0', () => {
    expect(getDensityScale(0)).toBe(0)
  })

  it('returns 1 for density 100', () => {
    expect(getDensityScale(100)).toBe(1)
  })

  it('returns 0.5 for density 50', () => {
    expect(getDensityScale(50)).toBe(0.5)
  })

  it('clamps values below 0 to 0', () => {
    expect(getDensityScale(-10)).toBe(0)
    expect(getDensityScale(-100)).toBe(0)
  })

  it('clamps values above 100 to 1', () => {
    expect(getDensityScale(150)).toBe(1)
    expect(getDensityScale(200)).toBe(1)
  })

  it('handles decimal inputs', () => {
    expect(getDensityScale(25.5)).toBeCloseTo(0.255)
    expect(getDensityScale(75.25)).toBeCloseTo(0.7525)
  })
})
