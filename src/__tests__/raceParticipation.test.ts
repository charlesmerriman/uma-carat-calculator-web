import { describe, it, expect } from 'vitest'
import {
  isRaceSkipped,
  racePayoutAhead,
  readSkippedRaceEvents,
  upcomingSkipCount,
  upcomingSkippedRaces,
  withRaceParticipation,
  withoutSkippedRaces,
} from '../utils/raceParticipation'
import { cumulativeRaceRewards, parseLedger } from '../utils/incomeLedger'
import { statsAreDirty, DEFAULT_GUEST_STATS } from '../services/guestMigration'
import type { IncomeLedgerRow, LedgerRowKind } from '../types/ledger'

const NOW = new Date('2026-08-11T09:00:00Z')
const TODAY = new Date('2026-08-11T00:00:00Z')

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

// CM 7 and 8 ahead, LoH 7 ahead (same id as a CM: ids are per kind), and a
// game event that also has id 7, which a skip must never touch.
const LEDGER = [
  row({ date: '2026-08-20T22:00:00Z', kind: 'champions_meeting', source_id: 7 }),
  row({ date: '2026-09-20T22:00:00Z', kind: 'champions_meeting', source_id: 8 }),
  row({ date: '2026-08-25T22:00:00Z', kind: 'league_of_heroes', source_id: 7 }),
  row({ date: '2026-08-15T22:00:00Z', kind: 'event', source_id: 7, carats: 500 }),
  row({ date: '2026-07-20T22:00:00Z', kind: 'champions_meeting', source_id: 6 }),
]

describe('withRaceParticipation', () => {
  it('adds a skip, keeps the list sorted and unique, and never mutates', () => {
    const before = { champions_meeting: [9] }
    const after = withRaceParticipation(before, 'champions_meeting', 3, false)
    expect(after).toEqual({ champions_meeting: [3, 9] })
    expect(before).toEqual({ champions_meeting: [9] })
    expect(withRaceParticipation(after, 'champions_meeting', 3, false)).toEqual(after)
  })

  it('drops a kind once nothing in it is skipped, matching what the server stores', () => {
    expect(withRaceParticipation({ league_of_heroes: [4] }, 'league_of_heroes', 4, true)).toEqual({})
  })

  it('starts from nothing when the API sent no field', () => {
    expect(withRaceParticipation(undefined, 'league_of_heroes', 2, false)).toEqual({
      league_of_heroes: [2],
    })
  })
})

describe('withoutSkippedRaces', () => {
  it('returns the same array when nothing is skipped, so memos downstream hold', () => {
    expect(withoutSkippedRaces(LEDGER, undefined)).toBe(LEDGER)
    expect(withoutSkippedRaces(LEDGER, {})).toBe(LEDGER)
    expect(withoutSkippedRaces(LEDGER, { champions_meeting: [] })).toBe(LEDGER)
  })

  it('removes only the skipped kind and id, never a game event sharing the id', () => {
    const kept = withoutSkippedRaces(LEDGER, { champions_meeting: [7] })
    expect(kept.map((r) => `${r.kind}:${r.source_id}`)).toEqual([
      'champions_meeting:8',
      'league_of_heroes:7',
      'event:7',
      'champions_meeting:6',
    ])
  })

  it('takes a skipped CM out of what a banner ending after it is credited', () => {
    const rank = {
      name: 'Gold',
      income_amount: 1000,
      uma_ticket_amount: 1,
      support_ticket_amount: 1,
      ssr_shard_amount: 0,
      sr_shard_amount: 0,
    }
    const end = new Date('2026-12-01T00:00:00Z')
    const credited = (skips: Parameters<typeof withoutSkippedRaces>[1]) =>
      cumulativeRaceRewards(
        parseLedger(withoutSkippedRaces(LEDGER, skips)),
        'champions_meeting', TODAY, end, rank, [rank]
      ).carats
    expect(credited({})).toBe(2000)
    expect(credited({ champions_meeting: [8] })).toBe(1000)
  })
})

describe('racePayoutAhead / upcomingSkipCount', () => {
  it('is true only while the payout is still ahead of the projection', () => {
    expect(racePayoutAhead(LEDGER, 'champions_meeting', 7, NOW)).toBe(true)
    // Paid out last month: skipping it would change nothing.
    expect(racePayoutAhead(LEDGER, 'champions_meeting', 6, NOW)).toBe(false)
    // No ledger row at all (no resolvable end date).
    expect(racePayoutAhead(LEDGER, 'champions_meeting', 99, NOW)).toBe(false)
  })

  it("uses the engine's midnight bound: a payout earlier today still counts", () => {
    const ledger = [row({ date: '2026-08-11T03:00:00Z', kind: 'champions_meeting', source_id: 5 })]
    expect(racePayoutAhead(ledger, 'champions_meeting', 5, NOW)).toBe(true)
  })

  it('counts upcoming skips only', () => {
    expect(
      upcomingSkipCount(LEDGER, { champions_meeting: [6, 7, 99], league_of_heroes: [7] }, NOW)
    ).toBe(2)
    expect(upcomingSkipCount(LEDGER, undefined, NOW)).toBe(0)
  })
})

describe('isRaceSkipped', () => {
  it('keeps the two kinds apart', () => {
    const skips = { champions_meeting: [7] }
    expect(isRaceSkipped(skips, 'champions_meeting', 7)).toBe(true)
    expect(isRaceSkipped(skips, 'league_of_heroes', 7)).toBe(false)
    expect(isRaceSkipped(undefined, 'league_of_heroes', 7)).toBe(false)
  })
})

describe('readSkippedRaceEvents (guest device store)', () => {
  it('keeps a good value and cleans a damaged one', () => {
    expect(readSkippedRaceEvents({ champions_meeting: [4, 2, 2] })).toEqual({
      champions_meeting: [2, 4],
    })
    expect(readSkippedRaceEvents({ champions_meeting: [1, 'x', -3, 2.5], league_of_heroes: [] }))
      .toEqual({ champions_meeting: [1] })
  })

  it('rejects anything that is not the expected shape', () => {
    expect(readSkippedRaceEvents(null)).toBeNull()
    expect(readSkippedRaceEvents([1])).toBeNull()
    expect(readSkippedRaceEvents({ champions_meeting: 3 })).toBeNull()
  })
})

describe('statsAreDirty with skips', () => {
  it('treats an empty skip object as untouched and a skip as a change', () => {
    expect(statsAreDirty({ ...DEFAULT_GUEST_STATS, skipped_race_events: {} })).toBe(false)
    expect(
      statsAreDirty({ ...DEFAULT_GUEST_STATS, skipped_race_events: { league_of_heroes: [] } })
    ).toBe(false)
    expect(
      statsAreDirty({ ...DEFAULT_GUEST_STATS, skipped_race_events: { league_of_heroes: [3] } })
    ).toBe(true)
  })
})

describe('upcomingSkippedRaces (the forecast chart\'s red dots)', () => {
  it('returns the skipped race rows still ahead, never a game event or a past race', () => {
    const rows = upcomingSkippedRaces(
      LEDGER,
      { champions_meeting: [6, 7], league_of_heroes: [7] },
      NOW
    )
    // CM 6 already paid out; the game event with id 7 is not a race.
    expect(rows.map((r) => [r.kind, r.source_id])).toEqual([
      ['champions_meeting', 7],
      ['league_of_heroes', 7],
    ])
  })

  it('is empty when nothing is skipped', () => {
    expect(upcomingSkippedRaces(LEDGER, undefined, NOW)).toEqual([])
    expect(upcomingSkippedRaces(LEDGER, {}, NOW)).toEqual([])
  })
})
