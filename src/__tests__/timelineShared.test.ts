import { describe, it, expect } from 'vitest'
import {
  buildTimelineMarkers,
  buildWindowSections,
  groupTimelineEvents,
  mergeTimelineMarkers,
  buildMarkerRows,
  markerRowMatchesKind,
  markerRowMatchesSearch,
  timelineRowKey,
  formatStepUpChip,
  featuredTitle,
} from '../components/timeline/timelineShared'
import type {
  BannerWindowGroup,
  TimelineMarker,
  TimelineRow,
} from '../components/timeline/timelineShared'
import type {
  AnniversaryEvent,
  BannerTimelineForViewing,
  ChampionsMeeting,
  Scenario,
  TimelineEvent,
} from '../types'

/**
 * Window grouping is what lets concurrent banners — most visibly the Golden
 * Week revivals — render as one timeline card while staying separate rows in
 * the database. The rule is deliberately narrow (identical start_date), so
 * these tests are mostly about what it must NOT sweep up.
 */

function banner(
  id: number,
  start: string,
  end: string,
  overrides: Partial<BannerTimelineForViewing> = {},
): BannerTimelineForViewing {
  return {
    id,
    name: `Banner ${id}`,
    banner_category: 'standard',
    event_type: 'banner_timeline',
    start_date: start,
    end_date: end,
    is_predicted: false,
    jp_start_date: null,
    jp_end_date: null,
    global_start_date: start,
    global_end_date: end,
    schedule_offset_days: 0,
    applied_offset_days: 0,
    image: null,
    banner_umas: [],
    banner_supports: [],
    anniversary_event: null,
    banner_step_ups: [],
    ...overrides,
  }
}

function raceEvent(id: number, start: string): ChampionsMeeting {
  return {
    id,
    name: `Champions Meeting ${id}`,
    event_type: 'champions_meeting',
    cm_number: id,
    start_date: start,
    end_date: start,
    is_predicted: false,
    jp_start_date: null,
    jp_end_date: null,
    global_start_date: start,
    global_end_date: start,
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
  } as ChampionsMeeting
}

/** The groups from a row list, in order. */
function groups(rows: TimelineRow[]): BannerWindowGroup[] {
  return rows.flatMap((row) => (row.kind === 'banner_window' ? [row.group] : []))
}

describe('groupTimelineEvents', () => {
  it('folds banners that open at the same instant into one row', () => {
    // The 2026 Golden Week shape: a revival and an ordinary banner opening
    // together and ending together.
    const rows = groupTimelineEvents([
      banner(189, '2029-03-09T19:30:14.400000Z', '2029-03-20T19:30:13.400000Z'),
      banner(190, '2029-03-09T19:30:14.400000Z', '2029-03-20T19:30:13.400000Z'),
    ])

    expect(rows).toHaveLength(1)
    expect(groups(rows)[0].banners.map((b) => b.id)).toEqual([189, 190])
  })

  it('leaves banners with different start dates as separate rows', () => {
    const rows = groupTimelineEvents([
      banner(1, '2029-01-01T00:00:00Z', '2029-01-08T00:00:00Z'),
      banner(2, '2029-01-08T00:00:00Z', '2029-01-15T00:00:00Z'),
    ])

    expect(rows).toHaveLength(2)
  })

  it('does not group on the calendar day alone', () => {
    // Same UTC day, different instants. Merging these would put two banners a
    // reader sees as separate openings onto one card — and west of GMT they
    // may not even fall on the same local date.
    const rows = groupTimelineEvents([
      banner(1, '2029-01-01T01:00:00Z', '2029-01-08T00:00:00Z'),
      banner(2, '2029-01-01T22:00:00Z', '2029-01-08T00:00:00Z'),
    ])

    expect(rows).toHaveLength(2)
  })

  it('states the union window when the constituents end on different days', () => {
    // The real 2025 Golden Week: the revival runs nine days past the standard
    // banner it opened alongside.
    const rows = groupTimelineEvents([
      banner(129, '2028-06-17T10:51:50.400000Z', '2028-06-29T10:51:49.400000Z'),
      banner(171, '2028-06-17T10:51:50.400000Z', '2028-07-08T10:51:49.400000Z'),
    ])

    const [group] = groups(rows)
    expect(group.start_date).toBe('2028-06-17T10:51:50.400000Z')
    expect(group.end_date).toBe('2028-07-08T10:51:49.400000Z')
  })

  it('keeps the union end date when the longer banner comes first', () => {
    // Guards the comparison itself: taking the last-seen end date would pass
    // the test above by accident and fail here.
    const rows = groupTimelineEvents([
      banner(171, '2028-06-17T00:00:00Z', '2028-07-08T00:00:00Z'),
      banner(129, '2028-06-17T00:00:00Z', '2028-06-29T00:00:00Z'),
    ])

    expect(groups(rows)[0].end_date).toBe('2028-07-08T00:00:00Z')
  })

  it('flags the group as predicted if any constituent still is', () => {
    const rows = groupTimelineEvents([
      banner(1, '2029-01-01T00:00:00Z', '2029-01-08T00:00:00Z'),
      banner(2, '2029-01-01T00:00:00Z', '2029-01-08T00:00:00Z', { is_predicted: true }),
    ])

    expect(groups(rows)[0].is_predicted).toBe(true)
  })

  it('never folds race events into a window, even on a shared start date', () => {
    // Champions Meetings run concurrently with banners all the time. They are a
    // separate union member with their own card and must pass straight through.
    const start = '2029-01-01T00:00:00Z'
    const rows = groupTimelineEvents([
      banner(1, start, '2029-01-08T00:00:00Z'),
      raceEvent(1, start),
      banner(2, start, '2029-01-08T00:00:00Z'),
    ])

    expect(rows.map((row) => row.kind)).toEqual(['banner_window', 'race'])
    expect(groups(rows)[0].banners.map((b) => b.id)).toEqual([1, 2])
  })

  it('keeps the group where its first constituent sat, preserving the sort', () => {
    const rows = groupTimelineEvents([
      banner(1, '2029-01-01T00:00:00Z', '2029-01-08T00:00:00Z'),
      banner(2, '2029-02-01T00:00:00Z', '2029-02-08T00:00:00Z'),
      // Opens with banner 1 but arrives last — the group must not jump to the end.
      banner(3, '2029-01-01T00:00:00Z', '2029-01-08T00:00:00Z'),
    ])

    expect(groups(rows).map((g) => g.start_date)).toEqual([
      '2029-01-01T00:00:00Z',
      '2029-02-01T00:00:00Z',
    ])
    expect(groups(rows)[0].banners.map((b) => b.id)).toEqual([1, 3])
  })

  it('takes the campaign from whichever constituent carries one', () => {
    const campaign = {
      id: 7,
      name: '3rd Anniversary',
      event_type: 'anniversary',
    } as BannerTimelineForViewing['anniversary_event']

    const rows = groupTimelineEvents([
      banner(1, '2029-01-01T00:00:00Z', '2029-01-08T00:00:00Z'),
      banner(2, '2029-01-01T00:00:00Z', '2029-01-08T00:00:00Z', { anniversary_event: campaign }),
    ])

    // The strip renders above the whole card, so a group can only show one.
    expect(groups(rows)[0].anniversary_event).toBe(campaign)
  })

  it('folds a staggered release: one JP window, two global starts', () => {
    // 2026-10, Hokko Tarumae: global opened the uma banner three days before
    // the support banner of the same JP window.
    const jp = { jp_start_date: '2023-01-10T22:00:00Z' }
    const rows = groupTimelineEvents([
      banner(69, '2026-10-24T06:00:00Z', '2026-11-06T21:59:59Z', jp),
      banner(207, '2026-10-27T22:00:00Z', '2026-11-06T21:59:59Z', jp),
    ])

    expect(rows).toHaveLength(1)
    const [group] = groups(rows)
    expect(group.banners.map((b) => b.id)).toEqual([69, 207])
    // The header states the span of both halves.
    expect(group.start_date).toBe('2026-10-24T06:00:00Z')
    expect(group.end_date).toBe('2026-11-06T21:59:59Z')
  })

  it('still folds a shared global start whose JP starts differ', () => {
    // The launch window: global opened in one go what JP ran a week apart. The
    // JP rule widens the grouping; it must not replace the start rule.
    const start = '2025-06-26T22:00:00Z'
    const rows = groupTimelineEvents([
      banner(1, start, '2025-07-02T21:59:59Z', { jp_start_date: '2021-02-24T22:00:00Z' }),
      banner(2, start, '2025-07-02T21:59:59Z', { jp_start_date: '2021-03-02T22:00:00Z' }),
    ])

    expect(rows).toHaveLength(1)
  })

  it('never groups two rows merely because neither has a JP date', () => {
    const rows = groupTimelineEvents([
      banner(1, '2029-01-01T00:00:00Z', '2029-01-08T00:00:00Z'),
      banner(2, '2029-01-08T00:00:00Z', '2029-01-15T00:00:00Z'),
    ])

    expect(rows).toHaveLength(2)
  })

  it('gives every row a distinct key when both grouping rules are in play', () => {
    // Row 3 shares row 1's global start and row 4's JP start. Whichever card
    // it joins, no two cards may end up claiming the same start instant.
    const rows = groupTimelineEvents([
      banner(1, '2029-01-01T00:00:00Z', '2029-01-08T00:00:00Z', { jp_start_date: '2026-01-01T00:00:00Z' }),
      banner(3, '2029-01-01T00:00:00Z', '2029-01-08T00:00:00Z', { jp_start_date: '2026-02-01T00:00:00Z' }),
      banner(4, '2029-01-05T00:00:00Z', '2029-01-12T00:00:00Z', { jp_start_date: '2026-02-01T00:00:00Z' }),
    ])

    const keys = rows.map(timelineRowKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('passes a lone banner through unchanged, as a group of one', () => {
    const only = banner(1, '2029-01-01T00:00:00Z', '2029-01-08T00:00:00Z')
    const [group] = groups(groupTimelineEvents([only]))

    expect(group.banners).toEqual([only])
    expect(group.start_date).toBe(only.start_date)
    expect(group.end_date).toBe(only.end_date)
  })

  it('returns nothing for an empty list rather than an empty group', () => {
    expect(groupTimelineEvents([])).toEqual([])
  })
})

describe('buildWindowSections', () => {
  // Only the lengths matter to the rule, so the nested banners are stubs.
  const umaOnly = { banner_umas: [{}] } as Partial<BannerTimelineForViewing>
  const supportOnly = { banner_supports: [{}] } as Partial<BannerTimelineForViewing>
  const both = { ...umaOnly, ...supportOnly }
  const start = '2029-01-01T00:00:00Z'
  const end = '2029-01-08T00:00:00Z'

  it('gives an ordinary banner one section reading from itself', () => {
    const only = banner(1, start, end, both)
    const [section, ...rest] = buildWindowSections([only])

    expect(rest).toEqual([])
    expect(section.primary).toBe(only)
    expect(section.umaWindow).toBe(only)
    expect(section.supportWindow).toBe(only)
    expect(section.isFused).toBe(false)
  })

  it('fuses an uma-only row and a support-only row into one section', () => {
    const umaHalf = banner(69, start, end, { ...umaOnly, image: 'art.png' })
    const supportHalf = banner(207, '2029-01-04T00:00:00Z', end, supportOnly)
    const sections = buildWindowSections([umaHalf, supportHalf])

    expect(sections).toHaveLength(1)
    expect(sections[0].umaWindow).toBe(umaHalf)
    expect(sections[0].supportWindow).toBe(supportHalf)
    expect(sections[0].image).toBe('art.png')
    expect(sections[0].isFused).toBe(true)
  })

  it('fuses whichever half comes first, and borrows the art from either', () => {
    const supportHalf = banner(207, start, end, { ...supportOnly, image: 'art.png' })
    const umaHalf = banner(69, '2029-01-04T00:00:00Z', end, umaOnly)
    const sections = buildWindowSections([supportHalf, umaHalf])

    expect(sections).toHaveLength(1)
    expect(sections[0].primary).toBe(umaHalf)
    expect(sections[0].image).toBe('art.png')
  })

  it('leaves two uma banners as two sections', () => {
    // A revival beside a standard banner: two pools, not two halves of one.
    const sections = buildWindowSections([
      banner(1, start, end, both),
      banner(2, start, end, { ...umaOnly, banner_category: 'golden_week_revival' }),
    ])

    expect(sections).toHaveLength(2)
    expect(sections.every((section) => !section.isFused)).toBe(true)
  })

  it('does not fuse across categories', () => {
    // Fusing would file one half under the other's category chip.
    const sections = buildWindowSections([
      banner(1, start, end, umaOnly),
      banner(2, start, end, { ...supportOnly, banner_category: 'race_prep_support' }),
    ])

    expect(sections).toHaveLength(2)
  })

  it('uses each support half once', () => {
    const sections = buildWindowSections([
      banner(1, start, end, umaOnly),
      banner(2, start, end, umaOnly),
      banner(3, start, end, supportOnly),
    ])

    expect(sections.map((section) => section.isFused)).toEqual([true, false])
  })
})

describe('timelineRowKey', () => {
  it('cannot collide between a race event and a banner window', () => {
    const events: TimelineEvent[] = [
      banner(4, '2029-01-01T00:00:00Z', '2029-01-08T00:00:00Z'),
      raceEvent(4, '2029-02-01T00:00:00Z'),
    ]
    const keys = groupTimelineEvents(events).map(timelineRowKey)

    expect(new Set(keys).size).toBe(2)
  })

  it('is stable when the API reorders the banners inside a group', () => {
    const start = '2029-01-01T00:00:00Z'
    const end = '2029-01-08T00:00:00Z'
    const one = banner(1, start, end)
    const two = banner(2, start, end)

    // Keying on the first banner's id would change here; keying on the shared
    // start date — which is the group's identity — does not.
    expect(timelineRowKey(groupTimelineEvents([one, two])[0])).toBe(
      timelineRowKey(groupTimelineEvents([two, one])[0]),
    )
  })
})

// ── formatStepUpChip ──────────────────────────────────────────────────────────

describe('formatStepUpChip', () => {
  it('sums both pools into the caption a player recognises', () => {
    // The 5th Anniversary: two ★3 step-ups and three SSR ones.
    expect(
      formatStepUpChip([
        { card_type: 'uma', banner_count: 2 },
        { card_type: 'support', banner_count: 3 },
      ]),
    ).toBe('2 ★3 + 3 SSR Step-Up')
  })

  it('names only the pool that is actually running', () => {
    // The 3.5th and 4.5th anniversaries run SSR step-ups and no ★3 ones.
    expect(formatStepUpChip([{ card_type: 'support', banner_count: 2 }])).toBe(
      '2 SSR Step-Up',
    )
    expect(formatStepUpChip([{ card_type: 'uma', banner_count: 1 }])).toBe(
      '1 ★3 Step-Up',
    )
  })

  it('adds up several rows of the same pool', () => {
    expect(
      formatStepUpChip([
        { card_type: 'uma', banner_count: 1 },
        { card_type: 'uma', banner_count: 2 },
      ]),
    ).toBe('3 ★3 Step-Up')
  })

  it('returns null when a campaign runs none, so no chip renders', () => {
    expect(formatStepUpChip([])).toBeNull()
    expect(formatStepUpChip([{ card_type: 'uma', banner_count: 0 }])).toBeNull()
  })
})

/**
 * Markers are the Timeline's third row kind: scenario launches and campaign
 * openings, rendered as their own cards rather than attached to a banner.
 */
describe('buildTimelineMarkers', () => {
  const scenario = (id: number, name: string, start: string | null): Scenario => ({
    id,
    name,
    image: null,
    banner_timeline: null,
    start_date: start,
    is_predicted: false,
    applied_offset_days: 0,
  })

  const campaign = (
    id: number,
    name: string,
    start: string | null,
    end: string | null,
    // Defaults to the opening date, matching what the backend resolves for a
    // campaign with no separate main part.
    mainStart: string | null = start,
  ): AnniversaryEvent => ({
    id,
    name,
    event_type: 'anniversary',
    jp_cutoff_date: null,
    image: null,
    accent_label: '',
    start_date: start,
    main_start_date: mainStart,
    end_date: end,
    is_predicted: false,
    applied_offset_days: 0,
    products: [],
    banner_parts: [],
  })

  it('gives a scenario a null end date, because it has no end', () => {
    const [marker] = buildTimelineMarkers(
      [scenario(1, 'Mecha', '2028-02-08T00:00:00Z')],
      [],
    )
    expect(marker.endDate).toBeNull()
    expect(marker.kind).toBe('scenario')
  })

  it('carries a campaign\'s window through', () => {
    const [marker] = buildTimelineMarkers(
      [],
      [campaign(8, '4th', '2028-05-01T00:00:00Z', '2028-05-26T00:00:00Z')],
    )
    expect(marker.endDate).toBe('2028-05-26T00:00:00Z')
  })

  it('dates a campaign card from its MAIN part, through the campaign end', () => {
    // The card sits where the anniversary actually is (Part 2), and reads
    // "<anniversary opens> through <campaign closes>" — the span in which a
    // player can still buy the packs and pull the later parts.
    const [marker] = buildTimelineMarkers(
      [],
      [campaign(
        11,
        '4th Anniversary',
        '2028-04-21T00:00:00Z', // Part 1 run-up opens the campaign
        '2028-05-29T00:00:00Z', // Part 4 closes it
        '2028-04-30T00:00:00Z', // Part 2 IS the anniversary
      )],
    )
    expect(marker.startDate).toBe('2028-04-30T00:00:00Z')
    expect(marker.endDate).toBe('2028-05-29T00:00:00Z')
  })

  it('sorts a campaign into the stream by its main part', () => {
    // The run-up opens before the banner window, the anniversary starts after
    // it. Placing on start_date would put the card above that window instead.
    const rows = mergeTimelineMarkers(
      [{
        kind: 'banner_window',
        group: {
          start_date: '2028-04-25T00:00:00Z',
          end_date: '2028-04-25T00:00:00Z',
          is_predicted: false,
          banners: [],
          anniversary_event: null,
        } as unknown as BannerWindowGroup,
      }],
      buildTimelineMarkers([], [campaign(
        11,
        '4th Anniversary',
        '2028-04-21T00:00:00Z',
        '2028-05-29T00:00:00Z',
        '2028-04-30T00:00:00Z',
      )]),
    )
    expect(rows.map((r) => r.kind)).toEqual(['banner_window', 'marker'])
  })

  it('never makes a card for a one-off promotion', () => {
    // The Trainer Support Pack is a permanently purchasable bundle, not a
    // moment on the calendar — no card, exactly as it gets no planner band.
    const markers = buildTimelineMarkers([], [
      { ...campaign(6, 'Trainer Support Pack', '2028-05-01T00:00:00Z', '2028-06-01T00:00:00Z'),
        event_type: 'campaign' as const },
    ])
    expect(markers).toEqual([])
  })

  it('still makes a card for a new year campaign', () => {
    const markers = buildTimelineMarkers([], [
      { ...campaign(2, 'New Years 2026', '2028-12-31T00:00:00Z', '2029-01-07T00:00:00Z'),
        event_type: 'new_year' as const },
    ])
    expect(markers.map((m) => m.name)).toEqual(['New Years 2026'])
  })

  it('drops undated rows, which have nothing to sort by', () => {
    expect(
      buildTimelineMarkers([scenario(1, 'No banner yet', null)], [campaign(2, 'No parts', null, null)]),
    ).toEqual([])
  })

  it('prefixes keys per kind so ids cannot collide across models', () => {
    const markers = buildTimelineMarkers(
      [scenario(1, 'S', '2028-01-01T00:00:00Z')],
      [campaign(1, 'A', '2028-01-01T00:00:00Z', '2028-02-01T00:00:00Z')],
    )
    expect(markers.map((m) => m.key)).toEqual(['sce-1', 'ann-1'])
  })
})

describe('mergeTimelineMarkers', () => {
  const marker = (
    key: string,
    kind: TimelineMarker['kind'],
    name: string,
    startDate: string,
  ): TimelineMarker => ({
    // Not asserted here — mergeTimelineMarkers sorts on dates and kinds. It
    // exists so the fixture is a real TimelineMarker.
    sourceId: 1,
    key,
    kind,
    name,
    startDate,
    endDate: null,
    image: null,
    isPredicted: false,
  })

  /** A minimal banner-window row opening at `start`. */
  const windowRow = (start: string): TimelineRow => ({
    kind: 'banner_window',
    group: {
      start_date: start,
      end_date: start,
      is_predicted: false,
      banners: [],
      anniversary_event: null,
    } as unknown as BannerWindowGroup,
  })

  it('returns the rows untouched when there are no markers', () => {
    const rows = [windowRow('2028-01-01T00:00:00Z')]
    expect(mergeTimelineMarkers(rows, [])).toBe(rows)
  })

  it('places a marker before the first row starting at or after it', () => {
    const merged = mergeTimelineMarkers(
      [windowRow('2028-01-01T00:00:00Z'), windowRow('2028-06-01T00:00:00Z')],
      [marker('sce-1', 'scenario', 'Mecha', '2028-03-01T00:00:00Z')],
    )
    expect(merged.map((r) => (r.kind === 'marker' ? r.marker.name : 'row'))).toEqual([
      'row',
      'Mecha',
      'row',
    ])
  })

  it('folds a scenario and a campaign on the same day into one pair row', () => {
    const merged = mergeTimelineMarkers(
      [windowRow('2028-06-01T00:00:00Z')],
      [
        // Deliberately out of order, and a few hours apart: the pairing runs on
        // the sorted list and on the calendar day, not the exact instant.
        marker('ann-1', 'anniversary', 'Campaign', '2028-03-01T05:00:00Z'),
        marker('sce-1', 'scenario', 'Scenario', '2028-03-01T00:00:00Z'),
      ],
    )
    expect(merged.map((r) => r.kind)).toEqual(['marker_pair', 'banner_window'])
    const pair = merged[0]
    if (pair.kind !== 'marker_pair') throw new Error('expected a pair')
    expect(pair.scenario.name).toBe('Scenario')
    expect(pair.anniversary.name).toBe('Campaign')
  })

  it('keeps a scenario and a campaign on different days as separate rows', () => {
    const merged = mergeTimelineMarkers(
      [],
      [
        marker('sce-1', 'scenario', 'Scenario', '2028-03-01T23:00:00Z'),
        marker('ann-1', 'anniversary', 'Campaign', '2028-03-02T01:00:00Z'),
      ],
    )
    expect(merged.map((r) => (r.kind === 'marker' ? r.marker.name : r.kind))).toEqual([
      'Scenario',
      'Campaign',
    ])
  })

  it('only pairs a scenario with a campaign, never two of a kind', () => {
    const merged = mergeTimelineMarkers(
      [],
      [
        marker('ann-1', 'anniversary', 'A', '2028-03-01T00:00:00Z'),
        marker('ann-2', 'anniversary', 'B', '2028-03-01T00:00:00Z'),
      ],
    )
    expect(merged.map((r) => r.kind)).toEqual(['marker', 'marker'])
  })

  it('places a pair where the scenario alone would have gone', () => {
    const merged = mergeTimelineMarkers(
      [windowRow('2028-01-01T00:00:00Z'), windowRow('2028-06-01T00:00:00Z')],
      [
        marker('sce-1', 'scenario', 'Scenario', '2028-03-01T00:00:00Z'),
        marker('ann-1', 'anniversary', 'Campaign', '2028-03-01T00:00:00Z'),
      ],
    )
    expect(merged.map((r) => r.kind)).toEqual(['banner_window', 'marker_pair', 'banner_window'])
  })

  it('keeps the pair, and its key, under either kind filter and a one-sided search', () => {
    // The row is built BEFORE filtering, so the same launch is the same row
    // under "All", "Scenarios" and "Campaigns" — and the key the list anchors
    // on when a filter is lifted is the same in every list.
    const rows = buildMarkerRows([
      marker('sce-1', 'scenario', 'Project L\'Arc', '2028-03-01T00:00:00Z'),
      marker('ann-1', 'anniversary', '2.5th Anniversary', '2028-03-01T00:00:00Z'),
    ])
    expect(rows.map((r) => r.kind)).toEqual(['marker_pair'])
    const [pair] = rows
    expect(markerRowMatchesKind(pair, 'scenario')).toBe(true)
    expect(markerRowMatchesKind(pair, 'anniversary')).toBe(true)
    expect(markerRowMatchesSearch(pair, "l'arc")).toBe(true)
    expect(markerRowMatchesSearch(pair, 'anniversary')).toBe(true)
    expect(markerRowMatchesSearch(pair, 'mecha')).toBe(false)
    expect(timelineRowKey(pair)).toBe('sce-1+ann-1')
  })

  it('keys a pair on both halves so it never collides with a lone marker', () => {
    const merged = mergeTimelineMarkers(
      [],
      [
        marker('sce-1', 'scenario', 'Scenario', '2028-03-01T00:00:00Z'),
        marker('ann-1', 'anniversary', 'Campaign', '2028-03-01T00:00:00Z'),
      ],
    )
    expect(timelineRowKey(merged[0])).toBe('sce-1+ann-1')
  })

  it('appends a marker later than every row, unlike the planner bands', () => {
    const merged = mergeTimelineMarkers(
      [windowRow('2028-01-01T00:00:00Z')],
      [marker('sce-1', 'scenario', 'Later', '2029-01-01T00:00:00Z')],
    )
    expect(merged.map((r) => (r.kind === 'marker' ? r.marker.name : 'row'))).toEqual([
      'row',
      'Later',
    ])
  })

  it('keys a marker row on its own prefixed key', () => {
    const merged = mergeTimelineMarkers(
      [],
      [marker('sce-3', 'scenario', 'Mecha', '2028-01-01T00:00:00Z')],
    )
    expect(timelineRowKey(merged[0])).toBe('sce-3')
  })
})

describe('featuredTitle', () => {
  it('names a single featured card', () => {
    expect(featuredTitle(['Narita Brian (Blaze)'], [])).toBe('Narita Brian (Blaze)')
  })

  it('leads with umas, then support cards', () => {
    expect(featuredTitle(['Narita Brian (Blaze)'], ['Yamanin Zephyr'])).toBe('Narita Brian (Blaze) and Yamanin Zephyr')
    expect(featuredTitle(['Hokko Tarumae'], ['Agnes Tachyon', 'Tokai Teio'])).toBe('Hokko Tarumae, Agnes Tachyon and Tokai Teio')
  })

  it('names a card once when an uma and a support card share it', () => {
    expect(featuredTitle(['Special Week'], ['Special Week'])).toBe('Special Week')
  })

  it('names two and counts the rest past three', () => {
    expect(featuredTitle(['A', 'B', 'C'], ['D', 'E'])).toBe('A, B and 3 more')
  })

  it('is null when nothing is announced', () => {
    expect(featuredTitle([], [])).toBeNull()
  })
})
