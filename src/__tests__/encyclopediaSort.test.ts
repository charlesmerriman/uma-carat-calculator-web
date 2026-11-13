import { describe, expect, it } from "vitest"
import { aptitudeMatches, releaseDates, sortList, type ReleaseDates } from "../utils/encyclopedia"
import type { AptitudeKey } from "../types/pvpTeam"
import { parseApiDate } from "../utils/dateFormat"

/** The Encyclopedia lists' sorts and the Umas list's aptitude filter (utils/encyclopedia.ts). */

const item = (id: number, name: string, gameId: number) => ({ id, name, game_id: gameId })
const ITEMS = [item(1, "Cheval", 30010), item(2, "Agnes", 30030), item(3, "Bourbon", 30020), item(4, "Daiwa", 30040)]

// Agnes and Bourbon are on Global; Cheval is JP only; Daiwa has no banner at all.
const DATES = new Map<number, ReleaseDates>([
	[2, { global: Date.UTC(2025, 5, 1), jp: Date.UTC(2022, 0, 1) }],
	[3, { global: Date.UTC(2025, 8, 1), jp: Date.UTC(2021, 0, 1) }],
	[1, { global: null, jp: Date.UTC(2026, 0, 1) }],
])

const names = (items: { name: string }[]) => items.map((entry) => entry.name)

describe("sortList", () => {
	it("sorts by name and by the game's id", () => {
		expect(names(sortList(ITEMS, "name"))).toEqual(["Agnes", "Bourbon", "Cheval", "Daiwa"])
		expect(names(sortList(ITEMS, "game_id"))).toEqual(["Cheval", "Bourbon", "Agnes", "Daiwa"])
	})

	it("puts Global releases first, then JP only, then undated, each way round", () => {
		expect(names(sortList(ITEMS, "newest", DATES))).toEqual(["Bourbon", "Agnes", "Cheval", "Daiwa"])
		expect(names(sortList(ITEMS, "oldest", DATES))).toEqual(["Agnes", "Bourbon", "Cheval", "Daiwa"])
	})

	it("leaves the input alone", () => {
		const before = names(ITEMS)
		sortList(ITEMS, "game_id")
		expect(names(ITEMS)).toEqual(before)
	})
})

describe("releaseDates", () => {
	it("keeps each entry's earliest Global banner and JP date", () => {
		const banner = (start: string, ids: number[]) => ({
			banner_timeline: { start_date: start },
			umas: ids.map((id) => ({ id, first_jp_date: "2021-03-01" })),
		})
		const dates = releaseDates([banner("2025-09-01", [7]), banner("2025-06-01", [7, 8])], (entry) => entry.umas)
		expect(dates.get(7)?.global).toBe(parseApiDate("2025-06-01")?.getTime())
		expect(dates.get(8)?.jp).toBe(parseApiDate("2021-03-01")?.getTime())
	})
})

describe("aptitudeMatches", () => {
	const apt = { turf: 7, dirt: 4, short: 1, mile: 5, medium: 7, long: null, front: 8, pace: 6, late: 3, end: 1 } as Record<AptitudeKey, number | null>

	it("passes a column at or above the grade, and any column", () => {
		expect(aptitudeMatches(apt, "mile", "5")).toBe(true) // Mile C, at least C
		expect(aptitudeMatches(apt, "dirt", "5")).toBe(false) // Dirt D, at least C
		expect(aptitudeMatches(apt, "front", "7")).toBe(true) // Front S, at least A
		expect(aptitudeMatches(apt, "any", "8")).toBe(true)
	})

	it("never passes an aptitude the data doesn't have", () => {
		expect(aptitudeMatches(apt, "long", "1")).toBe(false)
	})
})
