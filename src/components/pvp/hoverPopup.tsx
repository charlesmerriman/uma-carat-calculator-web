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
export function useHoverPopup(placement: Placement, { onOpenChange, interactive = false, tap = true }: HoverPopupOptions = {}) {
	const [open, setOpenState] = useState(false)
	const setOpen = (next: boolean) => {
		setOpenState(next)
		onOpenChange?.(next)
	}
	const reducedMotion = useReducedMotion()
	const { refs, floatingStyles, context } = useFloating({
		open,
		onOpenChange: setOpen,
		placement,
		middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
		whileElementsMounted: autoUpdate,
	})
	const { getReferenceProps, getFloatingProps } = useInteractions([
		useHover(context, {
			mouseOnly: true,
			delay: { open: HOVER_OPEN_DELAY_MS },
			// safePolygon keeps it open while the pointer crosses the gap
			// between the tile and the popup, and closes it the moment the
			// pointer heads anywhere else.
			handleClose: interactive ? safePolygon() : undefined,
		}),
		useFocus(context, { visibleOnly: true }),
		// Escape, or a tap anywhere else, closes it.
		useDismiss(context),
	])
	// A short fade in and out; none for a reader who asked for less motion.
	const { isMounted, styles } = useTransitionStyles(context, { duration: reducedMotion ? 0 : 150 })
	const referenceProps = {
		ref: refs.setReference,
		...getReferenceProps({
			// A touch screen has no hover, and a tap's focus isn't
			// :focus-visible, so a tap toggles it.
			onPointerUp(event) {
				if (tap && event.pointerType === "touch") setOpen(!open)
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
					{...(interactive ? getFloatingProps() : {})}
					className={`z-50 max-w-[80vw] rounded-lg border border-gray-600 bg-gray-900 p-2 text-left text-xs leading-snug text-gray-200 shadow-lg ${
						interactive ? "" : "pointer-events-none"
					} ${widthClassName}`}
				>
					<InsidePopupContext.Provider value={true}>
						<InsideHoverContext.Provider value={true}>{content}</InsideHoverContext.Provider>
					</InsidePopupContext.Provider>
				</div>
			</FloatingPortal>
		)
	return { referenceProps, popup }
}
