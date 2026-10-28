/**
 * One GET /rankings/* payload (backend views/rankings.py), for a Rankings
 * tab or the PvP page's Rankings view. Every route there is early access
 * only on the server, so a 401/403 is "refused", never an error to retry.
 *
 * Fetched when the tab mounts, never on /app load, and not cached here: the
 * server builds each payload at most once every half day and keeps it, so a refetch
 * on the next visit is cheap and picks up the newer build. A new `path` (the
 * PvP page's next event) shows loading, never the last path's numbers.
 */

import { useEffect, useState } from "react"
import { authHeaders } from "../services/authToken"

const API_URL = import.meta.env.VITE_API_URL

export type RankingsState<T> =
	| { status: "loading" }
	| { status: "refused" }
	| { status: "error" }
	| { status: "ready"; payload: T }

/** `path` after the API root, e.g. "/rankings/guides". */
export function useRankingsPayload<T>(path: string): RankingsState<T> {
	const [state, setState] = useState<{ path: string; value: RankingsState<T> }>({ path, value: { status: "loading" } })

	useEffect(() => {
		let live = true
		const done = (value: RankingsState<T>) => {
			if (live) setState({ path, value })
		}
		fetch(`${API_URL}${path}`, { method: "GET", headers: authHeaders() })
			.then(async (response) => {
				if (response.status === 401 || response.status === 403) done({ status: "refused" })
				else if (!response.ok) done({ status: "error" })
				else done({ status: "ready", payload: (await response.json()) as T })
			})
			.catch((error: unknown) => {
				console.error(error)
				done({ status: "error" })
			})
		return () => {
			live = false
		}
	}, [path])

	return state.path === path ? state.value : { status: "loading" }
}
