/**
 * The course map's server state through TanStack Query, both kept for the
 * tab's life once fetched:
 *
 * - a course's real shape (GET /race-courses/<id>/shape, about 10 KB), fetched
 *   only when a map is drawn (the guide's Track view, the Timeline card's
 *   drawer); it changes only when an editor swaps the course's path.
 * - its skill zones (GET /race-courses/<id>/skill-zones, the API's
 *   skill_zones.py), fetched the first time a layer needs them (a skill row
 *   opened, "My veterans' skills" ticked); they change only with a deploy or
 *   an editor's edit.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { Shape } from "../utils/courseGeometry"
import type { SkillZoneMap } from "../utils/courseLayers"

const API_URL = import.meta.env.VITE_API_URL

async function fetchCourseJson<T>(courseId: number, what: "shape" | "skill-zones"): Promise<T> {
	const response = await fetch(`${API_URL}/race-courses/${courseId}/${what}`, {
		headers: { "Content-Type": "application/json" },
	})
	if (!response.ok) throw new Error(`course ${what}: ${response.status}`)
	return response.json() as Promise<T>
}

const shapeQuery = (courseId: number) => ({
	queryKey: ["course-shape", courseId] as const,
	queryFn: async () => (await fetchCourseJson<{ shape: [number, number][] | null }>(courseId, "shape")).shape as Shape | null,
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

const zonesQuery = (courseId: number) => ({
	queryKey: ["course-zones", courseId] as const,
	queryFn: () => fetchCourseJson<SkillZoneMap>(courseId, "skill-zones"),
	staleTime: Infinity,
	gcTime: Infinity,
})

/** The zones for one course, or nothing while `courseId` is null (no layer needs them). */
export function useCourseZones(courseId: number | null) {
	return useQuery({ ...zonesQuery(courseId ?? 0), enabled: courseId !== null })
}

/**
 * The zones if something already fetched them, never fetching itself: a skill
 * chip's card reads the map the course block loads when the chip lights it,
 * so a page of chips costs no request.
 */
export function useCachedCourseZones(courseId: number) {
	return useQuery({ ...zonesQuery(courseId), enabled: false })
}
