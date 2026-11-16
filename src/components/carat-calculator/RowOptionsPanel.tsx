import { NotebookPen, Percent, RotateCcw, SlidersHorizontal } from "lucide-react"
import type { ReactNode } from "react"
import { NumberField } from "../NumberField"
import { ToggleSwitch } from "../ToggleSwitch"
import type { PaidCaratUse, UserPlannedBanner } from "../../types"
import { isPaidCaratUse, pullsAlreadyMade, rowTicketLimit } from "../../utils/rowOptions"

/**
 * The row options: per-row overrides of the projection's defaults, in the
 * strip that used to hold only the row's note (the note editor is passed in
 * as `children` and still sits at the bottom).
 *
 * Presentational. BannerRow owns every number shown here (the automatic
 * ticket figure, the quick pull counts) because it already holds the row's
 * projection and odds; this component only lays them out and reports changes
 * as a partial row, which BannerRow merges into the plan.
 */

/** One "set my pulls to this" button: a label and the count it sets. */
export interface PullShortcut {
	label: string
	pulls: number
	title: string
}

/** The fields this panel may change on a row. */
export type RowOptionsChange = Partial<
	Pick<
		UserPlannedBanner,
		"tickets_to_use" | "paid_carat_use" | "pulls_already_made" | "excluded_from_projection"
	>
>

interface RowOptionsPanelProps {
	plannedBanner: UserPlannedBanner
	/** A step-up spends paid carats only, so the ticket and paid choices don't apply. */
	isStepUp: boolean
	/** "uma" or "support": which tickets the row spends, for the label. */
	ticketKind: "uma" | "support"
	/** Tickets the row uses right now, as the automatic figure to show. */
	ticketsSpent: number
	/**
	 * Whether the banner is running today. "Already pulled" is offered only
	 * then (or while it still holds a value, so it can be cleared).
	 */
	isLive: boolean
	pullShortcuts: PullShortcut[]
	onChange: (change: RowOptionsChange) => void
	onSetPulls: (pulls: number) => void
	/** The note editor, last in the panel. */
	children?: ReactNode
	/** The odds picker, the desktop drawer's middle column (BannerRow); "columns" layout only. */
	aside?: ReactNode
	/**
	 * "wrap" is the phone card's one wrapping row. "columns" is the desktop
	 * drawer: three titled columns of fixed width (This banner, Odds, Note), so
	 * every row's drawer lines up with the next and nothing wraps. The odds
	 * picker comes in as `aside`; without it the note takes its column too.
	 */
	layout?: "wrap" | "columns"
	className?: string
}

const PAID_OPTIONS: { value: PaidCaratUse | ""; label: string }[] = [
	{ value: "", label: "Your settings" },
	{ value: "none", label: "Don't use paid" },
	{ value: "discount", label: "Daily discount only" },
	{ value: "all", label: "Discount and full price" },
]

const LABEL = "text-[11px] font-semibold uppercase tracking-wide text-gray-400"

export const RowOptionsPanel = ({
	plannedBanner,
	isStepUp,
	ticketKind,
	ticketsSpent,
	isLive,
	pullShortcuts,
	onChange,
	onSetPulls,
	children,
	aside,
	layout = "wrap",
	className = "",
}: RowOptionsPanelProps) => {
	const ticketLimit = rowTicketLimit(plannedBanner)
	const paidUse = isPaidCaratUse(plannedBanner.paid_carat_use)
		? plannedBanner.paid_carat_use
		: ""
	const alreadyMade = pullsAlreadyMade(plannedBanner)
	const excluded = plannedBanner.excluded_from_projection === true
	// A ticket debt (see MaxPullBreakdown) can make the raw figure negative;
	// "uses -2 tickets" means nothing to a player.
	const autoTickets = Math.max(0, ticketsSpent)

	// Each field once, laid out by `layout` below. The phone card keeps the
	// original wrapping row; the desktop drawer arranges the same fields.
	const ticketsField = !isStepUp && (
		<div className="flex flex-col gap-1">
			<span className={LABEL}>{ticketKind === "uma" ? "Uma tickets" : "Support tickets"}</span>
			<div className="flex h-9 items-center gap-1.5">
				{/* Shows the automatic figure until the player types over
				    it, so the field starts at "what it would be now" and
				    keeps following the plan until they change it. */}
				<NumberField
					value={ticketLimit ?? autoTickets}
					onChange={(value) => onChange({ tickets_to_use: value })}
					// The neutral status style the other count fields use: the
					// bare .pull-input carries no colours of its own.
					className="pull-input pull-input--neutral w-14"
					ariaLabel="Most tickets to use on this banner"
					title={
						ticketLimit === null
							? `Automatic: this banner uses ${autoTickets}. Type a number to set your own limit.`
							: `Uses at most ${ticketLimit} here, whatever the ticket setting says.`
					}
				/>
				{ticketLimit === null ? (
					<span className="text-xs text-gray-500">Auto</span>
				) : (
					<button
						type="button"
						onClick={() => onChange({ tickets_to_use: null })}
						className="flex items-center gap-1 rounded px-1.5 py-1 text-xs text-gray-300 hover:bg-gray-700"
						title="Go back to the automatic number"
					>
						<RotateCcw className="h-3 w-3" />
						Auto
					</button>
				)}
			</div>
		</div>
	)

	const paidField = !isStepUp && (
		<label className="flex flex-col gap-1">
			<span className={LABEL}>Paid carats</span>
			<select
				value={paidUse}
				onChange={(event) => {
					const value = event.target.value
					onChange({ paid_carat_use: isPaidCaratUse(value) ? value : null })
				}}
				className="h-9 min-w-0 rounded-md border border-gray-600 bg-gray-900 px-2 text-sm text-gray-100 focus:border-gray-400 focus:outline-none"
			>
				{PAID_OPTIONS.map((option) => (
					<option key={option.value} value={option.value}>
						{option.label}
					</option>
				))}
			</select>
		</label>
	)

	const alreadyField = !isStepUp && (isLive || alreadyMade > 0) && (
		<div className="flex flex-col gap-1">
			<span className={LABEL}>Already pulled</span>
			<NumberField
				value={alreadyMade}
				onChange={(value) => onChange({ pulls_already_made: value })}
				className="pull-input pull-input--neutral w-16"
				ariaLabel="Pulls you have already made on this banner"
				title="Pulls you've already made here. They count toward the 200-pull exchange and cost nothing more."
			/>
		</div>
	)

	const countField = (
		<div className="flex flex-col gap-1">
			<span className={LABEL}>Count this banner</span>
			<div
				className="flex h-9 items-center"
				title="Turn off to keep this banner in the plan without spending anything on it."
			>
				<ToggleSwitch
					checked={!excluded}
					onChange={(checked) => onChange({ excluded_from_projection: !checked })}
					ariaLabel="Count this banner in the projection"
				/>
			</div>
		</div>
	)

	const shortcutsField = pullShortcuts.length > 0 && (
		<div className="flex flex-col gap-1">
			<span className={LABEL}>Set pulls</span>
			<div className="flex flex-wrap gap-1.5">
				{pullShortcuts.map((shortcut) => (
					<button
						key={shortcut.label}
						type="button"
						onClick={() => onSetPulls(shortcut.pulls)}
						title={shortcut.title}
						className="h-9 rounded-md border border-gray-600 bg-gray-700 px-2.5 text-xs font-semibold text-gray-100 transition hover:bg-gray-600"
					>
						{shortcut.label}
					</button>
				))}
			</div>
		</div>
	)

	// The desktop drawer (owner's pick of the two prototyped on the canvas,
	// 2026-11-16). The column widths are fixed, not sized to content: sized to
	// content, a row with a long card name or "Already pulled" pushed its
	// columns sideways and the drawers stopped lining up down the plan.
	if (layout === "columns") {
		return (
			<div className={className}>
				<div className="grid w-full grid-cols-[22rem_32rem_minmax(14rem,1fr)] py-1">
					<DrawerSection icon={<SlidersHorizontal />} title="This banner">
						{/* Two by two: the ticket limit and paid carats, then "Already pulled"
						    (live banners only) and the switch, which always takes the second
						    column so its long label never squeezes the first. */}
						<div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-5 gap-y-3">
							{ticketsField}
							{paidField}
							{alreadyField}
							<div className="col-start-2">{countField}</div>
						</div>
						{shortcutsField}
					</DrawerSection>
					{aside && (
						<DrawerSection icon={<Percent />} title="Odds">
							{aside}
						</DrawerSection>
					)}
					<DrawerSection icon={<NotebookPen />} title="Note" span={aside ? 1 : 2}>
						{children}
					</DrawerSection>
				</div>
			</div>
		)
	}

	return (
		<div className={`flex flex-col gap-3 ${className}`}>
			<div className="flex flex-wrap items-end gap-x-5 gap-y-3">
				{ticketsField}
				{paidField}
				{alreadyField}
				{countField}
				{shortcutsField}
			</div>
			{children}
		</div>
	)
}

/** One titled column of the desktop drawer; a hairline divides it from the one before. */
function DrawerSection({ icon, title, span = 1, children }: {
	icon: ReactNode
	title: string
	/** Columns it covers: the note takes the odds column too on a banner with no odds. */
	span?: 1 | 2
	children: ReactNode
}) {
	return (
		<section className={`flex min-w-0 flex-col gap-2.5 border-l border-gray-700 px-6 first:border-l-0 first:pl-1 last:pr-1 ${span === 2 ? "col-span-2" : ""}`}>
			<h4 className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-100 [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:text-brand">
				{icon}
				{title}
			</h4>
			{children}
		</section>
	)
}
