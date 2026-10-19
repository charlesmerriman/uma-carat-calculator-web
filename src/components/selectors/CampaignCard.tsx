import { ChevronDown, Gift, Ticket, Package } from "lucide-react"
import PredictedBadge from "../PredictedBadge"
import { formatDate } from "../../utils/dateFormat"
import { formatUsd } from "../../utils/formatCurrency"
import { NumberField } from "../NumberField"
import { CountStepper } from "../carat-calculator/CountStepper"
import { buildQuantityChips } from "../../utils/countChips"
import { SelectorTargetPicker } from "./SelectorTargetPicker"
import { StepUpSelectionStrip } from "./StepUpSelectionStrip"
import type { PlannedCampaign, PlannedProduct } from "../../hooks/useSelectorPlanner"
import { FOCUS_SCROLL_MARGIN } from "../../hooks/useFocusScroll"
import { useState, type RefObject } from "react"
import type {
	BannerUma,
	BannerSupport,
	BannerStepUp,
	UserStepUpSelection
} from "../../types"

interface CampaignCardProps {
	campaign: PlannedCampaign
	umaBannerData: BannerUma[]
	supportBannerData: BannerSupport[]
	/** Every step-up in the catalogue; the card filters to its own campaign. */
	stepUpBannerData: BannerStepUp[]
	stepUpSelections: UserStepUpSelection[]
	onQuantityChange: (line: PlannedProduct, quantity: number) => void
	onTargetChange: (
		line: PlannedProduct,
		target: { uma: number | null; support: number | null }
	) => void
	onStepUpSelectionChange: (next: UserStepUpSelection[]) => void
	/**
	 * Set on the ONE card a `?campaign=` deep link named, and absent on every
	 * other — the page holds a single ref and hands it to whichever card
	 * matches, so no card can claim it twice. See utils/selectorsFocus.
	 */
	focusRef?: RefObject<HTMLElement | null>
	/**
	 * Open regardless of the screen: the soonest campaign, and the one a deep
	 * link names. Every other card starts open only where the card is three
	 * columns wide (lg); below that it starts folded. See the state below.
	 */
	defaultOpen?: boolean
}

export const CampaignCard = ({
	campaign,
	umaBannerData,
	supportBannerData,
	stepUpBannerData,
	stepUpSelections,
	onQuantityChange,
	onTargetChange,
	onStepUpSelectionChange,
	focusRef,
	defaultOpen = false,
}: CampaignCardProps) => {
	const { event, lines, isUndated } = campaign
	// FOLDED BELOW lg (design polish item 24). Stacked into one column, every
	// campaign open ran the page to about 11,000px on a phone: the same two
	// packs and five checkboxes, campaign after campaign. A folded card is one
	// line, the name, dates and this campaign's totals, and opens on tap. From
	// lg the card is three columns and short, so it starts open there, as it
	// always has. The breakpoint is read once, as IncomeForm does: the default
	// is a first-paint question, and a listener would undo the reader's own
	// toggling on every resize. This page only renders behind /app's loading
	// gate, so `window` is always there.
	const [open, setOpen] = useState(
		() => defaultOpen || (typeof window !== "undefined" && window.matchMedia("(min-width: 64rem)").matches)
	)
	// Passed campaigns are removed before this component receives them. Undated
	// campaigns stay visible but can't be projected, so they remain read-only.
	const locked = isUndated

	// A step-up belongs to the campaign selling it, so this is a plain filter
	// rather than anything the planner hook has to know about.
	const stepUps = stepUpBannerData.filter(
		(stepUp) => stepUp.anniversary_event === event.id
	)

	const packs = lines.filter((line) => line.product.product_type === "carat_pack")
	const selectors = lines.filter(
		(line) => line.product.product_type !== "carat_pack"
	)
	// Quantity is 0/1 for a selector — max_quantity is 1 on every one of them —
	// so "claimed" is just a non-zero row, and the tile strip renders exactly
	// these in exactly this order.
	const claimedSelectors = selectors.filter((line) => line.quantity > 0)

	const dates = isUndated
		? "Dates unknown"
		: `${formatDate(event.start_date)} – ${formatDate(event.end_date)}`

	if (!open) {
		return (
			<section
				ref={focusRef}
				className={`card-panel overflow-hidden ${FOCUS_SCROLL_MARGIN} ${locked ? "opacity-60" : ""}`}
			>
				<button
					type="button"
					aria-expanded={false}
					onClick={() => setOpen(true)}
					className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left transition hover:bg-gray-700/30"
				>
					<h3 className="text-base font-semibold text-gray-100">{event.name}</h3>
					{event.is_predicted && <PredictedBadge />}
					<span className="text-sm text-gray-400">{dates}</span>
					<span className="ml-auto flex items-center gap-2 text-sm">
						{campaign.usd > 0 ? (
							<span className="text-gray-200">
								{campaign.paidCarats.toLocaleString()} paid carats · {formatUsd(campaign.usd)}
							</span>
						) : (
							<span className="text-gray-500">Nothing planned yet</span>
						)}
						<ChevronDown className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
					</span>
				</button>
				{/* A campaign's step-ups stay in view when it is folded: they are the
				    page's rarest content (an anniversary sells one or two) and a
				    folded line gave no sign of them. The strip is a heading and a
				    row each, and every row still opens its ten-pick picker. */}
				<StepUpSelectionStrip
					stepUps={stepUps}
					selections={stepUpSelections}
					umaBannerData={umaBannerData}
					supportBannerData={supportBannerData}
					disabled={locked}
					onChange={onStepUpSelectionChange}
				/>
			</section>
		)
	}

	return (
		<section
			ref={focusRef}
			className={`card-panel overflow-hidden ${FOCUS_SCROLL_MARGIN} ${locked ? "opacity-60" : ""}`}
		>
			{/* WHY 49rem IS A CONSTANT AND NOT `max-content`
			    Every card is its own grid, so an intrinsic track sizes each one to its
			    OWN contents — and campaigns differ (five tickets, one, none at all).
			    The columns then landed in a different place on every card and the
			    stack lost its rhythm. 49rem is the widest a selector strip ever gets:
			    1rem+1rem of cell padding, the 10rem ticket column, the 1rem gap, and
			    the fullest set any campaign sells — 2 uma tiles at 8rem + 3 support at
			    6rem + 4 gaps of 0.5rem. Sized to the maximum rather than to each card,
			    so a full campaign's tiles end flush with the card border and every
			    other card keeps that same geometry. Change a tile width and this
			    number moves with it. The 20rem floor keeps it safe below ~760px of
			    card: the track stops shrinking and the tiles wrap rather than
			    overflowing the clip. */}
			<div className="grid lg:grid-cols-[minmax(11.5rem,0.6fr)_minmax(16rem,1fr)_minmax(20rem,49rem)]">
				<header className="flex min-w-0 flex-col justify-center border-b border-gray-700 bg-gray-900/35 px-4 py-4 lg:border-b-0 lg:border-r">
					<div className="flex flex-wrap items-center gap-2">
						<h3 className="text-base font-semibold text-gray-100">{event.name}</h3>
						{event.is_predicted && <PredictedBadge />}
					</div>
					<p className="mt-2 text-sm font-medium text-gray-300">{dates}</p>
					<div className="mt-1 flex items-center justify-between gap-2">
						<p className="text-xs text-gray-500">Campaign purchases</p>
						<button
							type="button"
							aria-expanded={true}
							onClick={() => setOpen(false)}
							className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-gray-400 transition hover:bg-gray-700 hover:text-gray-100"
						>
							Hide
							<ChevronDown className="h-3.5 w-3.5 shrink-0 rotate-180" aria-hidden="true" />
						</button>
					</div>
				</header>

				<div className="min-w-0 border-b border-gray-700 px-4 py-3 lg:border-b-0 lg:border-r">
				{packs.length > 0 && (
					<div className="min-w-0">
						<h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-brand">
							<Package className="h-4 w-4 shrink-0" />
							Discounted carat packs
						</h4>
						<div className="grid grid-cols-[minmax(0,1fr)_3.75rem_4rem] gap-2 border-b border-gray-700 pb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-gray-500">
							<span>Pack</span><span className="text-right">Price</span><span className="text-right">Qty</span>
						</div>
						<ul className="divide-y divide-gray-700/80">
							{packs.map((line) => (
								<li
									key={line.product.id}
									className="grid grid-cols-[minmax(0,1fr)_3.75rem_4rem] items-center gap-2 py-2"
								>
									<span className="min-w-0 truncate text-sm text-gray-200">
										{line.product.name}
									</span>
									<span className="text-right text-xs text-gray-400">
										{formatUsd(line.product.usd_cost)}
									</span>
									{/* NumberField rather than a native number input: it selects
									    its contents on focus like every other count on the site,
									    so typing replaces the value. The pad (±1 and Max) opens
									    on that same focus. onQuantityChange clamps to
									    max_quantity, and NumberField re-syncs to the clamped
									    value. */}
									<CountStepper
										value={line.quantity}
										onChange={(quantity) => onQuantityChange(line, quantity)}
										chips={buildQuantityChips(line.product.max_quantity)}
										label="Quantity"
									>
										<NumberField
											value={line.quantity}
											disabled={locked}
											ariaLabel={`Quantity of ${line.product.name}`}
											className="w-full rounded border border-gray-600 bg-gray-900 px-2 py-1 text-right text-sm text-gray-100 disabled:cursor-not-allowed"
											onChange={(quantity) => onQuantityChange(line, quantity)}
										/>
									</CountStepper>
								</li>
							))}
						</ul>
					</div>
				)}
				{packs.length === 0 && <p className="text-sm text-gray-500">No discounted packs.</p>}
				</div>

				{/* Not an @container: the track above is a constant, so there is
				    nothing left for a container query to answer that `lg:` does not —
				    and side by side is exactly the state where the card itself is in
				    three columns. */}
				<div className="min-w-0 px-4 py-3">
				{selectors.length > 0 && (
					<div className="min-w-0">
						<h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-brand">
							<Ticket className="h-4 w-4 shrink-0" />
							Selectors
						</h4>
						{/* The sheet's shape: the tickets are ONE narrow column, and
						    everything to the right of it is the cards they take. Stacked
						    below lg, where the card is one column and the tiles would
						    rather have the full width than share it with the list. */}
						<div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:gap-4">
							<ul className="min-w-0 shrink-0 lg:w-40">
								{selectors.map((line) => (
									<li key={line.product.id} className="min-w-0">
										{/* The whole row toggles, not just the box — a 16px
										    checkbox is a poor target on a phone, and the
										    label beside it is dead space otherwise. */}
										<label
											className={`flex items-center gap-2 py-1.5 ${
												locked ? "cursor-not-allowed" : "cursor-pointer"
											}`}
										>
											<input
												type="checkbox"
												checked={line.quantity > 0}
												disabled={locked}
												aria-label={`Claim ${line.product.name}`}
												className="h-4 w-4 shrink-0 accent-[var(--color-brand)]"
												onChange={(e) =>
													onQuantityChange(line, e.target.checked ? 1 : 0)
												}
											/>
											<span className="min-w-0 flex-1 truncate text-sm text-gray-200">
												{line.product.name}
											</span>
										</label>
									</li>
								))}
							</ul>

							{/* One tile per CLAIMED ticket, in the column's own order, so
							    a tile and its checkbox always line up left to right.
							    Empty until one is ticked: the "tick a selector" hint is
							    said once above the campaign list (Selectors.tsx), not
							    once per campaign. */}
							<div className="flex min-w-0 flex-1 flex-wrap content-start items-start gap-2">
								{claimedSelectors.map((line) => (
									<SelectorTargetPicker
										key={line.product.id}
										product={line.product}
										umaBannerData={umaBannerData}
										supportBannerData={supportBannerData}
										targetUma={line.purchase?.target_uma ?? null}
										targetSupport={line.purchase?.target_support ?? null}
										disabled={locked}
										onChange={(target) => onTargetChange(line, target)}
									/>
								))}
							</div>
						</div>
					</div>
				)}
				{selectors.length === 0 && <p className="text-sm text-gray-500">No selector tickets.</p>}
				</div>
			</div>

			<StepUpSelectionStrip
				stepUps={stepUps}
				selections={stepUpSelections}
				umaBannerData={umaBannerData}
				supportBannerData={supportBannerData}
				disabled={locked}
				onChange={onStepUpSelectionChange}
			/>

			{lines.length === 0 && stepUps.length === 0 && <p className="border-t border-gray-700 px-4 py-3 text-sm text-gray-500">No packs or selectors recorded for this campaign yet.</p>}

			<footer className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-gray-700 bg-gray-900/40 px-4 py-2 text-sm">
				<span className="flex items-center gap-1.5 text-gray-400">
					<Gift className="h-4 w-4 shrink-0 text-brand" />
					This campaign
				</span>
				<span className="text-gray-200">
					{campaign.paidCarats.toLocaleString()} paid carats
				</span>
				{campaign.freeCarats > 0 && (
					<span className="text-gray-400">
						+ {campaign.freeCarats.toLocaleString()} free
					</span>
				)}
				<span className="text-gray-200">{formatUsd(campaign.usd)}</span>
				<span className="ml-auto text-xs text-gray-500">
					Cumulative: {campaign.cumulativePaidCarats.toLocaleString()} paid
					{campaign.cumulativeFreeCarats > 0
						? ` + ${campaign.cumulativeFreeCarats.toLocaleString()} free`
						: ""}{" "}
					· {formatUsd(campaign.cumulativeUsd)}
				</span>
			</footer>
		</section>
	)
}
