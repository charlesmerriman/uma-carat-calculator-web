import { describe, it, expect } from 'vitest'
import {
  buildEligibleCardCatalogue,
  isGachaBanner,
} from '../hooks/useEligibleCardCatalogue'
import type { BannerUma, BannerSupport, Uma, SupportCard } from '../types'

/**
 * The catalogue behind both card pickers: the selector ticket's, and the
 * step-up's ten-slot selection.
 *
 * These rules had no tests while they were inline in SelectorTargetPicker.
 * They are individually small and collectively easy to get wrong — the "(All)"
 * exclusion in particular is invisible from the outside and would silently make
 * hundreds of non-gacha cards selectable if it were ever dropped.
 */

const makeTimeline = (name: string) => ({
  id: 1,
  name,
  banner_category: 'standard' as const,
  start_date: '2099-01-01T22:00:00Z',
  end_date: '2099-02-01T21:59:59Z',
  is_predicted: false,
  jp_start_date: null,
  jp_end_date: null,
  global_start_date: '2099-01-01T22:00:00Z',
  global_end_date: '2099-02-01T21:59:59Z',
  schedule_offset_days: 0,
  applied_offset_days: 0,
  image: '',
})

let nextId = 1
const makeUma = (name: string, firstJpDate: string | null): Uma => ({
  id: nextId++,
  name,
  image: `${name}.png`,
  admin_comments: '',
  recommendation: '',
  purpose: '',
  first_jp_date: firstJpDate,
  is_time_limited: false,
  is_three_star: true,
})

const makeSupport = (name: string, firstJpDate: string | null): SupportCard => ({
  id: nextId++,
  name,
  image: `${name}.png`,
  admin_comments: '',
  recommendation: '',
  purpose: '',
  first_jp_date: firstJpDate,
})

const umaBanner = (bannerName: string, umas: Uma[]): BannerUma => ({
  id: nextId++,
  banner_timeline: makeTimeline(bannerName),
  name: bannerName,
  admin_comments: '',
  umas,
  free_pulls: 0,
  is_recommended: false,
})

const supportBanner = (bannerName: string, cards: SupportCard[]): BannerSupport => ({
  id: nextId++,
  banner_timeline: makeTimeline(bannerName),
  name: bannerName,
  admin_comments: '',
  support_cards: cards,
  free_pulls: 0,
  is_recommended: false,
})

const build = (
  pool: 'uma' | 'support',
  jpCutoffDate: string | null,
  umaBannerData: BannerUma[] = [],
  supportBannerData: BannerSupport[] = []
) =>
  buildEligibleCardCatalogue({ pool, jpCutoffDate, umaBannerData, supportBannerData })

describe('isGachaBanner — the "(All)" exclusion', () => {
  it('rejects the spreadsheet catch-all rows in every casing it appears in', () => {
    expect(isGachaBanner('(All)')).toBe(false)
    expect(isGachaBanner('(all)')).toBe(false)
    expect(isGachaBanner('  (All) 2  ')).toBe(false)
  })

  it('accepts real banners, including ones that merely mention "all"', () => {
    expect(isGachaBanner('New Year 2024')).toBe(true)
    expect(isGachaBanner('All-Star Dream')).toBe(true)
  })
})

describe('buildEligibleCardCatalogue', () => {
  it('takes cards off real gacha banners', () => {
    const cards = build('uma', null, [
      umaBanner('New Year 2024', [makeUma('Kiseki', '2024-01-01')]),
    ])
    expect(cards.map((c) => c.label)).toEqual(['Kiseki'])
  })

  it('never offers a card that only appears on an "(All)" row', () => {
    // The catch-all carries card links for source-data bookkeeping only.
    const cards = build('uma', null, [
      umaBanner('(All)', [makeUma('Bookkeeping Only', '2024-01-01')]),
    ])
    expect(cards).toEqual([])
  })

  it('still offers a card that appears on both a real banner and an "(All)" row', () => {
    const uma = makeUma('Kiseki', '2024-01-01')
    const cards = build('uma', null, [
      umaBanner('(All)', [uma]),
      umaBanner('New Year 2024', [uma]),
    ])
    expect(cards.map((c) => c.label)).toEqual(['Kiseki'])
  })

  it('deduplicates a card that reruns across several banners', () => {
    const uma = makeUma('Rerun Girl', '2024-01-01')
    const cards = build('uma', null, [
      umaBanner('Debut', [uma]),
      umaBanner('Rerun', [uma]),
    ])
    expect(cards).toHaveLength(1)
  })

  it('draws from the pool it was asked for and not the other one', () => {
    const umas = [umaBanner('Uma Banner', [makeUma('An Uma', '2024-01-01')])]
    const supports = [supportBanner('SSR Banner', [makeSupport('An SSR', '2024-01-01')])]

    expect(build('uma', null, umas, supports).map((c) => c.label)).toEqual(['An Uma'])
    expect(build('support', null, umas, supports).map((c) => c.label)).toEqual(['An SSR'])
  })

  // ── The cutoff ──────────────────────────────────────────────────────────

  it('includes a card released exactly ON the cutoff', () => {
    // Three of the sheet's own cards sit exactly on their cutoff and are listed
    // as selectable, which is why the comparison is inclusive.
    const cards = build('uma', '2024-01-31', [
      umaBanner('Debut', [makeUma('On The Line', '2024-01-31T22:00:00Z')]),
    ])
    expect(cards.map((c) => c.label)).toEqual(['On The Line'])
  })

  it('excludes a card released after the cutoff', () => {
    const cards = build('uma', '2024-01-31', [
      umaBanner('Debut', [makeUma('Too New', '2024-02-01T22:00:00Z')]),
    ])
    expect(cards).toEqual([])
  })

  it('refuses a card with an unknown release date under a real cutoff', () => {
    // Conservative on purpose: claiming a pick is available when it is not is a
    // worse failure than hiding one that is.
    const cards = build('uma', '2024-01-31', [
      umaBanner('Debut', [makeUma('Unknown', null)]),
    ])
    expect(cards).toEqual([])
  })

  it('admits everything, unknown dates included, when the cutoff is null', () => {
    const cards = build('uma', null, [
      umaBanner('Debut', [makeUma('Unknown', null), makeUma('Known', '2024-01-01')]),
    ])
    expect(cards.map((c) => c.label).sort()).toEqual(['Known', 'Unknown'])
  })

  // ── Ordering ────────────────────────────────────────────────────────────

  it('excludes a time-limited uma', () => {
    const limited = { ...makeUma('Limited', '2020-01-01'), is_time_limited: true }
    const ordinary = makeUma('Ordinary', '2020-01-01')
    const catalogue = buildEligibleCardCatalogue({
      pool: 'uma',
      jpCutoffDate: '2026-01-01',
      umaBannerData: [umaBanner('Debut', [limited, ordinary])],
      supportBannerData: [],
    })
    expect(catalogue.map((c) => c.label)).toEqual(['Ordinary'])
  })

  it('excludes a uma that is not three star', () => {
    const twoStar = { ...makeUma('Two Star', '2020-01-01'), is_three_star: false }
    const ordinary = makeUma('Ordinary', '2020-01-01')
    const catalogue = buildEligibleCardCatalogue({
      pool: 'uma',
      jpCutoffDate: '2026-01-01',
      umaBannerData: [umaBanner('Debut', [twoStar, ordinary])],
      supportBannerData: [],
    })
    expect(catalogue.map((c) => c.label)).toEqual(['Ordinary'])
  })

  it('excludes a time-limited uma even when the cutoff is null', () => {
    // A null cutoff relaxes the date gate only — the intrinsic one still holds.
    const limited = { ...makeUma('Limited', '2020-01-01'), is_time_limited: true }
    const catalogue = buildEligibleCardCatalogue({
      pool: 'uma',
      jpCutoffDate: null,
      umaBannerData: [umaBanner('Debut', [limited])],
      supportBannerData: [],
    })
    expect(catalogue).toEqual([])
  })

  it('sorts newest JP release first', () => {
    const cards = build('uma', null, [
      umaBanner('Debut', [
        makeUma('Oldest', '2022-01-01'),
        makeUma('Newest', '2026-01-01'),
        makeUma('Middle', '2024-01-01'),
      ]),
    ])
    expect(cards.map((c) => c.label)).toEqual(['Newest', 'Middle', 'Oldest'])
  })

  it('breaks same-day ties by name, ignoring the time of day', () => {
    // A banner releases several cards on one date, at the same instant, so the
    // date alone cannot order them — and the time must not leak into the compare.
    const cards = build('uma', null, [
      umaBanner('Debut', [
        makeUma('Zenno', '2024-01-01T22:00:00Z'),
        makeUma('Air Groove', '2024-01-01T03:00:00Z'),
      ]),
    ])
    expect(cards.map((c) => c.label)).toEqual(['Air Groove', 'Zenno'])
  })

  it('sorts unknown release dates last', () => {
    const cards = build('uma', null, [
      umaBanner('Debut', [
        makeUma('Undated', null),
        makeUma('Dated', '2022-01-01'),
      ]),
    ])
    expect(cards.map((c) => c.label)).toEqual(['Dated', 'Undated'])
  })

  it('carries the image and JP date through for the caller to render', () => {
    const cards = build('uma', null, [
      umaBanner('Debut', [makeUma('Kiseki', '2024-01-01')]),
    ])
    expect(cards[0]).toMatchObject({
      label: 'Kiseki',
      image: 'Kiseki.png',
      firstJpDate: '2024-01-01',
    })
  })
})
