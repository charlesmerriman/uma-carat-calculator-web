/**
 * The track view's Schematic (utils/courseSchematic.ts): a course drawn from
 * its record alone, the same 1,001 points as the real shape, turning the
 * course's own way, finish along the bottom.
 */
import { describe, expect, it } from "vitest"
import { cumulativeTurn, pointAtMetre, shapeBounds } from "../utils/courseGeometry"
import { schematicShape } from "../utils/courseSchematic"
import type { RaceCourse } from "../types"
import { CHUKYO_1200, HANSHIN_2200, NAKAYAMA_2500, NAKAYAMA_3600 } from "./courseFixtures"

/** How far apart two metres of a course are drawn on its schematic, in metres. */
function apart(course: RaceCourse, a: number, b: number) {
	const shape = schematicShape(course)
	const [ax, ay] = pointAtMetre(shape, a, course.distance)
	const [bx, by] = pointAtMetre(shape, b, course.distance)
	return Math.hypot(ax - bx, ay - by)
}

describe("schematicShape", () => {
	it("draws 1,001 points from the box's corner", () => {
		const shape = schematicShape(CHUKYO_1200)
		expect(shape).toHaveLength(1001)
		const box = shapeBounds(shape)
		expect(box.minX).toBeCloseTo(0, 6)
		expect(box.minY).toBeCloseTo(0, 6)
	})

	it("turns 90 degrees a corner, the course's own way round", () => {
		// Chukyo 1200: two corners, a half turn, to the left (anticlockwise on screen).
		expect(cumulativeTurn(schematicShape(CHUKYO_1200)).at(-1)).toBeCloseTo(-180, 0)
		// Nakayama 3600: eight corners, two full turns, to the right.
		expect(cumulativeTurn(schematicShape(NAKAYAMA_3600)).at(-1)).toBeCloseTo(720, 0)
	})

	it("ends on the final straight, level, along the bottom", () => {
		const shape = schematicShape(CHUKYO_1200)
		const meanY = shape.reduce((sum, [, y]) => sum + y, 0) / shape.length
		expect(shape.at(-1)![1]).toBeGreaterThan(meanY)
		const straightStart = shape[Math.round((788 / 1200) * 1000)]
		expect(straightStart[1]).toBeCloseTo(shape.at(-1)![1], 1)
	})
})

// The track view rings later laps a fixed gap apart (withLapRings), which only
// reads when the schematic draws each lap over the same ground first. Unclosed,
// Nakayama 3600's laps sat 35 m apart, the size of the gap, and crossed on the
// bends (Daptrius, 2026-11-04). A point of the shape is 2.5 to 3.6 m here, so
// 4 m is "the same spot".
describe("schematicShape on a course of more than one lap", () => {
	it("draws the same spot on each lap in one place", () => {
		// Lap 1 and lap 2 of Nakayama 3600 (a lap is 1,685 m): corner 1's
		// entry, the back straight, the middle of corner 3.
		expect(apart(NAKAYAMA_3600, 290, 1975)).toBeLessThan(4)
		expect(apart(NAKAYAMA_3600, 700, 2385)).toBeLessThan(4)
		expect(apart(NAKAYAMA_3600, 1240, 2925)).toBeLessThan(4)
		// The gate's straight lies on the home straight, a lap before.
		expect(apart(NAKAYAMA_3600, 0, 1685)).toBeLessThan(4)
		// The race's last corner 4 is 240 m where lap 1's is 250 m, so it is a
		// touch tighter and the final straight runs 7.5 m off lap 1's home
		// straight: a quarter of the ring gap, and the record's own numbers.
		expect(apart(NAKAYAMA_3600, 1615, 3300)).toBeLessThan(10)
	})

	it("lets a race that starts inside a bend turn only the share it runs", () => {
		// Nakayama 2500's first corner is the last 146 m of the 250 m corner 3:
		// it turns 146 / 250 of 90 degrees, then five full corners. (Closing the
		// laps shears the path a little, which moves the total by about a degree.)
		const turn = cumulativeTurn(schematicShape(NAKAYAMA_2500)).at(-1)!
		expect(Math.abs(turn - ((146 / 250) * 90 + 450))).toBeLessThan(2)
		// It lies on the next lap's corner 3 (a lap is 1,704 m): where the chute
		// joins it, and its exit.
		expect(apart(NAKAYAMA_2500, 100, 1804)).toBeLessThan(4)
		expect(apart(NAKAYAMA_2500, 246, 1950)).toBeLessThan(4)
		// The chute comes in from outside the loop: the gate is outside one whole
		// lap (corner 3's exit round to the next one's), the loop's middle inside.
		const shape = schematicShape(NAKAYAMA_2500)
		const loop = Array.from({ length: 200 }, (_, i) => pointAtMetre(shape, 246 + (i / 200) * 1704, 2500))
		const inside = ([x, y]: readonly [number, number]) => {
			// Ray casting: an odd number of edges crossed to the right is inside.
			let crossings = 0
			for (let i = 0; i < loop.length; i++) {
				const [x1, y1] = loop[i]
				const [x2, y2] = loop[(i + 1) % loop.length]
				if (y1 > y !== y2 > y && x < x1 + ((y - y1) / (y2 - y1)) * (x2 - x1)) crossings++
			}
			return crossings % 2 === 1
		}
		const box = shapeBounds(loop)
		expect(inside([box.minX + box.width / 2, box.minY + box.height / 2])).toBe(true)
		expect(inside(pointAtMetre(shape, 0, 2500))).toBe(false)
	})

	it("brings a one-lap course's home straight back onto the start's line", () => {
		// Hanshin 2200 starts and finishes on the home straight: both run level
		// along the bottom, on one line, so the ring gap is all that parts them.
		const shape = schematicShape(HANSHIN_2200)
		expect(shape[0][1]).toBeCloseTo(shape.at(-1)![1], 0)
		expect(cumulativeTurn(shape).at(-1)).toBeCloseTo(360, 0)
	})
})
