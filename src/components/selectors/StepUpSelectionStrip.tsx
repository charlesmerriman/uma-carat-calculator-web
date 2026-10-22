import { useState } from "react"
import { ChevronRight, Star } from "lucide-react"
import { StepUpSelectionPicker } from "./StepUpSelectionPicker"
import { useEligibleCardCatalogue } from "../../hooks/useEligibleCardCatalogue"
import {
	SELECTION_SLOTS,
	effectiveSelections,
	findGuaranteedCardArt,
	hasCustomSelection,
	poolFor,
	replaceSelectionsFor,
	selectionsForStepUp,
} from "../../utils/stepUpSelection"
import type {
	BannerStepUp,
	BannerSupport,
	BannerUma,
	UserStepUpSelection,
} from "../../types"
import { FramedUma } from "../FramedUma"
import { useOshiIds } from "../../hooks/useOshiIds"

interface StepUpSelectionStripProps {
	/** This campaign's step-ups, already filtered by the caller. */
	stepUps: BannerStepUp[]
	/** Every selection the account holds; rows filter to their own banner. */
	selections: UserStepUpSelection[]
	umaBannerData: BannerUma[]
	supportBannerData: BannerSupport[]
	disabled: boolean
	onChange: (next: UserStepUpSelection[]) => void
}

interface StepUpRowProps {
	stepUp: BannerStepUp
	stored: UserStepUpSelection[]
	umaBannerData: BannerUma[]
	supportBannerData: BannerSupport[]
	disabled: boolean
	onOpen: () => void
}

/**
 * One step-up's summary line.
 *
 * Its own component rather than inline JSX because it needs the eligible-card
 * catalogue to resolve the default selection, and a hook cannot be called inside
 * the parent's `.map`.
 */
const StepUpRow = ({
	stepUp,
	stored,
	umaBannerData,
	supportBannerData,
	disabled,
	onOpen,
}: StepUpRowProps) => {
	const isUma = poolFor(stepUp) === "uma"

	const catalogue = useEligibleCardCatalogue({
		pool: poolFor(stepUp),
		jpCutoffDate: stepUp.jp_cutoff_date,
		umaBannerData,
		supportBannerData,
	})

	// Read through the same seam the picker uses, so the summary can never
	// disagree with what opening it shows.
	const isDefault = !hasCustomSelection(stored)
	const selections = effectiveSelections(stored, stepUp, catalogue)
	const guaranteed = findGuaranteedCardArt(
		selections,
		umaBannerData,
		supportBannerData
	)
	// The person's favorite umas get the rainbow frame (FramedUma).
	const oshiIds = useOshiIds()

	return (
		<button
			type="button"
			disabled={disabled}
			aria-haspopup="dialog"
			className="flex w-full min-w-0 items-center gap-3 py-2 text-left transition hover:bg-gray-700/30 disabled:cursor-not-allowed disabled:opacity-60"
			onClick={onOpen}
		>
			{/* Guaranteed pick → campaign art → typographic chip. The same order the
			    planner row uses, so a step-up looks the same in both places. */}
			<span
				className={`flex ${
					isUma ? "h-12 w-12" : "h-12 w-9"
				} shrink-0 items-center justify-center overflow-hidden rounded border border-gray-600 bg-gray-900/50`}
			>
				{guaranteed?.uma ? (
					<FramedUma
						src={guaranteed.uma.portrait ?? guaranteed.image}
						oshi={oshiIds.has(guaranteed.uma.id)}
						className="h-full"
					/>
				) : guaranteed ? (
					<img
						src={guaranteed.image}
						alt=""
						loading="lazy"
						decoding="async"
						className="h-full w-full object-contain"
					/>
				) : stepUp.image ? (
					<img
						src={stepUp.image}
						alt=""
						loading="lazy"
						decoding="async"
						className="h-full w-full object-contain"
					/>
				) : (
					<span className="text-xs font-bold text-step-up">
						{isUma ? "★3" : "SSR"}
					</span>
				)}
			</span>

			<span className="min-w-0 flex-1">
				<span className="block truncate text-sm text-gray-200">
					{stepUp.name}
				</span>
				<span className="block truncate text-xs text-gray-500">
					{guaranteed
						? `Guaranteed: ${guaranteed.name}`
						: selections.length > 0
							? "No step 5 pick chosen"
							: "No eligible cards yet"}
				</span>
			</span>

			<span className="shrink-0 text-right text-xs font-semibold tabular-nums text-gray-400">
				{selections.length}/{SELECTION_SLOTS}
				{isDefault && (
					<span className="block text-[0.65rem] font-normal uppercase tracking-wide text-gray-600">
						default
					</span>
				)}
			</span>
			<ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />
		</button>
	)
}

/**
 * The campaign card's step-up band: one row per Select Step-Up the campaign
 * sells, each opening the ten-slot picker.
 *
 * It lives on the campaign card because a BannerStepUp already carries an
 * anniversary_event FK — its step-ups belong next to its packs and its selector
 * tickets, which is also where the source sheet keeps them.
 *
 * Renders nothing when a campaign sells no step-ups, so the vast majority of
 * campaign cards are untouched by it.
 */
export const StepUpSelectionStrip = ({
	stepUps,
	selections,
	umaBannerData,
	supportBannerData,
	disabled,
	onChange,
}: StepUpSelectionStripProps) => {
	const [openStepUpId, setOpenStepUpId] = useState<number | null>(null)

	if (stepUps.length === 0) return null

	const openStepUp = stepUps.find((stepUp) => stepUp.id === openStepUpId) ?? null

	return (
		<div className="border-t border-gray-700 px-4 py-3">
			<h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-brand">
				<Star className="h-4 w-4 shrink-0" />
				★3/SSR Select Step-Up Banners
			</h4>
			{/* Two step-ups share a row: an anniversary sells at most a ★3 one and an
			    SSR one, and stacking two ~60px rows under a heading that spans the
			    whole card wasted width the card already has. The columns are
			    conditional — a half-anniversary sells one, and a lone row stretched
			    across half the card with the other half empty is the dead space this
			    page has been shedding. The rule between them only means anything
			    while they are stacked, so it retires at the same breakpoint.
			    `grid-cols-1` and not a bare grid: an implicit column sizes to its
			    content, and a step-up's untruncated name pushed the row's 10/10
			    count past a phone's edge. */}
			<ul
				className={`grid grid-cols-1 gap-x-8 divide-y divide-gray-700/80 ${
					stepUps.length > 1 ? "md:grid-cols-2 md:divide-y-0" : ""
				}`}
			>
				{stepUps.map((stepUp) => (
					<li key={stepUp.id}>
						<StepUpRow
							stepUp={stepUp}
							stored={selectionsForStepUp(selections, stepUp.id)}
							umaBannerData={umaBannerData}
							supportBannerData={supportBannerData}
							disabled={disabled}
							onOpen={() => setOpenStepUpId(stepUp.id)}
						/>
					</li>
				))}
			</ul>

			{openStepUp && (
				<StepUpSelectionPicker
					stepUp={openStepUp}
					selections={selectionsForStepUp(selections, openStepUp.id)}
					umaBannerData={umaBannerData}
					supportBannerData={supportBannerData}
					onClose={() => setOpenStepUpId(null)}
					onChange={(next) =>
						onChange(replaceSelectionsFor(selections, openStepUp.id, next))
					}
				/>
			)}
		</div>
	)
}
