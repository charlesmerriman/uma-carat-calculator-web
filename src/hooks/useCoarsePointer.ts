import { useSyncExternalStore } from "react"

/**
 * True on a touch screen (a coarse primary pointer: phones, tablets), where a
 * plain list reads better as the platform's own picker than as react-select's
 * menu: no keyboard, no zoom, no menu pinned over a scrolling page.
 *
 * Read through useSyncExternalStore with a server snapshot of `false`, never at
 * render: the page is prerendered, so the first paint is always the desktop
 * control and a phone swaps to its picker right after hydration.
 */
const QUERY = "(pointer: coarse)"

function subscribe(onChange: () => void): () => void {
	if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {}
	const query = window.matchMedia(QUERY)
	query.addEventListener("change", onChange)
	return () => query.removeEventListener("change", onChange)
}

function getSnapshot(): boolean {
	return typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches
}

const getServerSnapshot = () => false

export function useCoarsePointer(): boolean {
	return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
