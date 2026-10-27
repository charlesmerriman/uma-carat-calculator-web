import { describe, expect, it } from "vitest"
import type { PlannedBannerRank } from "../types/pullPlanRankings"
import { pullPlanRows } from "../utils/pullPlanRankings"

/** Pull plans' rows (utils/pullPlanRankings.ts): what shows, and the two orders. */

const row = (id: number, type: PlannedBannerRank["type"], status: PlannedBannerRank["status"], start: string | null, planners: number): PlannedBannerRank => ({
	type, unit: type === "step_up" ? "steps" : "pulls", id, name: `Banner ${id}`,
	start_date: start, end_date: null, predicted: false, status, planners, total: 0, average: 0, median: 0,
})

// In the server's order: planners first.
const ROWS = [
	row(1, "uma", "upcoming", "2026-12-01T00:00:00Z", 500),
	row(2, "support", "running", "2026-10-20T00:00:00Z", 300),
	row(3, "uma", "upcoming", null, 300),
	row(4, "uma", "ended", "2026-09-01T00:00:00Z", 900),
	row(5, "step_up", "upcoming", "2026-11-01T00:00:00Z", 40),
]
const ids = (rows: PlannedBannerRank[]) => rows.map((entry) => entry.id)

describe("pullPlanRows", () => {
	it("sorts by date, soonest first, an undated banner last, ended ones hidden", () => {
		expect(ids(pullPlanRows(ROWS, { type: null, sort: "date", showEnded: false }))).toEqual([2, 5, 1, 3])
	})

	it("sorts by planners, ties in the server's order", () => {
		expect(ids(pullPlanRows(ROWS, { type: null, sort: "planners", showEnded: false }))).toEqual([1, 2, 3, 5])
	})

	it("shows ended banners behind the switch", () => {
		expect(ids(pullPlanRows(ROWS, { type: null, sort: "planners", showEnded: true }))).toEqual([4, 1, 2, 3, 5])
	})

	it("filters by type", () => {
		expect(ids(pullPlanRows(ROWS, { type: "uma", sort: "date", showEnded: true }))).toEqual([4, 1, 3])
		expect(ids(pullPlanRows(ROWS, { type: "step_up", sort: "date", showEnded: false }))).toEqual([5])
	})
})
