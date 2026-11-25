/**
 * Where the PvP page's pinned rows stick, measured.
 *
 * The page pins rows as it scrolls (Daptrius, 2026-10-22): the View tabs,
 * and under them the running-style tabs,
 * the guide's side column, the gallery's open post and the team builder's
 * docked panels. Each sticks under the row above it, and those rows change
 * height with the breakpoint, the editors' fourth tab and a phone's wrapping
 * labels, so the offsets are measured here rather than written down as rem
 * values that drift out of step (the old 4.5rem panels sat under the band
 * only because nothing else was pinned).
 *
 * The event band (Previous, the event, Next) scrolls away with the page in
 * every set-up: you change cups at the top, and while it was pinned in the
 * desktop shell it held 52px of the screen for the whole read (review item 4,
 * 2026-11-24).
 *
 * Two scrolling set-ups (index.css, "app-shell"):
 *   desktop shell  the page scrolls an inner div that the navbar sits
 *                  outside of, so the tabs stick at that div's top.
 *   otherwise      the document scrolls under the site's sticky navbar, so
 *                  the tabs stick under the navbar.
 * A sticky `top` counts from the scroller's top edge in both: the inner div's
 * in the shell, the viewport's in the document.
 *
 * The course map's stuck strip (CourseSection, "Stick to top") docks on the
 * same line, so while it is there the View tabs and everything under them stick
 * lower by its height: it is found by `data-course-stuck` and measured on the
 * `pvp-sticky-change` event its block sends when it docks or leaves.
 *
 * Sets on `root`, for everything inside it:
 *   --pvp-stick-line  the top of the scroller's visible area, where the course strip docks
 *   --pvp-tabs-top    where the View tabs stick
 *   --pvp-below-tabs  the View tabs' bottom edge: where the rows under them stick
 *   --pvp-viewport-h  the scroller's visible height, so a pinned column can be
 *                     kept to what fits on screen
 * Read them with a fallback (`var(--pvp-below-tabs, 3.5rem)`): the first paint
 * comes before this effect.
 */

import { useEffect, type RefObject } from "react"
import { APP_SCROLLER_SELECTOR } from "./useScrollReset"
import { NAVBAR_REVEAL_EVENT, navbarRevealPx } from "./useNavbarReveal"

/** Sent on `window` by the course block when its strip docks, leaves or changes height. */
export const STICKY_CHANGE = "pvp-sticky-change"

export function usePvpStickyOffsets(
	root: RefObject<HTMLElement | null>,
	tabs: RefObject<HTMLElement | null>,
	// The tabs render only once there is an event: re-run when they appear.
	hasTabs: boolean,
) {
	useEffect(() => {
		const rootElement = root.current
		const tabsElement = tabs.current
		if (!rootElement || !tabsElement) return
		// Navbar.tsx marks its sticky wrapper; the PvP page doesn't own it.
		const navbar = document.querySelector<HTMLElement>("[data-sticky-navbar]")

		const update = () => {
			// The shell's scroller (views/ApplicationViews.tsx) scrolls only in the
			// desktop shell (its app-shell:overflow-auto), which makes its computed
			// overflow the test for which set-up is live.
			const shellScroller = rootElement.closest<HTMLElement>(APP_SCROLLER_SELECTOR)
			const shell = shellScroller !== null && /auto|scroll/.test(getComputedStyle(shellScroller).overflowY)
			// In the shell the navbar is outside the scroller, so the line is its top.
			// Outside it the line is the navbar's pinned part, plus the phone's
			// wordmark row while scrolling up has brought it back (useNavbarReveal).
			const line = shell ? 0 : (navbar?.offsetHeight ?? 0) + navbarRevealPx()
			const stuck = document.querySelector<HTMLElement>("[data-course-stuck]")?.offsetHeight ?? 0
			const top = line + stuck
			const scroller = shell ? shellScroller : null
			rootElement.style.setProperty("--pvp-stick-line", `${line}px`)
			rootElement.style.setProperty("--pvp-tabs-top", `${top}px`)
			rootElement.style.setProperty("--pvp-below-tabs", `${top + tabsElement.offsetHeight}px`)
			rootElement.style.setProperty("--pvp-viewport-h", `${scroller?.clientHeight ?? window.innerHeight}px`)
		}

		update()
		// A size change of either moves the offsets; a window resize can also
		// cross the shell breakpoint without resizing them.
		// No ResizeObserver (jsdom in the tests): the resize listener alone.
		const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update)
		for (const element of [tabsElement, navbar]) if (element) observer?.observe(element)
		window.addEventListener("resize", update)
		window.addEventListener(STICKY_CHANGE, update)
		window.addEventListener(NAVBAR_REVEAL_EVENT, update)
		return () => {
			observer?.disconnect()
			window.removeEventListener("resize", update)
			window.removeEventListener(STICKY_CHANGE, update)
			window.removeEventListener(NAVBAR_REVEAL_EVENT, update)
		}
	}, [root, tabs, hasTabs])
}
