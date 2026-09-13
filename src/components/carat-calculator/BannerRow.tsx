import type {
	ChampionsMeetingRank,
	ClubRank,
	TeamTrialsRank,
	UserPlannedBanner,
	UserStats,
	BannerUma,
	BannerSupport,
	BannerStepUp,
	UserStepUpSelection
} from "../../types"
import React from "react"
import { Link } from "react-router-dom"
import { startOfDay } from "date-fns"
import Select from "react-select"
import type { SingleValue } from "react-select"
import { toast } from "sonner"
import { MLBChanceDisplay } from "./MLBChanceDisplay"
import { MobileBannerCard } from "./MobileBannerCard"
import { NumberField } from "../NumberField"
import { formatDate } from "../../utils/dateFormat"
import { timelineFocusHref } from "../../utils/timelineFocus"
import {
	bannerKey,
	bannerTargetFields,
	bannersForRowType,
	getFreePulls,
	getPullCountStatus,
	getReservedStatus,
	getStepCountStatus,
	isRecommendedBanner,
	isSelectableBanner,
	plannedBannerKey,
	plannedBannerRowType,
	plannedBannerTarget,
	comparePlannedBanners,
	plannedBannerTimeline,
} from "../../utils/bannerHelpers"
import type {
	BannerKey,
	BannerRowType,
	PlannableBanner,
} from "../../utils/bannerHelpers"
import { STEPS_PER_ROUND, stepUpCopyDistribution } from "../../utils/stepUpLadder"
import {
	effectiveSelections,
	findGuaranteedCardArt,
	selectionsForStepUp
} from "../../utils/stepUpSelection"
import { buildEligibleCardCatalogue } from "../../hooks/useEligibleCardCatalogue"
import type { CalculationConstants } from "../../types/constants"
import type { BannerResources } from "../../hooks/bannerResources"
import { PULLS_PER_PITY_COPY } from "../../utils/probabilityCalculations"
import {
	compactSelectStyles,
	mobileBannerSelectStyles,
	withRecommendedOption,
} from "../../utils/reactSelectStyles"
import { RecommendedMark } from "./RecommendedMark"
import { ExtraCardsBadge } from "./ExtraCardsBadge"
import { BannerTypeBadge } from "./BannerTypeBadge"
import { CountStepper } from "./CountStepper"
import { buildCountChips } from "../../utils/countChips"

interface BannerRowProps {
	plannedBanner: UserPlannedBanner
	userStatsData: UserStats
	clubRankData: ClubRank[]
	teamTrialsRankData: TeamTrialsRank[]
	championsMeetingRankData: ChampionsMeetingRank[]
	userPlannedBannerData: UserPlannedBanner[]
	umaBannerData: BannerUma[]
	supportBannerData: BannerSupport[]
	stepUpBannerData: BannerStepUp[]
	/**
	 * Every step-up selection the account holds, not just this row's — the row
	 * filters to its own banner. Flat because that is the shape the PATCH
	 * collection has; see utils/stepUpSelection.ts.
	 */
	userStepUpSelectionData: UserStepUpSelection[]
	/**
	 * Live calculation constants from the API. Passed rather than imported so an
	 * admin edit to the step-up ladder reaches the odds without a rebuild.
	 */
	constants: CalculationConstants
	/**
	 * This banner's projection snapshot (carats, max pulls, pull breakdown).
	 * Passed whole rather than as individual scalars so adding a stat to the
	 * derived-stats strip doesn't churn this signature every time.
	 */
	resources: BannerResources
	setUserPlannedBannerData: React.Dispatch<
		React.SetStateAction<UserPlannedBanner[]>
	>
	initialBannerType?: BannerRowType
}

interface BannerOption {
	value: PlannableBanner
	label: string
	key: number
}

/**
 * The card whose art a step-up row should show: the step 5 pick.
 *
 * An untouched step-up falls back to the DEFAULT selection's target — the most
 * recently available card — read through the same `effectiveSelections` seam the
 * picker and the campaign card use, so all three always agree about what the
 * user is looking at.
 *
 * Module-level and un-memoized on purpose. The React Compiler memoizes the call
 * for us; a manual useMemo here could not be preserved (and building the
 * catalogue through useEligibleCardCatalogue instead would mean flattening and
 * sorting the whole uma catalogue on every uma and support row too, since a hook
 * cannot be skipped for the rows that do not need it).
 */
function resolveGuaranteedCard(
	stepUp: BannerStepUp,
	allSelections: UserStepUpSelection[],
	umaBannerData: BannerUma[],
	supportBannerData: BannerSupport[]
) {
	const catalogue = buildEligibleCardCatalogue({
		pool: stepUp.card_type === "uma" ? "uma" : "support",
		jpCutoffDate: stepUp.jp_cutoff_date,
		umaBannerData,
		supportBannerData,
	})
	return findGuaranteedCardArt(
		effectiveSelections(
			selectionsForStepUp(allSelections, stepUp.id),
			stepUp,
			catalogue
		),
		umaBannerData,
		supportBannerData
	)
}

export const BannerRow = ({
	plannedBanner,
	userPlannedBannerData,
	umaBannerData,
	supportBannerData,
	stepUpBannerData,
	userStepUpSelectionData,
	constants,
	resources,
	setUserPlannedBannerData,
	initialBannerType
}: BannerRowProps) => {
	// The row's kind: from its FK when it has one, else the kind it was staged
	// as. Never sniffed inline — see plannedBannerRowType for why the old
	// `?? "Uma"` on the FK check was a latent bug.
	const target = plannedBannerTarget(plannedBanner)
	const bannerType: BannerRowType = plannedBannerRowType({
		...plannedBanner,
		initialBannerType: plannedBanner.initialBannerType ?? initialBannerType,
	})

	const isStepUp = bannerType === "StepUp"

	const targetBannerData = bannersForRowType(bannerType, {
		umaBannerData,
		supportBannerData,
		stepUpBannerData,
	})

	// Match within the type namespace only. targetBannerData is already scoped to
	// bannerType, and uma/support ids are independent — comparing against the
	// other type's id could resolve to an unrelated banner of the same number.
	const selectedBannerId = target.type === "Empty" ? undefined : target.banner.id
	const currentBanner = targetBannerData.find((banner) => banner.id === selectedBannerId)

	const currentDate = new Date()

	// The pull economics (free/paid carats, tickets, discounts) are computed
	// centrally in useBannerResources → applyPullStrategy; here we only apply the
	// "Passed" gate for banners that have already ended. The cutoff is the START
	// of today (local midnight), matching the projection's stable anchor — a
	// banner ending *today* is still active, so it shows an estimate.
	const bannerEndDateStr = plannedBannerTimeline(plannedBanner)?.end_date
	const bannerHasEnded =
		!!bannerEndDateStr &&
		new Date(bannerEndDateStr).getTime() < startOfDay(new Date()).getTime()

	const maxPossiblePulls: number | "Passed" = bannerHasEnded
		? "Passed"
		: resources.maxPossiblePulls

	// Round a *displayed* carat estimate DOWN to the nearest ten (ones place is
	// always 0, never a decimal). Flooring rather than rounding to nearest
	// avoids overstating: rounding 145 up to 150 would imply a pull is
	// affordable while "Max Pulls" (which floors 145/150 to 0) says it isn't.
	// Presentation-only — the raw balances still drive the max-pulls math, so
	// this never affects how many pulls are allowed. A passed banner shows 0:
	// its resources were spent or expired, so an estimate would be misleading.
	const toDisplayCarats = (carats: number): number =>
		maxPossiblePulls === "Passed" ? 0 : Math.floor(carats / 10) * 10

	const displayFreeCarats = toDisplayCarats(resources.freeCarats)
	const displayPaidCarats = toDisplayCarats(resources.paidCarats)

	// Ticket and paid-pull counts come straight from the strategy's breakdown
	// rather than being re-derived here: it already resolved which ticket type
	// matches this banner, and picking uma-vs-support again in the component
	// would be a second place to get the no-cross-substitution rule wrong.
	// Zeroed for a passed banner, mirroring the carat boxes above.
	const { tickets: ticketPulls, paidPulls } =
		maxPossiblePulls === "Passed"
			? { tickets: 0, paidPulls: 0 }
			: resources.maxPullBreakdown

	// Copies actually paid for, which is what the odds may credit. A passed
	// banner funds nothing, mirroring the zeroed carat boxes above.
	const reservedFunding =
		maxPossiblePulls === "Passed"
			? { selectors: 0, crystals: 0, unfunded: 0 }
			: resources.reservedFunding
	const fundedReservedCopies = reservedFunding.selectors + reservedFunding.crystals
	const reservedStatus = getReservedStatus(reservedFunding)

	const updateBannerInList = (
		updater: (banner: UserPlannedBanner) => UserPlannedBanner
	): UserPlannedBanner[] => {
		return userPlannedBannerData.map((mappedBannerData) => {
			const isMatch =
				(mappedBannerData.id !== undefined &&
					mappedBannerData.id === plannedBanner.id) ||
				(mappedBannerData.tempId !== undefined &&
					mappedBannerData.tempId === plannedBanner.tempId)
			return isMatch ? updater(mappedBannerData) : mappedBannerData
		})
	}

	const handleDeleteBannerClick = (): void => {
		const confirmed = window.confirm("Are you sure you want to delete this banner?")
		if (!confirmed) return
		const updated = userPlannedBannerData.filter(
			(b) =>
				b.tempId ? b.tempId !== plannedBanner.tempId : b.id !== plannedBanner.id
		)
		setUserPlannedBannerData(updated)
	}

	// Keys of banners already on the sheet, excluding this row's own current selection.
	// Keyed by type+id, never by bare id — uma and support banners have independent
	// primary keys, so a bare id would make an uma banner block its same-date
	// support counterpart (see plannedBannerKey).
	const alreadyPlannedBannerKeys = new Set(
		userPlannedBannerData
			.filter((b) => {
				const isCurrentRow =
					(b.id !== undefined && b.id === plannedBanner.id) ||
					(b.tempId !== undefined && b.tempId === plannedBanner.tempId)
				return !isCurrentRow
			})
			.map(plannedBannerKey)
			.filter((key): key is BannerKey => key !== null)
	)

	/** This row's select only ever offers banners of its own type. */
	const optionKey = (option: BannerOption): BannerKey =>
		bannerKey(bannerType, option.value.id)

	const handleBannerSelect = (option: SingleValue<BannerOption>): void => {
		if (!option) return
		if (alreadyPlannedBannerKeys.has(optionKey(option))) {
			toast.error("This banner is already in your calculator.")
			return
		}
		const updated = updateBannerInList((banner) => ({
			...banner,
			...bannerTargetFields(bannerType, option.value),
		}))
		// Start date, ties broken by banner kind — see comparePlannedBanners.
		// Rows with no resolvable timeline sort last instead of throwing.
		const sorted = updated.sort(comparePlannedBanners)
		setUserPlannedBannerData(sorted)
	}

	const handlePullCountChange = (count: number): void => {
		// Arrives already whole and non-negative — NumberField owns that, and its
		// sanitise() carries the note on why a decimal must never reach
		// getExactProbability (which assumes integer trials) or the carat
		// deduction.
		//
		// Deliberately NOT capped at maxPossiblePulls. Planning past what you can
		// afford is a legitimate thing to want to see — applyPullStrategy turns
		// the shortfall into a negative carat balance that carries to later
		// banners, and pullStatus below surfaces it as a red field rather than
		// silently rewriting what the user typed.
		const updated = updateBannerInList((banner) => ({
			...banner,
			number_of_pulls: count
		}))
		setUserPlannedBannerData(updated)
	}

	// A banner that has already ended can fund nothing, so its bound is 0 — any
	// leftover pulls on it correctly read as unachievable.
	const pullUpperBound = typeof maxPossiblePulls === "number" ? maxPossiblePulls : 0

	// The same "Passed" gate the pull column gets. A step-up row's engine fields
	// are optional (absent on every other kind), so the fallback is 0 rather
	// than a non-null assertion.
	const maxPossibleSteps: number | "Passed" = bannerHasEnded
		? "Passed"
		: resources.maxPossibleSteps ?? 0
	const stepUpperBound =
		typeof maxPossibleSteps === "number" ? maxPossibleSteps : 0

	// number_of_pulls carries STEPS on a step-up row — one column, two meanings,
	// deliberately (see the plan's decision record). Everything downstream reads
	// it through this pair rather than reaching for the field.
	const plannedCount = plannedBanner.number_of_pulls
	const countStatus = isStepUp
		? getStepCountStatus(plannedCount, stepUpperBound)
		: getPullCountStatus(plannedCount, pullUpperBound)

	const hasBanner = target.type !== "Empty"

	const freePulls = getFreePulls(plannedBanner)

	// A step-up has no featured cards — the player picks their own from the back
	// catalogue — so it contributes none here.
	const images =
		target.type === "Uma"
			? target.banner.umas
			: target.type === "Support"
			? target.banner.support_cards
			: []

	// The campaign's cutoff, folded onto the banner by the backend exactly as it
	// is onto a selector product. Read from there rather than joining
	// anniversary_event_data: one place resolves the cutoff, and it is the server.
	const stepUpCutoff =
		target.type === "StepUp" ? target.banner.jp_cutoff_date : null

	// Which pool the step-up draws from, in the game's own shorthand. Doubles as
	// the placeholder art until a campaign image is uploaded, so the row reads
	// correctly before Phase 6's content lands.
	const stepUpChip =
		target.type === "StepUp"
			? target.banner.card_type === "support"
				? "SSR"
				: "★3"
			: null

	// Why the row shows a cutoff at all: a step-up's candidates are back-catalogue
	// cards, so a user could otherwise plan one for a unit it could never offer.
	const stepUpCutoffHint = stepUpCutoff
		? `Choose from ${stepUpChip} cards released on JP by ${formatDate(stepUpCutoff)}`
		: "This campaign has no JP release cutoff on its candidates"

	// The step 5 pick's art (null on non-step-up rows). See resolveGuaranteedCard.
	const guaranteedCard =
		target.type === "StepUp"
			? resolveGuaranteedCard(
					target.banner,
					userStepUpSelectionData,
					umaBannerData,
					supportBannerData
				)
			: null

	// Hoisted above the images cell because the cell links to this banner's
	// window on the Timeline; the date column further down reads the same value.
	const bannerTimeline = plannedBannerTimeline(plannedBanner)

	/**
	 * Where the card art points: this row's banner window on the Timeline.
	 *
	 * The sheet shows what a banner COSTS. What is actually on it — every
	 * featured card beyond the two that fit, the campaign it belongs to, its
	 * artwork — lives on the Timeline, and the thumbnails are the natural handle
	 * for "show me this banner". Keyed on the BannerTimeline rather than the
	 * BannerUma/Support/StepUp because concurrent banners share one timeline
	 * card; see utils/timelineFocus.ts.
	 *
	 * Null on a row with no banner picked yet, which renders the cell unlinked.
	 */
	const timelineHref = bannerTimeline
		? timelineFocusHref({ kind: "banner", id: bannerTimeline.id })
		: null

	/** The images cell, shared by the desktop grid and (via props) the card. */
	const imagesCell =
		target.type === "StepUp" ? (
			guaranteedCard ? (
				<img
					src={guaranteedCard.image}
					alt={guaranteedCard.name}
					className="thumb-banner"
					title={`Guaranteed at step 5: ${guaranteedCard.name}`}
				/>
			) : target.banner.image ? (
				<img
					src={target.banner.image}
					alt={target.banner.name}
					className="thumb-banner"
					title={stepUpCutoffHint}
				/>
			) : (
				// Typographic fallback so the cell is never blank before the art is
				// uploaded. The cutoff rides with it because this chip is exactly
				// the statement it qualifies: "★3 cards, released by this date".
				<div
					title={stepUpCutoffHint}
					className="flex flex-col items-center justify-center leading-none"
				>
					<span className="step-up-pool-chip text-sm font-bold text-purple-300">{stepUpChip}</span>
					{stepUpCutoff && (
						<span className="mt-0.5 text-[9px] text-gray-400">
							≤ {formatDate(stepUpCutoff)}
						</span>
					)}
				</div>
			)
		) : (
			<>
				{images.slice(0, 2).map((img) => (
					<img
						key={img.name}
						src={img.image}
						alt={img.name}
						className={`thumb-banner ${bannerType === "Uma" ? "thumb-banner--uma" : ""}`}
					/>
				))}
				<ExtraCardsBadge hidden={images.length - 2} />
			</>
		)

	// A step-up's odds run on steps x 10 pulls at the pool rate, with a
	// guarantee per completed round — none of which the standard binomial over
	// `pulls` would get right. Built from chargeableSteps rather than the raw
	// input so the odds and the carat deduction agree about how many steps
	// happened. See stepUpCopyDistribution.
	const stepUpOdds = isStepUp
		? stepUpCopyDistribution(resources.chargeableSteps ?? 0, constants)
		: undefined

	// Which options get the gold wash. An option already in the calculator keeps
	// its greying instead: it is no longer a suggestion.
	const isWashedOption = (option: BannerOption): boolean =>
		isRecommendedBanner(option.value, bannerType) &&
		!alreadyPlannedBannerKeys.has(optionKey(option))

	const renderBannerSelect = (styles: import("react-select").StylesConfig<BannerOption, false>) => (
		<Select<BannerOption>
			className="w-full"
			styles={withRecommendedOption<BannerOption>(
				{
					...styles,
					menuPortal: (base) => ({ ...base, zIndex: 9999 })
				},
				isWashedOption
			)}
			menuPortalTarget={document.body}
			menuPosition="fixed"
			// Phrased as the action, not as a heading. "Target Support Banner" is a
			// noun phrase and read as this card's title rather than as an empty
			// field waiting to be filled — the same thing the transparent control
			// styling was doing (see mobileBannerSelectStyles).
			placeholder={isStepUp ? "Select a step-up campaign…" : `Select a ${bannerType.toLowerCase()} banner…`}
			value={
				currentBanner
					? { value: currentBanner, label: currentBanner.name, key: currentBanner.id }
					: null
			}
			onChange={handleBannerSelect}
			formatOptionLabel={(option) => {
				const planned = alreadyPlannedBannerKeys.has(optionKey(option))
				return (
					<span className={planned ? "text-gray-500" : ""}>
						{/* The same mark in the open menu and on the chosen value. */}
						{isRecommendedBanner(option.value, bannerType) && (
							<RecommendedMark muted={planned} />
						)}
						{option.label}
						{planned && <span className="ml-1 text-xs">(in calculator)</span>}
					</span>
				)
			}}
			options={targetBannerData
				.filter((banner) => isSelectableBanner(banner, currentDate))
				.map((banner) => ({
					value: banner,
					label: banner.name,
					key: banner.id
				}))}
		/>
	)

	const bannerSelect = renderBannerSelect(
		compactSelectStyles as import("react-select").StylesConfig<BannerOption, false>
	)
	const mobileBannerSelect = renderBannerSelect(
		mobileBannerSelectStyles as import("react-select").StylesConfig<BannerOption, false>
	)

	const dateDisplay = bannerTimeline ? (
		<div className="flex flex-col gap-0.5">
			{/* ALWAYS one per line, at every card width. Side by side these two want
			    ~234px and the card's date track can only spare ~150 of a 390px
			    viewport, which used to push "End: …" out under the pulls field —
			    and a range that reads down at one width and across at the next is
			    harder to scan than one that always reads down. The desktop table
			    stacks them too; it renders its own pair, not this. */}
			<div className="flex flex-col text-xs leading-snug text-gray-400 @max-[18rem]:text-[11px]">
				<div>Start: <span className="text-gray-100">{formatDate(bannerTimeline.start_date)}</span></div>
				<div>End: <span className="text-gray-100">{formatDate(bannerTimeline.end_date)}</span></div>
			</div>
			{isStepUp && stepUpCutoff && (
				// Phone cards have vertical room the h-16 desktop track does not, so
				// the cutoff is spelled out here and rides the images chip there.
				<div className="text-xs text-gray-400" title={stepUpCutoffHint}>
					JP cutoff: <span className="text-gray-100">{formatDate(stepUpCutoff)}</span>
				</div>
			)}
		</div>
	) : (
		<span className="text-xs text-gray-600">–</span>
	)

	// Single source of truth for the derived-stats strip. Both the mobile card
	// and the desktop grid render from this list, so a stat is added or reworded
	// in ONE place — two hand-synced copies of the same boxes is exactly the
	// drift that leaves one layout a stat behind the other.
	// Labels follow the source spreadsheet this calculator is modelled on
	// ("Carat Est.", "Paid Carat Est.", "Free/Tickets/Paid"), so users coming
	// from the sheet read the same vocabulary. `title` carries the long form.
	//
	// Two of the four boxes say something different on a step-up row. That is how
	// the source sheet's header swaps (Max Pulls→Max Steps, Misc Pulls→Step #)
	// are honoured without touching the shared header: our headers are global to
	// the table, but this strip is per row, so the relabel lands exactly where
	// the meaning changes. Same four boxes, same widths —
	// --container-banner-table does not move. See frontend/docs/ui-conventions.md.
	const derivedStats: {
		label: string
		value: string
		title: string
		valueClass?: string
	}[] = [
		isStepUp
			? {
					label: "Step #",
					// Where this plan reaches on the ladder. "5x2-3" is two completed
					// banners plus three steps into a third.
					value: resources.stepLabel ?? "0",
					title: "How far up the ladder this plan reaches. 5xN means N completed banners; a trailing -r is r steps into the next one",
			  }
			: {
					// Unspaced slashes, matching formatDate's a/b/c. No thousands separators
					// here — these are small counts and commas would collide with the slashes.
					label: "Free/Tickets/Paid",
					value: `${freePulls || 0}/${ticketPulls}/${paidPulls}`,
					title: "Pulls you don't pay free carats for: the banner's free pulls, matching tickets, and pulls funded by paid carats",
			  },
		{
			label: "Carat Est.",
			value: displayFreeCarats.toLocaleString(),
			title: "Estimated free (earned) carats available for this banner",
			valueClass: "text-brand",
		},
		{
			label: "Paid Carat Est.",
			value: displayPaidCarats.toLocaleString(),
			title: "Estimated paid (purchased) carats available for this banner",
			valueClass: "text-brand",
		},
		isStepUp
			? {
					label: "Max Steps",
					value: String(maxPossibleSteps),
					title: "The most steps you could climb here before your paid carats or the campaign's banners run out",
			  }
			: {
					label: "Max Pulls",
					value: String(maxPossiblePulls),
					title: "The most pulls this banner could support if every available resource went into it",
			  },
	]

	// The pull ceiling, rendered beside the pulls field rather than in the strip
	// below — see MobileBannerCard's `maxCount`. Built from derivedStats[3] rather
	// than from `maxPossiblePulls` directly so the step-up relabel (Max Pulls →
	// Max Steps) keeps happening in exactly one place.
	//
	// The value sits in its own h-9 box so its baseline lands where the adjacent
	// input's does; without it the pair floats above a field twice its height.
	const maxCountCell = (
		<div title={derivedStats[3].title} className="flex min-w-0 flex-col items-center">
			<span className="banner-stat-box-label mb-0.5 whitespace-normal">{derivedStats[3].label}</span>
			<span className={`banner-stat-box-value flex h-9 items-center ${derivedStats[3].valueClass ?? ""}`}>
				{derivedStats[3].value}
			</span>
		</div>
	)

	// Three across in a single row. Two rows of two is what the fourth box used to
	// force; with it moved up beside the pulls field, the remaining three fit one
	// row and the strip costs a line instead of two.
	//
	// The label may wrap ("Free/Tickets/Paid" is the long one) rather than being
	// clipped — a ~320px card gives each box about 93px, which is the width that
	// label wants exactly. Growing the row there beats truncating a label that
	// names what the number underneath it means.
	const mobileStatCell = (stat: typeof derivedStats[number], index: number) => (
		<div
			key={stat.label}
			title={stat.title}
			className={`flex min-w-0 flex-col items-center justify-center px-1 py-1.5 text-center${index < 2 ? " border-r border-gray-700" : ""}`}
		>
			<span className="banner-stat-box-label whitespace-normal">{stat.label}</span>
			<span className={`banner-stat-box-value ${stat.valueClass ?? ""}`}>{stat.value}</span>
		</div>
	)

	// ONE stats strip, at every card width. There used to be a second, wider
	// treatment from `sm:` — an inset panel with a 2x2 estimate grid — which meant
	// the card had two quite different looks inside the range where cards render
	// at all: viewport >= 640px but container < --container-banner-table still got
	// the roomy one. The card/table switch is a CONTAINER query and the card's own
	// internals were on VIEWPORT queries, so the two disagreed by design. Nothing
	// inside the card may key off the viewport now; if a stat ever needs a wider
	// layout again it belongs behind a `@`-variant on the same container.
	//
	// The strip runs EDGE TO EDGE — no inset card, no rounded border of its own.
	// It reads as another band of the card (like the dates/pulls row above it)
	// instead of a panel floating inside one, and that drops both the 24px gutter
	// MobileBannerCard used to add and the strip's own border inset.
	const statsDisplay = (
		<>
			{/* Three boxes, not four — the fourth (Max Pulls / Max Steps) is up in
			    the number band, beside the field it bounds. */}
			<div className="grid grid-cols-3">
				{derivedStats.slice(0, 3).map(mobileStatCell)}
			</div>
			<div className="border-t border-gray-700">
				{hasBanner ? (
					<MLBChanceDisplay pulls={plannedCount} plannedBanner={plannedBanner} reservedCopies={fundedReservedCopies} distribution={stepUpOdds} />
				) : (
					<div className="py-2.5 text-center text-xs text-gray-500">Select a banner</div>
				)}
			</div>
		</>
	)

	// WCAG 1.4.1 — color can't be the only carrier of this state. The same
	// information goes out as a tooltip and, for the failure case, as
	// aria-invalid, so it survives colorblindness and screen readers.
	//
	// Both kinds say the same three things — unaffordable, cleanly completed,
	// or stranded part-way — about different units, so the wording is per kind
	// while the states are shared.
	const countStatusHint = isStepUp
		? countStatus === "over"
			? `More steps than you can afford here (max ${stepUpperBound})`
			: countStatus === "ok"
			? "A completed ladder: every carat bought a full banner, guarantee included"
			: `Stops part-way up a ladder (${STEPS_PER_ROUND} steps complete one)`
		: countStatus === "over"
		? `More pulls than you can afford here (max ${pullUpperBound})`
		: countStatus === "ok"
		? "On a pity threshold, with no carats left in a partial counter"
		: `Not on a pity threshold (a multiple of ${PULLS_PER_PITY_COPY} pulls)`

	const countLabel = isStepUp ? "Number of steps" : "Number of pulls"

	const handleReservedChange = (copies: number): void => {
		// Whole and non-negative via NumberField, and deliberately NOT capped at
		// what's affordable — an over-reserve is shown, not prevented.
		setUserPlannedBannerData(
			updateBannerInList((banner) => ({ ...banner, reserved_copies: copies }))
		)
	}

	// WCAG 1.4.1 again — the red state also travels as a tooltip and aria-invalid.
	const reservedHint =
		reservedStatus === "over"
			? `${reservedFunding.unfunded} more ${
					reservedFunding.unfunded === 1 ? "copy" : "copies"
				} than you have selectors or crystals for`
			: fundedReservedCopies > 0
			? `${reservedFunding.selectors} from selectors, ${reservedFunding.crystals} from SSR crystals`
			: bannerType === "Uma"
			? "Copies taken with an uma selector instead of pulling"
			: "Copies taken with a support selector or SSR crystal instead of pulling"

	// The affordable ceiling in whichever unit this row counts in. Only the pad's
	// "Max" chip reads it — the deltas step straight past it, because planning
	// past your budget is shown as a red field rather than prevented (the same
	// rule handlePullCountChange above is written to preserve).
	const countUpperBound = isStepUp ? stepUpperBound : pullUpperBound

	const countChips = buildCountChips({
		isStepUp,
		upperBound: countUpperBound,
		pullsPerPity: PULLS_PER_PITY_COPY,
		stepsPerRound: STEPS_PER_ROUND,
	})

	// ONE node, rendered by both the phone card and the desktop cell below. They
	// used to hold separate copies of the same NumberField with the same five
	// state-carrying attributes — precisely the drift renderReservedInput's
	// factory exists to prevent. Both want `w-14`, so a shared node does here
	// what that factory does there, and the stepper is wired up once.
	const pullsInput = (
		<CountStepper
			value={plannedCount}
			onChange={handlePullCountChange}
			chips={countChips}
			label={isStepUp ? "Steps" : "Pulls"}
		>
			<NumberField
				value={plannedCount}
				className={`pull-input pull-input--${countStatus} w-14`}
				title={countStatusHint}
				ariaLabel={countLabel}
				ariaInvalid={countStatus === "over"}
				// The keyboard mirror of the pad's delta row. A step-up gets no
				// large step: its ladder tops out around 25, so there is no third
				// quantity for Ctrl to mean.
				mediumStep={isStepUp ? STEPS_PER_ROUND : 10}
				largeStep={isStepUp ? undefined : PULLS_PER_PITY_COPY}
				onChange={handlePullCountChange}
			/>
		</CountStepper>
	)
	// Parameterised by width rather than written out twice: the mobile card and
	// the desktop cell differ only in how wide they are, and the five attributes
	// that carry this field's state (status class, title, aria-label,
	// aria-invalid, disabled) must never drift between the two copies. Same
	// factory shape as renderBannerSelect above.
	const renderReservedInput = (widthClass: string) => (
		<div className={`flex ${widthClass} flex-col items-center gap-0.5`}>
			<NumberField
				value={plannedBanner.reserved_copies}
				className={`pull-input pull-input--${reservedStatus} ${widthClass}`}
				title={reservedHint}
				ariaLabel="Copies obtained without pulling"
				ariaInvalid={reservedStatus === "over"}
				disabled={!hasBanner}
				onChange={handleReservedChange}
			/>
			{plannedBanner.reserved_copies > 0 && (
				// Abbreviated to fit the 5rem track. Widening it would push
				// --container-banner-table past the ceiling documented in
				// frontend/docs/ui-conventions.md, moving the card/table switch
				// point later for everyone. The full wording is in the title,
				// which this shares with the input.
				<span
					title={reservedHint}
					className={`text-[10px] leading-tight ${
						reservedStatus === "over" ? "status-over-text" : "text-gray-400"
					}`}
				>
					{reservedStatus === "over"
						? `${fundedReservedCopies}/${plannedBanner.reserved_copies}`
						: `${reservedFunding.selectors}s ${reservedFunding.crystals}c`}
				</span>
			)}
		</div>
	)

	return (
		<>
		<MobileBannerCard
			bannerType={bannerType}
			images={images}
			imagesSlot={isStepUp ? imagesCell : undefined}
			imagesHref={timelineHref}
			bannerSelect={mobileBannerSelect}
			dates={dateDisplay}
			maxCount={maxCountCell}
			summary={statsDisplay}
			pullsInput={pullsInput}
			reservedInput={renderReservedInput("w-14")}
			chanceDisplay={null}
			onRemove={handleDeleteBannerClick}
			removeLabel="Delete banner"
		/>

		{/* Column widths come from .banner-grid (App.css), shared with the header
		    row and StagedBannerRow — never re-declare a width on a cell here. */}
		<div className="banner-grid hidden w-full items-stretch bg-gray-800 h-16 @banner-table:grid">
			{/* === Type badge (square block on left) === */}
			<BannerTypeBadge type={bannerType} />

			{/* === Images section === */}
			<div className="relative flex items-center justify-center gap-1.5 py-1 px-1">
				{/* The link carries the cell's own flex box so wrapping moves nothing.
				    An unselected row has no banner to link to and stays inert. */}
				{timelineHref ? (
					<Link
						to={timelineHref}
						title={`View ${bannerTimeline?.name ?? "this banner"} on the timeline`}
						className="flex items-center justify-center gap-1.5"
					>
						{imagesCell}
					</Link>
				) : (
					imagesCell
				)}
			</div>

			{/* === Banner select === */}
			<div className="flex items-center justify-center py-2 px-2">
				{bannerSelect}
			</div>

			{/* === Start / End Date === */}
			<div className="flex min-w-0 flex-col items-start justify-center gap-0.5 py-2 px-1 text-xs text-gray-400 relative">
				<div className="absolute right-0 top-3 bottom-3 w-px bg-gray-700" />
				{bannerTimeline ? (
					<>
						<span>Start: <span className="text-gray-100">{formatDate(bannerTimeline.start_date)}</span></span>
						<span>End: <span className="text-gray-100">{formatDate(bannerTimeline.end_date)}</span></span>
					</>
				) : (
					<span className="text-gray-600">–</span>
				)}
			</div>

			{/* === Derived Stats section === */}
			{/* px-1 and compact stat padding keep the four boxes within this tighter
			    track without clipping their labels. */}
			<div className="flex min-w-0 items-center justify-center px-1 py-2">
				{/* Same `derivedStats` list as the mobile card above — one strip
				    instead of 2x2, with rule dividers between the boxes. */}
				<div className="flex items-stretch rounded-lg bg-gray-700 border border-gray-600 overflow-hidden w-full">
					{derivedStats.map((stat, statIndex) => (
						<React.Fragment key={stat.label}>
							{statIndex > 0 && <div className="w-px bg-gray-600 self-stretch" />}
							<div title={stat.title} className="flex flex-col items-center justify-center px-1 py-1.5 flex-1">
								<span className="banner-stat-box-label">{stat.label}</span>
								<span className={`banner-stat-box-value ${stat.valueClass ?? ""}`}>{stat.value}</span>
							</div>
						</React.Fragment>
					))}
				</div>
			</div>

			{/* === # Pulls section === */}
			<div className="flex items-center justify-center py-2 px-1 relative">
				<div className="absolute left-0 top-3 bottom-3 w-px bg-gray-700" />
				<div className="absolute right-0 top-3 bottom-3 w-px bg-gray-700" />
				{pullsInput}
			</div>

			{/* === Reserved copies === */}
			{/* py-0.5, not the py-2 its neighbours use. The input (h-11) plus the
			    2px gap and the 12.5px funding hint below it need 58.5px, and py-2
			    leaves only 48px inside this h-16 row — the hint would clip. py-0.5
			    gives 60px. Widening the TRACK instead is not an option; see the
			    ceiling on --container-banner-table in
			    frontend/docs/ui-conventions.md. */}
			<div className="flex items-center justify-center py-0.5 px-1 relative">
				<div className="absolute right-0 top-3 bottom-3 w-px bg-gray-700" />
				{renderReservedInput("w-14")}
			</div>

			{/* === MLB chance grid === */}
			<div className="flex items-center justify-center py-2 px-2 min-w-0">
				{hasBanner ? (
					<MLBChanceDisplay
						pulls={plannedCount}
						plannedBanner={plannedBanner}
						reservedCopies={fundedReservedCopies}
						distribution={stepUpOdds}
					/>
				) : (
					<div className="w-full text-center text-xs text-gray-500">Select a banner</div>
				)}
			</div>

			{/* === Delete button === */}
			<button onClick={handleDeleteBannerClick} className="banner-delete-btn">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
					<polyline points="3 6 5 6 21 6" />
					<path d="M19 6l-1 14H6L5 6" />
					<path d="M10 11v6" />
					<path d="M14 11v6" />
					<path d="M9 6V4h6v2" />
				</svg>
			</button>
		</div>
		</>
	)
}
