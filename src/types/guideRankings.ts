/**
 * GET /rankings/guides (backend views/rankings.py): every pick in the
 * published guides, as rows, built at most once every half day.
 * utils/guideRankings.ts does the counting.
 */

import type { PvpStyle } from "./pvpGuide"
import type { PvpEventKind } from "../utils/pvpEvent"

/**
 * A deck's tier, from its label: the three every guide keeps, the honorable
 * mention deck most guides add, and "other" for one-off decks named for
 * their idea ("Xoguri pace").
 */
export type RankingTier = "beginner" | "standard" | "whale" | "honorable" | "other"

/** A slot's part in its deck: the card, the borrowed card (counted like it), or an "or X" alternative (not counted). */
export type RankingRole = "main" | "borrow" | "alt"

export interface RankingCardRow {
	card: number
	/** The deck's id: what a card's share counts decks by. */
	deck: number
	style: PvpStyle
	tier: RankingTier
	role: RankingRole
}

export interface RankingUmaRow {
	uma: number
	style: PvpStyle
	stars: number
}

export interface RankingGuide {
	kind: PvpEventKind
	/** The event's id, as in champions_meeting_data / league_of_heroes_event_data. */
	event: number
	/** The training scenario the guide's builds are for; null when the editor hasn't set one. */
	scenario: number | null
	cards: RankingCardRow[]
	umas: RankingUmaRow[]
}

export interface RankingScenario {
	id: number
	name: string
}

export interface GuideRankingsPayload {
	/** When the server built this payload (ISO 8601). It rebuilds at most once every half day. */
	generated_at: string
	/** The scenarios some guide names, in release order. */
	scenarios: RankingScenario[]
	guides: RankingGuide[]
	/**
	 * The guide rows as they stood at the start of the week (the server's
	 * RankingsSnapshot), counted with the filters on screen for rank
	 * movement. Null before a first snapshot; absent before api #193.
	 */
	previous?: { generated_at: string; guides: RankingGuide[] } | null
}
