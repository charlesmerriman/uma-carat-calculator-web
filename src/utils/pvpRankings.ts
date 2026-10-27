/**
 * The Rankings view's counting (board post "PvP rankings", owner's go
 * 2026-10-27): how often the guides recommend each support card and uma
 * across a run of events. Pure, so the rules live here and nowhere else; the
 * server (GET /pvp-rankings) sends rows and decides nothing.
 *
 * THE RULES
 *   - Events: the one on screen and the ones after it that have a guide, up
 *     to `eventCount` (null for all of them), optionally CM or LoH only.
 *     Starting from the event on screen, not from today, means Previous and
 *     Next on the page also look back or further ahead.
 *   - A card counts once per deck it is in, as the main pick or as the
 *     borrowed card (owner: borrows count). Each row also says how many of
 *     its decks were borrows. An "or X" alternative is never counted; it is
 *     shown as "also an alternative in N decks".
 *   - Deck tiers are counted separately and filtered: Beginner, Standard and
 *     Whale on by default, honorable mentions and one-off decks ("other")
 *     off, since "a beginner should pull this" and "a whale should pull this"
 *     are different advice.
 *   - An uma scores its stars, summed over the events (a 3-star pick is worth
 *     three 1-star ones), with the event count and best stars beside it.
 *   - Ties: more events first, then the catalogue's order (stable).
 */

import type { RaceEvent } from "../types"
import type { PvpStyle } from "../types/pvpGuide"
import type { PvpRankingsPayload, RankingGuide, RankingRole, RankingTier } from "../types/pvpRankings"
import { refForRaceEvent, sameEvent, type PvpEventKind } from "./pvpEvent"

export const DEFAULT_TIERS: ReadonlySet<RankingTier> = new Set(["beginner", "standard", "whale"])
export const EVENT_COUNTS = [3, 5, 10, null] as const
export const DEFAULT_EVENT_COUNT = 5

export interface RankingFilters {
	/** CM or LoH only; null for both. */
	kind: PvpEventKind | null
	/** One running style; null for all. */
	style: PvpStyle | null
	tiers: ReadonlySet<RankingTier>
	/** How many events to count from the one on screen; null for all of them. */
	eventCount: number | null
}

/** Where a card or uma appears: one row per deck (card) or per style (uma). */
export interface RankingAppearance {
	event: RaceEvent
	style: PvpStyle
	/** The deck's label and tier for a card; null for an uma. */
	deck: string | null
	tier: RankingTier | null
	role: RankingRole | null
	stars: number | null
}

export interface CardRank {
	card: number
	/** Decks it is the main pick or the borrowed card in. */
	decks: number
	/** Of those, how many as the borrowed card. */
	borrows: number
	/** Decks that name it only as an "or X" alternative. Not counted. */
	alternatives: number
	events: RaceEvent[]
	appearances: RankingAppearance[]
}

export interface UmaRank {
	uma: number
	/** Stars summed over every style and event it is starred in. */
	stars: number
	best: number
	events: RaceEvent[]
	appearances: RankingAppearance[]
}

/**
 * The events counted: `from` and the later ones with a guide, of the kind
 * asked for, at most `count`. `events` is in date order (raceEventsInOrder).
 * `from` itself counts only when it has a guide (and is of that kind).
 */
export function rankingEvents(
	events: RaceEvent[],
	from: RaceEvent,
	payload: PvpRankingsPayload,
	filters: Pick<RankingFilters, "kind" | "eventCount">
): RaceEvent[] {
	const start = events.indexOf(from)
	if (start === -1) return []
	const withGuide = (event: RaceEvent) => payload.guides.some((guide) => guideFor(guide, event))
	const picked = events
		.slice(start)
		.filter((event) => (filters.kind === null || refForRaceEvent(event).kind === filters.kind) && withGuide(event))
	return filters.eventCount === null ? picked : picked.slice(0, filters.eventCount)
}

function guideFor(guide: RankingGuide, event: RaceEvent): boolean {
	return sameEvent({ kind: guide.kind, id: guide.event }, refForRaceEvent(event))
}

/** Pairs each counted event with its guide, in event order. */
function guidesIn(payload: PvpRankingsPayload, events: RaceEvent[]): Array<{ event: RaceEvent; guide: RankingGuide }> {
	return events.flatMap((event) => {
		const guide = payload.guides.find((candidate) => guideFor(candidate, event))
		return guide ? [{ event, guide }] : []
	})
}

/**
 * Support cards, most decks first. `includeCard` narrows by what only the
 * catalogue knows (the card type), and drops a card it doesn't list.
 */
export function rankCards(
	payload: PvpRankingsPayload,
	events: RaceEvent[],
	filters: Pick<RankingFilters, "style" | "tiers">,
	includeCard: (card: number) => boolean = () => true
): CardRank[] {
	const ranks = new Map<number, CardRank>()
	for (const { event, guide } of guidesIn(payload, events)) {
		for (const row of guide.cards) {
			if (filters.style !== null && row.style !== filters.style) continue
			if (!filters.tiers.has(row.tier)) continue
			if (!includeCard(row.card)) continue
			let rank = ranks.get(row.card)
			if (!rank) {
				rank = { card: row.card, decks: 0, borrows: 0, alternatives: 0, events: [], appearances: [] }
				ranks.set(row.card, rank)
			}
			if (row.role === "alt") rank.alternatives += 1
			else {
				rank.decks += 1
				if (row.role === "borrow") rank.borrows += 1
				if (!rank.events.includes(event)) rank.events.push(event)
			}
			rank.appearances.push({ event, style: row.style, deck: row.deck, tier: row.tier, role: row.role, stars: null })
		}
	}
	// An alternative alone doesn't put a card on the list.
	return [...ranks.values()]
		.filter((rank) => rank.decks > 0)
		.sort((a, b) => b.decks - a.decks || b.events.length - a.events.length)
}

/** Umas, most stars first. `includeUma` drops one the catalogue doesn't list. */
export function rankUmas(
	payload: PvpRankingsPayload,
	events: RaceEvent[],
	filters: Pick<RankingFilters, "style">,
	includeUma: (uma: number) => boolean = () => true
): UmaRank[] {
	const ranks = new Map<number, UmaRank>()
	for (const { event, guide } of guidesIn(payload, events)) {
		for (const row of guide.umas) {
			if (filters.style !== null && row.style !== filters.style) continue
			if (!includeUma(row.uma)) continue
			let rank = ranks.get(row.uma)
			if (!rank) {
				rank = { uma: row.uma, stars: 0, best: 0, events: [], appearances: [] }
				ranks.set(row.uma, rank)
			}
			rank.stars += row.stars
			rank.best = Math.max(rank.best, row.stars)
			if (!rank.events.includes(event)) rank.events.push(event)
			rank.appearances.push({ event, style: row.style, deck: null, tier: null, role: null, stars: row.stars })
		}
	}
	return [...ranks.values()].sort((a, b) => b.stars - a.stars || b.events.length - a.events.length)
}

/**
 * How a pick's count splits by event, style or tier, as [key, amount] in the
 * order first seen: decks for a card (alternatives left out, like the count),
 * stars for an uma. What an opened row shows in place of every deck listed
 * (owner, 2026-10-27: "how many times, not every single one").
 */
export function breakdown<K>(appearances: RankingAppearance[], keyOf: (appearance: RankingAppearance) => K): Array<[K, number]> {
	const totals = new Map<K, number>()
	for (const appearance of appearances) {
		const amount = appearance.stars ?? (appearance.role === "alt" ? 0 : 1)
		if (amount === 0) continue
		const key = keyOf(appearance)
		totals.set(key, (totals.get(key) ?? 0) + amount)
	}
	return [...totals.entries()]
}
