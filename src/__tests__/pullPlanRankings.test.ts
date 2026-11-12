import { describe, expect, it } from "vitest"
import type { PlannedBannerRank } from "../types/pullPlanRankings"
import { pullPlanRows, spreadLabel, stripColumns } from "../utils/pullPlanRankings"

/** Pull plans' rows (utils/pullPlanRankings.ts): what shows, and the two orders. */

const row = (id: number, type: PlannedBannerRank["type"], status: PlannedBannerRank["status"], start: string | null, share: number): PlannedBannerRank => ({
	type, unit: type === "step_up" ? "steps" : "pulls", id, name: `Banner ${id}`,
	start_date: start, end_date: null, predicted: false, status, share, average: 0, median: 0,
})

// In the server's order: planners first.
const ROWS = [
	row(1, "uma", "upcoming", "2026-12-01T00:00:00Z", 0.5),
	row(2, "support", "running", "2026-10-20T00:00:00Z", 0.3),
	row(3, "uma", "upcoming", null, 0.3),
	row(4, "uma", "ended", "2026-09-01T00:00:00Z", 0.9),
	row(5, "step_up", "upcoming", "2026-11-01T00:00:00Z", 0.04),
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

describe("stripColumns", () => {
	const month = (key: string, share: number) => ({ month: key, share })

	it("six months, four quarters and Later, scaled to add up to everything still ahead", () => {
		// The server's shares are of every month it sent, the ended September's too.
		const columns = stripColumns(
			[
				month("2026-09", 0.2), month("2026-10", 0.1), month("2027-03", 0.1),
				month("2027-04", 0.1), month("2027-05", 0.05), month("2027-06", 0.15),
				month("2028-03", 0.1), month("2028-04", 0.1), month("Later", 0.1),
			],
			new Date("2026-10-28T12:00:00Z")
		)
		expect(columns.map((column) => [column.label, Math.round(column.share * 1000) / 1000])).toEqual([
			["2026/10", 0.125], ["2026/11", 0], ["2026/12", 0], ["2027/1", 0], ["2027/2", 0], ["2027/3", 0.125],
			["2027/4 to 2027/6", 0.375], ["2027/7 to 2027/9", 0], ["2027/10 to 2027/12", 0], ["2028/1 to 2028/3", 0.125],
			["Later", 0.25],
		])
		expect(columns[0]).toMatchObject({ kind: "month", current: true })
		expect(columns.map((column) => column.kind).slice(5, 7)).toEqual(["month", "quarter"])
	})

	it("is all zeros with nothing planned", () => {
		expect(stripColumns([], new Date("2026-10-28T00:00:00Z")).every((column) => column.share === 0)).toBe(true)
	})
})

describe("spreadLabel", () => {
	it("labels pull buckets and one-wide step buckets", () => {
		const pulls = [0, 50, 100, 200, 300]
		expect(pulls.map((_, index) => spreadLabel(pulls, index))).toEqual(["under 50", "50 to 99", "100 to 199", "200 to 299", "300+"])
		const steps = [0, 2, 3, 4, 5]
		expect(steps.map((_, index) => spreadLabel(steps, index))).toEqual(["under 2", "2", "3", "4", "5+"])
	})

	it("names the server's spike buckets by their number alone", () => {
		// rankings_figures.EDGES: a bucket one wide is exactly that many.
		const label = (edges: number[]) => edges.map((_, index) => spreadLabel(edges, index))
		expect(label([0, 100, 133, 134, 200, 201])).toEqual(["under 100", "100 to 132", "133", "134 to 199", "200", "201+"])
		expect(label([0, 200, 201, 400, 401, 600])).toEqual(["under 200", "200", "201 to 399", "400", "401 to 599", "600+"])
		expect(label([0, 5, 6, 10, 11, 15])).toEqual(["under 5", "5", "6 to 9", "10", "11 to 14", "15+"])
	})
})
