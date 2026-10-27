/**
 * The Collection's veteran list: which veterans show for a search, an uma, an
 * aptitude, and in what order. Pure, so each rule has a plain test
 * (src/__tests__/veteranList.test.ts).
 */

import { STAT_KEYS, STAT_LABELS } from "./trainedUmas"
import type { AptitudeKey } from "../types/pvpTeam"
import type { StatKey, TrainedUma } from "../types/trainedUma"

export type VeteranSort = "trained" | "score" | StatKey

export const VETERAN_SORTS: Array<{ key: VeteranSort; label: string }> = [
	{ key: "trained", label: "Newest trained" },
	{ key: "score", label: "Highest score" },
	...STAT_KEYS.map((key) => ({ key, label: STAT_LABELS[key] })),
]

/** The "A or better at" chips: a distance or a style she can run well (the game's 7, A). */
export const GOOD_AT: Array<{ key: AptitudeKey; label: string }> = [
	{ key: "short", label: "Sprint" },
	{ key: "mile", label: "Mile" },
	{ key: "medium", label: "Medium" },
	{ key: "long", label: "Long" },
	{ key: "front", label: "Front" },
	{ key: "pace", label: "Pace" },
	{ key: "late", label: "Late" },
	{ key: "end", label: "End" },
]
const A_GRADE = 7

export interface VeteranFilter {
	query: string
	/** One outfit, or null for every uma. */
	uma: number | null
	goodAt: AptitudeKey | null
	sort: VeteranSort
}

export const NO_FILTER: VeteranFilter = { query: "", uma: null, goodAt: null, sort: "trained" }

/**
 * The veterans that match, in order. `veterans` arrives newest trained first
 * (the API's order), which is the "trained" sort; every other sort is highest
 * first, a hand entry with no score last. `umaName` gives an outfit's name,
 * for the search.
 */
export function shownVeterans(veterans: TrainedUma[], filter: VeteranFilter, umaName: (uma: number) => string): TrainedUma[] {
	const words = filter.query.toLocaleLowerCase().split(/\s+/).filter(Boolean)
	const shown = veterans.filter((veteran) => {
		if (filter.uma !== null && veteran.uma !== filter.uma) return false
		if (filter.goodAt !== null && (veteran.apt[filter.goodAt] ?? 0) < A_GRADE) return false
		if (words.length === 0) return true
		const text = [umaName(veteran.uma), veteran.label, veteran.memo].join(" ").toLocaleLowerCase()
		return words.every((word) => text.includes(word))
	})
	const { sort } = filter
	if (sort === "trained") return shown
	// Array.prototype.sort is stable, so equal values keep the newest first.
	return shown.sort((a, b) =>
		sort === "score" ? (b.rank_score ?? -1) - (a.rank_score ?? -1) : b[sort] - a[sort]
	)
}

/** Every uma she has veterans of, by name, with how many: the Uma filter's choices. */
export function umaChoices(veterans: TrainedUma[], umaName: (uma: number) => string): Array<{ uma: number; name: string; count: number }> {
	const counts = new Map<number, number>()
	for (const veteran of veterans) counts.set(veteran.uma, (counts.get(veteran.uma) ?? 0) + 1)
	return [...counts]
		.map(([uma, count]) => ({ uma, name: umaName(uma), count }))
		.sort((a, b) => a.name.localeCompare(b.name))
}
