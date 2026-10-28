import { describe, expect, it } from "vitest"
import { winRates } from "../utils/runResults"

/**
 * "What wins" (utils/runResults.ts): shown from the server's floor, ranked
 * from 100 races, the thin rows under the ranked ones, and the marks.
 */

const ROWS = [
	{ uma: 1, style: "pace" as const, races: 400, wins: 100 },
	{ uma: 2, style: "end" as const, races: 19, wins: 19 },
	{ uma: 3, style: "front" as const, races: 44, wins: 13 },
	{ uma: 4, style: "late" as const, races: 120, wins: 36 },
	{ uma: 5, style: "pace" as const, races: 75, wins: 15 },
	{ uma: 6, style: "end" as const, races: 100, wins: 30 },
]

describe("winRates", () => {
	it("ranks by rate from 100 races, more races breaking a tie", () => {
		const { ranked } = winRates(ROWS, 20)
		expect(ranked.map((row) => [row.uma, row.rate])).toEqual([[4, 0.3], [6, 0.3], [1, 0.25]])
	})

	it("puts 20 to 99 races under the ranked rows by races, and drops anything thinner", () => {
		const { unranked } = winRates(ROWS, 20)
		// 30% from 44 races doesn't outrank 25% from 400: it sits below, unranked.
		expect(unranked.map((row) => row.uma)).toEqual([5, 3])
	})

	it("marks how much to trust a rate", () => {
		const { ranked, unranked } = winRates(ROWS, 20)
		expect(Object.fromEntries([...ranked, ...unranked].map((row) => [row.uma, row.marks]))).toEqual({ 1: 3, 3: 1, 4: 2, 5: 1, 6: 2 })
	})

	it("is empty when nothing has enough races", () => {
		expect(winRates([{ uma: 1, style: "pace", races: 3, wins: 3 }], 20)).toEqual({ ranked: [], unranked: [] })
	})
})
