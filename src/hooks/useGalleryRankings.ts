/**
 * GET /rankings/gallery/<kind>/<id> for the PvP page's Rankings tab: one
 * event's gallery posts, counted on the server (backend views/rankings.py)
 * and rebuilt at most once an hour.
 */

import type { TeamSharesData } from "../types/rankingsTabs"
import type { PvpEventRef } from "../utils/pvpEvent"
import { useRankingsPayload, type RankingsState } from "./useRankingsPayload"

/**
 * The lists are shares (TeamSharesData), like the PvP tab's. A post is public
 * (anyone can open it, with its copies), so `posts`, `decks` and `copies`
 * stay counts.
 */
export interface GalleryRankingsPayload extends TeamSharesData {
	generated_at: string
	/** Visible posts. */
	posts: number
	/** Every member's deck in them. */
	decks: number
	/**
	 * The event's three most copied posts, without the poster's name: the post
	 * page shows that (api #192; absent before).
	 */
	copied?: Array<{ public_id: string; caption: string; copies: number; umas: number[] }>
	/** The lists at the start of the week, for rank movement (api #193). */
	previous?: { generated_at: string; umas: number[]; cards: number[] } | null
}

export function useGalleryRankings(ref: PvpEventRef): RankingsState<GalleryRankingsPayload> {
	return useRankingsPayload<GalleryRankingsPayload>(`/rankings/gallery/${ref.kind}/${ref.id}`)
}
