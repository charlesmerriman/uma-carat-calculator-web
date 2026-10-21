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

// Every mounted hook, told when the editor writes into the cache below, so
// Recommendations shows a guide the moment its editor saves it (or forgets
// one that was deleted) without a reload. A listener gets the key that moved.
const listeners = new Set<(key: string) => void>()

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

/**
 * Put a guide the editor just saved into the cache, so every reader of this
 * event (the Recommendations view, the team builder's stars) draws it at
 * once. The editor's save answers with the public route's shape for this.
 */
export function primePvpGuide(ref: PvpEventRef, guide: PvpGuide): void {
	const key = formatPvpEvent(ref)
	cache.set(key, { status: "ready", guide })
	for (const listener of listeners) listener(key)
}

/** Forget one event's guide (deleted, or published, so the next read refetches). */
export function forgetPvpGuide(ref: PvpEventRef): void {
	const key = formatPvpEvent(ref)
	cache.delete(key)
	for (const listener of listeners) listener(key)
}

export function usePvpGuide(ref: PvpEventRef | null): PvpGuideState {
	const key = ref ? formatPvpEvent(ref) : null
	// The fetched result, tagged with the key it belongs to, so a result for
	// the previous event is never shown under the next one's header.
	const [fetched, setFetched] = useState<{ key: string; state: PvpGuideState } | null>(null)
	// Bumped when the editor primes or forgets this key, so the render below
	// reads the cache again and the effect refetches a forgotten one.
	const [generation, setGeneration] = useState(0)

	useEffect(() => {
		const onChange = (changed: string) => {
			if (changed !== key) return
			setFetched(null)
			setGeneration((current) => current + 1)
		}
		listeners.add(onChange)
		return () => {
			listeners.delete(onChange)
		}
	}, [key])

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
		// `ref` is fully described by `key`; `generation` re-runs it after a forget.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key, generation])

	if (!key) return { status: "idle" }
	const cached = cache.get(key)
	if (cached) return cached
	if (fetched?.key === key) return fetched.state
	return { status: "loading" }
}
