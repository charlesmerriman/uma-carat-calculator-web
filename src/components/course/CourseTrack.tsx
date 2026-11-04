/**
 * The course as a track: the race drawn along the course's own shape, the
 * real one (the game's path, services/courseQueries.ts) or the schematic (from
 * the record), finish along the bottom (notes/course-map-plan.md, "The track
 * view"). The same metres as the strip, through the same geometry module.
 *
 * The look is the team's (the plan, "The look"): the track coloured by phase;
 * words in callouts beside the track, never symbols on it (Henry,
 * 2026-11-01), ONE callout per spot listing each lap's metres; hills as
 * brackets beside the track, never dashed outlines; a course over one lap
 * drawn as rings, later laps inside or outside per course, blended across two
 * corners (withLapRings).
 *
 * Callouts are HTML over the SVG, placed by percentage (the box keeps the
 * shape's aspect ratio), so their text is the page's own; placeLabels keeps
 * them apart from size estimates, since nothing is measured. The draw-in
 * traces the track gate to finish once; a `cursor` (Walk the course) rides a
 * dot along it and lights each callout as it passes. All on motion values: no
 * React render per frame.
 */
import { useMemo, type CSSProperties } from "react"
import { motion, useMotionValue, useTransform, type MotionValue } from "framer-motion"
import type { RaceCourse } from "../../types"
import {
	courseFacts,
	cumulativeTurn,
	finalStraight,
	formatMetres,
	metreToFraction,
	placeLabels,
	pointAtMetre,
	shapeBounds,
	slopeParts,
	surfaceParts,
	withLapRings,
	type CourseOverlays,
	type Shape,
} from "../../utils/courseGeometry"
import { useDrawIn } from "./useDrawIn"

const PHASE_STROKES = ["var(--color-course-early)", "var(--color-course-mid)", "var(--color-course-late)", "var(--color-course-final)"]
// The box is at most this wide by default (`widthPx`); label sizes are
// estimated at the box's own width, since nothing is measured.
const BOX_PX = 900
// ~ the width of one 11px character, and a label's padding and height, in px.
const CHAR_PX = 5.8
const LABEL_PAD_PX = 16
const LABEL_HEIGHT_PX = 20

interface Callout {
	key: string
	/** The metre the callout lights at during a walk. */
	at: number
	/** Where it points, on the track (or on a hill's bracket). */
	point: [number, number]
	label: string
	detail?: string
	tone: "start" | "goal" | "spurt" | "corner" | "marker" | "hill"
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

const TONES: Record<Callout["tone"], string> = {
	start: "border-gray-500 bg-gray-900/90 font-semibold text-gray-100",
	goal: "border-gray-500 bg-gray-900/90 font-semibold text-gray-100",
	// A placeholder: its look is the visual overhaul's (notes/course-map-plan-2.md, "Handoff").
	spurt: "border-brand/70 bg-gray-900/95 font-semibold text-gray-100",
	corner: "border-gray-700 bg-gray-900/85 text-gray-200",
	marker: "border-gray-700 bg-gray-900/85 text-gray-200",
	hill: "border-transparent bg-gray-900/70 font-semibold text-gray-200",
}

/** A callout's box, dimmed until a walk reaches it. */
function CalloutBox({ callout, style, cursor }: { callout: Callout; style: CSSProperties; cursor: MotionValue<number> }) {
	// -1 is "no walk running": everything lit.
	const opacity = useTransform(cursor, (metre) => (metre < 0 || metre >= callout.at ? 1 : 0.4))
	return (
		<motion.div
			className={`pointer-events-none absolute whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] leading-tight ${TONES[callout.tone]}`}
			style={{ ...style, opacity }}
		>
			{callout.label}
			{callout.detail && <span className="ml-1 font-normal text-gray-400">{callout.detail}</span>}
		</motion.div>
	)
}

function CursorDot({ shape, distance, cursor, radius }: { shape: Shape; distance: number; cursor: MotionValue<number>; radius: number }) {
	const cx = useTransform(cursor, (metre) => pointAtMetre(shape, Math.max(0, metre), distance)[0])
	const cy = useTransform(cursor, (metre) => pointAtMetre(shape, Math.max(0, metre), distance)[1])
	const opacity = useTransform(cursor, (metre) => (metre < 0 ? 0 : 1))
	return <motion.circle cx={cx} cy={cy} r={radius} fill="#f8fafc" stroke="#111827" strokeWidth={radius / 3} style={{ opacity }} />
}

export default function CourseTrack({ course, shape: baseShape, overlays, cursor, widthPx = BOX_PX, compact = false, className = "" }: {
	course: RaceCourse
	/** The real shape or the schematic, in screen axes (utils/courseSchematic.ts). */
	shape: Shape
	overlays?: CourseOverlays
	/** The walk's metre; -1 while no walk runs. */
	cursor?: MotionValue<number>
	/** The box's widest, in px: the guide's 900, the Timeline drawer's less. */
	widthPx?: number
	/** Call out only the start, the goal and the corners' names (a phone's box). */
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
		// Ring spacing: a little over a track's width at this size (the plan:
		// judged by eye in the visual check).
		const shape = withLapRings(baseShape, course, size * 0.035)
		const bounds = shapeBounds(shape)
		// Room for the callouts round the track; a phone's box needs more.
		const pad = size * (compact ? 0.28 : 0.2)
		const box = { x: bounds.minX - pad, y: bounds.minY - pad, width: bounds.width + 2 * pad, height: bounds.height + 2 * pad }
		const centre = [bounds.minX + bounds.width / 2, bounds.minY + bounds.height / 2] as const
		const clockwise = (cumulativeTurn(shape).at(-1) ?? 0) >= 0
		return { shape, box, size, centre, clockwise }
	}, [baseShape, course, compact])
	const { shape, box, size, centre, clockwise } = drawing
	// The track's width in the shape's metres: ~14px in the 900px box.
	const track = box.width * 0.016
	const unitsPerPx = box.width / widthPx

	const facts = courseFacts(course)
	const phases = [...facts.spans, ...(overlays?.spans ?? [])].filter((span) => span.kind === "phase")
	const markers = [...facts.markers, ...(overlays?.markers ?? [])].filter((marker) => marker.label)

	const awayFromMiddle = ([x, y]: readonly [number, number]): [number, number] => {
		const dx = x - centre[0]
		const dy = y - centre[1]
		const length = Math.hypot(dx, dy) || 1
		return [dx / length, dy / length]
	}
	const near = (a: readonly [number, number], b: readonly [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]) < size * 0.08

	// Hills: a bracket beside the track on its outer side. A hill run on each
	// lap at one spot is ONE bracket, the first lap's, and one label with each
	// lap's metres.
	const hills: { start: number; end: number; kind: "uphill" | "downhill"; label: string; starts: number[]; bracket: [number, number][] }[] = []
	for (const hill of slopeParts(course)) {
		const middle = pointAtMetre(shape, (hill.start + hill.end) / 2, distance)
		const same = hills.find((other) =>
			other.label === hill.label && near(pointAtMetre(shape, (other.start + other.end) / 2, distance), middle))
		if (same) {
			same.starts.push(hill.start)
			continue
		}
		const section = slice(shape, hill.start, hill.end, distance)
		const offset = track * 1.8
		const side = clockwise ? 1 : -1
		const bracket = section.map(([x, y], index) => {
			const [ax, ay] = section[Math.max(0, index - 1)]
			const [bx, by] = section[Math.min(section.length - 1, index + 1)]
			const length = Math.hypot(bx - ax, by - ay) || 1
			// The left-hand normal of travel is the outside of a clockwise course.
			return [x + ((by - ay) / length) * offset * side, y - ((bx - ax) / length) * offset * side] as [number, number]
		})
		hills.push({ ...hill, starts: [hill.start], bracket })
	}

	// One callout per spot, most important first (they're placed in order).
	// The spurt start right after the ends: the most important point on the
	// course (notes/course-map-plan-2.md, section 1), so it is never crowded out.
	const spurt = markers.find((marker) => marker.kind === "spurt-start")
	const allCallouts: Callout[] = [
		{ key: "start", at: 0, point: pointAtMetre(shape, 0, distance), label: "Start", tone: "start" },
		{ key: "goal", at: distance, point: pointAtMetre(shape, distance, distance), label: "Goal", tone: "goal" },
	]
	if (spurt) {
		allCallouts.push({
			key: "marker-spurt-start",
			at: spurt.at,
			point: pointAtMetre(shape, spurt.at, distance),
			label: spurt.label,
			detail: formatMetres(spurt.at),
			tone: "spurt",
		})
	}
	// A corner's and a straight's callout points at where it STARTS, the metre
	// it names, like every other callout (Daptrius, 2026-11-03).
	const cornerGroups = new Map<number, { at: number[] }>()
	for (const corner of [...course.corners].sort((a, b) => a.start - b.start)) {
		const group = cornerGroups.get(corner.number) ?? { at: [] }
		group.at.push(corner.start)
		cornerGroups.set(corner.number, group)
	}
	for (const [number, group] of cornerGroups) {
		allCallouts.push({
			key: `corner-${number}`,
			at: group.at[0],
			point: pointAtMetre(shape, group.at[0], distance),
			label: number > 0 ? `Corner ${number}` : "Corner",
			detail: group.at.map(formatMetres).join(", "),
			tone: "corner",
		})
	}
	const straight = finalStraight(course)
	if (straight) {
		allCallouts.push({
			key: "final-straight",
			at: straight.start,
			point: pointAtMetre(shape, straight.start, distance),
			label: "Final straight",
			// Its start, not its length: every other callout counts from the gate.
			detail: formatMetres(straight.start),
			tone: "corner",
		})
	}
	// Every other straight: one callout per spot with each lap's start metres,
	// like the corners (Daptrius's render). Not the one leaving the gate: the
	// Start callout is already there.
	const straightSpots: { at: number[]; point: [number, number] }[] = []
	for (const part of [...course.straights].sort((a, b) => a.start - b.start)) {
		if (part.start === 0 || part.start === straight?.start) continue
		const point = pointAtMetre(shape, part.start, distance)
		const same = straightSpots.find((spot) => near(spot.point, point))
		if (same) same.at.push(part.start)
		else straightSpots.push({ at: [part.start], point })
	}
	for (const spot of straightSpots) {
		allCallouts.push({
			key: `straight-${spot.at[0]}`,
			at: spot.at[0],
			point: spot.point,
			label: "Straight",
			detail: spot.at.map(formatMetres).join(", "),
			tone: "corner",
		})
	}
	for (const marker of markers.filter((other) => other !== spurt)) {
		allCallouts.push({
			key: `marker-${marker.kind}`,
			at: marker.at,
			point: pointAtMetre(shape, marker.at, distance),
			label: marker.label,
			detail: formatMetres(marker.at),
			tone: "marker",
		})
	}
	for (const hill of hills) {
		allCallouts.push({
			key: `hill-${hill.start}`,
			at: hill.start,
			point: hill.bracket[Math.floor(hill.bracket.length / 2)],
			label: hill.label,
			detail: hill.starts.length > 1 ? hill.starts.map(formatMetres).join(", ") : undefined,
			tone: "hill",
		})
	}
	// Where the ground changes (Tokyo dirt 1600 starts on turf), as the strip's
	// ground band says.
	for (const part of surfaceParts(course).slice(1)) {
		allCallouts.push({
			key: `ground-${part.start}`,
			at: part.start,
			point: pointAtMetre(shape, part.start, distance),
			label: part.surface === "dirt" ? "Dirt from here" : "Turf from here",
			detail: formatMetres(part.start),
			tone: "marker",
		})
	}
	// A phone-sized box has room for the start, the goal, the spurt and the
	// corners' names; the chips under it say the rest (the final corner's
	// metre, the final straight, the climbs, what's around the spurt).
	const callouts = compact
		? allCallouts
			.filter((callout) => callout.tone !== "marker" && callout.tone !== "hill" && callout.key !== "final-straight")
			.map((callout) => ({ ...callout, detail: undefined }))
		: allCallouts

	// The layers draw their lines outside the track, a lane per row (below);
	// the callouts sit past the outermost one so no word covers a zone.
	const layerLanes = (overlays?.spans ?? []).filter((span) => span.kind !== "phase" && span.kind !== "anywhere" && span.kind !== "passive")
	const outermostLane = layerLanes.length > 0 ? Math.max(...layerLanes.map((span) => span.lane ?? 0)) : -1
	const labelReach = outermostLane < 0 ? size * 0.1 : Math.max(size * 0.1, track * (1.3 + outermostLane * 0.9) + track * 2.5)

	const positions = placeLabels(
		callouts.map((callout) => {
			const text = callout.label.length + (callout.detail ? callout.detail.length + 1 : 0)
			const [ox, oy] = awayFromMiddle(callout.point)
			return {
				key: callout.key,
				anchor: callout.point,
				// The spurt start's words go INSIDE the track (owner, 2026-11-03:
				// outside, its long leader crossed the layers and the zones).
				direction: callout.key === "marker-spurt-start" ? [-ox, -oy] as const : [ox, oy] as const,
				width: (text * CHAR_PX + LABEL_PAD_PX) * unitsPerPx,
				height: LABEL_HEIGHT_PX * unitsPerPx,
			}
		}),
		labelReach,
	)
	// A tick across the track at the spurt start, so the exact spot reads
	// without the label (its look is the visual overhaul's).
	const spurtTick = spurt && (() => {
		const at = metreToFraction(spurt.at, distance) * (shape.length - 1)
		const [ax, ay] = shape[Math.max(0, Math.floor(at) - 2)]
		const [bx, by] = shape[Math.min(shape.length - 1, Math.ceil(at) + 2)]
		const length = Math.hypot(bx - ax, by - ay) || 1
		const [nx, ny] = [-(by - ay) / length, (bx - ax) / length]
		const [x, y] = pointAtMetre(shape, spurt.at, distance)
		const half = track * 1.4
		return { x1: x - nx * half, y1: y - ny * half, x2: x + nx * half, y2: y + ny * half }
	})()
	const percent = ([x, y]: [number, number]): CSSProperties => ({
		left: `${((x - box.x) / box.width) * 100}%`,
		top: `${((y - box.y) / box.height) * 100}%`,
		transform: "translate(-50%, -50%)",
	})
	const tick = (from: [number, number], to: readonly [number, number]) => (
		{ x1: from[0], y1: from[1], x2: (from[0] + to[0]) / 2, y2: (from[1] + to[1]) / 2 }
	)

	return (
		<div ref={ref} className={`relative mx-auto w-full ${className}`} style={{ maxWidth: widthPx, aspectRatio: `${box.width} / ${box.height}` }} aria-hidden="true">
			<svg viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`} className="absolute inset-0 h-full w-full">
				{/* The track's bed, then the race over it, phase by phase. */}
				<polyline points={points(shape)} fill="none" stroke="var(--color-gray-700)" strokeWidth={track * 1.6} strokeLinejoin="round" strokeLinecap="round" />
				{phases.map((phase, index) => (
					<PhaseLine
						key={phase.start}
						shape={shape}
						start={phase.start}
						end={phase.end}
						distance={distance}
						stroke={PHASE_STROKES[index % PHASE_STROKES.length]}
						width={track}
						progress={progress}
					/>
				))}
				{hills.map((hill) => (
					<g key={hill.start} stroke={hill.kind === "uphill" ? "var(--color-course-uphill)" : "var(--color-course-downhill)"} strokeWidth={track * 0.35} fill="none">
						<polyline points={points(hill.bracket)} />
						<line {...tick(hill.bracket[0], pointAtMetre(shape, hill.start, distance))} />
						<line {...tick(hill.bracket[hill.bracket.length - 1], pointAtMetre(shape, hill.end, distance))} />
					</g>
				))}
				{/* The layers (a skill's zones, the veterans' skills): a line just
				    outside the track per lane, solid where it fires, dashed for a
				    random point, a dot for a spot. Their words are on the strip. */}
				{(overlays?.spans ?? []).filter((span) => span.kind !== "phase" && span.kind !== "anywhere" && span.kind !== "passive").map((span, index) => {
					const lane = span.lane ?? 0
					const outside = clockwise ? 1 : -1
					const offset = track * (1.3 + lane * 0.9)
					const section = slice(shape, span.start, Math.max(span.end, span.start + distance / 400), distance)
					if (span.kind === "point" || span.start === span.end) {
						const [x, y] = pointAtMetre(shape, span.start, distance)
						return <circle key={`layer-${index}`} cx={x} cy={y} r={track * 0.55} fill="var(--color-brand)" />
					}
					const line = section.map(([x, y], i) => {
						const [ax, ay] = section[Math.max(0, i - 1)]
						const [bx, by] = section[Math.min(section.length - 1, i + 1)]
						const length = Math.hypot(bx - ax, by - ay) || 1
						return [x + ((by - ay) / length) * offset * outside, y - ((bx - ax) / length) * offset * outside] as [number, number]
					})
					return (
						<polyline
							key={`layer-${index}`}
							points={points(line)}
							fill="none"
							stroke="var(--color-brand)"
							strokeWidth={track * 0.45}
							strokeDasharray={span.kind === "random" ? `${track * 0.8} ${track * 0.5}` : undefined}
							strokeLinecap="round"
						/>
					)
				})}
				{spurtTick && <line {...spurtTick} stroke="var(--color-gray-100)" strokeWidth={track * 0.35} strokeLinecap="round" />}
				{/* Leader lines from the track to each callout. */}
				{callouts.map((callout) => (
					<line
						key={`leader-${callout.key}`}
						x1={callout.point[0]}
						y1={callout.point[1]}
						x2={positions[callout.key][0]}
						y2={positions[callout.key][1]}
						stroke="var(--color-gray-500)"
						strokeWidth={track * 0.15}
					/>
				))}
				<circle cx={pointAtMetre(shape, 0, distance)[0]} cy={pointAtMetre(shape, 0, distance)[1]} r={track * 0.7} fill="#f8fafc" />
				<circle cx={pointAtMetre(shape, distance, distance)[0]} cy={pointAtMetre(shape, distance, distance)[1]} r={track * 0.7} fill="#ef4444" />
				<CursorDot shape={shape} distance={distance} cursor={walk} radius={track * 0.8} />
			</svg>
			{callouts.map((callout) => (
				<CalloutBox key={callout.key} callout={callout} cursor={walk} style={percent(positions[callout.key])} />
			))}
		</div>
	)
}
