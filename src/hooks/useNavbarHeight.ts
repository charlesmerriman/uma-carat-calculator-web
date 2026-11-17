/**
 * The sticky navbar's real height, as `--navbar-h` on <html>, for anything
 * that sticks under it (the Encyclopedia's jump bar, encyclopedia.css).
 *
 * The jump bar used to stick at a written-down 7.75rem, the phone navbar's
 * height when its tabs had labels under the icons. A phone narrower than
 * 440px hides those labels (Navbar.tsx, the sr-only breakpoints), the bar is
 * shorter, and the jump bar parked about 20px below it with the page showing
 * through the gap (Daptrius, board "The bar for quick scrolling leave a gap on
 * Mobile CSS", 2026-11-17). Measured, it is right at every width and wrap.
 *
 * In an effect only: the page is prerendered, and the CSS keeps a fallback
 * (`var(--navbar-h, 7.75rem)`) for the first paint.
 */

import { useEffect, type RefObject } from "react"

export function useNavbarHeight(navbar: RefObject<HTMLElement | null>) {
	useEffect(() => {
		const element = navbar.current
		if (!element) return
		const root = document.documentElement
		const update = () => root.style.setProperty("--navbar-h", `${element.offsetHeight}px`)
		update()
		// The bar changes height with the breakpoint and its labels; a resize
		// listener alone where there is no ResizeObserver (jsdom in the tests).
		const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update)
		observer?.observe(element)
		window.addEventListener("resize", update)
		return () => {
			observer?.disconnect()
			window.removeEventListener("resize", update)
			root.style.removeProperty("--navbar-h")
		}
	}, [navbar])
}
