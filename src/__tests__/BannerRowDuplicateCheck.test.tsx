import { render, screen, fireEvent } from '@testing-library/react'
import { DEFAULT_CONSTANTS } from '../constants/gameConstants'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { toast } from 'sonner'
import { BannerRow } from '../components/carat-calculator/BannerRow'
import type { BannerSupport, BannerUma, UserPlannedBanner, UserStats } from '../types'
import { EMPTY_BANNER_RESOURCES } from '../hooks/bannerResources'

// Render each option through the component's own formatOptionLabel so the
// "(on sheet)" marker is observable, and expose onChange as a click. The
// sibling BannerRow.test.tsx stubs react-select to null because it only cares
// about the pull-count field; this file is specifically about the dropdown.
vi.mock('react-select', () => ({
  default: ({
    options,
    formatOptionLabel,
    onChange,
  }: {
    options: { value: BannerUma | BannerSupport; label: string }[]
    formatOptionLabel: (o: { value: BannerUma | BannerSupport; label: string }) => React.ReactNode
    onChange: (o: { value: BannerUma | BannerSupport; label: string }) => void
  }) => (
    <div>
      {options.map((option) => (
        <button
          key={option.value.id}
          type="button"
          data-testid={`option-${option.label}`}
          onClick={() => onChange(option)}
        >
          {formatOptionLabel(option)}
        </button>
      ))}
    </div>
  ),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** One window, far enough in the future that no banner reads as ended. */
const timeline = {
  id: 1,
  name: 'Shared Window',
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

// The heart of the regression: BannerUma and BannerSupport are separate tables
// with independent autoincrement PKs, and the seed data was populated in
// lockstep — so an uma banner and a support banner very often share BOTH an id
// and a timeline. Planning one must not block the other.
const umaBanner: BannerUma = {
  id: 1,
  banner_timeline: timeline,
  name: 'Uma Banner',
  admin_comments: '',
  umas: [],
  free_pulls: 0,
  is_recommended: false,
}

const supportBanner: BannerSupport = {
  id: 1,
  banner_timeline: timeline,
  name: 'Support Banner',
  admin_comments: '',
  support_cards: [],
  free_pulls: 0,
  is_recommended: false,
}

const userStats: UserStats = {
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
  misc_earnings: true,
  monthly_shop_tickets: false,
  discounted_paid_pulls: false,
  full_price_paid_pulls: true,
  club_rank: null,
  team_trials_rank: null,
  champions_meeting_rank: null,
  league_of_heroes_rank: null,
  ssr_crystals: 0,
  sr_crystals: 0,
  ssr_shards: 0,
  sr_shards: 0,
}

/** The uma banner, already sitting on the sheet in its own row. */
const plannedUmaRow: UserPlannedBanner = {
  tempId: 1,
  number_of_pulls: 0, reserved_copies: 0,
  banner_uma: umaBanner,
  initialBannerType: 'Uma',
}

/**
 * Renders an empty row of `bannerType` alongside the already-planned uma row,
 * and returns the row's dropdown options.
 */
function renderEmptyRow(bannerType: 'Uma' | 'Support') {
  const emptyRow: UserPlannedBanner = {
    tempId: 2,
    number_of_pulls: 0, reserved_copies: 0,
    initialBannerType: bannerType,
  }
  const setUserPlannedBannerData = vi.fn()

  render(
    <BannerRow
      plannedBanner={emptyRow}
      userPlannedBannerData={[plannedUmaRow, emptyRow]}
      clubRankData={[]}
      teamTrialsRankData={[]}
      championsMeetingRankData={[]}
      userStatsData={userStats}
      umaBannerData={[umaBanner]}
      supportBannerData={[supportBanner]}
      userStepUpSelectionData={[]}
			stepUpBannerData={[]}
      constants={DEFAULT_CONSTANTS}
      setUserPlannedBannerData={setUserPlannedBannerData}
      resources={{ ...EMPTY_BANNER_RESOURCES, maxPossiblePulls: 100 }}
      initialBannerType={bannerType}
    />,
  )

  // The row renders twice (mobile card + desktop row, separated by CSS only),
  // so every option appears twice under jsdom. Assert on the first.
  return { setUserPlannedBannerData }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BannerRow — same-date uma/support duplicate check', () => {
  beforeEach(() => {
    vi.mocked(toast.error).mockClear()
  })

  it('does not mark the same-id support banner as already on the sheet', () => {
    renderEmptyRow('Support')

    const option = screen.getAllByTestId('option-Support Banner')[0]
    expect(option).not.toHaveTextContent('(in calculator)')
  })

  it('lets the same-date support banner be selected after the uma banner', () => {
    const { setUserPlannedBannerData } = renderEmptyRow('Support')

    fireEvent.click(screen.getAllByTestId('option-Support Banner')[0])

    // The regression: this used to be rejected because uma #1 and support #1
    // collapsed to the same key, so the support banner looked already planned.
    expect(toast.error).not.toHaveBeenCalled()
    expect(setUserPlannedBannerData).toHaveBeenCalled()

    const updated = setUserPlannedBannerData.mock.calls[0][0] as UserPlannedBanner[]
    const supportRow = updated.find((b) => b.tempId === 2)
    expect(supportRow?.banner_support?.id).toBe(1)
    // Both banners coexist on the sheet.
    expect(updated).toHaveLength(2)
  })

  it('still blocks a genuine same-type duplicate', () => {
    const { setUserPlannedBannerData } = renderEmptyRow('Uma')

    fireEvent.click(screen.getAllByTestId('option-Uma Banner')[0])

    expect(toast.error).toHaveBeenCalledWith('This banner is already in your calculator.')
    expect(setUserPlannedBannerData).not.toHaveBeenCalled()
  })

  it('marks a genuine same-type duplicate as already on the sheet', () => {
    renderEmptyRow('Uma')

    const option = screen.getAllByTestId('option-Uma Banner')[0]
    expect(option).toHaveTextContent('(in calculator)')
  })
})
