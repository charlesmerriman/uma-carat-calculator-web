/**
 * The track view's Schematic (utils/courseSchematic.ts): a course drawn from
 * its record alone, the same 1,001 points as the real shape, turning the
 * course's own way, finish along the bottom.
 */
import { describe, expect, it } from "vitest"
import { cumulativeTurn, shapeBounds } from "../utils/courseGeometry"
import { schematicShape } from "../utils/courseSchematic"
import { CHUKYO_1200, NAKAYAMA_3600 } from "./courseFixtures"

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
