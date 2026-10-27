import { describe, expect, it } from "vitest"
import { winRates } from "../utils/runResults"

/** "What wins" (utils/runResults.ts): a rate only with enough races, best first. */

describe("winRates", () => {
	it("drops thin rows and ranks by rate, more races breaking a tie", () => {
		const rows = winRates(
			[
				{ uma: 1, style: "pace", races: 40, wins: 10 },
				{ uma: 2, style: "end", races: 19, wins: 19 },
				{ uma: 3, style: "front", races: 20, wins: 10 },
				{ uma: 4, style: "late", races: 60, wins: 30 },
			],
			20
		)
		expect(rows.map((row) => [row.uma, row.rate])).toEqual([[4, 0.5], [3, 0.5], [1, 0.25]])
	})

	it("is empty when nothing has enough races", () => {
		expect(winRates([{ uma: 1, style: "pace", races: 3, wins: 3 }], 20)).toEqual([])
	})
})
