/**
 * The course map's server state through TanStack Query: a course's real shape
 * (GET /race-courses/<id>/shape, about 10 KB). Fetched only when a map is
 * drawn (the guide's Track view, the Timeline card's drawer) and kept for the
 * tab's life: a shape changes only when an editor swaps the course's path.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { Shape } from "../utils/courseGeometry"

const API_URL = import.meta.env.VITE_API_URL

export const courseShapeKey = (courseId: number) => ["course-shape", courseId] as const

async function fetchCourseShape(courseId: number): Promise<Shape | null> {
	const response = await fetch(`${API_URL}/race-courses/${courseId}/shape`, {
		headers: { "Content-Type": "application/json" },
	})
	if (!response.ok) throw new Error(`course shape: ${response.status}`)
	const body = (await response.json()) as { shape: [number, number][] | null }
	return body.shape
}

const shapeQuery = (courseId: number) => ({
	queryKey: courseShapeKey(courseId),
	queryFn: () => fetchCourseShape(courseId),
	staleTime: Infinity,
	gcTime: Infinity,
})

/** The course's real shape (null when it has no path file), or nothing while `courseId` is null. */
export function useCourseShape(courseId: number | null) {
	return useQuery({ ...shapeQuery(courseId ?? 0), enabled: courseId !== null })
}

/** Start the fetch before the map is asked for (a pointer over the drawer's button). */
export function usePrefetchCourseShape(): (courseId: number) => void {
	const client = useQueryClient()
	return (courseId) => void client.prefetchQuery(shapeQuery(courseId))
}
