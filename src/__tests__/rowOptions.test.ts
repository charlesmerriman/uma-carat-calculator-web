import { describe, it, expect } from 'vitest'
import {
  hasRowOptions,
  pullsForChance,
  pullsToNextExchange,
  rowSpendSettings,
} from '../utils/rowOptions'
import {
  calculateCopyDistribution,
  calculateSuccessProbability,
  pityExchanges,
  twoCardDistribution,
} from '../utils/probabilityCalculations'
import { applyPullStrategy, getPullCountStatus } from '../utils/bannerHelpers'
import type { UserPlannedBanner } from '../types'

const GLOBALS = {
  spend_tickets_on_banners: true,
  discounted_paid_pulls: true,
  full_price_paid_pulls: false,
}

describe('rowSpendSettings', () => {
  it('follows the globals when the row sets nothing', () => {
    expect(rowSpendSettings({}, GLOBALS)).toEqual({
      spendTickets: true,
      ticketLimit: Infinity,
      discountedPaidPulls: true,
      fullPricePaidPulls: false,
    })
  })

  it('lets a row ticket number win over the switch being off', () => {
    const settings = rowSpendSettings(
      { tickets_to_use: 3 },
      { ...GLOBALS, spend_tickets_on_banners: false }
    )
    expect(settings.spendTickets).toBe(true)
    expect(settings.ticketLimit).toBe(3)
  })

  it('treats a missing global switch as on, as before the switch existed', () => {
    const settings = rowSpendSettings(
      {},
      { ...GLOBALS, spend_tickets_on_banners: undefined as unknown as boolean }
    )
    expect(settings.spendTickets).toBe(true)
  })

  it("replaces both paid toggles with the row's choice", () => {
    expect(rowSpendSettings({ paid_carat_use: 'none' }, GLOBALS)).toMatchObject({
      discountedPaidPulls: false, fullPricePaidPulls: false,
    })
    expect(rowSpendSettings({ paid_carat_use: 'discount' }, { ...GLOBALS, discounted_paid_pulls: false }))
      .toMatchObject({ discountedPaidPulls: true, fullPricePaidPulls: false })
    expect(rowSpendSettings({ paid_carat_use: 'all' }, GLOBALS)).toMatchObject({
      discountedPaidPulls: true, fullPricePaidPulls: true,
    })
  })
})

describe('hasRowOptions', () => {
  const row = { number_of_pulls: 0, reserved_copies: 0, tempId: 1 } as UserPlannedBanner
  it('is false for an untouched row and true for any override', () => {
    expect(hasRowOptions(row)).toBe(false)
    expect(hasRowOptions({ ...row, tickets_to_use: 0 })).toBe(true)
    expect(hasRowOptions({ ...row, paid_carat_use: 'all' })).toBe(true)
    expect(hasRowOptions({ ...row, pulls_already_made: 5 })).toBe(true)
    expect(hasRowOptions({ ...row, excluded_from_projection: true })).toBe(true)
    // The defaults spelled out are still "untouched".
    expect(hasRowOptions({ ...row, tickets_to_use: null, pulls_already_made: 0 })).toBe(false)
  })
})

describe('pulls already made and the exchange counter', () => {
  it('counts the banner counter, not just the planned pulls', () => {
    expect(pityExchanges(200)).toBe(1)
    // 120 made + 80 planned crosses 200.
    expect(pityExchanges(80, 120)).toBe(1)
    // An exchange the counter passed before the plan is history, not a new copy.
    expect(pityExchanges(50, 250)).toBe(0)
    expect(pityExchanges(150, 250)).toBe(1)
  })

  it('moves the odds: 80 pulls on top of 120 made guarantee one copy', () => {
    expect(calculateSuccessProbability(80, 1, 0.0075)).toBeLessThan(50)
    expect(calculateSuccessProbability(80, 1, 0.0075, 120)).toBe(100)
    // The distribution's "none" cell goes to zero for the same reason.
    expect(calculateCopyDistribution(80, 0.0075, 120)[0]).toBe(0)
  })

  it('feeds the two-card pot', () => {
    const base = { pulls: 80, rateA: 0.0075, rateB: 0.0075, reservedCopies: 0, targetA: 1 }
    const without = twoCardDistribution(base)
    const withPrior = twoCardDistribution({ ...base, priorPulls: 120 })
    // With the exchange, A at 1x is certain, so the cells sum to 100.
    const sum = (cells: number[]) => cells.reduce((a, b) => a + b, 0)
    expect(sum(withPrior)).toBeCloseTo(100, 6)
    expect(sum(without)).toBeLessThan(50)
  })

  it('greens the count when the whole counter lands on a threshold', () => {
    expect(getPullCountStatus(80, Infinity, 120)).toBe('ok')
    expect(getPullCountStatus(200, Infinity, 120)).toBe('neutral')
    expect(getPullCountStatus(200, Infinity)).toBe('ok')
  })
})

describe('pullsToNextExchange', () => {
  it('reaches the next 200 on the counter', () => {
    expect(pullsToNextExchange(0, 0)).toBe(200)
    expect(pullsToNextExchange(120, 0)).toBe(80)
    expect(pullsToNextExchange(0, 250)).toBe(400)
    // Already on a threshold: one MORE exchange.
    expect(pullsToNextExchange(0, 200)).toBe(400)
  })
})

describe('pullsForChance', () => {
  // A 0.75% card, one copy. P(at least 1 in n) = 1 - 0.9925^n until the
  // exchange at 200 makes it certain.
  //   n = 92: 1 - 0.9925^92 = 49.97%  (short)
  //   n = 93: 1 - 0.9925^93 = 50.35%  (enough)
  //   n = 199: 77.6%, so 90% is first reached by the exchange at 200.
  it('finds the fewest pulls, matching the strip it is built from', () => {
    expect(pullsForChance({ copies: 1, chance: 0.5, rate: 0.0075 })).toBe(93)
    expect(pullsForChance({ copies: 1, chance: 0.9, rate: 0.0075 })).toBe(200)
    const n = pullsForChance({ copies: 5, chance: 0.5, rate: 0.0075 })
    expect(calculateSuccessProbability(n, 5, 0.0075)).toBeGreaterThanOrEqual(50)
    expect(calculateSuccessProbability(n - 1, 5, 0.0075)).toBeLessThan(50)
  })

  it('counts pulls already made toward the exchange', () => {
    // 150 made: the exchange is 50 pulls away, and 49 pulls alone give ~31%.
    expect(pullsForChance({ copies: 1, chance: 0.9, rate: 0.0075, alreadyMade: 150 })).toBe(50)
    expect(pullsForChance({ copies: 1, chance: 0.5, rate: 0.0075, alreadyMade: 150 })).toBe(50)
  })

  it('needs no pulls when reserved copies already cover the target', () => {
    expect(pullsForChance({ copies: 2, chance: 0.9, rate: 0.0075, guaranteed: 2 })).toBe(0)
  })
})

describe('applyPullStrategy ticket ceiling', () => {
  const input = {
    isUmaBanner: true,
    plannedPulls: 10,
    freePulls: 0,
    umaTickets: 8,
    supportTickets: 0,
    freeCarats: 3000,
    paidCarats: 0,
    discountDays: 10,
    discountedPaidPulls: false,
    fullPricePaidPulls: false,
  }

  it('spends at most the limit, and the rest from carats', () => {
    const result = applyPullStrategy({ ...input, ticketLimit: 3 })
    expect(result.umaTickets).toBe(5)
    expect(result.freeCarats).toBe(3000 - 7 * 150)
  })

  it('counts only the usable tickets in Max Pulls', () => {
    const limited = applyPullStrategy({ ...input, ticketLimit: 3 })
    const unlimited = applyPullStrategy(input)
    expect(unlimited.maxPossiblePulls - limited.maxPossiblePulls).toBe(5)
    expect(limited.maxPullBreakdown.tickets).toBe(3)
  })

  it('is the old behaviour with no limit', () => {
    const result = applyPullStrategy(input)
    expect(result.umaTickets).toBe(0)
    expect(result.freeCarats).toBe(3000 - 2 * 150)
  })
})
