import { describe, expect, it } from "vitest"
import type { Box, LabelPoint, PlacedLabel } from "../utils/forecastLabels"
import { formatLabelCarats, placeForecastLabels } from "../utils/forecastLabels"

const BOUNDS: Box = { x0: 0, y0: 0, x1: 400, y1: 200 }
const point = (key: number, x: number, y: number, text = "90.0K"): LabelPoint => ({ key, x, y, text })
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1

describe("placeForecastLabels", () => {
	it("puts a label right of its dot when that spot is clear", () => {
		const [label] = placeForecastLabels([point(1, 100, 100)], [], [], BOUNDS)
		expect(label.anchor).toBe("start")
		expect(label.box.x0).toBeGreaterThan(100)
	})

	it("moves off the line when the line runs through the right-hand spot", () => {
		// A flat line at the dot's height, as after a banner that spent nothing.
		const line = [{ x: 0, y: 100 }, { x: 400, y: 100 }]
		const [label] = placeForecastLabels([point(1, 100, 100)], [line], [], BOUNDS)
		expect(label.anchor).toBe("middle")
		expect(label.box.y1).toBeLessThan(100)
	})

	it("never lets two labels touch, and never covers a reserved box or another dot", () => {
		const points = [point(1, 100, 100), point(2, 120, 100), point(3, 140, 102), point(4, 160, 98)]
		const reserved: Box[] = [{ x0: 150, y0: 60, x1: 260, y1: 80 }]
		const placed = placeForecastLabels(points, [], reserved, BOUNDS)
		for (const [i, a] of placed.entries()) {
			for (const b of placed.slice(i + 1)) expect(overlaps(a.box, b.box), `${a.key} and ${b.key}`).toBe(false)
			expect(overlaps(a.box, reserved[0])).toBe(false)
			for (const p of points) {
				const dot = { x0: p.x - 6, y0: p.y - 6, x1: p.x + 6, y1: p.y + 6 }
				expect(overlaps(a.box, dot), `label ${a.key} over dot ${p.key}`).toBe(false)
			}
		}
	})

	it("drops a label with nowhere to go rather than stacking it", () => {
		// A strip too short for a label above or below, two dots side by side:
		// the first takes the right, the second has no clear spot left.
		const strip: Box = { x0: 0, y0: 90, x1: 200, y1: 110 }
		const placed: PlacedLabel[] = placeForecastLabels([point(1, 20, 100), point(2, 40, 100)], [], [], strip)
		expect(placed.map((label) => label.key)).toEqual([2])
	})

	it("keeps every label inside the bounds", () => {
		const [label] = placeForecastLabels([point(1, 395, 100)], [], [], BOUNDS)
		expect(label.box.x1).toBeLessThanOrEqual(BOUNDS.x1)
		expect(label.anchor).not.toBe("start")
	})
})

describe("formatLabelCarats", () => {
	it("shortens thousands to one decimal, like the axis", () => {
		expect(formatLabelCarats(140_302)).toBe("140.3K")
		expect(formatLabelCarats(47_526)).toBe("47.5K")
		expect(formatLabelCarats(850)).toBe("850")
		expect(formatLabelCarats(-1_250)).toBe("-1.3K")
	})
})
