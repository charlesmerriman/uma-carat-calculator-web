import { describe, it, expect } from 'vitest'
import {
  rarityLabel,
  storyEventMatchesSearch,
  storyEventName,
  storyEventRewards,
  storyEventsByBanner,
} from '../utils/storyEvents'
import type { StoryEvent, StoryEventCard } from '../types'

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
})
