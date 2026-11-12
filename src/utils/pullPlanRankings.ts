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

/**
 * "When the pulls fall due" (the redesign's month strip, mock 07-pull.png):
 * this month and the next five one by one, then four quarters (three months
 * each, rolling on from there), then "Later" for everything past them and
 * anything undated. Owner, 2026-11-12: with five months and Later, 82% of the
 * pulls sat in Later, because players plan a year ahead.
 */
const STRIP_MONTHS = 6
const STRIP_QUARTERS = 4
const MONTHS_PER_QUARTER = 3

export interface StripColumn {
	/** "2026-11", "2027-05" (a quarter, by its first month), or "Later". */
	key: string
	kind: "month" | "quarter" | "later"
	/** "2026/11", "2027/5 to 2027/7", or "Later". */
	label: string
	/** This column's planned pulls over every planned pull on the strip, 0 to 1. */
	share: number
	/** The month we're in (UTC): drawn in the running colour. */
	current: boolean
}

function monthKey(year: number, month: number): string {
	const date = new Date(Date.UTC(year, month, 1))
	return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

/**
 * The strip's columns from the server's per-month shares (GET
 * /rankings/pull-plans `demand`, eighteen months then Later). A month before
 * this one (a banner that ended, still in the payload) is left out, and the
 * rest are scaled so the columns add up to 100%. Months are UTC, like the
 * projection.
 */
export function stripColumns(demand: DemandMonth[], now: Date): StripColumn[] {
	const year = now.getUTCFullYear()
	const month = now.getUTCMonth()
	const total = STRIP_MONTHS + STRIP_QUARTERS * MONTHS_PER_QUARTER
	// Month offset 0..17 -> its column: 0..5 the months, then the quarters.
	const columnOf = new Map<string, number>()
	for (let offset = 0; offset < total; offset++) {
		const column = offset < STRIP_MONTHS ? offset : STRIP_MONTHS + Math.floor((offset - STRIP_MONTHS) / MONTHS_PER_QUARTER)
		columnOf.set(monthKey(year, month + offset), column)
	}
	const later = STRIP_MONTHS + STRIP_QUARTERS
	const lastKey = monthKey(year, month + total - 1)
	const shares = Array.from({ length: later + 1 }, () => 0)
	for (const row of demand) {
		const column = columnOf.get(row.month)
		if (column !== undefined) shares[column] += row.share
		// Past the strip (a later month, or the server's own "Later") goes to
		// Later; an earlier month is a banner that ended, so it's gone.
		else if (row.month === "Later" || row.month > lastKey) shares[later] += row.share
	}
	const sum = shares.reduce((acc, value) => acc + value, 0)
	return shares.map((value, column) => {
		const share = sum > 0 ? value / sum : 0
		if (column === later) return { key: "Later", kind: "later", label: "Later", share, current: false }
		if (column < STRIP_MONTHS) {
			const key = monthKey(year, month + column)
			return { key, kind: "month", label: monthLabel(key), share, current: column === 0 }
		}
		const first = STRIP_MONTHS + (column - STRIP_MONTHS) * MONTHS_PER_QUARTER
		const from = monthKey(year, month + first)
		const to = monthKey(year, month + first + MONTHS_PER_QUARTER - 1)
		return { key: from, kind: "quarter", label: `${monthLabel(from)} to ${monthLabel(to)}`, share, current: false }
	})
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
