/**
 * The course map's track view, as this device prefers it: the real shape or
 * the schematic (components/course/CourseSection.tsx; notes/course-map-plan.md,
 * "The toggle"), and the surface coloured by race phase or by corners and
 * straights (Daptrius, 2026-11-06). Per-device conveniences.
 *
 * External stores (useSyncExternalStore) like themeStore.ts, because /app is
 * prerendered and a render that reads localStorage throws in Node. The server
 * snapshot is the default ("real", "phase"), so the build-time HTML and the
 * first hydrating render agree; a remembered choice takes over right after.
 */
import { useSyncExternalStore } from "react"

export type CourseShapeChoice = "real" | "schematic"
export type TrackColours = "phase" | "course"

/** One remembered choice: `fallback` unless storage holds `other`. */
function choiceStore<T extends string>(key: string, fallback: T, other: T) {
	const listeners = new Set<() => void>()
	let snapshot: T | null = null

	const read = (): T => {
		try {
			return localStorage.getItem(key) === other ? other : fallback
		} catch {
			// Storage blocked: the default, and a choice lasts this page's life.
			return fallback
		}
	}
	const subscribe = (listener: () => void) => {
		listeners.add(listener)
		return () => listeners.delete(listener)
	}

	const use = (): T => useSyncExternalStore(subscribe, () => (snapshot ??= read()), () => fallback)
	const set = (choice: T) => {
		snapshot = choice
		try {
			localStorage.setItem(key, choice)
		} catch {
			// Storage blocked: the choice lasts this page's life.
		}
		listeners.forEach((listener) => listener())
	}
	return { use, set }
}

const shape = choiceStore<CourseShapeChoice>("uma-course-map-shape", "real", "schematic")
const colours = choiceStore<TrackColours>("uma-course-map-colours", "phase", "course")

export const useCourseShapeChoice = shape.use
export const setCourseShapeChoice = shape.set
export const useTrackColours = colours.use
export const setTrackColours = colours.set
