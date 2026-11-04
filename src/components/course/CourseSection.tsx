/**
 * The "Course map" block in a CM or LoH guide's header (PvpGuidePage.tsx,
 * EventHeader): the course's name, the strip, the chips that read it off, and
 * the same in words for screen readers. Drawn only for an event with a course
 * record (notes/course-map-plan.md, PR 2). The Strip | Track switch joins its
 * bar with the track view, and the Layers menu after it.
 *
 * Two strips, one shown: across from `sm` up, down the page below it (owner,
 * 2026-10-29). CSS picks, because the page is prerendered and render-time code
 * may not read the screen's width.
 */
import type { RaceCourse } from "../../types"
import { derivedFacts } from "../../utils/courseGeometry"
import CourseFactsList from "./CourseFactsList"
import CourseStrip from "./CourseStrip"
import { courseName } from "./courseName"

export default function CourseSection({ course }: { course: RaceCourse }) {
	const chips = derivedFacts(course)
	return (
		<div className="border-t border-gray-700/70 p-3 sm:p-4">
			<div className="mb-2 flex flex-wrap items-baseline gap-x-3">
				{/* The header's other panel labels (PANEL_LABEL), less their margin. */}
				<h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Course map</h3>
				<span className="text-sm text-gray-300">{courseName(course)}</span>
			</div>
			<CourseStrip course={course} orientation="horizontal" className="hidden sm:block" />
			<CourseStrip course={course} orientation="vertical" className="sm:hidden" />
			{chips.length > 0 && (
				<ul className="mt-3 flex flex-wrap gap-2" aria-label="Read off the course">
					{chips.map((chip) => (
						<li key={chip} className="rounded-full border border-gray-700 bg-gray-900/40 px-3 py-1 text-xs text-gray-200">
							{chip}
						</li>
					))}
				</ul>
			)}
			<CourseFactsList course={course} />
		</div>
	)
}
