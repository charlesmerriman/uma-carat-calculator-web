import { describe, it, expect } from 'vitest'
import {
  allocateReservedCopies,
  applyPullStrategy,
  applyStepUpStrategy,
  bannerKey,
  comparePlannedBanners,
  getPullCountStatus,
  getReservedStatus,
  getStepCountStatus,
  nextTempId,
  plannedBannerKey,
  plannedBannerTarget,
  plannedBannerTimeline,
  plannedBannerRowType,
  plannedPulls,
  plannedSteps,
  getFreePulls,
} from '../utils/bannerHelpers'
import type { PullStrategyInput } from '../utils/bannerHelpers'
import { DEFAULT_CONSTANTS as C } from '../constants/gameConstants'
import type { SelectorTicketBucket } from '../utils/selectorTickets'
import type { BannerSupport, BannerUma, BannerStepUp, UserPlannedBanner } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** A neutral strategy input: no resources, default toggles (full price on). */
const baseInput: PullStrategyInput = {
  isUmaBanner: true,
  plannedPulls: 0,
  freePulls: 0,
  umaTickets: 0,
  supportTickets: 0,
  freeCarats: 0,
  paidCarats: 0,
  discountDays: 0,
  discountedPaidPulls: false,
  fullPricePaidPulls: true,
}

function strat(overrides: Partial<PullStrategyInput>) {
  return applyPullStrategy({ ...baseInput, ...overrides })
}

// ── maxPossiblePulls ──────────────────────────────────────────────────────────

describe('applyPullStrategy — maxPossiblePulls', () => {
  it('sums free pulls, matching tickets, and floor(carats / 150)', () => {
    const { maxPossiblePulls } = strat({ freePulls: 3, umaTickets: 2, freeCarats: 1_000 })
    expect(maxPossiblePulls).toBe(3 + 2 + 6) // floor(1000 / 150) = 6
  })

  it('floors fractional carat-pulls (does not round up)', () => {
    expect(strat({ freeCarats: 149 }).maxPossiblePulls).toBe(0)
  })

  it('clamps to 0 when carats are negative (earlier banners overspent)', () => {
    expect(strat({ freeCarats: -5_000 }).maxPossiblePulls).toBe(0)
  })

  it('a small ticket/free count cannot rescue a large negative carat balance', () => {
    // 1 + 1 + floor(-5000 / 150) = 1 + 1 - 34 = -32 → clamped to 0
    expect(strat({ freePulls: 1, umaTickets: 1, freeCarats: -5_000 }).maxPossiblePulls).toBe(0)
  })

  it('combines free + paid remainders at full price (fungible carats)', () => {
    // 100 free + 100 paid = 200 → one full-price pull, not zero.
    expect(strat({ freeCarats: 100, paidCarats: 100 }).maxPossiblePulls).toBe(1)
  })

  it('excludes paid carats from the max when full_price_paid_pulls is off', () => {
    expect(
      strat({ freeCarats: 100, paidCarats: 1_000, fullPricePaidPulls: false }).maxPossiblePulls
    ).toBe(0) // floor(100 / 150) = 0; the 1000 paid is reserved
  })

  it('adds discounted pulls (capped by paid balance) to the max', () => {
    // 100 paid = 2 discounted pulls; full price off isolates the discount.
    expect(
      strat({
        paidCarats: 100,
        discountDays: 10,
        discountedPaidPulls: true,
        fullPricePaidPulls: false,
      }).maxPossiblePulls
    ).toBe(2)
  })

  it('caps discounted pulls at discountDays, spilling leftover paid to full price', () => {
    // Day cap 1 → 1 discounted pull (50 spent); remaining 950 paid at full price
    // = floor(950 / 150) = 6. Total 7.
    expect(
      strat({
        paidCarats: 1_000,
        discountDays: 1,
        discountedPaidPulls: true,
        fullPricePaidPulls: true,
      }).maxPossiblePulls
    ).toBe(1 + 6)
  })
})

// ── maxPullBreakdown ──────────────────────────────────────────────────────────

describe('applyPullStrategy — maxPullBreakdown', () => {
  it('decomposes the max without changing it', () => {
    const { maxPossiblePulls, maxPullBreakdown: b } = strat({
      freePulls: 3,
      umaTickets: 2,
      freeCarats: 1_000,
    })
    expect(b).toEqual({ freePulls: 3, tickets: 2, paidPulls: 0, freeCaratPulls: 6 })
    expect(b.freePulls + b.tickets + b.paidPulls + b.freeCaratPulls).toBe(maxPossiblePulls)
  })

  it('reports the matching ticket type only (no cross-substitution)', () => {
    expect(strat({ umaTickets: 5, supportTickets: 9 }).maxPullBreakdown.tickets).toBe(5)
    expect(
      strat({ isUmaBanner: false, umaTickets: 5, supportTickets: 9 }).maxPullBreakdown.tickets
    ).toBe(9)
  })

  it('attributes a full-price pull that only exists thanks to paid carats to paid', () => {
    // 100 free alone buys nothing; +500 paid makes 4 pulls. All 4 are marginal.
    const b = strat({ freeCarats: 100, paidCarats: 500 }).maxPullBreakdown
    expect(b).toMatchObject({ paidPulls: 4, freeCaratPulls: 0 })
  })

  it('puts the shared boundary pull in the paid bucket, not the free one', () => {
    // 200 free + 100 paid = 2 pulls. Free alone affords 1, so the second pull —
    // paid for by a free remainder plus paid carats — counts as paid.
    const b = strat({ freeCarats: 200, paidCarats: 100 }).maxPullBreakdown
    expect(b).toMatchObject({ paidPulls: 1, freeCaratPulls: 1 })
  })

  it('counts discounted pulls as paid', () => {
    const b = strat({
      paidCarats: 500,
      discountDays: 10,
      discountedPaidPulls: true,
    }).maxPullBreakdown
    expect(b).toMatchObject({ paidPulls: 10, freeCaratPulls: 0 })
  })

  it('reports 0 paid pulls when both paid-pull settings are off', () => {
    const b = strat({
      freeCarats: 900,
      paidCarats: 500,
      discountedPaidPulls: false,
      fullPricePaidPulls: false,
    }).maxPullBreakdown
    expect(b).toMatchObject({ paidPulls: 0, freeCaratPulls: 6 })
  })

  it('clamps each part at 0 under a carat deficit, so the parts can exceed the total', () => {
    // The total clamps to 0, but the free pulls and tickets really are still
    // available — the deficit is a carat debt, not a lost ticket.
    const { maxPossiblePulls, maxPullBreakdown: b } = strat({
      freePulls: 5,
      umaTickets: 3,
      freeCarats: -5_000,
    })
    expect(maxPossiblePulls).toBe(0)
    expect(b).toEqual({ freePulls: 5, tickets: 3, paidPulls: 0, freeCaratPulls: 0 })
  })
})

// ── Actual spend (leftover balances) ────────────────────────────────────────────

describe('applyPullStrategy — spend', () => {
  it('spends matching tickets before carats', () => {
    const r = strat({ plannedPulls: 5, umaTickets: 2, freeCarats: 1_000 })
    expect(r.umaTickets).toBe(0)
    expect(r.freeCarats).toBe(1_000 - 3 * 150) // 3 remaining pulls at 150
    expect(r.paidCarats).toBe(0)
  })

  it('uses support tickets (not uma) for a support banner', () => {
    const r = strat({ isUmaBanner: false, plannedPulls: 3, supportTickets: 1, freeCarats: 1_000 })
    expect(r.supportTickets).toBe(0)
    expect(r.freeCarats).toBe(1_000 - 2 * 150)
  })

  it('spends paid carats at the discount rate (50) when enabled', () => {
    const r = strat({
      plannedPulls: 3,
      paidCarats: 500,
      discountDays: 10,
      discountedPaidPulls: true,
    })
    expect(r.paidCarats).toBe(500 - 3 * 50) // 3 discounted pulls
    expect(r.freeCarats).toBe(0)
  })

  it('spends free carats before paid carats (preserving paid for discounts)', () => {
    const r = strat({ plannedPulls: 1, freeCarats: 200, paidCarats: 200 })
    expect(r.freeCarats).toBe(200 - 150)
    expect(r.paidCarats).toBe(200) // untouched — free covered the pull
  })

  it('reserves paid carats when full_price_paid_pulls is off (deficit on free)', () => {
    const r = strat({ plannedPulls: 2, freeCarats: 100, paidCarats: 1_000, fullPricePaidPulls: false })
    expect(r.paidCarats).toBe(1_000) // reserved, never spent
    expect(r.freeCarats).toBe(100 - 2 * 150) // -200: the shortfall shows as a deficit
  })

  it('falls through discount → free → full-price paid in order', () => {
    // 3 pulls: 1 discounted (day cap 1, 50 paid), then 0 free, then 2 at full
    // price paid from the remaining paid carats.
    const r = strat({
      plannedPulls: 3,
      freeCarats: 0,
      paidCarats: 500,
      discountDays: 1,
      discountedPaidPulls: true,
      fullPricePaidPulls: true,
    })
    // 1 discount (50) + 2 full price (300) = 350 paid spent.
    expect(r.paidCarats).toBe(500 - 350)
    expect(r.freeCarats).toBe(0)
  })
})

// ── getPullCountStatus ────────────────────────────────────────────────────────

describe('getPullCountStatus', () => {
  it('flags a count above the affordable max as "over"', () => {
    expect(getPullCountStatus(31, 30)).toBe('over')
  })

  it('treats exactly the max as affordable, not over', () => {
    expect(getPullCountStatus(30, 30)).toBe('neutral')
  })

  it('returns "ok" on a pity threshold', () => {
    expect(getPullCountStatus(200, 1_000)).toBe('ok')
    expect(getPullCountStatus(400, 1_000)).toBe('ok')
  })

  it('returns "neutral" one pull either side of a threshold', () => {
    expect(getPullCountStatus(199, 1_000)).toBe('neutral')
    expect(getPullCountStatus(201, 1_000)).toBe('neutral')
  })

  it('keeps 0 neutral even though it divides evenly', () => {
    // Every untouched row sits at 0; greening them would drain the signal.
    expect(getPullCountStatus(0, 1_000)).toBe('neutral')
  })
})

// ── getStepCountStatus ──────────────────────────────────────────

describe('getStepCountStatus', () => {
  it('flags a count above the affordable max as "over"', () => {
    expect(getStepCountStatus(11, 10)).toBe('over')
  })

  it('treats exactly the max as affordable, not over', () => {
    expect(getStepCountStatus(10, 10)).toBe('ok')
  })

  it('returns "ok" on a completed round, not on the pity threshold', () => {
    // The step-up green fires every 5, where the pull version fires every 200.
    expect(getStepCountStatus(5, 35)).toBe('ok')
    expect(getStepCountStatus(15, 35)).toBe('ok')
    expect(getStepCountStatus(200, 400)).toBe('ok')
  })

  it('returns "neutral" one step either side of a round', () => {
    expect(getStepCountStatus(4, 35)).toBe('neutral')
    expect(getStepCountStatus(6, 35)).toBe('neutral')
  })

  it('keeps 0 neutral even though it divides evenly', () => {
    expect(getStepCountStatus(0, 35)).toBe('neutral')
  })

  it('reports "over" ahead of "ok" when a round is also unaffordable', () => {
    // Both states are true at 10 steps with 6 affordable; the budget is the
    // more actionable message, exactly as getPullCountStatus decides.
    expect(getStepCountStatus(10, 6)).toBe('over')
  })

  it('opts out of "over" entirely when no bound is known', () => {
    expect(getStepCountStatus(35, Infinity)).toBe('ok')
  })

  it('prefers "over" when a count is both on-pity and unaffordable', () => {
    expect(getPullCountStatus(400, 300)).toBe('over')
  })

  it('never reports "over" when the bound is Infinity (staged banner)', () => {
    expect(getPullCountStatus(9_999, Infinity)).toBe('neutral')
    expect(getPullCountStatus(200, Infinity)).toBe('ok')
  })

  it('flags any pulls on an ended banner, whose bound is 0', () => {
    expect(getPullCountStatus(1, 0)).toBe('over')
    expect(getPullCountStatus(0, 0)).toBe('neutral')
  })
})

// ── bannerKey / plannedBannerKey ──────────────────────────────────────────────

describe('plannedBannerTarget — the narrowing seam', () => {
  const timeline = {
    id: 1,
    name: 'Window',
    banner_category: 'standard' as const,
    start_date: '2099-01-01T22:00:00Z',
    end_date: '2099-02-01T21:59:59Z',
    is_predicted: false,
    jp_start_date: null,
    jp_end_date: null,
    global_start_date: '2099-01-01T22:00:00Z',
    global_end_date: '2099-02-01T21:59:59Z',
    schedule_offset_days: 0,
    applied_offset_days: 0,
    image: '',
  }

  const umaBanner: BannerUma = {
    id: 1, banner_timeline: timeline, name: 'Uma', admin_comments: '',
    umas: [], free_pulls: 3, is_recommended: false,
  }
  const supportBanner: BannerSupport = {
    id: 2, banner_timeline: timeline, name: 'Support', admin_comments: '',
    support_cards: [], free_pulls: 5, is_recommended: false,
  }
  const stepUpBanner: BannerStepUp = {
    id: 3, banner_timeline: timeline, anniversary_event: 14,
    name: '5th Anniversary SSR Select Step-Up', card_type: 'support',
    banner_count: 3, max_steps: 15, jp_cutoff_date: '2026-01-30',
    image: null, admin_comments: '', order: 0,
  }

  it('tags each of the three banner kinds', () => {
    expect(plannedBannerTarget({ banner_uma: umaBanner }).type).toBe('Uma')
    expect(plannedBannerTarget({ banner_support: supportBanner }).type).toBe('Support')
    expect(plannedBannerTarget({ banner_step_up: stepUpBanner }).type).toBe('StepUp')
  })

  it('reports a row with no banner as Empty rather than guessing a kind', () => {
    // The bug this replaces: `b.banner_support ? "Support" : "Uma"` read an
    // empty row as an uma banner by luck.
    const target = plannedBannerTarget({})
    expect(target.type).toBe('Empty')
    expect(target.banner).toBeNull()
    expect(target.timeline).toBeNull()
  })

  it('treats explicit nulls as absent, not as a selection', () => {
    expect(
      plannedBannerTarget({ banner_uma: null, banner_support: null, banner_step_up: null }).type
    ).toBe('Empty')
  })

  it('resolves the timeline identically for all three kinds', () => {
    // The property the whole income engine rests on: income is a pure function
    // of a banner's end date, and every kind carries the same timeline FK.
    expect(plannedBannerTimeline({ banner_uma: umaBanner })).toBe(timeline)
    expect(plannedBannerTimeline({ banner_support: supportBanner })).toBe(timeline)
    expect(plannedBannerTimeline({ banner_step_up: stepUpBanner })).toBe(timeline)
    expect(plannedBannerTimeline({})).toBeNull()
  })

  it('prefers the FK over a staged row\'s declared type', () => {
    // A staged Support row that ends up holding an uma banner is an uma row.
    expect(
      plannedBannerRowType({ banner_uma: umaBanner, initialBannerType: 'Support' })
    ).toBe('Uma')
  })

  it('falls back to the staged type only when there is no FK', () => {
    expect(plannedBannerRowType({ initialBannerType: 'StepUp' })).toBe('StepUp')
    expect(plannedBannerRowType({ initialBannerType: 'Support' })).toBe('Support')
  })

  it('reads the overloaded count as the unit the row measures', () => {
    // number_of_pulls carries STEPS on a step-up row, mirroring the source
    // sheet's own overload. Each accessor returns 0 for the wrong kind, so a
    // mixed-up call site shows an empty number rather than a plausible one.
    const stepUpRow = { banner_step_up: stepUpBanner, number_of_pulls: 10 }
    expect(plannedSteps(stepUpRow)).toBe(10)
    expect(plannedPulls(stepUpRow)).toBe(0)

    const umaRow = { banner_uma: umaBanner, number_of_pulls: 200 }
    expect(plannedPulls(umaRow)).toBe(200)
    expect(plannedSteps(umaRow)).toBe(0)
  })

  it('keys a step-up separately from same-id banners of other kinds', () => {
    // Same reason uma and support cannot share a key: three tables, three
    // independent autoincrement PKs.
    const keys = new Set([
      bannerKey('Uma', 1),
      bannerKey('Support', 1),
      bannerKey('StepUp', 1),
    ])
    expect(keys.size).toBe(3)
    expect(plannedBannerKey({ banner_step_up: stepUpBanner })).toBe(bannerKey('StepUp', 3))
  })

  it('gives a step-up zero free pulls, not an unknown', () => {
    // Every step-up pull is bought with paid carats up the cost ladder, so 0 is
    // the real answer. Only a row with NO banner reads as blank.
    expect(getFreePulls({ banner_step_up: stepUpBanner } as UserPlannedBanner)).toBe(0)
    expect(getFreePulls({ banner_uma: umaBanner } as UserPlannedBanner)).toBe(3)
    expect(getFreePulls({} as UserPlannedBanner)).toBe('')
  })
})

describe('comparePlannedBanners — the planner sheet row order', () => {
  const timelineAt = (start: string, id: number) => ({
    id,
    name: `Window ${id}`,
    banner_category: 'standard' as const,
    start_date: start,
    end_date: '2099-12-01T21:59:59Z',
    is_predicted: false,
    jp_start_date: null,
    jp_end_date: null,
    global_start_date: start,
    global_end_date: '2099-12-01T21:59:59Z',
    schedule_offset_days: 0,
    applied_offset_days: 0,
    image: '',
  })

  const SAME = '2099-03-01T22:00:00Z'
  const LATER = '2099-04-01T22:00:00Z'

  const umaRow = (start: string): Partial<UserPlannedBanner> => ({
    banner_uma: {
      id: 1, banner_timeline: timelineAt(start, 1), name: 'Uma',
      admin_comments: '', umas: [], free_pulls: 3, is_recommended: false,
    } as BannerUma,
  })
  const supportRow = (start: string): Partial<UserPlannedBanner> => ({
    banner_support: {
      id: 2, banner_timeline: timelineAt(start, 2), name: 'Support',
      admin_comments: '', support_cards: [], free_pulls: 5, is_recommended: false,
    } as BannerSupport,
  })
  const stepUpRow = (
    start: string,
    card_type: 'uma' | 'support'
  ): Partial<UserPlannedBanner> => ({
    banner_step_up: {
      id: card_type === 'uma' ? 3 : 4, banner_timeline: timelineAt(start, 3),
      anniversary_event: 14, name: `Step-Up ${card_type}`, card_type,
      banner_count: 3, max_steps: 15, jp_cutoff_date: '2026-01-30',
      image: null, admin_comments: '', order: 0,
    } as BannerStepUp,
  })

  const kinds = (rows: Partial<UserPlannedBanner>[]) =>
    rows.map((r) => plannedBannerTarget(r).type)

  it('orders a same-day campaign Uma, Support, Step-Up Uma, Step-Up Support', () => {
    // Shuffled deliberately: the input order must not survive the sort.
    const rows = [
      stepUpRow(SAME, 'support'),
      supportRow(SAME),
      stepUpRow(SAME, 'uma'),
      umaRow(SAME),
    ]
    const sorted = [...rows].sort(comparePlannedBanners)
    expect(kinds(sorted)).toEqual(['Uma', 'Support', 'StepUp', 'StepUp'])
    // The two step-ups split on card_type, which the row type alone cannot say.
    expect(sorted[2].banner_step_up?.card_type).toBe('uma')
    expect(sorted[3].banner_step_up?.card_type).toBe('support')
  })

  it('never lets the kind tie-break outrank the start date', () => {
    // A step-up support banner opening first still sorts above a later uma
    // banner — the rank is the SECOND key, not the first.
    const sorted = [umaRow(LATER), stepUpRow(SAME, 'support')].sort(
      comparePlannedBanners
    )
    expect(sorted[0].banner_step_up?.card_type).toBe('support')
  })

  it('sorts an undated row last without producing a NaN comparison', () => {
    // Infinity - Infinity is NaN; two undated rows must still compare cleanly
    // or the whole sort corrupts.
    const undated = {} as UserPlannedBanner
    const sorted = [undated, umaRow(SAME), undated].sort(comparePlannedBanners)
    expect(kinds(sorted)).toEqual(['Uma', 'Empty', 'Empty'])
  })
})

describe('bannerKey / plannedBannerKey', () => {
  // The seed data populates BannerUma and BannerSupport in lockstep, so an uma
  // banner and a support banner sharing an id usually also share a
  // BannerTimeline — and therefore a date. These two stand in for that pairing.
  const timeline = {
    id: 1,
    name: 'Shared Window',
    start_date: '2099-01-01T22:00:00Z',
    end_date: '2099-02-01T21:59:59Z',
    is_predicted: false,
    jp_start_date: null,
    jp_end_date: null,
    global_start_date: '2099-01-01T22:00:00Z',
    global_end_date: '2099-02-01T21:59:59Z',
    image: '',
  }

  const umaBanner: BannerUma = {
    id: 1,
    banner_timeline: timeline,
    name: 'Uma Banner',
    admin_comments: '',
    umas: [],
    free_pulls: 0,
  }

  const supportBanner: BannerSupport = {
    id: 1,
    banner_timeline: timeline,
    name: 'Support Banner',
    admin_comments: '',
    support_cards: [],
    free_pulls: 0,
  }

  it('never collides an uma banner with a support banner of the same id', () => {
    // The whole reason this key exists. BannerUma and BannerSupport are separate
    // tables with independent autoincrement PKs, so id alone is ambiguous.
    expect(bannerKey('Uma', 1)).not.toBe(bannerKey('Support', 1))
  })

  it('is stable for the same type and id', () => {
    expect(bannerKey('Uma', 7)).toBe(bannerKey('Uma', 7))
    expect(bannerKey('Support', 7)).toBe(bannerKey('Support', 7))
  })

  it('distinguishes different ids within a type', () => {
    expect(bannerKey('Uma', 1)).not.toBe(bannerKey('Uma', 2))
  })

  it('keys a planned row by whichever banner it holds', () => {
    expect(plannedBannerKey({ banner_uma: umaBanner })).toBe(bannerKey('Uma', 1))
    expect(plannedBannerKey({ banner_support: supportBanner })).toBe(
      bannerKey('Support', 1)
    )
  })

  it('gives same-date uma and support rows distinct keys', () => {
    // The regression: planning the uma banner must not mark the support banner
    // from the same window as already planned.
    const planned = [{ banner_uma: umaBanner }, { banner_support: supportBanner }]
    const keys = new Set(planned.map(plannedBannerKey))
    expect(keys.size).toBe(2)
  })

  it('still catches a genuine same-type duplicate', () => {
    expect(plannedBannerKey({ banner_uma: umaBanner })).toBe(
      plannedBannerKey({ banner_uma: { ...umaBanner } })
    )
  })

  it('returns null for a row with no banner selected yet', () => {
    expect(plannedBannerKey({})).toBeNull()
  })
})

// ── allocateReservedCopies ────────────────────────────────────────────────────

describe('allocateReservedCopies', () => {
  const OLD = '2020-01-01T00:00:00Z'
  const NEW = '2030-01-01T00:00:00Z'

  const base = {
    reservedCopies: 0,
    isUmaBanner: false,
    oldestFeaturedJpDate: OLD as string | null,
    selectorsBarred: false,
    umaSelectorTickets: [] as SelectorTicketBucket[],
    supportSelectorTickets: [] as SelectorTicketBucket[],
    ssrCrystals: 0,
  }

  it('spends no selector when every featured card is barred', () => {
    // An UNRESTRICTED ticket, which skips the date check entirely — so this is
    // the case oldestFeaturedJpDate alone cannot express.
    const result = allocateReservedCopies({
      ...base,
      isUmaBanner: true,
      reservedCopies: 2,
      selectorsBarred: true,
      oldestFeaturedJpDate: null,
      umaSelectorTickets: [{ jpCutoff: null, count: 3 }],
    })
    expect(result.funding).toEqual({ selectors: 0, crystals: 0, unfunded: 2 })
    // The tickets are untouched — unspendable here, still spendable elsewhere.
    expect(result.umaSelectorTickets).toEqual([{ jpCutoff: null, count: 3 }])
  })

  it('still lets crystals cover a barred banner', () => {
    // The intrinsic gate is uma-side; a crystal takes anything.
    const result = allocateReservedCopies({
      ...base,
      reservedCopies: 2,
      selectorsBarred: true,
      supportSelectorTickets: [{ jpCutoff: null, count: 3 }],
      ssrCrystals: 5,
    })
    expect(result.funding).toEqual({ selectors: 0, crystals: 2, unfunded: 0 })
    expect(result.ssrCrystals).toBe(3)
  })

  it('spends nothing for a zero reserve', () => {
    const result = allocateReservedCopies({ ...base, ssrCrystals: 5 })
    expect(result.funding).toEqual({ selectors: 0, crystals: 0, unfunded: 0 })
    expect(result.ssrCrystals).toBe(5)
  })

  it('spends selectors before crystals', () => {
    const result = allocateReservedCopies({
      ...base,
      reservedCopies: 2,
      supportSelectorTickets: [{ jpCutoff: null, count: 3 }],
      ssrCrystals: 5,
    })
    expect(result.funding).toEqual({ selectors: 2, crystals: 0, unfunded: 0 })
    expect(result.ssrCrystals).toBe(5)
  })

  it('falls back to crystals when the selector cannot reach the card', () => {
    const result = allocateReservedCopies({
      ...base,
      reservedCopies: 2,
      oldestFeaturedJpDate: NEW,
      supportSelectorTickets: [{ jpCutoff: '2024-01-31', count: 3 }],
      ssrCrystals: 5,
    })
    expect(result.funding).toEqual({ selectors: 0, crystals: 2, unfunded: 0 })
    expect(result.ssrCrystals).toBe(3)
    // The unusable selectors are untouched.
    expect(result.supportSelectorTickets).toEqual([
      { jpCutoff: '2024-01-31', count: 3 },
    ])
  })

  it('splits across selectors then crystals', () => {
    const result = allocateReservedCopies({
      ...base,
      reservedCopies: 3,
      supportSelectorTickets: [{ jpCutoff: null, count: 1 }],
      ssrCrystals: 5,
    })
    expect(result.funding).toEqual({ selectors: 1, crystals: 2, unfunded: 0 })
  })

  it('never spends crystals on an uma banner', () => {
    const result = allocateReservedCopies({
      ...base,
      isUmaBanner: true,
      reservedCopies: 2,
      ssrCrystals: 9,
    })
    expect(result.funding).toEqual({ selectors: 0, crystals: 0, unfunded: 2 })
    expect(result.ssrCrystals).toBe(9)
  })

  it('uses the uma pool on an uma banner', () => {
    const result = allocateReservedCopies({
      ...base,
      isUmaBanner: true,
      reservedCopies: 1,
      umaSelectorTickets: [{ jpCutoff: null, count: 2 }],
      supportSelectorTickets: [{ jpCutoff: null, count: 2 }],
    })
    expect(result.funding.selectors).toBe(1)
    expect(result.umaSelectorTickets).toEqual([{ jpCutoff: null, count: 1 }])
    expect(result.supportSelectorTickets).toEqual([{ jpCutoff: null, count: 2 }])
  })

  it('reports the shortfall rather than clamping', () => {
    const result = allocateReservedCopies({
      ...base,
      reservedCopies: 4,
      ssrCrystals: 1,
    })
    expect(result.funding).toEqual({ selectors: 0, crystals: 1, unfunded: 3 })
  })

  it('treats an unknown featured date as unreachable by a cutoff selector', () => {
    const result = allocateReservedCopies({
      ...base,
      reservedCopies: 1,
      oldestFeaturedJpDate: null,
      supportSelectorTickets: [{ jpCutoff: '2024-01-31', count: 2 }],
    })
    expect(result.funding).toEqual({ selectors: 0, crystals: 0, unfunded: 1 })
  })

  it('floors a fractional reserve and ignores a negative one', () => {
    expect(
      allocateReservedCopies({ ...base, reservedCopies: 2.9, ssrCrystals: 5 })
        .funding.crystals
    ).toBe(2)
    expect(
      allocateReservedCopies({ ...base, reservedCopies: -1, ssrCrystals: 5 })
        .funding
    ).toEqual({ selectors: 0, crystals: 0, unfunded: 0 })
  })
})

describe('getReservedStatus', () => {
  it('flags an unfunded request', () => {
    expect(getReservedStatus({ selectors: 1, crystals: 0, unfunded: 2 })).toBe('over')
  })

  it('is ok when everything is covered', () => {
    expect(getReservedStatus({ selectors: 0, crystals: 3, unfunded: 0 })).toBe('ok')
  })

  it('is neutral when nothing is reserved', () => {
    expect(getReservedStatus({ selectors: 0, crystals: 0, unfunded: 0 })).toBe('neutral')
  })
})

describe('nextTempId', () => {
  it('clears every id in play, staged and on the sheet alike', () => {
    const sheet = [{ id: 7, number_of_pulls: 0, reserved_copies: 0 }]
    const staged = [{ tempId: 12, number_of_pulls: 0, reserved_copies: 0 }]
    expect(nextTempId(sheet, staged)).toBe(13)
  })

  it('prefers tempId over a stale server id on the same row', () => {
    const sheet = [{ id: 3, tempId: 40, number_of_pulls: 0, reserved_copies: 0 }]
    expect(nextTempId(sheet)).toBe(41)
  })

  it('starts at 1 when nothing exists yet', () => {
    expect(nextTempId([], [])).toBe(1)
  })

  // The reason this takes `prev` from inside a setState updater: staging two
  // banners back to back must never mint the same id twice, since every staged
  // handler selects its row by tempId.
  it('keeps issuing distinct ids as rows accumulate', () => {
    let staged: UserPlannedBanner[] = []
    const sheet: UserPlannedBanner[] = [{ id: 2, number_of_pulls: 0, reserved_copies: 0 }]

    for (let i = 0; i < 3; i++) {
      staged = [...staged, { tempId: nextTempId(sheet, staged), number_of_pulls: 0, reserved_copies: 0 }]
    }

    expect(staged.map((b) => b.tempId)).toEqual([3, 4, 5])
  })
})

// ── applyStepUpStrategy ───────────────────────────────────────────────────────

describe('applyStepUpStrategy', () => {
  /** Three banners = 15 steps in existence, and carats to spare. */
  const base = { plannedSteps: 0, bannerCount: 3, paidCarats: 20_000, constants: C }

  it('charges the ladder and hands back the remainder', () => {
    const result = applyStepUpStrategy({ ...base, plannedSteps: 5 })
    expect(result.caratsSpent).toBe(5_000)
    expect(result.paidCarats).toBe(15_000)
    expect(result.chargeableSteps).toBe(5)
    expect(result.stepLabel).toBe('5x1')
  })

  it('spends nothing at zero steps', () => {
    const result = applyStepUpStrategy(base)
    expect(result.caratsSpent).toBe(0)
    expect(result.paidCarats).toBe(20_000)
    expect(result.stepLabel).toBe('0')
  })

  it('caps maxPossibleSteps at the steps that actually exist', () => {
    // One banner is five steps, however deep the wallet.
    const result = applyStepUpStrategy({ ...base, bannerCount: 1, paidCarats: 999_999 })
    expect(result.maxPossibleSteps).toBe(5)
  })

  it('caps maxPossibleSteps at what the paid carats reach', () => {
    const result = applyStepUpStrategy({ ...base, paidCarats: 1_200 })
    expect(result.maxPossibleSteps).toBe(2)
  })

  it('clamps chargeable steps to what exists, not to what is affordable', () => {
    // Planning 20 steps of a 10-step campaign buys 10; there is no sixth banner.
    const result = applyStepUpStrategy({ ...base, bannerCount: 2, plannedSteps: 20 })
    expect(result.chargeableSteps).toBe(10)
    expect(result.caratsSpent).toBe(10_000)
    expect(result.stepLabel).toBe('5x2')
  })

  it('still charges in full when the plan outruns the balance', () => {
    // The asymmetry that matters: unaffordable is reported as a deficit, not
    // clamped away, exactly as an over-planned pull count already behaves.
    const result = applyStepUpStrategy({ ...base, plannedSteps: 5, paidCarats: 1_000 })
    expect(result.chargeableSteps).toBe(5)
    expect(result.caratsSpent).toBe(5_000)
    expect(result.paidCarats).toBe(-4_000)
    expect(result.maxPossibleSteps).toBe(1)
  })

  it('handles a campaign with no banners at all', () => {
    const result = applyStepUpStrategy({ ...base, bannerCount: 0, plannedSteps: 5 })
    expect(result.chargeableSteps).toBe(0)
    expect(result.maxPossibleSteps).toBe(0)
    expect(result.caratsSpent).toBe(0)
    expect(result.paidCarats).toBe(20_000)
  })

  it('labels what was charged, never what was planned', () => {
    const result = applyStepUpStrategy({ ...base, bannerCount: 1, plannedSteps: 12 })
    expect(result.chargeableSteps).toBe(5)
    expect(result.stepLabel).toBe('5x1')
  })
})
