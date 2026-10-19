import { useSyncExternalStore } from "react"

/** localStorage: "1" when the phone cards fold their odds strip away. Absent means shown. */
const STORAGE_KEY = "uma-planner-phone-odds-hidden"

/**
 * Whether the planner's phone cards show their odds strip, remembered per device.
 *
 * ONE switch for every card, not one per row: someone who folds the odds away
 * wants them gone from the whole sheet, and a per-row flag would have them
 * folding every row again on each visit. So every card subscribes to the same
 * value, and folding one folds them all.
 *
 * An external store rather than useState in each card, for two reasons: the
 * cards are siblings with no shared parent state to lift into, and /app is
 * prerendered, so the stored value must not be read during render.
 * `useSyncExternalStore` reads the server snapshot (shown) for the prerender
 * and the hydration, then the stored value straight after.
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
			current = localStorage.getItem(STORAGE_KEY) === "1"
		} catch {
			// Storage blocked: the strip shows.
			current = false
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
		if (hidden) localStorage.setItem(STORAGE_KEY, "1")
		else localStorage.removeItem(STORAGE_KEY)
	} catch {
		// Not remembered past this visit; the switch itself still happens.
	}
	listeners.forEach((listener) => listener())
}

export function usePhoneOddsHidden() {
	const hidden = useSyncExternalStore(subscribe, read, () => false)
	return { hidden, toggle: () => setHidden(!hidden) }
}
