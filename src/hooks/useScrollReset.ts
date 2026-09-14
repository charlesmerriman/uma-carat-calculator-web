import { useEffect, useLayoutEffect, useRef } from "react"
import { useLocation, useNavigationType } from "react-router-dom"
import { TIMELINE_FOCUS_PARAM } from "../utils/timelineFocus"
import { SELECTORS_CAMPAIGN_PARAM } from "../utils/selectorsFocus"

/**
 * One scroll position per page, instead of one shared by the whole site.
 *
 * A router navigation is a `history.pushState`, and the browser deliberately
 * does NOT reset scroll for those — it only manages scroll for real document
 * loads and for back/forward. Nothing here used to reset it either, so the
 * offset you were at when you clicked a nav link was still the offset you
 * landed on. On desktop that was worse than a coincidence: at the `app-shell`
 * breakpoint the calculator, timeline and selectors are the same
 * `overflow-y-auto` div (it belongs to the LAYOUT route in
 * views/ApplicationViews.tsx, which never remounts when the outlet swaps), so
 * the three pages shared one scrollport object and one `scrollTop`.
 *
 * The rule this implements is the ordinary one: a new navigation starts at the
 * top, back and forward return you to where that history entry was left.
 *
 * TWO SCROLLERS, AND WHICH IS LIVE DEPENDS ON THE VIEWPORT. Below the
 * `app-shell` breakpoint (>=64rem wide AND >=32rem tall) every page scrolls the
 * document; at or above it, /app is a fixed-height frame and the div inside it
 * scrolls instead. `window.scrollTo` is therefore a no-op on desktop /app — the
 * same trap hooks/useBackToTop.ts documents. Rather than work out which one is
 * live on every navigation, both are read and both are written: the dormant one
 * is always at 0, so touching it costs nothing and cannot be wrong.
 */

/** Matches the `data-app-scroller` attribute set in views/ApplicationViews.tsx. */
const APP_SCROLLER_SELECTOR = "[data-app-scroller]"

type Offsets = {
	/** The document scroller — every page below the `app-shell` breakpoint. */
	doc: number
	/** The app shell's internal scroller — /app at or above that breakpoint. */
	app: number
}

const TOP: Offsets = { doc: 0, app: 0 }

/**
 * Where each history entry was left.
 *
 * Keyed by `location.key` (the history ENTRY) rather than by pathname: reaching
 * /app/timeline twice from two different places is two entries a reader can sit
 * at two different depths in, and back is expected to restore the one they came
 * from. Module scope so it survives route remounts; bounded by the number of
 * entries in one session's history, at two numbers each.
 */
const positions = new Map<string, Offsets>()

/**
 * Query params that mean "a deep link chose where this page opens".
 *
 * Both are stripped from the URL once their target is on screen (see
 * Timeline.tsx), which is a same-pathname REPLACE — handled by the
 * same-pathname guard below, not by this.
 */
const FOCUS_PARAMS = [TIMELINE_FOCUS_PARAM, SELECTORS_CAMPAIGN_PARAM]

function readOffsets(): Offsets {
	const app = document.querySelector<HTMLElement>(APP_SCROLLER_SELECTOR)
	return { doc: window.scrollY, app: app ? app.scrollTop : 0 }
}

function applyOffsets(offsets: Offsets): void {
	window.scrollTo(0, offsets.doc)
	const app = document.querySelector<HTMLElement>(APP_SCROLLER_SELECTOR)
	if (app) app.scrollTop = offsets.app
}

function hasFocusTarget(search: string): boolean {
	const params = new URLSearchParams(search)
	return FOCUS_PARAMS.some((name) => params.has(name))
}

// The build-time render (entry-server.ts) runs this component tree through
// renderToString, where React warns that useLayoutEffect does nothing. Neither
// effect runs on the server, so swapping the import is the whole fix.
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

/**
 * Call once, from a component inside the router that never unmounts (App).
 */
export function useScrollReset(): void {
	const { key, pathname, search, hash } = useLocation()
	const navigationType = useNavigationType()

	// Where the reader currently is, sampled as they scroll...
	const latest = useRef<Offsets>(TOP)
	// ...and which entry that sample belongs to, so it can be filed under the
	// page being LEFT rather than the one arriving.
	const liveKey = useRef(key)
	const livePathname = useRef(pathname)

	useEffect(() => {
		// Writes a ref, never state, so there is nothing to throttle: this costs a
		// property assignment per scroll event and re-renders nothing.
		const sample = (): void => {
			latest.current = readOffsets()
		}

		// `capture: true` is load-bearing, for the reason spelled out in
		// useBackToTop: scroll events do not bubble, so a plain window listener
		// would hear the document and go permanently silent on desktop, where an
		// inner div is what moves. The capture phase still runs window -> target
		// for a non-bubbling event.
		window.addEventListener("scroll", sample, { passive: true, capture: true })
		return () => window.removeEventListener("scroll", sample, { capture: true })
	}, [])

	useIsomorphicLayoutEffect(() => {
		// File the outgoing entry's position before this one takes over. Taken from
		// the live sample rather than measured now: by the time this runs the new
		// route has already rendered, and a shorter page will have clamped the
		// number we wanted to save.
		if (liveKey.current !== key) {
			positions.set(liveKey.current, latest.current)
		}
		const previousPathname = livePathname.current
		liveKey.current = key
		livePathname.current = pathname

		// Back/forward: return to where this entry was left. Nothing saved means
		// the first entry of the session, which the browser has already placed.
		if (navigationType === "POP") {
			const saved = positions.get(key)
			if (!saved) return
			latest.current = saved
			applyOffsets(saved)
			// Re-applied one frame later for content that lays out late: the
			// Timeline renders a single window of rows first, so the first attempt
			// gets clamped against a page still shorter than it is about to be.
			const frame = requestAnimationFrame(() => applyOffsets(saved))
			return () => cancelAnimationFrame(frame)
		}

		// A deep link owns its own landing — #hash anchors on /faq and the guide,
		// ?focus= / ?campaign= on the timeline and selectors. Yanking those to the
		// top is exactly the regression this hook must not introduce.
		if (hash !== "" || hasFocusTarget(search)) return

		// Same page, different query string: a page rewriting its own URL (the
		// focus-param strip) is not a navigation the reader made. This is also
		// what makes the first render a no-op, since there is no previous page.
		if (pathname === previousPathname) return

		// Kept in step with the DOM so the next stash records the top rather than
		// the offset of whatever page was open before this one.
		latest.current = TOP
		applyOffsets(TOP)
	}, [key, navigationType, pathname, search, hash])
}
