import type { ReactNode } from "react"
import { Clock3, type LucideIcon } from "lucide-react"
import { FOCUS_SCROLL_MARGIN } from "../../hooks/useFocusScroll"
import { TIMELINE_FOCUS_HIGHLIGHT, type CountdownState, type TimelineFocusProps } from "./timelineShared"

/**
 * THE SHELL EVERY TIMELINE CARD SITS IN: banner windows, race events and
 * markers, alone or paired.
 *
 * Two boxes, and they are not styling choices; they are what lines the
 * panel edges up down the list:
 *
 *   - the outer wrapper carries the gutter, the ref and the scroll margin. A
 *     deep link scrolls to IT, so anything attached above the panel (`before`:
 *     a campaign strip) is on screen too.
 *   - the panel carries the padding, the `@container` the art's width is
 *     measured against, and the focus ring: it is the box a reader recognises
 *     as "the card", and the only one with the right rounding.
 *
 * `before` and `after` sit flush against the panel, outside it, so nothing in
 * them can make the art row inside grow. A card that has one squares off the
 * panel's corners on that side through `panelClassName`.
 */
export function TimelineCard({
	focusRef,
	isFocused = false,
	panelClassName = "",
	before,
	after,
	children,
}: TimelineFocusProps & {
	/** Extra classes for the panel: squared corners, a tinted edge. */
	panelClassName?: string
	/** Flush above the panel (the campaign strip). */
	before?: ReactNode
	/** Flush beneath the panel (the story events). */
	after?: ReactNode
	children: ReactNode
}) {
	return (
		<div ref={focusRef} className={`my-3 w-full px-2 ${FOCUS_SCROLL_MARGIN}`}>
			{before}
			<div
				className={`tl-card card-panel @container w-full overflow-hidden p-2 sm:p-3 ${panelClassName} ${
					isFocused ? TIMELINE_FOCUS_HIGHLIGHT : ""
				}`}
			>
				{children}
			</div>
			{after}
		</div>
	)
}

/**
 * A card's header row: the icon square and the title block on the left, the
 * pills on the right. Stacked on a phone, one line from sm.
 *
 * The banner and race cards share it. The title block is the caller's
 * (`children`), because the two differ there on purpose: a race is an `h2` a
 * size larger than a banner's `h3`. A marker card has no header row at all;
 * its chip and name sit inline (EventMarkerCard).
 */
export function TimelineCardHeader({
	icon: Icon,
	children,
	actions,
}: {
	icon: LucideIcon
	/** The title block: the name, the dates, the Estimated badge. */
	children: ReactNode
	/** The pills on the right, in order. The countdown goes last. */
	actions: ReactNode
}) {
	return (
		<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div className="flex min-w-0 items-center gap-3">
				<div className="tl-icon-box flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-600 bg-gray-700 text-brand">
					<Icon className="h-5 w-5" />
				</div>
				{children}
			</div>
			<div className="flex flex-wrap items-center gap-2">{actions}</div>
		</div>
	)
}

/**
 * The countdown pill ("Ends in 7 Days"), last in a card's header. `state`
 * (getCountdownState) is written as `data-state` for a theme to colour; the
 * default themes draw every state the same.
 */
export function TimelineCountdown({ label, state }: { label: string; state: CountdownState | null }) {
	return (
		<div
			data-size="md"
			data-state={state ?? undefined}
			className="tl-pill tl-countdown gap-2 border-gray-600 bg-gray-700 font-semibold text-gray-100"
		>
			<span>{label}</span>
			<Clock3 className="h-4 w-4 text-brand" />
		</div>
	)
}
