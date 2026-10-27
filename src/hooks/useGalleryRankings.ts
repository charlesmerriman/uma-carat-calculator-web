/**
 * GET /rankings/gallery/<kind>/<id> for the PvP page's Rankings tab: one
 * event's gallery posts, counted on the server (backend views/rankings.py)
 * and rebuilt at most once an hour. Early access only on the server too, so
 * a 401/403 is "refused", never an error to retry.
 */

import { useEffect, useState } from "react"
import { authHeaders } from "../services/authToken"
import type { PvpEventRef } from "../utils/pvpEvent"

const API_URL = import.meta.env.VITE_API_URL

export interface GalleryRankingsPayload {
	generated_at: string
	/** Visible posts counted: an uma's share is out of this. */
	posts: number
	/** Every member's deck counted: a card's share is out of this. */
	decks: number
	umas: Array<{ uma: number; teams: number; styles: Partial<Record<string, number>> }>
	cards: Array<{ card: number; decks: number; borrows: number }>
}

export type GalleryRankingsState =
	| { status: "loading" }
	| { status: "refused" }
	| { status: "error" }
	| { status: "ready"; payload: GalleryRankingsPayload }

export function useGalleryRankings(ref: PvpEventRef): GalleryRankingsState {
	// Keyed by the event, so a new one shows loading rather than the last one's counts.
	const key = `${ref.kind}/${ref.id}`
	const [state, setState] = useState<{ key: string; value: GalleryRankingsState }>({ key, value: { status: "loading" } })

	useEffect(() => {
		let live = true
		const done = (value: GalleryRankingsState) => {
			if (live) setState({ key, value })
		}
		fetch(`${API_URL}/rankings/gallery/${key}`, { method: "GET", headers: authHeaders() })
			.then(async (response) => {
				if (response.status === 401 || response.status === 403) done({ status: "refused" })
				else if (!response.ok) done({ status: "error" })
				else done({ status: "ready", payload: (await response.json()) as GalleryRankingsPayload })
			})
			.catch((error: unknown) => {
				console.error(error)
				done({ status: "error" })
			})
		return () => {
			live = false
		}
	}, [key])

	return state.key === key ? state.value : { status: "loading" }
}
