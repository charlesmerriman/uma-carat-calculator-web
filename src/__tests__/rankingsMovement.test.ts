import { describe, expect, it } from "vitest"
import { movedInTop, movement } from "../utils/rankingsMovement"

/** Rank movement (utils/rankingsMovement.ts): two orders into each row's chip. */

describe("movement", () => {
	it("says places climbed, places fallen and new, and nothing for no change", () => {
		const moves = movement(["c", "a", "b", "d"], ["a", "b", "c"])
		expect(Object.fromEntries(moves)).toEqual({ c: 2, a: -1, b: -1, d: "new" })
	})

	it("is empty with nothing to compare with", () => {
		expect(movement(["a", "b"], null).size).toBe(0)
		expect(movement(["a", "b"], undefined).size).toBe(0)
	})

	it("counts the top rows that moved", () => {
		const current = ["c", "a", "b", "d"]
		expect(movedInTop(current, movement(current, ["a", "b", "c", "d"]), 3)).toBe(3)
		expect(movedInTop(current, movement(current, current))).toBe(0)
	})
})
