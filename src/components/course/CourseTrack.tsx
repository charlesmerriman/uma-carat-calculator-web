/**
 * The course as a track: the race drawn along the course's own shape, the
 * real one (the game's path, services/courseQueries.ts) or the schematic (from
 * the record), finish along the bottom (notes/course-map-plan.md, "The track
 * view"). The same metres as the strip, through the same geometry module.
 *
 * The look is the overhaul's (notes/course-map-visual-plan.md, "The track"):
 * a dark kerb under the surface, the surface in the four phases, a gate bar
 * at the start and a chequer at the goal, the last-spurt line across the
 * track with a warm glow over the metres where an accel lands on time, hills
 * as brackets beside the track (never dashed outlines; Henry, 2026-11-01),
 * and words in callouts beside the track, one per spot listing each lap's
 * metres, with Daptrius's icons. A course over one lap is drawn as rings,
 * later laps inside or outside per course, blended across two corners
 * (withLapRings).
 *
 * Callouts are HTML over the SVG, placed by percentage (the box keeps the
 * shape's aspect ratio), so their text is the page's own; placeLabels keeps
 * them apart from size estimates, since nothing is measured, and a chip near
 * the edge slides back inside the box. The layers draw one arc per group
 * (the lit skill, each veteran) just outside the hills, in the group's
 * colour, with the skill's name at its start. The draw-in traces the track
 * gate to finish once; a `cursor` (Walk the course) runs a dot with a short
 * trail along it and lights each callout as it passes. All on motion values:
 * no React render per frame.
 */
import { useMemo, type CSSProperties, type ReactNode } from "react"
import { motion, useMotionValue, useTransform, type MotionValue } from "framer-motion"
import type { RaceCourse } from "../../types"
import {
	courseFacts,
	cumulativeTurn,
	finalStraight,
	formatMetres,
	metreToFraction,
	phaseStarts,
	placeLabels,
	pointAtMetre,
	shapeBounds,
	slopeParts,
	surfaceParts,
	withLapRings,
	type CourseOverlays,
	type CourseSpan,
	type Shape,
} from "../../utils/courseGeometry"
import CourseIcon, { type CourseIconName } from "./CourseIcon"
import { useDrawIn } from "./useDrawIn"

const PHASE_STROKES = ["var(--color-course-early)", "var(--color-course-mid)", "var(--color-course-late)", "var(--color-course-spurt)"]
const LIT = "var(--color-course-lit)"
// The box is at most this wide by default (`widthPx`); label sizes are
// estimated at the box's own width, since nothing is measured.
const BOX_PX = 1000
// ~ the width of one 11px character, a chip's padding, its icon and its height, in px.
const CHAR_PX = 6.3
const LABEL_PAD_PX = 18
const ICON_PX = 18
const LABEL_HEIGHT_PX = 24
// The glow over the spurt line: the metres just after the late-race start
// where an accel lands on time. A look, not a number (the engine's ranking
// window is the API's).
const GLOW_BEFORE_M = 25
const GLOW_AFTER_M = 70

type Tone = "start" | "goal" | "spurt" | "corner" | "straight" | "uphill" | "downhill" | "mark" | "heal" | "ground" | "layer"

interface Callout {
	key: string
	/** The metre the callout lights at during a walk. */
	at: number
	/** Where it points, on the track (or on a hill's bracket). */
	point: [number, number]
	/** Where its leader starts, when not `point` (the spurt chip's leader runs back to the line). */
	leaderFrom?: [number, number]
	label: string
	detail?: string
	tone: Tone
	icon?: CourseIconName
	/** A layer's name chip: its colour. */
	colour?: string
	/** Placed inside the curve, not outside (the spurt chip). */
	inward?: boolean
}

/** The slice of the shape between two metres. */
function slice(shape: Shape, start: number, end: number, distance: number): Shape {
	const last = shape.length - 1
	const from = Math.round(metreToFraction(start, distance) * last)
	const to = Math.round(metreToFraction(end, distance) * last)
	return shape.slice(from, Math.max(from + 2, to + 1))
}

function points(shape: Shape): string {
	return shape.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
}

/** A line parallel to a run of the shape, `offset` to the left of travel (a negative offset is the right). */
function parallel(section: Shape, offset: number): [number, number][] {
	return section.map(([x, y], index) => {
		const [ax, ay] = section[Math.max(0, index - 1)]
		const [bx, by] = section[Math.min(section.length - 1, index + 1)]
		const length = Math.hypot(bx - ax, by - ay) || 1
		return [x + ((by - ay) / length) * offset, y - ((bx - ax) / length) * offset]
	})
}

/** The unit tangent and left normal of travel at a metre. */
function frameAt(shape: Shape, metre: number, distance: number) {
	const last = shape.length - 1
	const at = metreToFraction(metre, distance) * last
	const [ax, ay] = shape[Math.max(0, Math.floor(at) - 2)]
	const [bx, by] = shape[Math.min(last, Math.ceil(at) + 2)]
	const length = Math.hypot(bx - ax, by - ay) || 1
	const t: [number, number] = [(bx - ax) / length, (by - ay) / length]
	return { t, n: [t[1], -t[0]] as [number, number] }
}

/** One phase of the track, drawn in as the draw-in's progress passes it. */
function PhaseLine({ shape, start, end, distance, stroke, width, progress }: {
	shape: Shape
	start: number
	end: number
	distance: number
	stroke: string
	width: number
	progress: MotionValue<number>
}) {
	const from = start / distance
	const span = (end - start) / distance
	const drawn = useTransform(progress, (value) => Math.min(1, Math.max(0, (value - from) / span)))
	return (
		<motion.polyline
			points={points(slice(shape, start, end, distance))}
			fill="none"
			stroke={stroke}
			strokeWidth={width}
			strokeLinejoin="round"
			style={{ pathLength: drawn }}
		/>
	)
}

const TONES: Record<Tone, string> = {
	start: "border-gray-500 bg-gray-800 text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-gray-100",
	goal: "border-gray-500 bg-gray-800 text-[10.5px] font-extrabold uppercase tracking-[0.04em] text-gray-100",
	spurt: "border-brand bg-brand text-[12px] text-black shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-brand)_28%,transparent),0_4px_14px_rgb(0_0_0/35%)]",
	corner: "border-gray-600 bg-gray-800 text-gray-100",
	straight: "border-gray-600 bg-gray-800 text-gray-100",
	uphill: "border-[color:var(--color-course-up)] bg-gray-800 text-gray-100",
	downhill: "border-[color:var(--color-course-down)] bg-gray-800 text-gray-100",
	mark: "border-transparent bg-transparent text-[10px] text-gray-400 shadow-none",
	heal: "border-[color:var(--color-course-heal)] bg-gray-800 text-[color:var(--color-course-heal)]",
	ground: "border-[color:var(--color-course-dirt)] bg-gray-800 text-gray-100",
	layer: "border-transparent text-[10.5px] font-bold text-[#0b0b0f] shadow-none",
}
const ICON_TONES: Partial<Record<Tone, string>> = {
	corner: "text-[color:var(--color-course-leader-corner)]",
	straight: "text-[color:var(--color-course-leader-straight)]",
	uphill: "text-[color:var(--color-course-up)]",
	downhill: "text-[color:var(--color-course-down)]",
}
const LEADERS: Record<Tone, string> = {
	start: "var(--color-course-leader-start)",
	goal: "var(--color-course-leader-start)",
	spurt: "var(--color-brand)",
	corner: "var(--color-course-leader-corner)",
	straight: "var(--color-course-leader-straight)",
	uphill: "var(--color-course-up)",
	downhill: "var(--color-course-down)",
	mark: "var(--color-course-leader-mark)",
	heal: "var(--color-course-heal)",
	ground: "var(--color-course-dirt)",
	layer: "transparent",
}

/** A callout's chip, dimmed until a walk reaches it. */
function CalloutBox({ callout, style, cursor }: { callout: Callout; style: CSSProperties; cursor: MotionValue<number> }) {
	// -1 is "no walk running": everything lit.
	const opacity = useTransform(cursor, (metre) => (metre < 0 || metre >= callout.at ? 1 : 0.4))
	// The spurt chip's metre takes the chip's own ink (black, or white on a
	// light theme through the .bg-brand.text-black rule), a little quieter.
	const detail: ReactNode = callout.detail && (
		<span className={callout.tone === "spurt" ? "font-normal opacity-70" : "font-normal text-gray-400"}>{callout.detail}</span>
	)
	return (
		<motion.div
			className={`pointer-events-none absolute inline-flex items-center gap-1 whitespace-nowrap rounded-[7px] border px-2 py-[3px] text-[11px] leading-tight shadow-[0_2px_8px_rgb(0_0_0/25%)] ${TONES[callout.tone]}`}
			style={{ ...style, opacity, ...(callout.colour ? { background: callout.colour, borderColor: callout.colour } : {}) }}
		>
			{callout.icon && <CourseIcon name={callout.icon} className={`h-3.5 w-3.5 shrink-0 ${ICON_TONES[callout.tone] ?? ""}`} />}
			<b className={callout.tone === "mark" ? "font-semibold" : callout.tone === "spurt" ? "font-extrabold" : "font-bold"}>{callout.label}</b>
			{detail}
		</motion.div>
	)
}

/** The walk's runner: a dot with a short trail behind it. */
function Runner({ shape, distance, cursor, track }: { shape: Shape; distance: number; cursor: MotionValue<number>; track: number }) {
	const cx = useTransform(cursor, (metre) => pointAtMetre(shape, Math.max(0, metre), distance)[0])
	const cy = useTransform(cursor, (metre) => pointAtMetre(shape, Math.max(0, metre), distance)[1])
	const opacity = useTransform(cursor, (metre) => (metre < 0 ? 0 : 1))
	// The trail is the 6% of the path behind the dot (pathLength normalises the
	// polyline to 1, so the offset is a fraction of the race).
	const offset = useTransform(cursor, (metre) => Math.max(0, metreToFraction(metre, distance) - 0.06))
	return (
		<>
			<motion.polyline
				points={points(shape)}
				fill="none"
				stroke="var(--color-course-runner)"
				strokeWidth={track * 0.5}
				strokeLinecap="round"
				style={{ pathLength: 0.06, pathOffset: offset, opacity: useTransform(opacity, (value) => value * 0.55) }}
			/>
			<motion.circle cx={cx} cy={cy} r={track * 0.42} fill="var(--color-course-runner)" stroke="var(--color-course-bed)" strokeWidth={track * 0.12} style={{ opacity }} />
		</>
	)
}

export default function CourseTrack({ course, shape: baseShape, overlays, cursor, widthPx = BOX_PX, compact = false, className = "" }: {
	course: RaceCourse
	/** The real shape or the schematic, in screen axes (utils/courseSchematic.ts). */
	shape: Shape
	overlays?: CourseOverlays
	/** The walk's metre; -1 while no walk runs. */
	cursor?: MotionValue<number>
	/** The box's widest, in px: the guide's 1000, the Timeline drawer's less. */
	widthPx?: number
	/** Call out only the start, the goal, the spurt, the corners and the final straight (a phone's box). */
	compact?: boolean
	className?: string
}) {
	const distance = course.distance
	const idle = useMotionValue(-1)
	const walk = cursor ?? idle
	const { ref, progress } = useDrawIn<HTMLDivElement>(1.4)

	const drawing = useMemo(() => {
		const base = shapeBounds(baseShape)
		const size = Math.max(base.width, base.height) || 1
		// Ring spacing: a little over a track's width at this size.
		const shape = withLapRings(baseShape, course, size * 0.045)
		const bounds = shapeBounds(shape)
		// Room for the callouts round the track; a phone's box needs more.
		const pad = size * (compact ? 0.4 : 0.17)
		const box = { x: bounds.minX - pad, y: bounds.minY - pad, width: bounds.width + 2 * pad, height: bounds.height + 2 * pad }
		const centre = [bounds.minX + bounds.width / 2, bounds.minY + bounds.height / 2] as const
		const clockwise = (cumulativeTurn(shape).at(-1) ?? 0) >= 0
		return { shape, box, size, centre, clockwise }
	}, [baseShape, course, compact])
	const { shape, box, size, centre, clockwise } = drawing
	// The track's width in the shape's units: 2% of the box (3% on a phone).
	const track = box.width * (compact ? 0.03 : 0.02)
	// The outside of the track is the left of travel on a clockwise course.
	const outside = clockwise ? 1 : -1
	const unitsPerPx = box.width / widthPx
	const P = (metre: number) => pointAtMetre(shape, metre, distance)

	const facts = courseFacts(course)
	const { mid, late, finalSixth } = phaseStarts(distance)
	const phases = facts.spans.filter((span) => span.kind === "phase")

	const awayFromMiddle = ([x, y]: readonly [number, number]): [number, number] => {
		const dx = x - centre[0]
		const dy = y - centre[1]
		const length = Math.hypot(dx, dy) || 1
		return [dx / length, dy / length]
	}
	const near = (a: readonly [number, number], b: readonly [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]) < size * 0.08
	/** A line across the track at a metre, `half` out each way. */
	const across = (metre: number, half: number) => {
		const { n } = frameAt(shape, metre, distance)
		const [x, y] = P(metre)
		return { x1: x - n[0] * half, y1: y - n[1] * half, x2: x + n[0] * half, y2: y + n[1] * half }
	}

	// Hills: a bracket just outside the track. A hill run on each lap at one
	// spot is ONE bracket, the first lap's, and one label with each lap's metres.
	const hills: { start: number; end: number; kind: "uphill" | "downhill"; label: string; percent: number; starts: number[]; bracket: [number, number][] }[] = []
	for (const hill of slopeParts(course)) {
		const middle = P((hill.start + hill.end) / 2)
		const same = hills.find((other) => other.label === hill.label && near(P((other.start + other.end) / 2), middle))
		if (same) {
			same.starts.push(hill.start)
			continue
		}
		hills.push({ ...hill, starts: [hill.start], bracket: parallel(slice(shape, hill.start, hill.end, distance), track * 1.25 * outside) })
	}

	// The layers: one arc lane per GROUP (the lit skill, each veteran), since
	// the arcs carry no words; the strip gives every label its own row.
	const layerSpans = (overlays?.spans ?? []).filter((span) => span.kind !== "phase" && span.kind !== "anywhere" && span.kind !== "passive")
	const groups = [...new Set(layerSpans.map((span) => span.group ?? "lit"))]
	const laneOf = (span: CourseSpan) => groups.indexOf(span.group ?? "lit")
	const laneOffset = (lane: number) => track * (1.85 + lane * 0.62) * outside
	const outermost = groups.length - 1

	// One callout per spot, most important first (they're placed in order).
	// The spurt chip right after, inside the curve, the most important point on
	// the course (notes/course-map-plan-2.md, section 1), so it is never crowded out.
	const allCallouts: Callout[] = [
		{ key: "start", at: 0, point: P(0), label: "Start", tone: "start" },
		{ key: "goal", at: distance, point: P(distance), label: "Goal", tone: "goal" },
	]
	{
		const [x, y] = P(late)
		const [ox, oy] = awayFromMiddle([x, y])
		allCallouts.push({
			key: "marker-spurt-start",
			at: late,
			// Anchored a track and a half inside the curve, so the chip clears the track.
			point: [x - ox * track * 1.6, y - oy * track * 1.6],
			leaderFrom: [x, y],
			label: "Last spurt",
			detail: formatMetres(late),
			tone: "spurt",
			icon: "flag",
			inward: true,
		})
	}
	// A corner's and a straight's callout points at where it STARTS, the metre
	// it names, like every other callout (Daptrius, 2026-11-03).
	const cornerIcon: CourseIconName = course.direction === "right" ? "cornerRight" : "cornerLeft"
	const cornerGroups = new Map<number, number[]>()
	for (const corner of [...course.corners].sort((a, b) => a.start - b.start)) {
		cornerGroups.set(corner.number, [...(cornerGroups.get(corner.number) ?? []), corner.start])
	}
	for (const [number, starts] of cornerGroups) {
		allCallouts.push({
			key: `corner-${number}`,
			at: starts[0],
			point: P(starts[0]),
			label: number > 0 ? `Corner ${number}` : "Corner",
			detail: starts.map(formatMetres).join(", "),
			tone: "corner",
			icon: cornerIcon,
		})
	}
	const straight = finalStraight(course)
	if (straight) {
		allCallouts.push({
			key: "final-straight",
			at: straight.start,
			point: P(straight.start),
			label: "Final straight",
			// Its start, not its length: every other callout counts from the gate.
			detail: formatMetres(straight.start),
			tone: "straight",
			icon: "finalStraight",
		})
	}
	// Every other straight: one callout per spot with each lap's start metres,
	// like the corners (Daptrius's render). Not the one leaving the gate: the
	// Start callout is already there.
	const straightSpots: { at: number[]; point: [number, number] }[] = []
	for (const part of [...course.straights].sort((a, b) => a.start - b.start)) {
		if (part.start === 0 || part.start === straight?.start) continue
		const point = P(part.start)
		const same = straightSpots.find((spot) => near(spot.point, point))
		if (same) same.at.push(part.start)
		else straightSpots.push({ at: [part.start], point })
	}
	for (const spot of straightSpots) {
		allCallouts.push({ key: `straight-${spot.at[0]}`, at: spot.at[0], point: spot.point, label: "Straight", detail: spot.at.map(formatMetres).join(", "), tone: "straight", icon: "straight" })
	}
	for (const hill of hills) {
		allCallouts.push({
			key: `hill-${hill.start}`,
			at: hill.start,
			point: hill.bracket[Math.floor(hill.bracket.length / 2)],
			label: hill.label,
			detail: hill.starts.length > 1 ? hill.starts.map(formatMetres).join(", ") : `${Math.round(hill.start).toLocaleString("en-US")}–${formatMetres(hill.end)}`,
			tone: hill.kind,
			icon: hill.kind,
		})
	}
	// Where the ground changes (Tokyo dirt 1600 starts on turf), as the strip's
	// ground row says.
	for (const part of surfaceParts(course).slice(1)) {
		allCallouts.push({ key: `ground-${part.start}`, at: part.start, point: P(part.start), label: part.surface === "dirt" ? "Dirt from here" : "Turf from here", detail: formatMetres(part.start), tone: "ground" })
	}
	// Halfway and Position keep ends keep their callouts (owner, 2026-11-03), quietly.
	for (const marker of facts.markers) {
		if (marker.kind === "spurt-start") continue
		allCallouts.push({ key: `marker-${marker.kind}`, at: marker.at, point: P(marker.at), label: marker.label, detail: formatMetres(marker.at), tone: "mark" })
	}
	for (const marker of overlays?.markers ?? []) {
		if (marker.kind === "heal-check") allCallouts.push({ key: "heal-check", at: marker.at, point: P(marker.at), label: marker.label, detail: formatMetres(marker.at), tone: "heal" })
	}
	// A layer's name at its zone's start, past the arcs, in its colour
	// (owner, 2026-11-03); one per name per group.
	const named = new Set<string>()
	for (const span of layerSpans) {
		if (!span.label || named.has(`${span.group}:${span.label}`)) continue
		named.add(`${span.group}:${span.label}`)
		const { n } = frameAt(shape, span.start, distance)
		const offset = laneOffset(laneOf(span))
		const [x, y] = P(span.start)
		allCallouts.push({ key: `layer-${span.group ?? "lit"}-${span.label}`, at: span.start, point: [x + n[0] * offset, y + n[1] * offset], label: span.label, tone: "layer", colour: span.colour ?? LIT })
	}
	// A phone-sized box has room for the start, the goal, the spurt, the
	// corners and the final straight; the headline under it says the rest.
	const callouts = compact
		? allCallouts
			.filter((callout) => ["start", "goal", "spurt", "corner"].includes(callout.tone) || callout.key === "final-straight")
			// Only the spurt keeps its metre: the strip under the track has the rest.
			.map((callout) => (callout.tone === "spurt" ? callout : { ...callout, detail: undefined }))
		: allCallouts

	// Every callout sits past the outermost layer arc so no word covers a zone.
	const labelReach = outermost < 0 ? size * 0.11 : Math.max(size * 0.11, track * (1.85 + outermost * 0.62) + track * 1.6)
	const estimate = (callout: Callout) => {
		const text = callout.label.length + (callout.detail ? callout.detail.length + 1.5 : 0)
		return { width: (text * CHAR_PX + LABEL_PAD_PX + (callout.icon ? ICON_PX : 0)) * unitsPerPx, height: LABEL_HEIGHT_PX * unitsPerPx }
	}
	const positions = placeLabels(
		callouts.map((callout) => {
			const [ox, oy] = awayFromMiddle(callout.point)
			return { key: callout.key, anchor: callout.point, direction: callout.inward ? [-ox, -oy] as const : [ox, oy] as const, ...estimate(callout) }
		}),
		labelReach,
	)
	// Nothing may spill past the box: a chip near the edge slides back in.
	for (const callout of callouts) {
		const { width, height } = estimate(callout)
		const [x, y] = positions[callout.key]
		positions[callout.key] = [
			Math.min(box.x + box.width - width / 2, Math.max(box.x + width / 2, x)),
			Math.min(box.y + box.height - height / 2, Math.max(box.y + height / 2, y)),
		]
	}
	const percent = ([x, y]: [number, number]): CSSProperties => ({
		left: `${((x - box.x) / box.width) * 100}%`,
		top: `${((y - box.y) / box.height) * 100}%`,
		transform: "translate(-50%, -50%)",
	})
	const halfTick = (from: [number, number], to: readonly [number, number]) => ({ x1: from[0], y1: from[1], x2: (from[0] + to[0]) / 2, y2: (from[1] + to[1]) / 2 })

	// The chequer at the goal: four by four squares along the last track-width.
	const chequer: { points: string; dark: boolean }[] = []
	{
		const { t, n } = frameAt(shape, distance, distance)
		const [gx, gy] = P(distance)
		const s = track / 3
		for (let i = 0; i < 4; i++) {
			for (let j = -2; j < 2; j++) {
				const cx = gx - t[0] * (i + 0.5) * s + n[0] * (j + 0.5) * s
				const cy = gy - t[1] * (i + 0.5) * s + n[1] * (j + 0.5) * s
				const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [cx + (t[0] * a + n[0] * b) * (s / 2), cy + (t[1] * a + n[1] * b) * (s / 2)])
				chequer.push({ points: corners.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" "), dark: (i + j) % 2 !== 0 })
			}
		}
	}
	const beaconEnd = (() => {
		const { n } = frameAt(shape, late, distance)
		const [x, y] = P(late)
		return [x + n[0] * track * 1.05 * outside, y + n[1] * track * 1.05 * outside]
	})()

	return (
		<div ref={ref} className={`relative mx-auto w-full ${className}`} style={{ maxWidth: widthPx, aspectRatio: `${box.width} / ${box.height}` }} aria-hidden="true">
			<svg viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`} className="absolute inset-0 h-full w-full overflow-visible">
				{/* The kerb, then the race over it, phase by phase. */}
				<polyline points={points(shape)} fill="none" stroke="var(--color-course-bed)" strokeWidth={track * 1.55} strokeLinejoin="round" strokeLinecap="round" />
				{phases.map((phase, index) => (
					<PhaseLine key={phase.start} shape={shape} start={phase.start} end={phase.end} distance={distance} stroke={PHASE_STROKES[index % PHASE_STROKES.length]} width={track} progress={progress} />
				))}
				{/* The glow over the spurt: where an accel lands on time. */}
				<polyline points={points(slice(shape, late - GLOW_BEFORE_M, late + GLOW_AFTER_M, distance))} fill="none" stroke="var(--color-course-beacon-glow)" strokeWidth={track * 2.4} strokeLinecap="round" opacity={0.4} />
				{/* Thin ticks where a phase changes. */}
				{[mid, finalSixth].map((metre) => <line key={metre} {...across(metre, track * 0.55)} stroke="var(--color-course-tick)" strokeWidth={track * 0.12} />)}
				{hills.map((hill) => (
					<g key={hill.start} stroke={hill.kind === "uphill" ? "var(--color-course-up)" : "var(--color-course-down)"} strokeWidth={track * 0.22} fill="none" strokeLinecap="round">
						<polyline points={points(hill.bracket)} />
						<line {...halfTick(hill.bracket[0], P(hill.start))} />
						<line {...halfTick(hill.bracket[hill.bracket.length - 1], P(hill.end))} />
					</g>
				))}
				{/* The layers: an arc outside the hills per group, solid where it
				    fires, dashed for a random point, dotted for the carry-over
				    window, a dot for a spot. */}
				{layerSpans.map((span, index) => {
					const colour = span.colour ?? LIT
					const offset = laneOffset(laneOf(span))
					if (span.kind === "point" || span.start === span.end) {
						const { n } = frameAt(shape, span.start, distance)
						const [x, y] = P(span.start)
						return <circle key={`layer-${index}`} cx={x + n[0] * offset} cy={y + n[1] * offset} r={track * 0.28} fill={colour} />
					}
					const section = slice(shape, span.start, Math.max(span.end, span.start + distance / 400), distance)
					return (
						<polyline
							key={`layer-${index}`}
							points={points(parallel(section, offset))}
							fill="none"
							stroke={colour}
							strokeWidth={span.kind === "window" ? track * 0.16 : track * 0.34}
							strokeDasharray={span.kind === "random" ? `${track * 0.5} ${track * 0.32}` : span.kind === "window" ? `${track * 0.12} ${track * 0.22}` : undefined}
							strokeLinecap="round"
							opacity={span.kind === "window" ? 0.8 : 1}
						/>
					)
				})}
				{/* The last-spurt line across the track, a dot at its outer end. */}
				<line {...across(late, track * 1.05)} stroke="var(--color-course-beacon)" strokeWidth={track * 0.26} strokeLinecap="round" />
				<circle cx={beaconEnd[0]} cy={beaconEnd[1]} r={track * 0.3} fill="var(--color-course-beacon)" />
				{(overlays?.markers ?? []).filter((marker) => marker.kind === "heal-check").map((marker) => (
					<line key="heal-check" {...across(marker.at, track * 1.3)} stroke="var(--color-course-heal)" strokeWidth={track * 0.14} strokeDasharray={`${track * 0.2} ${track * 0.16}`} />
				))}
				{facts.markers.filter((marker) => marker.kind !== "spurt-start").map((marker) => (
					<line key={marker.kind} {...across(marker.at, track * 0.62)} stroke="var(--color-course-mark)" strokeWidth={track * 0.1} strokeDasharray={`${track * 0.14} ${track * 0.12}`} />
				))}
				{/* The gate and the finish. */}
				<line {...across(0, track * 0.6)} stroke="var(--color-course-gate)" strokeWidth={track * 0.28} />
				{chequer.map((square, index) => <polygon key={index} points={square.points} fill={square.dark ? "#0b0b0f" : "#f8fafc"} />)}
				{/* Leaders from the track to each callout, in the callout's own colour. */}
				{callouts.map((callout) => {
					const from = callout.leaderFrom ?? callout.point
					return (
						<g key={`leader-${callout.key}`} stroke={LEADERS[callout.tone]} fill={LEADERS[callout.tone]}>
							<line x1={from[0]} y1={from[1]} x2={positions[callout.key][0]} y2={positions[callout.key][1]} strokeWidth={track * 0.09} opacity={0.9} />
							{!["start", "goal", "spurt", "layer"].includes(callout.tone) && <circle cx={callout.point[0]} cy={callout.point[1]} r={track * 0.16} stroke="none" />}
						</g>
					)
				})}
				<Runner shape={shape} distance={distance} cursor={walk} track={track} />
			</svg>
			{callouts.map((callout) => (
				<CalloutBox key={callout.key} callout={callout} cursor={walk} style={percent(positions[callout.key])} />
			))}
		</div>
	)
}
