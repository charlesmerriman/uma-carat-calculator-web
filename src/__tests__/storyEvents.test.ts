import { describe, it, expect } from 'vitest'
import {
  firstEventGivingUma,
  rarityLabel,
  starLabel,
  storyEventKind,
  storyEventLabel,
  storyEventLine,
  storyEventMatchesSearch,
  storyEventName,
  storyEventRewards,
  storyEventUmas,
  storyEventsByBanner,
} from '../utils/storyEvents'
import type { StoryEvent, StoryEventCard, StoryEventKind, StoryEventUma } from '../types'

/** The story event row's rules, tested without React. */

const card = (overrides: Partial<StoryEventCard> = {}): StoryEventCard => ({
  id: 1,
  name: 'Hishi Akebono',
  title: '[Fondente Smile]',
  image: null,
  rarity: 3,
  purpose: '',
  game_id: 30133,
  must_get: false,
  note: '',
  ...overrides,
})

const uma = (overrides: Partial<StoryEventUma> = {}): StoryEventUma => ({
  id: 199,
  name: 'Special Week (Commander)',
  title: '[Ruler of Japan]',
  image: null,
  portrait: null,
  portrait_layers: null,
  rarity: 3,
  purpose: '',
  game_id: 100103,
  must_get: false,
  note: '',
  ...overrides,
})

const event = (overrides: Partial<StoryEvent> = {}): StoryEvent => ({
  id: 1,
  game_id: 1022,
  name: 'Sweet Memories Teatime',
  image: null,
  banner_timeline: 72,
  start_date: '2026-11-09T22:00:00Z',
  end_date: '2026-11-23T21:59:59Z',
  claim_end_date: '2026-11-26T21:59:59Z',
  is_predicted: false,
  applied_offset_days: 0,
  carat_amount: 2160,
  uma_ticket_amount: 2,
  support_ticket_amount: 2,
  ssr_shard_amount: 3,
  sr_shard_amount: 3,
  cards: [card()],
  ...overrides,
})

describe('storyEventsByBanner', () => {
  it('groups events under the banner they run with, keeping their order', () => {
    const byBanner = storyEventsByBanner([
      event({ id: 1, banner_timeline: 72 }),
      event({ id: 2, banner_timeline: 9 }),
      event({ id: 3, banner_timeline: 72 }),
    ])
    expect(byBanner.get(72)?.map((e) => e.id)).toEqual([1, 3])
    expect(byBanner.get(9)?.map((e) => e.id)).toEqual([2])
    expect(byBanner.get(5)).toBeUndefined()
  })
})

describe('storyEventName', () => {
  it('reads "Story event" when the event has no English name', () => {
    expect(storyEventName(event())).toBe('Sweet Memories Teatime')
    expect(storyEventName(event({ name: '  ' }))).toBe('Story event')
  })
})

describe('storyEventRewards', () => {
  it('lists the non-zero rewards, carats first, with thousands separated', () => {
    expect(storyEventRewards(event())).toEqual([
      '2,160 carats', '2 uma tickets', '2 support tickets', '3 SSR shards', '3 SR shards',
    ])
  })

  it('leaves out what the event does not pay and says one in the singular', () => {
    expect(
      storyEventRewards(event({
        carat_amount: 890, uma_ticket_amount: 1, support_ticket_amount: 0,
        ssr_shard_amount: 0, sr_shard_amount: 0,
      })),
    ).toEqual(['890 carats', '1 uma ticket'])
  })
})

describe('rarityLabel', () => {
  it('names the three rarities and treats an unknown one as SSR', () => {
    expect([1, 2, 3, null].map(rarityLabel)).toEqual(['R', 'SR', 'SSR', 'SSR'])
  })
})

describe('storyEventMatchesSearch', () => {
  it("matches the event's name or a free card's, ignoring case", () => {
    expect(storyEventMatchesSearch(event(), 'teatime')).toBe(true)
    expect(storyEventMatchesSearch(event(), 'akebono')).toBe(true)
    expect(storyEventMatchesSearch(event(), 'bourbon')).toBe(false)
    expect(storyEventMatchesSearch(event({ name: '' }), 'story event')).toBe(true)
  })

  it("matches a free uma's name, and an unnamed chapter by its kind", () => {
    const chapter = event({ kind: 'main_story', name: '', cards: [], umas: [uma()] })
    expect(storyEventMatchesSearch(chapter, 'commander')).toBe(true)
    expect(storyEventMatchesSearch(chapter, 'main story')).toBe(true)
  })
})

describe('the event kinds', () => {
  it('reads an event from an API older than the kinds as a story event with no umas', () => {
    const old = event()
    delete old.kind
    delete old.umas
    expect(storyEventKind(old)).toBe('story')
    expect(storyEventLabel(old)).toBe('Story event')
    expect(storyEventUmas(old)).toEqual([])
    expect(storyEventLine(old)).toBe('Runs with this banner.')
  })

  it('reads an unknown kind as a story event, so the row still draws', () => {
    expect(storyEventKind({ kind: 'collab' as StoryEventKind })).toBe('story')
  })

  it("names an unnamed event by its kind's label", () => {
    expect(storyEventName(event({ kind: 'anniversary', name: ' ' }))).toBe('Anniversary missions')
    expect(storyEventName(event({ kind: 'special', name: '' }))).toBe('Special event')
  })

  it("gives each kind its line, with an end only where the event closes", () => {
    // Noon UTC, so the local day reads the same in any test time zone.
    const end = '2026-04-15T12:00:00Z'
    expect(storyEventLine(event({ kind: 'main_story', end_date: null }))).toBe(
      'Added with this banner. Read it any time.',
    )
    expect(storyEventLine(event({ kind: 'anniversary', end_date: end }))).toBe(
      'Missions and login bonus. Ends 2026/4/15.',
    )
    expect(storyEventLine(event({ kind: 'anniversary', end_date: null }))).toBe('Missions and login bonus.')
    expect(storyEventLine(event({ kind: 'special', end_date: end }))).toBe('Ends 2026/4/15.')
    expect(storyEventLine(event({ kind: 'special', end_date: null }))).toBeNull()
    // A story event never shows a date, even with one.
    expect(storyEventLine(event({ kind: 'story', end_date: end }))).toBe('Runs with this banner.')
  })

  it('stacks the kinds under one banner, story event first, keeping date order within a kind', () => {
    const byBanner = storyEventsByBanner([
      event({ id: 1, kind: 'special' }),
      event({ id: 2, kind: 'main_story' }),
      event({ id: 3 }),
      event({ id: 4, kind: 'main_story' }),
      event({ id: 5, kind: 'anniversary' }),
    ])
    expect(byBanner.get(72)?.map((e) => e.id)).toEqual([3, 2, 4, 5, 1])
  })

  it("labels an uma's stars, 3★ when the game gave none", () => {
    expect([1, 2, 3, null].map(starLabel)).toEqual(['1★', '2★', '3★', '3★'])
  })
})

describe('firstEventGivingUma', () => {
  it('finds the earliest dated event that gives the outfit', () => {
    const events = [
      event({ id: 1, start_date: '2026-06-25T22:00:00Z', umas: [uma()] }),
      event({ id: 2, start_date: '2025-01-01T00:00:00Z', umas: [] }),
      event({ id: 3, start_date: '2026-01-01T00:00:00Z', umas: [uma()] }),
      event({ id: 4, start_date: null, umas: [uma()] }),
    ]
    expect(firstEventGivingUma(events, 199)?.id).toBe(3)
    expect(firstEventGivingUma(events, 5)).toBeUndefined()
  })
})
