import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { TIMELINE_FOCUS_HIGHLIGHT } from '../components/timeline/timelineShared'
import { FOCUS_TAILROOM } from '../hooks/useFocusScroll'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type {
  AnniversaryEvent,
  BannerCategory,
  BannerTimeline,
  BannerTimelineForViewing,
  ChampionsMeeting,
  Scenario,
  SupportCard,
  TimelineEvent,
  Uma,
} from '../types'

/**
 * Timeline's infinite scroll is driven by an IntersectionObserver, which jsdom
 * doesn't implement. The component reads `typeof IntersectionObserver` once at
 * module scope to decide whether it can window the list at all, so the fake has
 * to exist *before* the module is imported — hence `vi.hoisted`, which runs
 * ahead of the hoisted ESM imports above.
 *
 * Crucially the fake fires each instance **at most once**, mirroring the real
 * API: an observer reports a *transition* into view, and stays silent while the
 * target remains there. So the only way this list keeps growing is if the
 * component tears its observer down and builds a new one after each append —
 * which is exactly the behaviour the effect's dependency list exists to produce,
 * and which a more permissive fake would let regress unnoticed.
 */
const { getActiveObserver, resetObservers } = vi.hoisted(() => {
  type FakeEntry = { isIntersecting: boolean }
  type FakeCallback = (entries: FakeEntry[]) => void
  type Instance = { callback: FakeCallback; disconnected: boolean; fired: boolean }

  const instances: Instance[] = []

  class FakeIntersectionObserver {
    root = null
    rootMargin = ''
    thresholds: number[] = []
    private instance: Instance

    constructor(callback: FakeCallback) {
      this.instance = { callback, disconnected: false, fired: false }
      instances.push(this.instance)
    }
    observe() {}
    unobserve() {}
    takeRecords() {
      return []
    }
    disconnect() {
      this.instance.disconnected = true
    }
  }

  globalThis.IntersectionObserver =
    FakeIntersectionObserver as unknown as typeof IntersectionObserver

  return {
    /** The newest observer that is still attached and hasn't already reported. */
    getActiveObserver: () =>
      [...instances].reverse().find((i) => !i.disconnected && !i.fired) ?? null,
    resetObservers: () => {
      instances.length = 0
    },
  }
})

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TOTAL_EVENTS = 25

/**
 * Banner windows with no featured umas or support cards. Each card still renders
 * its date header and both "No … in this window." panels, and that fallback
 * string is exactly one per card — which is what the card counting below uses.
 * Dates are in 2099 so every event survives the default current/future filter.
 */
const BASE_EVENTS: BannerTimelineForViewing[] = Array.from(
  { length: TOTAL_EVENTS },
  (_, i) => {
    const day = String(i + 1).padStart(2, '0')
    return {
      id: i + 1,
      name: `Window ${day}`,
      banner_category: 'standard',
      event_type: 'banner_timeline',
      start_date: `2099-01-${day}T22:00:00Z`,
      end_date: `2099-02-${day}T21:59:59Z`,
      is_predicted: false,
      jp_start_date: null,
      jp_end_date: null,
      global_start_date: `2099-01-${day}T22:00:00Z`,
      global_end_date: `2099-02-${day}T21:59:59Z`,
      // Confirmed rows carry no schedule correction, and these are diagnostic
      // only — the dates above are already complete.
      schedule_offset_days: 0,
      applied_offset_days: 0,
      image: null,
      banner_umas: [],
      banner_supports: [], anniversary_event: null,
 banner_step_ups: [],
    }
  },
)

/**
 * What the mocked context serves. Reassignable so a test can swap in a smaller,
 * purpose-built dataset — the mock factory below reads this at render time, not
 * at module load, so a reassignment before `render` takes effect. Restored in
 * an afterEach so it can't leak between suites.
 */
let events: TimelineEvent[] = BASE_EVENTS

/** A Champions Meeting, for asserting what the category filter does to races. */
function raceEvent(id: number, day: string): ChampionsMeeting {
  return {
    id,
    name: `Champions Meeting ${id}`,
    event_type: 'champions_meeting',
    cm_number: id,
    start_date: `2099-03-${day}T22:00:00Z`,
    end_date: `2099-04-${day}T21:59:59Z`,
    is_predicted: false,
    jp_start_date: null,
    jp_end_date: null,
    global_start_date: null,
    global_end_date: null,
    schedule_offset_days: 0,
    applied_offset_days: 0,
    image: null,
    track: 'Tokyo',
    surface_type: 'Turf',
    distance: 'Mile',
    length: '1600m',
    track_condition: 'Firm',
    season: 'Spring',
    weather: 'Sunny',
    direction: 'Left',
    speed_recommendation: '',
    stamina_recommendation: '',
  } as ChampionsMeeting
}

/** A banner window built off the base fixture, with only the dates that matter. */
function windowAt(
  id: number,
  start: string,
  end: string,
): BannerTimelineForViewing {
  return {
    ...BASE_EVENTS[0],
    id,
    name: `Window ${id}`,
    start_date: start,
    end_date: end,
    global_start_date: start,
    global_end_date: end,
  }
}

/**
 * The API omits `banner_timeline` from banners nested inside a timeline, but
 * the shared BannerUma/BannerSupport type still declares it. This stands in for
 * it so the fixtures below type-check without a cast.
 */
const NESTED_TIMELINE: BannerTimeline = {
  id: 0,
  name: 'nested',
  banner_category: 'standard',
  start_date: '2099-03-01T22:00:00Z',
  end_date: '2099-03-08T21:59:59Z',
  is_predicted: false,
  jp_start_date: null,
  jp_end_date: null,
  global_start_date: null,
  global_end_date: null,
  schedule_offset_days: 0,
  applied_offset_days: 0,
  image: '',
}

function card<T extends Uma | SupportCard>(id: number, name: string): T {
  return {
    id,
    name,
    image: `${name}.png`,
    admin_comments: '',
    recommendation: '',
    purpose: '',
    first_jp_date: null,
  } as T
}

/**
 * A window of the given category, carrying the named umas and support cards.
 *
 * Dates derive from the id so two calls produce two separate cards. Grouping
 * keys on an identical start date, and a helper that silently folded every
 * fixture into one card would make the filter tests below meaningless.
 */
function categorised(
  id: number,
  category: BannerCategory,
  umas: string[],
  supports: string[] = [],
): BannerTimelineForViewing {
  const day = String(id).padStart(2, '0')
  const base = windowAt(id, `2099-03-${day}T22:00:00Z`, `2099-04-${day}T21:59:59Z`)
  return {
    ...base,
    banner_category: category,
    banner_umas: umas.length
      ? [
          {
            id,
            banner_timeline: NESTED_TIMELINE,
            name: `Uma banner ${id}`,
            admin_comments: '',
            umas: umas.map((n, i) => card<Uma>(i + 1, n)),
            free_pulls: 0,
            is_recommended: false,
          },
        ]
      : [],
    banner_supports: supports.length
      ? [
          {
            id,
            banner_timeline: NESTED_TIMELINE,
            name: `Support banner ${id}`,
            admin_comments: '',
            support_cards: supports.map((n, i) => card<SupportCard>(i + 1, n)),
            free_pulls: 0,
            is_recommended: false,
          },
        ]
      : [],
  }
}

/**
 * Marker sources, reassignable for the same reason `events` is.
 *
 * Empty by default on purpose: most suites here are about banner windows, and a
 * marker card would change the card counts they assert on. The filter suite
 * swaps them in.
 */
let scenarios: Scenario[] = []
let campaigns: AnniversaryEvent[] = []

/** A dated scenario, which is all a marker needs from one. */
function scenario(id: number, name: string): Scenario {
  return {
    id,
    name,
    image: null,
    banner_timeline: null,
    start_date: `2099-05-${String(id).padStart(2, '0')}T22:00:00Z`,
    is_predicted: false,
    applied_offset_days: 0,
  } as Scenario
}

/**
 * A dated campaign. `event_type` matters: buildTimelineMarkers drops
 * `"campaign"` rows outright, so the default here is `"anniversary"` and the
 * catch-all kind is passed explicitly by the test that checks it stays out.
 */
function campaign(
  id: number,
  name: string,
  eventType: AnniversaryEvent['event_type'] = 'anniversary',
): AnniversaryEvent {
  const day = String(id).padStart(2, '0')
  const start = `2099-06-${day}T22:00:00Z`
  return {
    id,
    name,
    event_type: eventType,
    jp_cutoff_date: null,
    image: null,
    accent_label: '',
    start_date: start,
    // No separate run-up part here, which is what the backend resolves for a
    // campaign whose Part 1 IS the event.
    main_start_date: start,
    end_date: `2099-07-${day}T21:59:59Z`,
    is_predicted: false,
    applied_offset_days: 0,
    products: [],
    banner_parts: [],
  }
}

vi.mock('../services/CalculatorContext', () => ({
  useCalculatorData: () => ({
    organizedTimelineData: events,
    userPlannedBannerData: [],
    umaBannerData: [],
    supportBannerData: [],
    stagedBanners: [],
    setStagedBanners: vi.fn(),
    scenarioData: scenarios,
    anniversaryEventData: campaigns,
  }),
}))

// Imported after the mocks above are registered.
const { Timeline } = await import('../components/timeline/Timeline')

/**
 * Timeline reads its deep-link target from the query string (see
 * utils/timelineFocus), so every render needs a router context. `initialEntries`
 * defaults to "/" — no focus — which is what all the pre-existing tests assume.
 */
function renderTimeline(initialUrl = '/app/timeline') {
  return render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <Timeline />
    </MemoryRouter>
  )
}

/** One per rendered event card. */
function cardCount(): number {
  return screen.getAllByText('No Umamusume banner').length
}

/**
 * Drive the newest live observer as though the sentinel scrolled into view.
 * Fails if there isn't one — a stalled list is a failure, not a no-op.
 */
function scrollToSentinel(): void {
  const observer = getActiveObserver()
  expect(observer, 'no live observer — the list stalled').not.toBeNull()
  observer!.fired = true
  act(() => {
    observer!.callback([{ isIntersecting: true }])
  })
}

beforeEach(() => {
  localStorage.clear()
  // The paged view persists its page here; without this a test that pages
  // forward leaks its position into every test that renders afterwards.
  sessionStorage.clear()
  resetObservers()
})

afterEach(() => {
  events = BASE_EVENTS
  scenarios = []
  campaigns = []
})

describe('Timeline infinite scroll', () => {
  it('starts with one chunk and appends another each time the sentinel appears', () => {
    renderTimeline()

    expect(cardCount()).toBe(10)
    expect(screen.getByText('Loading more events...')).toBeInTheDocument()

    scrollToSentinel()
    expect(cardCount()).toBe(20)

    scrollToSentinel()
    expect(cardCount()).toBe(TOTAL_EVENTS)
  })

  it('stops at the full list and says so instead of spinning forever', () => {
    renderTimeline()

    scrollToSentinel()
    scrollToSentinel()

    expect(cardCount()).toBe(TOTAL_EVENTS)
    expect(screen.queryByText('Loading more events...')).not.toBeInTheDocument()
    expect(screen.getByText(`That's all ${TOTAL_EVENTS} events.`)).toBeInTheDocument()
    // Nothing left to watch for, so no observer should still be attached.
    expect(getActiveObserver()).toBeNull()
  })

  it('reaches every event, which paging alone could not do in one view', () => {
    renderTimeline()
    for (let i = 0; i < TOTAL_EVENTS; i++) {
      if (cardCount() >= TOTAL_EVENTS) break
      scrollToSentinel()
    }
    // Both ends of the list on screen at once.
    expect(screen.getByText(/2099\/1\/1 through/)).toBeInTheDocument()
    expect(screen.getByText(/2099\/1\/25 through/)).toBeInTheDocument()
  })

  it('restarts the reveal window when the search filter changes', () => {
    renderTimeline()
    scrollToSentinel()
    expect(cardCount()).toBe(20)

    fireEvent.change(screen.getByPlaceholderText('Search characters or events...'), {
      target: { value: 'Window 07' },
    })

    // Narrowed to a single match — the stale count must not survive.
    expect(cardCount()).toBe(1)
    expect(screen.getByText(/2099\/1\/7 through/)).toBeInTheDocument()
  })
})

describe('Timeline view mode', () => {
  it('defaults to infinite scroll and offers a switch to pages', () => {
    renderTimeline()

    // The count interleaves an element, so assert on full text content rather
    // than a text-node match.
    expect(screen.getByText(/Showing/)).toHaveTextContent(`Showing 10 of ${TOTAL_EVENTS}`)
    expect(screen.getByRole('button', { name: /use pages/i })).toBeInTheDocument()
    // Paged controls are absent in this mode.
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument()
  })

  it('switches to the original paged view and persists the choice', () => {
    renderTimeline()

    fireEvent.click(screen.getByRole('button', { name: /use pages/i }))

    expect(cardCount()).toBe(10)
    // Paged mode shows the Previous/Next controls, top and bottom.
    expect(screen.getAllByRole('button', { name: /next/i }).length).toBeGreaterThan(0)
    expect(screen.queryByText('Loading more events...')).not.toBeInTheDocument()
    expect(localStorage.getItem('uma-planner-timeline-view')).toBe('paged')
  })

  it('honours a stored paged preference on mount', () => {
    localStorage.setItem('uma-planner-timeline-view', 'paged')
    renderTimeline()

    expect(screen.getByRole('button', { name: /use infinite scroll/i })).toBeInTheDocument()
    expect(cardCount()).toBe(10)
  })

  it('pages through the list, reaching the last event on the final page', () => {
    localStorage.setItem('uma-planner-timeline-view', 'paged')
    renderTimeline()

    // 25 events / 10 per page = 3 pages.
    const next = screen.getAllByRole('button', { name: /next/i })[0]
    fireEvent.click(next)
    fireEvent.click(next)

    expect(cardCount()).toBe(5)
    expect(screen.getByText(/2099\/1\/25 through/)).toBeInTheDocument()
  })
})

// Navigating to the calculator unmounts this route entirely, so "keeping your
// place" is really "surviving an unmount" — which is what unmount/re-render
// stands in for here.
describe('Timeline paged position', () => {
  beforeEach(() => {
    localStorage.setItem('uma-planner-timeline-view', 'paged')
  })

  /** The indicator renders twice (above and below the list); both read the same. */
  function pageIndicator(): HTMLElement {
    return screen.getAllByText(/Page/)[0]
  }

  it('returns to the page the user left, not page 1', () => {
    const view = renderTimeline()

    fireEvent.click(screen.getAllByRole('button', { name: /next/i })[0])
    expect(pageIndicator()).toHaveTextContent('Page 2 of 3')

    view.unmount()
    renderTimeline()

    expect(pageIndicator()).toHaveTextContent('Page 2 of 3')
    // Page 2 of 25 events is windows 11-20.
    expect(screen.getByText(/2099\/1\/11 through/)).toBeInTheDocument()
    expect(screen.queryByText(/2099\/1\/1 through/)).not.toBeInTheDocument()
  })

  it('clamps a stored page that now exceeds the list instead of rendering empty', () => {
    // As if the user left from a longer list — 25 events only reach page 3.
    sessionStorage.setItem('uma-planner-timeline-page', '9')
    renderTimeline()

    expect(pageIndicator()).toHaveTextContent('Page 3 of 3')
    expect(cardCount()).toBe(5)
  })

  it('ignores a corrupt stored page', () => {
    sessionStorage.setItem('uma-planner-timeline-page', 'not-a-page')
    renderTimeline()

    expect(pageIndicator()).toHaveTextContent('Page 1 of 3')
  })

  it('drops the stored position when the filter changes, so it cannot be restored stale', () => {
    renderTimeline()
    fireEvent.click(screen.getAllByRole('button', { name: /next/i })[0])

    fireEvent.change(screen.getByPlaceholderText('Search characters or events...'), {
      target: { value: 'Window 0' },
    })

    expect(sessionStorage.getItem('uma-planner-timeline-page')).toBe('1')
  })
})

/**
 * Narrowing the list restarts it; widening it holds the reader's place.
 *
 * The search box and the category filter share one rule — see
 * `handleSearchChange` / `handleFilterChange` in Timeline.tsx. These assert the
 * widening half, which is the new behaviour; the narrowing half is covered by
 * 'restarts the reveal window when the search filter changes' above.
 */
describe('Timeline keeps its place when a filter is lifted', () => {
  /**
   * Fake a scroll position, because jsdom lays nothing out and reports every
   * rect as zero — which is why the measurement is inert under test by default
   * and none of the pre-existing cases changed behaviour.
   *
   * Cards before `index` are pushed above the fold with a negative `bottom`, so
   * the measurement skips them; `index` itself is put `offsetPx` down the
   * screen. The controls band keeps jsdom's all-zero rect, and that is the
   * floor the measurement compares against, so any positive `bottom` counts as
   * visible.
   */
  function scrollListTo(index: number, offsetPx = 120): void {
    const list = document.querySelector('.page-container')
    expect(list, 'no list container to measure').not.toBeNull()
    const cards = Array.from(list!.children).slice(0, cardCount())
    expect(cards.length, 'fewer cards rendered than the scroll target').toBeGreaterThan(index)

    cards.forEach((card, i) => {
      const top = i < index ? -600 : offsetPx + (i - index) * 700
      vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({
        top,
        bottom: top + 600,
      } as DOMRect)
    })
  }

  function search(): HTMLElement {
    return screen.getByPlaceholderText('Search characters or events...')
  }

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // 'Window 1' matches Windows 10-19 — rows 9 to 18 of the full list — so the
  // third result is row 12, comfortably past the ten-row chunk a plain reset
  // would leave on screen. That is what makes the assertion below decisive
  // rather than a coincidence of the fixture's length.
  it('reveals past the row you were on when the search is cleared', () => {
    renderTimeline()
    fireEvent.change(search(), { target: { value: 'Window 1' } })
    expect(cardCount()).toBe(10)

    scrollListTo(3) // Window 13, row 12 of the unfiltered list
    fireEvent.change(search(), { target: { value: '' } })

    // A reset to the first chunk could not show row 12 at all.
    expect(screen.getByText(/2099\/1\/13 through/)).toBeInTheDocument()
    expect(cardCount()).toBe(TOTAL_EVENTS)
  })

  it('does not draw the arrival ring on a row the reader never clicked', () => {
    renderTimeline()
    fireEvent.change(search(), { target: { value: 'Window 1' } })
    scrollListTo(3)
    fireEvent.change(search(), { target: { value: '' } })

    // The ring means "this is the card you followed a link to". Clearing a
    // search is not an arrival, and the row is being held exactly where it
    // already was — a ring would be the only thing that visibly happened.
    expect(
      document.querySelectorAll(`.${TIMELINE_FOCUS_HIGHLIGHT.split(' ').join('.')}`)
    ).toHaveLength(0)
  })

  it('lands on the page holding that row, not page 1', () => {
    renderTimeline()
    fireEvent.click(screen.getByRole('button', { name: /use pages/i }))
    fireEvent.change(search(), { target: { value: 'Window 1' } })

    scrollListTo(3) // row 12 -> page 2
    fireEvent.change(search(), { target: { value: '' } })

    expect(screen.getAllByText(/Page/)[0]).toHaveTextContent('Page 2 of 3')
    expect(screen.getByText(/2099\/1\/13 through/)).toBeInTheDocument()
  })

  it('holds the row when a category filter is lifted back to all events', () => {
    // Every fifth window a rerun, so the filter is offered at all and the
    // matches are scattered through the full list rather than bunched at one
    // end: Windows 05, 10, 15, 20 and 25, at rows 4, 9, 14, 19 and 24.
    events = BASE_EVENTS.map((event, i) =>
      i % 5 === 4 ? { ...event, banner_category: 'rerun' as BannerCategory } : event
    )
    renderTimeline()

    const filter = screen.getByLabelText('Filter events')
    fireEvent.change(filter, { target: { value: 'rerun' } })
    expect(cardCount()).toBe(5)

    scrollListTo(3) // Window 20, row 19 of the unfiltered list
    fireEvent.change(filter, { target: { value: 'all' } })

    expect(screen.getByText(/2099\/1\/20 through/)).toBeInTheDocument()
    expect(cardCount()).toBe(TOTAL_EVENTS)
  })

  it('still restarts the list when a filter is tightened rather than lifted', () => {
    renderTimeline()
    fireEvent.change(search(), { target: { value: 'Window 1' } })
    scrollListTo(3)

    // Narrowing from one query to a stricter one. The reader is asking a new
    // question, so their old place is not worth keeping — and the measurement
    // must not run just because the DOM would answer it.
    fireEvent.change(search(), { target: { value: 'Window 13' } })

    expect(cardCount()).toBe(1)
    expect(screen.getByText(/2099\/1\/13 through/)).toBeInTheDocument()
  })
})

describe('Timeline date formatting', () => {
  it('renders banner windows as YYYY/M/D', () => {
    renderTimeline()
    // 2099-01-01T22:00:00Z through 2099-02-01T21:59:59Z, as local calendar days.
    const start = new Date('2099-01-01T22:00:00Z')
    const end = new Date('2099-02-01T21:59:59Z')
    const expected = `${start.getFullYear()}/${start.getMonth() + 1}/${start.getDate()} through ${end.getFullYear()}/${end.getMonth() + 1}/${end.getDate()}`

    expect(screen.getByText(expected)).toBeInTheDocument()
  })
})

/**
 * The grouping rule itself is covered in timelineShared.test.ts. What matters
 * here is that the list actually renders a group as ONE card — the counts, the
 * paging and the "showing X of Y" indicator all measure rows, not raw events.
 */
describe('Timeline concurrent banners', () => {
  /** One per rendered card — the date header appears exactly once per card. */
  function headerCount(): number {
    return screen.getAllByText(/ through /).length
  }

  it('renders two banners opening at the same moment as a single card', () => {
    events = [
      windowAt(1, '2099-03-01T22:00:00Z', '2099-03-08T21:59:59Z'),
      windowAt(2, '2099-03-01T22:00:00Z', '2099-03-08T21:59:59Z'),
    ]
    renderTimeline()

    expect(headerCount()).toBe(1)
    // Both banners still render their own panels and their own add buttons
    // inside that one card — they are separate gacha pools.
    expect(cardCount()).toBe(2)
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 1 of 1')
  })

  it('shows the union window, and flags the banner that runs longer', () => {
    // The real 2025 Golden Week shape: the revival outlasts the standard banner
    // it opened alongside.
    events = [
      windowAt(1, '2099-03-01T22:00:00Z', '2099-03-08T21:59:59Z'),
      windowAt(2, '2099-03-01T22:00:00Z', '2099-03-17T21:59:59Z'),
    ]
    renderTimeline()

    const start = new Date('2099-03-01T22:00:00Z')
    const unionEnd = new Date('2099-03-17T21:59:59Z')
    const shortEnd = new Date('2099-03-08T21:59:59Z')
    const fmt = (d: Date) => `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`

    // Header covers the whole window...
    expect(
      screen.getByText(`${fmt(start)} through ${fmt(unionEnd)}`),
    ).toBeInTheDocument()
    // ...and the shorter banner says when it actually stops, so the header
    // can't imply you have until the 17th to pull on it.
    expect(
      screen.getByText(`This banner ends ${fmt(shortEnd)}`),
    ).toBeInTheDocument()
  })

  it('says nothing extra when both banners share an end date', () => {
    events = [
      windowAt(1, '2099-03-01T22:00:00Z', '2099-03-08T21:59:59Z'),
      windowAt(2, '2099-03-01T22:00:00Z', '2099-03-08T21:59:59Z'),
    ]
    renderTimeline()

    expect(screen.queryByText(/This banner ends/)).not.toBeInTheDocument()
  })

  it('never groups across the past/future boundary', () => {
    // Same start date, but one has already ended. Grouping runs after the
    // filter, so the ended banner must not be dragged into the current view.
    const past = windowAt(1, '2099-03-01T22:00:00Z', '2000-01-01T00:00:00Z')
    const future = windowAt(2, '2099-03-01T22:00:00Z', '2099-03-08T21:59:59Z')
    events = [past, future]
    renderTimeline()

    expect(headerCount()).toBe(1)
    expect(cardCount()).toBe(1)
  })
})

/**
 * Category drives the chrome, count drives the layout.
 *
 * One caveat these tests can't get around: the defects here are CSS effects, and
 * jsdom applies no stylesheets. Every tile is in the DOM either way, so
 * asserting on rendered names would have passed before each fix too. What the
 * band assertions below can check structurally is the ONE-LINE guarantee — a
 * band's tiles are all direct children of a single flex row, so counting them
 * proves there is no second row to wrap onto. That is a stronger guard than the
 * class-name sniffing it replaces, which asserted `xl:grid-cols-N` and so was
 * blind to the band collapsing to two columns below 1280px. The widths
 * themselves were checked visually at 420 / 1150 / 1280 / 1600.
 */
describe('Timeline banner categories', () => {
  /** The grid a named card's tile sits in — compact column layout only. */
  function gridFor(name: string): HTMLElement {
    const grid = screen.getByAltText(name).closest('div.grid')
    expect(grid, `no grid around ${name}`).not.toBeNull()
    return grid as HTMLElement
  }

  /**
   * The one-line band a named card sits in, as its scroller and its row.
   *
   * `row.children` is the assertion that matters: a band puts every tile on one
   * flex row, so the child count IS the line length. If the layout ever wraps
   * again, tiles land on a second row and the count stops matching.
   */
  function bandFor(name: string): { scroller: HTMLElement; row: HTMLElement } {
    const scroller = screen.getByAltText(name).closest('div.overflow-x-auto')
    expect(scroller, `no band scroller around ${name}`).not.toBeNull()
    const row = (scroller as HTMLElement).firstElementChild as HTMLElement
    expect(row.className).toContain('flex')
    // A band must never be a grid again — that is what let it wrap at two.
    expect(row.className).not.toContain('grid')
    return { scroller: scroller as HTMLElement, row }
  }

  const REVIVAL_UMAS = [
    'Oguri Cap (Christmas)',
    'Gold Ship (Summer)',
    "Gold Ship (Project L'Arc)",
    'Mejiro McQueen (Summer)',
    'Tamamo Cross (Festival)',
    'Curren Chan (Wedding)',
    'Seiun Sky (Ballroom)',
    'Hishi Miracle',
    'Biwa Hayahide (Christmas)',
    'Biwa Hayahide (Mecha)',
    'Nakayama Festa',
  ]

  it('marks a Golden Week revival and leaves a standard banner unmarked', () => {
    events = [
      categorised(1, 'golden_week_revival', ['Oguri Cap (Christmas)']),
      categorised(2, 'standard', ['Yukino Bijin'], ['Smart Falcon']),
    ]
    renderTimeline()

    // Queried by class rather than text: the category filter's dropdown carries
    // the same words in an <option>, and this assertion is about the chip.
    // Exactly one — a badge on every card would be noise, not signal.
    const chips = document.querySelectorAll('.category-chip')
    expect(chips).toHaveLength(1)
    expect(chips[0]).toHaveTextContent('Golden Week')
  })

  it('opens a revival into one row of tiles, with no cap and no clip', () => {
    events = [categorised(1, 'golden_week_revival', REVIVAL_UMAS)]
    renderTimeline()

    const { scroller, row } = bandFor('Hishi Miracle')
    // Eleven umas, eleven tiles, one row — at every width, not just xl.
    expect(row.children).toHaveLength(REVIVAL_UMAS.length)
    // A line too long to fit scrolls inside its own container, which is what
    // keeps it off the page's horizontal scrollbar.
    expect(scroller.className).toContain('overflow-x-auto')
    // The three classes that used to hide nine of them.
    expect(row.className).not.toContain('grid-rows-1')
    expect(scroller.className).not.toContain('overflow-hidden')
    expect(scroller.className).not.toContain('contain:size')
  })

  it('drops the empty art and support columns a revival would leave behind', () => {
    // Every revival we hold has no art and no support cards, so the ordinary
    // three-column section would spend two thirds of a full-width row on
    // placeholders.
    events = [categorised(1, 'golden_week_revival', REVIVAL_UMAS)]
    renderTimeline()

    expect(screen.queryByText('Banner art coming soon')).not.toBeInTheDocument()
    expect(
      screen.queryByText('No Support Banner'),
    ).not.toBeInTheDocument()
  })

  it('still shows a revival its support cards if the data ever grows them', () => {
    // Category picks the shape; the data decides what goes in it.
    events = [
      categorised(1, 'golden_week_revival', ['Oguri Cap (Christmas)'], ['Kitasan Black']),
    ]
    renderTimeline()

    expect(screen.getByAltText('Kitasan Black')).toBeInTheDocument()
  })

  it('labels a rerun without changing its layout', () => {
    events = [categorised(1, 'rerun', ['Gentildonna'], ['Kitasan Black'])]
    renderTimeline()

    expect(screen.getByText('Rerun')).toBeInTheDocument()
    // Still the ordinary three-column section, art placeholder included.
    expect(screen.getByText('Banner art coming soon')).toBeInTheDocument()
    expect(gridFor('Gentildonna').className).not.toContain('xl:grid-cols-')
  })

  it('degrades a race-prep batch that has no uma at all', () => {
    // Two of the sheet's 32 race-prep rows carry no uma — the first ever, and
    // an unfilled placeholder. The uma panel must stay and say so.
    events = [
      categorised(1, 'race_prep_support', [], ['Kitasan Black', 'Super Creek']),
    ]
    renderTimeline()

    expect(screen.getByText('10 Select 2 Scout')).toBeInTheDocument()
    expect(screen.getByText('No Umamusume banner')).toBeInTheDocument()
    expect(screen.getByAltText('Super Creek')).toBeInTheDocument()
  })

  it('opens into bands on card count alone, with no category to go on', () => {
    // The JP launch banner: nine umas and twenty support cards on a `standard`
    // row with no art. No category could have flagged it, so the layout has to
    // key off the counts.
    const umas = Array.from({ length: 9 }, (_, i) => `Launch Uma ${i + 1}`)
    const supports = Array.from({ length: 20 }, (_, i) => `Launch Card ${i + 1}`)
    events = [categorised(1, 'standard', umas, supports)]
    renderTimeline()

    // Both sides get their own horizontal line, each holding all of its cards.
    expect(bandFor('Launch Uma 9').row.children).toHaveLength(9)
    expect(bandFor('Launch Card 20').row.children).toHaveLength(20)
    // ...and every card is present, none capped away.
    expect(screen.getByAltText('Launch Uma 1')).toBeInTheDocument()
    expect(screen.getByAltText('Launch Card 1')).toBeInTheDocument()
    // No art, so no full-width placeholder above the bands.
    expect(screen.queryByText('Banner art coming soon')).not.toBeInTheDocument()
  })

  it('bands only the oversized panel, leaving the other beside the art', () => {
    // A race-prep batch: one uma, ten support cards, banner art. 22 of the 29
    // race-prep rows are exactly this, so it is the shape that matters most.
    const supports = Array.from({ length: 10 }, (_, i) => `Card ${i + 1}`)
    events = [categorised(1, 'race_prep_support', ['Satono Crown'], supports)]
    renderTimeline()

    // The ten that don't fit get the full-width line...
    expect(bandFor('Card 10').row.children).toHaveLength(10)
    // ...and the lone uma keeps its column beside the art, which is where it sat
    // before these support cards were backfilled. Banding the whole section
    // instead threw the art onto its own row and left one tile adrift in a
    // full-width panel.
    expect(screen.getByAltText('Satono Crown').closest('div.overflow-x-auto')).toBeNull()
    expect(gridFor('Satono Crown')).toBeInTheDocument()
    expect(screen.getByText('10 Select 2 Scout')).toBeInTheDocument()
  })

  it('drops the support column that banded away, rather than emptying it', () => {
    // The art row must not keep a placeholder slot for the panel that left, or
    // the row renders art | uma | nothing with the band repeating below.
    const supports = Array.from({ length: 10 }, (_, i) => `Card ${i + 1}`)
    events = [categorised(1, 'race_prep_support', ['Satono Crown'], supports)]
    renderTimeline()

    expect(
      screen.queryByText('No Support Banner'),
    ).not.toBeInTheDocument()
    // Exactly one support panel on the card — the band.
    expect(screen.getAllByText('Featured Support Cards')).toHaveLength(1)
  })

  it('keeps an ordinary two-card banner in the compact columns', () => {
    // The overwhelmingly common row must be untouched by all of the above.
    events = [categorised(1, 'standard', ['A', 'B'], ['C', 'D'])]
    renderTimeline()

    expect(gridFor('A').className).not.toContain('xl:grid-cols-')
    expect(gridFor('C').className).not.toContain('xl:grid-cols-')
    // Compact sections still show the art placeholder.
    expect(screen.getByText('Banner art coming soon')).toBeInTheDocument()
  })

  it('puts a miscategorised four-uma row on one line rather than a tower', () => {
    // An uncategorised banner with four umas — the miscategorised-row case. It
    // renders plainly, but completely, and on one line: the count alone is
    // enough to open the band, with no category to go on.
    //
    // This used to assert `grid-cols-2` and pass, because a band WAS a
    // two-column grid until xl. That is the bug, not the contract — four umas
    // in a 2×2 block with a gutter of dead space beside them is what the
    // one-line rule replaces.
    events = [categorised(1, 'standard', ['A Uma', 'B Uma', 'C Uma', 'D Uma'])]
    renderTimeline()

    const { row } = bandFor('D Uma')
    expect(row.children).toHaveLength(4)
    expect(row.className).not.toContain('grid-cols-2')
    expect(row.className).not.toContain('grid-rows-1')
  })
})

/**
 * The category filter. The load-bearing rule is that it runs on GROUPS, not on
 * events: a window survives if any of its banners matches, so filtering for
 * revivals keeps the ordinary banner sharing that card rather than presenting a
 * week that looks emptier than it was.
 */
describe('Timeline recommended banners and card purposes', () => {
  /** The feature panel — the <section> — a named card's tile sits in. */
  function panelFor(name: string): HTMLElement {
    const panel = screen.getByAltText(name).closest('section')
    expect(panel, `no panel around ${name}`).not.toBeNull()
    return panel as HTMLElement
  }

  /** A one-uma window whose uma carries a purpose note. */
  function withPurpose(name: string, purpose: string): BannerTimelineForViewing {
    const banner = categorised(1, 'standard', [name])
    banner.banner_umas[0].umas[0].purpose = purpose
    return banner
  }

  it('dresses only the recommended side of a window as an SSR panel', () => {
    const banner = categorised(1, 'standard', ['Rice Shower'], ['Kitasan Black'])
    banner.banner_umas[0].is_recommended = true
    events = [banner]
    renderTimeline()

    const umaPanel = panelFor('Rice Shower')
    expect(umaPanel).toHaveClass('ssr-panel')
    expect(umaPanel.querySelector('.recommended-chip')).toHaveTextContent('Recommended')

    // Per banner: the support side of the same window keeps its ordinary surface.
    const supportPanel = panelFor('Kitasan Black')
    expect(supportPanel).not.toHaveClass('ssr-panel')
    expect(supportPanel).toHaveClass('bg-gray-800')
    expect(document.querySelectorAll('.recommended-chip')).toHaveLength(1)
  })

  it('leaves an unrecommended window exactly as it was', () => {
    events = [categorised(1, 'standard', ['Yukino Bijin'], ['Smart Falcon'])]
    renderTimeline()

    expect(document.querySelector('.ssr-panel')).toBeNull()
    expect(document.querySelector('.recommended-chip')).toBeNull()
  })

  it('reads a banner from before the field existed as not recommended', () => {
    const banner = categorised(1, 'standard', ['Rice Shower'])
    // A frontend deployed ahead of the API receives banners without the field.
    Reflect.deleteProperty(banner.banner_umas[0], 'is_recommended')
    events = [banner]
    renderTimeline()

    expect(document.querySelector('.ssr-panel')).toBeNull()
  })

  it("puts a card's purpose on its art, reachable by keyboard and screen reader", () => {
    events = [withPurpose('Gold Ship', 'Great pace parent.')]
    renderTimeline()

    const tile = screen.getByRole('group', { name: 'Gold Ship' })
    expect(tile).toHaveAttribute('tabindex', '0')
    // Faded, never unmounted, so aria-describedby always has something to read.
    expect(tile).toHaveAccessibleDescription('Great pace parent.')
  })

  it('renders a card with no purpose exactly as before', () => {
    events = [categorised(1, 'standard', ['Yukino Bijin'])]
    renderTimeline()

    const artBox = screen.getByAltText('Yukino Bijin').parentElement as HTMLElement
    expect(artBox).not.toHaveAttribute('tabindex')
    expect(artBox).not.toHaveAttribute('aria-describedby')
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('toggles the note on a touch tap, and ignores a mouse click', () => {
    events = [withPurpose('Gold Ship', 'Great pace parent.')]
    renderTimeline()

    const tile = screen.getByRole('group', { name: 'Gold Ship' })
    const note = screen.getByRole('tooltip')
    expect(note).toHaveClass('opacity-0')

    // A mouse is served by :hover in CSS; the tap state is for touch alone.
    fireEvent.pointerUp(tile, { pointerType: 'mouse' })
    expect(note).toHaveClass('opacity-0')

    fireEvent.pointerUp(tile, { pointerType: 'touch' })
    expect(note).toHaveClass('opacity-100')

    fireEvent.pointerUp(tile, { pointerType: 'touch' })
    expect(note).toHaveClass('opacity-0')
  })
})

describe('Timeline free pulls', () => {
  /** The feature panel — the <section> — a named card's tile sits in. */
  function panelFor(name: string): HTMLElement {
    const panel = screen.getByAltText(name).closest('section')
    expect(panel, `no panel around ${name}`).not.toBeNull()
    return panel as HTMLElement
  }

  it('captions a side of the window with its free pulls, and only that side', () => {
    const banner = categorised(1, 'standard', ['Rice Shower'], ['Kitasan Black'])
    banner.banner_umas[0].free_pulls = 30
    events = [banner]
    renderTimeline()

    const chip = panelFor('Rice Shower').querySelector('.free-pulls-chip')
    expect(chip).toHaveTextContent('30 free pulls')
    expect(chip).toHaveAttribute('title', '30 free pulls on this banner')
    // Per banner: the support side of the same window has none.
    expect(panelFor('Kitasan Black').querySelector('.free-pulls-chip')).toBeNull()
  })

  it('renders nothing at all for a banner with no free pulls', () => {
    events = [categorised(1, 'standard', ['Yukino Bijin'], ['Smart Falcon'])]
    renderTimeline()

    expect(document.querySelector('.free-pulls-chip')).toBeNull()
  })

  it('sits beside the Recommended chip rather than displacing it', () => {
    const banner = categorised(1, 'standard', ['Rice Shower'])
    banner.banner_umas[0].is_recommended = true
    banner.banner_umas[0].free_pulls = 10
    events = [banner]
    renderTimeline()

    const panel = panelFor('Rice Shower')
    expect(panel.querySelector('.recommended-chip')).toHaveTextContent('Recommended')
    expect(panel.querySelector('.free-pulls-chip')).toHaveTextContent('10 free pulls')
  })
})

describe('Timeline category filter', () => {
  // Renamed from "filter by banner type" when the marker kinds joined it — the
  // control spans two axes now and naming it after one of them was misleading.
  const FILTER = /filter events/i

  function selectCategory(value: string): void {
    fireEvent.change(screen.getByLabelText(FILTER), { target: { value } })
  }

  it('offers only the categories the data actually contains', () => {
    // race_prep_support is absent until the support backfill lands, so it must
    // not appear as an option that can only return "No events found."
    events = [
      categorised(1, 'standard', ['Yukino Bijin']),
      categorised(2, 'golden_week_revival', ['Oguri Cap (Christmas)']),
    ]
    renderTimeline()

    const options = Array.from(
      screen.getByLabelText(FILTER).querySelectorAll('option'),
    ).map((o) => o.textContent)

    expect(options).toEqual(['All events', 'Standard', 'Golden Week'])
  })

  it('hides itself when there is nothing to choose between', () => {
    events = [categorised(1, 'standard', ['Yukino Bijin'])]
    renderTimeline()

    expect(screen.queryByLabelText(FILTER)).not.toBeInTheDocument()
  })

  it('sits with the search box, ahead of it', () => {
    // Both controls narrow the list, so they share the trailing end of the
    // control bar — the filter first. It used to sit among the view-mode
    // toggles at the other end, which put two unrelated jobs in one group.
    events = [
      categorised(1, 'standard', ['Yukino Bijin']),
      categorised(2, 'golden_week_revival', ['Oguri Cap (Christmas)']),
    ]
    renderTimeline()

    const filter = screen.getByLabelText(FILTER)
    const search = screen.getByPlaceholderText(/search characters or events/i)

    expect(filter.parentElement).toBe(search.parentElement?.parentElement)
    // DOCUMENT_POSITION_FOLLOWING: the search box comes after the filter.
    expect(filter.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy()
  })

  it('narrows the list to the chosen category', () => {
    events = [
      categorised(1, 'standard', ['Yukino Bijin']),
      categorised(2, 'golden_week_revival', ['Oguri Cap (Christmas)']),
      categorised(3, 'rerun', ['Gentildonna']),
    ]
    renderTimeline()
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 3 of 3')

    selectCategory('golden_week_revival')

    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 1 of 1')
    expect(screen.getByAltText('Oguri Cap (Christmas)')).toBeInTheDocument()
    expect(screen.queryByAltText('Gentildonna')).not.toBeInTheDocument()
  })

  it('keeps a whole window when only one of its banners matches', () => {
    // The Golden Week shape: a revival and an ordinary banner opening together.
    // Filtering for revivals must not strip the neighbour off the shared card.
    const revival = categorised(1, 'golden_week_revival', ['Oguri Cap (Christmas)'])
    const alongside = {
      ...categorised(2, 'standard', ['Copano Rickey (Parade)']),
      start_date: revival.start_date,
      end_date: revival.end_date,
    }
    events = [revival, alongside]
    renderTimeline()

    selectCategory('golden_week_revival')

    expect(screen.getByAltText('Oguri Cap (Christmas)')).toBeInTheDocument()
    expect(screen.getByAltText('Copano Rickey (Parade)')).toBeInTheDocument()
  })

  it('drops race events once a banner category is chosen', () => {
    events = [
      categorised(1, 'standard', ['Yukino Bijin']),
      categorised(2, 'rerun', ['Gentildonna']),
      raceEvent(9, '05'),
    ]
    renderTimeline()
    expect(screen.getByText('Champions Meeting 9')).toBeInTheDocument()

    // A Champions Meeting has no banner category, so it cannot match one.
    selectCategory('rerun')

    expect(screen.queryByText('Champions Meeting 9')).not.toBeInTheDocument()
    expect(screen.getByAltText('Gentildonna')).toBeInTheDocument()
  })

  it('restores everything, race events included, on "All events"', () => {
    events = [
      categorised(1, 'standard', ['Yukino Bijin']),
      categorised(2, 'rerun', ['Gentildonna']),
      raceEvent(9, '05'),
    ]
    renderTimeline()

    selectCategory('rerun')
    selectCategory('all')

    expect(screen.getByText('Champions Meeting 9')).toBeInTheDocument()
    expect(screen.getByAltText('Yukino Bijin')).toBeInTheDocument()
  })

  it('offers the marker kinds the data contains, grouped apart from the categories', () => {
    // The two axes are separate lists under separate headings — a scenario has
    // no banner_category, so a flat run would read as one list with two odd
    // entries on the end.
    events = [categorised(1, 'standard', ['Yukino Bijin'])]
    scenarios = [scenario(1, 'Grand Masters')]
    campaigns = [campaign(1, '4th Anniversary')]
    renderTimeline()

    const select = screen.getByLabelText(FILTER)
    expect(
      Array.from(select.querySelectorAll('optgroup')).map((g) => g.label),
    ).toEqual(['Banner type', 'Other events'])
    expect(
      Array.from(select.querySelectorAll('option')).map((o) => o.textContent),
    ).toEqual(['All events', 'Standard', 'Scenarios', 'Campaigns'])
  })

  it('offers a marker kind only when the data can produce a card for it', () => {
    // A campaign with no start date has nothing to sort by and never renders,
    // and `event_type: "campaign"` is excluded outright — the Trainer Support
    // Pack is permanently purchasable and marks no moment on the calendar.
    // Neither may put an option in the list that returns "No events found."
    events = [
      categorised(1, 'standard', ['Yukino Bijin']),
      categorised(2, 'rerun', ['Gentildonna']),
    ]
    scenarios = [scenario(1, 'Grand Masters')]
    campaigns = [
      campaign(1, 'Trainer Support Pack', 'campaign'),
      // BOTH dates null, which is how the backend resolves a campaign with no
      // dated parts -- main_start_date is null exactly when start_date is.
      { ...campaign(2, 'Undated Campaign'), start_date: null, main_start_date: null },
    ]
    renderTimeline()

    const options = Array.from(
      screen.getByLabelText(FILTER).querySelectorAll('option'),
    ).map((o) => o.textContent)

    expect(options).toContain('Scenarios')
    expect(options).not.toContain('Campaigns')
  })

  it('shows itself for one banner category plus one marker kind', () => {
    // Neither axis reaches two options on its own, but there are still three
    // real choices, so the control is not clutter.
    events = [categorised(1, 'standard', ['Yukino Bijin'])]
    scenarios = [scenario(1, 'Grand Masters')]
    renderTimeline()

    expect(screen.getByLabelText(FILTER)).toBeInTheDocument()
  })

  it('narrows to markers of one kind, dropping banners and the other kind', () => {
    events = [categorised(1, 'standard', ['Yukino Bijin']), raceEvent(9, '05')]
    scenarios = [scenario(1, 'Grand Masters')]
    campaigns = [campaign(1, '4th Anniversary')]
    renderTimeline()
    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 4 of 4')

    selectCategory('marker:scenario')

    expect(screen.getByText(/Showing/)).toHaveTextContent('Showing 1 of 1')
    expect(screen.getByText('Grand Masters')).toBeInTheDocument()
    expect(screen.queryByText('4th Anniversary')).not.toBeInTheDocument()
    expect(screen.queryByAltText('Yukino Bijin')).not.toBeInTheDocument()
    expect(screen.queryByText('Champions Meeting 9')).not.toBeInTheDocument()
  })

  it('keeps the search box working inside a marker filter', () => {
    events = [categorised(1, 'standard', ['Yukino Bijin'])]
    campaigns = [campaign(1, '4th Anniversary'), campaign(2, 'Summer Festival')]
    renderTimeline()

    selectCategory('marker:anniversary')
    fireEvent.change(screen.getByPlaceholderText(/search characters or events/i), {
      target: { value: 'summer' },
    })

    expect(screen.getByText('Summer Festival')).toBeInTheDocument()
    expect(screen.queryByText('4th Anniversary')).not.toBeInTheDocument()
  })

  it('keeps markers out of a banner category filter', () => {
    // They are cross-cutting context, not banners: a scenario card stranded in
    // a list of reruns answers a question nobody asked. The marker filters are
    // how you ask for them.
    events = [
      categorised(1, 'standard', ['Yukino Bijin']),
      categorised(2, 'rerun', ['Gentildonna']),
    ]
    scenarios = [scenario(1, 'Grand Masters')]
    renderTimeline()
    expect(screen.getByText('Grand Masters')).toBeInTheDocument()

    selectCategory('rerun')

    expect(screen.queryByText('Grand Masters')).not.toBeInTheDocument()
  })

  it('splits markers past from future on their start instant', () => {
    // A scenario has no end date, so "past" can only mean "already launched".
    events = [categorised(1, 'standard', ['Yukino Bijin'])]
    scenarios = [
      { ...scenario(1, 'Grand Masters'), start_date: '2099-05-01T22:00:00Z' },
      { ...scenario(2, 'Legacy Scenario'), start_date: '2000-01-01T22:00:00Z' },
    ]
    renderTimeline()

    selectCategory('marker:scenario')
    expect(screen.getByText('Grand Masters')).toBeInTheDocument()
    expect(screen.queryByText('Legacy Scenario')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /show past events/i }))

    expect(screen.getByText('Legacy Scenario')).toBeInTheDocument()
    expect(screen.queryByText('Grand Masters')).not.toBeInTheDocument()
  })

  it('resets the paged position, which could otherwise outrun the result', () => {
    localStorage.setItem('uma-planner-timeline-view', 'paged')
    sessionStorage.setItem('uma-planner-timeline-page', '2')
    events = [
      ...Array.from({ length: 12 }, (_, i) => categorised(i + 1, 'standard', [`Uma ${i + 1}`])),
      categorised(13, 'rerun', ['Gentildonna']),
    ]
    renderTimeline()
    expect(screen.getAllByText(/Page/)[0]).toHaveTextContent('Page 2 of 2')

    selectCategory('rerun')

    expect(sessionStorage.getItem('uma-planner-timeline-page')).toBe('1')
    expect(screen.getByAltText('Gentildonna')).toBeInTheDocument()
  })
})

/**
 * Deep links from the calculator sheet.
 *
 * The link names a target and this route resolves it — see utils/timelineFocus
 * for why a `#hash` cannot: the list is windowed and hides the past by default,
 * so the element the browser would scroll to usually isn't in the DOM.
 */
describe('Timeline deep links', () => {
  /** The one card wearing the arrival ring, if any. */
  function highlighted(): NodeListOf<Element> {
    return document.querySelectorAll(`.${TIMELINE_FOCUS_HIGHLIGHT.split(' ').join('.')}`)
  }

  /**
   * The end-of-list scroll padding, if it is being rendered.
   *
   * Matched on the className rather than by a CSS selector: the class carries
   * Tailwind's arbitrary-value brackets (`h-[100dvh]`), which are not legal in
   * a selector without escaping every one of them.
   */
  function tailroom(): Element[] {
    return Array.from(document.querySelectorAll('div[aria-hidden="true"]')).filter(
      (el) => el.className === FOCUS_TAILROOM
    )
  }

  it('reveals a whole chunk BELOW a target that lands on a chunk boundary', () => {
    // Window 10 is the last row of the first chunk. Revealing only its own
    // chunk leaves nothing under it, and a scroller with nothing left to
    // scroll cannot lift the card to the top however it is asked to — which
    // is what made the landing look intermittent rather than broken.
    renderTimeline('/app/timeline?focus=banner-10')

    expect(cardCount()).toBe(20)
  })

  it('pads the end of the list so the last rows can still reach the top', () => {
    // Window 25 is the last of 25: no amount of revealing puts anything below
    // it, so the padding is the only thing that can give it room.
    renderTimeline('/app/timeline?focus=banner-25')

    expect(tailroom()).toHaveLength(1)
  })

  it('adds no padding when the list already runs on past the target', () => {
    renderTimeline('/app/timeline?focus=banner-10')

    // A screen of dead air under every deep link would be a worse bug than
    // the one the padding fixes.
    expect(tailroom()).toHaveLength(0)
  })

  it('reveals a target that sits far past the first infinite-scroll chunk', () => {
    // Window 25 is the last of 25 — two appends away under normal scrolling.
    renderTimeline('/app/timeline?focus=banner-25')

    expect(cardCount()).toBe(25)
    expect(screen.getByText(/2099\/1\/25 through/)).toBeInTheDocument()
  })

  it('shows the past half of the calendar when the target has already ended', () => {
    events = [...BASE_EVENTS, windowAt(99, '2020-01-01T22:00:00Z', '2020-02-01T21:59:59Z')]
    renderTimeline('/app/timeline?focus=banner-99')

    // The default view would have hidden the only card the link exists to reach.
    expect(cardCount()).toBe(1)
    expect(screen.getByText(/2020\/1\/1 through/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /show current\/future events/i })
    ).toBeInTheDocument()
  })

  it('rings exactly the card that was linked to', () => {
    renderTimeline('/app/timeline?focus=banner-3')

    expect(highlighted()).toHaveLength(1)
  })

  it('scrolls the target into view once it has rendered', () => {
    // jsdom implements no scrollIntoView at all, which is why the component
    // guards the call — installing one here is what lets it run.
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    renderTimeline('/app/timeline?focus=banner-3')

    expect(scrollIntoView).toHaveBeenCalled()
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
  })

  /**
   * Stand-ins for the three browser APIs the settle loop drives.
   *
   * jsdom has a real `requestAnimationFrame`, but it fires on a timer a test
   * would have to wait out; driving the queue by hand makes "one frame passed"
   * an assertion rather than a sleep. `getBoundingClientRect` is jsdom's
   * all-zero stub otherwise, i.e. a page that never shifts — precisely the one
   * condition under which this loop has nothing to do, so leaving it in place
   * would test nothing.
   *
   * Torn down from an afterEach rather than at the end of each test, so a
   * failing assertion can't leak a patched Element.prototype into the rest of
   * the file.
   */
  let harness: ReturnType<typeof installLayoutHarness> | null = null

  function installLayoutHarness() {
    const originalRect = Element.prototype.getBoundingClientRect
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView

    let top = 0
    Element.prototype.getBoundingClientRect = function (): DOMRect {
      return {
        top, y: top, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0,
        toJSON: () => ({}),
      } as DOMRect
    }

    const queue: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => queue.push(cb))
    vi.stubGlobal('cancelAnimationFrame', () => {})

    return {
      scrollIntoView,
      /** Move the focused card, as an image loading above it would. */
      shiftTo(next: number) { top = next },
      /** Run whatever the loop queued for the next frame. */
      frame() {
        const pending = queue.splice(0, queue.length)
        act(() => { pending.forEach((cb) => cb(0)) })
      },
      restore() {
        Element.prototype.getBoundingClientRect = originalRect
        delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
        vi.unstubAllGlobals()
      },
    }
  }

  afterEach(() => {
    harness?.restore()
    harness = null
  })

  it('scrolls instantly, so nothing can grow under a running animation', () => {
    harness = installLayoutHarness()
    renderTimeline('/app/timeline?focus=banner-3')

    // No `behavior: "smooth"`. A smooth scroll fixes its destination when it
    // is called, and lazy images above the target load *because* the animation
    // drags the viewport past them — so it always landed short.
    //
    // `start` rather than `center`: cards are tall enough that centring one
    // leaves its heading halfway down the screen.
    expect(harness.scrollIntoView).toHaveBeenCalledWith({ block: 'start' })
  })

  it('re-aligns the target when late content shifts it', () => {
    harness = installLayoutHarness()
    renderTimeline('/app/timeline?focus=banner-3')
    expect(harness.scrollIntoView).toHaveBeenCalledTimes(1)

    // An image above the target finishes decoding and pushes it down the page.
    harness.shiftTo(500)
    harness.frame()

    expect(harness.scrollIntoView).toHaveBeenCalledTimes(2)
  })

  it('stops correcting once the target holds still', () => {
    harness = installLayoutHarness()
    renderTimeline('/app/timeline?focus=banner-3')

    harness.frame()
    harness.frame()
    // Two stable frames is the exit condition, so by this third one the loop
    // must have queued nothing. One that never stops leaves the page twitching
    // and the reader unable to scroll away from the card.
    harness.frame()

    expect(harness.scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('gives up the moment the reader scrolls for themselves', () => {
    harness = installLayoutHarness()
    renderTimeline('/app/timeline?focus=banner-3')

    act(() => { window.dispatchEvent(new WheelEvent('wheel')) })
    harness.shiftTo(500)
    harness.frame()

    // Hauling the page back under someone who has taken over is just a
    // different way of losing their place.
    expect(harness.scrollIntoView).toHaveBeenCalledTimes(1)
  })

  it('opens on the page holding the target in paged mode', () => {
    localStorage.setItem('uma-planner-timeline-view', 'paged')
    renderTimeline('/app/timeline?focus=banner-25')

    expect(screen.getAllByText(/Page/)[0]).toHaveTextContent('Page 3 of 3')
  })

  it('hands the list back as soon as the reader uses a control', () => {
    localStorage.setItem('uma-planner-timeline-view', 'paged')
    renderTimeline('/app/timeline?focus=banner-25')

    fireEvent.click(screen.getAllByRole('button', { name: /previous/i })[0])

    // The focus target would otherwise keep forcing page 3 and make the button
    // look broken.
    expect(screen.getAllByText(/Page/)[0]).toHaveTextContent('Page 2 of 3')
    expect(highlighted()).toHaveLength(0)
  })

  it('renders the ordinary timeline for a focus it cannot resolve', () => {
    renderTimeline('/app/timeline?focus=banner-9999')

    expect(cardCount()).toBe(10)
    expect(highlighted()).toHaveLength(0)
  })

  it('ignores a malformed focus parameter rather than breaking the route', () => {
    renderTimeline('/app/timeline?focus=not-a-target')

    expect(cardCount()).toBe(10)
  })
})
