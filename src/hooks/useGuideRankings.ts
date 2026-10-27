/**
 * GET /rankings/guides for the Rankings page's Guide rankings tab: every
 * pick in the published guides (types/guideRankings.ts). Early access only
 * on the server too, so a 401/403 is "refused", never an error to retry.
 *
 * Fetched when the tab mounts, never on /app load. Not cached here: the
 * server builds the payload at most once an hour and keeps it, so a refetch
 * on the next visit is cheap and picks up the newer build.
 */

import { useEffect, useState } from "react"
import { authHeaders } from "../services/authToken"
import type { GuideRankingsPayload } from "../types/guideRankings"

const API_URL = import.meta.env.VITE_API_URL

export type GuideRankingsState =
	| { status: "loading" }
	| { status: "refused" }
	| { status: "error" }
	| { status: "ready"; payload: GuideRankingsPayload }

export function useGuideRankings(): GuideRankingsState {
	const [state, setState] = useState<GuideRankingsState>({ status: "loading" })

	useEffect(() => {
		let live = true
		fetch(`${API_URL}/rankings/guides`, { method: "GET", headers: authHeaders() })
			.then(async (response) => {
				if (!live) return
				if (response.status === 401 || response.status === 403) setState({ status: "refused" })
				else if (!response.ok) setState({ status: "error" })
				else setState({ status: "ready", payload: (await response.json()) as GuideRankingsPayload })
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
