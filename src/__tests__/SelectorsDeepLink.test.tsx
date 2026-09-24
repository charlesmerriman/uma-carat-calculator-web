import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FOCUS_TAILROOM } from '../hooks/useFocusScroll'
import type { AnniversaryEvent, UserStats } from '../types'

/**
 * The receiving end of a timeline campaign strip's "Plan purchases" link.
 *
 * The page lists every upcoming campaign, so landing without a resolved target
 * means landing at the top of a stack of near-identical cards — which is what
 * the `?campaign=` parameter exists to prevent. These tests pin the resolution,
 * not the styling.
 */

/** A campaign the planner will keep: dated, and ending in the future. */
function campaign(id: number, name: string): AnniversaryEvent {
  const day = String(id).padStart(2, '0')
  return {
    id,
    name,
    event_type: 'anniversary',
    jp_cutoff_date: null,
    image: null,
    accent_label: '',
    start_date: `2099-06-${day}T22:00:00Z`,
    main_start_date: `2099-06-${day}T22:00:00Z`,
    end_date: `2099-07-${day}T21:59:59Z`,
    is_predicted: false,
    applied_offset_days: 0,
    products: [],
    banner_parts: [],
  }
}

let campaigns: AnniversaryEvent[] = []

const STATS = {
  include_purchases_in_projection: false,
  webstore_bonus: false,
} as unknown as UserStats

vi.mock('../services/CalculatorContext', () => ({
  useCalculatorData: () => ({
    userStatsData: STATS,
    anniversaryEventData: campaigns,
    userPlannedPurchaseData: [],
    setUserPlannedPurchaseData: vi.fn(),
    setUserStatsData: vi.fn(),
    umaBannerData: [],
    supportBannerData: [],
    stepUpBannerData: [],
    userStepUpSelectionData: [],
    setUserStepUpSelectionData: vi.fn(),
    plans: [],
    activePlanId: null,
  }),
}))

const { Selectors } = await import('../components/selectors/Selectors')

function renderSelectors(url = '/app/selectors') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Selectors />
    </MemoryRouter>
  )
}

/** The end-of-list scroll padding, matched on className — see Timeline.test. */
function tailroom(): Element[] {
  return Array.from(document.querySelectorAll('div[aria-hidden="true"]')).filter(
    (el) => el.className === FOCUS_TAILROOM
  )
}

// Typed to the real DOM signature: a bare `ReturnType<typeof vi.fn>` widens to
// `Procedure | Constructable`, which won't assign onto Element.prototype.
type ScrollIntoViewFn = (options?: boolean | ScrollIntoViewOptions) => void
let scrollIntoView: ReturnType<typeof vi.fn<ScrollIntoViewFn>>

beforeEach(() => {
  campaigns = [campaign(1, 'First Fest'), campaign(2, 'Second Fest'), campaign(3, 'Third Fest')]
  // jsdom implements no scrollIntoView at all, and the hook guards on that —
  // so without this stub the scroll simply never runs.
  scrollIntoView = vi.fn<ScrollIntoViewFn>()
  Element.prototype.scrollIntoView = scrollIntoView
})

afterEach(() => {
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
})

describe('Selectors campaign deep links', () => {
  it('scrolls to the campaign the link named', () => {
    renderSelectors('/app/selectors?campaign=2')

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
  })

  it('does not scroll when no campaign was named', () => {
    renderSelectors()

    // Arriving from the navbar should leave the reader at the top, where the
    // totals and the two toggles are.
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it('renders the ordinary page for a campaign it does not hold', () => {
    // Real case, not defensive: the planner drops campaigns whose last banner
    // has closed, so a link followed from the Timeline's PAST view points at a
    // campaign that deliberately is not here.
    renderSelectors('/app/selectors?campaign=999')

    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(screen.getByText('Third Fest')).toBeInTheDocument()
  })

  it('ignores a malformed parameter rather than breaking the route', () => {
    renderSelectors('/app/selectors?campaign=not-a-number')

    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(screen.getByText('First Fest')).toBeInTheDocument()
  })

  it('pads the end of the page so the last campaign can reach the top', () => {
    renderSelectors('/app/selectors?campaign=3')

    expect(tailroom()).toHaveLength(1)
  })

  it('adds no padding when campaigns follow the target', () => {
    renderSelectors('/app/selectors?campaign=1')

    expect(tailroom()).toHaveLength(0)
  })
})
