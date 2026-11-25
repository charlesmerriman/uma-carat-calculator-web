import { useSyncExternalStore } from "react"

/**
 * True below Tailwind's `sm` (40rem): a phone held upright.
 *
 * Read through useSyncExternalStore with a server snapshot of `false`, never at
 * render, so a prerendered page paints the wide layout first and a phone
 * switches right after hydration (the pattern of useCoarsePointer).
 */
const QUERY = "(max-width: 39.99rem)"

function subscribe(onChange: () => void): () => void {
	if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {}
	const query = window.matchMedia(QUERY)
	query.addEventListener?.("change", onChange)
	return () => query.removeEventListener?.("change", onChange)
}

function getSnapshot(): boolean {
	return typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches
}

const getServerSnapshot = () => false

export function useNarrowScreen(): boolean {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
