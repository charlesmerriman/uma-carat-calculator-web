import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { DEFAULT_CONSTANTS } from '../constants/gameConstants'
import { BannerRow } from '../components/carat-calculator/BannerRow'
import type { BannerUma, Uma, UserPlannedBanner, UserStats } from '../types'
import { EMPTY_BANNER_RESOURCES } from '../hooks/bannerResources'
import { twoCardDistribution } from '../utils/probabilityCalculations'

// The banner picker is irrelevant here; see BannerRow.test.tsx.
vi.mock('react-select', () => ({ default: () => null }))

// ── Fixtures ──────────────────────────────────────────────────────────────────

const timeline = {
  id: 1,
  name: 'Test Timeline',
  start_date: '2099-01-01T22:00:00Z',
  end_date: '2099-02-01T21:59:59Z',
  is_predicted: false,
  banner_category: 'standard' as const,
  schedule_offset_days: 0,
  applied_offset_days: 0,
  jp_start_date: null,
  jp_end_date: null,
  global_start_date: '2099-01-01T22:00:00Z',
  global_end_date: '2099-02-01T21:59:59Z',
  image: '',
}

const uma = (id: number, name: string): Uma =>
  ({ id, name, image: '', rarity: 3 }) as Uma

const banner = (umas: Uma[]): BannerUma => ({
  id: 10,
  banner_timeline: timeline,
  name: umas.map((u) => u.name).join(' + '),
  admin_comments: '',
  umas,
  free_pulls: 0,
  is_recommended: false,
})

const pair = banner([uma(1, 'Kitasan Black'), uma(2, 'Satono Diamond')])

const userStats = {
  current_carat: 0, current_paid_carat: 0, uma_ticket: 0, support_ticket: 0,
  uma_selector_ticket: 0, support_selector_ticket: 0,
  include_purchases_in_projection: false, webstore_bonus: false, daily_carat: false,
  training_pass: false, misc_earnings: true, monthly_shop_tickets: false,
  spend_tickets_on_banners: true, discounted_paid_pulls: false, full_price_paid_pulls: true,
  club_rank: null, team_trials_rank: null, champions_meeting_rank: null,
  league_of_heroes_rank: null, ssr_crystals: 0, sr_crystals: 0, ssr_shards: 0, sr_shards: 0,
} as UserStats

function renderRow(
  bannerUma: BannerUma,
  extra: Pick<UserPlannedBanner, 'primary_card' | 'second_card' | 'primary_target'> = {},
) {
  const planned: UserPlannedBanner = {
    tempId: 1,
    number_of_pulls: 600,
    reserved_copies: 0,
    banner_uma: bannerUma,
    initialBannerType: 'Uma',
    ...extra,
  }
  const setUserPlannedBannerData = vi.fn()
  render(
    <BannerRow
      plannedBanner={planned}
      userPlannedBannerData={[planned]}
      clubRankData={[]}
      teamTrialsRankData={[]}
      championsMeetingRankData={[]}
      userStatsData={userStats}
      umaBannerData={[bannerUma]}
      supportBannerData={[]}
      userStepUpSelectionData={[]}
      stepUpBannerData={[]}
      constants={DEFAULT_CONSTANTS}
      setUserPlannedBannerData={setUserPlannedBannerData}
      resources={{ ...EMPTY_BANNER_RESOURCES, maxPossiblePulls: 600 }}
      initialBannerType="Uma"
    />,
    { wrapper: MemoryRouter },
  )
  /** The row list the last change handed to the provider. */
  const lastSaved = () =>
    setUserPlannedBannerData.mock.calls.at(-1)?.[0] as UserPlannedBanner[]
  return { lastSaved }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BannerRow odds cards', () => {
  it('adds no control to a one-card banner', () => {
    renderRow(banner([uma(1, 'Kitasan Black')]))
    expect(screen.queryByRole('button', { name: /Odds for/ })).toBeNull()
  })

  it('names the card the odds are for on a two-card banner', () => {
    renderRow(pair)
    // Both layouts are in the DOM under jsdom; each carries the caption.
    expect(screen.getAllByRole('button', { name: 'Odds for Kitasan Black' }).length)
      .toBeGreaterThan(0)
  })

  it('turns two-card odds on from the panel', () => {
    const { lastSaved } = renderRow(pair)
    fireEvent.click(screen.getAllByRole('button', { name: 'Odds for Kitasan Black' })[0])

    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Also show' })[0])

    expect(lastSaved()[0].second_card).toBe(2)
  })

  it('swaps the two when the second card is picked as the first', () => {
    const { lastSaved } = renderRow(pair, { second_card: 2 })
    fireEvent.click(screen.getAllByRole('button', { name: /Kitasan Black 1x \+ Satono Diamond/ })[0])

    fireEvent.change(screen.getAllByRole('combobox', { name: 'Odds for' })[0], {
      target: { value: '2' },
    })

    expect(lastSaved()[0]).toMatchObject({ primary_card: 2, second_card: 1 })
  })

  it('shows the joint odds once a second card is on', () => {
    renderRow(pair, { second_card: 2 })

    expect(
      screen.getAllByRole('button', { name: 'Kitasan Black 1x + Satono Diamond' }).length,
    ).toBeGreaterThan(0)
    // The top cell reads "1x & 5x" on an uma banner, and its number is the
    // one-copy target's, from the same function the row calls.
    const joint = twoCardDistribution({
      pulls: 600, rateA: 0.0075, rateB: 0.0075, reservedCopies: 0, targetA: 1,
    })
    expect(screen.getAllByText(`${joint[5].toFixed(1)}%`).length).toBeGreaterThan(0)
  })

  it('keeps the target toggle greyed out until a second card is on', () => {
    renderRow(pair)
    fireEvent.click(screen.getAllByRole('button', { name: 'Odds for Kitasan Black' })[0])
    // Rendered, so ticking the box moves nothing, but not usable yet.
    expect(screen.getAllByRole('radio', { name: '5x' })[0]).toHaveProperty('disabled', true)
  })

  it('saves the first card target from the toggle', () => {
    const { lastSaved } = renderRow(pair, { second_card: 2 })
    fireEvent.click(screen.getAllByRole('button', { name: /Kitasan Black 1x \+ Satono Diamond/ })[0])

    // An uma banner offers one copy or all five, and starts on one copy.
    expect(screen.getAllByRole('radio', { name: '1x' })[0].getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getAllByRole('radio', { name: '5x' })[0])

    expect(lastSaved()[0].primary_target).toBe(5)
  })

  it('reads a saved target into the caption and the cells', () => {
    renderRow(pair, { second_card: 2, primary_target: 5 })

    expect(
      screen.getAllByRole('button', { name: 'Kitasan Black 5x + Satono Diamond' }).length,
    ).toBeGreaterThan(0)
    const joint = twoCardDistribution({
      pulls: 600, rateA: 0.0075, rateB: 0.0075, reservedCopies: 0, targetA: 5,
    })
    expect(screen.getAllByText(`${joint[5].toFixed(1)}%`).length).toBeGreaterThan(0)
  })

  it('falls back to the default card when the saved one has left the banner', () => {
    renderRow(pair, { primary_card: 99, second_card: 98 })
    expect(screen.getAllByRole('button', { name: 'Odds for Kitasan Black' }).length)
      .toBeGreaterThan(0)
  })

  // Desktop (the last copy of each control; the phone card renders first): the
  // row options and the odds picker are one drawer, and either button opens or
  // closes the whole of it.
  it('opens one drawer with the options and the odds from either desktop button', () => {
    renderRow(pair)
    const caption = () => screen.getAllByRole('button', { name: 'Odds for Kitasan Black' }).at(-1)!
    const noteButton = () => screen.getAllByRole('button', { name: 'Row options and note' }).at(-1)!
    expect(screen.queryByText('Count this banner')).toBeNull()

    fireEvent.click(caption())
    expect(screen.getAllByText('Count this banner').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('checkbox', { name: 'Also show' }).length).toBeGreaterThan(0)
    expect(noteButton().getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(noteButton())
    expect(screen.queryByText('Count this banner')).toBeNull()
    expect(screen.queryByRole('checkbox', { name: 'Also show' })).toBeNull()

    fireEvent.click(noteButton())
    expect(screen.getAllByText('Count this banner').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('checkbox', { name: 'Also show' }).length).toBeGreaterThan(0)
  })

  // The desktop drawer is three titled columns (This banner, Odds, Note); a
  // banner with one rate-up card has no odds to pick, so no Odds column.
  it('lays the desktop drawer out as This banner, Odds and Note', () => {
    renderRow(pair)
    fireEvent.click(screen.getAllByRole('button', { name: 'Odds for Kitasan Black' }).at(-1)!)
    const headings = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)
    expect(headings).toEqual(['This banner', 'Odds', 'Note'])
    // The column's select keeps "Odds for" as its name under the "Card" label.
    expect(screen.getAllByRole('combobox', { name: 'Odds for' }).length).toBeGreaterThan(0)
  })

  it('leaves the Odds column out on a one-card banner', () => {
    renderRow(banner([uma(1, 'Kitasan Black')]))
    fireEvent.click(screen.getAllByRole('button', { name: 'Row options and note' }).at(-1)!)
    const headings = screen.getAllByRole('heading', { level: 4 }).map((h) => h.textContent)
    expect(headings).toEqual(['This banner', 'Note'])
  })
})
