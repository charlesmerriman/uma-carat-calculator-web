/**
 * The course map's geometry (utils/courseGeometry.ts): the one place a metre
 * becomes a position, and the facts read off a course record. Chukyo turf
 * 1200 m is the plan's worked example (notes/course-map-plan.md, "Design").
 */
import { describe, expect, it } from "vitest"
import {
	courseFacts,
	derivedFacts,
	elevationProfile,
	formatMetres,
	markerLanes,
	metreToFraction,
	phaseBands,
	positionKeepEnd,
	rulerTicks,
	sectionBoundaries,
	slopeParts,
	surfaceParts,
	trackParts,
	type CourseMarker,
} from "../utils/courseGeometry"
import { CHUKYO_1200, NAKAYAMA_3600, SANTA_ANITA_2400, TOKYO_DIRT_1600 } from "./courseFixtures"

describe("Chukyo turf 1200 m, the worked example", () => {
	it("puts the phases at 1/6 and 2/3, Late-race running to the finish", () => {
		expect(phaseBands(1200).map(({ start, end, label }) => [label, start, end])).toEqual([
			["Early-race", 0, 200],
			["Mid-race", 200, 800],
			["Late-race", 800, 1200],
		])
	})

	it("cuts 24 sections of 50 m and ends position keep after 10 of them", () => {
		const bounds = sectionBoundaries(1200)
		expect(bounds).toHaveLength(25)
		expect(bounds[1]).toBe(50)
		expect(positionKeepEnd(1200)).toBe(500)
	})

	it("reads the straights and corners in race order, the last straight as the final one", () => {
		expect(trackParts(CHUKYO_1200).map(({ label, start, end }) => [label, start, end])).toEqual([
			["Straight", 0, 300],
			["Corner 3", 300, 550],
			["Corner 4", 550, 788],
			["Final straight", 788, 1200],
		])
	})

	it("labels the hills in percent and builds the height from them", () => {
		expect(slopeParts(CHUKYO_1200).map(({ label, start, end }) => [label, start, end])).toEqual([
			["Downhill 1%", 100, 875],
			["Uphill 2%", 875, 975],
		])
		// 775 m at -1% drops 7.75 m, then 100 m at 2% climbs 2 m.
		expect(elevationProfile(CHUKYO_1200)).toEqual([
			{ at: 0, height: 0 },
			{ at: 100, height: 0 },
			{ at: 875, height: -7.75 },
			{ at: 875, height: -7.75 },
			{ at: 975, height: -5.75 },
			{ at: 1200, height: -5.75 },
		])
	})

	it("reads off the chips", () => {
		expect(derivedFacts(CHUKYO_1200)).toEqual([
			"Final corner from 550m",
			"Final straight 412m",
			"2% climb in the last 400m",
			"Last spurt can start on the final straight",
		])
	})

	it("hands the strip its own overlay: three phases and three markers", () => {
		const facts = courseFacts(CHUKYO_1200)
		expect(facts.spans.map((span) => span.label)).toEqual(["Early-race", "Mid-race", "Late-race"])
		expect(facts.markers.map(({ kind, at }) => [kind, at])).toEqual([
			["position-keep-end", 500],
			["spurt-start", 800],
			["phase-divider", 1000],
		])
	})
})

describe("courses that aren't the worked example", () => {
	it("keeps a gap as a gap and calls corner -1 plain Corner (Santa Anita 2400)", () => {
		const parts = trackParts(SANTA_ANITA_2400)
		expect(parts[0]).toEqual({ start: 0, end: 200, kind: "gap", label: "" })
		expect(parts[1]).toMatchObject({ kind: "corner", label: "Corner", number: -1, start: 200, end: 700 })
		expect(derivedFacts(SANTA_ANITA_2400)).toEqual([
			"Final corner from 1,950m",
			"Final straight 300m",
			"Last spurt can start on a straight",
		])
	})

	it("reads two laps' corners and says which corner the spurt can start on (Nakayama 3600)", () => {
		const corners = trackParts(NAKAYAMA_3600).filter((part) => part.kind === "corner").map((part) => part.label)
		expect(corners).toEqual(["Corner 1", "Corner 2", "Corner 3", "Corner 4", "Corner 1", "Corner 2", "Corner 3", "Corner 4"])
		expect(trackParts(NAKAYAMA_3600).some((part) => part.kind === "gap")).toBe(false)
		// 2/3 of 3600 is 2400, on lap two's corner 2 (2225 to 2475).
		expect(derivedFacts(NAKAYAMA_3600)).toContain("Last spurt can start on corner 2")
	})

	it("marks where the ground changes, and only then", () => {
		expect(surfaceParts(TOKYO_DIRT_1600)).toEqual([
			{ start: 0, end: 100, surface: "turf" },
			{ start: 100, end: 1600, surface: "dirt" },
		])
		expect(surfaceParts(SANTA_ANITA_2400).map((part) => part.surface)).toEqual(["turf", "dirt", "turf"])
		expect(surfaceParts(CHUKYO_1200)).toEqual([])
	})
})

describe("metres to positions", () => {
	it("turns a metre into a fraction of the race, clamped to the course", () => {
		expect(metreToFraction(550, 1200)).toBeCloseTo(0.4583, 4)
		expect(metreToFraction(-5, 1200)).toBe(0)
		expect(metreToFraction(1300, 1200)).toBe(1)
	})

	it("writes metres the way the course pairs do", () => {
		expect(formatMetres(1200)).toBe("1,200m")
		expect(formatMetres(412)).toBe("412m")
	})

	it("puts about a dozen round ticks on the ruler, the finish always among them", () => {
		expect(rulerTicks(1200)).toEqual([0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200])
		expect(rulerTicks(3600)).toEqual([0, 400, 800, 1200, 1600, 2000, 2400, 2800, 3200, 3600])
		expect(rulerTicks(2500).at(-1)).toBe(2500)
		expect(rulerTicks(2100).at(-1)).toBe(2100)
	})

	it("stacks marker labels that would touch into a second lane, in the caller's order", () => {
		const markers: CourseMarker[] = [
			{ at: 900, kind: "spurt-start", label: "b" },
			{ at: 500, kind: "position-keep-end", label: "a" },
			{ at: 560, kind: "position-keep-end", label: "c" },
		]
		expect(markerLanes(markers, 1200)).toEqual([0, 0, 1])
	})
})
