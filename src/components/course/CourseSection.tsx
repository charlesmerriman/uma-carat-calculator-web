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
import { useMemo, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import type { RaceCourse } from "../../types"
import { Loader2, Pause, Play } from "lucide-react"
import { useCourseShape } from "../../services/courseQueries"
import { setCourseShapeChoice, useCourseShapeChoice, type CourseShapeChoice } from "../../services/courseShapeStore"
import { schematicShape } from "../../utils/courseSchematic"
import CourseChips from "./CourseChips"
import CourseFactsList from "./CourseFactsList"
import CourseStrip from "./CourseStrip"
import CourseTrack from "./CourseTrack"
import { courseName } from "./courseName"
import { useWalk } from "./useWalk"

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

export default function CourseSection({ course }: { course: RaceCourse }) {
	const reduceMotion = useReducedMotion()
	const [view, setView] = useState<View>("strip")
	// Remembered per device, through a store: the page is prerendered.
	const shapeChoice = useCourseShapeChoice()
	const walk = useWalk(course.distance)
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

	return (
		<div className="border-t border-gray-700/70 p-3 sm:p-4">
			<div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
				{/* The header's other panel labels (PANEL_LABEL), less their margin. */}
				<h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Course map</h3>
				<span className="text-sm text-gray-300">{courseName(course)}</span>
				<div className="ml-auto hidden flex-wrap items-center gap-2 sm:flex">
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
							? <CourseStrip course={course} orientation="horizontal" cursor={walk.cursor} />
							: waiting
								? (
									<div className="mx-auto flex aspect-[2/1] w-full max-w-[900px] items-center justify-center">
										<Loader2 className="h-5 w-5 animate-spin text-gray-400" aria-label="Loading the course map" />
									</div>
								)
								: <CourseTrack course={course} shape={shape} cursor={walk.cursor} />}
					</motion.div>
				</AnimatePresence>
			</div>
			<CourseStrip course={course} orientation="vertical" className="sm:hidden" />
			<CourseChips course={course} className="mt-3" />
			<CourseFactsList course={course} />
		</div>
	)
}
