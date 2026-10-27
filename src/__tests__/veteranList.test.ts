import { describe, expect, it } from "vitest"
import { NO_FILTER, shownVeterans, umaChoices } from "../utils/veteranList"
import type { TrainedUma } from "../types/trainedUma"

/** The Collection's veteran list: search, the Uma filter, "A or better at" and the sorts. */

const APT = { turf: 8, dirt: 1, short: 3, mile: 7, medium: 7, long: 6, front: 2, pace: 7, late: 7, end: 4 }
const NAMES: Record<number, string> = { 41: "Oguri Cap", 42: "Maruzensky" }
const name = (uma: number) => NAMES[uma] ?? "Unknown"

const veteran = (id: number, extra: Partial<TrainedUma> = {}) =>
	({ id, uma: 41, label: "", memo: "", speed: 1000, stamina: 600, power: 900, guts: 400, wit: 700, apt: APT, rank_score: null, ...extra }) as TrainedUma

// Newest trained first, as the API sends them.
const LIST = [
	veteran(1, { label: "Main ace", rank_score: 15000, speed: 1100 }),
	veteran(2, { uma: 42, memo: "Speed parent", rank_score: 18000, apt: { ...APT, long: 7 } }),
	veteran(3, { rank_score: null, speed: 1200 }),
]
const ids = (list: TrainedUma[]) => list.map((each) => each.id)

describe("the veteran list", () => {
	it("keeps the API's newest-trained order with no filter", () => {
		expect(ids(shownVeterans(LIST, NO_FILTER, name))).toEqual([1, 2, 3])
	})

	it("searches the uma's name, the label and the memo, every word", () => {
		expect(ids(shownVeterans(LIST, { ...NO_FILTER, query: "maru" }, name))).toEqual([2])
		expect(ids(shownVeterans(LIST, { ...NO_FILTER, query: "speed PARENT" }, name))).toEqual([2])
		expect(ids(shownVeterans(LIST, { ...NO_FILTER, query: "oguri ace" }, name))).toEqual([1])
	})

	it("narrows to one uma, or to an aptitude at A or better", () => {
		expect(ids(shownVeterans(LIST, { ...NO_FILTER, uma: 41 }, name))).toEqual([1, 3])
		expect(ids(shownVeterans(LIST, { ...NO_FILTER, goodAt: "long" }, name))).toEqual([2])
	})

	it("sorts highest first, a veteran with no score last", () => {
		expect(ids(shownVeterans(LIST, { ...NO_FILTER, sort: "score" }, name))).toEqual([2, 1, 3])
		expect(ids(shownVeterans(LIST, { ...NO_FILTER, sort: "speed" }, name))).toEqual([3, 1, 2])
	})

	it("offers each uma she has veterans of, by name, with a count", () => {
		expect(umaChoices(LIST, name)).toEqual([
			{ uma: 42, name: "Maruzensky", count: 1 },
			{ uma: 41, name: "Oguri Cap", count: 2 },
		])
	})
})
