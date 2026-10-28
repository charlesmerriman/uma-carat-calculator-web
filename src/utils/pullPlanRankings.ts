/**
 * The Rankings page's Pull plans tab: which banners show and in what order.
 * Pure; the server (GET /rankings/pull-plans) counts and sends shares.
 *
 *   - Running and upcoming banners; ended ones only behind the switch
 *     (plan: "Running + upcoming; past behind a switch").
 *   - A type filter: every type, or Uma, Support or Step-up alone.
 *   - Sorted by date (soonest start first, an undated banner last, since
 *     nobody knows when) or by planners (the biggest share first). Ties keep
 *     the server's order, which is planners then total.
 */

import type { DemandMonth, PlannedBannerRank, PlannedBannerType } from "../types/pullPlanRankings"
import { formatMonth, parseApiDate } from "./dateFormat"

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
		? [...shown].sort((a, b) => b.share - a.share)
		: [...shown].sort((a, b) => startTime(a) - startTime(b))
}

/** "2026-11" as the site writes a month ("2026/11"); "Later" stays "Later". */
export function monthLabel(month: string): string {
	const date = new Date(`${month}-01T00:00:00Z`)
	return Number.isNaN(date.getTime()) ? month : formatMonth(date)
}

/** How many months the strip shows before "Later". */
export const STRIP_MONTHS = 5

export interface MonthShare {
	/** "2026-11", or "Later". */
	key: string
	label: string
	/** This month's planned pulls over every planned pull on the strip, 0 to 1. */
	share: number
	/** The month we're in (UTC): drawn in the running colour. */
	current: boolean
}

/**
 * "When the pulls fall due" (the redesign's month strip, mock 07-pull.png):
 * the share of planned pulls by the month a banner ends, for this month and
 * the next four, then "Later" for everything past them and anything undated.
 * A month before this one (a banner that ended, still in the payload) is left
 * out of the strip, and the rest are scaled so the six columns add up to
 * 100%. The server's shares are of every month it sent.
 * Months are UTC, like the projection.
 */
export function monthShares(demand: DemandMonth[], now: Date): MonthShare[] {
	const year = now.getUTCFullYear()
	const month = now.getUTCMonth()
	const keys = Array.from({ length: STRIP_MONTHS }, (_, index) => {
		const date = new Date(Date.UTC(year, month + index, 1))
		return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
	})
	const shares = new Map<string, number>([...keys, "Later"].map((key) => [key, 0]))
	for (const row of demand) {
		if (shares.has(row.month)) shares.set(row.month, (shares.get(row.month) ?? 0) + row.share)
		// Past the strip (a later month) goes to Later; an earlier one is gone.
		else if (row.month > keys[keys.length - 1]) shares.set("Later", (shares.get("Later") ?? 0) + row.share)
	}
	const total = [...shares.values()].reduce((sum, value) => sum + value, 0)
	return [...shares.entries()].map(([key, value]) => ({
		key,
		label: monthLabel(key),
		share: total > 0 ? value / total : 0,
		current: key === keys[0],
	}))
}

/**
 * A spread bucket's label from its edges (GET /rankings/pull-plans `spread`):
 * the first "under 50", the last "300+", the rest "50 to 99", or "3" for a
 * bucket one wide (a step-up's).
 */
export function spreadLabel(edges: number[], index: number): string {
	if (index === edges.length - 1) return `${edges[index]}+`
	if (index === 0) return `under ${edges[1]}`
	const low = edges[index]
	const high = edges[index + 1] - 1
	return low === high ? String(low) : `${low} to ${high}`
}
