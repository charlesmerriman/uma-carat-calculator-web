/**
 * On a phone, the navbar's top row comes back when the reader scrolls UP.
 *
 * The phone bar is two rows (Navbar.tsx): the wordmark row (search, Team,
 * Sign in, the menu, a waiting save) and the places. Only the places stay
 * pinned; the wordmark row scrolls away with the page, because the sticky
 * box's `top` is minus that row's height. That alone brings the row back only
 * at the very top of the page, and the owner chose the layout on the promise
 * that "search, the menu and Team come back when you scroll up" (2026-11-24,
 * notes/navigation-plan.md). So this watches the scroll direction and, on the
 * way up, lifts the box by the row's height: `--navbar-reveal` on <html> is
 * 3.5rem while the row is shown, 0 while it is tucked away.
 *
 * WHAT READS IT. Everything that pins under the navbar adds it to the bar's
 * measured height (--navbar-h), so nothing ends up under the returned row:
 *   - the navbar's own sticky box (Navbar.tsx)
 *   - a screen's bar (components/ScreenTabs.tsx)
 *   - the Encyclopedia's jump bar (encyclopedia.css)
 *   - the PvP page's pinned rows, which are measured in pixels
 *     (hooks/usePvpStickyOffsets.ts), so it re-measures on NAVBAR_REVEAL_EVENT
 *     and reads the current amount from navbarRevealPx().
 *
 * WHEN. Phone layout only (below `desktop-nav`, where the document scrolls),
 * and only past the row: within its height of the top, the row is on screen
 * by itself. A small move either way is ignored, so a thumb resting on the
 * glass doesn't flicker the row; the moves add up until they pass it.
 *
 * In an effect only: the page is prerendered, so nothing here runs at build
 * time, and the CSS falls back to 0 (row tucked away) until it does.
 */

import { useEffect } from "react"

/** Sent on `window` when the row shows or hides. */
export const NAVBAR_REVEAL_EVENT = "navbar-reveal-change"

/** The wordmark row's height: Navbar.tsx's `h-14`, and the 3.5rem below. */
const ROW_PX = 56
/** How far the page has to move one way before the row follows. */
const THRESHOLD_PX = 8
/** The phone layout: below index.css's `desktop-nav` (64rem). */
const PHONE_QUERY = "(max-width: 63.99rem)"

let revealed = false

/** The row's height while it is shown, else 0: for a pinned row measured in pixels. */
export function navbarRevealPx(): number {
	return revealed ? ROW_PX : 0
}

export function useNavbarReveal(): void {
	useEffect(() => {
		const root = document.documentElement
		const phone = window.matchMedia(PHONE_QUERY)
		let last = window.scrollY

		const set = (next: boolean) => {
			if (next === revealed) return
			revealed = next
			root.style.setProperty("--navbar-reveal", next ? "3.5rem" : "0px")
			window.dispatchEvent(new Event(NAVBAR_REVEAL_EVENT))
		}

		const onScroll = () => {
			const y = window.scrollY
			if (!phone.matches || y <= ROW_PX) {
				set(false)
				last = y
				return
			}
			const moved = y - last
			if (Math.abs(moved) < THRESHOLD_PX) return
			set(moved < 0)
			last = y
		}

		window.addEventListener("scroll", onScroll, { passive: true })
		phone.addEventListener?.("change", onScroll)
		return () => {
			window.removeEventListener("scroll", onScroll)
			phone.removeEventListener?.("change", onScroll)
			revealed = false
			root.style.removeProperty("--navbar-reveal")
		}
	}, [])
}
