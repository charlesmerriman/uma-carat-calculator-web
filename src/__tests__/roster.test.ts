import { describe, expect, it } from "vitest"
import { applyRosterChanges, cardSummary, limitBreakLabel, ownedForPicker, umaSummary } from "../utils/roster"
import type { Roster } from "../types/roster"

/** The Collection grid's rules (utils/roster.ts): what a tap does to the cached roster. */

const ROSTER: Roster = {
	umas: [{ uma: 1, stars: 3, talent_level: 5, source: "import", obtained_at: "2025-09-01T08:00:00Z" }],
	support_cards: [{ support_card: 10, limit_break: 2, spare_copies: 1, source: "import", obtained_at: null }],
}

describe("applyRosterChanges", () => {
	it("adds a row as a hand entry", () => {
		const next = applyRosterChanges(ROSTER, { umas: [{ uma: 2, owned: true }] })
		expect(next.umas.find((row) => row.uma === 2)).toEqual({ uma: 2, stars: null, talent_level: null, source: "manual", obtained_at: null })
	})

	it("changes only what a change names, and makes the row manual (hand edits win)", () => {
		const next = applyRosterChanges(ROSTER, { support_cards: [{ support_card: 10, owned: true, limit_break: 4 }] })
		expect(next.support_cards).toEqual([{ support_card: 10, limit_break: 4, spare_copies: 1, source: "manual", obtained_at: null }])
		const starred = applyRosterChanges(ROSTER, { umas: [{ uma: 1, owned: true, stars: 5 }] })
		expect(starred.umas[0]).toMatchObject({ stars: 5, talent_level: 5, source: "manual", obtained_at: "2025-09-01T08:00:00Z" })
	})

	it("removes a row on owned: false, and marks many at once", () => {
		expect(applyRosterChanges(ROSTER, { umas: [{ uma: 1, owned: false }] }).umas).toEqual([])
		const many = applyRosterChanges(ROSTER, { umas: [2, 3, 4].map((uma) => ({ uma, owned: true })) })
		expect(many.umas.map((row) => row.uma).sort()).toEqual([1, 2, 3, 4])
	})
})

describe("labels and the picker", () => {
	it("reads a limit break the way players say it", () => {
		expect([0, 2, 4].map(limitBreakLabel)).toEqual(["LB0", "LB2", "MLB"])
	})

	it("gives the picker the ids it owns, with each card's limit break", () => {
		expect(ownedForPicker(undefined, "uma")).toBeNull()
		expect([...(ownedForPicker(ROSTER, "uma")?.ids ?? [])]).toEqual([1])
		expect(ownedForPicker(ROSTER, "support")?.limitBreaks.get(10)).toBe(2)
	})
})

describe("the grids' summaries", () => {
	it("counts owned umas by stars, an unset one with the three or fewer", () => {
		const owned = [5, 5, 4, 3, 1, null].map((stars, index) => ({ stars, talent_level: index < 2 ? 5 : 2 }))
		expect(umaSummary(owned)).toEqual({ five: 2, four: 1, threeOrFewer: 3, potentialFive: 2 })
	})

	it("counts MLB cards and owned of each type, Global cards only", () => {
		const offered = [
			{ id: 1, card_type: "speed" },
			{ id: 2, card_type: "speed" },
			{ id: 3, card_type: "wit" },
		]
		const owned = [
			{ support_card: 1, limit_break: 4 },
			{ support_card: 3, limit_break: 2 },
			// A JP-only card a stale import left behind: not offered, not counted.
			{ support_card: 9, limit_break: 4 },
		]
		expect(cardSummary(offered, owned, ["speed", "wit", "friend"])).toEqual({
			owned: 2,
			mlb: 1,
			byType: [
				{ type: "speed", owned: 1, total: 2 },
				{ type: "wit", owned: 1, total: 1 },
				{ type: "friend", owned: 0, total: 0 },
			],
		})
	})
})
