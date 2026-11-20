/**
 * How many umas, support cards and skills the Encyclopedia holds, for the
 * three tabs' headline numbers (the redesign: "270 Umas, 563 Support cards,
 * 2,223 Skills").
 *
 * No list fetches another list's data just to count it: the uma and card
 * lists already hold the catalogue and the Skills page holds the skill list,
 * so each says what it has when it has it, and a tab shows its number once
 * some page this session has known it. A tab with no number yet shows its
 * name alone. Kept in a module-level store (useSyncExternalStore), like the
 * theme and the Rankings pin, so the tabs re-render when a number arrives.
 */

import { useSyncExternalStore } from "react"

export type EncyclopediaKind = "umas" | "cards" | "skills"
type Counts = Partial<Record<EncyclopediaKind, number>>

let counts: Counts = {}
const listeners = new Set<() => void>()

/** Say how many of some kinds exist. Call from an effect, never during render. */
export function reportCounts(next: Counts): void {
	const changed = (Object.keys(next) as EncyclopediaKind[]).some((kind) => counts[kind] !== next[kind])
	if (!changed) return
	counts = { ...counts, ...next }
	listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

const NONE: Counts = {}

/** The counts known so far this session. Empty on the server and on first paint. */
export function useEncyclopediaCounts(): Counts {
	return useSyncExternalStore(subscribe, () => counts, () => NONE)
}
