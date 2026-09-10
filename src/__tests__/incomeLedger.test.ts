import { describe, it, expect } from 'vitest'
import {
  cumulativeEventRewards,
  cumulativeRaceRewards,
  cumulativeThroughoutCarats,
  parseLedger,
  raceEventsInWindow,
} from '../utils/incomeLedger'
import {
  DEFAULT_CONSTANTS as K,
  THROUGHOUT_FILTER_GRACE_DAYS,
} from '../constants/gameConstants'
import { addUtcDays } from '../utils/utcDates'
import type { IncomeLedgerRow, LedgerRowKind } from '../types/ledger'

const utc = (iso: string) => new Date(iso)
const NOW = utc('2026-08-11T09:00:00Z')
const TODAY = utc('2026-08-11T00:00:00Z')

function row(
  overrides: Partial<IncomeLedgerRow> & { date: string; kind: LedgerRowKind }
): IncomeLedgerRow {
  return {
    source_id: 1,
    name: 'Row',
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
  }
}

describe('cumulativeEventRewards', () => {
  it('totals lump rewards for events between now and the end date', () => {
    const ledger = parseLedger([
      row({ date: '2026-08-15T22:00:00Z', kind: 'event', carats: 1200, uma_tickets: 3 }),
      row({ date: '2026-08-20T22:00:00Z', kind: 'event', carats: 800, ssr_shards: 5 }),
    ])
    const total = cumulativeEventRewards(ledger, NOW, utc('2026-08-31T00:00:00Z'))
    expect(total.carats).toBe(2000)
    expect(total.umaTickets).toBe(3)
    expect(total.ssrShards).toBe(5)
  })

  it('excludes an event that already opened earlier today', () => {
    // The lower bound is NOW, not midnight: those carats have already paid out
    // and are in the balance the user typed in. Counting them would double them.
    const ledger = parseLedger([
      row({ date: '2026-08-11T06:00:00Z', kind: 'event', carats: 1200 }),
    ])
    expect(cumulativeEventRewards(ledger, NOW, utc('2026-12-01T00:00:00Z')).carats).toBe(0)
  })

  it('excludes events beyond the end date', () => {
    const ledger = parseLedger([
      row({ date: '2026-09-15T22:00:00Z', kind: 'event', carats: 1200 }),
    ])
    expect(cumulativeEventRewards(ledger, NOW, utc('2026-09-01T00:00:00Z')).carats).toBe(0)
  })

  it('ignores race rows and the throughout pool', () => {
    // carats_throughout is a pool spread by the decay curve, not a lump — it is
    // handled by cumulativeThroughoutCarats and must not be counted twice.
    const ledger = parseLedger([
      row({ date: '2026-08-15T22:00:00Z', kind: 'event', carats_throughout: 5000 }),
      row({ date: '2026-08-15T22:00:00Z', kind: 'champions_meeting', carats: 9999 }),
    ])
    expect(cumulativeEventRewards(ledger, NOW, utc('2026-12-01T00:00:00Z')).carats).toBe(0)
  })
})

describe('raceEventsInWindow', () => {
  it('counts events of the requested kind up to the end date', () => {
    const ledger = parseLedger([
      row({ date: '2026-08-26T00:00:00Z', kind: 'champions_meeting' }),
      row({ date: '2026-09-26T00:00:00Z', kind: 'champions_meeting' }),
      row({ date: '2026-08-28T00:00:00Z', kind: 'league_of_heroes' }),
    ])
    expect(raceEventsInWindow(ledger, 'champions_meeting', TODAY, utc('2026-09-01T00:00:00Z'))).toHaveLength(1)
    expect(raceEventsInWindow(ledger, 'league_of_heroes', TODAY, utc('2026-09-01T00:00:00Z'))).toHaveLength(1)
    expect(raceEventsInWindow(ledger, 'champions_meeting', TODAY, utc('2026-10-01T00:00:00Z'))).toHaveLength(2)
  })

  it('excludes race events already in the past', () => {
    // The ledger carries past rows deliberately; the today-gate lives here.
    const ledger = parseLedger([
      row({ date: '2020-01-08T00:00:00Z', kind: 'champions_meeting' }),
    ])
    expect(raceEventsInWindow(ledger, 'champions_meeting', TODAY, utc('2029-01-01T00:00:00Z'))).toHaveLength(0)
  })

  it('includes a race event finishing the day after the banner closes', () => {
    // The sheet's upper bound is `< end + 1 day`, not `<= end`. Race rows are
    // dated at midnight while banners end at 21:59:59, so this is the ported
    // behaviour rather than an off-by-one.
    const ledger = parseLedger([
      row({ date: '2026-09-02T00:00:00Z', kind: 'champions_meeting' }),
    ])
    const bannerEnd = utc('2026-09-01T21:59:59Z')
    expect(raceEventsInWindow(ledger, 'champions_meeting', TODAY, bannerEnd)).toHaveLength(1)
  })
})

describe('cumulativeRaceRewards', () => {
  // A trimmed League of Heroes ladder. The ids are deliberately not the real
  // ones: the cap is looked up by rank NAME, so nothing may depend on an id.
  const rank = (id: number, name: string, income: number, shards = 0) => ({
    id,
    name,
    income_amount: income,
    uma_ticket_amount: 2,
    support_ticket_amount: 2,
    ssr_shard_amount: shards,
    sr_shard_amount: shards,
  })
  const PLATINUM_3 = rank(10, 'Platinum 3', 2800, 2)
  const PLATINUM_1 = rank(11, 'Platinum 1', 1800, 1)
  const GOLD_4 = rank(12, 'Gold 4', 1300)
  const LADDER = [PLATINUM_3, PLATINUM_1, GOLD_4]
  const END = utc('2027-12-31T21:59:59Z')
  const loh = (eventNumber: number | null, date: string) =>
    row({ date, kind: 'league_of_heroes', event_number: eventNumber })

  it('pays League of Heroes #1 at Platinum 1 for a player ranked above it', () => {
    const ledger = parseLedger([
      loh(1, '2027-01-29T21:59:59Z'),
      loh(2, '2027-03-12T21:59:59Z'),
    ])
    const total = cumulativeRaceRewards(ledger, 'league_of_heroes', TODAY, END, PLATINUM_3, LADDER)
    // 1800 for #1 (capped) + 2800 for #2: the sheet's own figure for a
    // Platinum 3 player, which the parity audit reproduced exactly.
    expect(total.carats).toBe(4600)
    // The whole reward row follows the cap, not only the carats.
    expect(total.ssrShards).toBe(1 + 2)
  })

  it('is a ceiling, never a floor', () => {
    // A player below the cap keeps their own, smaller, payout from #1.
    const ledger = parseLedger([loh(1, '2027-01-29T21:59:59Z')])
    expect(
      cumulativeRaceRewards(ledger, 'league_of_heroes', TODAY, END, GOLD_4, LADDER).carats
    ).toBe(1300)
  })

  it('caps only that event, and only for its own kind', () => {
    const ledger = parseLedger([
      loh(2, '2027-03-12T21:59:59Z'),
      row({ date: '2027-02-10T00:00:00Z', kind: 'champions_meeting', event_number: 1 }),
    ])
    expect(
      cumulativeRaceRewards(ledger, 'league_of_heroes', TODAY, END, PLATINUM_3, LADDER).carats
    ).toBe(2800)
    // Champions Meeting #1 shares the number but not the cap.
    expect(
      cumulativeRaceRewards(ledger, 'champions_meeting', TODAY, END, PLATINUM_3, LADDER).carats
    ).toBe(2800)
  })

  it('falls back to the uncapped rank rather than to zero', () => {
    // A ceiling rank renamed in the admin, or a ledger from an API older than
    // event_number, must degrade to the pre-cap payout, not silently to nothing.
    const numbered = parseLedger([loh(1, '2027-01-29T21:59:59Z')])
    expect(
      cumulativeRaceRewards(numbered, 'league_of_heroes', TODAY, END, PLATINUM_3, [PLATINUM_3, GOLD_4]).carats
    ).toBe(2800)
    const unnumbered = parseLedger([loh(null, '2027-01-29T21:59:59Z')])
    expect(
      cumulativeRaceRewards(unnumbered, 'league_of_heroes', TODAY, END, PLATINUM_3, LADDER).carats
    ).toBe(2800)
  })

  it('pays nothing without a rank', () => {
    const ledger = parseLedger([loh(1, '2027-01-29T21:59:59Z')])
    expect(
      cumulativeRaceRewards(ledger, 'league_of_heroes', TODAY, END, undefined, LADDER).carats
    ).toBe(0)
  })

  it('draws exactly the window raceEventsInWindow does', () => {
    // A past row and one beyond the end: the valuation must not widen the bounds.
    const ledger = parseLedger([
      loh(2, '2020-01-08T00:00:00Z'),
      loh(3, '2028-06-01T00:00:00Z'),
    ])
    expect(
      cumulativeRaceRewards(ledger, 'league_of_heroes', TODAY, END, PLATINUM_3, LADDER).carats
    ).toBe(0)
  })
})

describe('cumulativeThroughoutCarats', () => {
  const throughoutRow = (start: string, bannerEnd: string, pool: number) =>
    row({
      date: start,
      kind: 'event',
      carats_throughout: pool,
      throughout_end: bannerEnd,
    })

  it('credits a whole pool to one checkpoint rather than splitting it', () => {
    const ledger = parseLedger([
      throughoutRow('2026-08-20T22:00:00Z', '2026-09-05T21:59:59Z', 1000),
    ])
    const early = cumulativeThroughoutCarats(ledger, NOW, utc('2026-09-10T00:00:00Z'), K)
    const later = cumulativeThroughoutCarats(ledger, NOW, utc('2026-12-01T00:00:00Z'), K)
    // Once the banner is inside the grace window it contributes its full
    // remaining amount; extending the end date adds nothing more.
    expect(early).toBeGreaterThan(0)
    expect(later).toBe(early)
  })

  it('drops a banner that has already finished', () => {
    const ledger = parseLedger([
      throughoutRow('2026-06-01T22:00:00Z', '2026-06-15T21:59:59Z', 1000),
    ])
    expect(cumulativeThroughoutCarats(ledger, NOW, utc('2026-12-01T00:00:00Z'), K)).toBe(0)
  })

  it('does not credit a banner ending beyond the grace window', () => {
    const bannerEnd = utc('2026-10-01T21:59:59Z')
    const ledger = parseLedger([
      throughoutRow('2026-09-20T22:00:00Z', bannerEnd.toISOString(), 1000),
    ])
    const justInside = addUtcDays(bannerEnd, -THROUGHOUT_FILTER_GRACE_DAYS)
    expect(
      cumulativeThroughoutCarats(ledger, NOW, addUtcDays(justInside, -1), K)
    ).toBe(0)
    expect(cumulativeThroughoutCarats(ledger, NOW, justInside, K)).toBeGreaterThan(0)
  })

  it('front-loads: a banner still to open has its whole pool left', () => {
    const ledger = parseLedger([
      throughoutRow('2026-11-01T22:00:00Z', '2026-11-15T21:59:59Z', 1000),
    ])
    expect(cumulativeThroughoutCarats(ledger, NOW, utc('2026-12-01T00:00:00Z'), K)).toBe(1000)
  })

  it('ignores rows carrying no pool', () => {
    const ledger = parseLedger([
      row({ date: '2026-08-20T22:00:00Z', kind: 'event', carats: 5000 }),
    ])
    expect(cumulativeThroughoutCarats(ledger, NOW, utc('2026-12-01T00:00:00Z'), K)).toBe(0)
  })
})
