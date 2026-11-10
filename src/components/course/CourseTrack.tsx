/**
 * The course as a track: the race drawn along the course's own shape, the
 * real one (the game's path, services/courseQueries.ts) or the schematic (from
 * the record), finish along the bottom (notes/course-map-plan.md, "The track
 * view"). The same metres as the strip, through the same geometry module.
 *
 * The look is the overhaul's (notes/course-map-visual-plan.md, "The track"):
 * a dark kerb under the surface, the surface in the four phases, a gate bar
 * at the start and a chequer at the goal, the last-spurt line across the
 * track (the warm glow over it is gone, Henry 2026-11-06), hills
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
 * gate to finish once, on a motion value: no React render per frame. (Walk the course was shelved, owner 2026-11-03;
 * a runner on the course belongs to the run view, notes/course-map-later.md.)
 */
import { useMemo, type CSSProperties, type ReactNode } from "react"
import { motion, useTransform, type MotionValue } from "framer-motion"
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
	trackParts,
	withLapRings,
	type CourseOverlays,
	type CourseSpan,
	type Shape,
} from "../../utils/courseGeometry"
import type { TrackColours } from "../../services/courseShapeStore"
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
// The least space kept between two chips, across (and two thirds of it down).
const CHIP_GAP_PX = 6
// The track's kerb, either side of the centreline, in track widths (it is
// drawn 1.55 tracks wide).
const KERB_HALF = 0.775
// How much clear air a chip keeps from the kerb's edge, in track widths.
// Daptrius drew his maps with no label within one track width of the track;
// Henry asked for one and a half (2026-11-06), the final straight's chip
// especially, which sat on the track's edge.
const CHIP_CLEAR_TRACKS = 1.5
// And from a hill's bracket and its ticks, which are thinner.
const BRACKET_CLEAR_TRACKS = 0.9
// Centre to centre between one lap's ring and the next, in track widths: the
// kerb (1.55) plus most of a track of air between them.
const RING_GAP_TRACKS = 2.4

type Tone = "start" | "goal" | "spurt" | "corner" | "straight" | "uphill" | "downhill" | "mark" | "heal" | "layer"

interface Callout {
	key: string
	/** The metre it belongs to, for ordering. */
	at: number
	/** Where it points, on the track (or on a hill's bracket). */
	point: [number, number]
	/** Where its leader starts, when not `point` (the spurt chip's leader runs back to the line). */
	leaderFrom?: [number, number]
	label: string
	detail?: string
	tone: Tone
	icon?: CourseIconName
	/** The icon's turn in degrees, for icons that follow the track (iconTurn). */
	iconRotate?: number
	/** A layer's name chip: its colour. */
	colour?: string
	/** Placed inside the curve, not outside (the spurt chip). */
	inward?: boolean
	/** A hill's grade, for its short chip on a phone. */
	percent?: number
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

/**
 * How far to turn a corner or straight icon so it points the way the race
 * runs at `metre` (Daptrius, 2026-11-04). The heading is the tangent's angle
 * in screen axes (y down, so positive is clockwise, the same sense as CSS's
 * rotate), snapped to 22.5 degrees: his idea, and it keeps a near-flat
 * straight's arrow flat instead of tilted a degree or two. The base offset
 * lines the icon's own heading up with 0 degrees: the straights already point
 * right, and the corner arrows start heading up (-90), so they take +90.
 */
const ICON_SNAP = 22.5
function iconTurn(shape: Shape, metre: number, distance: number, icon: CourseIconName): number {
	const { t } = frameAt(shape, metre, distance)
	const heading = (Math.atan2(t[1], t[0]) * 180) / Math.PI
	const base = icon === "cornerLeft" || icon === "cornerRight" ? 90 : 0
	const turn = Math.round(heading / ICON_SNAP) * ICON_SNAP + base
	// Kept in [0, 360) so the same heading always writes the same transform.
	return ((turn % 360) + 360) % 360
}

/** One stretch of the track (a phase, or a corner or straight), drawn in as the draw-in's progress passes it. */
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
	// Quiet, but on the card's fill so a leader passing behind never strikes the words.
	mark: "border-transparent bg-gray-800 text-[10px] text-gray-400",
	heal: "border-[color:var(--color-course-heal)] bg-gray-800 text-[color:var(--color-course-heal)]",
	// The lit skill's ink is a theme token (light on a light theme's deep
	// brand); a veteran's chip sets its own dark ink in CalloutBox.
	layer: "border-transparent text-[10.5px] font-bold text-[color:var(--color-course-lit-ink)] shadow-none",
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
	layer: "transparent",
}

/** A callout's chip. */
function CalloutBox({ callout, style }: { callout: Callout; style: CSSProperties }) {
	// The spurt chip's metre takes the chip's own ink (black, or white on a
	// light theme through the .bg-brand.text-black rule), a little quieter.
	const detail: ReactNode = callout.detail && (
		<span className={callout.tone === "spurt" ? "font-normal opacity-70" : "font-normal text-gray-400"}>{callout.detail}</span>
	)
	return (
		<div
			className={`pointer-events-none absolute inline-flex items-center gap-1 whitespace-nowrap rounded-[7px] border px-2 py-[3px] text-[11px] leading-tight shadow-[0_2px_8px_rgb(0_0_0/25%)] ${TONES[callout.tone]}`}
			style={{
				...style,
				...(callout.colour ? { background: callout.colour, borderColor: callout.colour } : {}),
				// A veteran's colour is bright on every theme, so it keeps the dark ink.
				...(callout.colour && callout.colour !== LIT ? { color: "#0b0b0f" } : {}),
			}}
		>
			{callout.icon && <CourseIcon name={callout.icon} rotate={callout.iconRotate} className={`h-3.5 w-3.5 shrink-0 ${ICON_TONES[callout.tone] ?? ""}`} />}
			{/* An icon-only chip (a bare track) has no label. */}
			{callout.label && <b className={callout.tone === "mark" ? "font-semibold" : callout.tone === "spurt" ? "font-extrabold" : "font-bold"}>{callout.label}</b>}
			{detail}
		</div>
	)
}

export default function CourseTrack({ course, shape: baseShape, overlays, widthPx = BOX_PX, compact = false, showWords = true, colours = "phase", className = "", preview = null, onPreview }: {
	course: RaceCourse
	/** The real shape or the schematic, in screen axes (utils/courseSchematic.ts). */
	shape: Shape
	overlays?: CourseOverlays
	/** The box's widest, in px: the guide's 1000, the Timeline drawer's less. */
	widthPx?: number
	/** Call out only the start, the goal, the spurt, the corners and the final straight (a phone's box). */
	compact?: boolean
	/** False draws the track bare: icon chips with no words (a phone's, until it's tapped). */
	showWords?: boolean
	/**
	 * What the track's surface is coloured by: the four race phases, or the
	 * corners and straights in the strip's Course row colours (Daptrius,
	 * 2026-11-06: "to clearly show when and where corners and straights are").
	 */
	colours?: TrackColours
	className?: string
	/** A layer span's `key` the strip's pointer is over: drawn bolder, the other arcs quietened. */
	preview?: string | null
	/** Hears which arc (by span `key`) the pointer is over, null when it leaves: the strip lights it. */
	onPreview?: (key: string | null) => void
}) {
	const distance = course.distance
	const { ref, progress } = useDrawIn<HTMLDivElement>(1.4)
	// (The breathing glow over the spurt line is gone: Henry, 2026-11-06, board
	// post 1568126648560390237. The beacon line and the spurt chip mark the spot.)

	const drawing = useMemo(() => {
		const base = shapeBounds(baseShape)
		const size = Math.max(base.width, base.height) || 1
		// Room for the callouts round the track; a phone's box needs more. A
		// desktop's has more at the sides than above and below, because a chip
		// is far wider than it is tall. (0.17 all round until the chips kept a
		// track and a half clear of the kerb: one on a bend near the box's side,
		// like Chukyo 1200's Corner 4, had nowhere to go but round.) A phone's
		// has more below: the finish runs along the bottom, so the final
		// straight, the hills on it and the last corner all want that edge,
		// and a phone's chips are big for its box. Henry's markup (2026-11-06)
		// put Corner 4 down there and the final straight under it.
		const pad = compact
			? { x: size * 0.48, top: size * 0.35, bottom: size * 0.62 }
			: { x: size * 0.27, top: size * 0.2, bottom: size * 0.2 }
		// The track's width in the shape's units: 2% of the box (3% on a phone),
		// sized on the course before its rings so the rings can be spaced by it.
		// (Rings drawn outside widen the box a little; the track stays this wide.)
		const nominal = (base.width + 2 * pad.x) * (compact ? 0.03 : 0.02)
		// A course drawn as rings needs room for them on its bends: its track is
		// no wider than a desktop's share of the course (about 3.2%), or a
		// phone's thicker track spaced its inner ring so far in that the bend
		// folded over itself (Chukyo dirt 1800). One-lap courses keep theirs.
		const ringed = withLapRings(baseShape, course, 1) !== baseShape
		const track = ringed ? Math.min(nominal, size * 0.032) : nominal
		// Ring spacing, in track widths. It used to be a share of the course's
		// size (4.5%), which on a phone, whose track is drawn thicker, was less
		// than the track's own width with its kerb: later laps ran over earlier
		// ones (Daptrius, 2026-11-06: Hanshin and Kyoto "overlap with themselves").
		const shape = withLapRings(baseShape, course, track * RING_GAP_TRACKS)
		const bounds = shapeBounds(shape)
		const box = { x: bounds.minX - pad.x, y: bounds.minY - pad.top, width: bounds.width + 2 * pad.x, height: bounds.height + pad.top + pad.bottom }
		const centre = [bounds.minX + bounds.width / 2, bounds.minY + bounds.height / 2] as const
		const clockwise = (cumulativeTurn(shape).at(-1) ?? 0) >= 0
		return { shape, box, size, centre, clockwise, track }
	}, [baseShape, course, compact])
	const { shape, box, size, centre, clockwise, track } = drawing
	// The outside of the track is the left of travel on a clockwise course.
	const outside = clockwise ? 1 : -1
	const unitsPerPx = box.width / widthPx
	const P = (metre: number) => pointAtMetre(shape, metre, distance)
	// The same metre before the laps are pulled apart into rings: every pass of
	// one spot (a hill run each lap, the home straight) lies on the same ground
	// here, so "the same spot" is judged on this path, never on the rings. On
	// the rings, a spot passed three times (Nakayama 3600's home straight) has
	// its outer pass two ring gaps out, past `near`, and split into two chips.
	const PB = (metre: number) => pointAtMetre(baseShape, metre, distance)

	const facts = courseFacts(course)
	const { mid, late, finalSixth } = phaseStarts(distance)
	const phases = facts.spans.filter((span) => span.kind === "phase")
	// The stretches the surface is drawn in, each in its colour. By course,
	// corners alternate two shades so two in a row read as two, and a gap the
	// game leaves between parts (Nakayama 2500's gate, before the chute joins
	// corner 3) is a faded straight: the strip leaves it unfilled, but on the
	// track a bare kerb read as a hole in the course.
	const stretches = colours === "course"
		? (() => {
			let corner = 0
			return trackParts(course).map((part) => ({
				start: part.start,
				end: part.end,
				stroke: part.kind === "gap"
					? "color-mix(in srgb, var(--color-course-straight) 50%, var(--color-course-bed))"
					: part.kind === "corner"
						? corner++ % 2 === 1 ? "var(--color-course-corner-alt)" : "var(--color-course-corner)"
						: part.label === "Final straight" ? "var(--color-course-straight-final)" : "var(--color-course-straight)",
			}))
		})()
		: phases.map((phase, index) => ({ start: phase.start, end: phase.end, stroke: PHASE_STROKES[index % PHASE_STROKES.length] }))

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
		const middle = PB((hill.start + hill.end) / 2)
		const same = hills.find((other) => other.label === hill.label && near(PB((other.start + other.end) / 2), middle))
		if (same) {
			same.starts.push(hill.start)
			continue
		}
		hills.push({ ...hill, starts: [hill.start], bracket: parallel(slice(shape, hill.start, hill.end, distance), track * 1.25 * outside) })
	}

	// The layers: one arc lane per GROUP (the lit skill, each veteran), since
	// the arcs carry no words; the strip gives every label its own row.
	const layerSpans = ((overlays?.spans ?? []) as (CourseSpan & { key?: string })[]).filter((span) => span.kind !== "phase" && span.kind !== "anywhere" && span.kind !== "passive")
	// The strip's hover, on the arcs: the one under the pointer bolder, the rest quiet.
	const previewing = preview !== null && layerSpans.some((span) => span.key === preview)
	const emphasis = (span: { key?: string }) => (!previewing ? 1 : span.key === preview ? 1.7 : 0)
	const quiet = (span: { key?: string }, base: number) => (previewing && span.key !== preview ? 0.25 : base)
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
			// "Spurt starts" (Henry, 2026-11-03, after gametora); the phase band keeps "Last spurt".
			label: "Spurt starts",
			detail: formatMetres(late),
			tone: "spurt",
			icon: "flag",
			inward: true,
		})
	}
	// A corner's and a straight's callout points at where it STARTS, the metre
	// it names, like every other callout (Daptrius, 2026-11-03).
	const cornerIcon: CourseIconName = course.direction === "right" ? "cornerRight" : "cornerLeft"
	// One chip per corner SPOT, with each lap's metres: the same number on the
	// same ground. The number alone isn't enough: Nakayama 2500 starts on a
	// chute that joins corner 3 partway round, so its first "corner 3" (100 m)
	// and the next lap's (1,700 m) start in different places, and one chip
	// pointing at the chute left lap two's corner 3 unmarked (Daptrius,
	// 2026-11-06: "it's unclear where the corner is").
	const cornerSpots: { number: number; starts: number[]; base: [number, number] }[] = []
	for (const corner of [...course.corners].sort((a, b) => a.start - b.start)) {
		const base = PB(corner.start)
		const same = cornerSpots.find((spot) => spot.number === corner.number && near(spot.base, base))
		if (same) same.starts.push(corner.start)
		else cornerSpots.push({ number: corner.number, starts: [corner.start], base })
	}
	for (const { number, starts } of cornerSpots) {
		allCallouts.push({
			key: `corner-${number}-${starts[0]}`,
			at: starts[0],
			point: P(starts[0]),
			label: number > 0 ? `Corner ${number}` : "Corner",
			detail: starts.map(formatMetres).join(", "),
			tone: "corner",
			icon: cornerIcon,
			// A corner run on each lap is the same ground, so the first lap's heading serves.
			iconRotate: iconTurn(shape, starts[0], distance, cornerIcon),
		})
	}
	const straight = finalStraight(course)
	// Every other straight: one callout per spot with each lap's start metres,
	// like the corners (Daptrius's render). Not the one leaving the gate: the
	// Start callout is already there.
	const straightSpots: { at: number[]; base: [number, number] }[] = []
	for (const part of [...course.straights].sort((a, b) => a.start - b.start)) {
		if (part.start === 0 || part.start === straight?.start) continue
		const base = PB(part.start)
		const same = straightSpots.find((spot) => near(spot.base, base))
		if (same) same.at.push(part.start)
		else straightSpots.push({ at: [part.start], base })
	}
	if (straight) {
		// On a course of more than one lap the final straight is the home
		// straight an earlier lap already ran: that pass joins this chip instead
		// of a second chip beside it (owner, 2026-11-06), named for what it is,
		// since the earlier metre isn't the final straight yet.
		const earlier = straightSpots.find((spot) => near(spot.base, PB(straight.start)))
		if (earlier) straightSpots.splice(straightSpots.indexOf(earlier), 1)
		const before = earlier ? ` (${earlier.at.map(formatMetres).join(", ")} ${earlier.at.length === 1 ? "a lap before" : "on earlier laps"})` : ""
		allCallouts.push({
			key: "final-straight",
			at: straight.start,
			point: P(straight.start),
			label: "Final straight",
			// Its start, not its length: every other callout counts from the gate.
			detail: formatMetres(straight.start) + before,
			tone: "straight",
			icon: "finalStraight",
			iconRotate: iconTurn(shape, straight.start, distance, "finalStraight"),
		})
	}
	for (const spot of straightSpots) {
		allCallouts.push({ key: `straight-${spot.at[0]}`, at: spot.at[0], point: P(spot.at[0]), label: "Straight", detail: spot.at.map(formatMetres).join(", "), tone: "straight", icon: "straight", iconRotate: iconTurn(shape, spot.at[0], distance, "straight") })
	}
	for (const hill of hills) {
		allCallouts.push({
			key: `hill-${hill.start}`,
			at: hill.start,
			// Anchored where the hill begins, not its middle (Henry, 2026-11-03).
			point: hill.bracket[0],
			label: hill.label,
			detail: hill.starts.length > 1 ? hill.starts.map(formatMetres).join(", ") : `${Math.round(hill.start).toLocaleString("en-US")}–${formatMetres(hill.end)}`,
			tone: hill.kind,
			icon: hill.kind,
			percent: hill.percent,
		})
	}
	// No callout where the ground changes (Tokyo dirt 1600 starts on turf): the
	// race counts as its own surface from the gate, and "Dirt from here" made
	// players doubt which aptitude it needs (Daptrius, 2026-11-09).
	// Halfway and Position keep ends keep their callouts (owner, 2026-11-03), quietly.
	for (const marker of facts.markers) {
		if (marker.kind === "spurt-start") continue
		allCallouts.push({ key: `marker-${marker.kind}`, at: marker.at, point: P(marker.at), label: marker.label, detail: formatMetres(marker.at), tone: "mark" })
	}
	for (const marker of overlays?.markers ?? []) {
		if (marker.kind === "heal-check") allCallouts.push({ key: "heal-check", at: marker.at, point: P(marker.at), label: marker.label, detail: formatMetres(marker.at), tone: "heal" })
	}
	// A layer's skill is marked by its ICON at its zone's start, on its arc
	// (owner, 2026-11-04: name chips for several skills on one line were
	// unreadable; the legend under the track names them); one per skill per
	// group. A span with no icon keeps a name chip.
	const named = new Set<string>()
	const icons: { key: string; span: CourseSpan & { key?: string }; x: number; y: number; colour: string }[] = []
	// Several skills often start at one metre (the late-race start): an icon
	// that would sit on another slides forward along its own arc until clear.
	const iconR = track * 0.48
	for (const span of layerSpans) {
		if (!span.label || named.has(`${span.group}:${span.label}`)) continue
		named.add(`${span.group}:${span.label}`)
		const offset = laneOffset(laneOf(span))
		const place = (metre: number): [number, number] => {
			const { n } = frameAt(shape, metre, distance)
			const [x, y] = P(metre)
			return [x + n[0] * offset, y + n[1] * offset]
		}
		if (!span.image) {
			allCallouts.push({ key: `layer-${span.group ?? "lit"}-${span.label}`, at: span.start, point: place(span.start), label: span.label, tone: "layer", colour: span.colour ?? LIT })
			continue
		}
		let metre = span.start
		let [x, y] = place(metre)
		for (let step = 0; step < 12 && icons.some((other) => Math.hypot(other.x - x, other.y - y) < iconR * 2.2); step++) {
			metre = Math.min(span.end, metre + distance * 0.014)
			;[x, y] = place(metre)
			if (metre >= span.end) break
		}
		icons.push({ key: `icon-${span.group ?? "lit"}-${span.label}`, span, x, y, colour: span.colour ?? LIT })
	}
	// A phone-sized box has room for the start, the goal, the spurt, the
	// corners, the final straight and the hills (Henry, 2026-11-06: the hills'
	// triangles on a phone too, bare or with words); the headline under it says
	// the rest. A course that passes its corners twice has no room for them
	// either: the strip under the track names them.
	const twoLaps = course.corners.length > 4
	const worded = compact
		? allCallouts
			.filter((callout) => ["start", "goal", "spurt", "uphill", "downhill"].includes(callout.tone) || (callout.tone === "corner" && !twoLaps) || callout.key === "final-straight")
			// Only the spurt keeps its metre: the strip under the track has the rest.
			.map((callout) => (callout.tone === "spurt" ? callout : { ...callout, detail: undefined }))
			// A hill keeps its triangle and its percent, the strip's short form
			// for a hill too narrow for its words: "Uphill 2%" in full was as wide
			// as the final straight's chip, and on a small track the two fought
			// for the same stretch.
			.map((callout) => (callout.percent === undefined ? callout : { ...callout, label: `${callout.percent}%` }))
		: allCallouts
	// Bare (a phone's track until it's tapped): the chips that carry an icon keep
	// it, without their words, like gametora's map (Henry, 2026-11-04). Start and
	// Goal have no icon; the gate bar and the chequer already mark them.
	const callouts = showWords ? worded : worded.filter((callout) => callout.icon).map((callout) => ({ ...callout, label: "", detail: undefined }))

	// Every callout sits past the outermost layer arc so no word covers a zone.
	const labelReach = outermost < 0 ? size * 0.11 : Math.max(size * 0.11, track * (1.85 + outermost * 0.62) + track * 1.6)
	const estimate = (callout: Callout) => {
		const text = callout.label.length + (callout.detail ? callout.detail.length + 1.5 : 0)
		return { width: (text * CHAR_PX + LABEL_PAD_PX + (callout.icon ? ICON_PX : 0)) * unitsPerPx, height: LABEL_HEIGHT_PX * unitsPerPx }
	}
	// How far out, along `direction`, the track's OTHER passes of this spot run
	// past `point`: on rings, a chip anchored on an inner pass would otherwise
	// land on the passes outside it (Nakayama 3600's Start chip sat on the red
	// final straight, two rings out). A pass is another stretch of the path on
	// the same ground before the rings (PB), at least a fifth of the race away
	// along it, so the anchor's own pass never counts.
	const lastPoint = shape.length - 1
	// The track and the brackets as the placer sees them: points no further
	// apart than half a track, so no gap between two of them lets a chip
	// through, and no more of them than that (every chip's every spot is
	// checked against all of them).
	const thin = (path: readonly (readonly [number, number])[]) => {
		if (path.length < 3) return path
		let length = 0
		for (let i = 1; i < path.length; i++) length += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1])
		const every = Math.max(1, Math.floor((track * 0.5) / (length / (path.length - 1) || 1)))
		return path.filter((_, index) => index % every === 0 || index === path.length - 1)
	}
	const trackPoints = thin(shape)
	// A bracket's run and both its ticks back to the track.
	const bracketPoints = hills.flatMap((hill) => {
		const tick = (from: readonly [number, number], to: readonly [number, number]) =>
			[0.25, 0.5].map((k) => [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k] as const)
		return [...thin(hill.bracket), ...tick(hill.bracket[0], P(hill.start)), ...tick(hill.bracket[hill.bracket.length - 1], P(hill.end))]
	})
	const outerPasses =(at: number, point: readonly [number, number], direction: readonly [number, number]) => {
		const [bx, by] = PB(at)
		const index = Math.round(metreToFraction(at, distance) * lastPoint)
		let reach = 0
		for (let i = 0; i <= lastPoint; i++) {
			if (Math.abs(i - index) < lastPoint * 0.2) continue
			if (Math.hypot(baseShape[i][0] - bx, baseShape[i][1] - by) > size * 0.04) continue
			const past = (shape[i][0] - point[0]) * direction[0] + (shape[i][1] - point[1]) * direction[1]
			reach = Math.max(reach, past)
		}
		return reach
	}
	const positions = placeLabels(
		callouts.map((callout) => {
			// Away from the middle of the drawing, except on a straight course,
			// where that points along the track and every chip queued off its
			// ends (Niigata 1000's on a phone sat on each other): there, the
			// side of the track (up, the spurt chip down).
			const [ox, oy] = course.direction === "straight" ? [0, -1] : awayFromMiddle(callout.point)
			const direction = callout.inward ? [-ox, -oy] as const : [ox, oy] as const
			// The chip is placed from the outermost pass at its spot; the leader
			// still starts at the callout's own point, across the passes outside it.
			const out = callout.inward ? 0 : outerPasses(callout.at, callout.point, direction)
			const anchor = [callout.point[0] + direction[0] * out, callout.point[1] + direction[1] * out] as const
			// A few px of air round each chip when checking for clashes: the
			// widths are estimates from the text, and a chip moved off an inner
			// pass otherwise met its neighbour edge to edge (Goal and Corner 1 on Oi 2000).
			const { width, height } = estimate(callout)
			// Its first try sits just clear of the track: the kerb, the clear air,
			// then half the chip's own depth that way. A shared distance put a
			// wide chip back on the track and a small one too far out.
			const depth = (Math.abs(direction[0]) * width + Math.abs(direction[1]) * height) / 2
			const reach = callout.inward ? 0 : track * (KERB_HALF + CHIP_CLEAR_TRACKS + 0.25) + depth
			return { key: callout.key, anchor, direction, width: width + CHIP_GAP_PX * unitsPerPx, height: height + (CHIP_GAP_PX / 1.5) * unitsPerPx, reach, noMargin: callout.inward }
		}),
		labelReach,
		// No chip lies across the track and its kerb (a wide chip at a bend,
		// like Nakayama 3600's "Final straight 3,290m (1,615m a lap before)",
		// reached back over it)...
		{ points: trackPoints, halfWidth: track * (KERB_HALF + 0.2) },
		{
			// ...and none within a track and a half of the kerb (CHIP_CLEAR_TRACKS)
			// while there's a clear spot elsewhere. The spurt chip, inside the
			// curve, keeps only off the track: a small track's curve has no room
			// for the margin, and outside it the chip's leader crossed the track.
			margin: { points: trackPoints, halfWidth: track * (KERB_HALF + CHIP_CLEAR_TRACKS) },
			// Nor over a hill's bracket and its ticks (Henry, 2026-11-06).
			keepOut: bracketPoints.length ? [{ points: bracketPoints, halfWidth: track * BRACKET_CLEAR_TRACKS }] : [],
			// Inside the box: a chip that spilled out used to be clamped straight
			// back in, onto whatever was there (Corner 4 and the final straight
			// on a phone's Chukyo 1200 landed on the track).
			bounds: box,
			// And a leader that would cut across another stretch of the track is
			// a last resort.
			// A last resort too: a leader across a hill's bracket.
			leaderTrack: { points: [...trackPoints, ...bracketPoints], halfWidth: track * KERB_HALF },
		},
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
	// A layer's name chip that still sits on another chip is dropped (the
	// strip names every span); the course's own callouts always stay.
	const placed: { x: number; y: number; w: number; h: number }[] = []
	const shown = callouts.filter((callout) => {
		const { width: w, height: h } = estimate(callout)
		const [x, y] = positions[callout.key]
		const collides = placed.some((other) => Math.abs(other.x - x) < (other.w + w) / 2 && Math.abs(other.y - y) < (other.h + h) / 2)
		if (callout.tone === "layer" && collides) return false
		placed.push({ x, y, w, h })
		return true
	})
	const percent = ([x, y]: [number, number]): CSSProperties => ({
		left: `${((x - box.x) / box.width) * 100}%`,
		top: `${((y - box.y) / box.height) * 100}%`,
		transform: "translate(-50%, -50%)",
	})
	/** The point a kerb's half-width out from `spot`, towards `chip`: where a leader starts. */
	const edgeTowards = (spot: readonly [number, number], chip: readonly [number, number]): [number, number] => {
		const dx = chip[0] - spot[0]
		const dy = chip[1] - spot[1]
		const length = Math.hypot(dx, dy) || 1
		return [spot[0] + (dx / length) * track * 0.8, spot[1] + (dy / length) * track * 0.8]
	}
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
	// The arrow beside the gate that says which way the race runs (Henry,
	// 2026-11-03, after gametora): a little past the start, pointing the way of
	// travel, on the first side with nothing drawn: inside the kerb, then outside
	// (where the hill brackets live), then further out either way (a two-lap
	// course's other lap runs just inside). A gate boxed in on every side, like
	// Nakayama 3600's, gets no arrow: the corner icons already turn its way.
	const directionArrow = (() => {
		const last = shape.length - 1
		const drawn = [...shape, ...hills.flatMap((hill) => hill.bracket)]
		for (const metre of [Math.min(distance * 0.04, 90), Math.min(distance * 0.02, 40)]) {
			const { t, n } = frameAt(shape, metre, distance)
			const [px, py] = P(metre)
			const here = metreToFraction(metre, distance) * last
			// Everything drawn but this stretch of the track itself.
			const others = drawn.filter((_, index) => index > last || Math.abs(index - here) > (last * 150) / distance)
			const clear = (x: number, y: number) => others.every(([ox, oy]) => Math.hypot(ox - x, oy - y) > track * 1.1)
			const side = [-1.35, 1.35, -2.9, 2.9].map((k) => k * outside).find((k) => clear(px + n[0] * track * k, py + n[1] * track * k))
			if (side === undefined) continue
			const cx = px + n[0] * track * side
			const cy = py + n[1] * track * side
			const tip = [cx + t[0] * track * 0.7, cy + t[1] * track * 0.7]
			const back = [cx - t[0] * track * 0.35, cy - t[1] * track * 0.35]
			const wing = track * 0.42
			return [tip, [back[0] + n[0] * wing, back[1] + n[1] * wing], [back[0] - n[0] * wing, back[1] - n[1] * wing]]
				.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
				.join(" ")
		}
		return null
	})()
	const beaconEnd = (() => {
		const { n } = frameAt(shape, late, distance)
		const [x, y] = P(late)
		return [x + n[0] * track * 1.05 * outside, y + n[1] * track * 1.05 * outside]
	})()

	return (
		<div ref={ref} className={`relative mx-auto w-full ${className}`} style={{ maxWidth: widthPx, aspectRatio: `${box.width} / ${box.height}` }} aria-hidden="true">
			<svg viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`} className="absolute inset-0 h-full w-full overflow-visible">
				{/* The kerb, then the race over it, phase by phase. Butt ends: a
				    round cap poked a black nub out past the chequer and behind the
				    gate (Henry, 2026-11-04), so the kerb now stops flush with both. */}
				<polyline points={points(shape)} fill="none" stroke="var(--color-course-bed)" strokeWidth={track * 1.55} strokeLinejoin="round" strokeLinecap="butt" />
				{stretches.map((stretch) => (
					<PhaseLine key={stretch.start} shape={shape} start={stretch.start} end={stretch.end} distance={distance} stroke={stretch.stroke} width={track} progress={progress} />
				))}
				{/* Thin ticks where a phase changes; by course, the colours change there instead. */}
				{colours === "phase" && [mid, finalSixth].map((metre) => <line key={metre} {...across(metre, track * 0.55)} stroke="var(--color-course-tick)" strokeWidth={track * 0.12} />)}
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
						return <circle key={`layer-${index}`} cx={x + n[0] * offset} cy={y + n[1] * offset} r={track * 0.28 * Math.max(1, emphasis(span))} fill={colour} opacity={quiet(span, 1)} data-preview={span.key === preview || undefined} onMouseEnter={onPreview && span.key ? () => onPreview(span.key ?? null) : undefined} onMouseLeave={onPreview ? () => onPreview(null) : undefined} />
					}
					const section = slice(shape, span.start, Math.max(span.end, span.start + distance / 400), distance)
					return (
						<polyline
							key={`layer-${index}`}
							points={points(parallel(section, offset))}
							fill="none"
							stroke={colour}
							strokeWidth={(span.kind === "window" ? track * 0.16 : track * 0.34) * Math.max(1, emphasis(span))}
							strokeDasharray={span.kind === "random" ? `${track * 0.5} ${track * 0.32}` : span.kind === "window" ? `${track * 0.12} ${track * 0.22}` : undefined}
							strokeLinecap="round"
							opacity={quiet(span, span.kind === "window" ? 0.8 : 1)}
							data-preview={span.key === preview || undefined}
							onMouseEnter={onPreview && span.key ? () => onPreview(span.key ?? null) : undefined}
							onMouseLeave={onPreview ? () => onPreview(null) : undefined}
						>
							{span.label && <title>{span.detail ? `${span.label}. ${span.detail}` : span.label}</title>}
						</polyline>
					)
				})}
				{/* Each lit skill's icon at its arc's start, ringed in its colour; a
				    hover target like the arc. */}
				{icons.map((icon) => {
					const r = iconR * Math.max(1, emphasis(icon.span) * 0.8)
					return (
						<g
							key={icon.key}
							opacity={quiet(icon.span, 1)}
							data-layer-icon={icon.span.label}
							onMouseEnter={onPreview && icon.span.key ? () => onPreview(icon.span.key ?? null) : undefined}
							onMouseLeave={onPreview ? () => onPreview(null) : undefined}
						>
							<title>{icon.span.detail ? `${icon.span.label}. ${icon.span.detail}` : icon.span.label}</title>
							<circle cx={icon.x} cy={icon.y} r={r} fill="var(--color-gray-900)" stroke={icon.colour} strokeWidth={track * 0.14} />
							<image href={icon.span.image ?? undefined} x={icon.x - r * 0.78} y={icon.y - r * 0.78} width={r * 1.56} height={r * 1.56} style={{ clipPath: "circle(50%)" }} />
						</g>
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
				{directionArrow && <polygon points={directionArrow} fill="var(--color-course-gate)" data-course="direction" />}
				{/* Leaders from the kerb's edge to each callout, in the callout's own
				    colour. Nothing is drawn on the track itself (Henry, 2026-11-03): a
				    leader starts a kerb's half-width out from its spot, towards its chip.
				    The spurt chip's runs from its line; a layer's from its arc; a
				    hill's from its bracket. */}
				{shown.map((callout) => {
					const offTrack = ["layer", "uphill", "downhill"].includes(callout.tone)
					const from = callout.leaderFrom ?? (offTrack ? callout.point : edgeTowards(callout.point, positions[callout.key]))
					return (
						<g key={`leader-${callout.key}`} stroke={LEADERS[callout.tone]} fill={LEADERS[callout.tone]}>
							<line x1={from[0]} y1={from[1]} x2={positions[callout.key][0]} y2={positions[callout.key][1]} strokeWidth={track * 0.09} opacity={0.9} />
						</g>
					)
				})}
			</svg>
			{shown.map((callout) => (
				<CalloutBox key={callout.key} callout={callout} style={percent(positions[callout.key])} />
			))}
		</div>
	)
}
