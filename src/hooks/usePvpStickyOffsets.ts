/**
 * Where the PvP page's pinned rows stick, measured.
 *
 * The page pins rows as it scrolls (Daptrius, 2026-10-22): the event band
 * (Previous, the event, Next), the View tabs under it, and under those the
 * running-style tabs, the guide's side column, the gallery's open post and the
 * team builder's docked panels. Each sticks under the row above it, and those
 * rows change height with the breakpoint, the editors' fourth tab and a
 * phone's wrapping labels, so the offsets are measured here rather than
 * written down as rem values that drift out of step.
 *
 * THE EVENT BAND PINS AGAIN (Daptrius, 2026-11-25: "CM selector buttons should
 * stick to the top of the window"). It scrolled away from 2026-11-24 (web
 * #473) because it held 52px of the screen for the whole read; that trade is
 * the owner's call, which is why this came as its own PR. On a phone the band
 * stacks the past-events toggle over the event row, and only the event row
 * stays: the band sticks at a negative offset, the toggle's height above the
 * line, the navbar's own trick for its wordmark row (Navbar.tsx).
 *
 * Two scrolling set-ups (index.css, "app-shell"):
 *   desktop shell  the page scrolls an inner div that the navbar sits
 *                  outside of, so the band sticks at that div's top.
 *   otherwise      the document scrolls under the site's sticky navbar, so
 *                  the band sticks under the navbar.
 * A sticky `top` counts from the scroller's top edge in both: the inner div's
 * in the shell, the viewport's in the document.
 *
 * The course map's stuck strip (CourseSection, "Stick to top") docks under
 * the band, so while it is there the View tabs and everything under them stick
 * lower by its height: it is found by `data-course-stuck` and measured on the
 * `pvp-sticky-change` event its block sends when it docks or leaves.
 *
 * Sets on `root`, for everything inside it:
 *   --pvp-band-top    where the event band sticks (negative by its scrolled-away
 *                     part on a phone)
 *   --pvp-stick-line  the pinned band's bottom edge, where the course strip docks
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
	band: RefObject<HTMLElement | null>,
	tabs: RefObject<HTMLElement | null>,
	// The tabs render only once there is an event: re-run when they appear.
	hasTabs: boolean,
) {
	useEffect(() => {
		const rootElement = root.current
		const bandElement = band.current
		const tabsElement = tabs.current
		if (!rootElement || !bandElement || !tabsElement) return
		// Navbar.tsx marks its sticky wrapper; the PvP page doesn't own it.
		const navbar = document.querySelector<HTMLElement>("[data-sticky-navbar]")

		const update = () => {
			// The shell's scroller (views/ApplicationViews.tsx) scrolls only in the
			// desktop shell (its app-shell:overflow-auto), which makes its computed
			// overflow the test for which set-up is live.
			const shellScroller = rootElement.closest<HTMLElement>(APP_SCROLLER_SELECTOR)
			const shell = shellScroller !== null && /auto|scroll/.test(getComputedStyle(shellScroller).overflowY)
			// In the shell the navbar is outside the scroller, so the top is its top.
			// Outside it the top is the navbar's pinned part, plus the phone's
			// wordmark row while scrolling up has brought it back (useNavbarReveal).
			const top = shell ? 0 : (navbar?.offsetHeight ?? 0) + navbarRevealPx()
			// The toggle's share of the band, when it sits ABOVE the event row (a
			// phone); side by side (from md) nothing scrolls away. offsetTop
			// counts from the band, which is positioned (sticky). The band marks
			// both rows (PvpGuidePage's ControlBand).
			const pinnedRow = bandElement.querySelector<HTMLElement>("[data-band-pinned]")
			const toggle = bandElement.querySelector<HTMLElement>("[data-band-scrolls]")
			const stacked = pinnedRow !== null && toggle !== null && pinnedRow.offsetTop >= toggle.offsetTop + toggle.offsetHeight
			// Everything down to 4px above the event row goes: the toggle's shadow
			// reaches past its box, and a line of it showed under the navbar.
			const hidden = stacked ? pinnedRow.offsetTop - 4 : 0
			const line = top + bandElement.offsetHeight - hidden
			const stuck = document.querySelector<HTMLElement>("[data-course-stuck]")?.offsetHeight ?? 0
			const tabsTop = line + stuck
			const scroller = shell ? shellScroller : null
			rootElement.style.setProperty("--pvp-band-top", `${top - hidden}px`)
			rootElement.style.setProperty("--pvp-stick-line", `${line}px`)
			rootElement.style.setProperty("--pvp-tabs-top", `${tabsTop}px`)
			rootElement.style.setProperty("--pvp-below-tabs", `${tabsTop + tabsElement.offsetHeight}px`)
			rootElement.style.setProperty("--pvp-viewport-h", `${scroller?.clientHeight ?? window.innerHeight}px`)
		}

		update()
		// A size change of any of the three moves the offsets; a window resize
		// can also cross the shell breakpoint without resizing them.
		// No ResizeObserver (jsdom in the tests): the resize listener alone.
		const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update)
		for (const element of [bandElement, tabsElement, navbar]) if (element) observer?.observe(element)
		window.addEventListener("resize", update)
		window.addEventListener(STICKY_CHANGE, update)
		window.addEventListener(NAVBAR_REVEAL_EVENT, update)
		return () => {
			observer?.disconnect()
			window.removeEventListener("resize", update)
			window.removeEventListener(STICKY_CHANGE, update)
			window.removeEventListener(NAVBAR_REVEAL_EVENT, update)
		}
	}, [root, band, tabs, hasTabs])
}
