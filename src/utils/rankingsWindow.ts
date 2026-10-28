/**
 * The pinned Rankings window's edge tab count (notes/rankings-redesign-plan.md
 * step 3): how many of the pinned list's top ten moved since the window last
 * showed it. A device memory only (rankingsPinStore `seen`), no server: an
 * entry counts when it isn't where it was, a new one included. Nothing seen
 * yet (a first pin) counts nothing. Pure.
 */

/** Entries of `current` whose place differs from their place in `seen`. */
export function movedCount(seen: readonly string[] | null, current: readonly string[]): number {
	if (seen === null) return 0
	return current.filter((id, index) => seen.indexOf(id) !== index).length
}

/**
 * The events a PvP picker offers (the tab's strip, the window's Event
 * setting): those `around` either side of `anchor` (the one running or
 * next), in date order, with `chosen` added if it falls outside.
 */
export function eventsAround<T>(events: readonly T[], anchor: T, chosen: T, around = 3): T[] {
	const at = events.indexOf(anchor)
	const near = events.slice(Math.max(0, at - around), at + around + 1)
	return near.includes(chosen) ? near : [...near, chosen].sort((a, b) => events.indexOf(a) - events.indexOf(b))
}
