/**
 * The guide for one PvP event, fetched on demand.
 *
 * States, the OshiPicker shape:
 *   idle     no event selected
 *   loading  the request is out
 *   ready    a guide came back (a draft only reaches staff)
 *   none     404: no guide, or a draft the caller may not see
 *   error    anything else (network, 5xx)
 *
 * Results are kept in a module-level Map for the life of the tab, so Previous
 * / Next back to an event already seen is instant and costs no request. A
 * failed request is NOT cached, so moving away and back retries it.
 */

import { useEffect, useState } from "react"
import { pvpGuideFetch } from "../services/pvpGuideFetchCalls"
import { formatPvpEvent, type PvpEventRef } from "../utils/pvpEvent"
import type { PvpGuide } from "../types/pvpGuide"

export type PvpGuideState =
	| { status: "idle" }
	| { status: "loading" }
	| { status: "ready"; guide: PvpGuide }
	| { status: "none" }
	| { status: "error" }

type Settled = Extract<PvpGuideState, { status: "ready" } | { status: "none" }>

const cache = new Map<string, Settled>()

/** Test hook: forget every cached guide. */
export function clearPvpGuideCache(): void {
	cache.clear()
}

export function usePvpGuide(ref: PvpEventRef | null): PvpGuideState {
	const key = ref ? formatPvpEvent(ref) : null
	// The fetched result, tagged with the key it belongs to, so a result for
	// the previous event is never shown under the next one's header.
	const [fetched, setFetched] = useState<{ key: string; state: PvpGuideState } | null>(null)

	useEffect(() => {
		if (!ref || !key || cache.has(key)) return
		const controller = new AbortController()
		pvpGuideFetch(ref, controller.signal)
			.then(async (response) => {
				if (response.status === 404) {
					const state: Settled = { status: "none" }
					cache.set(key, state)
					setFetched({ key, state })
					return
				}
				if (!response.ok) throw new Error(`GET /pvp-guides failed: ${response.status}`)
				const state: Settled = { status: "ready", guide: (await response.json()) as PvpGuide }
				cache.set(key, state)
				setFetched({ key, state })
			})
			.catch((error: unknown) => {
				if (controller.signal.aborted) return
				console.error(error)
				setFetched({ key, state: { status: "error" } })
			})
		return () => controller.abort()
		// `ref` is fully described by `key`.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key])

	if (!key) return { status: "idle" }
	const cached = cache.get(key)
	if (cached) return cached
	if (fetched?.key === key) return fetched.state
	return { status: "loading" }
}
