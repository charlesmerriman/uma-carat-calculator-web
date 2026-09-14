import { describe, it, expect } from 'vitest'
import {
  formatTimelineFocus,
  parseTimelineFocus,
  timelineFocusHref,
} from '../utils/timelineFocus'
import { rowMatchesFocus } from '../components/timeline/timelineShared'
import type { TimelineRow } from '../components/timeline/timelineShared'
import type { BannerTimelineForViewing, ChampionsMeeting } from '../types'

/**
 * The deep-link contract between the calculator sheet and the Timeline.
 *
 * The parsing half matters more than it looks: this value comes off the URL,
 * where a user can edit or truncate it, so every malformed form has to degrade
 * to "no focus" rather than to a wrong card or a thrown route.
 */

function bannerRow(...ids: number[]): TimelineRow {
  return {
    kind: 'banner_window',
    group: {
      start_date: '2099-01-01T22:00:00Z',
      end_date: '2099-02-01T21:59:59Z',
      is_predicted: false,
      banners: ids.map((id) => ({ id }) as BannerTimelineForViewing),
      anniversary_event: null,
    },
  }
}

function markerRow(kind: 'scenario' | 'anniversary', sourceId: number): TimelineRow {
  return {
    kind: 'marker',
    marker: {
      key: `${kind}-${sourceId}`,
      kind,
      sourceId,
      name: 'Marker',
      startDate: '2099-01-01T22:00:00Z',
      endDate: null,
      image: null,
      isPredicted: false,
    },
  }
}

describe('parseTimelineFocus', () => {
  it('round-trips every kind through the format it writes', () => {
    for (const focus of [
      { kind: 'banner' as const, id: 812 },
      { kind: 'scenario' as const, id: 4 },
      { kind: 'anniversary' as const, id: 17 },
    ]) {
      expect(parseTimelineFocus(formatTimelineFocus(focus))).toEqual(focus)
    }
  })

  it('refuses an unknown kind rather than guessing at one', () => {
    expect(parseTimelineFocus('race-3')).toBeNull()
    expect(parseTimelineFocus('12')).toBeNull()
  })

  it('refuses a non-integer id instead of truncating it', () => {
    // parseInt('12abc') would be 12 — a real card the URL never named.
    expect(parseTimelineFocus('banner-12abc')).toBeNull()
    expect(parseTimelineFocus('banner-1.5')).toBeNull()
    expect(parseTimelineFocus('banner-')).toBeNull()
  })

  it('treats an absent or empty parameter as no focus', () => {
    expect(parseTimelineFocus(null)).toBeNull()
    expect(parseTimelineFocus(undefined)).toBeNull()
    expect(parseTimelineFocus('')).toBeNull()
  })

  it('builds a href the Timeline route can read back', () => {
    expect(timelineFocusHref({ kind: 'scenario', id: 4 })).toBe(
      '/app/timeline?focus=scenario-4'
    )
  })
})

describe('rowMatchesFocus', () => {
  it('matches a window by any banner inside it, not just the first', () => {
    // Concurrent banners merge into one card, so the card a reader lands on is
    // routinely shared with a banner they did not click.
    const row = bannerRow(10, 11)
    expect(rowMatchesFocus(row, { kind: 'banner', id: 11 })).toBe(true)
    expect(rowMatchesFocus(row, { kind: 'banner', id: 12 })).toBe(false)
  })

  it('keeps the two marker kinds apart at the same id', () => {
    expect(rowMatchesFocus(markerRow('scenario', 3), { kind: 'scenario', id: 3 })).toBe(true)
    expect(rowMatchesFocus(markerRow('scenario', 3), { kind: 'anniversary', id: 3 })).toBe(false)
  })

  it('never matches a race event, whatever its id', () => {
    const race: TimelineRow = { kind: 'race', event: { id: 3 } as ChampionsMeeting }
    expect(rowMatchesFocus(race, { kind: 'banner', id: 3 })).toBe(false)
    expect(rowMatchesFocus(race, { kind: 'scenario', id: 3 })).toBe(false)
  })

  it('matches a pair row through either of its halves', () => {
    const scenario = markerRow('scenario', 3)
    const anniversary = markerRow('anniversary', 7)
    if (scenario.kind !== 'marker' || anniversary.kind !== 'marker') throw new Error()
    const pair: TimelineRow = {
      kind: 'marker_pair',
      scenario: scenario.marker,
      anniversary: anniversary.marker,
    }
    expect(rowMatchesFocus(pair, { kind: 'scenario', id: 3 })).toBe(true)
    expect(rowMatchesFocus(pair, { kind: 'anniversary', id: 7 })).toBe(true)
    // The ids are not interchangeable across halves.
    expect(rowMatchesFocus(pair, { kind: 'scenario', id: 7 })).toBe(false)
    expect(rowMatchesFocus(pair, { kind: 'anniversary', id: 3 })).toBe(false)
  })

  it('does not confuse a banner id with a marker id', () => {
    expect(rowMatchesFocus(bannerRow(3), { kind: 'scenario', id: 3 })).toBe(false)
    expect(rowMatchesFocus(markerRow('scenario', 3), { kind: 'banner', id: 3 })).toBe(false)
  })
})
