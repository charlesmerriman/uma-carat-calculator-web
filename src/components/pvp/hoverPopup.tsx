/**
 * The popup behind every hover detail: a guide's tiles, chips and mentions
 * (PvpTiles.tsx) and the Encyclopedia's skill rows (encyclopedia/SkillHover.tsx).
 * Lifted out of PvpTiles.tsx in the Encyclopedia's visual overhaul so both can
 * draw the same skill card; nothing about how a guide's popups behave changed
 * except `interactive`, below.
 */

import { createContext, useState, type ReactNode } from "react"
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

// How long the pointer rests on a tile before its popup opens, so a mouse
// crossing a grid of skills doesn't flash a popup per cell. Focus and a tap
// open it at once.
const HOVER_OPEN_DELAY_MS = 120

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
	flip({ crossAxis: false, fallbackPlacements: ["left-start"], padding: 8 }),
	shift({ crossAxis: true, padding: 8 }),
]
export const CARD_POPUP_BOX = "max-h-[calc(100dvh-1rem)] w-80 max-w-[calc(100vw-1rem)] overflow-y-auto"

export interface HoverPopupOptions {
	/** Hears every open and close (a skill's card lights the course map). */
	onOpenChange?: (open: boolean) => void
	/**
	 * The popup holds something to click (a skill card's "Open its page"), so
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
	{ onOpenChange, interactive = false, tap = true, fit = false, tapOnly = false, pin = false }: HoverPopupOptions = {}
) {
	const [open, setOpenState] = useState(false)
	const [pinned, setPinned] = useState(false)
	const setOpen = (next: boolean) => {
		setOpenState(next)
		if (!next) setPinned(false)
		onOpenChange?.(next)
	}
	// A pinned popup holds links, so it takes the pointer like an interactive one.
	const takesPointer = interactive || pinned
	// What the last press on the tile came from: only a mouse's click pins.
	// State, not a ref: the handlers below are built during render.
	const [pressedWith, setPressedWith] = useState("")
	const reducedMotion = useReducedMotion()
	const { refs, floatingStyles, context } = useFloating({
		open,
		onOpenChange: setOpen,
		placement: pinned ? CARD_POPUP_PLACEMENT : placement,
		middleware: pinned
			? cardPopupMiddleware()
			: fit
			? [
					offset(6),
					flip({ fallbackPlacements: ["left-start", "bottom-start", "top-start"], padding: 8 }),
					shift({ padding: 8 }),
					size({
						padding: 8,
						apply({ availableHeight, elements }) {
							elements.floating.style.maxHeight = `${Math.max(160, Math.floor(availableHeight))}px`
						},
					}),
				]
			: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
		whileElementsMounted: autoUpdate,
	})
	// A PINNED popup answers only to the click that pinned it, Escape and a
	// press elsewhere (useDismiss). Hover and focus are switched off for as
	// long as it is pinned: left on, the pointer leaving the card closed it,
	// and so did a click on the card's own text, which takes the focus the
	// pin's click gave the tile.
	const hovers = !tapOnly && !pinned
	const { getReferenceProps, getFloatingProps } = useInteractions([
		useHover(context, {
			enabled: hovers,
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
		// Escape, or a tap anywhere else, closes it.
		useDismiss(context),
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
	const popup = (content: ReactNode, widthClassName: string) =>
		isMounted && (
			<FloatingPortal>
				<div
					ref={refs.setFloating}
					aria-hidden="true"
					style={{ ...floatingStyles, ...styles }}
					{...(takesPointer ? getFloatingProps() : {})}
					className={`z-50 rounded-lg border border-gray-600 bg-gray-900 p-2 text-left text-xs leading-snug text-gray-200 shadow-lg ${
						takesPointer ? "" : "pointer-events-none"
					} ${pinned ? CARD_POPUP_BOX : `max-w-[80vw] ${fit ? "overflow-y-auto" : ""} ${widthClassName}`}`}
				>
					<InsidePopupContext.Provider value={true}>
						<InsideHoverContext.Provider value={true}>{content}</InsideHoverContext.Provider>
					</InsidePopupContext.Provider>
				</div>
			</FloatingPortal>
		)
	return { referenceProps, popup, pinned }
}
