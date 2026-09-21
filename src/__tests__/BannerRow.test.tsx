import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { DEFAULT_CONSTANTS } from '../constants/gameConstants'
import { describe, it, expect, vi } from 'vitest'
import { BannerRow } from '../components/carat-calculator/BannerRow'
import type {
  BannerStepUp,
  BannerUma,
  UserPlannedBanner,
  UserStats,
} from '../types'
import { EMPTY_BANNER_RESOURCES } from '../hooks/bannerResources'

// react-select renders a portal-based combobox that contributes nothing to what
// these tests assert (the pull-count field); stub it so the DOM stays small and
// the queries below can't accidentally match its internals.
vi.mock('react-select', () => ({ default: () => null }))

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** A banner window comfortably in the future, so it never reads as "Passed". */
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

const umaBanner: BannerUma = {
  id: 10,
  banner_timeline: timeline,
  name: 'Test Uma Banner',
  admin_comments: '',
  umas: [],
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

function renderRow(numberOfPulls: number, maxPulls: number) {
  const planned: UserPlannedBanner = {
    tempId: 1,
    number_of_pulls: numberOfPulls, reserved_copies: 0,
    banner_uma: umaBanner,
    initialBannerType: 'Uma',
  }
  const setUserPlannedBannerData = vi.fn()

  // The row's card art links to the Timeline, so it needs a router context.
  render(
    <BannerRow
      plannedBanner={planned}
      userPlannedBannerData={[planned]}
      clubRankData={[]}
      teamTrialsRankData={[]}
      championsMeetingRankData={[]}
      userStatsData={userStats}
      umaBannerData={[umaBanner]}
      supportBannerData={[]}
      userStepUpSelectionData={[]}
			stepUpBannerData={[]}
      constants={DEFAULT_CONSTANTS}
      setUserPlannedBannerData={setUserPlannedBannerData}
      resources={{ ...EMPTY_BANNER_RESOURCES, maxPossiblePulls: maxPulls }}
      initialBannerType="Uma"
    />,
    { wrapper: MemoryRouter }
  )

  // The row renders the field twice (a mobile card and a desktop row, hidden
  // from each other by CSS breakpoints only). Both are in the DOM under jsdom,
  // so grab all of them and assert on the shared state.
  //
  // Queried by accessible name, not by role alone: the Reserved column is a
  // second spinbutton in the same row, and a bare role query would assert this
  // suite's pull-count expectations against it too.
  const inputs = screen.getAllByRole('spinbutton', {
    name: 'Number of pulls',
  }) as HTMLInputElement[]
  return { inputs, setUserPlannedBannerData }
}

/**
 * Renders a row with a given reserved count and the funding split the projection
 * worked out for it, then returns every Reserved field on screen.
 *
 * `reservedFunding` is normally derived by allocateReservedCopies inside
 * useBannerResources; it's injected directly here so each case can pin one
 * funding outcome without standing up the whole projection.
 */
function renderReserved(
  reservedCopies: number,
  reservedFunding: { selectors: number; crystals: number; unfunded: number },
  numberOfPulls = 0,
  unpickedSelectorTickets = 0,
) {
  const planned: UserPlannedBanner = {
    tempId: 1,
    number_of_pulls: numberOfPulls,
    reserved_copies: reservedCopies,
    banner_uma: umaBanner,
    initialBannerType: 'Uma',
  }
  const setUserPlannedBannerData = vi.fn()

  // The row's card art links to the Timeline, so it needs a router context.
  render(
    <BannerRow
      plannedBanner={planned}
      userPlannedBannerData={[planned]}
      clubRankData={[]}
      teamTrialsRankData={[]}
      championsMeetingRankData={[]}
      userStatsData={userStats}
      umaBannerData={[umaBanner]}
      supportBannerData={[]}
      userStepUpSelectionData={[]}
			stepUpBannerData={[]}
      constants={DEFAULT_CONSTANTS}
      setUserPlannedBannerData={setUserPlannedBannerData}
      resources={{
        ...EMPTY_BANNER_RESOURCES,
        maxPossiblePulls: 1_000,
        reservedFunding,
        unpickedSelectorTickets,
      }}
      initialBannerType="Uma"
    />,
    { wrapper: MemoryRouter }
  )

  const inputs = screen.getAllByRole('spinbutton', {
    name: 'Copies obtained without pulling',
  }) as HTMLInputElement[]
  return { inputs, setUserPlannedBannerData }
}

/** The state class currently on the field, e.g. "over". */
function statusOf(input: HTMLInputElement): string | undefined {
  return Array.from(input.classList)
    .find((c) => c.startsWith('pull-input--'))
    ?.replace('pull-input--', '')
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BannerRow — pull count entry', () => {
  it('accepts a value above the affordable max instead of clamping it', () => {
    const { inputs, setUserPlannedBannerData } = renderRow(0, 30)

    fireEvent.change(inputs[0], { target: { value: '450' } })

    // The whole point of the change: 450 survives even though only 30 are
    // affordable. Previously this was rewritten to 30.
    const updated = setUserPlannedBannerData.mock.calls[0][0] as UserPlannedBanner[]
    expect(updated[0].number_of_pulls).toBe(450)
  })

  it('still floors decimals and rejects negatives', () => {
    const { inputs, setUserPlannedBannerData } = renderRow(0, 1_000)

    fireEvent.change(inputs[0], { target: { value: '2.7' } })
    expect(
      (setUserPlannedBannerData.mock.calls[0][0] as UserPlannedBanner[])[0].number_of_pulls,
    ).toBe(2)

    fireEvent.change(inputs[0], { target: { value: '-5' } })
    expect(
      (setUserPlannedBannerData.mock.calls[1][0] as UserPlannedBanner[])[0].number_of_pulls,
    ).toBe(0)
  })

  it('no longer caps the spinner arrows with a max attribute', () => {
    const { inputs } = renderRow(0, 30)
    inputs.forEach((input) => expect(input).not.toHaveAttribute('max'))
  })
})

describe('BannerRow — pull count status colouring', () => {
  it('marks an unaffordable count as over, on every rendered field', () => {
    const { inputs } = renderRow(450, 30)
    inputs.forEach((input) => expect(statusOf(input)).toBe('over'))
  })

  it('marks an affordable count on a pity threshold as ok', () => {
    const { inputs } = renderRow(200, 1_000)
    inputs.forEach((input) => expect(statusOf(input)).toBe('ok'))
  })

  it('marks an affordable count off a pity threshold as neutral', () => {
    const { inputs } = renderRow(137, 1_000)
    inputs.forEach((input) => expect(statusOf(input)).toBe('neutral'))
  })

  it('exposes the over state to assistive tech, not just as colour', () => {
    const { inputs } = renderRow(450, 30)
    inputs.forEach((input) => {
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(input).toHaveAttribute('title', expect.stringContaining('max 30'))
    })
  })

  it('does not mark an affordable count as invalid', () => {
    const { inputs } = renderRow(200, 1_000)
    inputs.forEach((input) => expect(input).toHaveAttribute('aria-invalid', 'false'))
  })
})

describe('BannerRow — reserved copies', () => {
  // The regression this suite exists for: the field shipped live on the mobile
  // card while the desktop grid cell was still a disabled placeholder. Both
  // layouts are in the DOM under jsdom (the switch between them is CSS-only), so
  // a count below two means one of them has gone dead again.
  it('renders an editable field in both layouts', () => {
    const { inputs } = renderReserved(0, { selectors: 0, crystals: 0, unfunded: 0 })

    expect(inputs.length).toBeGreaterThanOrEqual(2)
    inputs.forEach((input) => expect(input).toBeEnabled())
  })

  it('marks a fully funded count as ok and shows the funding split', () => {
    const { inputs } = renderReserved(3, { selectors: 2, crystals: 1, unfunded: 0 })

    inputs.forEach((input) => {
      expect(statusOf(input)).toBe('ok')
      expect(input).toHaveAttribute('aria-invalid', 'false')
    })
    // Abbreviated to fit the 5rem track — full wording lives in the title.
    expect(screen.getAllByText('2s 1c')).toHaveLength(inputs.length)
  })

  it('marks an under-funded count as over, and says so without relying on colour', () => {
    const { inputs } = renderReserved(3, { selectors: 1, crystals: 0, unfunded: 2 })

    inputs.forEach((input) => {
      expect(statusOf(input)).toBe('over')
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(input).toHaveAttribute('title', expect.stringContaining('2 more copies'))
    })
    // Over-reserved rows swap the split for funded/asked-for.
    expect(screen.getAllByText('1/3')).toHaveLength(inputs.length)
  })

  it('points at the Selectors page when a selector with no pick is sitting unused', () => {
    const { inputs } = renderReserved(1, { selectors: 0, crystals: 0, unfunded: 1 }, 0, 1)

    inputs.forEach((input) => {
      expect(statusOf(input)).toBe('over')
      expect(input).toHaveAttribute('title', expect.stringContaining('no card picked'))
    })
  })

  it('keeps the unpicked selector note off a row that is fully funded', () => {
    const { inputs } = renderReserved(1, { selectors: 1, crystals: 0, unfunded: 0 }, 0, 1)

    inputs.forEach((input) => {
      expect(input).toHaveAttribute('title', expect.stringContaining('1 from selectors'))
    })
  })

  it('hides the funding hint when nothing is reserved', () => {
    renderReserved(0, { selectors: 0, crystals: 0, unfunded: 0 })
    expect(screen.queryByText('0s 0c')).toBeNull()
  })

  it('floors decimals and rejects negatives, and does not clamp to what is funded', () => {
    const { inputs, setUserPlannedBannerData } = renderReserved(0, {
      selectors: 0,
      crystals: 0,
      unfunded: 0,
    })

    fireEvent.change(inputs[0], { target: { value: '2.7' } })
    expect(
      (setUserPlannedBannerData.mock.calls[0][0] as UserPlannedBanner[])[0].reserved_copies,
    ).toBe(2)

    fireEvent.change(inputs[0], { target: { value: '-5' } })
    expect(
      (setUserPlannedBannerData.mock.calls[1][0] as UserPlannedBanner[])[0].reserved_copies,
    ).toBe(0)

    // Over-reserving is reported, not prevented — mirroring the pull-count field.
    fireEvent.change(inputs[0], { target: { value: '99' } })
    expect(
      (setUserPlannedBannerData.mock.calls[2][0] as UserPlannedBanner[])[0].reserved_copies,
    ).toBe(99)
  })

  // The other half of the same regression: the desktop MLBChanceDisplay was
  // omitting reservedCopies, so reserved copies shifted the odds on a phone and
  // did nothing in the table.
  it('shifts the odds in every rendered chance display', () => {
    renderReserved(5, { selectors: 5, crystals: 0, unfunded: 0 })

    // With 0 pulls the distribution sits entirely on "None"; five certain copies
    // push all of it onto the 5x cell. Asserting on the cell rather than a bare
    // "100.0%" count pins WHERE the mass landed, and checking every rendered
    // display catches one layout being wired while the other isn't.
    const cells = screen.getAllByText('5x')
    expect(cells.length).toBeGreaterThan(0)
    cells.forEach((label) => expect(label.parentElement).toHaveTextContent('100.0%'))
  })

  it('credits only funded copies to the odds, never the unfunded ones', () => {
    renderReserved(5, { selectors: 2, crystals: 0, unfunded: 3 })

    // Two funded copies were paid for, so the certainty lands on 2x — not on the
    // 5x the user asked for and can't afford.
    screen
      .getAllByText('2x')
      .forEach((label) => expect(label.parentElement).toHaveTextContent('100.0%'))
    screen
      .getAllByText('5x')
      .forEach((label) => expect(label.parentElement).toHaveTextContent('0.0%'))
  })
})

// ── Step-up rows ──────────────────────────────────────────────────────────────

const stepUpBanner: BannerStepUp = {
  id: 20,
  banner_timeline: timeline,
  anniversary_event: 5,
  name: '5th Anniversary ★3 Select Step-Up',
  card_type: 'uma',
  banner_count: 2,
  max_steps: 10,
  jp_cutoff_date: '2026-01-30',
  image: null,
  admin_comments: '',
  order: 0,
}

function renderStepUpRow(steps: number, maxSteps: number, stepLabel = '0') {
  const planned: UserPlannedBanner = {
    tempId: 1,
    number_of_pulls: steps,
    reserved_copies: 0,
    banner_step_up: stepUpBanner,
    initialBannerType: 'StepUp',
  }
  // The row's card art links to the Timeline, so it needs a router context.
  render(
    <BannerRow
      plannedBanner={planned}
      userPlannedBannerData={[planned]}
      clubRankData={[]}
      teamTrialsRankData={[]}
      championsMeetingRankData={[]}
      userStatsData={userStats}
      umaBannerData={[]}
      supportBannerData={[]}
      userStepUpSelectionData={[]}
			stepUpBannerData={[stepUpBanner]}
      constants={DEFAULT_CONSTANTS}
      setUserPlannedBannerData={vi.fn()}
      resources={{
        ...EMPTY_BANNER_RESOURCES,
        maxPossibleSteps: maxSteps,
        chargeableSteps: steps,
        stepLabel,
      }}
      initialBannerType="StepUp"
    />,
    { wrapper: MemoryRouter }
  )
}

describe('BannerRow — step-up rows', () => {
  it('relabels the two boxes whose meaning changes, and only those', () => {
    renderStepUpRow(7, 10, '5x1-2')
    // The sheet's header swaps, done per row because our headers are global.
    expect(screen.getAllByText('Step #').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Max Steps').length).toBeGreaterThan(0)
    expect(screen.getAllByText('5x1-2').length).toBeGreaterThan(0)
    // The two carat boxes mean the same thing on every kind of row.
    expect(screen.getAllByText('Carat Est.').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Paid Carat Est.').length).toBeGreaterThan(0)
    // ...and the pull vocabulary is gone.
    expect(screen.queryByText('Max Pulls')).toBeNull()
    expect(screen.queryByText('Free/Tickets/Paid')).toBeNull()
  })

  it('names the count field for steps, not pulls', () => {
    renderStepUpRow(5, 10, '5x1')
    expect(
      screen.getAllByRole('spinbutton', { name: 'Number of steps' }).length,
    ).toBeGreaterThan(0)
    expect(
      screen.queryByRole('spinbutton', { name: 'Number of pulls' }),
    ).toBeNull()
  })

  it('greens a completed ladder and stays neutral part-way up', () => {
    renderStepUpRow(5, 10, '5x1')
    const done = screen.getAllByRole('spinbutton', {
      name: 'Number of steps',
    })[0] as HTMLInputElement
    expect(statusOf(done)).toBe('ok')
  })

  it('flags more steps than the campaign can fund', () => {
    renderStepUpRow(9, 4, '5x1-4')
    const over = screen.getAllByRole('spinbutton', {
      name: 'Number of steps',
    })[0] as HTMLInputElement
    expect(statusOf(over)).toBe('over')
    expect(over.getAttribute('aria-invalid')).toBe('true')
  })

  it('shows the JP cutoff so a user can see what the ladder can offer', () => {
    // Without it a user can plan a step-up for a unit it could never hand over.
    renderStepUpRow(5, 10, '5x1')
    expect(screen.getAllByText(/JP cutoff/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('★3').length).toBeGreaterThan(0)
  })
})
