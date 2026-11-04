/**
 * The "Course map" block in a CM or LoH guide's header (PvpGuidePage.tsx,
 * EventHeader): the course's name and its bar, the map, the chips that read it
 * off, and the same in words for screen readers. Drawn only for an event with
 * a course record (notes/course-map-plan.md).
 *
 * The map is the strip by default; Track is the switch (owner, 2026-10-29),
 * and inside it Real shape | Schematic, real when the course has one (fetched
 * the first time Track is chosen, services/courseQueries.ts), the choice
 * remembered per device. A switch cross-fades. "Walk the course" runs a marker along whichever is showing.
 *
 * On a phone it is always the strip, running down the page (owner,
 * 2026-10-29: an oval folds the same words into less room). Two strips, one
 * shown, CSS picking: the page is prerendered and render-time code may not
 * read the screen's width.
 */
import { useContext, useMemo, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Loader2, Pause, Play } from "lucide-react"
import type { RaceCourse, RaceEvent } from "../../types"
import type { PvpGuide } from "../../types/pvpGuide"
import { AuthContext } from "../../services/AuthContext"
import { useCourseShape, useCourseZones } from "../../services/courseQueries"
import { setCourseShapeChoice, useCourseShapeChoice, type CourseShapeChoice } from "../../services/courseShapeStore"
import { useCourseFocus, useCourseLayers } from "../../services/courseMapStore"
import { skillSpans, veteranLayer, type LayerSpan, type VeteranInLayer } from "../../utils/courseLayers"
import { schematicShape } from "../../utils/courseSchematic"
import { heldSkillMeetsPick } from "../../utils/pvpGuide"
import CourseChips from "./CourseChips"
import CourseFactsList from "./CourseFactsList"
import CourseLayersMenu from "./CourseLayersMenu"
import CourseStrip from "./CourseStrip"
import CourseTrack from "./CourseTrack"
import { courseName } from "./courseName"
import { useWalk } from "./useWalk"
import VeteranLayerSource, { type VeteranLayerData } from "./VeteranLayerSource"

type View = "strip" | "track"
type ShapeChoice = CourseShapeChoice

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
	const signedIn = useContext(AuthContext)?.isLoggedIn ?? false
	// The real shape, fetched the first time Track is chosen (most readers stay
	// on the strip, and a phone never shows the track).
	const real = useCourseShape(view === "track" ? course.id : null)
	const realShape = real.data ?? null
	// Waiting for it holds the box, rather than flash the schematic first.
	const waiting = view === "track" && shapeChoice === "real" && real.isPending

	const schematic = useMemo(() => schematicShape(course), [course])
	const showing: ShapeChoice = shapeChoice === "real" && realShape ? "real" : "schematic"
	const shape = showing === "real" && realShape ? realShape : schematic
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

	const layer = useMemo(() => {
		const spans: LayerSpan[] = []
		if (zones && focus) spans.push(...skillSpans(zones[String(focus.skillId)], course.distance, focus.name, 0, `focus-${focus.skillId}`))
		const heads: NonNullable<Parameters<typeof CourseStrip>[0]["laneHeads"]> = []
		if (zones && veteransOn && veteranData) {
			const picks = guide?.skill_recommendations ?? []
			// "Only the guide's": the guide's skills for her style plus its
			// general ones, a gold covering its white (heldSkillMeetsPick).
			const keep = (skillId: number, veteran: VeteranInLayer) => layers.scope === "all" || picks.some((pick) =>
				(pick.style === "everyone" || pick.style === veteran.style || (pick.style === "front" && veteran.style === "runaway"))
				&& heldSkillMeetsPick(pick.skill, skillId))
			const offset = spans.length > 0 ? 1 : 0
			const veterans = veteranLayer(veteranData.veterans, zones, course.distance, veteranData.names, keep)
			spans.push(...veterans.spans.map((span) => ({ ...span, lane: (span.lane ?? 0) + offset })))
			for (const lane of veterans.lanes) {
				heads.push({ key: lane.key, firstLane: lane.firstLane + offset, lanes: lane.lanes, head: veteranData.heads.get(lane.key) })
			}
		}
		return { overlays: { spans, markers: [] }, heads }
	}, [zones, focus, veteransOn, veteranData, guide, layers.scope, course.distance])
	const hasLayer = layer.overlays.spans.length > 0

	return (
		<div className="border-t border-gray-700/70 p-3 sm:p-4">
			<div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
				{/* The header's other panel labels (PANEL_LABEL), less their margin. */}
				<h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Course map</h3>
				<span className="text-sm text-gray-300">{courseName(course)}</span>
				<div className="ml-auto hidden flex-wrap items-center gap-2 sm:flex">
					<CourseLayersMenu signedIn={signedIn} veteransNote={veteranData?.note ?? null} />
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
						options={[{ value: "strip", label: "Strip" }, { value: "track", label: "Track" }]}
					/>
					{view === "track" && realShape && (
						<Segmented<ShapeChoice>
							label="Track shape"
							value={showing}
							onChange={setCourseShapeChoice}
							options={[{ value: "real", label: "Real shape" }, { value: "schematic", label: "Schematic" }]}
						/>
					)}
				</div>
			</div>
			<div className="hidden sm:block">
				<AnimatePresence mode="wait" initial={false}>
					<motion.div
						key={view === "strip" ? "strip" : waiting ? "track-waiting" : `track-${showing}`}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={fade}
					>
						{view === "strip"
							? <CourseStrip course={course} orientation="horizontal" cursor={walk.cursor} overlays={layer.overlays} laneHeads={layer.heads} />
							: waiting
								? (
									<div className="mx-auto flex aspect-[2/1] w-full max-w-[900px] items-center justify-center">
										<Loader2 className="h-5 w-5 animate-spin text-gray-400" aria-label="Loading the course map" />
									</div>
								)
								: <CourseTrack course={course} shape={shape} cursor={walk.cursor} overlays={layer.overlays} />}
					</motion.div>
				</AnimatePresence>
				{hasLayer && (
					// The legend from the mock: what a layer's marks mean.
					<ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-400" aria-label="Layer legend">
						<li className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-5 rounded-sm" style={{ background: "color-mix(in srgb, var(--color-brand) 75%, transparent)" }} />Fires here</li>
						<li className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-5 rounded-sm" style={{ background: "repeating-linear-gradient(135deg, color-mix(in srgb, var(--color-brand) 70%, transparent) 0 4px, color-mix(in srgb, var(--color-brand) 30%, transparent) 4px 8px)" }} />At a random point here</li>
						<li className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-5 rounded-sm border border-dashed border-brand" />Anywhere in the race</li>
					</ul>
				)}
			</div>
			<CourseStrip course={course} orientation="vertical" className="sm:hidden" overlays={layer.overlays} />
			<CourseChips course={course} className="mt-3" />
			<CourseFactsList course={course} />
			{veteransOn && event && <VeteranLayerSource event={event} onData={setVeteranData} />}
		</div>
	)
}
