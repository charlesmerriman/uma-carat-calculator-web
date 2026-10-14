import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SiteContentContext } from '../services/SiteContentContext'
import { buildSiteContentValue } from '../services/siteContent'
import type { Account, Oshi } from '../types/account'
import type { DailyLegendRaceRelease } from '../types'
import type { SiteContent } from '../types/siteContent'

/**
 * The Legend Races tab. Pins what it shows and hides, not its styling: the
 * oshi strip, the search, the tentative batches with no date, the collapsed
 * "already out" list and the deep link from the pill on a Timeline card. The date maths has its own unit tests
 * (dailyLegendRaces.test.ts).
 *
 * Dates sit in 2020 (out) and 2099 (to come) so "now" never matters.
 */

const uma = (id: number, name: string, rarity: 1 | 2 | 3 = 3) => ({ id, name, image: null, rarity })

const OUT = {
  id: 1,
  name: '1st Anniversary',
  image: null,
  banner_timeline: 38,
  start_date: '2020-03-26T22:00:00Z',
  is_predicted: false,
  applied_offset_days: 0,
  umas: [uma(10, 'Special Week'), uma(11, 'King Halo', 1)],
} satisfies DailyLegendRaceRelease

const NEXT = {
  id: 2,
  name: '2nd Anniversary',
  image: null,
  banner_timeline: 75,
  start_date: '2099-12-22T22:00:00Z',
  is_predicted: true,
  applied_offset_days: 0,
  umas: [uma(20, 'Hishi Amazon'), uma(21, 'Mejiro Dober')],
} satisfies DailyLegendRaceRelease

const LATER = {
  id: 3,
  name: '2.5th Anniversary',
  image: null,
  banner_timeline: 90,
  start_date: '2100-04-14T22:00:00Z',
  is_predicted: true,
  applied_offset_days: 0,
  umas: [uma(30, 'Nishino Flower')],
} satisfies DailyLegendRaceRelease

// No banner, so no date: entered before the timeline reached it. Not in the
// default list, so the tests above it read as they did before it existed.
const TENTATIVE = {
  id: 13,
  name: '6th Anniversary',
  image: null,
  banner_timeline: null,
  start_date: null,
  is_predicted: false,
  applied_offset_days: 0,
  umas: [uma(60, 'Duramente'), uma(61, 'Maruzensky (Summer)')],
} satisfies DailyLegendRaceRelease

let releases: DailyLegendRaceRelease[] = []
let account: Account | null = null

vi.mock('../services/CalculatorContext', () => ({
  useCalculatorData: () => ({
    dailyLegendRaceData: releases,
  }),
}))

vi.mock('../services/AuthContext', () => ({
  useAccount: () => ({ account }),
}))

const { DailyLegendRaces } = await import('../components/legend-races/DailyLegendRaces')
const { LegendRaceNote } = await import('../components/timeline/LegendRaceNote')

const CONTENT: SiteContent = {
  pages: [
    {
      slug: 'daily-legend-races',
      title: 'Daily Legend Races',
      meta_description: 'x',
      body: 'Daily Legend Races reward 1 Star Piece.\n\nThe original event gives ~80 Star Pieces.',
      updated_at: '2026-10-05T00:00:00Z',
    },
  ],
}

function renderPage(url = '/app/legend-races') {
  return render(
    <SiteContentContext.Provider value={buildSiteContentValue(CONTENT)}>
      <MemoryRouter initialEntries={[url]}>
        <DailyLegendRaces />
      </MemoryRouter>
    </SiteContentContext.Provider>
  )
}

const oshi = (position: number, id: number, name: string): Oshi => ({ position, id, name, image: '' })

function supporterWith(oshis: Oshi[], slots: number): Account {
  return {
    username: 'user_a',
    display_name: '',
    show_supporter_badge: true,
    avatar_url: null,
    oshis,
    oshi_slots: slots,
    oshi_variants: false,
    linked_providers: [],
    supporter: { is_supporter: slots > 0 },
  }
}

type ScrollIntoViewFn = (options?: boolean | ScrollIntoViewOptions) => void
let scrollIntoView: ReturnType<typeof vi.fn<ScrollIntoViewFn>>

beforeEach(() => {
  releases = [OUT, NEXT, LATER]
  account = null
  scrollIntoView = vi.fn<ScrollIntoViewFn>()
  Element.prototype.scrollIntoView = scrollIntoView
})

afterEach(() => {
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView
})

describe('DailyLegendRaces', () => {
  it('renders the admin title and intro, and the batches to come soonest first', () => {
    renderPage()

    expect(screen.getByRole('heading', { level: 1, name: 'Daily Legend Races' })).toBeInTheDocument()
    expect(screen.getByText('Daily Legend Races reward 1 Star Piece.')).toBeInTheDocument()
    // One tilde is not strikethrough: the "~80" in the owner's text survives.
    expect(screen.getByText('The original event gives ~80 Star Pieces.')).toBeInTheDocument()
    const names = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(names).toEqual(['2nd Anniversary', '2.5th Anniversary'])
  })

  it('starts with the batches already out collapsed', () => {
    renderPage()

    const toggle = screen.getByRole('button', { name: /Already in the daily races \(1\)/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('1st Anniversary')).not.toBeInTheDocument()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('heading', { level: 3, name: '1st Anniversary' })).toBeInTheDocument()
  })

  it('shows no computed grind line on any card; the guidance is the page text', () => {
    renderPage()
    expect(screen.queryByText(/pieces by/)).not.toBeInTheDocument()
  })

  it('search hides a batch with no matching uma and opens the list already out', () => {
    renderPage()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search umas' }), {
      target: { value: 'king' },
    })

    expect(screen.queryByText('2nd Anniversary')).not.toBeInTheDocument()
    expect(screen.queryByText('2.5th Anniversary')).not.toBeInTheDocument()
    const card = screen.getByRole('region', { name: '1st Anniversary' })
    expect(within(card).getByText('King Halo')).toBeInTheDocument()
    expect(within(card).queryByText('Special Week')).not.toBeInTheDocument()
  })

  it('shows no oshi strip for a guest', () => {
    renderPage()
    expect(screen.queryByRole('region', { name: 'Your favourites' })).not.toBeInTheDocument()
  })

  it('lists only the oshis the tier covers, and only those in a dated batch', () => {
    account = supporterWith(
      [
        oshi(0, 20, 'Hishi Amazon'),
        oshi(1, 99, 'Not In Any Batch'),
        oshi(2, 10, 'Special Week'),
        // Past the slot count: kept on the account, but not covered.
        oshi(3, 30, 'Nishino Flower'),
      ],
      3
    )
    renderPage()

    const strip = screen.getByRole('region', { name: 'Your favourites' })
    const lines = within(strip).getAllByRole('listitem').map((li) => li.textContent)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatch(/^Hishi Amazon: joins .* \(2nd Anniversary\)$/)
    expect(lines[1]).toBe('Special Week: in the daily races now (1st Anniversary)')
  })

  it('opens the list and scrolls when a link names a batch already out', () => {
    renderPage('/app/legend-races?release=1')

    expect(screen.getByRole('button', { name: /Already in the daily races/ })).toHaveAttribute(
      'aria-expanded',
      'true'
    )
    expect(screen.getByRole('heading', { level: 3, name: '1st Anniversary' })).toBeInTheDocument()
    expect(scrollIntoView).toHaveBeenCalled()
  })

  it('puts an alternate outfit on its own line, with the full name as the tooltip', () => {
    releases = [{ ...NEXT, umas: [uma(22, 'Mejiro McQueen (Anime)')] }]
    renderPage()

    const card = screen.getByRole('region', { name: '2nd Anniversary' })
    // Two elements, so a clamp on the name can never cut the outfit off.
    expect(within(card).getByText('Mejiro McQueen')).toBeInTheDocument()
    expect(within(card).getByText('Anime')).toBeInTheDocument()
    expect(within(card).getByTitle('Mejiro McQueen (Anime)')).toBeInTheDocument()
  })

  it('counts only the matching batches already out while a search is running', () => {
    releases = [OUT, { ...OUT, id: 4, name: '1.5th Anniversary', umas: [uma(40, 'Curren Chan')] }, NEXT]
    renderPage()
    expect(screen.getByRole('button', { name: /Already in the daily races \(2\)/ })).toBeInTheDocument()

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search umas' }), {
      target: { value: 'curren' },
    })
    expect(screen.getByRole('button', { name: /Already in the daily races \(1\)/ })).toBeInTheDocument()
  })

  it('lists a batch with no date as tentative, after the ones to come', () => {
    releases = [OUT, NEXT, TENTATIVE]
    renderPage()

    // Shown without opening anything, below the dated batch.
    const names = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(names).toEqual(['2nd Anniversary', '6th Anniversary'])
    expect(screen.getByRole('heading', { level: 2, name: 'No date yet' })).toBeInTheDocument()
    expect(screen.getByText(/These batches are tentative/)).toBeInTheDocument()

    // The card says so itself: a search or a link can show it on its own.
    const card = screen.getByRole('region', { name: '6th Anniversary' })
    expect(within(card).getByText('Tentative')).toBeInTheDocument()
    expect(within(card).getByText('No date yet')).toBeInTheDocument()
    expect(within(card).getByText('Duramente')).toBeInTheDocument()
    // No banner card to link to, and nothing to count down to.
    expect(within(card).queryByRole('link', { name: 'On the Timeline' })).not.toBeInTheDocument()
    expect(within(card).queryByText(/^in /)).not.toBeInTheDocument()
  })

  it('shows no tentative section when there is nothing tentative, or only a draft', () => {
    renderPage()
    expect(screen.queryByRole('heading', { level: 2, name: 'No date yet' })).not.toBeInTheDocument()

    // No date and no umas: nothing to show, so it stays off the page.
    releases = [NEXT, { ...TENTATIVE, umas: [] }]
    renderPage()
    expect(screen.queryByRole('heading', { level: 2, name: 'No date yet' })).not.toBeInTheDocument()
    expect(screen.queryByText('6th Anniversary')).not.toBeInTheDocument()
  })

  it('searches the tentative batches too, and drops the section when none match', () => {
    releases = [OUT, NEXT, TENTATIVE]
    renderPage()
    const box = screen.getByRole('searchbox', { name: 'Search umas' })

    fireEvent.change(box, { target: { value: 'duramente' } })
    const card = screen.getByRole('region', { name: '6th Anniversary' })
    expect(within(card).getByText('Duramente')).toBeInTheDocument()
    expect(within(card).queryByText('Maruzensky')).not.toBeInTheDocument()

    fireEvent.change(box, { target: { value: 'hishi' } })
    expect(screen.queryByRole('heading', { level: 2, name: 'No date yet' })).not.toBeInTheDocument()
  })

  it('tells a supporter their oshi is in a batch with no date yet', () => {
    releases = [OUT, NEXT, TENTATIVE]
    account = supporterWith([oshi(0, 60, 'Duramente')], 1)
    renderPage()

    const strip = screen.getByRole('region', { name: 'Your favourites' })
    const line = within(strip).getByRole('listitem')
    expect(line.textContent).toBe('Duramente: no date yet (6th Anniversary)')
    expect(within(line).getByRole('link', { name: '6th Anniversary' })).toHaveAttribute(
      'href',
      '/app/legend-races?release=13'
    )
  })

  it("links each card to its banner's card on the Timeline", () => {
    renderPage()
    const card = screen.getByRole('region', { name: '2nd Anniversary' })
    expect(within(card).getByRole('link', { name: 'On the Timeline' })).toHaveAttribute(
      'href',
      '/app/timeline?focus=banner-75'
    )
  })

  it('shows the empty state when no batch has a date, as on an API without the feature', () => {
    releases = []
    renderPage()

    expect(screen.getByText(/No batches are scheduled yet/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Already in the daily races/ })).not.toBeInTheDocument()
  })
})

describe('LegendRaceNote (on a Timeline banner card)', () => {
  // NEXT and LATER are in 2099 and 2100, OUT is in 2020, so any real "now"
  // sits between them.
  const renderNote = (windowStartDate: string, release: typeof NEXT | typeof OUT = NEXT) =>
    render(
      <MemoryRouter>
        <LegendRaceNote release={release} windowStartDate={windowStartDate} now={new Date()} />
      </MemoryRouter>
    )

  it('counts the umas and links to the batch on the Legend Races tab', () => {
    renderNote(NEXT.start_date)
    const link = screen.getByRole('link', { name: /2 umas join daily legend races/ })
    expect(link).toHaveAttribute('href', '/app/legend-races?release=2')
  })

  it("names the date only when it differs from the window's", () => {
    renderNote(NEXT.start_date)
    expect(screen.getByRole('link').textContent).toBe('2 umas join daily legend races')
  })

  it('says "joined" once the batch is out', () => {
    renderNote(OUT.start_date, OUT)
    expect(screen.getByRole('link').textContent).toBe('2 umas joined daily legend races')
  })

  it('adds the date for a batch that lands after its banner opens', () => {
    renderNote('2099-12-19T22:00:00Z')
    expect(screen.getByRole('link').textContent).toMatch(/^2 umas join daily legend races \d{4}\/\d+\/\d+$/)
  })
})
