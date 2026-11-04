/**
 * A skill's verdict on this event's course, in words, for any card that shows
 * a skill far from the map: a skill chip's or mention's hover card
 * (notes/course-map-plan-2.md, section 8: the answer travels with the click).
 *
 * Reads only what is already cached (useCachedCourseZones): lighting the chip
 * sets the course focus, the course block fetches the map, and this fills in.
 * Nothing on a page without the guide's course block, or without a query
 * client (a card drawn outside the app's providers, as some tests do).
 */
import { useContext } from "react"
import { QueryClientContext } from "@tanstack/react-query"
import type { RaceCourse } from "../../types"
import { useCachedCourseZones } from "../../services/courseQueries"
import { usePageCourse } from "../../services/courseMapStore"
import { verdictLines } from "../../utils/courseLayers"

function CachedVerdict({ course, skillId }: { course: RaceCourse; skillId: number }) {
	const zones = useCachedCourseZones(course.id).data
	const lines = zones ? verdictLines(zones[String(skillId)], course.distance) : []
	if (lines.length === 0) return null
	return (
		<div className="mt-1.5 border-t border-gray-700/70 pt-1.5 text-gray-200">
			<p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">On this course</p>
			{lines.map((line) => (
				<p key={line}>{line}</p>
			))}
		</div>
	)
}

export default function CourseVerdict({ skillId }: { skillId: number }) {
	const client = useContext(QueryClientContext)
	const course = usePageCourse()
	if (!client || !course) return null
	return <CachedVerdict course={course} skillId={skillId} />
}
