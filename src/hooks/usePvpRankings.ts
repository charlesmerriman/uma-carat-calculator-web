/**
 * GET /pvp-rankings for the Rankings view: every pick in the published
 * guides (types/pvpRankings.ts). Early access only on the server too, so a
 * 401/403 is "refused", never an error to retry.
 *
 * Fetched when the view mounts, never on /app load. Not cached across mounts:
 * a guide saved since should count the next time the view opens, and the
 * request is small and rare (early-access readers opening one view).
 */

import { useEffect, useState } from "react"
import { authHeaders } from "../services/authToken"
import type { PvpRankingsPayload } from "../types/pvpRankings"

const API_URL = import.meta.env.VITE_API_URL

export type PvpRankingsState =
	| { status: "loading" }
	| { status: "refused" }
	| { status: "error" }
	| { status: "ready"; payload: PvpRankingsPayload }

export function usePvpRankings(): PvpRankingsState {
	const [state, setState] = useState<PvpRankingsState>({ status: "loading" })

	useEffect(() => {
		let live = true
		fetch(`${API_URL}/pvp-rankings`, { method: "GET", headers: authHeaders() })
			.then(async (response) => {
				if (!live) return
				if (response.status === 401 || response.status === 403) setState({ status: "refused" })
				else if (!response.ok) setState({ status: "error" })
				else setState({ status: "ready", payload: (await response.json()) as PvpRankingsPayload })
			})
			.catch((error: unknown) => {
				console.error(error)
				if (live) setState({ status: "error" })
			})
		return () => {
			live = false
		}
	}, [])

	return state
}
