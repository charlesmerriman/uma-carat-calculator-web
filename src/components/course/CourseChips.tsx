import type { RaceCourse } from "../../types"
import { derivedFacts } from "../../utils/courseGeometry"

/** What a player reads off the course without counting (derivedFacts), as chips. */
export default function CourseChips({ course, className = "" }: { course: RaceCourse; className?: string }) {
	const chips = derivedFacts(course)
	if (chips.length === 0) return null
	return (
		<ul className={`flex flex-wrap gap-2 ${className}`} aria-label="Read off the course">
			{chips.map((chip) => (
				<li key={chip} className="rounded-full border border-gray-700 bg-gray-900/40 px-3 py-1 text-xs text-gray-200">
					{chip}
				</li>
			))}
		</ul>
	)
}
