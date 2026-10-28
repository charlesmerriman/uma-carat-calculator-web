/**
 * The pinned Rankings panel's state, remembered on the device
 * (notes/rankings-page-plan.md, owner 2026-10-27):
 *
 *   section  which Rankings tab is pinned, or null for none. One at a time.
 *            Lasts until unpinned.
 *   docked   from desktop-nav (1024px) up, whether the pinned window is
 *            open over the page's left side or retracted to a slim tab on
 *            the left edge. Below that the window starts retracted every
 *            load (it would cover the screen), so this is not read there.
 *
 * An external store (useSyncExternalStore) like themeStore.ts, for the same
 * reason: /app is prerendered, and a render that reads localStorage throws
 * in Node. The server snapshot is "nothing pinned", so the build-time HTML
 * and the first hydrating render agree, and the panel appears right after.
 * Shared by the Rankings page (its Pin button) and AppShell (the panel), so
 * pinning on one shows on the other at once.
 *
 * CHOICES (notes/rankings-redesign-plan.md): the settings the window can
 * change are the page's too, so the page and the window read and write one
 * remembered copy, `rankings-choices` (JSON): the Guides lens, the PvP event,
 * the Pull plans type and sort. Same store, same server snapshot (nothing
 * chosen), so a choice made in the window is there when the full page opens.
 */

import { useSyncExternalStore } from "react"

export type RankingsSection = "guides" | "pull-plans" | "pvp" | "players"

const SECTION_KEY = "rankings-pin"
const DOCK_KEY = "rankings-pin-docked"
const SECTIONS: readonly RankingsSection[] = ["guides", "pull-plans", "pvp", "players"]

/** The Guides tab's lens: one list at a time (components/rankings/GuideRankings.tsx). */
export type GuideLens = "overall" | "speed" | "stamina" | "power" | "guts" | "wit" | "friend" | "group" | "umas"
export const GUIDE_LENSES: readonly GuideLens[] = ["overall", "speed", "stamina", "power", "guts", "wit", "friend", "group", "umas"]

/** What each section remembers; a missing value is that section's default. */
export interface RankingsChoices {
	guides?: { lens?: GuideLens }
	/** `event` is a PvP event ref as the address bar writes it ("cm-21"). */
	pvp?: { event?: string }
	"pull-plans"?: { type?: string; sort?: string }
}

const CHOICES_KEY = "rankings-choices"
const NO_CHOICES: RankingsChoices = {}
let choicesSnapshot: RankingsChoices | null = null

export interface RankingsPin {
	section: RankingsSection | null
	docked: boolean
}

const NONE: RankingsPin = { section: null, docked: true }
let snapshot: RankingsPin | null = null
const listeners = new Set<() => void>()

function read(): RankingsPin {
	try {
		const section = localStorage.getItem(SECTION_KEY)
		return {
			section: SECTIONS.includes(section as RankingsSection) ? (section as RankingsSection) : null,
			docked: localStorage.getItem(DOCK_KEY) !== "retracted",
		}
	} catch {
		// Storage blocked: nothing pinned, and a pin lasts only this page's life.
		return NONE
	}
}

function getSnapshot(): RankingsPin {
	// Cached: useSyncExternalStore needs the same object until something changes.
	snapshot ??= read()
	return snapshot
}

function update(next: RankingsPin): void {
	snapshot = next
	try {
		if (next.section) localStorage.setItem(SECTION_KEY, next.section)
		else localStorage.removeItem(SECTION_KEY)
		if (next.docked) localStorage.removeItem(DOCK_KEY)
		else localStorage.setItem(DOCK_KEY, "retracted")
	} catch {
		// Kept in memory for this page's life.
	}
	listeners.forEach((listener) => listener())
}

function readChoices(): RankingsChoices {
	try {
		const parsed: unknown = JSON.parse(localStorage.getItem(CHOICES_KEY) ?? "{}")
		if (typeof parsed !== "object" || parsed === null) return NO_CHOICES
		const choices = parsed as RankingsChoices
		// A lens from an older build (or a hand edit) falls back to the default.
		if (choices.guides?.lens && !GUIDE_LENSES.includes(choices.guides.lens)) delete choices.guides.lens
		return choices
	} catch {
		return NO_CHOICES
	}
}

function getChoicesSnapshot(): RankingsChoices {
	choicesSnapshot ??= readChoices()
	return choicesSnapshot
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener)
	// Another tab pinning, unpinning or choosing shows here too.
	const onStorage = (event: StorageEvent) => {
		if (event.key === CHOICES_KEY) choicesSnapshot = readChoices()
		else if (event.key === SECTION_KEY || event.key === DOCK_KEY) snapshot = read()
		else return
		listener()
	}
	window.addEventListener("storage", onStorage)
	return () => {
		listeners.delete(listener)
		window.removeEventListener("storage", onStorage)
	}
}

export function useRankingsPin(): RankingsPin {
	return useSyncExternalStore(subscribe, getSnapshot, () => NONE)
}

/** Pin `section` (replacing any other), docked open. Null unpins. */
export function pinRankings(section: RankingsSection | null): void {
	update({ section, docked: true })
}

/** Open the pinned window (true) or retract it to the edge tab (false). */
export function dockRankings(docked: boolean): void {
	update({ ...getSnapshot(), docked })
}

export function useRankingsChoices(): RankingsChoices {
	return useSyncExternalStore(subscribe, getChoicesSnapshot, () => NO_CHOICES)
}

/** Remember one section's choices, merged over what it had. */
export function chooseRankings<S extends keyof RankingsChoices>(section: S, choice: NonNullable<RankingsChoices[S]>): void {
	const current = getChoicesSnapshot()
	choicesSnapshot = { ...current, [section]: { ...current[section], ...choice } }
	try {
		localStorage.setItem(CHOICES_KEY, JSON.stringify(choicesSnapshot))
	} catch {
		// Kept in memory for this page's life.
	}
	listeners.forEach((listener) => listener())
}

/** Tests only: forget the cached read, so each test starts from its own storage. */
export function resetRankingsPinForTests(): void {
	snapshot = null
	choicesSnapshot = null
}
