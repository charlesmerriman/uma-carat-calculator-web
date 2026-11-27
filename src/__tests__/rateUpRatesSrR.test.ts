// @vitest-environment node
// SR and R rate-ups on support banners (notes/banner-sr-r-plan.md): the
// support constants, the SSR-only picks, and the helpers that split a banner's
// cards for the odds and the Timeline. The worked table is the plan's.
import { describe, it, expect } from 'vitest'
import type { BannerSupport, BannerUma, OtherRateUp, SupportCard, Uma } from '../types'
import { DEFAULT_CONSTANTS } from '../constants/gameConstants'
import { allRateUps, timelineNamedRateUps, timelineSupportTiles } from '../utils/bannerHelpers'
import { oddsCards, rateUpCards, type RateUpTarget } from '../utils/rateUpRates'

// Daptrius's live uma values, which the support constants must not read.
const C = { ...DEFAULT_CONSTANTS, rate_up_pool_2: 0.18, rate_up_rate_1: 0.1, rate_up_pool_1: 0.79 }

const ssr = (id: number) => ({ id, name: `SSR ${id}`, image: '', rarity: 3 }) as SupportCard
const other = (id: number, rarity: 1 | 2, display: OtherRateUp['display'] = 'named') =>
  ({ id, name: `${rarity === 2 ? 'SR' : 'R'} ${id}`, image: '', rarity, display }) as OtherRateUp

const banner = (cards: SupportCard[], others: OtherRateUp[] = [], extra: Partial<BannerSupport> = {}) =>
  ({ id: 1, support_cards: cards, other_rate_ups: others, ...extra }) as BannerSupport
const target = (b: BannerSupport): RateUpTarget => ({ type: 'Support', banner: b, timeline: b.banner_timeline })
const rateOf = (b: BannerSupport) => new Map(rateUpCards(target(b), C).map((card) => [card.id, card.rate]))

describe('support SRs and Rs read their own constants', () => {
  it.each([
    ['1 SR', [other(11, 2)], 0.0225],
    ['2 SRs', [other(11, 2), other(12, 2)], 0.015],
    ['4 SRs', [11, 12, 13, 14].map((id) => other(id, 2)), 0.0075],
    ['1 R', [other(21, 1)], 0.0375],
    ['2 Rs', [other(21, 1), other(22, 1)], 0.025],
    ['3 Rs', [other(21, 1), other(22, 1), other(23, 1)], 0.05 / 3],
  ])('%s', (_, others, each) => {
    const rates = rateOf(banner([ssr(1)], others))
    for (const card of others) expect(rates.get(card.id)).toBeCloseTo(each, 12)
    expect(rates.get(1)).toBeCloseTo(0.0075, 12)
  })

  it('leaves a ★1 uma on the uma constants', () => {
    const b = { id: 2, umas: [{ id: 5, name: 'Uma', image: '', rarity: 1 } as Uma] } as BannerUma
    expect(rateUpCards({ type: 'Uma', banner: b, timeline: b.banner_timeline }, C)[0].rate).toBe(0.1)
  })

  it("splits only the SSR pool by a select banner's picks", () => {
    const rates = rateOf(banner([1, 2, 3, 4].map(ssr), [other(11, 2)], { rate_up_picks: 2 }))
    expect(rates.get(1)).toBeCloseTo(0.0075, 12)
    expect(rates.get(11)).toBeCloseTo(0.0225, 12)
  })

  it('offers every rate-up in the odds picker, hidden ones included, the SSR still the default', () => {
    const b = banner([ssr(1)], [other(11, 2, 'picture'), other(21, 1, 'hidden')])
    const { cards, primary } = oddsCards(target(b), {}, C)
    expect(cards.map((card) => card.id)).toEqual([1, 11, 21])
    expect(primary?.id).toBe(1)
    expect(oddsCards(target(b), { primary_card: 21 }, C).primary?.id).toBe(21)
  })
})

describe('splitting a banner for the Timeline', () => {
  const b = banner([ssr(1)], [other(11, 2, 'picture'), other(12, 2, 'named'), other(21, 1, 'named'), other(22, 1, 'hidden')])

  it('draws the SSRs and the pictured SRs as tiles', () => {
    expect(timelineSupportTiles(b).map((card) => card.id)).toEqual([1, 11])
  })

  it('lists the named ones under the card, and leaves the hidden off', () => {
    expect(timelineNamedRateUps(b).map((card) => card.id)).toEqual([12, 21])
  })

  it('gives every reader of every rate-up all of them', () => {
    expect(allRateUps(b).map((card) => card.id)).toEqual([1, 11, 12, 21, 22])
  })

  it('reads a banner from an older API (no other_rate_ups) as its SSRs', () => {
    const old = { id: 3, support_cards: [ssr(1)] } as BannerSupport
    expect(allRateUps(old)).toEqual(old.support_cards)
    expect(timelineSupportTiles(old)).toEqual(old.support_cards)
    expect(timelineNamedRateUps(old)).toEqual([])
  })
})
