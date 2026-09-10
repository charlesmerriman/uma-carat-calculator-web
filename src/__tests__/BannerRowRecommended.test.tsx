import { render, screen } from '@testing-library/react'
import { DEFAULT_CONSTANTS } from '../constants/gameConstants'
import { describe, it, expect, vi } from 'vitest'
import type { CSSObjectWithLabel } from 'react-select'
import { BannerRow } from '../components/carat-calculator/BannerRow'
import { isRecommendedBanner } from '../utils/bannerHelpers'
import type { PlannableBanner } from '../utils/bannerHelpers'
import { compactSelectStyles, withRecommendedOption } from '../utils/reactSelectStyles'
import type { BannerStepUp, BannerUma, UserPlannedBanner, UserStats } from '../types'
import { EMPTY_BANNER_RESOURCES } from '../hooks/bannerResources'

// Same harness as BannerRowDuplicateCheck.test.tsx: every option is rendered
// through the row's own formatOptionLabel, so what the open menu would show is
// observable without driving react-select's portal. The gold WASH lives in the
// styles, not the label, so it is tested directly on withRecommendedOption below.
vi.mock('react-select', () => ({
  default: ({
    options,
    formatOptionLabel,
  }: {
    options: { value: BannerUma; label: string }[]
    formatOptionLabel: (o: { value: BannerUma; label: string }) => React.ReactNode
  }) => (
    <div>
      {options.map((option) => (
        <div key={option.value.id} data-testid={`option-${option.label}`}>
          {formatOptionLabel(option)}
        </div>
      ))}
    </div>
  ),
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** A window far enough out that neither banner reads as ended. */
const timeline = {
  id: 1,
  name: 'Window',
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

function umaBanner(id: number, name: string, isRecommended: boolean): BannerUma {
  return {
    id,
    banner_timeline: timeline,
    name,
    admin_comments: '',
    umas: [],
    free_pulls: 0,
    is_recommended: isRecommended,
  }
}

const recommended = umaBanner(1, 'Rice Shower (Halloween)', true)
const ordinary = umaBanner(2, 'Super Creek', false)

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

/** An empty uma row, optionally beside rows already on the sheet. */
function renderUmaRow(alreadyPlanned: UserPlannedBanner[] = []) {
  const emptyRow: UserPlannedBanner = {
    tempId: 99,
    number_of_pulls: 0,
    reserved_copies: 0,
    initialBannerType: 'Uma',
  }

  render(
    <BannerRow
      plannedBanner={emptyRow}
      userPlannedBannerData={[...alreadyPlanned, emptyRow]}
      clubRankData={[]}
      teamTrialsRankData={[]}
      championsMeetingRankData={[]}
      userStatsData={userStats}
      umaBannerData={[recommended, ordinary]}
      supportBannerData={[]}
      userStepUpSelectionData={[]}
      stepUpBannerData={[]}
      constants={DEFAULT_CONSTANTS}
      setUserPlannedBannerData={vi.fn()}
      resources={{ ...EMPTY_BANNER_RESOURCES, maxPossiblePulls: 100 }}
      initialBannerType="Uma"
    />,
  )
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BannerRow — recommended banners in the dropdown', () => {
  // The row renders twice (mobile card + desktop row, split by CSS only), so
  // every option appears twice under jsdom. Assert on the first.

  it('stars a recommended banner and names it for screen readers', () => {
    renderUmaRow()

    const option = screen.getAllByTestId('option-Rice Shower (Halloween)')[0]
    expect(option).toHaveTextContent('Recommended:')
    expect(option.querySelector('svg')).toHaveClass('text-recommended')
  })

  it('leaves an ordinary banner unmarked', () => {
    renderUmaRow()

    const option = screen.getAllByTestId('option-Super Creek')[0]
    expect(option).not.toHaveTextContent('Recommended')
    expect(option.querySelector('svg')).toBeNull()
  })

  it('mutes the star once the banner is already in the calculator', () => {
    renderUmaRow([
      {
        tempId: 1,
        number_of_pulls: 0,
        reserved_copies: 0,
        banner_uma: recommended,
        initialBannerType: 'Uma',
      },
    ])

    const option = screen.getAllByTestId('option-Rice Shower (Halloween)')[0]
    // The greying wins: no longer a suggestion, so the star steps back too.
    expect(option).toHaveTextContent('(in calculator)')
    expect(option.querySelector('svg')).toHaveClass('text-gray-500')
  })
})

describe('isRecommendedBanner', () => {
  it('reads the flag on an uma or support row', () => {
    expect(isRecommendedBanner(recommended, 'Uma')).toBe(true)
    expect(isRecommendedBanner(ordinary, 'Uma')).toBe(false)
  })

  it('never recommends a step-up, whatever the object carries', () => {
    const stepUp = { ...recommended } as unknown as BannerStepUp
    expect(isRecommendedBanner(stepUp, 'StepUp')).toBe(false)
  })

  it('reads a missing field as not recommended (a frontend deployed ahead of the API)', () => {
    const legacy: Partial<BannerUma> = { ...recommended }
    delete legacy.is_recommended
    expect(isRecommendedBanner(legacy as PlannableBanner, 'Uma')).toBe(false)
  })
})

describe('withRecommendedOption', () => {
  type Option = { id: number; starred: boolean }
  const styles = withRecommendedOption<Option>(compactSelectStyles, (option) => option.starred)
  const provided = {} as CSSObjectWithLabel
  // compactSelectStyles only reads these three off the option's state.
  const state = (data: Option) => ({ data, isSelected: false, isFocused: false }) as never

  it('washes and bars only the options the caller picks out', () => {
    const starred = styles.option?.(provided, state({ id: 1, starred: true }))
    const plain = styles.option?.(provided, state({ id: 2, starred: false }))

    expect(starred?.backgroundImage).toContain('--color-recommended-tint')
    expect(starred?.boxShadow).toContain('--color-recommended')
    expect(plain?.backgroundImage).toBeUndefined()
    expect(plain?.boxShadow).toBeUndefined()
  })

  it('keeps the base option styling underneath the wash', () => {
    const starred = styles.option?.(provided, state({ id: 1, starred: true }))

    // The wash is an image OVER this gray, which is why it follows the theme.
    expect(starred?.backgroundColor).toBe('var(--color-gray-700)')
    expect(starred?.fontSize).toBe('12px')
  })
})
