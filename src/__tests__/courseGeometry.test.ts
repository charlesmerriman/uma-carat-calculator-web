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
	lapOf,
	markerLanes,
	metreToFraction,
	phaseBands,
	placeLabels,
	pointAtMetre,
	positionKeepEnd,
	rulerTicks,
	sectionBoundaries,
	slopeParts,
	spurtStart,
	surfaceParts,
	trackParts,
	withLapRings,
	type CourseMarker,
} from "../utils/courseGeometry"
import { schematicShape } from "../utils/courseSchematic"
import { CHUKYO_1200, NAKAYAMA_3600, SANTA_ANITA_2400, TOKYO_DIRT_1600 } from "./courseFixtures"

describe("Chukyo turf 1200 m, the worked example", () => {
	it("puts the phases at 1/6, 2/3 and 5/6, phase 3 a band of its own", () => {
		expect(phaseBands(1200).map(({ start, end, label }) => [label, start, end])).toEqual([
			["Early-race", 0, 200],
			["Mid-race", 200, 800],
			["Late-race", 800, 1000],
			["Last spurt", 1000, 1200],
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

	it("reads off the facts: the spurt start exactly, and the stat each hill near it rewards", () => {
		expect(derivedFacts(CHUKYO_1200)).toEqual([
			"Final corner from 550m",
			"Final straight 412m",
			"Last spurt can start on the final straight, 12m into it",
			// The uphill begins 75 m into the spurt; the downhill runs over it.
			// That uphill is also the climb in the last 400 m, said once.
			"Uphill at the late-race start: Power helps",
			"Downhill into the late race: Wit helps",
		])
	})

	it("names a climb in the last 400 m only when it isn't the spurt's own uphill", () => {
		// The uphill moved to the last 200 m: too far from the spurt to be its hill.
		const lateClimb = { ...CHUKYO_1200, slopes: [{ start: 1000, length: 150, slope: 20000 }] }
		expect(derivedFacts(lateClimb)).toContain("2% climb in the last 400m")
		expect(derivedFacts(lateClimb)).not.toContain("Uphill at the late-race start: Power helps")
	})

	it("says what the late race starts on, how much of it is left and what comes next", () => {
		const spurt = spurtStart(CHUKYO_1200)
		expect(spurt.at).toBe(800)
		expect(spurt.on).toMatchObject({ kind: "straight", label: "Final straight", left: 400 })
		expect(spurt.next).toBeUndefined()
		expect(spurt.uphill?.start).toBe(875)
		expect(spurt.downhill?.start).toBe(100)
	})

	it("hands the strip its own overlay: four phases and three markers", () => {
		const facts = courseFacts(CHUKYO_1200)
		expect(facts.spans.map((span) => span.label)).toEqual(["Early-race", "Mid-race", "Late-race", "Last spurt"])
		expect(facts.markers.map(({ kind, at }) => [kind, at])).toEqual([
			["position-keep-end", 500],
			["midpoint", 600],
			["spurt-start", 800],
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
			// 1,600 m is on the straight to 1,800 m, where corner 3 starts.
			"Last spurt can start on a straight, 200m before corner 3",
		])
	})

	it("reads two laps' corners and says which corner the spurt can start on (Nakayama 3600)", () => {
		const corners = trackParts(NAKAYAMA_3600).filter((part) => part.kind === "corner").map((part) => part.label)
		expect(corners).toEqual(["Corner 1", "Corner 2", "Corner 3", "Corner 4", "Corner 1", "Corner 2", "Corner 3", "Corner 4"])
		expect(trackParts(NAKAYAMA_3600).some((part) => part.kind === "gap")).toBe(false)
		// 2/3 of 3600 is 2400, on lap two's corner 2 (2225 to 2475).
		expect(derivedFacts(NAKAYAMA_3600)).toContain("Last spurt can start in corner 2, 75m before a straight")
	})

	it("says how little of the final corner is left at the spurt (CM 22, Tokyo dirt 1600)", () => {
		// 2/3 of 1600 is 1,066.7 m: corner 4 ends at 1,099 m, and the uphill
		// starts at 1,100 m, 33 m into the spurt.
		expect(derivedFacts(TOKYO_DIRT_1600)).toEqual([
			"Final corner from 875m",
			"Final straight 501m",
			"Last spurt can start in corner 4, 32m before the final straight",
			// Its uphill runs to 1,350 m, into the last 400 m: named once.
			"Uphill at the late-race start: Power helps",
		])
	})

	it("calls a course mostly downhill when no hill sits at the spurt", () => {
		// 650 of 1,200 m downhill, ending 150 m before the spurt.
		const mostlyDown = { ...CHUKYO_1200, slopes: [{ start: 0, length: 650, slope: -10000 }] }
		expect(derivedFacts(mostlyDown)).toContain("Mostly downhill: Wit helps")
		expect(derivedFacts(mostlyDown)).not.toContain("Downhill into the late race: Wit helps")
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
		// A phone's strip asks for half as many steps.
		expect(rulerTicks(1200, 6)).toEqual([0, 200, 400, 600, 800, 1000, 1200])
		expect(rulerTicks(3600, 6)).toEqual([0, 1000, 2000, 3000, 3600])
	})

	it("puts a metre on a path by its share of the race, between two points", () => {
		// A plain line east, 1,001 points: point i at i / 1000 of the race.
		const line = Array.from({ length: 1001 }, (_, i) => [i, 0] as const)
		expect(pointAtMetre(line, 550, 1000)).toEqual([550, 0])
		// Chukyo 1200's 550 m is point 458.3, between 458 and 459 (the plan, PR 3).
		expect(pointAtMetre(line, 550, 1200)[0]).toBeCloseTo(458.33, 2)
	})

	it("counts a lap each time the course has turned a full circle", () => {
		// Nakayama 3600 turns two full circles: its home straight is run at the
		// start, on lap two and at the finish.
		const laps = lapOf(schematicShape(NAKAYAMA_3600))
		expect(laps[0]).toBe(0)
		expect(laps.at(-1)).toBe(2)
		expect(lapOf(schematicShape(CHUKYO_1200)).every((lap) => lap === 0)).toBe(true)
	})

	it("moves each later pass a ring further in, blended across the corners before it", () => {
		const shape = schematicShape(NAKAYAMA_3600)
		const ringed = withLapRings(shape, NAKAYAMA_3600, 20)
		const moved = (metre: number) => {
			const index = Math.round((metre / 3600) * 1000)
			return Math.hypot(ringed[index][0] - shape[index][0], ringed[index][1] - shape[index][1])
		}
		// The start is lap one: untouched.
		expect(moved(0)).toBe(0)
		// Lap two's home straight (1,615 to 1,975 m), after corners 3 and 4: one ring.
		expect(moved(1800)).toBeCloseTo(20, 0)
		// The finish, after lap two's corners 3 and 4: two rings, the innermost.
		expect(moved(3600)).toBeCloseTo(40, 0)
		// Mid-way through a blend, part of a ring: the step is in the bend.
		expect(moved(1365)).toBeGreaterThan(0)
		expect(moved(1365)).toBeLessThan(20)
		const chukyo = schematicShape(CHUKYO_1200)
		expect(withLapRings(chukyo, CHUKYO_1200, 20)).toBe(chukyo)
	})

	it("rings a course that turns a little under a full circle (Nakayama 2000's real shape: 357 degrees)", () => {
		// A circle run 357 degrees: the finish runs back over the start.
		const circle = Array.from({ length: 1001 }, (_, i) => {
			const angle = ((357 * i) / 1000) * (Math.PI / 180)
			return [500 * Math.cos(angle), 500 * Math.sin(angle)] as const
		})
		const course = { ...CHUKYO_1200, distance: 2000 }
		const ringed = withLapRings(circle, course, 20)
		expect(ringed).not.toBe(circle)
		const [x, y] = circle[1000]
		expect(Math.hypot(ringed[1000][0] - x, ringed[1000][1] - y)).toBeCloseTo(20, 0)
		// The start stays where it is.
		expect(ringed[0]).toEqual(circle[0])
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

describe("placeLabels", () => {
	// One label anchored at the origin, pointing up the page (y down), 40 wide
	// and 10 tall, placed 20 out: its first spot is centred at (0, -20).
	const request = { key: "a", anchor: [0, 0] as const, direction: [0, -1] as const, width: 40, height: 10 }

	it("takes the first spot when nothing is in the way", () => {
		const { a } = placeLabels([request], 20)
		expect(a[0]).toBeCloseTo(0, 6)
		expect(a[1]).toBeCloseTo(-20, 6)
	})

	it("moves a label off the track when its first spot would lie across it", () => {
		// A stretch of track running across the page through the first spot.
		const track = { points: Array.from({ length: 21 }, (_, i) => [i * 5 - 50, -20] as const), halfWidth: 2 }
		const { a } = placeLabels([request], 20, track)
		// Its box (10 tall) clears the track (2 either side of y = -20).
		expect(Math.abs(a[1] + 20)).toBeGreaterThan(5 + 2)
	})

	it("keeps its first spot when every spot is on the track", () => {
		// Track everywhere: a grid over the whole neighbourhood.
		const points = Array.from({ length: 41 * 41 }, (_, i) => [(i % 41) * 5 - 100, Math.floor(i / 41) * 5 - 100] as const)
		const { a } = placeLabels([request], 20, { points, halfWidth: 2 })
		expect(a[1]).toBeCloseTo(-20, 6)
	})
})
