/**
 * The pinned Rankings panel's state, remembered on the device
 * (notes/rankings-page-plan.md, owner 2026-10-27):
 *
 *   section  which Rankings tab is pinned, or null for none. One at a time.
 *            Lasts until unpinned.
 *   docked   on a wide screen (xl up), whether the pinned panel is open
 *            beside the page or retracted to a slim tab on the left edge.
 *            Below xl it is always the tab, opening a drawer that starts
 *            closed, so this is never read there.
 *
 * An external store (useSyncExternalStore) like themeStore.ts, for the same
 * reason: /app is prerendered, and a render that reads localStorage throws
 * in Node. The server snapshot is "nothing pinned", so the build-time HTML
 * and the first hydrating render agree, and the panel appears right after.
 * Shared by the Rankings page (its Pin button) and AppShell (the panel), so
 * pinning on one shows on the other at once.
 */

import { useSyncExternalStore } from "react"

export type RankingsSection = "guides" | "pull-plans" | "pvp" | "players"

const SECTION_KEY = "rankings-pin"
const DOCK_KEY = "rankings-pin-docked"
const SECTIONS: readonly RankingsSection[] = ["guides", "pull-plans", "pvp", "players"]

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

function subscribe(listener: () => void): () => void {
	listeners.add(listener)
	// Another tab pinning or unpinning shows here too.
	const onStorage = (event: StorageEvent) => {
		if (event.key !== SECTION_KEY && event.key !== DOCK_KEY) return
		snapshot = read()
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

/** Open the pinned panel beside the page (true) or retract it to the edge tab (false). */
export function dockRankings(docked: boolean): void {
	update({ ...getSnapshot(), docked })
}

/** Tests only: forget the cached read, so each test starts from its own storage. */
export function resetRankingsPinForTests(): void {
	snapshot = null
}
