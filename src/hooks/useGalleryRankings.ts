/**
 * GET /rankings/gallery/<kind>/<id> for the PvP page's Rankings tab: one
 * event's gallery posts, counted on the server (backend views/rankings.py)
 * and rebuilt at most once an hour.
 */

import type { PvpEventRef } from "../utils/pvpEvent"
import { useRankingsPayload, type RankingsState } from "./useRankingsPayload"

export interface GalleryRankingsPayload {
	generated_at: string
	/** Visible posts counted: an uma's share is out of this. */
	posts: number
	/** Every member's deck counted: a card's share is out of this. */
	decks: number
	umas: Array<{ uma: number; teams: number; styles: Partial<Record<string, number>> }>
	cards: Array<{ card: number; decks: number; borrows: number }>
	/** The exact three-uma teams posted most (api #192; absent before). */
	trios?: Array<{ umas: number[]; teams: number }>
	/**
	 * The event's three most copied posts, without the poster's name: the post
	 * page shows that (api #192; absent before).
	 */
	copied?: Array<{ public_id: string; caption: string; copies: number; umas: number[] }>
}

export function useGalleryRankings(ref: PvpEventRef): RankingsState<GalleryRankingsPayload> {
	return useRankingsPayload<GalleryRankingsPayload>(`/rankings/gallery/${ref.kind}/${ref.id}`)
}
