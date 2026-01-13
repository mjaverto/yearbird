import { beforeEach, describe, expect, it } from 'vitest'
import {
  getTimedEventMinHours,
  setTimedEventMinHours,
  getMatchDescription,
  setMatchDescription,
  getWeekViewEnabled,
  setWeekViewEnabled,
  getMonthScrollEnabled,
  setMonthScrollEnabled,
  getMonthScrollDensity,
  setMonthScrollDensity,
} from './displaySettings'

describe('displaySettings (in-memory)', () => {
  // Reset to defaults before each test
  beforeEach(() => {
    setTimedEventMinHours(3)
    setMatchDescription(false)
    setWeekViewEnabled(false)
    setMonthScrollEnabled(false)
    setMonthScrollDensity(60)
  })

  describe('getTimedEventMinHours', () => {
    it('returns 3 by default', () => {
      expect(getTimedEventMinHours()).toBe(3)
    })

    it('returns 0 when set to show all timed events', () => {
      setTimedEventMinHours(0)
      expect(getTimedEventMinHours()).toBe(0)
    })

    it('returns the set value', () => {
      setTimedEventMinHours(4)
      expect(getTimedEventMinHours()).toBe(4)
    })

    it('clamps values to 0-24 range', () => {
      setTimedEventMinHours(-5)
      expect(getTimedEventMinHours()).toBe(0)

      setTimedEventMinHours(30)
      expect(getTimedEventMinHours()).toBe(24)
    })

    it('handles fractional values', () => {
      setTimedEventMinHours(1.5)
      expect(getTimedEventMinHours()).toBe(1.5)
    })
  })

  describe('setTimedEventMinHours', () => {
    it('updates the in-memory state', () => {
      expect(getTimedEventMinHours()).toBe(3)
      setTimedEventMinHours(5)
      expect(getTimedEventMinHours()).toBe(5)
    })
  })

  describe('getMatchDescription', () => {
    it('returns false by default', () => {
      expect(getMatchDescription()).toBe(false)
    })

    it('returns true after being set to true', () => {
      setMatchDescription(true)
      expect(getMatchDescription()).toBe(true)
    })

    it('returns false after being set back to false', () => {
      setMatchDescription(true)
      expect(getMatchDescription()).toBe(true)
      setMatchDescription(false)
      expect(getMatchDescription()).toBe(false)
    })
  })

  describe('setMatchDescription', () => {
    it('updates the in-memory state', () => {
      expect(getMatchDescription()).toBe(false)
      setMatchDescription(true)
      expect(getMatchDescription()).toBe(true)
    })
  })

  describe('weekViewEnabled - regression tests for cloud sync', () => {
    it('returns false by default', () => {
      expect(getWeekViewEnabled()).toBe(false)
    })

    it('returns true after being set to true', () => {
      setWeekViewEnabled(true)
      expect(getWeekViewEnabled()).toBe(true)
    })

    it('returns false after being set back to false', () => {
      setWeekViewEnabled(true)
      expect(getWeekViewEnabled()).toBe(true)
      setWeekViewEnabled(false)
      expect(getWeekViewEnabled()).toBe(false)
    })

    it('persists value in memory between get calls', () => {
      setWeekViewEnabled(true)
      expect(getWeekViewEnabled()).toBe(true)
      expect(getWeekViewEnabled()).toBe(true) // Same value on subsequent call
    })
  })

  describe('monthScrollEnabled - regression tests for cloud sync', () => {
    it('returns false by default', () => {
      expect(getMonthScrollEnabled()).toBe(false)
    })

    it('returns true after being set to true', () => {
      setMonthScrollEnabled(true)
      expect(getMonthScrollEnabled()).toBe(true)
    })

    it('returns false after being set back to false', () => {
      setMonthScrollEnabled(true)
      expect(getMonthScrollEnabled()).toBe(true)
      setMonthScrollEnabled(false)
      expect(getMonthScrollEnabled()).toBe(false)
    })
  })

  describe('monthScrollDensity - regression tests for cloud sync', () => {
    it('returns 60 by default', () => {
      expect(getMonthScrollDensity()).toBe(60)
    })

    it('returns the set value', () => {
      setMonthScrollDensity(80)
      expect(getMonthScrollDensity()).toBe(80)
    })

    it('can be set to 0', () => {
      setMonthScrollDensity(0)
      expect(getMonthScrollDensity()).toBe(0)
    })

    it('can be set to 100', () => {
      setMonthScrollDensity(100)
      expect(getMonthScrollDensity()).toBe(100)
    })

    it('persists value in memory between get calls', () => {
      setMonthScrollDensity(70)
      expect(getMonthScrollDensity()).toBe(70)
      expect(getMonthScrollDensity()).toBe(70) // Same value on subsequent call
    })
  })
})
