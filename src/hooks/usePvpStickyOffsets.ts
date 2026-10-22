/**
 * Where the PvP page's pinned rows stick, measured.
 *
 * The page pins rows as it scrolls (Daptrius, 2026-10-22): the event band
 * (desktop shell only), the View tabs, and under them the running-style tabs,
 * the guide's side column, the gallery's open post and the team builder's
 * docked panels. Each sticks under the row above it, and those rows change
 * height with the breakpoint, the editors' fourth tab and a phone's wrapping
 * labels, so the offsets are measured here rather than written down as rem
 * values that drift out of step (the old 4.5rem panels sat under the band
 * only because nothing else was pinned).
 *
 * Two scrolling set-ups (index.css, "app-shell"):
 *   desktop shell  the page scrolls an inner div, and the event band is
 *                  sticky at that div's top, so the tabs stick under the band.
 *   otherwise      the document scrolls under the site's sticky navbar, and
 *                  the band scrolls away, so the tabs stick under the navbar.
 * A sticky `top` counts from the scroller's top edge in both: the inner div's
 * in the shell, the viewport's in the document.
 *
 * Sets on `root`, for everything inside it:
 *   --pvp-tabs-top    where the View tabs stick
 *   --pvp-below-tabs  the View tabs' bottom edge: where the rows under them stick
 *   --pvp-viewport-h  the scroller's visible height, so a pinned column can be
 *                     kept to what fits on screen
 * Read them with a fallback (`var(--pvp-below-tabs, 3.5rem)`): the first paint
 * comes before this effect.
 */

import { useEffect, type RefObject } from "react"
import { APP_SCROLLER_SELECTOR } from "./useScrollReset"

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
			// The band is sticky only in the desktop shell (its app-shell:sticky),
			// which makes its computed position the test for which set-up is live.
			const shell = getComputedStyle(bandElement).position === "sticky"
			const top = shell ? bandElement.offsetHeight : (navbar?.offsetHeight ?? 0)
			// The shell's scroller (views/ApplicationViews.tsx); the document otherwise.
			const scroller = shell ? rootElement.closest<HTMLElement>(APP_SCROLLER_SELECTOR) : null
			rootElement.style.setProperty("--pvp-tabs-top", `${top}px`)
			rootElement.style.setProperty("--pvp-below-tabs", `${top + tabsElement.offsetHeight}px`)
			rootElement.style.setProperty("--pvp-viewport-h", `${scroller?.clientHeight ?? window.innerHeight}px`)
		}

		update()
		// A size change of any of the three moves the offsets; a window resize
		// can also cross the shell breakpoint without resizing any of them.
		// No ResizeObserver (jsdom in the tests): the resize listener alone.
		const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update)
		for (const element of [bandElement, tabsElement, navbar]) if (element) observer?.observe(element)
		window.addEventListener("resize", update)
		return () => {
			observer?.disconnect()
			window.removeEventListener("resize", update)
		}
	}, [root, band, tabs, hasTabs])
}
