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
import type { RaceCourse } from "../types"
import type { MemberStyle } from "../types/pvpTeam"

export interface CourseFocus {
	skillId: number
	name: string
	/** The skill's picture, for the verdict card (whoever lights it has it). */
	image?: string | null
	/** Whose unique it is, or whose unique it is inherited from (the accels column knows). */
	owner?: { name: string; portrait: string | null; inherited: boolean }
}

export interface CourseLayers {
	veterans: boolean
	scope: "all" | "guide"
	/** Skills set off by other skills placed by what sets them off (notes/course-map-plan-2.md, section 6). */
	chains: boolean
}

const LAYERS_KEY = "uma-course-map-layers"
const OFF: CourseLayers = { veterans: false, scope: "all", chains: false }

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
		return { veterans: stored?.veterans === true, scope: stored?.scope === "guide" ? "guide" : "all", chains: stored?.chains === true }
	} catch {
		// Storage blocked or garbled: every layer off.
		return OFF
	}
}

export type StyleChoice = MemberStyle | "all"
const TAB_STYLES = new Set(["front", "pace", "late", "end"])

/** The guide tab the reader is on, as a style ("all" for anything else). */
function styleFromTab(tab: string | null): StyleChoice {
	return tab && TAB_STYLES.has(tab) ? (tab as StyleChoice) : "all"
}

function onNavigation(listener: () => void) {
	window.addEventListener("popstate", listener)
	return () => window.removeEventListener("popstate", listener)
}

/**
 * The `style` in the address (the guide tab): a client snapshot with "all"
 * on the server, since the block is prerendered and can sit outside a router.
 * The accels column's first pill, and the set a chained guide pick is placed
 * against (CourseSection).
 */
export function useStyleTab(): StyleChoice {
	return useSyncExternalStore(onNavigation, () => styleFromTab(new URLSearchParams(window.location.search).get("style")), () => "all")
}

export function useCourseFocus(): CourseFocus | null {
	return useSyncExternalStore(subscribe, () => focus, () => null)
}

/** The skill the reader lit: an open row, or a chip's card (null when they close it). */
export function setCourseFocus(next: CourseFocus | null) {
	if (focus?.skillId === next?.skillId) return
	focus = next
	notify()
}

/** Unlight a skill, but only if it is still the one lit (a chip's card closing). */
export function clearCourseFocus(skillId: number) {
	if (focus?.skillId === skillId) setCourseFocus(null)
}

// The guide's course while its block is on the page (CourseSection sets it),
// so a skill chip far from the map can word its verdict (CourseVerdict).
let pageCourse: RaceCourse | null = null

export function usePageCourse(): RaceCourse | null {
	return useSyncExternalStore(subscribe, () => pageCourse, () => null)
}

export function setPageCourse(course: RaceCourse | null) {
	if (pageCourse === course) return
	pageCourse = course
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

/**
 * Which veterans, and which of their skills, the veterans' layer draws (owner,
 * 2026-11-03: "a checkbox for each veteran, with a checkbox for each veteran's
 * skills that are capable of proccing"). Only the reader's own choices are
 * kept, by the veteran's id (her trained uma), so they follow her across events;
 * anything not chosen takes its default (courseLayers.veteranShown /
 * skillShown). Remembered on the device, like the layer ticks.
 */
export interface VeteranPicks {
	/** Veteran id -> shown. */
	veterans: Record<string, boolean>
	/** "veteranId:skillId" -> shown. */
	skills: Record<string, boolean>
}

const PICKS_KEY = "uma-course-map-veteran-picks"
const NO_PICKS: VeteranPicks = { veterans: {}, skills: {} }
let picks: VeteranPicks | null = null

function readPicks(): VeteranPicks {
	try {
		const stored = JSON.parse(localStorage.getItem(PICKS_KEY) ?? "null") as Partial<VeteranPicks> | null
		return { veterans: { ...stored?.veterans }, skills: { ...stored?.skills } }
	} catch {
		// Storage blocked or garbled: every default.
		return NO_PICKS
	}
}

function savePicks(next: VeteranPicks) {
	picks = next
	try {
		localStorage.setItem(PICKS_KEY, JSON.stringify(next))
	} catch {
		// Storage blocked: the picks last this page's life.
	}
	notify()
}

export function useVeteranPicks(): VeteranPicks {
	return useSyncExternalStore(subscribe, () => (picks ??= readPicks()), () => NO_PICKS)
}

export function setVeteranShown(veteranId: number, shown: boolean) {
	const current = picks ?? readPicks()
	savePicks({ ...current, veterans: { ...current.veterans, [veteranId]: shown } })
}

export function setVeteranSkillShown(veteranId: number, skillId: number, shown: boolean) {
	const current = picks ?? readPicks()
	savePicks({ ...current, skills: { ...current.skills, [`${veteranId}:${skillId}`]: shown } })
}

/**
 * Whether the accels column is open beside the map (owner, 2026-11-03: closed
 * until tapped, since its names cost the catalogue; remembered on the device).
 */
const ACCELS_KEY = "uma-course-map-accels"
let accelsOpen: boolean | null = null

function readAccelsOpen(): boolean {
	try {
		return localStorage.getItem(ACCELS_KEY) === "open"
	} catch {
		return false
	}
}

export function useAccelsOpen(): boolean {
	return useSyncExternalStore(subscribe, () => (accelsOpen ??= readAccelsOpen()), () => false)
}

export function setAccelsOpen(open: boolean) {
	accelsOpen = open
	try {
		localStorage.setItem(ACCELS_KEY, open ? "open" : "closed")
	} catch {
		// Storage blocked: the choice lasts this page's life.
	}
	notify()
}

/** The guide's course block (CourseSection): one per page. */
export const COURSE_MAP_ID = "course-map"

/**
 * "See it on the map": bring the course block into view from wherever a skill
 * was lit (notes/course-map-plan-2.md, section 8). For an event handler only,
 * since it reads the document.
 */
export function scrollToCourseMap() {
	const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
	document.getElementById(COURSE_MAP_ID)?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" })
}
