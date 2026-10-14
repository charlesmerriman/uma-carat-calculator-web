import { describe, expect, it } from "vitest"
import { aptitudeKeysForEvent, aptitudeLetter } from "../utils/courseAptitude"

const course = (surface_type: string, distance: string, length = "") => ({ surface_type, distance, length })
const keys = (...args: Parameters<typeof aptitudeKeysForEvent>) => aptitudeKeysForEvent(...args).map((entry) => entry.key)

describe("courseAptitude", () => {
	it("maps the words editors type", () => {
		expect(keys(course("Turf", "Medium"), "front")).toEqual(["turf", "medium", "front"])
		expect(keys(course("Dirt", "Mile"), "late")).toEqual(["dirt", "mile", "late"])
		expect(keys(course("Turf", "Sprint"), null)).toEqual(["turf", "short"])
		expect(keys(course("turf", "long"), "end")).toEqual(["turf", "long", "end"])
	})

	it("places a length in its band when the distance is a number or missing", () => {
		expect(keys(course("Turf", "2200"), null)).toEqual(["turf", "medium"])
		expect(keys(course("Turf", "TBD", "1400m"), null)).toEqual(["turf", "short"])
		expect(keys(course("Turf", "", "1800"), null)).toEqual(["turf", "mile"])
		expect(keys(course("Turf", "", "2500"), null)).toEqual(["turf", "long"])
	})

	it("returns nothing it can't place, and a runaway reads front", () => {
		expect(keys(course("TBD", "TBD"), null)).toEqual([])
		expect(keys(course("Firm", "TBD"), "runaway")).toEqual(["front"])
	})

	it("prints the game's letters", () => {
		expect([1, 4, 7, 8].map(aptitudeLetter)).toEqual(["G", "D", "A", "S"])
		expect(aptitudeLetter(null)).toBeNull()
		expect(aptitudeLetter(9)).toBeNull()
	})
})
