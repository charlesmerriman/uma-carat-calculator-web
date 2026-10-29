// @vitest-environment node
// What a planner row shows, worked out from its resources. Shared by BannerRow
// and the share picture, so these pin the numbers both of them print.
import { bannerRowFigures } from '../utils/bannerRowFigures'
import { EMPTY_BANNER_RESOURCES } from '../hooks/bannerResources'
import type { BannerResources } from '../hooks/bannerResources'
import type { BannerUma, UserPlannedBanner } from '../types'

const NOW = new Date('2099-01-15T12:00:00Z')

const timeline = (end: string) => ({
  id: 1,
  name: 'Test Timeline',
  start_date: '2099-01-01T22:00:00Z',
  end_date: end,
  is_predicted: false,
  banner_category: 'standard' as const,
  schedule_offset_days: 0,
  applied_offset_days: 0,
  jp_start_date: null,
  jp_end_date: null,
  global_start_date: null,
  global_end_date: null,
  image: '',
})

const umaRow = (end = '2099-02-01T21:59:59Z', pulls = 100): UserPlannedBanner => ({
  id: 1,
  number_of_pulls: pulls,
  reserved_copies: 0,
  banner_uma: {
    id: 10, banner_timeline: timeline(end), name: 'Test Uma Banner', admin_comments: '',
    umas: [], free_pulls: 20, is_recommended: false,
  } as BannerUma,
}) as UserPlannedBanner

const resources = (extra: Partial<BannerResources> = {}): BannerResources => ({
  ...EMPTY_BANNER_RESOURCES,
  freeCarats: 12_345,
  paidCarats: 3_009,
  maxPossiblePulls: 150,
  maxPullBreakdown: { freePulls: 20, tickets: 5, paidPulls: 20, freeCaratPulls: 105 },
  ...extra,
})

describe('bannerRowFigures', () => {
  it('builds the four boxes the sheet shows, carats floored to tens', () => {
    const figures = bannerRowFigures(umaRow(), resources(), false, NOW)

    expect(figures.stats.map((stat) => [stat.label, stat.value])).toEqual([
      ['Free/Tickets/Paid', '20/5/20'],
      ['Carat Est.', (12_340).toLocaleString()],
      ['Paid Carat Est.', (3_000).toLocaleString()],
      ['Max Pulls', '150'],
    ])
    // Within the ceiling and short of a 200-pull exchange: plain, not green.
    expect(figures.countStatus).toBe('neutral')
  })

  it('reads a planned count past the ceiling as over', () => {
    expect(bannerRowFigures(umaRow(undefined, 200), resources(), false, NOW).countStatus).toBe('over')
  })

  it('zeroes a banner that ended before today, and says Passed', () => {
    const figures = bannerRowFigures(umaRow('2099-01-10T21:59:59Z'), resources(), false, NOW)

    expect(figures.bannerHasEnded).toBe(true)
    expect(figures.pullUpperBound).toBe(0)
    expect(figures.stats.map((stat) => stat.value)).toEqual(['20/0/0', '0', '0', 'Passed'])
  })

  it('relabels the first and last boxes on a step-up row', () => {
    const row = { id: 2, number_of_pulls: 3, reserved_copies: 0 } as UserPlannedBanner
    const figures = bannerRowFigures(row, resources({ stepLabel: '5x0-3', maxPossibleSteps: 12 }), true, NOW)

    expect(figures.stats[0]).toMatchObject({ label: 'Step #', value: '5x0-3' })
    expect(figures.stats[3]).toMatchObject({ label: 'Max Steps', value: '12' })
    expect(figures.alreadyMade).toBe(0)
  })
})
