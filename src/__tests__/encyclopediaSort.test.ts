import { describe, expect, it } from "vitest"
import {
	aptitudeMatches, directionWords, effectReading, releaseDates, searchMatches, sortByEffect, sortByValue, sortFact, sortList,
	withEventDates, withGameDates, type ReleaseDates,
} from "../utils/encyclopedia"
import type { CardEffectsData, CardEffectsRow } from "../types/encyclopedia"
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
		// Newest first by default; the reverse button turns only the dates round.
		expect(names(sortList(ITEMS, "release", DATES))).toEqual(["Bourbon", "Agnes", "Cheval", "Daiwa"])
		expect(names(sortList(ITEMS, "release", DATES, true))).toEqual(["Agnes", "Bourbon", "Cheval", "Daiwa"])
	})

	it("turns names and ids round", () => {
		expect(names(sortList(ITEMS, "name", DATES, true))).toEqual(["Daiwa", "Cheval", "Bourbon", "Agnes"])
		expect(names(sortList(ITEMS, "game_id", DATES, true))).toEqual(["Daiwa", "Agnes", "Bourbon", "Cheval"])
	})

	it("words the direction each sort runs in", () => {
		expect(directionWords("name", false)).toBe("A to Z")
		expect(directionWords("release", false)).toBe("Newest first")
		expect(directionWords("release", true)).toBe("Oldest first")
		expect(directionWords("game_id", false)).toBe("Lowest first")
		expect(directionWords("effect", false)).toBe("Highest first")
		expect(directionWords("apt_mile", false)).toBe("Best first")
	})

	it("leaves the input alone", () => {
		const before = names(ITEMS)
		sortList(ITEMS, "game_id")
		expect(names(ITEMS)).toEqual(before)
	})
})

describe("sortByValue", () => {
	it("keeps an item with no value last, both ways round", () => {
		const rows = [{ name: "A", value: 2 }, { name: "B", value: null }, { name: "C", value: 1 }]
		expect(names(sortByValue(rows, (row) => row.value, false))).toEqual(["C", "A", "B"])
		expect(names(sortByValue(rows, (row) => row.value, true))).toEqual(["A", "C", "B"])
	})
})

describe("withGameDates", () => {
	it("dates a card on no banner by the game's own date, and never overrides a banner", () => {
		const dates = withGameDates(DATES, [
			{ id: 4, released_at: "2025-08-01T00:00:00Z" }, // Daiwa: no banner, a welfare card
			{ id: 2, released_at: "2020-01-01T00:00:00Z" }, // Agnes: her banner wins
			{ id: 1, released_at: null }, // Cheval: still JP only
		])
		expect(dates.get(4)?.global).toBe(Date.UTC(2025, 7, 1))
		expect(dates.get(2)?.global).toBe(Date.UTC(2025, 5, 1))
		expect(dates.get(1)).toEqual({ global: null, jp: Date.UTC(2026, 0, 1) })
		expect(DATES.has(4)).toBe(false) // a copy, the banners' map untouched
	})
})

describe("withEventDates", () => {
	it("dates an outfit on no banner by the first event that gives it, and never overrides a banner", () => {
		// Daptrius, 2026-11-20: Special Week (Commander) and Rhein Kraft (Alt
		// Version) come from main story chapters and sorted with no date.
		const umas = (...ids: number[]) => ids.map((id) => ({ id }))
		const dates = withEventDates(DATES, [
			{ start_date: "2026-06-25T22:00:00Z", is_predicted: false, umas: umas(4, 2) },
			{ start_date: "2026-01-01T00:00:00Z", is_predicted: true, umas: umas(4) },
			{ start_date: "2027-08-26T00:00:00Z", is_predicted: true, umas: umas(1) },
			{ start_date: null, is_predicted: false, umas: umas(5) },
			// An API older than the kinds sends no `umas`.
			{ start_date: "2026-01-01T00:00:00Z", is_predicted: false },
		] as unknown as Parameters<typeof withEventDates>[1])
		// Daiwa: the earlier event, with its estimate badge.
		expect(dates.get(4)).toEqual({ global: Date.UTC(2026, 0, 1), jp: null, predicted: true })
		// Agnes: her banner wins.
		expect(dates.get(2)?.global).toBe(Date.UTC(2025, 5, 1))
		// Cheval: JP only until her chapter's predicted Global day, keeping her JP date.
		expect(dates.get(1)).toEqual({ global: Date.UTC(2027, 7, 26), jp: Date.UTC(2026, 0, 1), predicted: true })
		expect(dates.has(5)).toBe(false)
		expect(DATES.has(4)).toBe(false) // a copy, the banners' map untouched
	})
})

describe("sortFact", () => {
	it("says the id or the date a tile is sorted by, and nothing for another sort", () => {
		const dates = new Map<number, ReleaseDates>([[1, { global: parseApiDate("2025-06-26T22:00:00Z")!.getTime(), jp: null }], [2, { global: null, jp: parseApiDate("2024-03-01T12:00:00Z")!.getTime() }]])
		expect(sortFact("game_id", { id: 1, game_id: 30265 }, dates)).toBe("ID 30265")
		expect(sortFact("release", { id: 1 }, dates)).toMatch(/^2025\/6\/2[67]$/)
		expect(sortFact("release", { id: 2 }, dates)).toBe("JP 2024/3/1")
		// A date the site estimated from the JP schedule says so, as the card page's badge does.
		dates.set(1, { ...dates.get(1)!, predicted: true })
		expect(sortFact("release", { id: 1 }, dates)).toMatch(/^Est\. 2025\/6\/2[67]$/)
		expect(sortFact("release", { id: 3 }, dates)).toBeNull()
		expect(sortFact("name", { id: 1, game_id: 30265 }, dates)).toBeNull()
	})
})

describe("searchMatches", () => {
	it("reads a query of digits as the start of an id, anything else as words", () => {
		// Board "Add Searchable Aliases", 2026-11-17: a card id, or a 4-digit character id in part.
		expect(searchMatches("30265", "Admire Groove", [30265, 1068])).toBe(true)
		expect(searchMatches("106", "Admire Groove", [30265, 1068])).toBe(true)
		expect(searchMatches("1069", "Admire Groove", [30265, 1068])).toBe(false)
		expect(searchMatches("admire", "Admire Groove", [30265, 1068])).toBe(true)
		expect(searchMatches("  ", "Admire Groove", [null])).toBe(true)
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

	it("passes a column at or above the grade", () => {
		expect(aptitudeMatches(apt, "mile", "5")).toBe(true) // Mile C, at least C
		expect(aptitudeMatches(apt, "dirt", "5")).toBe(false) // Dirt D, at least C
		expect(aptitudeMatches(apt, "front", "7")).toBe(true) // Front S, at least A
	})

	it("never passes an aptitude the data doesn't have", () => {
		expect(aptitudeMatches(apt, "long", "1")).toBe(false)
	})
})

describe("effectReading and sortByEffect", () => {
	// SSR caps; Specialty Priority (19) 20..35, Race Bonus (15) 5..10, a unique at level 30.
	const card = (unique: CardEffectsRow["unique"], effects: CardEffectsRow["effects"]): CardEffectsRow => ({
		caps: [30, 35, 40, 45, 50], effects, unique,
	})
	const spe = card({ level: 30, values: { "19": 40, "15": 2 }, conditional: false }, { "19": [20, 25, 30, 35, 35], "15": [5, 5, 8, 10, 10] })

	it("multiplies a unique Specialty Priority with the card's own: 35 and 40 give 89, not 75", () => {
		expect(effectReading(spe, 19, 4)).toEqual({ value: 89, unsure: false })
	})

	it("adds any other unique value, once unlocked at that limit break's cap", () => {
		expect(effectReading(spe, 15, 4)).toEqual({ value: 12, unsure: false })
		const late = card({ level: 45, values: { "15": 2 }, conditional: false }, { "15": [5, 5, 8, 10, 10] })
		expect(effectReading(late, 15, 2)?.value).toBe(8) // cap 40, unique not yet
		expect(effectReading(late, 15, 3)?.value).toBe(12) // cap 45, unique on
	})

	it("says when the unique has a part nobody decoded, and is null for an effect the card lacks", () => {
		const unsure = card({ level: 30, values: {}, conditional: true }, { "15": [5, 5, 8, 10, 10] })
		expect(effectReading(unsure, 15, 4)).toEqual({ value: 10, unsure: true })
		expect(effectReading(unsure, 19, 4)).toBeNull()
	})

	it("sorts highest first, unread cards after, cards without the effect last", () => {
		const data: CardEffectsData = {
			types: [{ type: 15, name: "Race Bonus", format: "percent" }],
			cards: {
				"1": card(null, { "15": [5, 5, 5, 5, 5] }),
				"2": card(null, { "15": [10, 10, 10, 10, 10] }),
				"3": card(null, {}),
				"4": card(null, { "15": [8, 8, 8, 8, 8] }),
			},
		}
		const cards = [1, 2, 3, 4].map((id) => ({ id, name: `Card ${id}` }))
		// The player owns 1, 2 and 3; card 4 can't be read at "my limit break".
		const mine = (entry: { id: number }) => (entry.id === 4 ? null : 4)
		expect(sortByEffect(cards, 15, mine, data).map((entry) => entry.id)).toEqual([2, 1, 4, 3])
		expect(sortByEffect(cards, 15, () => 4, data).map((entry) => entry.id)).toEqual([2, 4, 1, 3])
		// Turned round: lowest first, the unread card and the card without it still last.
		expect(sortByEffect(cards, 15, mine, data, true).map((entry) => entry.id)).toEqual([1, 2, 4, 3])
	})
})
