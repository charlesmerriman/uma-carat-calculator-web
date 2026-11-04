/**
 * The "Course map" block in a CM or LoH guide's header (PvpGuidePage.tsx,
 * EventHeader): the course's name and its bar, the headline that reads the
 * course off (CourseHeadline), the map, and the same in words for screen
 * readers. Drawn only for an event with a course record
 * (notes/course-map-plan.md; the look is notes/course-map-visual-plan.md).
 *
 * The map is the strip by default; Track is the switch (owner, 2026-10-29),
 * and inside it Real shape | Schematic, real when the course has one (fetched
 * the first time Track is chosen, services/courseQueries.ts), the choice
 * remembered per device. A switch cross-fades. "Walk the course" runs a marker along whichever is showing.
 *
 * On a phone it is the compact track over the strip running down the page
 * (owner, 2026-10-29 and 2026-11-03). Two strips, one shown, CSS picking: the
 * page is prerendered and render-time code may not read the screen's width;
 * the phone's track waits for an effect to read it, since it costs a fetch.
 */
import { useContext, useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Loader2, Pause, Play } from "lucide-react"
import type { RaceCourse, RaceEvent } from "../../types"
import type { PvpGuide } from "../../types/pvpGuide"
import { AuthContext } from "../../services/AuthContext"
import { useCourseShape, useCourseZones } from "../../services/courseQueries"
import { setCourseShapeChoice, useCourseShapeChoice, type CourseShapeChoice } from "../../services/courseShapeStore"
import { COURSE_MAP_ID, setPageCourse, useCourseFocus, useCourseLayers, useVeteranPicks } from "../../services/courseMapStore"
import {
	focusLayer,
	skillShown,
	veteranLayer,
	veteranShown,
	veteranSkillChoices,
	type LayerSpan,
	type VeteranInLayer,
} from "../../utils/courseLayers"
import type { CourseMarker } from "../../utils/courseGeometry"
import { schematicShape } from "../../utils/courseSchematic"
import { heldSkillMeetsPick } from "../../utils/pvpGuide"
import CourseAccelList from "./CourseAccelList"
import CourseFactsList from "./CourseFactsList"
import CourseHeadline from "./CourseHeadline"
import CourseLegend from "./CourseLegend"
import CourseLayersMenu, { type VeteranMenuRow } from "./CourseLayersMenu"
import CourseStrip, { type LaneHead } from "./CourseStrip"
import CourseTrack from "./CourseTrack"
import { courseName } from "./courseName"
import { useWalk } from "./useWalk"
import VeteranLayerSource, { type VeteranLayerData } from "./VeteranLayerSource"

// "both": the track with the strip under it, as in Daptrius's render (owner, 2026-11-03).
type View = "strip" | "track" | "both"
type ShapeChoice = CourseShapeChoice
// One colour per team spot for the veterans' layer (notes/course-map-visual-plan.md).
const VETERAN_COLOURS = ["var(--color-course-vet-1)", "var(--color-course-vet-2)", "var(--color-course-vet-3)"]
// A phone's block, less its padding (below Tailwind's sm, 640px).
const PHONE_TRACK_PX = 358

function Segmented<T extends string>({ label, value, options, onChange }: {
	label: string
	value: T
	options: { value: T; label: string }[]
	onChange: (next: T) => void
}) {
	return (
		<div role="group" aria-label={label} className="flex gap-0.5 rounded-lg bg-gray-900/60 p-0.5">
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					aria-pressed={value === option.value}
					onClick={() => onChange(option.value)}
					className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
						value === option.value ? "bg-gray-700 text-gray-100" : "text-gray-400 hover:text-gray-200"
					}`}
				>
					{option.label}
				</button>
			))}
		</div>
	)
}

export default function CourseSection({ course, event = null, guide = null }: {
	course: RaceCourse
	/** The event, for the veterans' layer to find the reader's team for it. */
	event?: RaceEvent | null
	/** The guide once loaded, for "Only the guide's" skills. */
	guide?: PvpGuide | null
}) {
	const reduceMotion = useReducedMotion()
	const [view, setView] = useState<View>("strip")
	// Remembered per device, through a store: the page is prerendered.
	const shapeChoice = useCourseShapeChoice()
	const walk = useWalk(course.distance)
	// The page's course, for skill cards far from the map (CourseVerdict).
	useEffect(() => {
		setPageCourse(course)
		return () => setPageCourse(null)
	}, [course])
	const signedIn = useContext(AuthContext)?.isLoggedIn ?? false
	// A phone shows the compact track above its strip (owner, 2026-11-03). The
	// screen is read in an effect, never at render: the page is prerendered.
	const [narrow, setNarrow] = useState(false)
	useEffect(() => {
		if (typeof window.matchMedia !== "function") return
		const query = window.matchMedia("(max-width: 639px)")
		const update = () => setNarrow(query.matches)
		update()
		query.addEventListener("change", update)
		return () => query.removeEventListener("change", update)
	}, [])
	// The real shape, fetched the first time Track is chosen on a desktop (most
	// readers stay on the strip) and right away on a phone.
	const real = useCourseShape(view !== "strip" || narrow ? course.id : null)
	const realShape = real.data ?? null
	// Waiting for it holds the box, rather than flash the schematic first.
	const waiting = view !== "strip" && shapeChoice === "real" && real.isPending

	const schematic = useMemo(() => schematicShape(course), [course])
	const showing: ShapeChoice = shapeChoice === "real" && realShape ? "real" : "schematic"
	const shape = showing === "real" && realShape ? realShape : schematic
	// The phone's track: the real shape once it is in, the schematic for a
	// course with no path file, nothing while the fetch is out.
	const phoneShape = realShape ?? (real.data === null ? schematic : null)
	const fade = { duration: reduceMotion ? 0 : 0.2 }

	// The layers (notes/course-map-plan.md, "The layer menu"): the skill row
	// open in the Guide skills panel lights its zones, and "My veterans'
	// skills" draws the team's veterans. The zones map is fetched only once one
	// of them needs it.
	const focus = useCourseFocus()
	const layers = useCourseLayers()
	const veteransOn = signedIn && layers.veterans && event !== null
	const [veteranData, setVeteranData] = useState<VeteranLayerData | null>(null)
	const zones = useCourseZones(focus !== null || veteransOn ? course.id : null).data

	// The reader's veteran and skill ticks (owner, 2026-11-03: one per veteran,
	// one per skill of hers that can fire here), remembered on the device.
	const veteranPicks = useVeteranPicks()

	const layer = useMemo(() => {
		const spans: LayerSpan[] = []
		const markers: CourseMarker[] = []
		if (zones && focus) {
			// Its zones, plus the carry-over band or the heal mark it calls for.
			const lit = focusLayer(zones[String(focus.skillId)], course.distance, focus.name, focus.skillId)
			spans.push(...lit.spans)
			markers.push(...lit.markers)
		}
		const heads: LaneHead[] = []
		const menu: VeteranMenuRow[] = []
		if (zones && veteransOn && veteranData) {
			const picks = guide?.skill_recommendations ?? []
			// "Only the guide's": the guide's skills for her style plus its
			// general ones, a gold covering its white (heldSkillMeetsPick).
			const inScope = (skillId: number, veteran: VeteranInLayer) => layers.scope === "all" || picks.some((pick) =>
				(pick.style === "everyone" || pick.style === veteran.style || (pick.style === "front" && veteran.style === "runaway"))
				&& heldSkillMeetsPick(pick.skill, skillId))
			const keep = (skillId: number, veteran: VeteranInLayer) => inScope(skillId, veteran)
				&& veteranShown(veteranPicks, veteran)
				&& skillShown(veteranPicks, veteran, skillId, zones[String(skillId)])
			// Below whatever lanes the open skill used.
			const offset = spans.length > 0 ? Math.max(...spans.map((span) => span.lane ?? 0)) + 1 : 0
			const veterans = veteranLayer(veteranData.veterans, zones, course.distance, veteranData.names, keep, { chains: layers.chains })
			// Her colour follows her team spot, on her spans and at the head of her rows.
			const colourOf = (lane: number) => {
				const index = veterans.lanes.findIndex((group) => lane >= group.firstLane && lane < group.firstLane + group.lanes)
				return VETERAN_COLOURS[Math.max(0, index) % VETERAN_COLOURS.length]
			}
			spans.push(...veterans.spans.map((span) => {
				const group = veterans.lanes.find((candidate) => (span.lane ?? 0) >= candidate.firstLane && (span.lane ?? 0) < candidate.firstLane + candidate.lanes)
				return { ...span, lane: (span.lane ?? 0) + offset, colour: colourOf(span.lane ?? 0), group: group?.key }
			}))
			for (const [index, lane] of veterans.lanes.entries()) {
				heads.push({ key: lane.key, firstLane: lane.firstLane + offset, lanes: lane.lanes, head: veteranData.heads.get(lane.key), colour: VETERAN_COLOURS[index % VETERAN_COLOURS.length] })
			}
			// The Layers menu's rows: each veteran, and each of her skills that
			// can fire here, with its tick.
			for (const veteran of veteranData.veterans) {
				menu.push({
					veteranId: veteran.veteranId,
					name: veteranData.umaNames.get(veteran.key) ?? "Veteran",
					head: veteranData.heads.get(veteran.key),
					shown: veteranShown(veteranPicks, veteran),
					skills: veteranSkillChoices(veteran, zones, (skillId) => inScope(skillId, veteran)).map((skillId) => ({
						skillId,
						name: veteranData.names.get(skillId) ?? `Skill ${skillId}`,
						shown: skillShown(veteranPicks, veteran, skillId, zones[String(skillId)]),
					})),
				})
			}
		}
		return { overlays: { spans, markers }, heads, menu }
	}, [zones, focus, veteransOn, veteranData, veteranPicks, guide, layers.scope, layers.chains, course.distance])
	const hasLayer = layer.overlays.spans.length > 0

	return (
		// The id is what "See it on the map" scrolls to (GuideSkillsPanel); one
		// course block per page.
		<div id={COURSE_MAP_ID} className="border-t border-gray-700/70 p-3 sm:p-4">
			<div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
				{/* The header's other panel labels (PANEL_LABEL), less their margin. */}
				<h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Course map</h3>
				<span className="text-sm text-gray-300">{courseName(course)}</span>
				<div className="ml-auto hidden flex-wrap items-center gap-2 sm:flex">
					<CourseLayersMenu signedIn={signedIn} veteransNote={veteranData?.note ?? null} veterans={layer.menu} />
					<button
						type="button"
						onClick={walk.walking ? walk.stop : walk.play}
						className="flex items-center gap-1.5 rounded-lg border border-gray-600 px-2.5 py-1 text-xs font-semibold text-gray-200 transition hover:bg-gray-700/60"
					>
						{walk.walking ? <Pause className="h-3.5 w-3.5" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
						{walk.walking ? "Stop" : "Walk the course"}
					</button>
					<Segmented<View>
						label="Map view"
						value={view}
						onChange={setView}
						options={[{ value: "strip", label: "Strip" }, { value: "track", label: "Track" }, { value: "both", label: "Both" }]}
					/>
					{view !== "strip" && realShape && (
						<Segmented<ShapeChoice>
							label="Track shape"
							value={showing}
							onChange={setCourseShapeChoice}
							options={[{ value: "real", label: "Real shape" }, { value: "schematic", label: "Schematic" }]}
						/>
					)}
				</div>
			</div>
			{/* The map's first job, in words, before the drawing (owner, 2026-11-03). */}
			<CourseHeadline course={course} className="mb-3" />
			<div className="hidden sm:block">
				<AnimatePresence mode="wait" initial={false}>
					<motion.div
						key={view === "strip" ? "strip" : waiting ? `${view}-waiting` : `${view}-${showing}`}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={fade}
					>
						{view !== "strip" && (waiting
							? (
								<div className="mx-auto flex aspect-[2/1] w-full max-w-[900px] items-center justify-center">
									<Loader2 className="h-5 w-5 animate-spin text-gray-400" aria-label="Loading the course map" />
								</div>
							)
							: <CourseTrack course={course} shape={shape} cursor={walk.cursor} overlays={layer.overlays} />)}
						{view !== "track" && (
							<CourseStrip
								course={course}
								orientation="horizontal"
								className={view === "both" ? "mt-4" : ""}
								cursor={walk.cursor}
								overlays={layer.overlays}
								laneHeads={layer.heads}
							/>
						)}
					</motion.div>
				</AnimatePresence>
				{/* The track alone needs a legend; under Strip and Both the strip names every colour (owner, 2026-11-03). */}
				{view === "track" && <CourseLegend />}
				{hasLayer && (
					// What a layer's marks mean.
					<ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400" aria-label="Layer legend">
						<li className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-5 rounded-sm" style={{ background: "var(--color-course-lit)" }} />Fires here</li>
						<li className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-5 rounded-sm" style={{ background: "repeating-linear-gradient(135deg, var(--color-course-lit) 0 4px, color-mix(in srgb, var(--color-course-lit) 35%, transparent) 4px 8px)" }} />At a random point here</li>
						<li className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-5 rounded-sm border border-dashed" style={{ borderColor: "var(--color-course-lit)" }} />Anywhere in the race</li>
					</ul>
				)}
			</div>
			{/* A phone: the compact track, then the strip down the page. */}
			<div className="sm:hidden">
				{narrow && phoneShape && (
					<CourseTrack course={course} shape={phoneShape} widthPx={PHONE_TRACK_PX} compact overlays={layer.overlays} className="mb-3" />
				)}
				<CourseStrip course={course} orientation="vertical" overlays={layer.overlays} laneHeads={layer.heads} />
			</div>
			<CourseAccelList course={course} />
			<CourseFactsList course={course} />
			{veteransOn && event && <VeteranLayerSource event={event} onData={setVeteranData} />}
		</div>
	)
}
