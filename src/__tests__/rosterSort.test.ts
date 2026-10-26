import { describe, expect, it } from "vitest"
import { UMA_SORTS, addStep, sortBySteps, typeRank } from "../utils/rosterSort"

/** The Collection grids' combined sorts (utils/rosterSort.ts). */

const item = (id: number, name: string, released: number | null, rarity: number, stars: number | null) => ({ id, name, released, rarity, stars })
const ITEMS = [
	item(1, "Oguri Cap", 300, 3, 5),
	item(2, "Maruzensky", 100, 3, null),
	item(3, "Gold Ship", null, 2, 3),
	item(4, "Agnes Tachyon", 300, 2, 4),
]
const valueOf = (key: string, entry: (typeof ITEMS)[number]) =>
	key === "released" ? entry.released : key === "rarity" ? entry.rarity : key === "stars" ? entry.stars : entry.name

const names = (sorted: typeof ITEMS) => sorted.map((entry) => entry.name)

describe("sortBySteps", () => {
	it("starts newest released first, unknown dates last, ties by name", () => {
		expect(names(sortBySteps(ITEMS, [{ key: "released", desc: true }], valueOf))).toEqual([
			"Agnes Tachyon", "Oguri Cap", "Maruzensky", "Gold Ship",
		])
	})

	it("keeps unknowns last when the direction flips", () => {
		expect(names(sortBySteps(ITEMS, [{ key: "released", desc: false }], valueOf)).at(-1)).toBe("Gold Ship")
		expect(names(sortBySteps(ITEMS, [{ key: "stars", desc: false }], valueOf)).at(-1)).toBe("Maruzensky")
	})

	it("combines sorts: the second only breaks the first's ties", () => {
		expect(
			names(sortBySteps(ITEMS, [{ key: "rarity", desc: true }, { key: "stars", desc: true }], valueOf))
		).toEqual(["Oguri Cap", "Maruzensky", "Agnes Tachyon", "Gold Ship"])
	})

	it("adds a sort in its starting direction, once", () => {
		const steps = addStep([{ key: "released" as const, desc: true }], "name", UMA_SORTS)
		expect(steps).toEqual([{ key: "released", desc: true }, { key: "name", desc: false }])
		expect(addStep(steps, "name", UMA_SORTS)).toEqual(steps)
	})

	it("orders card types the game's way", () => {
		expect(["wit", "speed", "group"].map(typeRank)).toEqual([4, 0, 6])
		expect(typeRank(null)).toBeNull()
	})
})
