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

export type SpanKind = "phase" | "fixed" | "random" | "point" | "anywhere" | "passive"
export interface CourseSpan {
	start: number
	end: number
	kind: SpanKind
	label?: string
	lane?: number
}

export type MarkerKind = "spurt-start" | "phase-divider" | "position-keep-end"
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
export function rulerTicks(distance: number): number[] {
	// 400 is there for 3200 and 3600, which land on it exactly.
	const step = [100, 200, 250, 400, 500, 1000].find((candidate) => distance / candidate <= 12) ?? 1000
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
 * The three phases in the game's words (owner, 2026-11-02). Late-race runs to
 * the finish: in the game's text "late-race" is the 2/3 point onward, and "last
 * spurt" is the sprint, which can start there (a marker, not a band).
 */
export function phaseBands(distance: number, geometry: RaceGeometry = GAME_GEOMETRY): CourseSpan[] {
	const { mid, late } = phaseStarts(distance, geometry)
	return [
		{ start: 0, end: mid, kind: "phase", label: "Early-race" },
		{ start: mid, end: late, kind: "phase", label: "Mid-race" },
		{ start: late, end: distance, kind: "phase", label: "Late-race" },
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

/** The course's own overlay: the phases, the 5/6 divider and the two markers. */
export function courseFacts(course: RaceCourse, geometry: RaceGeometry = GAME_GEOMETRY): CourseOverlays {
	const { late, finalSixth } = phaseStarts(course.distance, geometry)
	return {
		spans: phaseBands(course.distance, geometry),
		markers: [
			{ at: positionKeepEnd(course.distance, geometry), kind: "position-keep-end", label: "Position keep ends" },
			{ at: late, kind: "spurt-start", label: "Last spurt can start here" },
			{ at: finalSixth, kind: "phase-divider", label: "" },
		],
	}
}

/** Which part of the track a metre falls on: the later part at a boundary. */
function partAt(parts: TrackPart[], metre: number): TrackPart | undefined {
	return parts.find((part) => metre >= part.start && metre < part.end) ?? parts.at(-1)
}

/**
 * The chips under the strip: what a player reads off the course without
 * counting. Plain sentences in the game's words (copy.md).
 */
export function derivedFacts(course: RaceCourse, geometry: RaceGeometry = GAME_GEOMETRY): string[] {
	const facts: string[] = []
	const corner = finalCorner(course)
	if (corner) facts.push(`Final corner from ${formatMetres(corner.start)}`)
	const straight = finalStraight(course)
	if (straight) facts.push(`Final straight ${formatMetres(straight.length)}`)

	// The steepest climb that reaches into the last 400 m.
	const lastStretch = course.distance - 400
	const climb = slopeParts(course)
		.filter((slope) => slope.kind === "uphill" && slope.end > lastStretch)
		.sort((a, b) => b.percent - a.percent)[0]
	if (climb) facts.push(`${climb.percent}% climb in the last 400m`)

	const { late } = phaseStarts(course.distance, geometry)
	const where = partAt(trackParts(course), late)
	if (where?.kind === "corner") {
		facts.push(corner && where.start === corner.start
			? "Last spurt can start on the final corner"
			: `Last spurt can start on ${where.label.toLowerCase()}`)
	} else if (where?.kind === "straight") {
		facts.push(where.label === "Final straight"
			? "Last spurt can start on the final straight"
			: "Last spurt can start on a straight")
	}
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
