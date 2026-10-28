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
		? [...shown].sort((a, b) => b.planners - a.planners)
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
	/** This month's planned pulls over every planned pull, 0 to 1. */
	share: number
	pulls: number
	/** The month we're in (UTC): drawn in the running colour. */
	current: boolean
}

/**
 * "When the pulls fall due" (the redesign's month strip, mock 07-pull.png):
 * the share of planned pulls by the month a banner ends, for this month and
 * the next four, then "Later" for everything past them and anything undated.
 * A month before this one (a banner that ended, still in the payload) is left
 * out of the strip and of the total, so the six columns add up to 100%.
 * Months are UTC, like the projection.
 */
export function monthShares(demand: DemandMonth[], now: Date): MonthShare[] {
	const year = now.getUTCFullYear()
	const month = now.getUTCMonth()
	const keys = Array.from({ length: STRIP_MONTHS }, (_, index) => {
		const date = new Date(Date.UTC(year, month + index, 1))
		return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
	})
	const pulls = new Map<string, number>([...keys, "Later"].map((key) => [key, 0]))
	for (const row of demand) {
		if (pulls.has(row.month)) pulls.set(row.month, (pulls.get(row.month) ?? 0) + row.total_pulls)
		// Past the strip (a later month) goes to Later; an earlier one is gone.
		else if (row.month > keys[keys.length - 1]) pulls.set("Later", (pulls.get("Later") ?? 0) + row.total_pulls)
	}
	const total = [...pulls.values()].reduce((sum, value) => sum + value, 0)
	return [...pulls.entries()].map(([key, value]) => ({
		key,
		label: monthLabel(key),
		share: total > 0 ? value / total : 0,
		pulls: value,
		current: key === keys[0],
	}))
}

/** "604K", "2.1M": a big figure in a sub line, where the exact one is in the row. */
export function compactNumber(value: number): string {
	if (Math.abs(value) < 1000) return Math.round(value).toLocaleString()
	if (Math.abs(value) < 1_000_000) return `${Math.round(value / 1000)}K`
	return `${(value / 1_000_000).toFixed(1)}M`
}
