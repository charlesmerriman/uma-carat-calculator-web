import { act, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { AuthContext, type AuthContextType } from "../services/AuthContext"
import { EncyclopediaTabs } from "../components/encyclopedia/EncyclopediaTabs"
import {
	cardIdKey, costKey, effectKey, firstRows, gradeKey, groupsFor, indexEntries, letterKey, mergeSmallGroups, releaseKey, rowsBefore,
	skillIdKey, umaIdKey,
} from "../utils/encyclopediaGroups"
import { reportCounts } from "../utils/encyclopediaCounts"

/** The lists' group headings and index, and the tabs' counts (notes/encyclopedia-redesign-plan.md). */

const names = (count: number) => Array.from({ length: count }, (_, index) => `${"ABC"[index % 3]} name ${index}`).sort()
const byLetter = (list: string[]) => groupsFor(list, letterKey)
const shape = <T,>(groups: { label: string; items: T[] }[] | null) => groups?.map((group) => [group.label, group.items.length])

describe("groupsFor by name", () => {
	it("cuts a full list in name order into runs of one letter", () => {
		expect(shape(byLetter(names(60)))).toEqual([["A", 20], ["B", 20], ["C", 20]])
	})

	it("keeps the order it is given, so a reversed list runs Z to A", () => {
		expect(byLetter([...names(60)].reverse())?.map((group) => group.label)).toEqual(["C", "B", "A"])
	})

	it("files a name that doesn't start with a letter under #", () => {
		const first = byLetter(["#LookatCurren", "1st Place", ...names(60)])?.[0]
		expect([first?.label, first?.items]).toEqual(["#", ["#LookatCurren", "1st Place"]])
	})

	it("keeps its headings on a filtered list however short, and is nothing for an empty one", () => {
		expect(shape(byLetter(names(3)))).toEqual([["A", 1], ["B", 1], ["C", 1]])
		expect(byLetter([])).toBeNull()
	})

	it("gives a key that comes back after another run its own unique id", () => {
		const groups = groupsFor([...names(30), ...names(30)], letterKey)
		const keys = groups?.map((group) => group.key) ?? []
		expect(new Set(keys).size).toBe(keys.length)
	})
})

describe("the other sorts' keys", () => {
	it("files a release date under its quarter, a JP only one apart, an undated one last", () => {
		const july = new Date(2025, 6, 15).getTime()
		expect(releaseKey({ global: july, jp: null })).toMatchObject({ label: "Q3 2025", note: "Jul to Sep", index: "2025" })
		expect(releaseKey({ global: null, jp: july })).toMatchObject({ label: "JP Q3 2025", index: "JP" })
		expect(releaseKey({ global: july, jp: null }).key).not.toBe(releaseKey({ global: null, jp: july }).key)
		expect(releaseKey(undefined)).toMatchObject({ label: "No date", index: null, tail: true })
	})

	it("notes a quarter as estimated once any of its dates is the site's estimate", () => {
		const day = (date: number) => ({ global: new Date(2027, 0, date).getTime(), jp: null })
		const items = Array.from({ length: 40 }, (_, index) => ({ ...day(index % 28 + 1), predicted: index === 7 }))
		expect(groupsFor(items, releaseKey)?.[0]).toMatchObject({ label: "Q1 2027", mark: "estimated" })
	})

	it("files an uma's id by the thousand and a card's by rarity", () => {
		expect(umaIdKey(100101)).toMatchObject({ label: "100xxx", index: "100" })
		expect(umaIdKey(114901)).toMatchObject({ label: "114xxx" })
		expect(cardIdKey({ rarity: 3, game_id: 30265 })).toMatchObject({ label: "SSR", tone: "ssr" })
		expect(cardIdKey({ rarity: 3, game_id: null })).toMatchObject({ tail: true })
	})

	it("files an aptitude under its grade letter, an unimported one last", () => {
		expect(gradeKey(7)).toMatchObject({ label: "A", tone: "A" })
		expect(gradeKey(null)).toMatchObject({ label: "No grades yet", tail: true })
	})

	it("files an effect under its value, with the unread and the cards without it as tails", () => {
		expect(effectKey(35, true, "percent")).toMatchObject({ label: "35%", value: 35 })
		expect(effectKey(null, false, "percent")).toMatchObject({ label: "Not owned", tail: true })
		expect(effectKey(null, true, "percent")).toMatchObject({ label: "Doesn't give it", tail: true })
	})
})

describe("the Skills list's keys", () => {
	it("files a name past Z (Japanese, or a sign like ¡ or …) under one あ, and drops an accent", () => {
		expect(letterKey("黄金を訪ねて")).toMatchObject({ label: "あ", key: "kana" })
		expect(letterKey("¡Qué alegría!").key).toBe(letterKey("…found you.").key)
		expect(letterKey("Élan")).toMatchObject({ label: "E" })
		expect(letterKey("\"Bon Voyage\"")).toMatchObject({ label: "#" })
	})

	it("files a skill id by its first three digits, whatever its length, with no index", () => {
		expect(skillIdKey(200012)).toMatchObject({ label: "200xxx", index: null })
		expect(skillIdKey(100100111)).toMatchObject({ label: "100xxxxxx" })
		expect(skillIdKey(100011).key).not.toBe(skillIdKey(100100111).key)
	})

	it("files a cost under its SP, a unique last", () => {
		expect(costKey(200)).toMatchObject({ label: "200 SP", index: "200", value: 200 })
		expect(costKey(null)).toMatchObject({ label: "No SP cost", tail: true })
	})
})

describe("drawing a page at a time", () => {
	const groups = groupsFor(names(60), letterKey) ?? []

	it("keeps the groups that fit, each with its full count", () => {
		const shown = firstRows(groups, 25)
		expect(shown.map((group) => [group.label, group.items.length, group.total])).toEqual([["A", 20, 20], ["B", 5, 20]])
	})

	it("says how many rows come before a group, to draw up to it", () => {
		expect(rowsBefore(groups, "C")).toBe(40)
	})
})

describe("mergeSmallGroups", () => {
	// Friendship Bonus, best first: 40% (13), 38% (2), 35% (58), then 23 without it.
	const values = [...Array(13).fill(40), 38, 38, ...Array(58).fill(35), ...Array(23).fill(null)]
	const groups = groupsFor(values, (value: number | null) => effectKey(value, true, "percent"))
	const range = (low: number, high: number) => `${low}% to ${high}%`

	it("folds a value only one or two cards reach into its neighbour, as a range", () => {
		expect(shape(mergeSmallGroups(groups, 3, range))).toEqual([["38% to 40%", 15], ["35%", 58], ["Doesn't give it", 23]])
	})

	it("never folds a tail group, however small", () => {
		const withTail = groupsFor([...Array(50).fill(35), null], (value: number | null) => effectKey(value, true, "percent"))
		expect(shape(mergeSmallGroups(withTail, 3, range))).toEqual([["35%", 50], ["Doesn't give it", 1]])
	})
})

describe("indexEntries", () => {
	it("gives one button per year, on its first quarter, and none to a tail", () => {
		const keys = [
			releaseKey({ global: new Date(2026, 10, 1).getTime(), jp: null }),
			releaseKey({ global: new Date(2026, 1, 1).getTime(), jp: null }),
			releaseKey({ global: new Date(2025, 7, 1).getTime(), jp: null }),
			releaseKey(undefined),
		]
		expect(indexEntries(keys).map((entry) => entry.label)).toEqual(["2026", "2025"])
	})
})

describe("the tabs' counts", () => {
	it("show a list's number once some page has counted it", () => {
		const auth = { isLoggedIn: true, status: "ready", account: { early_access: true } } as unknown as AuthContextType
		render(<AuthContext.Provider value={auth}><MemoryRouter><EncyclopediaTabs /></MemoryRouter></AuthContext.Provider>)
		expect(screen.getByRole("link", { name: "Skills" })).toBeInTheDocument()
		act(() => reportCounts({ skills: 2223, umas: 270 }))
		expect(screen.getByRole("link", { name: "2,223 Skills" })).toBeInTheDocument()
		expect(screen.getByRole("link", { name: "270 Umas" })).toBeInTheDocument()
		// Nobody has counted the cards yet, so that tab is its name alone.
		expect(screen.getByRole("link", { name: "Support cards" })).toBeInTheDocument()
	})
})
