/**
 * The course as a strip: the race from the gate to the finish, read in rows
 * (the height profile, the phases, the straights and corners, the hills, the
 * layers, the 24 sections, the metres), each row
 * named in a label column, the marks' words above. The look is the overhaul's
 * ruler (notes/course-map-visual-plan.md, "The ruler"); the words go on the
 * segments, never symbols (Henry, 2026-11-01), with Daptrius's triangles on
 * the hills.
 *
 * One component, two orientations (owner, 2026-10-29): across the page, or,
 * on a phone, DOWN it, the rows becoming columns and the words staying
 * horizontal, the marks' words in a margin at the right. The caller renders
 * one of each and lets CSS pick, because /app/pvp is prerendered and nothing
 * at render time may read the screen.
 *
 * Every position comes from utils/courseGeometry.ts, and nothing is measured:
 * bands are percentages of the race, and whether a segment's metres fit beside
 * its words is an estimate from the text. On top of the record it draws the
 * course's own facts (courseFacts) plus any `overlays` a later layer hands it,
 * each span in its own colour (a veteran's, or the lit skill's).
 *
 * Motion (owner, 2026-11-02): the first time it scrolls into view, the strip
 * sweeps in from the gate to the finish. The first paint is the finished strip
 * (the prerender's), the sweep runs after mount on a motion value (no React
 * re-render per frame), and reduced motion skips it.
 */
import { useMemo, type CSSProperties, type ReactNode } from "react"
import { AnimatePresence, motion, useMotionTemplate, useReducedMotion, useTransform } from "framer-motion"
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
	trackParts,
	type CourseMarker,
	type CourseOverlays,
	type CourseSpan,
} from "../../utils/courseGeometry"
import CourseIcon from "./CourseIcon"
import { useDrawIn } from "./useDrawIn"

type Orientation = "horizontal" | "vertical"

export interface LaneHead {
	key: string
	firstLane: number
	lanes: number
	/** The veteran's avatar (FramedUma). */
	head: ReactNode
	/** Her colour, on her rows (CourseSection assigns one per team spot). */
	colour?: string
}

interface CourseStripProps {
	course: RaceCourse
	/**
	 * Layers on top of the course's own facts: a skill's zones, the veterans'
	 * skills (utils/courseLayers.ts). Spans other than phases go in the layer
	 * rows, one row per `lane`; a span with a `key` pops in and out by it.
	 */
	overlays?: CourseOverlays
	/** What heads a group of layer rows: a veteran's avatar (CourseSection). */
	laneHeads?: LaneHead[]
	orientation?: Orientation
	className?: string
	/** Hears which layer span (by `key`) the pointer is over, null when it leaves: the track lights it. */
	onPreview?: (key: string | null) => void
	/** The span (by `key`) the pointer is over elsewhere (the track, the legend): drawn lit, the rest quieter. */
	preview?: string | null
	/**
	 * About how wide the race is across the page, in px (the label column not
	 * counted). Nothing on a prerendered page is measured, so the caller says:
	 * the words, the metres, the section numbers, the ruler and the marks' rows
	 * are all spaced against it. A desktop's is STRIP_PX; a phone's scroller
	 * sets its own (CourseSection).
	 */
	widthPx?: number
}

// The label column across the page, and the marks' margin down it.
const LABEL_PX = 60
const MARGIN_PX = 88
// Row heights across the page; down the page the columns share the width.
const ROW_PX = 24
const HEIGHT_PX = 40
const SECTIONS_PX = 16
const MARK_ROW_PX = 15
// About how wide the strip is on a desktop: the words and the metres are
// sized against it, since nothing on a prerendered page is measured.
const STRIP_PX = 1000
// What the strip's numbers and words need, in px, so any width spaces them alike:
// a section number, a ruler number, a mark's words before the next may share
// its row, and how far from the finish words start hanging left of their line.
const SECTION_NUMBER_PX = 18
const RULER_STEP_PX = 80
const MARK_WORDS_PX = 160
const HANG_LEFT_PX = 280
const LIT = "var(--color-course-lit)"
// A lit span's words: the theme's ink for the lit skill, dark for a veteran's bright colour.
const LIT_INK = "var(--color-course-lit-ink)"
const VET_INK = "#0b0b0f"

const PHASE_FILLS = ["var(--color-course-early)", "var(--color-course-mid)", "var(--color-course-late)", "var(--color-course-spurt)"]
const PHASE_INKS = ["var(--color-course-ink-early)", "var(--color-course-ink-mid)", "var(--color-course-ink-late)", "var(--color-course-ink-spurt)"]

/** "290–540m": a stretch's metres, as Daptrius's render writes them. */
function rangeText(start: number, end: number): string {
	return `${Math.round(start).toLocaleString("en-US")}–${formatMetres(end)}`
}

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

/**
 * One stretch of a band: its colour, its words, and its metres (start to end
 * when both fit beside the words, else the end metre, else nothing). Down
 * the page the words wrap and the end metre shows on a tall enough stretch.
 */
function Segment({ start, end, distance, vertical, fill, ink, label, shortLabel, icon, ranged = false, stripPx = STRIP_PX }: {
	start: number
	end: number
	distance: number
	vertical: boolean
	fill: string
	ink: string
	label: string
	shortLabel?: string
	icon?: ReactNode
	/** Show the start and end metres where they fit, not only the end. */
	ranged?: boolean
	/** The strip's width across the page, to judge what fits (a phone's is ~300px). */
	stripPx?: number
}) {
	const share = metreToFraction(end, distance) - metreToFraction(start, distance)
	let words: string | undefined
	let metres: string | undefined
	if (vertical) {
		words = share >= 0.035 ? label : undefined
		metres = share >= 0.08 && end < distance ? formatMetres(end) : undefined
	} else {
		words = share >= 0.06 ? label : share >= 0.025 ? shortLabel : undefined
		const px = share * stripPx
		const wordsPx = (words?.length ?? 0) * 7 + 8 + (icon ? 14 : 0)
		const fits = (text: string) => wordsPx + text.length * 5.2 + 22 < px
		const long = rangeText(start, end)
		const short = formatMetres(end)
		metres = ranged && fits(long) ? long : end < distance && fits(short) ? short : undefined
	}
	return (
		<div
			className={`absolute flex items-center justify-center gap-0.5 overflow-hidden ${vertical ? "inset-x-0" : "inset-y-0"}`}
			style={{ ...place(start, end, distance, vertical), background: fill, color: ink }}
		>
			{words && icon}
			{words && (
				<span
					className={`relative z-10 font-bold ${vertical ? "max-w-full overflow-hidden px-0.5 text-center text-[10px] leading-[1.1] break-words" : "truncate px-0.5 text-[11px] leading-none"}`}
				>
					{words}
				</span>
			)}
			{metres && (
				<span className={`absolute z-10 text-[9px] leading-none opacity-80 ${vertical ? "bottom-0.5 right-1" : "bottom-px right-1"}`}>
					{metres}
				</span>
			)}
		</div>
	)
}

/**
 * A row of the strip, or a column down the page: its name in the label cell,
 * its segments in the track cell (the `data-band`), which is what the
 * marker lines run through.
 */
function Row({ vertical, label, vlabel, band, size, grow = 1, children, className = "" }: {
	vertical: boolean
	label: ReactNode
	/** The column's name down the page, when the row's name won't fit a narrow column. */
	vlabel?: ReactNode
	band: string
	/** The row's height across the page, or the column's width down it (flexible without one). */
	size?: number
	/** A flexible column's share of the width (the Course column takes more, its words are longer). */
	grow?: number
	children: ReactNode
	className?: string
}) {
	if (vertical) {
		return (
			<div className={`flex min-w-0 flex-col ${size === undefined ? "" : "shrink-0"}`} style={size === undefined ? { flex: `${grow} 1 0%` } : { width: size }}>
				<div className="flex h-4 items-center justify-center overflow-hidden text-[9px] uppercase leading-none tracking-[0.06em] text-gray-500">{vlabel ?? label}</div>
				<div className={`relative flex-1 overflow-hidden rounded bg-gray-900/40 ${className}`} data-band={band}>{children}</div>
			</div>
		)
	}
	return (
		<div className="flex w-full shrink-0" style={{ height: size ?? ROW_PX }}>
			<div className="flex shrink-0 items-center justify-end pr-2 text-[10px] uppercase leading-none tracking-[0.06em] text-gray-500" style={{ width: LABEL_PX }}>{label}</div>
			<div className={`relative min-w-0 flex-1 overflow-hidden rounded-sm bg-gray-900/40 ${className}`} data-band={band}>{children}</div>
		</div>
	)
}

/** The height profile: the course's climbs and drops, relative to the start. */
function HeightRow({ course, vertical }: { course: RaceCourse; vertical: boolean }) {
	const profile = elevationProfile(course)
	const heights = profile.map((point) => point.height)
	const low = Math.min(...heights)
	const range = Math.max(...heights) - low
	// Height as 15 to 85 across the row's depth; a flat course sits mid-way.
	const depth = (height: number) => (range === 0 ? 50 : 15 + ((height - low) / range) * 70)
	const line = profile.map((point) => (vertical ? `${depth(point.height)},${point.at}` : `${point.at},${100 - depth(point.height)}`))
	const fill = vertical ? `0,0 ${line.join(" ")} 0,${course.distance}` : `${line.join(" ")} ${course.distance},100 0,100`
	return (
		<Row vertical={vertical} label="Height" vlabel="" band="elevation" size={vertical ? 30 : HEIGHT_PX}>
			<svg viewBox={vertical ? `0 0 100 ${course.distance}` : `0 0 ${course.distance} 100`} preserveAspectRatio="none" className="block h-full w-full">
				<polygon points={fill} fill="var(--color-course-height)" />
				<polyline points={line.join(" ")} fill="none" stroke="var(--color-course-height-line)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
			</svg>
		</Row>
	)
}

/** One layer span: solid where it fires, striped for a random point, a dot for a spot, dashed for a window. */
function LayerSpan({ span, distance, vertical, onPreview, previewed = null }: {
	span: CourseSpan & { key?: string }
	distance: number
	vertical: boolean
	onPreview?: (key: string | null) => void
	/** True when this span is the one under a pointer elsewhere, false when another is, null when none. */
	previewed?: boolean | null
}) {
	const reduceMotion = useReducedMotion()
	const colour = span.colour ?? LIT
	const point = span.kind === "point" || span.start === span.end
	const from = metreToFraction(span.start, distance) * 100
	const size = Math.max(point ? 0.6 : 0.4, metreToFraction(span.end, distance) * 100 - from)
	const box: CSSProperties = vertical
		? { top: `${from}%`, height: `${size}%`, left: 4, right: 4 }
		: { left: `${from}%`, width: `${size}%`, top: 3, bottom: 3 }
	const look: CSSProperties = span.kind === "random"
		? { background: `repeating-linear-gradient(135deg, ${colour} 0 5px, color-mix(in srgb, ${colour} 35%, transparent) 5px 10px)` }
		: span.kind === "window"
			? { border: "1px dashed var(--color-gray-300)" }
			: span.kind === "anywhere"
				? { border: `1px dashed ${colour}` }
				: span.kind === "passive"
					? { background: `color-mix(in srgb, ${colour} 18%, transparent)` }
					: { background: colour }
	return (
		<motion.div
			className={`absolute flex items-center overflow-visible ${point ? "rounded-full" : "rounded-[3px]"}`}
			style={{ ...box, ...look, ...(previewed ? { boxShadow: "0 0 0 2px var(--color-gray-100)", zIndex: 2 } : {}) }}
			data-previewed={previewed === null ? undefined : previewed}
			// The skill's verdict on hover; the card says it in full (CourseSection).
			title={span.detail || undefined}
			onMouseEnter={onPreview && span.key ? () => onPreview(span.key ?? null) : undefined}
			onMouseLeave={onPreview ? () => onPreview(null) : undefined}
			initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.85 }}
			animate={{ opacity: previewed === false ? 0.45 : 1, scale: 1, transition: { delay: reduceMotion ? 0 : (span.start / distance) * 0.35, duration: 0.2 } }}
			exit={{ opacity: 0, transition: { duration: 0.15 } }}
		>
			{span.label && !vertical && !point && (
				<span
					className="relative z-10 ml-1 whitespace-nowrap rounded-[3px] px-1 text-[10px] font-bold leading-tight"
					style={span.kind === "window"
						? { color: "var(--color-gray-300)", background: "var(--color-gray-900)" }
						// The lit skill follows the brand, so its ink and lift are theme
						// tokens (index.css); a veteran's colour is bright on every theme.
						: span.colour
							? { color: VET_INK, background: `color-mix(in srgb, ${colour} 85%, #fff)` }
							: { color: LIT_INK, background: `color-mix(in srgb, ${colour} 85%, var(--color-course-lit-lift))` }}
				>
					{span.image && <img src={span.image} alt="" className="mr-1 inline-block h-3 w-3 align-[-2px]" loading="lazy" decoding="async" />}
					{span.label}
				</span>
			)}
		</motion.div>
	)
}

/** The marks' lines through every row (the spurt solid in gold, the heal check dashed green, the rest dashed). */
function MarkLine({ marker, distance, vertical }: { marker: CourseMarker; distance: number; vertical: boolean }) {
	const spurt = marker.kind === "spurt-start"
	const heal = marker.kind === "heal-check"
	return (
		<div
			className={`pointer-events-none absolute ${vertical ? "inset-x-0 border-t" : "inset-y-0 border-l"} ${
				spurt ? "border-2 border-brand" : heal ? "border-dashed border-[color:var(--color-course-heal)]" : "border-dashed border-gray-100/55"
			} ${spurt ? (vertical ? "border-x-0 border-b-0" : "border-y-0 border-r-0") : ""}`}
			style={at(marker.at, distance, vertical)}
		/>
	)
}

function MarkWords({ marker, inline = false }: { marker: CourseMarker; inline?: boolean }) {
	const spurt = marker.kind === "spurt-start"
	const heal = marker.kind === "heal-check"
	return (
		// In the phone's margin (`inline`) the words may wrap onto a second line.
		<span className={`inline-flex items-center gap-x-1 ${inline ? "flex-wrap leading-tight" : "whitespace-nowrap leading-none px-1"} ${spurt ? "text-[11px] text-brand" : heal ? "text-[10px] text-[color:var(--color-course-heal)]" : "text-[10px] text-gray-400"}`}>
			{spurt && <CourseIcon name="flag" className="h-3 w-3" />}
			<span className={spurt ? "font-extrabold" : "font-semibold"}>{spurt ? "Spurt starts" : marker.label}</span>
			<span className="opacity-80">{formatMetres(marker.at)}</span>
		</span>
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
	orientation = "horizontal",
	className = "",
	onPreview,
	preview = null,
	widthPx = STRIP_PX,
}: CourseStripProps) {
	const vertical = orientation === "vertical"
	const distance = course.distance
	const { ref, clipPath } = useStripDrawIn(vertical)

	const facts = useMemo(() => courseFacts(course), [course])
	const spans = [...facts.spans, ...(overlays?.spans ?? [])]
	const markers = [...facts.markers, ...(overlays?.markers ?? [])]
	const labelled = markers.filter((marker) => marker.label)
	// The gap (a share of the race) two marks' words need to share a row. On a
	// phone the words are the same size but the race is a third as wide.
	// The share of the race past which a mark's words hang left of their line.
	const hangLeftFrom = Math.max(0.5, 1 - HANG_LEFT_PX / widthPx)
	const wordsShare = Math.min(0.5, MARK_WORDS_PX / widthPx)
	const hangs = labelled.map((marker) => metreToFraction(marker.at, distance) > hangLeftFrom)
	// Rows are shared by where the words START: a hanging mark's words begin a
	// words' width before its line, so it can't share a row with the mark its
	// words would run over (Spurt starts over Position keep ends, 2026-11-04).
	const lanes = markerLanes(
		labelled.map((marker, index) => (hangs[index] ? { ...marker, at: Math.max(0, marker.at - wordsShare * distance) } : marker)),
		distance,
		wordsShare,
	)
	// Every section numbered when 24 of them fit, else section 1 and every fourth.
	const everySection = widthPx / 24 >= SECTION_NUMBER_PX
	const laneCount = labelled.length > 0 ? Math.max(...lanes) + 1 : 0

	const track = trackParts(course)
	const hills = slopeParts(course)
	const phases = spans.filter((span) => span.kind === "phase")
	const layerSpans = (overlays?.spans.filter((span) => span.kind !== "phase") ?? []) as (CourseSpan & { key?: string })[]
	const layerRows = Math.max(0, ...layerSpans.map((span) => (span.lane ?? 0) + 1), ...laneHeads.map((head) => head.firstLane + head.lanes))
	// Corners alternate between two shades, so corners 3 and 4 read as two.
	let cornerIndex = 0
	// A layer row's name: the veteran's avatar on her first row, "Lit" on the
	// first row no veteran owns (the open skill's), nothing on the rest.
	let litNamed = false
	const layerLabel = (lane: number): ReactNode => {
		const head = laneHeads.find((candidate) => candidate.firstLane === lane)
		// Her ring takes her colour (App.css, "Uma frames": .course-ring).
		if (head) return <span className="course-ring inline-flex" style={{ "--course-ring": head.colour ?? LIT } as CSSProperties}>{head.head}</span>
		if (laneHeads.some((candidate) => lane > candidate.firstLane && lane < candidate.firstLane + candidate.lanes)) return ""
		if (litNamed) return ""
		litNamed = true
		return <span className="font-bold normal-case tracking-normal" style={{ color: LIT }}>Lit</span>
	}

	// Which group a layer row belongs to: the veteran whose rows cover it, else the lit skill's.
	const groupOf = (lane: number): string => laneHeads.find((head) => lane >= head.firstLane && lane < head.firstLane + head.lanes)?.key ?? "lit"
	const layerGroups: { key: string; label: ReactNode }[] = []
	for (let lane = 0; lane < layerRows; lane++) {
		const key = groupOf(lane)
		if (layerGroups.some((group) => group.key === key)) continue
		const head = laneHeads.find((candidate) => candidate.key === key)
		layerGroups.push({
			key,
			label: head
				? <span className="course-ring inline-flex [&_.uma-frame]:h-4 [&_.uma-frame]:w-4" style={{ "--course-ring": head.colour ?? LIT } as CSSProperties}>{head.head}</span>
				: <span className="font-bold normal-case tracking-normal" style={{ color: LIT }}>Lit</span>,
		})
	}

	// Down the page the race is distance / 2.4 px long (360 to 900), so a
	// 3600 m course scrolls with the page.
	const stripLength = `${Math.min(900, Math.max(360, distance / 2.4))}px`

	const rows = (
		<>
			{/* A flat course (Funabashi dirt 1600) has no profile and no hills to draw. */}
			{hills.length > 0 && <HeightRow course={course} vertical={vertical} />}
			<Row vertical={vertical} label="Phase" band="phases" grow={0.8}>
				{phases.map((phase, index) => (
					<Segment
						stripPx={widthPx}
						key={phase.start}
						start={phase.start}
						end={phase.end}
						distance={distance}
						vertical={vertical}
						fill={PHASE_FILLS[index % PHASE_FILLS.length]}
						ink={PHASE_INKS[index % PHASE_INKS.length]}
						label={phase.label ?? ""}
						shortLabel={(phase.label ?? "").split("-")[0]}
						ranged
					/>
				))}
			</Row>
			<Row vertical={vertical} label="Course" band="track" size={vertical ? undefined : ROW_PX} grow={1.6}>
				{track.map((part) => {
					if (part.kind === "gap") return null
					const isCorner = part.kind === "corner"
					const shade = isCorner && cornerIndex++ % 2 === 1
					return (
						<Segment
							stripPx={widthPx}
							key={`${part.kind}-${part.start}`}
							start={part.start}
							end={part.end}
							distance={distance}
							vertical={vertical}
							fill={isCorner
								? shade ? "var(--color-course-corner-alt)" : "var(--color-course-corner)"
								: part.label === "Final straight" ? "var(--color-course-straight-final)" : "var(--color-course-straight)"}
							ink="var(--color-course-ink-course)"
							label={part.label}
							shortLabel={isCorner ? `C${part.number && part.number > 0 ? part.number : ""}` : "Str."}
							ranged
						/>
					)
				})}
			</Row>
			{hills.length > 0 && (
				<Row vertical={vertical} label="Slope" band="hills">
					{hills.map((hill) => (
						<Segment
							stripPx={widthPx}
							key={hill.start}
							start={hill.start}
							end={hill.end}
							distance={distance}
							vertical={vertical}
							fill={hill.kind === "uphill" ? "var(--color-course-up)" : "var(--color-course-down)"}
							ink="var(--color-course-ink-hill)"
							// Down the page the column is narrow: the triangle and the percent say it.
							label={vertical ? `${hill.percent}%` : hill.label}
							// Too narrow for the words: the triangle and the percent.
							shortLabel={`${hill.percent}%`}
							icon={<CourseIcon name={hill.kind} className="relative z-10 h-[11px] w-[11px] shrink-0" />}
							ranged
						/>
					))}
				</Row>
			)}
			{/* No ground row where a course changes surface (Tokyo dirt 1600's
			    turf start): the race counts as its own surface from the gate,
			    and a "Turf" stretch made players doubt which aptitude it needs
			    (Daptrius, 2026-11-09). The facts list still names it. */}
			{layerRows > 0 && !vertical && (
				<div className="flex flex-col gap-0.5" data-band="layers">
					{Array.from({ length: layerRows }, (_, lane) => (
						<Row key={lane} vertical={false} label={layerLabel(lane)} band={`layer-${lane}`} size={ROW_PX} className="bg-gray-900/25">
							<AnimatePresence>
								{layerSpans.filter((span) => (span.lane ?? 0) === lane).map((span) => (
									<LayerSpan key={span.key ?? `${span.kind}-${span.start}-${lane}`} span={span} distance={distance} vertical={false} onPreview={onPreview} previewed={preview === null ? null : span.key === preview} />
								))}
							</AnimatePresence>
						</Row>
					))}
				</div>
			)}
			{/* Down the page there is no room for a column per row: one narrow
			    column per GROUP (the lit skill, each veteran), her spans sharing it. */}
			{layerRows > 0 && vertical && (
				<div className="contents" data-band="layers">
					{layerGroups.map((group) => (
						<Row key={group.key} vertical label={group.label} band={`layer-${group.key}`} size={16} className="bg-gray-900/25">
							<AnimatePresence>
								{layerSpans.filter((span) => groupOf(span.lane ?? 0) === group.key).map((span) => (
									<LayerSpan key={span.key ?? `${span.kind}-${span.start}-${span.lane ?? 0}`} span={span} distance={distance} vertical />
								))}
							</AnimatePresence>
						</Row>
					))}
				</div>
			)}
			<Row vertical={vertical} label="Section" vlabel="Sec" band="sections" size={vertical ? 18 : SECTIONS_PX} className="!bg-transparent">
				{sectionBoundaries(distance).slice(1).map((end, index, bounds) => (
					<div
						key={end}
						className={`absolute flex items-center justify-center border-gray-700/60 text-[9px] leading-none text-gray-500 ${vertical ? "inset-x-0 border-b" : "inset-y-0 border-r"}`}
						style={place(index === 0 ? 0 : bounds[index - 1], end, distance, vertical)}
					>
						{/* A narrow strip names section 1 and every fourth; 24 numbers don't fit. */}
						{everySection || index === 0 || (index + 1) % 4 === 0 ? index + 1 : null}
					</div>
				))}
			</Row>
		</>
	)

	const markLines = (
		<div className={`pointer-events-none absolute ${vertical ? "inset-x-0 inset-y-0" : "inset-y-0 right-0"}`} style={vertical ? undefined : { left: LABEL_PX }}>
			{labelled.map((marker) => (
				<MarkLine key={`line-${marker.kind}-${marker.at}`} marker={marker} distance={distance} vertical={vertical} />
			))}
		</div>
	)

	if (vertical) {
		return (
			<div className={`grid gap-x-2 ${className}`} style={{ height: stripLength, gridTemplateColumns: `minmax(0, 1fr) ${MARGIN_PX}px` }} aria-hidden="true">
				<motion.div ref={ref} className="relative flex h-full gap-0.5" style={{ clipPath }} data-strip-rows="">
					{rows}
					{markLines}
				</motion.div>
				{/* The marks' words in the margin, each on its line. */}
				<div className="relative mt-4" data-band="markers">
					{labelled.map((marker) => (
						<div
							key={`label-${marker.kind}-${marker.at}`}
							className="absolute left-0 right-0 flex -translate-y-1/2 items-center"
							style={{ top: `${metreToFraction(marker.at, distance) * 100}%` }}
						>
							<span className={`-ml-5 w-5 shrink-0 ${marker.kind === "spurt-start" ? "border-t-2 border-brand" : "border-t border-dashed border-gray-400"}`} />
							<MarkWords marker={marker} inline />
						</div>
					))}
				</div>
			</div>
		)
	}

	return (
		<div className={className} aria-hidden="true">
			{/* The marks' words above the rows, in lanes so none overlap. */}
			{laneCount > 0 && (
				<div className="relative" style={{ marginLeft: LABEL_PX, height: laneCount * MARK_ROW_PX + 4 }} data-band="markers">
					{labelled.map((marker, index) => {
						const fraction = metreToFraction(marker.at, distance)
						return (
							<span
								key={`label-${marker.kind}-${marker.at}`}
								className="absolute"
								style={{
									left: `${fraction * 100}%`,
									top: lanes[index] * MARK_ROW_PX,
									// Near the finish the words hang to the left of the line, or
									// they run off the edge.
									transform: hangs[index] ? "translateX(-100%)" : undefined,
								}}
							>
								<MarkWords marker={marker} />
							</span>
						)
					})}
				</div>
			)}
			<motion.div ref={ref} className="relative flex flex-col gap-0.5" style={{ clipPath }} data-strip-rows="">
				{rows}
				{markLines}
			</motion.div>
			{/* The metres right under the section numbers. */}
			<div className="relative h-4" style={{ marginLeft: LABEL_PX }}>
				{rulerTicks(distance, Math.floor(widthPx / RULER_STEP_PX)).map((tick, index, ticks) => (
					<span
						key={tick}
						className="absolute top-0.5 whitespace-nowrap text-[10px] leading-none text-gray-500"
						style={{
							...at(tick, distance, false),
							// The first and last labels hug the ends; the rest centre on their tick.
							transform: index === 0 ? undefined : index === ticks.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
						}}
					>
						{tick.toLocaleString("en-US")}
					</span>
				))}
			</div>
		</div>
	)
}
