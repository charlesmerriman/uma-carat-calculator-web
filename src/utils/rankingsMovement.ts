/**
 * Rank movement over the week (notes/rankings-redesign-plan.md step 5): each
 * Rankings payload carries `previous`, its lists as they stood at the start
 * of the week (the server's RankingsSnapshot), and this turns two orders into
 * what each row's chip says. Pure.
 *
 *   a number   places climbed (2 = "▲2"), negative for a fall ("▼1")
 *   "new"      in today's list, not in the week's start
 *   absent     no change, or nothing to compare with (no `previous` yet)
 *
 * Guides send their old ROWS rather than an order, so the page counts them
 * with the filters on screen (utils/guideRankings.ts) and passes the order
 * here like any other list.
 */

import type { MovementValue } from "../components/rankings/kit/Movement"

export function movement<K>(current: readonly K[], previous: readonly K[] | null | undefined): Map<K, MovementValue> {
	const moves = new Map<K, MovementValue>()
	if (!previous) return moves
	const before = new Map(previous.map((id, index) => [id, index]))
	current.forEach((id, index) => {
		const was = before.get(id)
		if (was === undefined) moves.set(id, "new")
		else if (was !== index) moves.set(id, was - index)
	})
	return moves
}

/** How many of the first `top` rows moved (new ones included): the window's "3 moved this week". */
export function movedInTop<K>(current: readonly K[], moves: ReadonlyMap<K, MovementValue>, top = 10): number {
	return current.slice(0, top).filter((id) => moves.has(id)).length
}
