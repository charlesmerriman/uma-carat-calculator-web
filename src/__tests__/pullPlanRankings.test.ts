import { describe, expect, it } from "vitest"
import type { PlannedBannerRank } from "../types/pullPlanRankings"
import { monthShares, pullPlanRows, spreadLabel } from "../utils/pullPlanRankings"

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

describe("monthShares", () => {
	const month = (key: string, share: number) => ({ month: key, share })

	it("shares this month, the next four and Later, scaled to add up to everything still ahead", () => {
		// The server's shares are of every month it sent, the ended September's too.
		const shares = monthShares(
			[month("2026-09", 0.5), month("2026-10", 0.05), month("2026-12", 0.15), month("2027-03", 0.1), month("2027-06", 0.125), month("Later", 0.075)],
			new Date("2026-10-28T12:00:00Z")
		)
		expect(shares.map((entry) => [entry.key, entry.share])).toEqual([
			["2026-10", 0.1], ["2026-11", 0], ["2026-12", 0.3], ["2027-01", 0], ["2027-02", 0], ["Later", 0.6],
		])
		expect(shares[0]).toMatchObject({ label: "2026/10", current: true })
		expect(shares[5].label).toBe("Later")
	})

	it("is all zeros with nothing planned", () => {
		expect(monthShares([], new Date("2026-10-28T00:00:00Z")).every((entry) => entry.share === 0)).toBe(true)
	})
})

describe("spreadLabel", () => {
	it("labels pull buckets and one-wide step buckets", () => {
		const pulls = [0, 50, 100, 200, 300]
		expect(pulls.map((_, index) => spreadLabel(pulls, index))).toEqual(["under 50", "50 to 99", "100 to 199", "200 to 299", "300+"])
		const steps = [0, 2, 3, 4, 5]
		expect(steps.map((_, index) => spreadLabel(steps, index))).toEqual(["under 2", "2", "3", "4", "5+"])
	})
})
