import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useAverageMonthlyIncome } from '../hooks/useAverageMonthlyIncome'
import { DEFAULT_CONSTANTS } from '../constants/gameConstants'
import type {
  UserStats,
  ClubRank,
  TeamTrialsRank,
  ChampionsMeetingRank,
  LeagueOfHeroesRank,
  IncomeLedgerRow,
} from '../types'

/** The averaging window the hook reports over. */
const WINDOW_MONTHS = 5

function daysFromNow(n: number, time = 'T12:00:00Z'): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + n)
  return `${d.toISOString().split('T')[0]}${time}`
}

const zeroStats: UserStats = {
  current_carat: 0,
  current_paid_carat: 0,
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
  discounted_paid_pulls: false,
  full_price_paid_pulls: true,
  club_rank: 1,
  team_trials_rank: 1,
  champions_meeting_rank: 1,
  league_of_heroes_rank: 1,
  ssr_crystals: 0,
  sr_crystals: 0,
  ssr_shards: 0,
  sr_shards: 0,
}

const zeroRankRewards = {
  uma_ticket_amount: 0,
  support_ticket_amount: 0,
  ssr_shard_amount: 0,
  sr_shard_amount: 0,
}

const noIncome = {
  clubRankData: [{ id: 1, name: 'None', income_amount: 0 }] as ClubRank[],
  teamTrialsRankData: [{ id: 1, name: 'None', income_amount: 0 }] as TeamTrialsRank[],
  championsMeetingRankData: [
    { id: 1, name: 'None', income_amount: 0, ...zeroRankRewards },
  ] as ChampionsMeetingRank[],
  leagueOfHeroesRankData: [
    { id: 1, name: 'None', income_amount: 0, ...zeroRankRewards },
  ] as LeagueOfHeroesRank[],
  incomeLedger: [] as IncomeLedgerRow[],
  constants: DEFAULT_CONSTANTS,
}

const ledgerRow = (overrides: Partial<IncomeLedgerRow>): IncomeLedgerRow => ({
  date: daysFromNow(30),
  kind: 'event',
  source_id: 1,
  name: 'Event',
  is_predicted: false,
  throughout_end: null,
  event_number: null,
  carats: 0,
  carats_throughout: 0,
  uma_tickets: 0,
  support_tickets: 0,
  ssr_shards: 0,
  ssr_crystals: 0,
  sr_shards: 0,
  sr_crystals: 0,
  ...overrides,
})

function render(stats: Partial<UserStats> = {}, extra = {}) {
  return renderHook(() =>
    useAverageMonthlyIncome({
      userStatsData: { ...zeroStats, ...stats },
      ...noIncome,
      ...extra,
    })
  ).result.current
}

describe('useAverageMonthlyIncome', () => {
  it('returns zeros with no user stats', () => {
    const result = renderHook(() =>
      useAverageMonthlyIncome({ userStatsData: null, ...noIncome })
    ).result.current
    expect(result).toEqual({
      carats: 0,
      umaTickets: 0,
      supportTickets: 0,
      ssrShards: 0,
      srShards: 0,
    })
  })

  it('divides income across the window rather than reporting the total', () => {
    const baseline = render()
    const withEvent = render({}, {
      incomeLedger: [ledgerRow({ carats: 5000 })],
    })
    expect(withEvent.carats - baseline.carats).toBe(5000 / WINDOW_MONTHS)
  })

  it('pays League of Heroes #1 at its capped rank, same as the banner rows', () => {
    // The tiles' side of the LoH #1 cap (Platinum 1). Both hooks read one
    // engine; this and the matching useBannerResources test pin that the rows
    // and the tiles cannot disagree about it.
    const ladder = [
      { id: 8, name: 'Platinum 3', income_amount: 2800, ...zeroRankRewards },
      { id: 7, name: 'Platinum 1', income_amount: 1800, ...zeroRankRewards },
    ] as LeagueOfHeroesRank[]
    const tiles = (firstEvent: number) =>
      render({ league_of_heroes_rank: 8 }, {
        leagueOfHeroesRankData: ladder,
        incomeLedger: [
          ledgerRow({ kind: 'league_of_heroes', date: daysFromNow(30), event_number: firstEvent }),
          ledgerRow({ kind: 'league_of_heroes', date: daysFromNow(60), event_number: firstEvent + 1 }),
        ],
      }).carats
    // The capped pair pays 1000 less: 200 a month over the five-month window.
    // Exact despite the rounding, because both totals differ from the
    // baseline by a multiple of five.
    expect(tiles(2) - tiles(1)).toBe(1000 / WINDOW_MONTHS)
  })

  it('ignores income landing beyond the window', () => {
    const baseline = render()
    const beyond = render({}, {
      // Comfortably past five months out.
      incomeLedger: [ledgerRow({ date: daysFromNow(400), carats: 5000 })],
    })
    expect(beyond.carats).toBe(baseline.carats)
  })

  it('credits the paid training pass one SSR shard a month', () => {
    // The pass does not launch until 2027; backdating the constant is how the
    // window reaches it without faking the clock. Five complete months in a
    // five-month window averages to exactly one a month.
    const launched = { ...DEFAULT_CONSTANTS, training_pass_start_date: '2020-01-01' }
    const off = render({ training_pass: false }, { constants: launched })
    const on = render({ training_pass: true }, { constants: launched })
    expect(off.ssrShards).toBe(0)
    expect(on.ssrShards).toBe(DEFAULT_CONSTANTS.training_pass_paid_ssr_shards)
  })

  it('scales race events by the user\'s rank, including shards', () => {
    const baseline = render()
    const ranked = render({}, {
      championsMeetingRankData: [{
        id: 1,
        name: 'Ranked',
        income_amount: 1250,
        uma_ticket_amount: 2,
        support_ticket_amount: 0,
        ssr_shard_amount: 10,
        sr_shard_amount: 4,
      }] as ChampionsMeetingRank[],
      incomeLedger: [ledgerRow({ kind: 'champions_meeting', date: daysFromNow(30, 'T00:00:00Z') })],
    })
    expect(ranked.carats - baseline.carats).toBe(1250 / WINDOW_MONTHS)
    expect(ranked.ssrShards).toBe(10 / WINDOW_MONTHS)
    // SR shards are reported here but discarded by the per-banner engine, which
    // only tracks the SSR side. Rounded, like every figure this hook returns —
    // 4 shards over 5 months is 0.8, shown as 1.
    expect(ranked.srShards).toBe(Math.round(4 / WINDOW_MONTHS))
  })

  it('reports one combined carat figure, summing the free and paid halves', () => {
    // The Daily Carat Pack pays into both balances. The per-banner projection
    // keeps them apart because they buy pulls at different prices; these tiles
    // show a single number, so both halves must land in it.
    const off = render({ daily_carat: false })
    const on = render({ daily_carat: true })
    const days = on.carats - off.carats
    expect(days).toBeGreaterThan(
      (DEFAULT_CONSTANTS.daily_carat_pack_per_day * 30 * WINDOW_MONTHS) / WINDOW_MONTHS
    )
  })

  it('respects the misc earnings toggle', () => {
    expect(render({ misc_earnings: true }).carats).toBeGreaterThan(
      render({ misc_earnings: false }).carats
    )
  })
})
