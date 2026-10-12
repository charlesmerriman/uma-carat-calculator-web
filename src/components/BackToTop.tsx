import { ArrowUp } from "lucide-react"

/**
 * The two faces of "back to top", both driven by hooks/useBackToTop.
 *
 * They are separate components rather than one with a `variant` prop because
 * they sit in different places in the tree: the inline button belongs inside a
 * page's own controls bar, styled to match the buttons already there, while the
 * floating one is positioned against the viewport and has to be a child of the
 * page root. A single component could not be rendered in both places at once,
 * which is exactly what a page with a bar that only pins on desktop needs.
 */

const LABEL = "Back to top"

type BackToTopButtonProps = {
	onClick: () => void
	/** True when the reader is already at the top — see BACK_TO_TOP_THRESHOLD_PX. */
	disabled: boolean
	/**
	 * The caller's own control styling. This button is meant to read as one more
	 * control in an existing bar, and every bar styles its own; passing the class
	 * in beats exporting a look that each caller then has to override.
	 */
	className?: string
}

/**
 * The arrow as a control inside a page's toolbar.
 *
 * Disabled rather than unmounted at the top of the page, matching the Previous /
 * Next buttons it sits alongside: a control that vanishes reflows the whole bar
 * under the reader's cursor the moment they scroll.
 */
export const BackToTopButton = ({ onClick, disabled, className = "" }: BackToTopButtonProps) => (
	<button
		type="button"
		className={className}
		onClick={onClick}
		disabled={disabled}
		aria-label={LABEL}
		title={LABEL}
	>
		<ArrowUp className="h-4 w-4 text-brand" />
	</button>
)

/**
 * Where the floating arrow sits horizontally, keyed by the width of the page's
 * centred content column.
 *
 * `right-6` alone pins it to the viewport edge, and on a wide monitor that is a
 * long way from the column: the arrow reads as part of the screen rather than
 * part of the page. These park it just outside the column's right edge instead.
 * Half the viewport width left over after the column is the column's margin;
 * take off the button's own 3rem plus a gap and that is the offset. `max()`
 * keeps it 1.5rem inside the viewport once the margin is too narrow to hold it,
 * which is the old placement and the right one on a laptop.
 *
 * Measured off `100vw` rather than the scroller, so on desktop a classic
 * scrollbar (Windows, Linux) eats about half its width out of the gap. The gap
 * is sized with that in mind; it is not worth a measurement to get exact.
 *
 * Literal class strings rather than one built from the width, because Tailwind
 * only emits a class it can read whole from the source.
 */
const FLOATING_POSITION = {
	/** The Changelog and FAQ pages (`max-w-3xl`). */
	"48rem": "right-[max(1.5rem,calc((100vw-48rem)/2-4.5rem))]",
	/** The Legend Races page (`max-w-5xl`). */
	"64rem": "right-[max(1.5rem,calc((100vw-64rem)/2-4.5rem))]",
	/** `page-container` pages: the Timeline and Selectors. */
	"96rem": "right-[max(1.5rem,calc((100vw-96rem)/2-4.5rem))]",
	/** The home page. */
	"104rem": "right-[max(1.5rem,calc((100vw-104rem)/2-4.5rem))]",
} as const

type FloatingBackToTopProps = {
	onClick: () => void
	/** Whether to show it at all — false leaves it mounted but inert. */
	visible: boolean
	/** The page's content column, which the arrow sits beside. See FLOATING_POSITION. */
	column: keyof typeof FLOATING_POSITION
	/** Extra classes for the caller's breakpoint needs. */
	className?: string
}

/**
 * The arrow as a floating button over the content.
 *
 * `z-40` deliberately: above the page and any sticky toolbar (z-30), below
 * Sonner's toasts and the modal pickers (z-[9999] / z-[10000]). A toast covering
 * this for a few seconds is the correct reading of that stack — the toast is the
 * thing that just happened.
 *
 * Kept mounted and faded rather than unmounted, so the fade can play in both
 * directions; `pointer-events-none` while hidden means an invisible button can
 * never eat a click meant for the card underneath it.
 */
export const FloatingBackToTop = ({ onClick, visible, column, className = "" }: FloatingBackToTopProps) => (
	<button
		type="button"
		className={`fixed bottom-6 ${FLOATING_POSITION[column]} z-40 inline-flex h-12 w-12 items-center justify-center rounded-full border border-gray-600 bg-gray-800/95 text-gray-100 shadow-lg backdrop-blur-sm transition hover:border-gray-500 hover:bg-gray-700 ${
			visible ? "opacity-100" : "pointer-events-none opacity-0"
		} ${className}`}
		onClick={onClick}
		// Hidden from assistive tech while faded out: it is not reachable by
		// pointer either, and a focusable button announcing itself from behind
		// zero opacity is a tab stop that goes nowhere.
		aria-hidden={!visible}
		tabIndex={visible ? undefined : -1}
		aria-label={LABEL}
		title={LABEL}
	>
		<ArrowUp className="h-5 w-5 text-brand" />
	</button>
)
