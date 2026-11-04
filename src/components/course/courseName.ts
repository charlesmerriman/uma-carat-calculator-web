import type { RaceCourse } from "../../types"
import { formatMetres } from "../../utils/courseGeometry"

const VARIANTS: Record<RaceCourse["variant"], string> = {
	"": "",
	inner: " (inner course)",
	outer: " (outer course)",
	outer_inner: " (outer, then inner)",
}

const DIRECTIONS: Record<RaceCourse["direction"], string> = {
	left: "left-handed",
	right: "right-handed",
	straight: "straight",
}

/** "Chukyo turf 1,200m, left-handed": the course record's own name for itself. */
export function courseName(course: RaceCourse): string {
	return `${course.racecourse} ${course.surface} ${formatMetres(course.distance)}${VARIANTS[course.variant]}, ${DIRECTIONS[course.direction]}`
}
