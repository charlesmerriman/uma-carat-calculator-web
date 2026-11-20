/**
 * What the signed-in player owns, for the Encyclopedia's "You own this" line
 * and "Owned" filter (notes/encyclopedia-plan.md, PR 8). The ONE place the
 * Encyclopedia reads the Collection.
 *
 * In the browser only, from the roster the Collection already loads
 * (useRoster). The Encyclopedia's API answers stay the same for everyone, so
 * they stay cacheable and hold nothing about a person. It only reads: nothing
 * here writes the Collection.
 *
 * Keyed by the row's pk (`uma`, `support_card` on a roster row), which every
 * Encyclopedia page and list sends as `id`. A guest has empty maps and
 * `signedIn: false`, so no chip and no line is drawn.
 */

import { useContext, useMemo } from "react"
import { AuthContext } from "../services/AuthContext"
import { useRoster } from "../services/rosterQueries"

export interface Owned {
	signedIn: boolean
	/** uma pk -> stars (null when the player hasn't set them). */
	umas: ReadonlyMap<number, number | null>
	/** card pk -> limit break, 0..4. */
	cards: ReadonlyMap<number, number>
	/**
	 * uma pk -> (skill GAME id -> hint level), from an imported Collection
	 * (Daptrius, board, 2026-11-17). An uma with no hints has no entry.
	 * Kept apart from `umas` so that map's stars-only shape stays as it is.
	 */
	hints: ReadonlyMap<number, ReadonlyMap<number, number>>
	/** True while there is nothing to show: a guest, or an empty Collection. */
	empty: boolean
}

export function useOwned(): Owned {
	const signedIn = Boolean(useContext(AuthContext)?.isLoggedIn)
	const roster = useRoster(signedIn)
	return useMemo(() => {
		const umas = new Map((roster.data?.umas ?? []).map((row) => [row.uma, row.stars] as const))
		const cards = new Map((roster.data?.support_cards ?? []).map((row) => [row.support_card, row.limit_break] as const))
		const hints = new Map<number, ReadonlyMap<number, number>>()
		for (const row of roster.data?.umas ?? []) {
			const entries = Object.entries(row.hint_levels ?? {})
			// The wire's keys are strings; the Encyclopedia's skills carry numeric game ids.
			if (entries.length > 0) hints.set(row.uma, new Map(entries.map(([id, level]) => [Number(id), level])))
		}
		return { signedIn, umas, cards, hints, empty: umas.size === 0 && cards.size === 0 }
	}, [signedIn, roster.data])
}
