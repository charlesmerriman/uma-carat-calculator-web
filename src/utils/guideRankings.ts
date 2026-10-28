/**
 * The Rankings page's Guide rankings counting (notes/rankings-page-plan.md):
 * how often the PvP guides use each support card and uma, the source Google
 * Sheet's "Number of Times Each Card Appears in the PvP Recommendations"
 * table brought over with its filters one to one (Henry, 2026-10-27), plus
 * our event window. Pure, so the rules live here and nowhere else; the
 * server (GET /rankings/guides) sends rows and decides nothing.
 *
 * THE RULES
 *   - Which guides: the event window first (every guide, or the next N
 *     events with a guide from a picked one), then the sheet's tick boxes:
 *     CM / LoH, and scenario ("Not set" for a guide without one). Every box
 *     starts ticked.
 *   - Within a guide: strategy (running style) and deck tier (Beginner,
 *     Standard, Whale, Honorable Mentions, other one-off decks) pick the
 *     decks; card type picks the cards.
 *   - Score = times used (the sheet's "# of Use"). A card counts once per
 *     deck it is in, as the main pick or as the borrowed card (owner:
 *     borrows count, shown as "N borrowed"). An "or X" alternative never
 *     counts. An uma counts once per guide and style that recommends her,
 *     whatever her stars (owner, 2026-10-27: "times recommended", not summed
 *     stars).
 *   - Shares: a card's decks over every deck counted (any card type: "in 31%
 *     of decks"), an uma's picks over every guide-and-style counted.
 *   - Ties: more events first, then first seen (stable).
 */

import type { RaceEvent } from "../types"
import type { PvpStyle } from "../types/pvpGuide"
import type { GuideRankingsPayload, RankingGuide, RankingRole, RankingTier } from "../types/guideRankings"
import { refForRaceEvent, sameEvent, type PvpEventKind } from "./pvpEvent"

export const RANKING_TIERS: readonly RankingTier[] = ["beginner", "standard", "whale", "honorable", "other"]
/** The event window's sizes after "All guides". */
export const WINDOW_SIZES = [3, 5, 10] as const

/** The scenario tick box for a guide whose editor set none. */
export const NO_SCENARIO = null

export interface GuideFilters {
	kinds: ReadonlySet<PvpEventKind>
	/** Scenario ids, and NO_SCENARIO for "Not set". */
	scenarios: ReadonlySet<number | null>
	styles: ReadonlySet<PvpStyle>
	tiers: ReadonlySet<RankingTier>
	/** Catalogue card types ("speed", "friend", ...). Cards only. */
	cardTypes: ReadonlySet<string>
}

/** Every guide, or the next `size` events with a guide counted from `from` (included). */
export type EventWindow = { size: null } | { size: number; from: RaceEvent }

/** A guide paired with its event. */
export interface CountedGuide {
	event: RaceEvent
	guide: RankingGuide
}

/** Where a card or uma was counted: one row per deck (card) or per style (uma). */
export interface RankingAppearance {
	event: RaceEvent
	style: PvpStyle
	/** The deck's tier for a card; null for an uma. */
	tier: RankingTier | null
	role: RankingRole | null
}

export interface CardRank {
	card: number
	/** Decks it is the main pick or the borrowed card in. */
	decks: number
	/** Of those, how many as the borrowed card. */
	borrows: number
	/** Decks that name it only as an "or X" alternative. Not counted. */
	alternatives: number
	/** decks / every deck counted, 0 to 1. */
	share: number
	events: RaceEvent[]
	appearances: RankingAppearance[]
}

export interface UmaRank {
	uma: number
	/** Guides and styles that recommend her. */
	picks: number
	/** picks / every guide-and-style counted, 0 to 1. */
	share: number
	events: RaceEvent[]
	appearances: RankingAppearance[]
}

/** Every box ticked: what the page starts with. */
export function allFilters(payload: GuideRankingsPayload, styles: readonly PvpStyle[], cardTypes: readonly string[]): GuideFilters {
	return {
		kinds: new Set<PvpEventKind>(["cm", "loh"]),
		scenarios: new Set<number | null>([...payload.scenarios.map((scenario) => scenario.id), NO_SCENARIO]),
		styles: new Set(styles),
		tiers: new Set(RANKING_TIERS),
		cardTypes: new Set(cardTypes),
	}
}

/** Whether any guide has no scenario, so "Not set" is worth a box. */
export function hasUnsetScenario(payload: GuideRankingsPayload): boolean {
	return payload.guides.some((guide) => guide.scenario === NO_SCENARIO)
}

/** The events that have a guide, in `events`' (date) order: what the window's picker offers. */
export function eventsWithGuide(events: RaceEvent[], payload: GuideRankingsPayload): RaceEvent[] {
	return events.filter((event) => payload.guides.some((guide) => guideIsFor(guide, event)))
}

function guideIsFor(guide: RankingGuide, event: RaceEvent): boolean {
	return sameEvent({ kind: guide.kind, id: guide.event }, refForRaceEvent(event))
}

/**
 * The guides counted, in event order: those that pass the event-level boxes
 * (CM / LoH, scenario), cut to the window. The window counts events that
 * pass, so "Next 5" with LoH unticked is the next five CMs. A guide whose
 * event the calendar doesn't list (no dates yet) can't be placed, so it is
 * left out.
 */
export function countedGuides(
	events: RaceEvent[],
	payload: GuideRankingsPayload,
	filters: Pick<GuideFilters, "kinds" | "scenarios">,
	window: EventWindow
): CountedGuide[] {
	const start = window.size === null ? 0 : events.indexOf(window.from)
	if (start === -1) return []
	const counted = events.slice(start).flatMap((event) => {
		const guide = payload.guides.find((candidate) => guideIsFor(candidate, event))
		if (!guide || !filters.kinds.has(guide.kind) || !filters.scenarios.has(guide.scenario)) return []
		return [{ event, guide }]
	})
	return window.size === null ? counted : counted.slice(0, window.size)
}

/** The decks counted: those whose style and tier pass, whatever their cards. A card's share is out of this. */
export function countedDecks(guides: CountedGuide[], filters: Pick<GuideFilters, "styles" | "tiers">): number {
	const decks = new Set<number>()
	for (const { guide } of guides) {
		for (const row of guide.cards) {
			if (filters.styles.has(row.style) && filters.tiers.has(row.tier)) decks.add(row.deck)
		}
	}
	return decks.size
}

/**
 * Support cards, most decks first. `typeOf` is the catalogue's card type,
 * undefined for a card it doesn't list (dropped).
 */
export function rankCards(
	guides: CountedGuide[],
	filters: Pick<GuideFilters, "styles" | "tiers" | "cardTypes">,
	typeOf: (card: number) => string | null | undefined
): CardRank[] {
	const ranks = new Map<number, CardRank>()
	for (const { event, guide } of guides) {
		for (const row of guide.cards) {
			if (!filters.styles.has(row.style) || !filters.tiers.has(row.tier)) continue
			const type = typeOf(row.card)
			if (type === undefined || type === null || !filters.cardTypes.has(type)) continue
			let rank = ranks.get(row.card)
			if (!rank) {
				rank = { card: row.card, decks: 0, borrows: 0, alternatives: 0, share: 0, events: [], appearances: [] }
				ranks.set(row.card, rank)
			}
			if (row.role === "alt") rank.alternatives += 1
			else {
				rank.decks += 1
				if (row.role === "borrow") rank.borrows += 1
				if (!rank.events.includes(event)) rank.events.push(event)
			}
			rank.appearances.push({ event, style: row.style, tier: row.tier, role: row.role })
		}
	}
	// An alternative alone doesn't put a card on the list.
	const decks = countedDecks(guides, filters)
	return [...ranks.values()]
		.filter((rank) => rank.decks > 0)
		.map((rank) => ({ ...rank, share: rank.decks / decks }))
		.sort((a, b) => b.decks - a.decks || b.events.length - a.events.length)
}

/** Umas, most picks first. `known` drops one the catalogue doesn't list. */
export function rankUmas(
	guides: CountedGuide[],
	filters: Pick<GuideFilters, "styles">,
	known: (uma: number) => boolean = () => true
): UmaRank[] {
	const ranks = new Map<number, UmaRank>()
	// "guide index:style", each a list of recommended umas: the share's denominator.
	const sections = new Set<string>()
	guides.forEach(({ event, guide }, index) => {
		for (const row of guide.umas) {
			if (!filters.styles.has(row.style)) continue
			sections.add(`${index}:${row.style}`)
			if (!known(row.uma)) continue
			let rank = ranks.get(row.uma)
			if (!rank) {
				rank = { uma: row.uma, picks: 0, share: 0, events: [], appearances: [] }
				ranks.set(row.uma, rank)
			}
			rank.picks += 1
			if (!rank.events.includes(event)) rank.events.push(event)
			rank.appearances.push({ event, style: row.style, tier: null, role: null })
		}
	})
	return [...ranks.values()]
		.map((rank) => ({ ...rank, share: rank.picks / sections.size }))
		.sort((a, b) => b.picks - a.picks || b.events.length - a.events.length)
}

/**
 * How a pick's count splits by event, style or tier, as [key, count] in the
 * order first seen, alternatives left out like the count. What an opened row
 * shows in place of every deck listed (owner, 2026-10-27: "how many times,
 * not every single one").
 */
export function breakdown<K>(appearances: RankingAppearance[], keyOf: (appearance: RankingAppearance) => K): Array<[K, number]> {
	const totals = new Map<K, number>()
	for (const appearance of appearances) {
		if (appearance.role === "alt") continue
		const key = keyOf(appearance)
		totals.set(key, (totals.get(key) ?? 0) + 1)
	}
	return [...totals.entries()]
}

/**
 * A pick's use across the last `size` counted events, oldest first: what an
 * opened row's sparkline draws. `events` is the counted guides' events in
 * event order (countedGuides), so the window and the tick boxes apply; an
 * event where the pick isn't used is a 0, never skipped. A card counts its
 * decks there (alternatives out, like the count); an uma her picks.
 */
export function usageByEvent(appearances: RankingAppearance[], events: RaceEvent[], size: number): number[] {
	const last = events.slice(-size)
	return last.map((event) => appearances.filter((appearance) => appearance.event === event && appearance.role !== "alt").length)
}

/** "29%": a share for the tables, whole percent, "<1%" rather than a misleading 0. */
export function formatShare(share: number): string {
	if (share > 0 && share < 0.005) return "<1%"
	return `${Math.round(share * 100)}%`
}
