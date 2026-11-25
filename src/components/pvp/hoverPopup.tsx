/**
 * The popup behind every hover detail: a guide's tiles, chips and mentions
 * (PvpTiles.tsx) and the Encyclopedia's skill rows (encyclopedia/SkillHover.tsx).
 * Lifted out of PvpTiles.tsx in the Encyclopedia's visual overhaul so both can
 * draw the same skill card; nothing about how a guide's popups behave changed
 * except `interactive`, below.
 */

import { createContext, useEffect, useState, type ReactNode } from "react"
import {
	autoUpdate,
	flip,
	FloatingPortal,
	offset,
	safePolygon,
	shift,
	size,
	useDismiss,
	useFloating,
	useFocus,
	useHover,
	useInteractions,
	useTransitionStyles,
	type Placement,
	type Middleware,
	type ReferenceElement,
} from "@floating-ui/react"
import { useReducedMotion } from "framer-motion"

/**
 * True inside a tile or chip that has a hover detail (WithDetail), on its face
 * and in its detail alike. Tailwind's `group-hover:` answers to ANY hovered
 * `.group` above it, not the nearest, so a [[mention]] in a tile's note opened
 * its own popup the moment the tile was hovered, drawn over the tile's: two
 * at once for "Activate [[A]] with [[B]]" (2026-11-02). A mention on a chip's
 * face did the same. Inside one, a mention draws its pill alone, and the
 * detail lists what the note names at its bottom (MentionedSkills).
 */
export const InsideHoverContext = createContext(false)

/**
 * True only inside the drawn popup, never in the screen reader's copy. The
 * popup is `aria-hidden` (its words are already in that copy), so a link
 * inside it takes clicks but stays out of the Tab order: the copy's own link
 * is the one a keyboard reaches.
 */
export const InsidePopupContext = createContext(false)

/**
 * Inside a drawn popup: HOLDS it. The popup stays on the side and at the
 * corner it opened at (no flip), stays open when the pointer leaves, and
 * scrolls inside itself when what it shows grows. For content that changes
 * under the reader's click: a skill card's name turning the popup into her
 * card (SkillDetail, Henry's board post, 2026-11-19). Unheld, a taller card
 * flipped above the chip, ran off the window and left the pointer on the next
 * chip, which opened a second popup (the canvas mock, 2026-11-20). Null
 * outside a popup.
 */
export const PopupHoldContext = createContext<(() => void) | null>(null)

// How long the pointer rests on a tile before its popup opens, so a mouse
// crossing a grid of skills doesn't flash a popup per cell. Focus and a tap
// open it at once.
const HOVER_OPEN_DELAY_MS = 120

/**
 * SCROLLING. A list scrolled under a still mouse slides tile after tile
 * under the pointer, and the browser counts each as the pointer entering it.
 * The popups opened on those, and the one left open followed its tile out of
 * the window (Daptrius, board "Extra Scroll Bar on the Skills page",
 * 2026-11-25). So a popup the pointer opened closes when anything under it
 * scrolls (useDismiss's `ancestorScroll`), and the pointer "entering" a tile
 * within SCROLL_QUIET_MS of a scroll opens nothing. Moving the mouse onto a
 * tile once the list has stopped opens it as before.
 *
 * One listener for the whole page (capture: a scroll doesn't bubble, and the
 * desktop shell scrolls an inner box), added the first time a popup is built.
 */
const SCROLL_QUIET_MS = 150
let lastScrollAt = Number.NEGATIVE_INFINITY
let hearingScrolls = false

function hearScrolls(): void {
	if (hearingScrolls || typeof window === "undefined") return
	hearingScrolls = true
	window.addEventListener("scroll", () => {
		lastScrollAt = performance.now()
	}, { capture: true, passive: true })
}

function scrolledJustNow(): boolean {
	return performance.now() - lastScrollAt < SCROLL_QUIET_MS
}

/**
 * WHERE AN UMA'S OR A SUPPORT CARD'S FULL CARD GOES (components/hovercards):
 * beside its tile, its top level with the tile's. One rule for the app's
 * shared popup (HoverCardLayer) and a guide tile's pinned one (`pinTo`).
 *
 *   - right of the tile, else left. `crossAxis: false` makes the room BESIDE
 *     the tile the only thing that picks the side. Left on, Floating UI also
 *     asks whether the whole card fits below the tile's top; when no side
 *     passed, it took its best guess among all four, and in a narrow window
 *     that was above or below the tile, squeezed into the height left over.
 *     (Measured 2026-11-18: beside a small picture in a wide window the old
 *     list and this one put the card in the same place. What differs is the
 *     narrow window, and that this list can never choose above or below.)
 *   - then slid along the tile's edge until it is inside the window.
 *     `crossAxis: true` covers a window too narrow for either side: the card
 *     stays on screen and overlaps the tile instead of leaving the window.
 *
 * The box is never taller than the window (CARD_POPUP_BOX) and scrolls inside
 * itself, so the slide always has room to work.
 */
export const CARD_POPUP_PLACEMENT: Placement = "right-start"
export const cardPopupMiddleware = () => [
	offset(8),
	flip(() => ({ crossAxis: false, fallbackPlacements: ["left-start"], padding: popupEdges() })),
	shift(() => ({ crossAxis: true, padding: popupEdges() })),
	// The box's height limit, less the ad and the pinned top bars (CARD_POPUP_BOX's own limit can't
	// know it). A card that grows shorter here is measured again by Floating
	// UI before the slide above runs on it.
	size({
		apply({ elements }) {
			elements.floating.style.maxHeight = `calc(100dvh - 1rem - ${footerAdInset() + topBarsInset()}px)`
		},
	}),
]

/**
 * RAPTIVE'S STICKY FOOTER AD (notes/raptive-install-plan.md) is fixed to the
 * bottom of the window at z-index 1000001: 50px tall on a phone, 90px on a
 * computer (measured on the live site, 2026-11-19). A card is often taller
 * than the room under its tile, so it slides down to the window's bottom
 * edge, and its foot ("Open Encyclopedia") ended up under the ad: a tap or a
 * click there opened the ad (Daptrius, 2026-11-19).
 *
 * The popups keep clear of it instead of drawing over it: covering an ad
 * breaks the ad network's rules. Read on every positioning, because the ad
 * loads late, changes size and can be closed. The selector is the one
 * BackToTop and index.css already dodge.
 */
const FOOTER_AD = ".adthrive-sticky.adthrive-footer"

/** How much of the window's bottom the footer ad covers, in px; 0 when there is none. */
function footerAdInset(): number {
	if (typeof document === "undefined") return 0
	const ad = document.querySelector(FOOTER_AD)
	if (!ad) return 0
	const box = ad.getBoundingClientRect()
	// A closed or hidden ad measures 0 tall (and its top reads 0, which must
	// not count as covering the whole window).
	if (box.height === 0) return 0
	return Math.max(0, Math.min(box.height, window.innerHeight - box.top))
}

/**
 * THE BARS PINNED ACROSS THE TOP: the navbar's pinned row, a screen's bar
 * (ScreenTabs) and anything else that marks itself `data-popup-top-bar`. A
 * pinned card is placed level with its row, and its row scrolls up under
 * those bars, so the card used to slide over the menus with it (Daptrius,
 * board "Skills Pop-Up Clipping into the Top Menus", 2026-11-25). The popups
 * keep below them instead, and a card whose row has gone under them hides
 * until the row comes back (`hideUnderTopBars`).
 *
 * The stack starts at the navbar's pinned part, whatever sits above it: on a
 * phone the wordmark row shows above the places row after a scroll up
 * (hooks/useNavbarReveal.ts), and it isn't marked, so a stack started at the
 * window's edge never began. Below it, a bar counts only while it touches the
 * stack: one further down the page, not stuck yet, doesn't. Read on every
 * positioning, like the footer ad, since the wordmark row comes and goes.
 */
const NAVBAR = "[data-sticky-navbar]"
const TOP_BARS = "[data-screen-tabs], [data-popup-top-bar]"

/** How far down from the window's top the pinned bars reach, in px; 0 with none. */
function topBarsInset(): number {
	if (typeof document === "undefined") return 0
	const navbar = [...document.querySelectorAll(NAVBAR)].map((bar) => bar.getBoundingClientRect()).filter((box) => box.height > 0)
	const boxes = [...document.querySelectorAll(TOP_BARS)]
		.map((bar) => bar.getBoundingClientRect())
		.filter((box) => box.height > 0)
		.sort((a, b) => a.top - b.top)
	let inset = Math.max(0, ...navbar.map((box) => box.bottom))
	for (const box of boxes) {
		// Touching the stack so far (a pixel's rounding allowed), and reaching past it.
		if (box.top <= inset + 1 && box.bottom > inset) inset = box.bottom
	}
	return inset
}

/** The edges a popup stays inside: 8px from the window's, below the pinned top bars and above the footer ad. */
export function popupEdges() {
	return { top: 8 + topBarsInset(), right: 8, left: 8, bottom: 8 + footerAdInset() }
}

/**
 * Hides a popup while its tile is out of sight: wholly under the pinned top
 * bars, or below the window (above the footer ad). `shift` would otherwise
 * keep the card on screen with nothing beside it. A pinned card stays
 * pinned and shows again when its tile scrolls back.
 */
const hideUnderTopBars = (): Middleware => ({
	name: "hideUnderTopBars",
	fn({ elements }) {
		const box = elements.reference.getBoundingClientRect()
		const hidden = box.bottom <= topBarsInset() || box.top >= window.innerHeight - footerAdInset()
		return { data: { hidden } }
	},
})

// How often an open popup checks where the footer ad is.
const AD_CHECK_MS = 250

/**
 * Places an open popup again whenever the footer ad arrives, moves, changes
 * size or goes. Reading the ad on each positioning isn't enough on its own:
 * Raptive slides the ad in a while after the page loads (often on the first
 * scroll), and nothing tells Floating UI, so a card opened before it stayed
 * under it (seen in WebKit, 2026-11-19).
 *
 * WHY A TIMER AND NOT AN OBSERVER: the first build watched <body> for the ad
 * being added and the ad for a change of size. It missed about half the time
 * in WebKit, because Raptive can also bring the ad in by moving it or by
 * changing its classes, which neither observer hears, and its markup is
 * theirs to change. Asking "how much does the ad cover now?" four times a
 * second catches every way it can arrive. It runs only while a popup is open,
 * and each check is one lookup and one measurement; the popup is placed again
 * only when the answer changes.
 */
export function watchFooterAd(update: () => void): () => void {
	if (typeof window === "undefined") return () => {}
	let covered = footerAdInset()
	const timer = window.setInterval(() => {
		const now = footerAdInset()
		if (now === covered) return
		covered = now
		update()
	}, AD_CHECK_MS)
	return () => window.clearInterval(timer)
}

/** Floating UI's autoUpdate, plus a fresh placement when the footer ad comes, resizes or goes. */
export function autoUpdateClearOfAds(reference: ReferenceElement, floating: HTMLElement, update: () => void): () => void {
	const stopFollowing = autoUpdate(reference, floating, update)
	const stopWatching = watchFooterAd(update)
	return () => {
		stopFollowing()
		stopWatching()
	}
}
export const CARD_POPUP_BOX = "max-h-[calc(100dvh-1rem)] w-80 max-w-[calc(100vw-1rem)] overflow-y-auto"

export interface HoverPopupOptions {
	/** Hears every open and close (a skill's card lights the course map). */
	onOpenChange?: (open: boolean) => void
	/**
	 * The popup holds something to click (a skill card's "Open Encyclopedia"), so
	 * the pointer may travel from the tile into it without it closing, and it
	 * takes clicks. Off by default: a popup that ignores the pointer never
	 * blocks the tiles under it.
	 */
	interactive?: boolean
	/**
	 * A tap on a touch screen toggles it (the default). False where the tile
	 * is itself a link: the tap should follow the link, not open a card over it.
	 */
	tap?: boolean
	/**
	 * A tall popup, an uma's or a card's hover card (components/hovercards):
	 * it may flip to any side and shift to stay on screen, and when the window
	 * is shorter than the card it scrolls inside itself. Without this, a card
	 * flipped above a tile ran off the top of the window (2026-11-17).
	 */
	fit?: boolean
	/**
	 * A tap is the ONLY way in: hover and keyboard focus never open it. For a
	 * tile whose click already opens the site's shared card on a computer
	 * (HoverCardLayer, which ignores touch), so a phone still gets something
	 * and a computer never gets two popups (the story event row, 2026-11-17).
	 */
	tapOnly?: boolean
	/**
	 * A mouse click on the tile PINS the popup: it moves to the full card's
	 * place (CARD_POPUP_PLACEMENT), stays open when the pointer leaves, and
	 * closes on a second click, a click elsewhere or Escape. The hook answers
	 * `pinned`, and the caller draws something fuller while it is true: a
	 * guide tile's hover shows the guide's note, and a click turns it into the
	 * uma's or the card's full card (owner, 2026-11-18: the cards open on a
	 * click, never on hover). A tap pins too, so a phone opens the full card
	 * in one tap as it did before.
	 */
	pin?: boolean
	/**
	 * False: the pointer resting on the tile opens nothing; focus, a tap and
	 * a click still do. For a tile whose click card already holds everything
	 * its hover showed: a guide's uma tile (Daptrius, 2026-11-19, "kill this
	 * on hover popup, since it is in the on tap popup").
	 */
	hover?: boolean
}

/**
 * The popup of a hover detail (WithDetail, SkillMention): opened by hover,
 * keyboard focus (`:focus-visible` only, as before) or a tap on a touch
 * screen, and drawn in a portal on <body> by Floating UI (2026-11-02).
 *
 * Why a portal: drawn inside its tile, a popup could rise only as high as the
 * tile's stacking context, and the guide makes several. The General skills
 * column is `position: sticky` and each deck cell is a framer-motion `layout`
 * box, so a popup from that column slid under the cards beside it (the
 * owner's "Perfect Spot!" screenshot). On <body> nothing covers it. Floating
 * UI also opens it above when there's no room below (`flip`), keeps it on
 * screen (`shift`) and follows the tile while the page scrolls (`autoUpdate`,
 * only while it's open).
 *
 * The popup is in the DOM only while open, so it is `aria-hidden`: the
 * screen reader's copy is the caller's `sr-only` element, always in the DOM
 * and named by `aria-describedby`, as the old in-place popup was.
 */
export function useHoverPopup(
	placement: Placement,
	{ onOpenChange, interactive = false, tap = true, fit = false, tapOnly = false, pin = false, hover = true }: HoverPopupOptions = {}
) {
	const [open, setOpenState] = useState(false)
	const [pinned, setPinned] = useState(false)
	// Held (PopupHoldContext): the placement it had when held, else null.
	const [held, setHeld] = useState<Placement | null>(null)
	// In an effect: the prerender builds these with no window.
	useEffect(hearScrolls, [])
	// Opened by the pointer resting on the tile (Floating UI's "hover" reason),
	// as opposed to focus, a tap or a click: only that kind closes on a scroll.
	const [byHover, setByHover] = useState(false)
	const setOpen = (next: boolean) => {
		setOpenState(next)
		if (!next) {
			setPinned(false)
			setHeld(null)
			setByHover(false)
		}
		onOpenChange?.(next)
	}
	// Floating UI's own opens and closes. A hover that a SCROLL caused (rows
	// sliding under a still mouse) is refused: see "SCROLLING" above.
	const changeFromFloating = (next: boolean, _event?: Event, reason?: string) => {
		if (next && reason === "hover" && scrolledJustNow()) return
		if (next) setByHover(reason === "hover")
		setOpen(next)
	}
	// A pinned or held popup holds links, so it takes the pointer like an interactive one.
	const takesPointer = interactive || pinned || held !== null
	// What the last press on the tile came from: only a mouse's click pins.
	// State, not a ref: the handlers below are built during render.
	const [pressedWith, setPressedWith] = useState("")
	const reducedMotion = useReducedMotion()
	const { refs, floatingStyles, context, placement: shownPlacement, middlewareData } = useFloating({
		open,
		onOpenChange: changeFromFloating,
		// Fixed to the window, never absolute in <body>: an absolute popup that
		// followed its tile below the window's edge made the DOCUMENT taller, and
		// the desktop shell (whose page scrolls in its own box) grew a second
		// scroll bar for as long as the card was open (Daptrius, board "Extra
		// Scroll Bar on the Skills page", 2026-11-25). A fixed one past the edge
		// is only cut off.
		strategy: "fixed",
		placement: held ?? (pinned ? CARD_POPUP_PLACEMENT : placement),
		// Every kind ends with the check that hides it while its tile is out of sight.
		middleware: [...(held
			? [
					offset(4),
					// Kept on screen sideways only: no flip, so it never jumps to the other side.
					shift(() => ({ crossAxis: false, padding: popupEdges() })),
					size(() => ({
						padding: popupEdges(),
						apply({ availableHeight, elements }) {
							elements.floating.style.maxHeight = `${Math.max(160, Math.floor(availableHeight))}px`
						},
					})),
				]
			: pinned
			? cardPopupMiddleware()
			: fit
			? [
					offset(6),
					flip(() => ({ fallbackPlacements: ["left-start", "bottom-start", "top-start"], padding: popupEdges() })),
					shift(() => ({ padding: popupEdges() })),
					size(() => ({
						padding: popupEdges(),
						apply({ availableHeight, elements }) {
							elements.floating.style.maxHeight = `${Math.max(160, Math.floor(availableHeight))}px`
						},
					})),
				]
			: [offset(4), flip(() => ({ padding: popupEdges() })), shift(() => ({ padding: popupEdges() }))]), hideUnderTopBars()],
		whileElementsMounted: autoUpdateClearOfAds,
	})
	const outOfSight = middlewareData.hideUnderTopBars?.hidden === true
	// A PINNED popup answers only to the click that pinned it, Escape and a
	// press elsewhere (useDismiss). Hover and focus are switched off for as
	// long as it is pinned: left on, the pointer leaving the card closed it,
	// and so did a click on the card's own text, which takes the focus the
	// pin's click gave the tile.
	const hovers = !tapOnly && !pinned && held === null
	const { getReferenceProps, getFloatingProps } = useInteractions([
		useHover(context, {
			enabled: hovers && hover,
			mouseOnly: true,
			// Where a click pins, only ENTERING the tile opens the hover note:
			// with the default, the note came back at the pointer's next twitch
			// after a second click had closed the card.
			move: !pin,
			delay: { open: HOVER_OPEN_DELAY_MS },
			// safePolygon keeps it open while the pointer crosses the gap
			// between the tile and the popup, and closes it the moment the
			// pointer heads anywhere else.
			handleClose: interactive ? safePolygon() : undefined,
		}),
		useFocus(context, { enabled: hovers, visibleOnly: true }),
		// Escape, or a tap anywhere else, closes it. So does a scroll, for a
		// popup the resting pointer opened ("SCROLLING" above); one opened by a
		// click, a tap or the keyboard stays (a Tab's own scroll-into-view would
		// otherwise close the popup it just opened).
		useDismiss(context, { ancestorScroll: byHover && !pinned && held === null }),
	])
	// A short fade in and out; none for a reader who asked for less motion.
	const { isMounted, styles } = useTransitionStyles(context, { duration: reducedMotion ? 0 : 150 })
	const referenceProps = {
		ref: refs.setReference,
		...getReferenceProps({
			onPointerDown(event) {
				setPressedWith(event.pointerType)
			},
			// A touch screen has no hover, and a tap's focus isn't
			// :focus-visible, so a tap toggles it.
			onPointerUp(event) {
				if (!tap || event.pointerType !== "touch") return
				// A tap INSIDE the drawn popup lands here too: React bubbles a
				// portal's events through the component tree, and WithDetail
				// draws its popup inside the tile. Toggling then closed the card
				// under the finger, and the browser's click, which comes after
				// the finger lifts, fell through to the page behind it (a guide
				// card's "Open Encyclopedia" did nothing on a phone, 2026-11-19).
				if (!(event.target instanceof Node && event.currentTarget.contains(event.target))) return
				if (pin && !open) setPinned(true)
				setOpen(!open)
			},
			onClick(event) {
				// Only a real mouse click on the tile itself: not a tap (above),
				// not Enter, and not a click inside the popup, which React
				// bubbles here through the portal.
				const onTile = event.target instanceof Node && event.currentTarget.contains(event.target)
				if (!pin || !onTile || event.detail === 0 || pressedWith !== "mouse") return
				if (pinned) {
					setOpen(false)
				} else {
					setPinned(true)
					if (!open) setOpen(true)
				}
			},
		}),
	}
	const hold = () => setHeld((was) => was ?? shownPlacement)
	const popup = (content: ReactNode, widthClassName: string) =>
		isMounted && (
			<FloatingPortal>
				<div
					ref={refs.setFloating}
					aria-hidden="true"
					style={{ ...floatingStyles, ...styles, ...(outOfSight ? { visibility: "hidden" } : {}) }}
					{...(takesPointer ? getFloatingProps() : {})}
					className={`z-50 rounded-lg border border-gray-600 bg-gray-900 p-2 text-left text-xs leading-snug text-gray-200 shadow-lg ${
						takesPointer ? "" : "pointer-events-none"
					} ${pinned ? CARD_POPUP_BOX : `max-w-[80vw] ${fit || held ? "overflow-y-auto" : ""} ${widthClassName}`}`}
				>
					<InsidePopupContext.Provider value={true}>
						<PopupHoldContext.Provider value={hold}>
							<InsideHoverContext.Provider value={true}>{content}</InsideHoverContext.Provider>
						</PopupHoldContext.Provider>
					</InsidePopupContext.Provider>
				</div>
			</FloatingPortal>
		)
	return { referenceProps, popup, pinned }
}
