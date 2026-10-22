import { useCallback, useEffect, useRef, useState } from "react"
import type { RefObject } from "react"

/**
 * "Back to top" for an app whose scroll container is not always the same thing.
 *
 * THE WINDOW IS NOT THE SCROLLER HERE, and `window.scrollTo(0, 0)` is a no-op
 * on desktop. At the `app-shell` breakpoint (>=64rem wide AND >=32rem tall) the
 * shell is a fixed-height, no-scroll frame and the `overflow-y-auto` div inside
 * it does the scrolling — see views/ApplicationViews.tsx. Below that breakpoint
 * the shell is only `min-h-dvh`, so the same div grows to its content height,
 * never scrolls internally, and the document scrolls instead.
 *
 * Rather than detect which one is live — a computed-style walk that has to be
 * re-run whenever the viewport crosses the breakpoint — both halves of this hook
 * are asked in terms of an ANCHOR node parked at the top of the page:
 *
 * - to move, `scrollIntoView` on the anchor, which scrolls whatever ancestors
 *   need scrolling without being told which;
 * - to measure, the anchor's `getBoundingClientRect().top`, which is negative by
 *   exactly the distance the reader has travelled no matter what moved.
 *
 * The same reasoning is why hooks/useFocusScroll.ts uses `scrollIntoView` for
 * deep links; this is its counterpart for the return trip.
 */

/**
 * How far the reader travels before the control switches on.
 *
 * Roughly half a laptop viewport: far enough that the button isn't offering to
 * undo a flick of the wheel, close enough that it's already there by the time
 * the header is out of sight.
 */
const BACK_TO_TOP_THRESHOLD_PX = 400

export type BackToTop = {
	/** Park this on an empty node at the very top of the page's content. */
	topRef: RefObject<HTMLDivElement | null>
	/** Whether the reader is far enough down for the control to be worth offering. */
	isAwayFromTop: boolean
	/** Return to the anchor, honouring `prefers-reduced-motion`. */
	scrollToTop: () => void
}

export function useBackToTop(thresholdPx: number = BACK_TO_TOP_THRESHOLD_PX): BackToTop {
	const topRef = useRef<HTMLDivElement | null>(null)
	// Starts false: on mount the reader is at the top by definition, and guessing
	// otherwise would flash the control on before the first measurement lands.
	const [isAwayFromTop, setIsAwayFromTop] = useState(false)

	useEffect(() => {
		const node = topRef.current
		if (!node) return

		let ticking = false
		const measure = (): void => {
			ticking = false
			// Negated because the anchor sits ABOVE the viewport once scrolled: its
			// top reads -800 after 800px of travel, whichever element travelled.
			setIsAwayFromTop(-node.getBoundingClientRect().top > thresholdPx)
		}

		// Coalesced to one measurement per frame. A scroll listener that calls
		// setState on every event re-renders the whole event list dozens of times a
		// second, on the one page that can hold 250 image-heavy cards.
		const onScroll = (): void => {
			if (ticking) return
			ticking = true
			if (typeof requestAnimationFrame === "function") requestAnimationFrame(measure)
			else measure()
		}

		measure()

		// `capture: true` is load-bearing. Scroll events do NOT bubble, so a plain
		// listener on window hears the document scrolling and nothing else — it
		// would go permanently silent on desktop, where an inner div is what moves.
		// The capture phase still runs window -> target for a non-bubbling event, so
		// one capturing listener catches every scroller in the tree and this hook
		// never has to know which is live.
		window.addEventListener("scroll", onScroll, { passive: true, capture: true })
		// A resize can cross the app-shell breakpoint, which swaps the scroller out
		// from under us and leaves the last measurement describing the wrong one.
		window.addEventListener("resize", onScroll, { passive: true })

		return () => {
			window.removeEventListener("scroll", onScroll, { capture: true })
			window.removeEventListener("resize", onScroll)
		}
	}, [thresholdPx])

	const scrollToTop = useCallback((): void => {
		const node = topRef.current
		// Guarded because jsdom doesn't implement scrollIntoView — an unguarded call
		// would fail callers' tests rather than the feature. Same guard as
		// useFocusScroll, for the same reason.
		if (typeof node?.scrollIntoView !== "function") return

		// Smooth is safe here in a way it isn't for a deep link: the destination is
		// the top of the document, which nothing loading below can push around. (See
		// useFocusScroll's docblock for why the arriving scroll must stay instant.)
		const prefersReducedMotion =
			typeof window.matchMedia === "function" &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches

		node.scrollIntoView({ block: "start", behavior: prefersReducedMotion ? "auto" : "smooth" })
	}, [])

	return { topRef, isAwayFromTop, scrollToTop }
}
