/**
 * A skill's verdict on this event's course, in words, for any card that shows
 * a skill far from the map: a skill chip's or mention's hover card
 * (notes/course-map-plan-2.md, section 8: the answer travels with the click),
 * with its grade and its zone as one bar (CourseVerdictCard's pieces).
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
import { grade, verdictLines } from "../../utils/courseLayers"
import { GradePill, ZoneBar } from "./CourseVerdictCard"

function CachedVerdict({ course, skillId }: { course: RaceCourse; skillId: number }) {
	const zones = useCachedCourseZones(course.id).data
	const entry = zones?.[String(skillId)]
	const lines = zones ? verdictLines(entry, course.distance) : []
	if (lines.length === 0) return null
	const given = grade(entry)
	return (
		<div className="mt-1.5 border-t border-gray-700/70 pt-1.5 text-gray-200">
			<p className="mb-0.5 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
				On this course
				{given && <GradePill grade={given} className="normal-case tracking-normal" />}
			</p>
			{lines.map((line) => (
				<p key={line}>{line}</p>
			))}
			{entry && entry.kind === "place" && <ZoneBar entry={entry} distance={course.distance} className="mt-1.5" />}
		</div>
	)
}

export default function CourseVerdict({ skillId }: { skillId: number }) {
	const client = useContext(QueryClientContext)
	const course = usePageCourse()
	if (!client || !course) return null
	return <CachedVerdict course={course} skillId={skillId} />
}
