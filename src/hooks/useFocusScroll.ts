import { useLayoutEffect } from "react"
import type { RefObject } from "react"

/**
 * Land a deep link on the element it named, and hold it there while the page
 * settles.
 *
 * Shared by the Timeline (a link from a planner row or section band) and the
 * Selectors page (a link from a timeline campaign strip). Both arrive on a
 * long, image-heavy list and have to put one item on screen; a second copy of
 * this would be a second place for the two to drift apart.
 */

/**
 * How much air the scroll leaves above the element it lands on.
 *
 * The scroll aligns to the target's TOP, which without this would press it
 * flush against the edge of the scroller and read as though the list begins
 * there. A little margin keeps the tail of the previous item in shot, so the
 * target is visibly one row of a list rather than the top of a page.
 *
 * Goes on whichever node carries the ref — which is not always the node
 * wearing the arrival highlight. A banner window rings its panel but scrolls
 * its wrapper, so that the campaign strip above the panel comes into view too.
 * `scroll-margin-top` affects nothing but `scrollIntoView`, so it can be
 * applied unconditionally rather than gated on whether the item is the target.
 */
export const FOCUS_SCROLL_MARGIN = "scroll-mt-6"

/**
 * A screen of empty space below a list, so a target near its END can still be
 * scrolled to the top.
 *
 * `scrollIntoView` cannot scroll past the bottom of a scroller. An item with
 * nothing below it therefore lands wherever the last scroll position leaves it
 * — mid-screen, or lower — no matter what `block` says. A windowed list can
 * answer that by revealing more rows below the target (see
 * `FOCUS_TRAILING_ROWS` in Timeline.tsx); at the true end of the list, or on a
 * page that renders everything at once, this is what answers it instead.
 *
 * Rendered ONLY when the list actually runs out beneath the target, which is
 * why it is not simply permanent padding: a screen of dead air under every
 * list would be a worse bug than the one it fixes. `dvh` matches the app shell.
 */
export const FOCUS_TAILROOM = "h-[100dvh] w-full shrink-0"

/**
 * Landing an element back at the exact screen position it already occupied,
 * without knowing which element is the scroller.
 *
 * The window is NOT the scroller at the `app-shell` breakpoint (see
 * hooks/useBackToTop.ts), so `scrollBy` to nudge a landing by N pixels is a
 * silent no-op on desktop. `scroll-margin-top` has no such problem: it shifts
 * where `scrollIntoView` parks the element, and the browser resolves it against
 * whatever scroller is actually live.
 *
 * The margin needed is not the offset itself — the scrollport does not start at
 * viewport y=0 (a navbar sits above it, and a sticky control band below that).
 * So the alignment CALIBRATES: park the node flush, measure where flush landed,
 * and the difference between that and the wanted offset is the margin. One extra
 * layout read, and nothing has to know the page's chrome heights.
 *
 * Negative margins are allowed through deliberately. A reader halfway down a
 * tall card has a negative offset — the card starts above the fold — and
 * clamping to zero would jump that card down to meet them, which is the movement
 * this exists to avoid.
 */

/**
 * How stubbornly the scroll holds its target while the page settles.
 *
 * Two stable frames rather than one: a single still frame is also what you get
 * in the gap between two images decoding, so one would call it done halfway.
 * 1200ms is well past a warm cache, and short enough that a cold, slow load
 * gives up instead of tugging at a reader who has started scrolling. The
 * tolerance is there because fractional layout jitters by sub-pixel amounts
 * that are not movement.
 */
const SETTLE_STABLE_FRAMES = 2
const SETTLE_TIMEOUT_MS = 1200
const SETTLE_TOLERANCE_PX = 1

/**
 * Set the margin that will hold `node` at `offsetPx` down the scrollport.
 *
 * Call ONCE, on an already-flush-aligned node, and let subsequent alignments
 * inherit it. Re-calibrating on a node that already carries a margin measures
 * the margin's own effect and cancels it out — the correction would oscillate
 * between the wanted offset and flush rather than converging.
 *
 * Module-level, taking the node as a parameter, rather than inline in the hook:
 * a DOM write reached through a hook argument is what `react-hooks/immutability`
 * refuses, and this is the honest shape of it anyway — a small imperative
 * operation on an element, named.
 */
function calibrateScrollOffset(node: HTMLElement, offsetPx: number): void {
	// "Flush" is not margin zero: the node parks at the scrollport's edge PLUS
	// whatever scroll margin it already has, from a class (FOCUS_SCROLL_MARGIN)
	// or a stylesheet (the Timeline's cards clear their sticky control bar that
	// way, timeline.css section 6). So the margin that holds the node at
	// `offsetPx` is the one it has, moved by how far it is from there. Writing
	// the bare difference instead dropped the existing margin, and the node
	// landed that much too high: 24px while every card had only the class, then
	// 86px or more once the Timeline's cards had a larger one (2026-11-24).
	const current = Number.parseFloat(getComputedStyle(node).scrollMarginTop) || 0
	node.style.scrollMarginTop = `${current + offsetPx - node.getBoundingClientRect().top}px`
}

/** Undo it. See the cleanup in useFocusScroll for why this is not optional. */
function clearScrollOffset(node: HTMLElement): void {
	node.style.scrollMarginTop = ""
}

/**
 * Scroll `target` to the top of its scroller, then keep correcting until the
 * page stops moving under it.
 *
 * THE SCROLL IS INSTANT, AND THAT IS NOT A DOWNGRADE FROM A SMOOTH ONE.
 * `scrollIntoView` samples its destination once and animates towards that
 * fixed offset, so anything that grows above the target mid-flight leaves the
 * animation short. Lazy images make that a certainty rather than a risk: the
 * animation drags the viewport through every item above the target, which is
 * precisely what triggers those images to load and push it further down. The
 * further it travelled, the further it missed.
 *
 * Reserving image space removes the cause (see BANNER_ART in
 * BannerWindowCard); this loop covers what a declared ratio cannot predict — a
 * heading that wraps, a font that swaps, a panel that renders late.
 *
 * `scrollIntoView` is guarded because jsdom doesn't implement it: an unguarded
 * call would fail callers' tests rather than the feature. The loop itself needs
 * no guard — jsdom reports every rect as zero, which reads as "already stable"
 * and ends it two frames in.
 *
 * Runs as a LAYOUT effect, not a passive one. Both callers reach this from a
 * state change that rebuilt the list under the reader, so a passive effect can
 * leave a frame of the un-scrolled list on screen before correcting. That was
 * tolerable while the only caller was a deep link arriving on a fresh route; it
 * is not once the hook is also asked to hold a card still (see `offset`), where
 * a one-frame flick to the top of the list is the entire bug.
 *
 * @param target The node to bring into view.
 * @param key    Re-runs whenever this changes. Null disables the hook, which is
 *               how a caller says "no deep link" or "target not resolved yet".
 * @param offset Optional. Where on screen to park the node, in pixels from the
 *               top of the scrollport, INSTEAD of flush at the top. A ref rather
 *               than a value so it stays out of the dependency list — it is read
 *               at alignment time and must never be a reason to re-scroll on its
 *               own. Null or absent means the ordinary top-aligned landing.
 */
export function useFocusScroll(
	target: RefObject<HTMLElement | null>,
	key: string | number | null,
	offset?: RefObject<number | null>
): void {
	useLayoutEffect(() => {
		if (key === null) return
		const node = target.current
		if (typeof node?.scrollIntoView !== "function") return

		// `start`, not `center`: these cards are tall — a timeline banner's art
		// alone is ~369px before any panel — so centring one puts its heading
		// halfway down the screen with the row you came from nowhere in sight.
		// FOCUS_SCROLL_MARGIN keeps it off the very edge.
		const align = () => node.scrollIntoView({ block: "start" })

		// Synchronously, before any frame is requested: the reader must never be
		// shown the top of the list first, and callers' tests assert this call
		// has already happened by the time render() returns.
		align()

		// Then, if the caller wants the node held somewhere other than flush at the
		// top, calibrate off where flush actually landed and re-align. Both reads
		// and both aligns happen inside this one synchronous block, so the reader
		// never sees the intermediate position. See the OFFSET note above.
		const wantedTop = offset?.current ?? null
		if (wantedTop !== null) {
			calibrateScrollOffset(node, wantedTop)
			align()
		}

		if (typeof requestAnimationFrame !== "function") {
			// No settle loop to clean up after, but the inline margin must still go:
			// it would otherwise outlive this landing and displace the next one.
			return () => clearScrollOffset(node)
		}

		// Any deliberate move by the reader ends the correction immediately.
		// Re-aligning under someone who has started scrolling themselves would
		// only be a different way of taking the page away from them.
		let abandoned = false
		const abandon = () => { abandoned = true }
		const interruptions = ["wheel", "touchstart", "keydown"] as const
		for (const type of interruptions) {
			window.addEventListener(type, abandon, { passive: true, once: true })
		}

		let frame = 0
		let stableFrames = 0
		let lastTop = node.getBoundingClientRect().top
		const deadline = Date.now() + SETTLE_TIMEOUT_MS

		const settle = () => {
			if (abandoned || Date.now() > deadline) return

			const top = node.getBoundingClientRect().top
			if (Math.abs(top - lastTop) <= SETTLE_TOLERANCE_PX) {
				stableFrames += 1
			} else {
				stableFrames = 0
				align()
				// Re-read AFTER correcting, so the next frame compares against
				// where the node now is rather than where it had drifted to.
				// Comparing against the drifted value would score the correction
				// itself as a second disturbance and never converge.
				lastTop = node.getBoundingClientRect().top
			}

			if (stableFrames >= SETTLE_STABLE_FRAMES) return
			frame = requestAnimationFrame(settle)
		}
		frame = requestAnimationFrame(settle)

		return () => {
			cancelAnimationFrame(frame)
			for (const type of interruptions) window.removeEventListener(type, abandon)
			// Drop the calibrated margin. Leaving it would silently offset the NEXT
			// landing on this node by a distance measured for a different scroll.
			clearScrollOffset(node)
		}
	}, [target, key, offset])
}
