/**
 * The course block's headline (notes/course-map-visual-plan.md): the map's
 * first job said in words before the eye reaches the drawing. The spurt
 * sentence from derivedFacts leads, in bold with the flag; the other facts
 * follow in one quieter line. Replaces the row of chips in the block and the
 * Timeline drawer (owner, 2026-11-03).
 */
import type { RaceCourse } from "../../types"
import { derivedFacts } from "../../utils/courseGeometry"
import CourseIcon from "./CourseIcon"

export default function CourseHeadline({ course, className = "" }: { course: RaceCourse; className?: string }) {
	const facts = derivedFacts(course)
	if (facts.length === 0) return null
	const lead = facts.find((fact) => fact.startsWith("Last spurt can start")) ?? facts[0]
	const rest = facts.filter((fact) => fact !== lead)
	return (
		<div className={`min-w-0 ${className}`} aria-label="Read off the course">
			<p className="flex items-center gap-2 text-[17px] font-bold leading-tight tracking-tight text-gray-100">
				<CourseIcon name="flag" className="h-[18px] w-[18px] shrink-0 text-brand" />
				<span>{lead}</span>
			</p>
			{rest.length > 0 && (
				<p className="mt-1 pl-[26px] text-[12.5px] leading-snug text-gray-300">
					{rest.join("  ·  ")}
				</p>
			)}
		</div>
	)
}
