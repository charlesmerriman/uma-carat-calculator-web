/**
 * GET /pvp-rankings (backend views/pvp_rankings.py): every pick in the
 * published guides, as rows. utils/pvpRankings.ts does the counting.
 */

import type { PvpStyle } from "./pvpGuide"
import type { PvpEventKind } from "../utils/pvpEvent"

/** A deck's tier, from its label: the three every guide keeps, else "other" (honorable mentions, one-offs). */
export type RankingTier = "beginner" | "standard" | "whale" | "other"

/** A slot's part in its deck: the card, the borrowed card (counted like it), or an "or X" alternative (not counted). */
export type RankingRole = "main" | "borrow" | "alt"

export interface RankingCardRow {
	card: number
	style: PvpStyle
	/** The deck's label as the guide wrote it ("Whale", "Honorable mention"). */
	deck: string
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
	cards: RankingCardRow[]
	umas: RankingUmaRow[]
}

export interface PvpRankingsPayload {
	guides: RankingGuide[]
}
