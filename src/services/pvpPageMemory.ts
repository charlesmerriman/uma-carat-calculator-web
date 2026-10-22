/**
 * Where the reader left the PvP page, so coming back to it lands them there.
 *
 * Two things, kept apart because they come back in different situations:
 *
 *   the page   the page's whole query string (`?event=cm-12&view=gallery&...`).
 *              It comes back only on a bare `/app/pvp`, which is what the navbar
 *              link opens. A link that names an event (a Timeline card, the
 *              team window) goes where it says.
 *   the style  the running style last on screen. It comes back on ANY address
 *              that names no style, so a Timeline card's link (which names only
 *              the event) still opens on the reader's style.
 *
 * One key could not do both: the page is rewritten on every visit, so landing
 * from a Timeline link (no `style`) would wipe the style before the next visit
 * could read it.
 *
 * sessionStorage, not localStorage: this is "where was I in this tab". A new
 * tab, or a visit next week, should open on the event that is on now (the
 * page's default), not on one that has long ended.
 *
 * Every access is wrapped: private browsing and strict privacy settings can
 * make sessionStorage throw, and then the page just opens on its default.
 *
 * Plus one flag that is NOT per tab, at the bottom: whether this device has
 * had a guide on screen, which decides how much of the intro to show.
 */

import { parsePvpStyle } from "../utils/pvpGuide"
import type { PvpStyleTab } from "../types/pvpGuide"

const PAGE_KEY = "pvp-page"
const STYLE_KEY = "pvp-style"

/** The page's query string, with its `?`, or "" for the bare page. */
export function rememberPvpPage(search: string): void {
	try {
		sessionStorage.setItem(PAGE_KEY, search)
	} catch {
		// Storage refused: the next visit opens on the default event.
	}
}

/** The query string the page was left on, or "" when there is none. */
export function recalledPvpPage(): string {
	try {
		const search = sessionStorage.getItem(PAGE_KEY) ?? ""
		// Only ever a query string; anything else would send <Navigate> off the
		// page. A lone "?" is refused too: it lands back on the bare page, and
		// the restore would fire again, forever.
		return search.length > 1 && search.startsWith("?") ? search : ""
	} catch {
		return ""
	}
}

export function rememberPvpStyle(style: PvpStyleTab): void {
	try {
		sessionStorage.setItem(STYLE_KEY, style)
	} catch {
		// Storage refused: the next guide opens on its first style.
	}
}

export function recalledPvpStyle(): PvpStyleTab | null {
	try {
		return parsePvpStyle(sessionStorage.getItem(STYLE_KEY))
	} catch {
		return null
	}
}

/**
 * Whether a guide has been on screen on this device. The page's intro (the
 * admin's "pvp-guides" text, two paragraphs above the event card) shows in full
 * until one has, and after that folds behind an "About these guides" link: a
 * returning reader has read it, and on a phone it pushed the event card below
 * the fold on every visit. localStorage, unlike the keys above, because "has
 * this person read it" should outlast the tab.
 */
const INTRO_KEY = "uma-planner-pvp-intro-seen"

export function pvpIntroSeen(): boolean {
	try {
		return localStorage.getItem(INTRO_KEY) === "1"
	} catch {
		return false
	}
}

export function markPvpIntroSeen(): void {
	try {
		localStorage.setItem(INTRO_KEY, "1")
	} catch {
		// Storage refused: the intro keeps showing in full.
	}
}
