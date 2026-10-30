import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { BannerRow } from '../components/carat-calculator/BannerRow'
import { DEFAULT_CONSTANTS } from '../constants/gameConstants'
import { DEFAULT_GUEST_STATS } from '../services/guestMigration'
import { EMPTY_BANNER_RESOURCES } from '../hooks/bannerResources'
import type { BannerUma, UserPlannedBanner } from '../types'

/**
 * The row options panel, as BannerRow wires it: the note button opens it, and
 * every control reports a change to the plan as a merged row.
 */

vi.mock('react-select', () => ({ default: () => null }))

const timeline = {
  id: 1,
  name: 'Timeline',
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

const umaBanner: BannerUma = {
  id: 10,
  banner_timeline: timeline,
  name: 'Test Uma Banner',
  admin_comments: '',
  umas: [],
  free_pulls: 0,
  is_recommended: false,
}

function renderRow(extra: Partial<UserPlannedBanner> = {}, ticketsSpent = 0, openPanel = true) {
  const planned = {
    tempId: 1,
    number_of_pulls: 0,
    reserved_copies: 0,
    banner_uma: umaBanner,
    initialBannerType: 'Uma',
    ...extra,
  } as UserPlannedBanner
  const setUserPlannedBannerData = vi.fn()
  render(
    <BannerRow
      plannedBanner={planned}
      userPlannedBannerData={[planned]}
      clubRankData={[]}
      teamTrialsRankData={[]}
      championsMeetingRankData={[]}
      userStatsData={DEFAULT_GUEST_STATS}
      umaBannerData={[umaBanner]}
      supportBannerData={[]}
      userStepUpSelectionData={[]}
      stepUpBannerData={[]}
      constants={DEFAULT_CONSTANTS}
      setUserPlannedBannerData={setUserPlannedBannerData}
      resources={{ ...EMPTY_BANNER_RESOURCES, maxPossiblePulls: 500, ticketsSpent }}
      initialBannerType="Uma"
    />,
    { wrapper: MemoryRouter }
  )
  // Mobile card and desktop row are both in the DOM under jsdom; open one.
  if (openPanel) fireEvent.click(screen.getAllByRole('button', { name: /row options and note/i })[0])
  const lastRow = (): UserPlannedBanner =>
    setUserPlannedBannerData.mock.calls.at(-1)?.[0][0]
  return { lastRow }
}

describe('the note panel after a page change', () => {
  it('stays open until a reload', () => {
    renderRow()
    cleanup()
    renderRow({}, 0, false)
    expect(screen.getAllByRole('button', { name: /row options and note/i })[0]).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('row options panel', () => {
  it('shows the automatic ticket figure, and typing over it sets a limit', () => {
    const { lastRow } = renderRow({}, 7)
    const [field] = screen.getAllByRole('spinbutton', { name: 'Most tickets to use on this banner' })
    expect(field).toHaveValue('7')
    fireEvent.change(field, { target: { value: '3' } })
    fireEvent.blur(field)
    expect(lastRow().tickets_to_use).toBe(3)
  })

  it('puts a limit back on automatic', () => {
    const { lastRow } = renderRow({ tickets_to_use: 2 })
    fireEvent.click(screen.getAllByRole('button', { name: 'Auto' })[0])
    expect(lastRow().tickets_to_use).toBeNull()
  })

  it('switches the row out of the projection and says so', () => {
    const { lastRow } = renderRow()
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'Count this banner in the projection' })[0])
    expect(lastRow().excluded_from_projection).toBe(true)
  })

  it('shows the notice on a row that is left out', () => {
    renderRow({ excluded_from_projection: true })
    expect(screen.getAllByText(/Not counted: this banner spends nothing/).length).toBeGreaterThan(0)
  })

  // The shortcuts are switched off for now (SHOW_PULL_SHORTCUTS in BannerRow).
  it.skip('sets the pulls from a shortcut', () => {
    const { lastRow } = renderRow()
    fireEvent.click(screen.getAllByRole('button', { name: 'Next exchange (200)' })[0])
    expect(lastRow().number_of_pulls).toBe(200)
  })

  it('offers "Already pulled" only on a live banner, or one that holds a value', () => {
    renderRow()
    // The fixture banner starts in 2099: not live yet.
    expect(screen.queryByRole('spinbutton', { name: /already made/ })).toBeNull()
  })
})
