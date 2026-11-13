/**
 * A list filter that the tab remembers (Daptrius, board "Encyclopedia Filter
 * Memory", 2026-11-13: "if you are thumbing through different SSR Wit cards
 * only on Global, it resets whenever the page is changed").
 *
 * WHY sessionStorage, not the address bar: a player leaves a list by a tile,
 * then comes back by the Back button, the Encyclopedia's tabs or a page's
 * breadcrumb. Only the Back button would restore filters kept in the URL.
 * sessionStorage is the tab's: every way back finds the same filters, and a
 * new tab (or a visit tomorrow) starts clean, which is what a filter should do.
 *
 * WHY an external store (useSyncExternalStore), as services/rankingsPinStore.ts
 * does: /app is prerendered and a render that reads storage throws in Node
 * (frontend-ui.md). The server snapshot is "nothing remembered", so the first
 * render uses the default and the remembered value lands right after.
 *
 * A stored value that is no longer one of `allowed` (a chip renamed or
 * removed since it was saved) reads as the default, never as a filter that
 * matches nothing.
 */

import { useCallback, useSyncExternalStore } from "react"

const PREFIX = "enc-filter:"

// Every hook instance listens here; a write tells them all, so two lists on one
// screen (none today) would still agree.
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

// Storage can throw (a private window, blocked site data), so both sides are
// wrapped: a failure only means the filter isn't remembered.
function read(key: string): string | null {
	try {
		return sessionStorage.getItem(PREFIX + key)
	} catch {
		return null
	}
}

function write(key: string, value: string, fallback: string): void {
	try {
		// The default isn't stored, so "All" leaves nothing behind.
		if (value === fallback) sessionStorage.removeItem(PREFIX + key)
		else sessionStorage.setItem(PREFIX + key, value)
	} catch {
		// Not remembered this time; the filter still works.
	}
	listeners.forEach((listener) => listener())
}

const serverSnapshot = () => null

/** Tests only (test/setup.ts, after each): forget every remembered filter, so one test's chips don't leak into the next. */
export function forgetRememberedFilters(): void {
	try {
		for (const key of Object.keys(sessionStorage)) if (key.startsWith(PREFIX)) sessionStorage.removeItem(key)
	} catch {
		// No storage in this environment (a Node test): nothing to forget.
	}
}

/**
 * `[value, setValue]` like useState, remembered for the tab under `key`
 * ("cards:type"). `allowed` lists the values a chip filter may hold; leave it
 * out for free text (the search box).
 */
export function useRememberedFilter<T extends string>(
	key: string,
	fallback: T,
	allowed?: readonly T[]
): [T, (value: T) => void] {
	const stored = useSyncExternalStore(subscribe, () => read(key), serverSnapshot)
	const value = stored !== null && (!allowed || allowed.includes(stored as T)) ? (stored as T) : fallback
	const setValue = useCallback((next: T) => write(key, next, fallback), [key, fallback])
	return [value, setValue]
}
