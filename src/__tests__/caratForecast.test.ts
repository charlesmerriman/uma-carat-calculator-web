import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
  buildCaratForecast,
  buildPullBars,
  buildPullSeries,
  buildSkipMarkers,
  forecastValueAt,
  FORECAST_MAX_SAMPLES,
} from '../utils/caratForecast'
import type { CaratForecast } from '../utils/caratForecast'
import { createIncomeProjection, projectionWalkOrder } from '../utils/incomeProjection'
import type { WalkEntry } from '../utils/incomeProjection'
import { EMPTY_BANNER_RESOURCES } from '../hooks/bannerResources'
import type { BannerResources } from '../hooks/bannerResources'
import { useBannerResources } from '../hooks/useBannerResources'
import { DEFAULT_CONSTANTS } from '../constants/gameConstants'
import { addUtcDays, startOfUtcDay, utcDaysBetween } from '../utils/utcDates'
import type {
  UserStats,
  ClubRank,
  TeamTrialsRank,
  ChampionsMeetingRank,
  LeagueOfHeroesRank,
  UserPlannedBanner,
  BannerTimeline,
} from '../types'

// ── A fake engine: 100 free carats a day, nothing else ────────────────────────
// The unit cases test the line's construction, not the income model, so the
// income is a straight line that makes every expected value easy to read.

const NOW = new Date(Date.UTC(2026, 9, 19, 12, 0, 0))
const TODAY = startOfUtcDay(NOW)
const PER_DAY = 100
const fakeProjection = {
  now: NOW,
  today: TODAY,
  incomeTo: (end: Date) => ({
    freeCarats: Math.max(0, utcDaysBetween(TODAY, end)) * PER_DAY,
    paidCarats: 0,
    usdSpent: 0,
    umaTickets: 0,
    supportTickets: 0,
    ssrShards: 0,
    ssrCrystals: 0,
  }),
}

const day = (n: number) => addUtcDays(TODAY, n)

function entry(index: number, startDay: number, endDay: number, excluded = false): WalkEntry {
  return {
    index,
    startDate: day(startDay),
    endDate: day(endDay),
    banner: { excluded_from_projection: excluded } as UserPlannedBanner,
  }
}

function row(freeCarats: number, freeCaratsSpent: number): BannerResources {
  return { ...EMPTY_BANNER_RESOURCES, freeCarats, freeCaratsSpent }
}

/** The line's values at one instant, in drawing order. */
const valuesAt = (points: { t: number; value: number }[], t: number) =>
  points.filter((p) => p.t === t).map((p) => p.value)

describe('buildCaratForecast', () => {
  it('returns null when nothing planned is still to come', () => {
    expect(
      buildCaratForecast({
        projection: fakeProjection,
        walkOrder: [entry(0, -20, -5)],
        resources: [row(0, 0)],
        currentFreeCarats: 1000,
      })
    ).toBeNull()
  })

  it('meets each row at its end date and drops by what the row spends', () => {
    // Start 1,000. Day 10: 2,000 available, spend 1,500, leaving 500.
    // Day 20: 500 + 10 days x 100 = 1,500 available, spend 600, leaving 900.
    const forecast = buildCaratForecast({
      projection: fakeProjection,
      walkOrder: [entry(0, 0, 10), entry(1, 11, 20)],
      resources: [row(2000, 1500), row(1500, 600)],
      currentFreeCarats: 1000,
    })!

    expect(forecast.markers).toEqual([
      { index: 0, t: day(10).getTime(), before: 2000, after: 500, excluded: false, paidBefore: 0, paidAfter: 0, stepUp: false },
      { index: 1, t: day(20).getTime(), before: 1500, after: 900, excluded: false, paidBefore: 0, paidAfter: 0, stepUp: false },
    ])
    // Arrives at the row's own number, then drops: no re-anchoring step,
    // because the line already agrees with the rows.
    expect(valuesAt(forecast.points, day(10).getTime())).toEqual([2000, 500])
    expect(valuesAt(forecast.points, day(20).getTime())).toEqual([1500, 900])
    // Between banners it is the balance plus income.
    expect(valuesAt(forecast.points, day(15).getTime())).toEqual([1000])
    expect(forecast.points[0]).toMatchObject({ t: TODAY.getTime(), value: 1000 })
  })

  it('runs 30 days past the last banner, and never shorter than 60 days', () => {
    const near = buildCaratForecast({
      projection: fakeProjection,
      walkOrder: [entry(0, 0, 5)],
      resources: [row(1500, 0)],
      currentFreeCarats: 1000,
    })!
    expect(near.end).toBe(day(60).getTime())

    const far = buildCaratForecast({
      projection: fakeProjection,
      walkOrder: [entry(0, 0, 100)],
      resources: [row(11000, 0)],
      currentFreeCarats: 1000,
    })!
    expect(far.end).toBe(day(130).getTime())
  })

  it('draws a row left out of the projection without charging it', () => {
    const forecast = buildCaratForecast({
      projection: fakeProjection,
      walkOrder: [entry(0, 0, 10, true), entry(1, 11, 20)],
      resources: [row(2000, 1500), row(3000, 0)],
      currentFreeCarats: 1000,
    })!
    expect(forecast.markers[0]).toMatchObject({ before: 2000, after: 2000, excluded: true })
    expect(valuesAt(forecast.points, day(20).getTime())).toEqual([3000])
  })

  it('takes an ended banner\'s spend off the starting balance instead of drawing it', () => {
    const forecast = buildCaratForecast({
      projection: fakeProjection,
      walkOrder: [entry(0, -20, -5), entry(1, 0, 10)],
      resources: [row(900, 400), row(1600, 0)],
      currentFreeCarats: 1000,
    })!
    expect(forecast.markers.map((m) => m.index)).toEqual([1])
    expect(forecast.points[0].value).toBe(600)
    expect(valuesAt(forecast.points, day(10).getTime())).toEqual([1600])
  })

  it('re-anchors to the row when a banner sits inside another one\'s window', () => {
    // Banner 0 runs days 0-30 and is charged first (it starts first); banner 1
    // runs days 5-10. The engine measures banner 1 AFTER banner 0's spend of
    // 2,000, so its row says 1,000 + 1,000 - 2,000 = 0. On a time axis banner
    // 0 has not ended yet at day 10, so the line steps to the row's number.
    const forecast = buildCaratForecast({
      projection: fakeProjection,
      walkOrder: [entry(0, 0, 30), entry(1, 5, 10)],
      resources: [row(4000, 2000), row(0, 0)],
      currentFreeCarats: 1000,
    })!
    expect(forecast.markers.map((m) => [m.index, m.before])).toEqual([[1, 0], [0, 4000]])
    expect(valuesAt(forecast.points, day(10).getTime())).toEqual([2000, 0])
    // At day 30 the line reads 0 + 20 days of income = 2,000, but banner 0's
    // row says 4,000 (its own spend is never in its own number). So the line
    // steps back up to the row, then drops by banner 0's spend. Both dots
    // match their rows, which is the promise.
    expect(valuesAt(forecast.points, day(30).getTime())).toEqual([2000, 4000, 2000])
  })

  it('widens the sample step on a plan years long, keeping markers exact', () => {
    const forecast = buildCaratForecast({
      projection: fakeProjection,
      walkOrder: [entry(0, 0, 1500)],
      resources: [row(151000, 1000)],
      currentFreeCarats: 1000,
    })!
    // Samples, plus the start and the marker's pair of points.
    expect(forecast.points.length).toBeLessThanOrEqual(FORECAST_MAX_SAMPLES + 3)
    expect(valuesAt(forecast.points, day(1500).getTime())).toEqual([151000, 150000])
  })
})

// ── Against the real engine ──────────────────────────────────────────────────
// The point of the module: on an ordinary plan the line arrives at every row's
// number by itself, with no re-anchoring step anywhere.

function daysFromNow(n: number, time = 'T21:59:59Z'): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + n)
  return `${d.toISOString().split('T')[0]}${time}`
}

function timeline(id: number, startDay: number, endDay: number): BannerTimeline {
  return {
    id,
    name: `Timeline ${id}`,
    banner_category: 'standard',
    start_date: daysFromNow(startDay, 'T22:00:00Z'),
    end_date: daysFromNow(endDay),
    is_predicted: false,
    jp_start_date: null,
    jp_end_date: null,
    global_start_date: daysFromNow(startDay, 'T22:00:00Z'),
    global_end_date: daysFromNow(endDay),
    schedule_offset_days: 0,
    applied_offset_days: 0,
    image: '',
  }
}

function umaBanner(id: number, startDay: number, endDay: number, pulls: number): UserPlannedBanner {
  return {
    id,
    user: 1,
    number_of_pulls: pulls,
    reserved_copies: 0,
    banner_uma: {
      id,
      name: `Uma Banner ${id}`,
      admin_comments: '',
      umas: [],
      free_pulls: 0,
      is_recommended: false,
      banner_timeline: timeline(id, startDay, endDay),
    },
  }
}

function stepUpBanner(id: number, startDay: number, endDay: number, steps: number): UserPlannedBanner {
  return {
    id,
    user: 1,
    // number_of_pulls carries steps on a step-up row.
    number_of_pulls: steps,
    reserved_copies: 0,
    banner_step_up: {
      id,
      banner_timeline: timeline(id, startDay, endDay),
      anniversary_event: 1,
      name: `Step-Up ${id}`,
      card_type: 'uma',
      banner_count: 3,
      max_steps: 15,
      jp_cutoff_date: '2026-01-30',
      image: null,
      admin_comments: '',
      order: 0,
    },
  }
}

describe('buildCaratForecast with the real engine', () => {
  it('meets every row without a correction step', () => {
    const userStatsData = {
      current_carat: 5000,
      current_paid_carat: 0,
      uma_ticket: 0,
      support_ticket: 0,
      uma_selector_ticket: 0,
      support_selector_ticket: 0,
      include_purchases_in_projection: false,
      webstore_bonus: false,
      daily_carat: true,
      training_pass: true,
      misc_earnings: true,
      monthly_shop_tickets: false,
      spend_tickets_on_banners: true,
      discounted_paid_pulls: false,
      full_price_paid_pulls: false,
      club_rank: 1,
      team_trials_rank: 1,
      champions_meeting_rank: 1,
      league_of_heroes_rank: 1,
      ssr_crystals: 0,
      sr_crystals: 0,
      ssr_shards: 0,
      sr_shards: 0,
    } as UserStats
    const params = {
      userStatsData,
      clubRankData: [{ id: 1, name: 'A', income_amount: 3000 }] as ClubRank[],
      teamTrialsRankData: [{ id: 1, name: 'A', income_amount: 500 }] as TeamTrialsRank[],
      championsMeetingRankData: [] as ChampionsMeetingRank[],
      leagueOfHeroesRankData: [] as LeagueOfHeroesRank[],
      anniversaryEventData: [],
      userPlannedPurchaseData: [],
      incomeLedger: [],
      constants: DEFAULT_CONSTANTS,
    }
    const banners = [
      umaBanner(1, 0, 9, 50),
      umaBanner(2, 10, 19, 30),
      umaBanner(3, 20, 40, 100),
    ]
    const { result } = renderHook(() =>
      useBannerResources({ ...params, userPlannedBannerData: banners })
    )

    const forecast = buildCaratForecast({
      projection: createIncomeProjection(params),
      walkOrder: projectionWalkOrder(banners),
      resources: result.current,
      currentFreeCarats: 5000,
    })!

    for (const marker of forecast.markers) {
      const row = result.current[marker.index]
      expect(marker.before).toBe(row.freeCarats)
      expect(marker.after).toBe(row.freeCarats - row.freeCaratsSpent)
      // Arrival, then the drop: two values, never the three a re-anchor adds.
      expect(valuesAt(forecast.points, marker.t)).toEqual([
        row.freeCarats,
        row.freeCarats - row.freeCaratsSpent,
      ])
    }
    // The pulls really did spend something, or this test proves nothing.
    expect(result.current.every((r) => r.freeCaratsSpent > 0)).toBe(true)
  })
})

// ── The pulls view and the skip dots ─────────────────────────────────────────

describe('buildPullBars', () => {
  it("takes the row's max pulls without the banner's free pulls, and leaves step-ups out", () => {
    const uma = { banner_uma: { banner_timeline: {} } } as unknown as UserPlannedBanner
    const stepUp = { banner_step_up: { banner_timeline: {} } } as unknown as UserPlannedBanner
    const markers = [
      { index: 0, t: day(10).getTime(), before: 0, after: 0, excluded: false, paidBefore: 0, paidAfter: 0, stepUp: false },
      { index: 1, t: day(20).getTime(), before: 0, after: 0, excluded: false, paidBefore: 0, paidAfter: 0, stepUp: false },
    ]
    const resources = [
      {
        ...EMPTY_BANNER_RESOURCES,
        maxPossiblePulls: 260,
        maxPullBreakdown: { freePulls: 50, tickets: 10, paidPulls: 20, freeCaratPulls: 180 },
      },
      { ...EMPTY_BANNER_RESOURCES, maxPossibleSteps: 5 },
    ]
    const bars = buildPullBars(markers, resources, [uma, stepUp])
    expect(bars).toHaveLength(1)
    expect(bars[0].pulls).toBe(210)
    expect(bars[0].marker.index).toBe(0)
  })
})

describe('forecastValueAt / buildSkipMarkers', () => {
  const points = [
    { t: 0, value: 100 },
    { t: 10, value: 200 },
    { t: 10, value: 50 },
    { t: 20, value: 150 },
  ]

  it('reads the line between vertices, and the last vertex at a drop', () => {
    expect(forecastValueAt(points, 5)).toBe(150)
    expect(forecastValueAt(points, 10)).toBe(50)
    expect(forecastValueAt(points, 15)).toBe(100)
    expect(forecastValueAt(points, 30)).toBe(150)
  })

  it('places a skipped event on the line, and drops one outside the chart', () => {
    const forecast = { start: 0, end: 20, points, markers: [] } as unknown as CaratForecast
    const row = (date: number, name: string) => ({
      date: new Date(date).toISOString(),
      kind: 'champions_meeting' as const,
      source_id: 1,
      name,
    })
    const skips = buildSkipMarkers(forecast, [row(5, 'Cup A'), row(25, 'Cup B')] as never)
    expect(skips).toEqual([{ t: 5, value: 150, name: 'Cup A', kind: 'champions_meeting' }])
  })
})

describe('buildPullSeries', () => {
  const marker = { index: 0, t: 10, before: 3000, after: 0, excluded: false, paidBefore: 0, paidAfter: 0, stepUp: false }
  const forecast = {
    start: 0,
    end: 20,
    markers: [marker],
    points: [
      { t: 0, value: 1500, paid: 450, umaTickets: 4, supportTickets: 7 },
      { t: 10, value: 3000, paid: 0, umaTickets: 0, supportTickets: 2, marker: 0 },
      { t: 20, value: -300, paid: 0, umaTickets: 0, supportTickets: 2 },
    ],
  } as unknown as CaratForecast
  const uma = { banner_uma: { banner_timeline: {} } } as unknown as UserPlannedBanner
  const bar = {
    marker,
    pulls: 33,
    breakdown: { freePulls: 0, tickets: 0, paidPulls: 0, freeCaratPulls: 20 },
  }
  const settings = { pullCost: 150, fullPricePaidPulls: true, spendTickets: true }

  it('counts carats at 150 a pull plus each line\'s own tickets', () => {
    const [first] = buildPullSeries(forecast, [], [uma], settings)
    // 1,500 free (10) + 450 paid (3) + its tickets.
    expect(first).toMatchObject({ uma: 17, support: 20 })
  })

  it('follows the settings: no paid carats, no tickets', () => {
    const [first] = buildPullSeries(forecast, [], [uma], {
      ...settings,
      fullPricePaidPulls: false,
      spendTickets: false,
    })
    expect(first).toMatchObject({ uma: 10, support: 10 })
  })

  it("puts the row's number on its own line at the dot, and never goes below zero", () => {
    const series = buildPullSeries(forecast, [bar], [uma], settings)
    // The uma banner's dot: the row's 33 on the uma line; support stays daily.
    expect(series[1]).toMatchObject({ uma: 33, support: 22, kind: 'uma' })
    expect(series[1].bar).toBe(bar)
    // A carat debt is no pulls, not negative ones.
    expect(series[2]).toMatchObject({ uma: 0, support: 2 })
  })
})

describe('the paid layer against the real engine', () => {
  it("drops the paid balance at a step-up, leaving free carats alone, and matches the row", () => {
    const userStatsData = {
      current_carat: 5000,
      current_paid_carat: 12000,
      uma_ticket: 0,
      support_ticket: 0,
      uma_selector_ticket: 0,
      support_selector_ticket: 0,
      include_purchases_in_projection: false,
      webstore_bonus: false,
      daily_carat: false,
      training_pass: false,
      misc_earnings: false,
      monthly_shop_tickets: false,
      spend_tickets_on_banners: true,
      discounted_paid_pulls: false,
      full_price_paid_pulls: false,
      club_rank: 1,
      team_trials_rank: 1,
      champions_meeting_rank: 1,
      league_of_heroes_rank: 1,
      ssr_crystals: 0,
      sr_crystals: 0,
      ssr_shards: 0,
      sr_shards: 0,
    } as UserStats
    const params = {
      userStatsData,
      clubRankData: [{ id: 1, name: 'A', income_amount: 0 }] as ClubRank[],
      teamTrialsRankData: [{ id: 1, name: 'A', income_amount: 0 }] as TeamTrialsRank[],
      championsMeetingRankData: [] as ChampionsMeetingRank[],
      leagueOfHeroesRankData: [] as LeagueOfHeroesRank[],
      anniversaryEventData: [],
      userPlannedPurchaseData: [],
      incomeLedger: [],
      constants: DEFAULT_CONSTANTS,
    }
    const banners = [stepUpBanner(1, 0, 20, 5)]
    const { result } = renderHook(() =>
      useBannerResources({ ...params, userPlannedBannerData: banners })
    )
    const row = result.current[0]
    expect(row.paidCaratsSpent).toBeGreaterThan(0)
    expect(row.freeCaratsSpent).toBe(0)

    const forecast = buildCaratForecast({
      projection: createIncomeProjection(params),
      walkOrder: projectionWalkOrder(banners),
      resources: result.current,
      currentFreeCarats: 5000,
      currentPaidCarats: 12000,
    })!
    const [marker] = forecast.markers
    expect(marker).toMatchObject({
      stepUp: true,
      before: row.freeCarats,
      after: row.freeCarats,
      paidBefore: row.paidCarats,
      paidAfter: row.paidCarats - row.paidCaratsSpent,
    })
    // After the step-up the paid balance is what the row leaves.
    const last = forecast.points[forecast.points.length - 1]
    expect(last.paid).toBe(row.paidCarats - row.paidCaratsSpent)
  })
})
