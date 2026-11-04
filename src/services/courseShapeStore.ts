/**
 * The course map's track view: whether this device prefers the real shape or
 * the schematic (components/course/CourseSection.tsx; notes/course-map-plan.md,
 * "The toggle"). A per-device convenience.
 *
 * An external store (useSyncExternalStore) like themeStore.ts, because /app is
 * prerendered and a render that reads localStorage throws in Node. The server
 * snapshot is "real", so the build-time HTML and the first hydrating render
 * agree; a remembered "schematic" takes over right after.
 */
import { useSyncExternalStore } from "react"

export type CourseShapeChoice = "real" | "schematic"

const KEY = "uma-course-map-shape"
const listeners = new Set<() => void>()
let snapshot: CourseShapeChoice | null = null

function read(): CourseShapeChoice {
	try {
		return localStorage.getItem(KEY) === "schematic" ? "schematic" : "real"
	} catch {
		// Storage blocked: the default, and a choice lasts this page's life.
		return "real"
	}
}

function subscribe(listener: () => void) {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

export function useCourseShapeChoice(): CourseShapeChoice {
	return useSyncExternalStore(
		subscribe,
		() => (snapshot ??= read()),
		() => "real",
	)
}

export function setCourseShapeChoice(choice: CourseShapeChoice) {
	snapshot = choice
	try {
		localStorage.setItem(KEY, choice)
	} catch {
		// Storage blocked: the choice lasts this page's life.
	}
	listeners.forEach((listener) => listener())
}
