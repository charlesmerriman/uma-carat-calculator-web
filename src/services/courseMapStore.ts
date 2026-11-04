/**
 * The course map's two bits of reader state that other parts of the PvP tab
 * set (notes/course-map-plan.md, "The layer menu"; owner, 2026-11-02: "these
 * features in the pvp tab integrate with each other"):
 *
 *   focus   the skill row open in the Guide skills panel (GuideSkillsPanel),
 *           whose zones the map lights. Lives for the page, never stored.
 *   layers  the Layers menu's ticks: "My veterans' skills" on or off, and
 *           "All that fire at a place" or "Only the guide's". Remembered on
 *           the device; every layer starts off (new layers are opt-in).
 *
 * External stores (useSyncExternalStore), like themeStore.ts: the panel and
 * the map are far apart in the tree, and /app is prerendered, so a render may
 * not read localStorage. The server snapshots are "nothing open" and "all off".
 */
import { useSyncExternalStore } from "react"

export interface CourseFocus {
	skillId: number
	name: string
}

export interface CourseLayers {
	veterans: boolean
	scope: "all" | "guide"
}

const LAYERS_KEY = "uma-course-map-layers"
const OFF: CourseLayers = { veterans: false, scope: "all" }

let focus: CourseFocus | null = null
let layers: CourseLayers | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
	listeners.add(listener)
	return () => listeners.delete(listener)
}

function notify() {
	listeners.forEach((listener) => listener())
}

function readLayers(): CourseLayers {
	try {
		const stored = JSON.parse(localStorage.getItem(LAYERS_KEY) ?? "null") as Partial<CourseLayers> | null
		return { veterans: stored?.veterans === true, scope: stored?.scope === "guide" ? "guide" : "all" }
	} catch {
		// Storage blocked or garbled: every layer off.
		return OFF
	}
}

export function useCourseFocus(): CourseFocus | null {
	return useSyncExternalStore(subscribe, () => focus, () => null)
}

/** The skill row the reader opened (null when they close it). */
export function setCourseFocus(next: CourseFocus | null) {
	if (focus?.skillId === next?.skillId) return
	focus = next
	notify()
}

export function useCourseLayers(): CourseLayers {
	return useSyncExternalStore(subscribe, () => (layers ??= readLayers()), () => OFF)
}

export function setCourseLayers(changes: Partial<CourseLayers>) {
	layers = { ...(layers ?? readLayers()), ...changes }
	try {
		localStorage.setItem(LAYERS_KEY, JSON.stringify(layers))
	} catch {
		// Storage blocked: the ticks last this page's life.
	}
	notify()
}
