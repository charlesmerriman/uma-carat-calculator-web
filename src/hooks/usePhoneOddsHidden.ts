import { useSyncExternalStore } from "react"

/**
 * localStorage: "0" when the phone cards show their odds strip. Absent (or the
 * "1" the first version wrote) means folded: folded is the default, so only the
 * choice to show them needs remembering.
 */
const STORAGE_KEY = "uma-planner-phone-odds-hidden"

/**
 * Whether the planner's phone cards show their odds strip, remembered per device.
 * Folded by default: on a phone the strip is most of a card's height, and the
 * card's own numbers are what most people scroll the sheet for.
 *
 * ONE switch for every card, not one per row: someone who folds the odds away
 * wants them gone from the whole sheet, and a per-row flag would have them
 * folding every row again on each visit. So every card subscribes to the same
 * value, and folding one folds them all.
 *
 * An external store rather than useState in each card, for two reasons: the
 * cards are siblings with no shared parent state to lift into, and /app is
 * prerendered, so the stored value must not be read during render.
 * `useSyncExternalStore` reads the server snapshot (folded, the default) for
 * the prerender and the hydration, then the stored value straight after, so
 * only someone who chose to show the odds sees the cards change on load.
 *
 * The desktop table never reads this: its odds sit in a fixed track of a
 * fixed-height row, where folding them would save nothing.
 */
const listeners = new Set<() => void>()

// The value this visit, once known. Kept here as well as in storage so the
// switch still works for the visit when storage is blocked.
let current: boolean | null = null

function read(): boolean {
	if (current === null) {
		try {
			current = localStorage.getItem(STORAGE_KEY) !== "0"
		} catch {
			// Storage blocked: the default, folded.
			current = true
		}
	}
	return current
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

function setHidden(hidden: boolean): void {
	current = hidden
	try {
		if (hidden) localStorage.removeItem(STORAGE_KEY)
		else localStorage.setItem(STORAGE_KEY, "0")
	} catch {
		// Not remembered past this visit; the switch itself still happens.
	}
	listeners.forEach((listener) => listener())
}

export function usePhoneOddsHidden() {
	const hidden = useSyncExternalStore(subscribe, read, () => true)
	return { hidden, toggle: () => setHidden(!hidden) }
}
