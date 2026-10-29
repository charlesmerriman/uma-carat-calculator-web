import { useEffect, useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { RaceEventCard } from '../components/timeline/RaceEventCard'
import { CalculatorContext } from '../services/CalculatorContext'
import { DEFAULT_GUEST_STATS } from '../services/guestMigration'
import type { CalculatorContextType, ChampionsMeeting, ChampionsMeetingRank, UserStats } from '../types'
import type { IncomeLedgerRow } from '../types/ledger'

/**
 * The "taking part" switch on a race card: drawn while the event's payout is
 * still ahead, and flipping it writes the skip onto the stats block, which is
 * the only thing the projection reads (utils/raceParticipation). The "Your
 * rewards" panel beside it (hooks/useRaceRewards) shares its bounds.
 */

const meeting = (id: number, end: string): ChampionsMeeting => ({
  id,
  name: `Champions Meeting ${id}`,
  event_type: 'champions_meeting',
  cm_number: id,
  start_date: '2099-01-10T00:00:00Z',
  end_date: end,
  is_predicted: false,
  jp_start_date: null,
  jp_end_date: null,
  global_start_date: '2099-01-10T00:00:00Z',
  global_end_date: end,
  schedule_offset_days: 0,
  applied_offset_days: 0,
  image: null,
  track: null,
  surface_type: null,
  distance: null,
  length: null,
  track_condition: null,
  season: null,
  weather: null,
  direction: null,
} as unknown as ChampionsMeeting)

const ledgerRow = (id: number, date: string): IncomeLedgerRow => ({
  date,
  kind: 'champions_meeting',
  source_id: id,
  name: 'CM',
  is_predicted: false,
  throughout_end: null,
  event_number: id,
  carats: 0,
  carats_throughout: 0,
  uma_tickets: 0,
  support_tickets: 0,
  ssr_shards: 0,
  ssr_crystals: 0,
  sr_shards: 0,
  sr_crystals: 0,
})

// A CM that pays day by day (backend race_payouts.py): days 1 to 4, then the
// finals; tickets with day 4.
const PAYOUTS = [
  '2099-01-11T00:00:00Z', '2099-01-12T00:00:00Z', '2099-01-13T00:00:00Z',
  '2099-01-14T00:00:00Z', '2099-01-16T00:00:00Z',
]

// One far-future CM and one long past, so the test never depends on today,
// and a far-future one with its payout days.
const LEDGER = [
  ledgerRow(1, '2099-01-16T00:00:00Z'),
  ledgerRow(2, '2001-01-16T00:00:00Z'),
  { ...ledgerRow(3, PAYOUTS[4]), payouts: PAYOUTS, tickets_at: PAYOUTS[3], shards_at: PAYOUTS[3] },
]

const CHAMPION = {
  id: 1,
  name: 'Champion',
  income_amount: 3300,
  uma_ticket_amount: 5,
  support_ticket_amount: 5,
  ssr_shard_amount: 0,
  sr_shard_amount: 0,
  day_amounts: [130, 130, 270, 270, 2500],
  rewards: [],
} as ChampionsMeetingRank

let latestStats: UserStats | null = null

function Harness({ event, stats: initial }: { event: ChampionsMeeting; stats?: Partial<UserStats> }) {
  const [stats, setStats] = useState<UserStats | null>({ ...DEFAULT_GUEST_STATS, ...initial })
  // Reported after render, where the test reads it.
  useEffect(() => {
    latestStats = stats
  }, [stats])
  const value = {
    userStatsData: stats,
    setUserStatsData: setStats,
    fullIncomeLedger: LEDGER,
    championsMeetingRankData: [CHAMPION],
    leagueOfHeroesRankData: [],
  } as unknown as CalculatorContextType
  return (
    <CalculatorContext.Provider value={value}>
      <MemoryRouter>
        <RaceEventCard event={event} today={new Date('2099-01-01T00:00:00Z')} />
      </MemoryRouter>
    </CalculatorContext.Provider>
  )
}

describe('RaceEventCard taking-part switch', () => {
  it('defaults to taking part, and switching off records the skip', () => {
    render(<Harness event={meeting(1, '2099-01-17T00:00:00Z')} />)
    const toggle = screen.getByRole('checkbox', { name: 'Taking part in Champions Meeting 1' })
    expect(toggle).toBeChecked()
    expect(screen.queryByText(/skipping this one/)).toBeNull()

    fireEvent.click(toggle)
    expect(latestStats?.skipped_race_events).toEqual({ champions_meeting: [1] })
    expect(toggle).not.toBeChecked()
    expect(screen.getByText(/skipping this one/)).toBeInTheDocument()

    fireEvent.click(toggle)
    expect(latestStats?.skipped_race_events).toEqual({})
  })

  it('is not drawn once the payout is behind the projection', () => {
    render(<Harness event={meeting(2, '2001-01-17T00:00:00Z')} />)
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('is not drawn outside the calculator provider', () => {
    render(
      <MemoryRouter>
        <RaceEventCard event={meeting(1, '2099-01-17T00:00:00Z')} today={new Date('2099-01-01T00:00:00Z')} />
      </MemoryRouter>
    )
    expect(screen.queryByRole('checkbox')).toBeNull()
  })
})

describe('RaceEventCard rewards panel', () => {
  it('lists what the event pays at the chosen finish, and shows it left out once skipped', () => {
    render(<Harness event={meeting(3, '2099-01-17T00:00:00Z')} stats={{ champions_meeting_rank: 1 }} />)
    expect(screen.getByText('Your rewards')).toBeInTheDocument()
    expect(screen.getByText('carats as Champion')).toBeInTheDocument()
    expect(screen.getByText('3,300')).toBeInTheDocument()
    const days = within(screen.getByRole('list', { name: 'Carats by payout day' })).getAllByRole('listitem')
    expect(days.map((day) => day.textContent?.match(/\+[\d,]+$/)?.[0])).toEqual(['+130', '+130', '+270', '+270', '+2,500'])
    expect(screen.getByText('5 uma, 5 support')).toBeInTheDocument()
    // This rank pays no shards, so there is no shards line.
    expect(screen.queryByText(/Shards:/)).toBeNull()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Taking part in Champions Meeting 3' }))
    expect(screen.getByText('carats left out')).toBeInTheDocument()
  })

  it('is not drawn with no finish picked', () => {
    render(<Harness event={meeting(3, '2099-01-17T00:00:00Z')} />)
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
    expect(screen.queryByText('Your rewards')).toBeNull()
  })

  it('is not drawn once the payout is behind the projection', () => {
    render(<Harness event={meeting(2, '2001-01-17T00:00:00Z')} stats={{ champions_meeting_rank: 1 }} />)
    expect(screen.queryByText('Your rewards')).toBeNull()
  })
})
