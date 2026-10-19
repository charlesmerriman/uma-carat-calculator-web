import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { createPortal } from "react-dom"
import type { CountChip, CountChipSet } from "../../utils/countChips"

/**
 * The pad is sized by its CONTENT, not to a fixed width — `width: max-content`
 * capped at the viewport. The row runs from two chips (the copies field's
 * "−1 +1") to five (an uma's "−100 −10 +10 +100 | Next pity"), and a fixed
 * width that fits the widest would leave the narrowest padded out with dead
 * space.
 *
 * The cap is what keeps it honest on a phone: below ~330px of viewport the row
 * wraps to two rather than running off the edge, which is why the chip row is
 * `flex-wrap`. Costs nothing on the layout either way — the pad is portal'd, so
 * it never competes with the banner table's width budget.
 *
 * Placement therefore measures WIDTH as well as height. This is only used if
 * that measurement is somehow unavailable.
 */
const PANEL_FALLBACK_WIDTH = 300
/** Gap between the field and the panel (room for the caret), and the panel and the viewport edge. */
const GAP = 8
const EDGE = 8
/** How close the caret may get to the pad's rounded corners. */
const CARET_INSET = 12

type Placement = "below" | "above"

interface CountStepperProps {
	value: number
	onChange: (next: number) => void
	chips: CountChipSet
	/** "Pulls" / "Steps" — names the pad to a screen reader. No longer rendered:
	 * the pad sits against the field it adjusts, which is already labelled. */
	label: string
	/** The NumberField this pad drives. Rendered above the trigger. */
	children: ReactNode
	/**
	 * Open above the field when there is room, rather than below. The planner's
	 * last row sets it: below that row there is only the sheet's bottom edge, so
	 * a pad hanging under it covered the footer instead of anything it adjusts.
	 */
	preferAbove?: boolean
}

/**
 * A bulk-adjust pad for the planner's pull/step field.
 *
 * WHY A PORTAL, and not the `relative` + `absolute` idiom SettingsMenu uses:
 * this pad opens from inside the banner sheet, and the sheet is wrapped in an
 * `overflow-hidden` panel (CaratCalculator) whose rows are `motion.div`s
 * carrying `layout` transforms. In-flow, the pad would be clipped at the panel's
 * bottom edge on the last row, and a `position: fixed` fallback would resolve
 * against the transformed row rather than the viewport. A portal to <body>
 * plus a rect measured from the anchor sidesteps both, at the cost of having to
 * re-place on scroll.
 *
 * WHY FOCUS IS THE ONLY TRIGGER: the pad is meant to save a click, not add one,
 * and focusing the field is something you were already doing to type in it — on
 * touch as much as with a mouse. It carried a chevron button underneath at
 * first, which bought discoverability at the price of pushing the input out of
 * line with the row's other bordered boxes on EVERY row, permanently, to
 * advertise something learned once. The field keeps its place instead.
 *
 * Chips suppress mousedown so focus never leaves the input, which is what lets
 * you click four of them in a row and keep arrow-keying afterwards.
 */
export const CountStepper = ({
	value,
	onChange,
	chips,
	label,
	children,
	preferAbove = false,
}: CountStepperProps) => {
	const [open, setOpen] = useState(false)
	const [position, setPosition] = useState<{
		left: number
		top: number
		placement: Placement
		/** The caret's x inside the pad, pointing at the field's centre. */
		caretLeft: number
	} | null>(null)
	const anchorRef = useRef<HTMLDivElement>(null)
	const panelRef = useRef<HTMLDivElement>(null)

	const place = useCallback((): void => {
		const anchor = anchorRef.current
		if (!anchor) return
		const rect = anchor.getBoundingClientRect()

		// visualViewport, not innerHeight: on a phone the OS keyboard is up the
		// moment this opens (focusing the field is what opened it), and only the
		// visual viewport shrinks to account for it. Measuring the layout
		// viewport would decide there is room below and place the pad under the
		// keyboard.
		const viewportHeight = window.visualViewport?.height ?? window.innerHeight
		const panelHeight = panelRef.current?.offsetHeight ?? 0
		// Measured, not assumed: the pad is as wide as its chips, and "Max 1200"
		// makes a wider row than "Max 20".
		const panelWidth = panelRef.current?.offsetWidth ?? PANEL_FALLBACK_WIDTH

		// LEFT-ALIGNED with the field, then pulled inside both edges. It was
		// centred on the field until 2026-10-18; the pad is about five fields
		// wide, so centring hung half of it over the derived-stats cells to the
		// field's left, the numbers you watch while adjusting. Starting at the
		// field's left edge it runs right instead, over the copies and odds
		// cells, and the caret below says which field it belongs to. The outer
		// max() is not redundant with the inner one: on a viewport narrower than
		// the panel itself the min() would otherwise return a negative left.
		const left = Math.max(
			EDGE,
			Math.min(Math.max(rect.left, EDGE), window.innerWidth - panelWidth - EDGE)
		)
		const caretLeft = Math.min(
			Math.max(rect.left + rect.width / 2 - left, CARET_INSET),
			panelWidth - CARET_INSET
		)
		// Below by default, above for `preferAbove`; either flips when its side
		// lacks the room. Flipping rather than scrolling the pad into view: the
		// field it is adjusting has to stay on screen, and scrolling to fit the
		// pad is what moves it off.
		const fitsBelow = rect.bottom + GAP + panelHeight <= viewportHeight - EDGE
		const fitsAbove = rect.top - GAP - panelHeight >= EDGE
		const placement: Placement =
			preferAbove ? (fitsAbove || !fitsBelow ? "above" : "below") : fitsBelow ? "below" : "above"
		const top = placement === "below" ? rect.bottom + GAP : Math.max(EDGE, rect.top - GAP - panelHeight)
		setPosition({ left, top, placement, caretLeft })
	}, [preferAbove])

	/**
	 * The only way this pad closes. Placement is cleared with it rather than in
	 * an effect: a stale rect left over from the last time it opened would be
	 * used for the next open's first paint, putting the pad briefly under a
	 * different row.
	 */
	const close = useCallback((): void => {
		setOpen(false)
		setPosition(null)
	}, [])

	// Layout effect, so the measured placement lands in the same frame the panel
	// first paints. Until `position` is set the panel renders invisible (below),
	// which is what keeps the unplaced first paint off screen.
	useLayoutEffect(() => {
		if (open) place()
	}, [open, place])

	useEffect(() => {
		if (!open) return

		// Capture phase: the scroll that matters may be on an ancestor, not the
		// window, and scroll events don't bubble.
		const reposition = (): void => place()
		window.addEventListener("scroll", reposition, true)
		window.addEventListener("resize", reposition)

		// THE PHONE CASE, and the reason place() reads visualViewport at all.
		// Focusing the field is what opens this pad, and on a phone that same
		// focus raises the OS keypad — but the keypad animates in AFTER we have
		// already placed, and iOS does not fire `window.resize` for it. Without
		// these two the pad is placed against the full-height viewport, decides
		// it fits below, and is then covered by the keypad as it slides up.
		// `scroll` as well as `resize`: raising the keypad also scrolls the
		// visual viewport to keep the focused field visible.
		const viewport = window.visualViewport
		viewport?.addEventListener("resize", reposition)
		viewport?.addEventListener("scroll", reposition)

		const handlePointerDown = (event: PointerEvent): void => {
			const target = event.target as Node
			if (anchorRef.current?.contains(target)) return
			if (panelRef.current?.contains(target)) return
			close()
		}
		const handleKeyDown = (event: KeyboardEvent): void => {
			if (event.key === "Escape") close()
		}
		document.addEventListener("pointerdown", handlePointerDown)
		document.addEventListener("keydown", handleKeyDown)

		return () => {
			window.removeEventListener("scroll", reposition, true)
			window.removeEventListener("resize", reposition)
			viewport?.removeEventListener("resize", reposition)
			viewport?.removeEventListener("scroll", reposition)
			document.removeEventListener("pointerdown", handlePointerDown)
			document.removeEventListener("keydown", handleKeyDown)
		}
	}, [open, place, close])

	/**
	 * Close when focus leaves the field/trigger group for something that isn't
	 * the pad. This is what makes tabbing down a column of rows behave: each
	 * field opens its own pad and the one above it closes. Chips never trigger
	 * it, because they suppress the mousedown that would move focus.
	 */
	const handleBlur = (event: React.FocusEvent<HTMLDivElement>): void => {
		const next = event.relatedTarget as Node | null
		if (next && (anchorRef.current?.contains(next) || panelRef.current?.contains(next))) return
		close()
	}

	const apply = (chip: CountChip): void => {
		const next = chip.next(value)
		if (next !== value) onChange(next)
	}

	const chipClass =
		"flex h-7 shrink-0 items-center justify-center whitespace-nowrap rounded border border-gray-600 bg-gray-700 px-2 text-xs font-medium text-gray-100 transition hover:border-gray-500 hover:bg-gray-600 disabled:cursor-default disabled:border-gray-700 disabled:bg-gray-800 disabled:text-gray-600"

	const renderChip = (chip: CountChip) => {
		// One rule for both rows: a button that cannot change the value is spent.
		// "Max" disables on a row already at its ceiling, "Clear" and the negative
		// deltas on a row at zero, and "Next pity" never — it always advances.
		const disabled = chip.next(value) === value
		return (
			<button
				key={chip.label}
				type="button"
				title={chip.title}
				disabled={disabled}
				className={chipClass}
				onClick={() => apply(chip)}
			>
				{chip.label}
			</button>
		)
	}

	return (
		// `flex` and nothing else: this box wraps the field alone, so it measures
		// exactly the field and adds no height. It exists to give place() an
		// anchor rect and to catch focus/blur bubbling out of the input.
		<div
			ref={anchorRef}
			className="flex"
			onFocus={() => setOpen(true)}
			onBlur={handleBlur}
		>
			{children}

			{open &&
				createPortal(
					<div
						ref={panelRef}
						role="group"
						aria-label={`Adjust ${label.toLowerCase()}`}
						style={{
							left: position?.left ?? 0,
							top: position?.top ?? 0,
							width: "max-content",
							maxWidth: `calc(100vw - ${EDGE * 2}px)`,
							// Invisible rather than unmounted until placed: the
							// placement needs the panel's real height, so it has to
							// be in the DOM to be measured.
							visibility: position ? "visible" : "hidden",
						}}
						// The keyboard equivalents are the cheapest version of this
						// feature and the least discoverable. They used to be a footer
						// line inside the pad; naming them in the title keeps them
						// learnable without spending ~18px of height on something read
						// once. Chips carry their own titles, so this shows on the
						// pad's dead space only.
						title={chips.hint}
						className="fixed z-50 rounded-lg border border-gray-600 bg-gray-800 p-1 shadow-lg"
						// Focus never leaves the field, so the pad stays open for the
						// next click and the arrow keys keep working. On the whole
						// panel rather than each chip: a press on the pad's own dead
						// space blurs the field too, and closed it mid-use.
						onMouseDown={(event) => event.preventDefault()}
					>
						{/* The caret: a small square turned 45 degrees, half of it
						    outside the pad, pointing at the field's centre. Drawn
						    with the pad's own edge and fill so it reads as part of
						    the pad. */}
						{position && (
							<span
								aria-hidden="true"
								className={`pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 rotate-45 border-gray-600 bg-gray-800 ${
									position.placement === "below" ? "-top-[6px] border-l border-t" : "-bottom-[6px] border-b border-r"
								}`}
								style={{ left: position.caretLeft }}
							/>
						)}
						{/* ONE row, and chips and nothing else. This pad opens over the
						    sheet, so every pixel of it is hiding a number the user is
						    adjusting it to watch — two chip rows plus a "PULLS 200"
						    header (which restated the field it is anchored beside) plus
						    a keyboard-hint footer covered the whole next banner row.
						    The divider is what keeps the ruler readable as a ruler now
						    that the presets share its line. */}
						<div className="flex flex-wrap items-center gap-1">
							{chips.deltas.map(renderChip)}
							{chips.deltas.length > 0 && chips.presets.length > 0 && (
								<div aria-hidden="true" className="mx-0.5 h-4 w-px shrink-0 bg-gray-600" />
							)}
							{chips.presets.map(renderChip)}
						</div>
					</div>,
					document.body
				)}
		</div>
	)
}
