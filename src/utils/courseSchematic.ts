/**
 * The track view's Schematic: a course drawn from its record alone
 * (notes/course-map-plan.md, "The track view"). Each straight is a line of its
 * length, each corner an arc of its length turning 90 degrees (a turn is two
 * corners), the course's own way round; a gap the game leaves runs straight.
 * A course of more than one lap has each lap put back over the first lap's
 * ground (closeLaps), so the track view's rings have clean passes to pull
 * apart. Laid out like the real shape, finish along the bottom, in the same 1,001
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
	// A race can start partway round a bend: Nakayama 2500's gate is on a chute
	// that joins the loop inside corner 3, so the record's first corner is 146 m
	// where the same corner a lap later is 250 m. That first corner turns only
	// the share of 90 degrees it runs (the longer twin is the whole bend), so it
	// has the bend's real radius and lies on the next lap's corner 3; the
	// straight before it then comes in along the bend's tangent, outside the
	// loop, as a chute does. Every other corner turns 90 degrees.
	const corners = [...course.corners].sort((a, b) => a.start - b.start)
	const opener = corners[0]
	const twin = opener && opener.number > 0 ? corners.slice(1).find((corner) => corner.number === opener.number) : undefined
	const openerShare = twin && twin.length > opener.length ? opener.length / twin.length : 1
	const partAt = (metre: number) => parts.find((candidate) => metre >= candidate.start && metre < candidate.end)
	const turnRate = (metre: number) => {
		const part = partAt(metre)
		if (!part || part.kind !== "corner") return 0
		const share = part.start === opener.start ? openerShare : 1
		return (sign * share * (Math.PI / 2)) / (part.end - part.start)
	}

	const points: [number, number][] = []
	const headings: number[] = []
	let x = 0
	let y = 0
	let heading = 0
	let metre = 0
	for (let i = 0; i < POINTS; i++) {
		const target = (i / (POINTS - 1)) * course.distance
		while (metre < target) {
			// A step never runs past the end of its part, so a corner turns exactly
			// its share and no more (a step across a corner's end over-turned it by
			// up to a quarter of a degree, a few metres off by the next straight's end).
			const step = Math.min(STEP, target - metre, (partAt(metre)?.end ?? Infinity) - metre)
			heading += turnRate(metre) * step
			x += Math.cos(heading) * step
			y += Math.sin(heading) * step
			metre += step
		}
		points.push([x, y])
		headings.push(heading)
	}
	return normaliseShape(closeLaps(points, headings, openerShare * (Math.PI / 2)), course.distance, finalStraight(course)?.start)
}

// How far short of a corner's exit its anchor sits, so a straight (where the
// heading doesn't change) never holds it.
const ANCHOR_TURN = (0.5 * Math.PI) / 180

/**
 * Put every lap back over the first lap's ground. A lap of the schematic only
 * closes when its opposite straights match and its opposite bends have equal
 * radii, which the game's numbers almost never give: Nakayama 3600's lap
 * misses by 35 m, Kyoto 3200's by 76 m, Hanshin 3200's (outer course, then
 * inner) by 230 m. That miss is the size of the ring gap, so on the bends it
 * cancels the gap and the laps run on top of each other or cross
 * (Daptrius, 2026-11-04: "Schematic view kinda dies on multi lap tracks").
 *
 * Laps are matched by how far the course has TURNED: lap k's anchor is where
 * the course has turned k full circles plus the race's first corner, less
 * ANCHOR_TURN, just short of that corner's exit on each lap. An exit, not an
 * entry: a race that starts partway round its first bend (Nakayama 2500)
 * shares that bend's exit with the next lap but not its entry. Matching by
 * turn also keeps a course whose laps differ in length (Hanshin 3200, outer
 * course then inner) in step.
 *
 * Each lap's miss is spread evenly along it (a surveyor's traverse closure),
 * by its metres, so nothing kinks. Every point gets the SAME share of the
 * miss as the point one lap before it, plus that lap's whole miss: that is
 * what puts the passes on one line everywhere, not just at the anchors. A
 * lap's displacement is the same wherever along the lap you start counting
 * (its heading comes back to where it began), so the gate's straight, before
 * the first anchor, and the last part, after the final one, take the
 * nearest lap's rate carried on; they land on the home straight with the rest.
 *
 * A course that turns one full circle and no more (Hanshin 2200, Chukyo dirt
 * 1800) has no second anchor to measure a lap by. Its home straight should
 * still run along the start's line, so only the miss ACROSS that line is
 * spread, over the lap's corners; the miss along it is the straights' lengths,
 * which the schematic keeps. withLapRings then pulls the passes apart.
 */
function closeLaps(points: [number, number][], headings: number[], openerTurn: number): [number, number][] {
	const firstAtTurn = (turn: number) => headings.findIndex((heading) => Math.abs(heading) >= turn)
	const anchors: number[] = []
	for (let lap = 0; ; lap++) {
		const index = firstAtTurn(lap * 2 * Math.PI + openerTurn - ANCHOR_TURN)
		if (index === -1) break
		anchors.push(index)
	}
	if (anchors.length === 0) return points

	const shift = (correction: (index: number) => [number, number]) =>
		points.map(([x, y], index) => {
			const [cx, cy] = correction(index)
			return [x - cx, y - cy] as [number, number]
		})

	if (anchors.length === 1) {
		// One circle at most. Only a course that turns all the way round comes
		// back onto its start's line; the anchor's twin is its last corner's exit.
		const end = firstAtTurn(2 * Math.PI - ANCHOR_TURN)
		if (end === -1) return points
		// How far the finish sits off the line the start runs along (the start's
		// normal: heading 0 at the gate, so straight down the page's y).
		const [x0, y0] = points[0]
		const nx = -Math.sin(headings[0])
		const ny = Math.cos(headings[0])
		const [xl, yl] = points[points.length - 1]
		const off = (xl - x0) * nx + (yl - y0) * ny
		const start = anchors[0]
		return shift((index) => {
			const share = Math.min(1, Math.max(0, (index - start) / (end - start)))
			return [nx * off * share, ny * off * share]
		})
	}

	// Lap k: from anchor k to anchor k + 1, its length in points and its miss.
	const laps = anchors.slice(1).map((end, k) => {
		const start = anchors[k]
		return { start, length: end - start, dx: points[end][0] - points[start][0], dy: points[end][1] - points[start][1] }
	})
	const first = laps[0]
	const last = laps[laps.length - 1]
	const lastAnchor = anchors[anchors.length - 1]
	return shift((index) => {
		let cx = 0
		let cy = 0
		// Each lap: none of its miss before it, rising evenly to all of it at its end.
		for (const lap of laps) {
			const share = Math.min(1, Math.max(0, (index - lap.start) / lap.length))
			cx += lap.dx * share
			cy += lap.dy * share
		}
		// Before the first anchor (negative) and after the last: the nearest lap's rate.
		if (index < first.start) {
			const share = (index - first.start) / first.length
			cx += first.dx * share
			cy += first.dy * share
		}
		if (index > lastAnchor) {
			const share = (index - lastAnchor) / last.length
			cx += last.dx * share
			cy += last.dy * share
		}
		return [cx, cy]
	})
}
