import { describe, it, expect } from 'vitest'
import {
  cumulativeEventRewards,
  cumulativeRaceRewards,
  raceDayAmounts,
  raceRewardAmount,
  raceRewardSchedule,
  upcomingRaceRewardRange,
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

  it('credits a CM ending the same day as the banner, not one ending the day after', () => {
    // The backend dates a CM row at the daily reset a day before its listed
    // end, which is when the rewards drop. A banner closes at 21:59:59; a CM
    // listed as ending the same day paid out at 22:00:00 the day before and
    // counts, while one listed as ending the next day pays at 22:00:00 tonight,
    // one second after the banner closed, and must go to a later banner.
    // (The sheet's `< end + 1 day` is NOT ported: it stands in for the lead
    // time the backend already applies, and porting both shifted a CM twice.)
    const ledger = parseLedger([
      row({ date: '2026-08-31T22:00:00Z', kind: 'champions_meeting' }), // listed end Sep 1
      row({ date: '2026-09-01T22:00:00Z', kind: 'champions_meeting' }), // listed end Sep 2
    ])
    const bannerEnd = utc('2026-09-01T21:59:59Z')
    const counted = raceEventsInWindow(ledger, 'champions_meeting', TODAY, bannerEnd)
    expect(counted.map((r) => r.date)).toEqual(['2026-08-31T22:00:00Z'])
  })

  it('counts a race event dated exactly at the banner end', () => {
    // The bound is inclusive: an LoH row sits at its listed end, 21:59:59, and
    // a banner closing at the same second still collects it.
    const ledger = parseLedger([
      row({ date: '2026-09-01T21:59:59Z', kind: 'league_of_heroes' }),
    ])
    expect(raceEventsInWindow(ledger, 'league_of_heroes', TODAY, utc('2026-09-01T21:59:59Z'))).toHaveLength(1)
  })
})

describe('raceRewardAmount', () => {
  // Daptrius's League of Heroes table for Platinum 3 (board, 2026-10-05):
  // 2250 at #1, 2950 (its own amount) for #2-5, 3400 from #6 on.
  const PLATINUM_3 = {
    name: 'Platinum 3',
    income_amount: 2950,
    uma_ticket_amount: 2,
    support_ticket_amount: 2,
    ssr_shard_amount: 2,
    sr_shard_amount: 2,
    // Out of order on purpose: the lookup must not lean on the API's sort.
    rewards: [
      { from_event_number: 6, income_amount: 3400 },
      { from_event_number: 1, income_amount: 2250 },
      { from_event_number: 2, income_amount: 2950 },
    ],
  }

  it('pays the row with the largest from-number at or below the event', () => {
    expect(raceRewardAmount(PLATINUM_3, 1)).toBe(2250)
    expect(raceRewardAmount(PLATINUM_3, 2)).toBe(2950)
    expect(raceRewardAmount(PLATINUM_3, 5)).toBe(2950)
    expect(raceRewardAmount(PLATINUM_3, 6)).toBe(3400)
    expect(raceRewardAmount(PLATINUM_3, 20)).toBe(3400)
  })

  it("pays the rank's own amount before its first row, and with no rows at all", () => {
    // CM Champion: 3300 until a "from 30" row raises it.
    const champion = { ...PLATINUM_3, income_amount: 3300, rewards: [{ from_event_number: 30, income_amount: 3800 }] }
    expect(raceRewardAmount(champion, 29)).toBe(3300)
    expect(raceRewardAmount(champion, 30)).toBe(3800)
    expect(raceRewardAmount({ ...champion, rewards: [] }, 30)).toBe(3300)
    expect(raceRewardAmount({ ...champion, rewards: undefined }, 30)).toBe(3300)
  })

  it("pays the rank's own amount for an event with no number", () => {
    // A ledger from an API older than event_number: the old behaviour.
    expect(raceRewardAmount(PLATINUM_3, null)).toBe(2950)
  })
})

describe('upcomingRaceRewardRange', () => {
  const CHAMPION = {
    name: 'Champion',
    income_amount: 3300,
    uma_ticket_amount: 5,
    support_ticket_amount: 5,
    ssr_shard_amount: 0,
    sr_shard_amount: 0,
    rewards: [{ from_event_number: 30, income_amount: 3800 }],
  }
  const cm = (eventNumber: number, date: string) =>
    row({ date, kind: 'champions_meeting', event_number: eventNumber })

  it('spans the events still ahead, past ones left out', () => {
    const ledger = [
      cm(20, '2020-01-01T21:59:59Z'), // behind us: ignored
      cm(29, '2027-08-05T21:59:59Z'),
      cm(30, '2027-09-19T21:59:59Z'),
    ]
    expect(upcomingRaceRewardRange(ledger, 'champions_meeting', CHAMPION, TODAY)).toEqual({ min: 3300, max: 3800 })
    expect(upcomingRaceRewardRange(ledger.slice(0, 2), 'champions_meeting', CHAMPION, TODAY)).toEqual({
      min: 3300,
      max: 3300,
    })
  })

  it('is null with no event of that kind ahead', () => {
    expect(upcomingRaceRewardRange([cm(30, '2027-09-19T21:59:59Z')], 'league_of_heroes', CHAMPION, TODAY)).toBeNull()
  })
})

describe('cumulativeRaceRewards', () => {
  const PLATINUM_3 = {
    name: 'Platinum 3',
    income_amount: 2950,
    uma_ticket_amount: 2,
    support_ticket_amount: 2,
    ssr_shard_amount: 2,
    sr_shard_amount: 1,
    rewards: [
      { from_event_number: 1, income_amount: 2250 },
      { from_event_number: 2, income_amount: 2950 },
      { from_event_number: 6, income_amount: 3400 },
    ],
  }
  const END = utc('2027-12-31T21:59:59Z')
  const loh = (eventNumber: number | null, date: string) =>
    row({ date, kind: 'league_of_heroes', event_number: eventNumber })

  it('values each event at its own number, across the raises', () => {
    const ledger = parseLedger([
      loh(1, '2027-01-29T21:59:59Z'),
      loh(2, '2027-03-12T21:59:59Z'),
      loh(6, '2027-09-10T21:59:59Z'),
    ])
    const total = cumulativeRaceRewards(ledger, 'league_of_heroes', TODAY, END, PLATINUM_3)
    expect(total.carats).toBe(2250 + 2950 + 3400)
    // Tickets and shards are per rank, the same at every event.
    expect(total.umaTickets).toBe(6)
    expect(total.ssrShards).toBe(6)
    expect(total.srShards).toBe(3)
  })

  it('reads only its own kind', () => {
    const ledger = parseLedger([
      loh(6, '2027-09-10T21:59:59Z'),
      row({ date: '2027-02-10T00:00:00Z', kind: 'champions_meeting', event_number: 6 }),
    ])
    expect(cumulativeRaceRewards(ledger, 'league_of_heroes', TODAY, END, PLATINUM_3).carats).toBe(3400)
    expect(cumulativeRaceRewards(ledger, 'champions_meeting', TODAY, END, PLATINUM_3).carats).toBe(3400)
    expect(
      cumulativeRaceRewards(parseLedger([loh(6, '2027-09-10T21:59:59Z')]), 'champions_meeting', TODAY, END, PLATINUM_3).carats
    ).toBe(0)
  })

  it('pays nothing without a rank', () => {
    const ledger = parseLedger([loh(1, '2027-01-29T21:59:59Z')])
    expect(cumulativeRaceRewards(ledger, 'league_of_heroes', TODAY, END, undefined).carats).toBe(0)
  })

  it('draws exactly the window raceEventsInWindow does', () => {
    // A past row and one beyond the end: the valuation must not widen the bounds.
    const ledger = parseLedger([
      loh(2, '2020-01-08T00:00:00Z'),
      loh(3, '2028-06-01T00:00:00Z'),
    ])
    expect(cumulativeRaceRewards(ledger, 'league_of_heroes', TODAY, END, PLATINUM_3).carats).toBe(0)
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

describe('day-by-day race rewards', () => {
  // Daptrius's LoH tables (#carat-calculator-website, 2026-09-24) for
  // Platinum 4: #2-5 is the rank's own amount, #6 on its own row.
  const PLATINUM_4 = {
    name: 'Platinum 4',
    income_amount: 3450,
    uma_ticket_amount: 1,
    support_ticket_amount: 1,
    ssr_shard_amount: 2,
    sr_shard_amount: 2,
    day_amounts: [390, 300, 600, 1000, 500, 500, 100, 60],
    rewards: [{ from_event_number: 6, income_amount: 3900, day_amounts: [550, 600, 600, 1000, 500, 500, 100, 50] }],
  }
  // An LoH that opens tomorrow at 22:00: days 1-6, stage 1 on day 8, stage 2 at its end.
  const PAYOUTS = [
    '2026-08-13T22:00:00Z', '2026-08-14T22:00:00Z', '2026-08-15T22:00:00Z', '2026-08-16T22:00:00Z',
    '2026-08-17T22:00:00Z', '2026-08-18T22:00:00Z', '2026-08-20T22:00:00Z', '2026-08-21T21:59:59Z',
  ]
  // Shards at the end of day 3, tickets at the end of day 4 (backend race_payouts.ITEM_PAYOUT_DAYS).
  const loh = (eventNumber: number) =>
    parseLedger([
      row({
        date: PAYOUTS[7],
        kind: 'league_of_heroes',
        event_number: eventNumber,
        payouts: PAYOUTS,
        shards_at: PAYOUTS[2],
        tickets_at: PAYOUTS[3],
      }),
    ])

  it("uses the era's own split, else the rank's", () => {
    expect(raceDayAmounts(PLATINUM_4, 3, 8)).toEqual([390, 300, 600, 1000, 500, 500, 100, 60])
    expect(raceDayAmounts(PLATINUM_4, 7, 8)).toEqual([550, 600, 600, 1000, 500, 500, 100, 50])
  })

  it("scales the rank's split to an era row that has none, keeping the total exact", () => {
    // CM Champion: Daptrius split #5-29 only; #30+ (3800) follows it scaled.
    const champion = {
      ...PLATINUM_4,
      income_amount: 3300,
      day_amounts: [130, 130, 270, 270, 2500],
      rewards: [{ from_event_number: 30, income_amount: 3800, day_amounts: [] }],
    }
    const days = raceDayAmounts(champion, 30, 5)
    expect(days).toEqual([150, 150, 310, 310, 2880])
    expect(days.reduce((sum, amount) => sum + amount, 0)).toBe(3800)
  })

  it('pays everything on the last day with no split, or one that does not fit', () => {
    const plain = { ...PLATINUM_4, day_amounts: [], rewards: [] }
    expect(raceDayAmounts(plain, 3, 8)).toEqual([0, 0, 0, 0, 0, 0, 0, 3450])
    // A ledger from an API older than `payouts`: one instant.
    expect(raceDayAmounts(PLATINUM_4, 3, 1)).toEqual([3450])
  })

  it('credits a banner ending mid-event with the days already paid, and the next banner the rest', () => {
    const ledger = loh(3)
    // The worked example in backend docs/income-calculation.md.
    const afterDay4 = cumulativeRaceRewards(ledger, 'league_of_heroes', TODAY, utc('2026-08-17T21:59:59Z'), PLATINUM_4)
    expect(afterDay4.carats).toBe(390 + 300 + 600 + 1000)
    const whole = cumulativeRaceRewards(ledger, 'league_of_heroes', TODAY, utc('2026-08-31T21:59:59Z'), PLATINUM_4)
    expect(whole.carats).toBe(3450)
    expect(whole.umaTickets).toBe(1)
  })

  it.each([
    // [banner ends, shards, tickets]
    ['before day 3', '2026-08-15T21:59:59Z', 0, 0],
    ['after day 3, before day 4', '2026-08-16T21:59:59Z', 2, 0],
    ['after day 4, before the last day', '2026-08-17T21:59:59Z', 2, 1],
    ['after the last day', '2026-08-31T21:59:59Z', 2, 1],
  ])('pays shards on day 3 and tickets on day 4: banner ending %s', (_, end, shards, tickets) => {
    const total = cumulativeRaceRewards(loh(3), 'league_of_heroes', TODAY, utc(end), PLATINUM_4)
    expect([total.ssrShards, total.srShards]).toEqual([shards, shards])
    expect([total.umaTickets, total.supportTickets]).toEqual([tickets, tickets])
  })

  it('pays no tickets or shards once their day is past', () => {
    // Today is day 5: both were paid on days 3 and 4 and are in the balance.
    const rest = cumulativeRaceRewards(loh(3), 'league_of_heroes', utc('2026-08-17T00:00:00Z'), utc('2026-08-31T21:59:59Z'), PLATINUM_4)
    expect([rest.ssrShards, rest.umaTickets]).toEqual([0, 0])
  })

  it('pays tickets and shards on the last day when the row has no instants for them', () => {
    // An API older than tickets_at / shards_at.
    const old = parseLedger([row({ date: PAYOUTS[7], kind: 'league_of_heroes', event_number: 3, payouts: PAYOUTS })])
    const afterDay4 = cumulativeRaceRewards(old, 'league_of_heroes', TODAY, utc('2026-08-17T21:59:59Z'), PLATINUM_4)
    expect([afterDay4.ssrShards, afterDay4.umaTickets]).toEqual([0, 0])
  })

  it('counts only the days still ahead once an event is under way', () => {
    // Today is day 3 of the event: days 1 and 2 are already paid.
    const today = utc('2026-08-15T00:00:00Z')
    const rest = cumulativeRaceRewards(loh(3), 'league_of_heroes', today, utc('2026-08-31T21:59:59Z'), PLATINUM_4)
    expect(rest.carats).toBe(3450 - 390 - 300)
  })

  it("lists one event day by day for the Timeline card, agreeing with the projection", () => {
    // Today is day 3, as above: days 1 and 2 are paid, and the days left
    // add up to what cumulativeRaceRewards still counts.
    const today = utc('2026-08-15T00:00:00Z')
    const [event] = loh(3)
    const schedule = raceRewardSchedule(event, PLATINUM_4, today)
    expect(schedule.days.map((day) => day.carats)).toEqual([390, 300, 600, 1000, 500, 500, 100, 60])
    expect(schedule.days.map((day) => day.paid)).toEqual([true, true, false, false, false, false, false, false])
    expect(schedule.days.map((day) => day.at)).toEqual(PAYOUTS)
    expect(schedule.total).toBe(3450)
    const ahead = schedule.days.filter((day) => !day.paid).reduce((sum, day) => sum + day.carats, 0)
    expect(ahead).toBe(cumulativeRaceRewards(loh(3), 'league_of_heroes', today, utc('2026-08-31T21:59:59Z'), PLATINUM_4).carats)
    expect(schedule.tickets).toEqual({ uma: 1, support: 1, at: PAYOUTS[3] })
    expect(schedule.shards).toEqual({ ssr: 2, sr: 2, at: PAYOUTS[2] })
  })

  it('lists one payout for a row with no instants, and no items for a rank that pays none', () => {
    // An API older than `payouts`, `tickets_at` and `shards_at`.
    const old = row({ date: PAYOUTS[7], kind: 'league_of_heroes', event_number: 3 })
    const noItems = { ...PLATINUM_4, uma_ticket_amount: 0, support_ticket_amount: 0, ssr_shard_amount: 0, sr_shard_amount: 0 }
    expect(raceRewardSchedule(old, noItems, TODAY)).toEqual({
      days: [{ at: PAYOUTS[7], carats: 3450, paid: false }],
      total: 3450,
      tickets: null,
      shards: null,
    })
    expect(raceRewardSchedule(old, PLATINUM_4, TODAY).tickets).toEqual({ uma: 1, support: 1, at: PAYOUTS[7] })
  })
})
