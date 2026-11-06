/**
 * The course map's geometry: the ONE place a metre becomes a position, and the
 * course's own facts read off its record (notes/course-map-plan.md, "Groundwork
 * for the later layers").
 *
 * Everything the map shows that the API doesn't send is derived here: the
 * phases, the 24 sections, where position keep ends, the hills' heights, the
 * chips under the strip. The strip, the track view, the animation and every
 * later layer read these functions, so a rule changes in one place. Pure, no
 * DOM: /app/pvp is prerendered, so nothing here may measure an element.
 *
 * The game's fractions are a parameter with the game's values as the default
 * (GAME_GEOMETRY), never a number buried in a function.
 */
import type { RaceCourse } from "../types"

/** The race's fixed fractions. Backed by Daptrius's renders and GameTora (the plan, "Backed now"). */
export interface RaceGeometry {
	/** Where Mid-race, Late-race and the final sixth start, as fractions of the distance. */
	phaseStarts: readonly [number, number, number]
	/** The race is cut into this many equal sections. */
	sections: number
	/** Position keep ends after this many sections. */
	positionKeepSections: number
}

export const GAME_GEOMETRY: RaceGeometry = {
	phaseStarts: [1 / 6, 2 / 3, 5 / 6],
	sections: 24,
	positionKeepSections: 10,
}

// ── The overlay contract ────────────────────────────────────────────────────
// What every renderer draws on top of the record: spans and markers in
// metres, nothing else. The course's own facts are the first overlay
// (courseFacts); a later layer (skill zones, veterans, pins) is a pure
// function to this same shape, so the map never changes for it.

// "window": a band a skill must fire in for a reason (the carry-over window).
export type SpanKind = "phase" | "fixed" | "random" | "point" | "anywhere" | "passive" | "window"
export interface CourseSpan {
	start: number
	end: number
	kind: SpanKind
	label?: string
	lane?: number
	/** Words for a hover: a lit skill's verdict (courseLayers.verdictLines). */
	detail?: string
	/** The layer's colour (a veteran's, or the lit skill's); the strip's default is the lit colour. */
	colour?: string
	/** Which group of spans this belongs to (the lit skill, one veteran): the track draws one arc per group. */
	group?: string
	/** The skill's icon, drawn at the span's start on the track and before its name on the strip. */
	image?: string | null
}

export type MarkerKind = "spurt-start" | "position-keep-end" | "midpoint" | "heal-check"
export interface CourseMarker {
	at: number
	kind: MarkerKind
	/** Empty for a plain divider line. */
	label: string
}

export interface CourseOverlays {
	spans: CourseSpan[]
	markers: CourseMarker[]
}

// ── Metres ──────────────────────────────────────────────────────────────────

/** A metre mark as a fraction of the race, clamped to the course. */
export function metreToFraction(metre: number, distance: number): number {
	if (distance <= 0) return 0
	return Math.min(1, Math.max(0, metre / distance))
}

/** "1,200m", the way the course pairs above the strip write metres. */
export function formatMetres(metres: number): string {
	return `${Math.round(metres).toLocaleString("en-US")}m`
}

/** The metre ruler's ticks: about a dozen, on round numbers, ending at the finish. */
export function rulerTicks(distance: number, maxSteps = 12): number[] {
	// 400 is there for 3200 and 3600, which land on it exactly. A phone's strip
	// asks for about half as many steps (`maxSteps`), so its numbers don't touch.
	const step = [100, 200, 250, 400, 500, 1000].find((candidate) => distance / candidate <= maxSteps) ?? 1000
	const ticks: number[] = []
	for (let at = 0; at <= distance; at += step) ticks.push(at)
	// The finish always gets its number: after the last tick, or in place of
	// one too close to it to read.
	const last = ticks[ticks.length - 1]
	if (last !== distance) {
		if (distance - last < step / 2) ticks[ticks.length - 1] = distance
		else ticks.push(distance)
	}
	return ticks
}

// ── The race's own fractions ────────────────────────────────────────────────

/** Where Mid-race, Late-race and the final sixth start, in metres. */
export function phaseStarts(distance: number, geometry: RaceGeometry = GAME_GEOMETRY) {
	const [mid, late, finalSixth] = geometry.phaseStarts
	return { mid: distance * mid, late: distance * late, finalSixth: distance * finalSixth }
}

/**
 * The four phases. Phase 3 (5/6 to the finish, sections 21 to 24) gets its own
 * band (Daptrius, 2026-11-03: the diagrams were "missing phase 3"), named Last
 * spurt (owner, 2026-11-03). The last spurt itself can start at the 2/3 point,
 * section 17 (Daptrius, the same day): that is the "Last spurt" marker.
 */
export function phaseBands(distance: number, geometry: RaceGeometry = GAME_GEOMETRY): CourseSpan[] {
	const { mid, late, finalSixth } = phaseStarts(distance, geometry)
	return [
		{ start: 0, end: mid, kind: "phase", label: "Early-race" },
		{ start: mid, end: late, kind: "phase", label: "Mid-race" },
		{ start: late, end: finalSixth, kind: "phase", label: "Late-race" },
		{ start: finalSixth, end: distance, kind: "phase", label: "Last spurt" },
	]
}

/** The section boundaries, from 0 to the finish. */
export function sectionBoundaries(distance: number, geometry: RaceGeometry = GAME_GEOMETRY): number[] {
	return Array.from({ length: geometry.sections + 1 }, (_, i) => (distance * i) / geometry.sections)
}

/** Where position keep ends: after 10 of the 24 sections. */
export function positionKeepEnd(distance: number, geometry: RaceGeometry = GAME_GEOMETRY): number {
	return (distance * geometry.positionKeepSections) / geometry.sections
}

// ── The record, as parts along the race ─────────────────────────────────────

/** A slope's raw value as a percent: 20000 is 2. */
export function slopePercent(raw: number): number {
	return raw / 10000
}

export interface SlopePart {
	start: number
	end: number
	kind: "uphill" | "downhill"
	percent: number
	label: string
}

/** The hills, in race order, labelled the game's way: "Uphill 2%". */
export function slopeParts(course: RaceCourse): SlopePart[] {
	return [...course.slopes]
		.sort((a, b) => a.start - b.start)
		.map((slope) => {
			const percent = Math.abs(slopePercent(slope.slope))
			const kind = slope.slope > 0 ? "uphill" : "downhill"
			return {
				start: slope.start,
				end: slope.start + slope.length,
				kind,
				percent,
				label: `${kind === "uphill" ? "Uphill" : "Downhill"} ${percent}%`,
			}
		})
}

export interface TrackPart {
	start: number
	end: number
	kind: "straight" | "corner" | "gap"
	label: string
	/** The game's corner number, on a corner. */
	number?: number
}

/**
 * The straights and corners in race order, with the gaps the game leaves
 * between them as parts of their own (drawn as gaps, never filled in). The
 * last straight that runs to the finish is the final straight; a corner keeps
 * the game's number, and a -1 reads plain "Corner" (a normal corner, Daptrius,
 * 2026-11-02, but "-1" means nothing to a player).
 */
export function trackParts(course: RaceCourse): TrackPart[] {
	const final = finalStraight(course)
	const parts: TrackPart[] = [
		...course.straights.map((straight) => ({
			start: straight.start,
			end: straight.start + straight.length,
			kind: "straight" as const,
			label: straight === final ? "Final straight" : "Straight",
		})),
		...course.corners.map((corner) => ({
			start: corner.start,
			end: corner.start + corner.length,
			kind: "corner" as const,
			label: corner.number > 0 ? `Corner ${corner.number}` : "Corner",
			number: corner.number,
		})),
	].sort((a, b) => a.start - b.start)

	const withGaps: TrackPart[] = []
	let reached = 0
	for (const part of parts) {
		if (part.start > reached) withGaps.push({ start: reached, end: part.start, kind: "gap", label: "" })
		withGaps.push(part)
		reached = Math.max(reached, part.end)
	}
	if (reached < course.distance) withGaps.push({ start: reached, end: course.distance, kind: "gap", label: "" })
	return withGaps
}

/** The straight that runs to the finish, if the course has one. */
export function finalStraight(course: RaceCourse) {
	const last = [...course.straights].sort((a, b) => a.start - b.start).at(-1)
	// A metre of slack: the game's numbers are whole metres.
	return last && last.start + last.length >= course.distance - 1 ? last : undefined
}

/** The last corner in race order: the final corner. */
export function finalCorner(course: RaceCourse) {
	return [...course.corners].sort((a, b) => a.start - b.start).at(-1)
}

export interface SurfacePart {
	start: number
	end: number
	surface: "turf" | "dirt"
}

/**
 * The ground along the race, only when it changes: Tokyo dirt 1600 (CM 22) is
 * turf for its first 100 m. Empty for a course on one surface.
 */
export function surfaceParts(course: RaceCourse): SurfacePart[] {
	if (course.surface_changes.length === 0) return []
	const changes = [...course.surface_changes].sort((a, b) => a.start - b.start)
	const parts: SurfacePart[] = []
	let start = 0
	let surface: SurfacePart["surface"] = course.surface
	for (const change of changes) {
		if (change.start > start) parts.push({ start, end: change.start, surface })
		start = change.start
		surface = change.surface
	}
	parts.push({ start, end: course.distance, surface })
	return parts
}

export interface ElevationPoint {
	at: number
	/** Metres above the start. */
	height: number
}

/**
 * The course's height along the race, from its slopes: each climbs or falls
 * its percent over its length, and the ground between them is flat. Relative
 * to the start; the strip scales it to fit.
 */
export function elevationProfile(course: RaceCourse): ElevationPoint[] {
	const points: ElevationPoint[] = [{ at: 0, height: 0 }]
	let height = 0
	for (const slope of [...course.slopes].sort((a, b) => a.start - b.start)) {
		points.push({ at: slope.start, height })
		height += (slope.length * slopePercent(slope.slope)) / 100
		points.push({ at: slope.start + slope.length, height })
	}
	points.push({ at: course.distance, height })
	return points
}

// ── What the strip says about the course ────────────────────────────────────

/** The course's own overlay: the phases and the three markers. */
export function courseFacts(course: RaceCourse, geometry: RaceGeometry = GAME_GEOMETRY): CourseOverlays {
	const { late } = phaseStarts(course.distance, geometry)
	return {
		spans: phaseBands(course.distance, geometry),
		markers: [
			{ at: positionKeepEnd(course.distance, geometry), kind: "position-keep-end", label: "Position keep ends" },
			// Halfway: the point "the second half" and "from half the race" skills
			// wait for (Daptrius's render's midpoint, owner 2026-11-03).
			{ at: course.distance / 2, kind: "midpoint", label: "Halfway" },
			// Section 17, the 2/3 point, where the last spurt can start
			// (Daptrius, 2026-11-03).
			{ at: late, kind: "spurt-start", label: "Last spurt" },
		],
	}
}

/** Which part of the track a metre falls on: the later part at a boundary. */
function partAt(parts: TrackPart[], metre: number): TrackPart | undefined {
	return parts.find((part) => metre >= part.start && metre < part.end) ?? parts.at(-1)
}

// How near the late-race start a hill must be to count as "at the spurt
// start" in the chips: a presentation choice, not a game rule
// (notes/course-map-plan-2.md, section 1).
const SPURT_HILL_REACH = 100

export interface SpurtStart {
	/** The late-race start, in metres: where the last spurt can start. */
	at: number
	/** The part it falls on, and the metres of that part after `at`. */
	on: TrackPart & { left: number }
	/** The next straight or corner after it and how far ahead it starts; none when `on` runs to the finish. */
	next?: TrackPart & { in: number }
	/** An uphill under the start or beginning within its first SPURT_HILL_REACH metres. */
	uphill?: SlopePart
	/** A downhill under the start or ending within SPURT_HILL_REACH metres before it. */
	downhill?: SlopePart
}

/**
 * What the late race starts on, the map's first job (owner, 2026-11-03: the
 * game rewards acceleration that fires just as the last spurt starts, and what
 * the start falls on decides which accels can). CM 25: corner 4 with 8 m left.
 */
export function spurtStart(course: RaceCourse, geometry: RaceGeometry = GAME_GEOMETRY): SpurtStart {
	const { late: at } = phaseStarts(course.distance, geometry)
	const parts = trackParts(course)
	const on = partAt(parts, at) ?? { start: 0, end: course.distance, kind: "gap" as const, label: "" }
	const next = parts.find((part) => part.kind !== "gap" && part.start >= on.end)
	const slopes = slopeParts(course)
	return {
		at,
		on: { ...on, left: on.end - at },
		next: next && { ...next, in: next.start - at },
		uphill: slopes.find((slope) => slope.kind === "uphill" && slope.start <= at + SPURT_HILL_REACH && slope.end > at),
		downhill: slopes.find((slope) => slope.kind === "downhill" && slope.start <= at && slope.end >= at - SPURT_HILL_REACH),
	}
}

/** A part as the chips name it: "corner 4", "the final straight", "a straight". */
function partName(part: TrackPart): string {
	if (part.kind === "corner") return part.number && part.number > 0 ? `corner ${part.number}` : "a corner"
	return part.label === "Final straight" ? "the final straight" : "a straight"
}

/**
 * The spurt sentence: what the start falls on and how far the next part is.
 * "Last spurt can start": the 2/3 point, under the "Last spurt" marker (owner,
 * 2026-11-03); on the final straight it counts into the straight, not to the
 * goal.
 */
function spurtChip(spurt: SpurtStart): string | null {
	const { on, next } = spurt
	const ahead = next ? `, ${formatMetres(next.in)} before ${partName(next)}` : ""
	if (on.kind === "corner") return `Last spurt can start in ${partName(on)}${ahead}`
	if (on.kind === "straight") {
		return on.label === "Final straight"
			? `Last spurt can start on the final straight, ${formatMetres(spurt.at - on.start)} into it`
			: `Last spurt can start on a straight${ahead}`
	}
	return next ? `Last spurt can start ${formatMetres(next.in)} before ${partName(next)}` : null
}

/**
 * The chips under the strip: what a player reads off the course without
 * counting. Plain sentences in the game's words (copy.md). The slope chips
 * name the stat a hill near the spurt rewards (owner, 2026-11-03: stat hints
 * in the chips only): Power on an uphill, Wit on a downhill (GameTora).
 */
export function derivedFacts(course: RaceCourse, geometry: RaceGeometry = GAME_GEOMETRY): string[] {
	const facts: string[] = []
	const corner = finalCorner(course)
	if (corner) facts.push(`Final corner from ${formatMetres(corner.start)}`)
	const straight = finalStraight(course)
	if (straight) facts.push(`Final straight ${formatMetres(straight.length)}`)

	const spurt = spurtStart(course, geometry)
	const chip = spurtChip(spurt)
	if (chip) facts.push(chip)
	if (spurt.uphill) facts.push("Uphill at the late-race start: Power helps")
	const slopes = slopeParts(course)
	const downhillMetres = slopes.filter((slope) => slope.kind === "downhill").reduce((sum, slope) => sum + slope.end - slope.start, 0)
	if (spurt.downhill) facts.push("Downhill into the late race: Wit helps")
	else if (downhillMetres >= course.distance / 2) facts.push("Mostly downhill: Wit helps")

	// The steepest climb that reaches into the last 400 m, unless it is the
	// hill the spurt line already named (owner, 2026-11-03: say it once).
	const lastStretch = course.distance - 400
	const climb = slopes
		.filter((slope) => slope.kind === "uphill" && slope.end > lastStretch)
		.sort((a, b) => b.percent - a.percent)[0]
	if (climb && climb.start !== spurt.uphill?.start) facts.push(`${climb.percent}% climb in the last 400m`)
	return facts
}

/**
 * Lanes for marker labels so two near each other don't overlap: a label takes
 * the first lane where the previous label is at least `minGap` (a fraction of
 * the race) behind it.
 */
export function markerLanes(markers: CourseMarker[], distance: number, minGap = 0.18): number[] {
	const lanes = new Array<number>(markers.length).fill(0)
	const lastInLane: number[] = []
	// In race order, whatever order a layer handed them in; the answer comes
	// back in the caller's order.
	const order = markers.map((_, index) => index).sort((a, b) => markers[a].at - markers[b].at)
	for (const index of order) {
		const at = metreToFraction(markers[index].at, distance)
		let lane = lastInLane.findIndex((previous) => at - previous >= minGap)
		if (lane === -1) lane = lastInLane.length
		lastInLane[lane] = at
		lanes[index] = lane
	}
	return lanes
}

// ── The track view: positions on a path ────────────────────────────────────
// A shape is the course's path in screen axes (y down, finish along the
// bottom), metres, 1,001 points: point i at i / 1000 of the race. The real
// one comes from the API (services/courseQueries.ts), the schematic from
// utils/courseSchematic.ts; both read through these functions.

export type ShapePoint = readonly [number, number]
export type Shape = readonly ShapePoint[]

/** Where a metre mark sits on a shape: point m / distance × 1000, interpolated. */
export function pointAtMetre(shape: Shape, metre: number, distance: number): [number, number] {
	const last = shape.length - 1
	const at = metreToFraction(metre, distance) * last
	const below = Math.floor(at)
	const above = Math.min(last, below + 1)
	const t = at - below
	const [x0, y0] = shape[below]
	const [x1, y1] = shape[above]
	return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]
}

/** The shape's box: its size and where it starts. */
export function shapeBounds(shape: Shape) {
	const xs = shape.map(([x]) => x)
	const ys = shape.map(([, y]) => y)
	const minX = Math.min(...xs)
	const minY = Math.min(...ys)
	return { minX, minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY }
}

/**
 * The total turn up to each point, in degrees, positive clockwise on screen.
 * A course passes the same ground again once it has turned a full circle,
 * which is how the laps are found on any shape.
 */
export function cumulativeTurn(shape: Shape): number[] {
	const turns = [0]
	let total = 0
	let previous: number | null = null
	for (let i = 1; i < shape.length; i++) {
		const [x0, y0] = shape[i - 1]
		const [x1, y1] = shape[i]
		if (x0 === x1 && y0 === y1) {
			turns.push(total)
			continue
		}
		const heading = Math.atan2(y1 - y0, x1 - x0)
		if (previous !== null) total += ((heading - previous + 3 * Math.PI) % (2 * Math.PI)) - Math.PI
		previous = heading
		turns.push((total * 180) / Math.PI)
	}
	return turns
}

// How far short of a full circle still counts as one. A course that starts and
// finishes on its home straight turns a little under 360 on its real shape
// (Nakayama 2000: 357.1; Nakayama 3600: 716.8 for two), and 10 degrees clears
// that without reaching the next course up (540, 549.5 or 557.9).
const TURN_SLACK = 10

/** Which lap each point is on, from 0: a lap ends each time the course has turned 360 degrees. */
export function lapOf(shape: Shape): number[] {
	return cumulativeTurn(shape).map((turn) => Math.max(0, Math.floor((Math.abs(turn) + TURN_SLACK) / 360)))
}

/** 0 to 1, easing in and out: how far through a blend a point is. */
function smoothstep(t: number): number {
	const clamped = Math.min(1, Math.max(0, t))
	return clamped * clamped * (3 - 2 * clamped)
}

/**
 * A course over one lap with each later lap drawn as its own ring, inside or
 * outside lap one (`later_laps`, chosen per course; owner, 2026-11-02), so
 * the passes don't sit on top of each other. Daptrius's method: the step to
 * the next ring is blended across the next two corners, so it hides in a bend
 * instead of kinking a straight. `gap` is the distance between rings, in the
 * shape's metres. A one-lap course comes back unchanged.
 */
export function withLapRings(shape: Shape, course: RaceCourse, gap: number): Shape {
	const turns = cumulativeTurn(shape).map(Math.abs)
	const total = cumulativeTurn(shape).at(-1) ?? 0
	// Each full circle the course turns past the first puts it back over
	// ground it has run: one more ring.
	const rings = Math.floor((Math.abs(total) + TURN_SLACK) / 360)
	if (rings === 0) return shape
	const last = shape.length - 1
	const metreOf = (index: number) => (index / last) * course.distance
	const firstAt = (turn: number) => {
		const index = turns.findIndex((value) => value >= turn)
		return metreOf(index === -1 ? last : index)
	}

	// Ring k blends in over the half turn (two corners) before the course has
	// turned k full circles, so it is in place by the time the course is back
	// over old ground, and the step hides in the bend. Measured from the lap
	// boundary instead, the last ring of a course that finishes on its home
	// straight would have to blend along the straight.
	const blends = Array.from({ length: rings }, (_, k) => {
		const from = firstAt(360 * (k + 1) - 180)
		const to = firstAt(360 * (k + 1) - TURN_SLACK)
		return { from, to: Math.max(to, from + 1) }
	})

	// Inside a clockwise course is to the right of travel; the sign of the
	// total turn says which way this one goes.
	const inward = total >= 0 ? 1 : -1
	const side = course.later_laps === "outside" ? -inward : inward

	return shape.map(([x, y], index) => {
		const metre = metreOf(index)
		const offset = blends.reduce((sum, blend) => sum + smoothstep((metre - blend.from) / (blend.to - blend.from)), 0)
		if (offset === 0) return [x, y] as const
		const [ax, ay] = shape[Math.max(0, index - 1)]
		const [bx, by] = shape[Math.min(last, index + 1)]
		const length = Math.hypot(bx - ax, by - ay) || 1
		// The right-hand normal of travel in screen axes (y down).
		const nx = (-(by - ay) / length) * side
		const ny = ((bx - ax) / length) * side
		return [x + nx * gap * offset, y + ny * gap * offset] as const
	})
}

/**
 * Lay a path in screen axes the way the API's shapes are (course_shapes.py
 * to_screen): the home straight level along the bottom, the box at 0, 0.
 * For the schematic, which is built here; the real shape arrives done.
 */
export function normaliseShape(points: Shape, distance: number, finalStraightStart?: number): Shape {
	const last = points.length - 1
	const first = finalStraightStart !== undefined && finalStraightStart < distance
		? Math.round((finalStraightStart / distance) * last)
		: Math.round(0.9 * last)
	const [ax, ay] = points[first]
	const [bx, by] = points[last]
	const angle = -Math.atan2(by - ay, bx - ax)
	const rotate = (turn: number) => points.map(([x, y]) => [
		x * Math.cos(turn) - y * Math.sin(turn),
		x * Math.sin(turn) + y * Math.cos(turn),
	] as const)
	const finishBelow = (candidate: Shape) =>
		candidate[last][1] - candidate.reduce((sum, [, y]) => sum + y, 0) / candidate.length
	const level = rotate(angle)
	const flipped = rotate(angle + Math.PI)
	const chosen = finishBelow(flipped) > finishBelow(level) + 1 ? flipped : level
	const { minX, minY } = shapeBounds(chosen)
	return chosen.map(([x, y]) => [x - minX, y - minY] as const)
}

export interface LabelRequest {
	key: string
	/** The point on the track the label belongs to. */
	anchor: readonly [number, number]
	/** Which way is "away from the track" there (a unit vector). */
	direction: readonly [number, number]
	/** The label's estimated box, in the shape's units. */
	width: number
	height: number
	/** Its own first distance out, when it needs more than the shared one (a chip that must clear the track by a margin). */
	reach?: number
	/** Keeps no margin from the track (options.margin), only off the track itself: the spurt chip, inside a curve with no room for one. */
	noMargin?: boolean
}

/** Points a chip must keep clear of, and how far either side of them is too near. */
export interface KeepOut {
	points: readonly (readonly [number, number])[]
	halfWidth: number
}

export interface PlaceLabelsOptions {
	/**
	 * The clear air wanted round the track, wider than `track` (which is the
	 * track itself): a spot inside it is a small fault, worth taking over a
	 * spot on another chip, on the track or out of the box.
	 */
	margin?: KeepOut
	/** More things no chip may cover: the hill brackets and their ticks, the layer arcs. */
	keepOut?: KeepOut[]
	/** The box every chip must fit inside (the drawing's). */
	bounds?: { x: number; y: number; width: number; height: number }
	/**
	 * The track a leader must not cut across on its way out to its chip. A
	 * leader runs from the anchor to the chip, so the first stretch of it (two
	 * half-widths from the anchor) is its own spot and never counts.
	 */
	leaderTrack?: KeepOut
}

// How far out (in `distance`s) and how far round (in radians either side of
// straight out) a chip may go looking for room, in the order tried. The wide
// swings let a crowded chip slide along to the next clear stretch with a
// longer leader, the way the spurt chip does (Henry, 2026-11-06: Corner 4's
// chip "next to corner 3 with a long line").
const REACHES = [1, 1.5, 2.1, 2.8, 3.6, 4.6]
// At each reach, in order: straight out, swung a little, slid sideways by part
// of the chip's own width (along the track, so two chips that want one stretch
// sit side by side), swung further, slid further, swung furthest.
const MOVES: ({ swing: number } | { slide: number })[] = [
	{ swing: 0 }, { swing: 0.45 }, { swing: -0.45 },
	{ slide: 0.6 }, { slide: -0.6 },
	{ swing: 0.9 }, { swing: -0.9 },
	{ slide: 1.2 }, { slide: -1.2 },
	{ swing: 1.35 }, { swing: -1.35 },
]
// What each fault costs a spot. A spot that spills out of the box is worst
// (the box would clamp it back onto whatever is there), then one on another
// chip (it hides words), then one on the track, then one inside the margin
// or over a hill's bracket, then a leader that cuts across the track. The
// cheapest spot wins when none is clear.
const COST = { outside: 8, chip: 6, track: 5, margin: 2, keepOut: 2, leader: 1 }

/**
 * Where each callout goes so none overlaps another: tried in the order given
 * (most important first), each at its preferred distance out from the track,
 * then further out and swung to either side, taking the first spot that is
 * clear. Sizes are estimates from the text, since nothing on a prerendered
 * page may be measured. Returns the centre of each label.
 *
 * `track` (optional) is the drawn path and how far either side of it counts
 * as on it: a spot whose box covers a point of it isn't clear either, so a
 * wide chip near a bend moves further out instead of lying across the track.
 * `options` adds the other things a spot must keep clear of (see
 * PlaceLabelsOptions). When no spot is clear the label takes the one with the
 * fewest faults (COST), the earliest on a tie, so with nothing but the track
 * in the way it keeps its first spot, as before.
 */
export function placeLabels(
	requests: LabelRequest[],
	distance: number,
	track?: KeepOut,
	options: PlaceLabelsOptions = {},
): Record<string, [number, number]> {
	const { margin, keepOut = [], bounds, leaderTrack } = options
	const placed: { x: number; y: number; w: number; h: number }[] = []
	const result: Record<string, [number, number]> = {}
	// A box centred at (x, y), w by h, comes within `zone.halfWidth` of a point of the zone.
	const covers = (zone: KeepOut, x: number, y: number, w: number, h: number) =>
		zone.points.some(([px, py]) => Math.abs(px - x) < w / 2 + zone.halfWidth && Math.abs(py - y) < h / 2 + zone.halfWidth)
	const outside = (x: number, y: number, w: number, h: number) =>
		!!bounds && (x - w / 2 < bounds.x || x + w / 2 > bounds.x + bounds.width || y - h / 2 < bounds.y || y + h / 2 > bounds.y + bounds.height)
	// Does the line from the anchor to the chip pass over the track somewhere
	// past the anchor's own spot? Sampled every half-width, stopping at the chip's edge.
	const leaderCrosses = (anchor: readonly [number, number], x: number, y: number, w: number, h: number) => {
		if (!leaderTrack) return false
		const [ax, ay] = anchor
		const length = Math.hypot(x - ax, y - ay)
		const skip = leaderTrack.halfWidth * 2
		const steps = Math.min(48, Math.ceil(length / leaderTrack.halfWidth))
		for (let step = 1; step < steps; step++) {
			const px = ax + ((x - ax) * step) / steps
			const py = ay + ((y - ay) * step) / steps
			if (Math.hypot(px - ax, py - ay) < skip) continue
			if (Math.abs(px - x) < w / 2 && Math.abs(py - y) < h / 2) break
			if (leaderTrack.points.some(([qx, qy]) => Math.hypot(qx - px, qy - py) < leaderTrack.halfWidth)) return true
		}
		return false
	}
	// `beat`: the best cost so far, so the slow leader check runs only when it could change the winner.
	const cost = (request: LabelRequest, x: number, y: number, beat: number) => {
		const { width: w, height: h } = request
		let total = 0
		if (outside(x, y, w, h)) total += COST.outside
		if (placed.some((box) => Math.abs(box.x - x) < (box.w + w) / 2 && Math.abs(box.y - y) < (box.h + h) / 2)) total += COST.chip
		// The chip inside the curve (noMargin) may lie over the track's inner
		// edge sooner than leave the curve: on a phone's wide oval it can't fit
		// inside clear of it, and it always sat there before.
		if (track && covers(track, x, y, w, h)) total += request.noMargin ? COST.margin + 1 : COST.track
		else if (margin && !request.noMargin && covers(margin, x, y, w, h)) total += COST.margin
		if (keepOut.some((zone) => covers(zone, x, y, w, h))) total += COST.keepOut
		// The slowest check last, and only when it could still matter. (Run only
		// on otherwise clear spots, it let a chip slid out across the course,
		// whose one other fault was a bracket, beat a spot inside the curve.) A
		// chip placed inside the curve (noMargin) that would reach a spot across
		// the far side of the track is as bad as one lying on the track: it has
		// left the curve, and its leader crosses the course to get back.
		const crossing = request.noMargin ? COST.track : COST.leader
		if (total < beat && leaderCrosses(request.anchor, x, y, w, h)) total += crossing
		return total
	}
	for (const request of requests) {
		const [ax, ay] = request.anchor
		const [dx, dy] = request.direction
		const out = Math.max(distance, request.reach ?? 0)
		let best: { at: [number, number]; cost: number } | null = null
		// How far a slide moves the chip: part of its own extent across the direction out.
		const across = Math.abs(dy) * request.width + Math.abs(dx) * request.height
		search: for (const reach of REACHES) {
			for (const move of MOVES) {
				let x: number
				let y: number
				if ("swing" in move) {
					const cos = Math.cos(move.swing)
					const sin = Math.sin(move.swing)
					x = ax + (dx * cos - dy * sin) * out * reach
					y = ay + (dx * sin + dy * cos) * out * reach
				} else {
					// Straight out, then sideways: (-dy, dx) is the direction out turned a quarter.
					x = ax + dx * out * reach - dy * across * move.slide
					y = ay + dy * out * reach + dx * across * move.slide
				}
				const spot = cost(request, x, y, best?.cost ?? Infinity)
				if (!best || spot < best.cost) best = { at: [x, y], cost: spot }
				if (spot === 0) break search
			}
		}
		const [x, y] = best!.at
		placed.push({ x, y, w: request.width, h: request.height })
		result[request.key] = [x, y]
	}
	return result
}
