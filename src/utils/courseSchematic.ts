/**
 * The track view's Schematic: a course drawn from its record alone
 * (notes/course-map-plan.md, "The track view"). Each straight is a line of its
 * length, each corner an arc of its length turning 90 degrees (a turn is two
 * corners), the course's own way round; a gap the game leaves runs straight.
 * Laid out like the real shape, finish along the bottom, in the same 1,001
 * points, so everything drawn on one draws on the other.
 *
 * It is an honest "what comes in what order" picture, never the geography:
 * for a course with no real shape, for a reader who prefers it plain, and as
 * the fallback while a guide (which carries the real shape) isn't loaded.
 */
import type { RaceCourse } from "../types"
import { finalStraight, normaliseShape, trackParts, type Shape } from "./courseGeometry"

const POINTS = 1001
// Integration step, in metres: fine enough that the arcs look round.
const STEP = 1

export function schematicShape(course: RaceCourse): Shape {
	const parts = trackParts(course)
	// Clockwise on screen (y down) is a positive turn: right-handed courses.
	const sign = course.direction === "left" ? -1 : 1
	const turnRate = (metre: number) => {
		const part = parts.find((candidate) => metre >= candidate.start && metre < candidate.end)
		if (!part || part.kind !== "corner") return 0
		return (sign * (Math.PI / 2)) / (part.end - part.start)
	}

	const points: [number, number][] = []
	let x = 0
	let y = 0
	let heading = 0
	let metre = 0
	for (let i = 0; i < POINTS; i++) {
		const target = (i / (POINTS - 1)) * course.distance
		while (metre < target) {
			const step = Math.min(STEP, target - metre)
			heading += turnRate(metre) * step
			x += Math.cos(heading) * step
			y += Math.sin(heading) * step
			metre += step
		}
		points.push([x, y])
	}
	return normaliseShape(points, course.distance, finalStraight(course)?.start)
}
