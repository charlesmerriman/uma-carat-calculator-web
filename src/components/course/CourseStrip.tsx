/**
 * The course as a strip: the race from the gate to the finish, read in bands
 * (the hill profile, the hills, the ground where it changes, the straights and
 * corners, the phases, the 24 sections, the metres). After the mock
 * (notes/course-map/mocks/01-guide-desktop-strip.png) and the team's input: the
 * words go on the segments, never symbols (Henry, 2026-11-01).
 *
 * One component, two orientations (owner, 2026-10-29): across the page, or,
 * on a phone, DOWN it, the bands becoming columns and the words staying
 * horizontal. The caller renders one of each and lets CSS pick, because
 * /app/pvp is prerendered and nothing at render time may read the screen.
 *
 * Every position comes from utils/courseGeometry.ts, and nothing is measured:
 * bands are percentages of the race. On top of the record it draws the
 * course's own facts (courseFacts) plus any `overlays` a later layer hands it,
 * and an optional `cursor` (a metre). See "Groundwork" in the plan.
 *
 * Motion (owner, 2026-11-02): the first time it scrolls into view, the strip
 * sweeps in from the gate to the finish. The first paint is the finished strip
 * (the prerender's), the sweep runs after mount on a motion value (no React
 * re-render per frame), and reduced motion skips it.
 */
import { useEffect, useMemo, type CSSProperties, type ReactNode } from "react"
import { AnimatePresence, motion, useMotionTemplate, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "framer-motion"
import type { RaceCourse } from "../../types"
import {
	courseFacts,
	elevationProfile,
	formatMetres,
	markerLanes,
	metreToFraction,
	rulerTicks,
	sectionBoundaries,
	slopeParts,
	surfaceParts,
	trackParts,
	type CourseOverlays,
} from "../../utils/courseGeometry"
import { useDrawIn } from "./useDrawIn"

type Orientation = "horizontal" | "vertical"

interface CourseStripProps {
	course: RaceCourse
	/**
	 * Layers on top of the course's own facts: a skill's zones, the veterans'
	 * skills (utils/courseLayers.ts). Spans other than phases go in the layers
	 * band, one row per `lane`; a span with a `key` pops in and out by it.
	 */
	overlays?: CourseOverlays
	/** What heads a group of layer rows: a veteran's avatar (CourseSection). */
	laneHeads?: { key: string; firstLane: number; lanes: number; head: ReactNode }[]
	/** A metre to mark, still or moving (Walk the course). */
	cursor?: number | MotionValue<number>
	orientation?: Orientation
	className?: string
}

const LAYER_ROW_PX = 18
const LAYER_HEAD_PX = 24
// The layer kinds' looks: a fixed stretch solid, a random point striped, an
// "anywhere" a dashed outline over the whole course, a passive a quiet band.
const LAYER_LOOKS: Record<string, CSSProperties> = {
	fixed: { background: "color-mix(in srgb, var(--color-brand) 75%, transparent)" },
	random: {
		background: "repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-brand) 70%, transparent) 0 6px, color-mix(in srgb, var(--color-brand) 30%, transparent) 6px 12px)",
	},
	point: { background: "var(--color-brand)" },
	anywhere: { border: "1px dashed var(--color-brand)" },
	passive: { background: "color-mix(in srgb, var(--color-brand) 18%, transparent)" },
}

/**
 * The layers band: each layer span in its row, its label on it, popping in
 * along the race (a short stagger by where it starts) and fading out
 * together. Under reduced motion a plain fade.
 */
function LayersBand({ spans, laneHeads, distance, vertical }: {
	spans: (CourseOverlays["spans"][number] & { key?: string })[]
	laneHeads: NonNullable<CourseStripProps["laneHeads"]>
	distance: number
	vertical: boolean
}) {
	const reduceMotion = useReducedMotion()
	const rows = Math.max(1, ...spans.map((span) => (span.lane ?? 0) + 1), ...laneHeads.map((head) => head.firstLane + head.lanes))
	const headed = laneHeads.length > 0 && !vertical
	return (
		<div className={vertical ? "flex h-full shrink-0" : "flex w-full shrink-0"} data-band="layers">
			{headed && (
				<div className="relative shrink-0" style={{ width: LAYER_HEAD_PX, height: rows * LAYER_ROW_PX }}>
					{laneHeads.map((head) => (
						<div key={head.key} className="absolute left-0.5" style={{ top: head.firstLane * LAYER_ROW_PX + 1, width: LAYER_HEAD_PX - 4 }}>
							{head.head}
						</div>
					))}
				</div>
			)}
			<div
				className="relative min-w-0 flex-1 bg-gray-900/40"
				style={vertical ? { width: rows * 14 } : { height: rows * LAYER_ROW_PX }}
			>
				<AnimatePresence>
					{spans.map((span) => {
						const lane = span.lane ?? 0
						const point = span.kind === "point" || span.start === span.end
						const from = metreToFraction(span.start, distance) * 100
						const size = Math.max(point ? 0.6 : 0.4, metreToFraction(span.end, distance) * 100 - from)
						const place: CSSProperties = vertical
							? { top: `${from}%`, height: `${size}%`, left: lane * 14 + 1, width: 12 }
							: { left: `${from}%`, width: `${size}%`, top: lane * LAYER_ROW_PX + 1, height: LAYER_ROW_PX - 2 }
						return (
							<motion.div
								key={span.key ?? `${span.kind}-${span.start}-${lane}`}
								className="absolute flex items-center overflow-visible rounded-sm"
								style={{ ...place, ...LAYER_LOOKS[span.kind] }}
								initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.85 }}
								animate={{ opacity: 1, scale: 1, transition: { delay: reduceMotion ? 0 : (span.start / distance) * 0.35, duration: 0.2 } }}
								exit={{ opacity: 0, transition: { duration: 0.15 } }}
							>
								{span.label && !vertical && (
									<span className="relative z-10 ml-1 whitespace-nowrap rounded-sm bg-gray-900/80 px-1 text-[10px] font-semibold leading-tight text-gray-100">
										{span.label}
									</span>
								)}
							</motion.div>
						)
					})}
				</AnimatePresence>
			</div>
		</div>
	)
}

// Light ink on the darker fills, dark ink on the light ones (the mock's).
const LIGHT_INK = "#f8fafc"
const DARK_INK = "#2b2708"
const PHASE_FILLS = ["var(--color-course-early)", "var(--color-course-mid)", "var(--color-course-late)"]
const PHASE_INKS = [LIGHT_INK, DARK_INK, LIGHT_INK]

// A part narrower than this share of the race swaps its words for the short
// form ("Down 2%"), and below the second keeps only its colour: the words
// would only be cut off.
const MIN_LABEL_SHARE = 0.06
const MIN_SHORT_LABEL_SHARE = 0.025
const MIN_END_LABEL_SHARE = 0.1

/** Where a stretch sits along the strip, as percentages: across or down. */
function place(start: number, end: number, distance: number, vertical: boolean): CSSProperties {
	const from = metreToFraction(start, distance) * 100
	const size = metreToFraction(end, distance) * 100 - from
	return vertical ? { top: `${from}%`, height: `${size}%` } : { left: `${from}%`, width: `${size}%` }
}

function at(metre: number, distance: number, vertical: boolean): CSSProperties {
	const position = `${metreToFraction(metre, distance) * 100}%`
	return vertical ? { top: position } : { left: position }
}

/** One stretch of a band: its colour, its words, and the metre where it ends. */
function Segment({ start, end, distance, vertical, fill, ink, label, shortLabel, endLabel }: {
	start: number
	end: number
	distance: number
	vertical: boolean
	fill: string
	ink: string
	label?: string
	shortLabel?: string
	endLabel?: string
}) {
	const share = metreToFraction(end, distance) - metreToFraction(start, distance)
	const words = share >= MIN_LABEL_SHARE ? label : share >= MIN_SHORT_LABEL_SHARE ? shortLabel : undefined
	return (
		<div
			className={`absolute flex items-center justify-center overflow-hidden ${vertical ? "inset-x-0" : "inset-y-0"}`}
			style={{ ...place(start, end, distance, vertical), background: fill, color: ink }}
		>
			{/* On the band's own colour and above the marker lines, so a line
			    passing through the middle never cuts the words. */}
			{words && (
				<span
					className={`relative z-10 rounded-sm px-1 font-semibold ${
						// Down the page a column is ~60px wide: the words wrap
						// onto a second line instead of being cut off.
						vertical ? "break-words text-center text-[10px] leading-tight" : "truncate text-[11px] leading-none"
					}`}
					style={{ background: fill }}
				>
					{words}
				</span>
			)}
			{endLabel && share >= MIN_END_LABEL_SHARE && (
				<span className={`absolute z-10 text-[9px] leading-none opacity-80 ${vertical ? "bottom-0.5 left-1" : "bottom-0.5 right-1"}`}>
					{endLabel}
				</span>
			)}
		</div>
	)
}

/**
 * A band of the strip: a row across, or a column down. Without a `size` a
 * column shares the width left over with the other flexible ones.
 */
function Band({ vertical, size, label, children }: { vertical: boolean; size?: string; label: string; children: ReactNode }) {
	const flexible = size === undefined
	return (
		<div
			className={`relative overflow-hidden bg-gray-900/40 ${
				vertical ? (flexible ? "h-full min-w-0 flex-1" : "h-full shrink-0") : "w-full shrink-0"
			}`}
			style={flexible ? undefined : vertical ? { width: size } : { height: size }}
			data-band={label}
		>
			{children}
		</div>
	)
}

function ElevationBand({ course, vertical, size }: { course: RaceCourse; vertical: boolean; size: string }) {
	const profile = elevationProfile(course)
	const heights = profile.map((point) => point.height)
	const low = Math.min(...heights)
	const range = Math.max(...heights) - low
	// Height as 15 to 85 across the band's depth; a flat course sits mid-way.
	const depth = (height: number) => (range === 0 ? 50 : 15 + ((height - low) / range) * 70)
	const line = profile.map((point) =>
		vertical ? `${depth(point.height)},${point.at}` : `${point.at},${100 - depth(point.height)}`,
	)
	const fill = vertical
		? `0,0 ${line.join(" ")} 0,${course.distance}`
		: `${line.join(" ")} ${course.distance},100 0,100`
	return (
		<Band vertical={vertical} size={size} label="elevation">
			<svg
				viewBox={vertical ? `0 0 100 ${course.distance}` : `0 0 ${course.distance} 100`}
				preserveAspectRatio="none"
				className="block h-full w-full"
			>
				<polygon points={fill} fill="var(--color-course-elevation)" />
				<polyline
					points={line.join(" ")}
					fill="none"
					stroke="var(--color-course-elevation-line)"
					strokeWidth="2"
					vectorEffect="non-scaling-stroke"
				/>
			</svg>
		</Band>
	)
}

function SectionsBand({ distance, vertical, size }: { distance: number; vertical: boolean; size: string }) {
	const bounds = sectionBoundaries(distance)
	return (
		<Band vertical={vertical} size={size} label="sections">
			{bounds.slice(1).map((end, index) => (
				<div
					key={end}
					className={`absolute flex items-center justify-center border-gray-700/60 text-[9px] leading-none text-gray-400 ${vertical ? "inset-x-0 border-b" : "inset-y-0 border-r"}`}
					style={place(bounds[index], end, distance, vertical)}
				>
					{index + 1}
				</div>
			))}
		</Band>
	)
}

function MetreRuler({ distance, vertical, size }: { distance: number; vertical: boolean; size: string }) {
	const ticks = rulerTicks(distance)
	return (
		<div className={`relative ${vertical ? "h-full" : "w-full"}`} style={vertical ? { width: size } : { height: size }}>
			{ticks.map((tick, index) => (
				<span
					key={tick}
					className="absolute whitespace-nowrap text-[10px] leading-none text-gray-400"
					style={{
						...at(tick, distance, vertical),
						// The first and last labels hug the ends; the rest centre on their tick.
						transform: vertical
							? index === 0 ? undefined : index === ticks.length - 1 ? "translateY(-100%)" : "translateY(-50%)"
							: index === 0 ? undefined : index === ticks.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
						...(vertical ? { right: 4 } : { top: 3 }),
					}}
				>
					{tick.toLocaleString("en-US")}
				</span>
			))}
		</div>
	)
}

function Cursor({ cursor, distance, vertical }: { cursor: number | MotionValue<number>; distance: number; vertical: boolean }) {
	// A still metre rides the same motion value as a moving one, so the line
	// is placed one way whichever it is.
	const still = useMotionValue(typeof cursor === "number" ? cursor : 0)
	useEffect(() => {
		if (typeof cursor === "number") still.set(cursor)
	}, [cursor, still])
	const source = typeof cursor === "number" ? still : cursor
	const position = useTransform(source, (metre) => `${metreToFraction(metre, distance) * 100}%`)
	// A negative metre is "no walk running" (useWalk): the line hides.
	const opacity = useTransform(source, (metre) => (metre < 0 ? 0 : 1))
	return (
		<motion.div
			className={`pointer-events-none absolute z-20 bg-gray-100 ${vertical ? "inset-x-0 h-0.5" : "inset-y-0 w-0.5"}`}
			style={vertical ? { top: position, opacity } : { left: position, opacity }}
		/>
	)
}

/** The draw-in as a clip that opens from the gate towards the finish (useDrawIn). */
function useStripDrawIn(vertical: boolean) {
	const { ref, progress } = useDrawIn<HTMLDivElement>()
	const hidden = useTransform(progress, (value) => `${(1 - value) * 100}%`)
	const clipPath = useMotionTemplate`inset(0 ${vertical ? "0" : hidden} ${vertical ? hidden : "0"} 0)`
	return { ref, clipPath }
}

export default function CourseStrip({
	course,
	overlays,
	laneHeads = [],
	cursor,
	orientation = "horizontal",
	className = "",
}: CourseStripProps) {
	const vertical = orientation === "vertical"
	const distance = course.distance
	const { ref, clipPath } = useStripDrawIn(vertical)

	const facts = useMemo(() => courseFacts(course), [course])
	const spans = [...facts.spans, ...(overlays?.spans ?? [])]
	const markers = [...facts.markers, ...(overlays?.markers ?? [])]
	const labelled = markers.filter((marker) => marker.label)
	const lanes = markerLanes(labelled, distance)
	const laneCount = labelled.length > 0 ? Math.max(...lanes) + 1 : 0

	const track = trackParts(course)
	const hills = slopeParts(course)
	const ground = surfaceParts(course)
	const phases = spans.filter((span) => span.kind === "phase")
	const layerSpans = overlays?.spans.filter((span) => span.kind !== "phase") ?? []
	const dividers = markers.filter((marker) => marker.kind === "phase-divider")
	// Corners alternate between two shades, so corners 3 and 4 read as two.
	let cornerIndex = 0

	// Across: rows of these heights. Down: the race is distance / 4 px long
	// (300 to 900), so a 3600 m course scrolls with the page.
	// Down the page the word columns share the width (no size).
	const band = vertical ? undefined : "32px"
	const stripLength = `${Math.min(900, Math.max(300, distance / 4))}px`

	const bands = (
		<>
			<ElevationBand course={course} vertical={vertical} size={vertical ? "34px" : "40px"} />
			<Band vertical={vertical} size={band} label="hills">
				{hills.map((hill) => (
					<Segment
						key={hill.start}
						start={hill.start}
						end={hill.end}
						distance={distance}
						vertical={vertical}
						fill={hill.kind === "uphill" ? "var(--color-course-uphill)" : "var(--color-course-downhill)"}
						ink={LIGHT_INK}
						label={hill.label}
						// Too narrow for the words: the colour says up or down.
						shortLabel={`${hill.percent}%`}
						endLabel={formatMetres(hill.end)}
					/>
				))}
			</Band>
			{ground.length > 0 && (
				<Band vertical={vertical} size={vertical ? band : "22px"} label="ground">
					{ground.map((part) => (
						<Segment
							key={part.start}
							start={part.start}
							end={part.end}
							distance={distance}
							vertical={vertical}
							fill={part.surface === "turf" ? "var(--color-course-turf)" : "var(--color-course-dirt)"}
							ink={LIGHT_INK}
							label={part.surface === "turf" ? (part.start === 0 ? "Turf start" : "Turf") : "Dirt"}
						/>
					))}
				</Band>
			)}
			<Band vertical={vertical} size={band} label="track">
				{track.map((part) => {
					if (part.kind === "gap") return null
					const isCorner = part.kind === "corner"
					const shade = isCorner && cornerIndex++ % 2 === 1
					return (
						<Segment
							key={`${part.kind}-${part.start}`}
							start={part.start}
							end={part.end}
							distance={distance}
							vertical={vertical}
							fill={isCorner
								? shade ? "var(--color-course-corner-alt)" : "var(--color-course-corner)"
								: "var(--color-course-straight)"}
							ink={shade ? DARK_INK : LIGHT_INK}
							label={part.label}
							endLabel={part.end < distance ? formatMetres(part.end) : undefined}
						/>
					)
				})}
			</Band>
			<Band vertical={vertical} size={band} label="phases">
				{phases.map((phase, index) => (
					<Segment
						key={phase.start}
						start={phase.start}
						end={phase.end}
						distance={distance}
						vertical={vertical}
						fill={PHASE_FILLS[index % PHASE_FILLS.length]}
						ink={PHASE_INKS[index % PHASE_INKS.length]}
						label={phase.label}
						endLabel={phase.end < distance ? formatMetres(phase.end) : undefined}
					/>
				))}
				{/* The final sixth: a thin line inside Late-race, no words (owner, 2026-11-02). */}
				{dividers.map((divider) => (
					<div
						key={divider.at}
						className={`absolute bg-gray-100/60 ${vertical ? "inset-x-0 h-px" : "inset-y-0 w-px"}`}
						style={at(divider.at, distance, vertical)}
					/>
				))}
			</Band>
			{(layerSpans.length > 0 || laneHeads.length > 0) && (
				<LayersBand spans={layerSpans} laneHeads={laneHeads} distance={distance} vertical={vertical} />
			)}
			<SectionsBand distance={distance} vertical={vertical} size={vertical ? "18px" : "20px"} />
		</>
	)

	const markerLines = labelled.map((marker) => (
		<div
			key={`line-${marker.kind}-${marker.at}`}
			className={`pointer-events-none absolute border-dashed border-gray-100/70 ${vertical ? "inset-x-0 border-t" : "inset-y-0 border-l"}`}
			style={at(marker.at, distance, vertical)}
		/>
	))

	const markerLabels = laneCount > 0 && (
		<div
			className="relative"
			style={vertical ? { width: "80px" } : { height: `${laneCount * 16 + 2}px` }}
			data-band="markers"
		>
			{labelled.map((marker, index) => {
				const fraction = metreToFraction(marker.at, distance)
				const lane = lanes[index]
				// Down the page the labels are far enough apart to need no lanes.
				const style: CSSProperties = vertical
					? { top: `${fraction * 100}%`, left: 4, right: 0, transform: "translateY(-50%)" }
					: {
						left: `${fraction * 100}%`,
						top: lane * 16 + 2,
						// Near the finish the words hang to the left of the line.
						transform: fraction > 0.7 ? "translateX(-100%)" : undefined,
					}
				return (
					<span
						key={`label-${marker.kind}-${marker.at}`}
						className={`absolute text-[10px] font-semibold text-gray-200 ${
							vertical ? "leading-tight" : "whitespace-nowrap leading-none"
						} ${!vertical && fraction > 0.7 ? "pr-1" : "pl-1"}`}
						style={style}
					>
						{marker.label} <span className="font-normal text-gray-400">{formatMetres(marker.at)}</span>
					</span>
				)
			})}
		</div>
	)

	if (vertical) {
		return (
			<div className={`flex gap-1 ${className}`} style={{ height: stripLength }} aria-hidden="true">
				<MetreRuler distance={distance} vertical size="34px" />
				<motion.div ref={ref} className="relative flex min-w-0 flex-1 gap-px overflow-hidden rounded-md" style={{ clipPath }}>
					{bands}
					{markerLines}
					{cursor !== undefined && <Cursor cursor={cursor} distance={distance} vertical />}
				</motion.div>
				{markerLabels}
			</div>
		)
	}

	return (
		<div className={className} aria-hidden="true">
			<motion.div ref={ref} className="relative flex flex-col gap-px overflow-hidden rounded-md" style={{ clipPath }}>
				{bands}
				{markerLines}
				{cursor !== undefined && <Cursor cursor={cursor} distance={distance} vertical={false} />}
			</motion.div>
			{markerLabels}
			<MetreRuler distance={distance} vertical={false} size="16px" />
		</div>
	)
}
