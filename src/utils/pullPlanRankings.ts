/**
 * The Rankings page's Pull plans tab: which banners show and in what order.
 * Pure; the server (GET /rankings/pull-plans) counts.
 *
 *   - Running and upcoming banners; ended ones only behind the switch
 *     (plan: "Running + upcoming; past behind a switch").
 *   - A type filter: every type, or Uma, Support or Step-up alone.
 *   - Sorted by date (soonest start first, an undated banner last, since
 *     nobody knows when) or by planners (most first). Ties keep the server's
 *     order, which is planners then total.
 */

import type { PlannedBannerRank, PlannedBannerType } from "../types/pullPlanRankings"
import { parseApiDate } from "./dateFormat"

export type PullPlanSort = "date" | "planners"

export interface PullPlanFilters {
	/** One type, or null for all of them. */
	type: PlannedBannerType | null
	sort: PullPlanSort
	showEnded: boolean
}

function startTime(row: PlannedBannerRank): number {
	return (row.start_date && parseApiDate(row.start_date)?.getTime()) || Number.POSITIVE_INFINITY
}

export function pullPlanRows(rows: PlannedBannerRank[], filters: PullPlanFilters): PlannedBannerRank[] {
	const shown = rows.filter(
		(row) => (filters.type === null || row.type === filters.type) && (filters.showEnded || row.status !== "ended")
	)
	// Array.prototype.sort is stable, so equal keys keep the server's order.
	return filters.sort === "planners"
		? [...shown].sort((a, b) => b.planners - a.planners)
		: [...shown].sort((a, b) => startTime(a) - startTime(b))
}
