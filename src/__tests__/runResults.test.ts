import { describe, expect, it } from "vitest"
import type { WinRateRow } from "../types/rankingsTabs"
import { winRates } from "../utils/runResults"

/**
 * "What wins" (utils/runResults.ts): the server rates, orders and marks the
 * rows (backend rankings_shares.run_shares, tested there); the client only
 * splits the ranked ones from the rest, in the server's order.
 */

const row = (uma: number, ranked: boolean): WinRateRow => ({ uma, style: "pace", rate: 0.3, marks: ranked ? 2 : 1, ranked })

describe("winRates", () => {
	it("splits the ranked rows from the rest, each in the server's order", () => {
		const { ranked, unranked } = winRates([row(4, true), row(6, true), row(5, false), row(3, false)])
		expect(ranked.map((entry) => entry.uma)).toEqual([4, 6])
		expect(unranked.map((entry) => entry.uma)).toEqual([5, 3])
	})

	it("is empty with nothing over the floor", () => {
		expect(winRates([])).toEqual({ ranked: [], unranked: [] })
	})
})
