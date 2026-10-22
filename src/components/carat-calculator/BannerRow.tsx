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
import React, { useState } from "react"
import { Link } from "react-router-dom"
import { BannerNoteButton, BannerNoteEditor } from "./BannerNote"
import { RowOptionsPanel } from "./RowOptionsPanel"
import type { PullShortcut, RowOptionsChange } from "./RowOptionsPanel"
import {
	hasRowOptions,
	isExcludedFromProjection,
	pullsAlreadyMade,
	pullsForChance,
	pullsToNextExchange,
} from "../../utils/rowOptions"
import { startOfDay } from "date-fns"
import Select from "react-select"
import type { SingleValue } from "react-select"
import { toast } from "sonner"
import { MLBChanceDisplay } from "./MLBChanceDisplay"
import { oddsTarget, oddsTargetChoices } from "../../utils/oddsDisplay"
import { OddsCaption, OddsCardsPanel } from "./OddsCards"
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
	calculateCopyDistribution,
	twoCardDistribution,
	shiftDistribution,
} from "../../utils/probabilityCalculations"
import { oddsCards } from "../../utils/rateUpRates"
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
import { FramedUma } from "../FramedUma"
import { useOshiIds } from "../../hooks/useOshiIds"
import { usePhoneOddsHidden } from "../../hooks/usePhoneOddsHidden"
import { ChevronDown } from "lucide-react"
import { BannerTypeBadge } from "./BannerTypeBadge"
import { TrashIcon } from "./TrashIcon"
import { CountStepper } from "./CountStepper"
import { buildCopyChips, buildCountChips, coarsePullDelta } from "../../utils/countChips"

// Static, so built once rather than per render.
const copyChips = buildCopyChips()

// The row options' "Set pulls" shortcuts, switched off for now (owner,
// 2026-10-16). The maths and the panel's rendering stay in place, so turning
// them back on is this one line.
const SHOW_PULL_SHORTCUTS = false

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
	/**
	 * The last banner row on screen. Its bulk-adjust pads open above their
	 * fields (CountStepper preferAbove), since below it is only the sheet's edge.
	 */
	isLastRow?: boolean
}

/**
 * The row options drawer's edge, one per kind: a bar in the row's type colour
 * (the same --color-type-* fill as its badge) so the drawer reads as this
 * row's. See .row-drawer in App.css.
 */
const ROW_DRAWER_CLASS: Record<BannerRowType, string> = {
	Uma: "row-drawer row-drawer--uma",
	Support: "row-drawer row-drawer--support",
	StepUp: "row-drawer row-drawer--step-up",
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
	initialBannerType,
	isLastRow = false
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
	// The person's favorite umas, drawn in the rainbow frame (FramedUma).
	const oshiIds = useOshiIds()
	// Phone cards only: one device-wide switch that folds every card's odds strip.
	const phoneOdds = usePhoneOddsHidden()

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
	// Pulls already made on this banner (a row option). They are rolled for
	// nothing and cost nothing; they only move the banner's 200-pull counter,
	// which the odds and the green "on a threshold" state both read. Never on
	// a step-up, whose ladder has no exchange.
	const alreadyMade = isStepUp ? 0 : pullsAlreadyMade(plannedBanner)
	const countStatus = isStepUp
		? getStepCountStatus(plannedCount, stepUpperBound)
		: getPullCountStatus(plannedCount, pullUpperBound, alreadyMade)
	// Left out of the projection: the row shows what it would cost but spends
	// nothing (useBannerResources skips its banking), so its numbers are dimmed
	// and a notice says why.
	const excluded = isExcludedFromProjection(plannedBanner)

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

	// The row's own banner, named as its select names it. Never
	// bannerTimeline.name: a support banner shares its timeline card with the
	// uma banner running alongside it, and that card is named after the uma, so
	// the link's tooltip (and a screen reader) would announce the wrong banner.
	const bannerName = currentBanner?.name ?? "this banner"

	/** The images cell, shared by the desktop grid and (via props) the card. */
	const imagesCell =
		target.type === "StepUp" ? (
			guaranteedCard?.uma ? (
				<FramedUma
					src={guaranteedCard.uma.portrait ?? guaranteedCard.image}
					alt={guaranteedCard.name}
					oshi={oshiIds.has(guaranteedCard.uma.id)}
					title={`Guaranteed at step 5: ${guaranteedCard.name}`}
					className="w-14"
				/>
			) : guaranteedCard ? (
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
					<span className="step-up-pool-chip text-sm font-bold text-step-up">{stepUpChip}</span>
					{stepUpCutoff && (
						<span className="mt-0.5 text-[9px] text-gray-400">
							≤ {formatDate(stepUpCutoff)}
						</span>
					)}
				</div>
			)
		) : (
			<>
				{target.type === "Uma"
					? target.banner.umas.slice(0, 2).map((uma) => (
							<FramedUma
								key={uma.id}
								src={uma.portrait ?? uma.image}
								alt={uma.name}
								oshi={oshiIds.has(uma.id)}
								className="w-14"
							/>
						))
					: images.slice(0, 2).map((img) => (
							<img key={img.name} src={img.image} alt={img.name} className="thumb-banner" />
						))}
				<ExtraCardsBadge hidden={images.length - 2} />
			</>
		)

	// --- Odds ---
	// Which featured cards the strip is about: the row's saved choices, checked
	// against the banner (a stale id falls back rather than breaking). Null on a
	// step-up or an empty row, which have no featured cards to choose from.
	const chosenCards =
		target.type === "Uma" || target.type === "Support"
			? oddsCards(target, plannedBanner, constants)
			: null

	// The six percentages the strip shows, final: pity, funded reserved copies
	// and the second card are all applied here, not in MLBChanceDisplay.
	//
	// A step-up's run on steps x 10 pulls at the pool rate, 1-in-10 slots on
	// steps 3 and 4, and a guaranteed pick on step 5 — none of which the
	// standard binomial over `pulls` would get right. Built from chargeableSteps
	// rather than the raw input so the odds and the carat deduction agree about
	// how many steps happened. See stepUpCopyDistribution.
	//
	// An ordinary banner's run at its chosen card's own rate, which is 0.75%
	// only on a typical banner (utils/rateUpRates.ts). With a second card the
	// strip switches to "the first at its target, and the second at each
	// level". The reserved copies then join the 200-pull exchanges as one pot
	// of free copies, spent on the first card up to its target and then on
	// the second: a selector or a crystal buys whichever card still needs it.
	//
	// The target is the row's saved choice from the panel's toggle, else the
	// default for the banner type (one copy of an uma, MLB of a support).
	// Declared before `odds` because the maths reads it.
	const oddsGoal = oddsTarget(plannedBanner)
	const odds =
		target.type === "StepUp"
			? shiftDistribution(
					stepUpCopyDistribution(resources.chargeableSteps ?? 0, constants),
					fundedReservedCopies
				)
			: chosenCards === null
				? null
				: chosenCards.primary && chosenCards.second
					? twoCardDistribution({
							pulls: plannedCount,
							rateA: chosenCards.primary.rate,
							rateB: chosenCards.second.rate,
							reservedCopies: fundedReservedCopies,
							targetA: oddsGoal.copies,
							priorPulls: alreadyMade,
						})
					: shiftDistribution(
							calculateCopyDistribution(
								plannedCount,
								chosenCards.primary?.rate ?? constants.rate_up_rate_3,
								alreadyMade
							),
							fundedReservedCopies
						)

	// Open/closed is view state, like the note's: it is not part of the plan and
	// must not trigger a save. One flag drives both form factors.
	const [oddsPanelOpen, setOddsPanelOpen] = useState(false)

	// Only a banner with a choice to make gets the control. On a one-card
	// banner the strip stays exactly as it always was.
	const canChooseCards =
		chosenCards !== null && chosenCards.primary !== null && chosenCards.cards.length > 1

	const handlePrimaryCardChange = (id: number): void => {
		const previous = chosenCards?.primary?.id ?? null
		setUserPlannedBannerData(
			updateBannerInList((banner) => ({
				...banner,
				primary_card: id,
				// Picking the second card as the first swaps the two, so two-card
				// odds stay on instead of quietly pairing a card with itself.
				second_card: banner.second_card === id ? previous : banner.second_card,
			}))
		)
	}

	const handleSecondCardChange = (id: number | null): void => {
		setUserPlannedBannerData(
			updateBannerInList((banner) => ({ ...banner, second_card: id }))
		)
	}

	// The toggle's pick: 1 or MAX_COPIES. Saved on the row like the card ids,
	// so the caption, the cell prefixes and the numbers all follow one value.
	const handleTargetChange = (copies: number): void => {
		setUserPlannedBannerData(
			updateBannerInList((banner) => ({ ...banner, primary_target: copies }))
		)
	}

	// Set only while the strip shows joint odds: the first card's target cell,
	// which MLBChanceDisplay prefixes onto every label ("MLB & 1LB", "1x & 2x").
	const pairedTopLabel =
		canChooseCards && chosenCards.second ? oddsGoal.label : undefined

	const oddsCaption =
		canChooseCards && chosenCards.primary ? (
			<OddsCaption
				primary={chosenCards.primary}
				second={chosenCards.second}
				targetLabel={oddsGoal.label}
				open={oddsPanelOpen}
				onToggle={() => setOddsPanelOpen((open) => !open)}
			/>
		) : undefined

	const renderOddsPanel = (className: string) =>
		oddsPanelOpen && canChooseCards && chosenCards.primary ? (
			<OddsCardsPanel
				cards={chosenCards.cards}
				primary={chosenCards.primary}
				second={chosenCards.second}
				target={oddsGoal}
				targetChoices={oddsTargetChoices(plannedBanner)}
				onPrimaryChange={handlePrimaryCardChange}
				onSecondChange={handleSecondCardChange}
				onTargetChange={handleTargetChange}
				className={className}
			/>
		) : null

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
	//
	// Plain strings, never NumberFlow (web #156 tried it, reverted 2026-10-22).
	// Every row mounts both the card and the table strip, and one edit moves
	// the carats of every row after it, so a 20-row plan started hundreds of
	// digit animations per keystroke and players reported severe lag. The
	// monthly tiles in IncomeForm keep it: five numbers, not five per row.
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
				{odds ? (
					<>
						{/* The fold switch. Its own thin bar rather than a button on the
						    caption: the caption only exists on a banner with a card to
						    choose, and its chevron already opens the card picker. Folded,
						    this bar is all that is left of the odds, about 20px against
						    the strip's 45 to 58. */}
						<button
							type="button"
							onClick={phoneOdds.toggle}
							aria-expanded={!phoneOdds.hidden}
							title={phoneOdds.hidden ? "Show the odds on every card" : "Hide the odds on every card"}
							className="flex w-full items-center justify-center gap-1 bg-gray-800/60 py-0.5 text-[10px] font-medium text-gray-400 transition hover:text-gray-200"
						>
							{phoneOdds.hidden ? "Show odds" : "Hide odds"}
							<ChevronDown
								aria-hidden="true"
								className={`h-3 w-3 transition-transform ${phoneOdds.hidden ? "" : "rotate-180"}`}
							/>
						</button>
						{!phoneOdds.hidden && (
							<MLBChanceDisplay
								plannedBanner={plannedBanner}
								values={odds}
								header={oddsCaption}
								pairedWith={pairedTopLabel}
							/>
						)}
					</>
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
			? `A completed round (${STEPS_PER_ROUND} steps)`
			: `Stops partway through a round (${STEPS_PER_ROUND} steps)`
		: countStatus === "over"
		? `More pulls than you can afford here (max ${pullUpperBound})`
		: countStatus === "ok"
		? `On a pity threshold (a multiple of ${PULLS_PER_PITY_COPY} pulls)`
		: `Not on a pity threshold (a multiple of ${PULLS_PER_PITY_COPY} pulls)`

	const countLabel = isStepUp ? "Number of steps" : "Number of pulls"

	// --- Note ---
	// Open/closed is view state and stays local: it is not part of the plan and
	// must not trigger a save. One flag drives both form factors, since only one
	// of the card and the table row is ever visible.
	const [noteOpen, setNoteOpen] = useState(false)
	const note = plannedBanner.note ?? ""

	const handleNoteCommit = (nextNote: string): void => {
		setUserPlannedBannerData(
			updateBannerInList((banner) => ({ ...banner, note: nextNote }))
		)
	}

	// --- Row options ---
	// The panel the note button opens now holds the row's overrides too. Each
	// change is a partial row merged in, the same way the note commits.
	const handleRowOptionsChange = (change: RowOptionsChange): void => {
		setUserPlannedBannerData(updateBannerInList((banner) => ({ ...banner, ...change })))
	}

	// "Already pulled" only means something while the banner runs. Offered from
	// its start until it ends (bannerHasEnded's own cutoff).
	const isLive =
		!!bannerTimeline?.start_date &&
		new Date(bannerTimeline.start_date).getTime() <= currentDate.getTime() &&
		!bannerHasEnded

	// The "set my pulls" shortcuts. Built from the same odds the strip shows
	// (the chosen card's own rate, pulls already made, funded reserved copies),
	// so a shortcut can never land on a count whose strip disagrees with it.
	// The chance buttons chase oddsGoal, the target the strip's caption names.
	// The rate falls back exactly as the strip's does, for the same banner.
	const shortcutRate = chosenCards
		? chosenCards.primary?.rate ?? constants.rate_up_rate_3
		: undefined
	const pullShortcuts: PullShortcut[] = []
	if (
		SHOW_PULL_SHORTCUTS &&
		!isStepUp &&
		hasBanner &&
		!bannerHasEnded &&
		shortcutRate !== undefined
	) {
		const toExchange = pullsToNextExchange(alreadyMade, plannedCount)
		pullShortcuts.push({
			label: `Next exchange (${toExchange})`,
			pulls: toExchange,
			title: `Sets ${toExchange} pulls, enough for one more 200-pull exchange.`,
		})
		for (const chance of [0.5, 0.9]) {
			const pulls = pullsForChance({
				copies: oddsGoal.copies,
				chance,
				rate: shortcutRate,
				alreadyMade,
				guaranteed: fundedReservedCopies,
			})
			// 0 means the reserved copies already cover the target: nothing to set.
			if (pulls === 0) continue
			const percent = `${chance * 100}%`
			pullShortcuts.push({
				label: `${percent} at ${oddsGoal.label} (${pulls})`,
				pulls,
				title: `The fewest pulls for a ${percent} chance of ${oddsGoal.label}.`,
			})
		}
	}

	// Same factory shape as renderReservedInput below: the two form factors
	// differ only in the button's box, never in its state.
	const renderNoteButton = (className: string) => (
		<BannerNoteButton
			note={note}
			hasOptions={hasRowOptions(plannedBanner)}
			open={noteOpen}
			onToggle={() => setNoteOpen((open) => !open)}
			// A row with no banner chosen is never saved (toBannerPayload drops
			// it), so a note typed on it would vanish on reload.
			disabled={!hasBanner}
			className={className}
		/>
	)
	const renderNoteEditor = (className: string) =>
		noteOpen && hasBanner ? (
			<RowOptionsPanel
				plannedBanner={plannedBanner}
				isStepUp={isStepUp}
				ticketKind={bannerType === "Support" ? "support" : "uma"}
				ticketsSpent={resources.ticketsSpent}
				isLive={isLive}
				pullShortcuts={pullShortcuts}
				onChange={handleRowOptionsChange}
				onSetPulls={handlePullCountChange}
				className={className}
			>
				<BannerNoteEditor
					note={note}
					bannerName={bannerName}
					onCommit={handleNoteCommit}
				/>
			</RowOptionsPanel>
		) : null

	// Shown whether or not the panel is open: a row that spends nothing looks
	// like any other row otherwise, and the later rows' numbers depend on it.
	const renderExcludedNotice = (className: string) =>
		excluded && hasBanner ? (
			<div className={`text-xs text-gray-400 ${className}`}>
				Not counted: this banner spends nothing, so the banners after it don't see it.
			</div>
		) : null

	const handleReservedChange = (copies: number): void => {
		// Whole and non-negative via NumberField, and deliberately NOT capped at
		// what's affordable — an over-reserve is shown, not prevented.
		setUserPlannedBannerData(
			updateBannerInList((banner) => ({ ...banner, reserved_copies: copies }))
		)
	}

	// WCAG 1.4.1 again — the red state also travels as a tooltip and aria-invalid.
	//
	// The first branch explains the one shortfall the user can fix from another
	// page: a purchased selector pays only for the card picked for it, so one
	// with no pick yet funds nothing. A title attribute cannot hold a link, so
	// the copy names the page instead.
	const reservedHint =
		reservedStatus === "over" && resources.unpickedSelectorTickets > 0
			? "You have a selector with no card picked. Pick one on the Selectors page to use it here."
			: reservedStatus === "over"
			? `${reservedFunding.unfunded} more ${
					reservedFunding.unfunded === 1 ? "copy" : "copies"
				} than you have selectors or crystals for`
			: fundedReservedCopies > 0
			? `${reservedFunding.selectors} from selectors, ${reservedFunding.crystals} from SSR crystals`
			: bannerType === "Uma"
			? "Copies taken with an uma selector instead of pulling"
			: "Copies taken with a support selector or SSR crystal instead of pulling"

	// The pad's "Limit" chip jumps to what the step-up SELLS (max_steps), not to
	// what the carats can pay for: going past the budget is shown as a red field
	// rather than prevented (the same rule handlePullCountChange above is written
	// to preserve). Infinity until a banner is picked, which drops the chip.
	const stepLimit = target.type === "StepUp" ? target.banner.max_steps : Infinity

	const countChips = buildCountChips({
		rowType: bannerType,
		stepLimit,
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
			preferAbove={isLastRow}
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
				largeStep={coarsePullDelta(bannerType, PULLS_PER_PITY_COPY)}
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
			{/* A disabled field cannot take focus, so the pad never opens on a
			    row that has no copies to reserve. */}
			<CountStepper
				value={plannedBanner.reserved_copies}
				onChange={handleReservedChange}
				chips={copyChips}
				label="Copies"
				preferAbove={isLastRow}
			>
				<NumberField
					value={plannedBanner.reserved_copies}
					className={`pull-input pull-input--${reservedStatus} ${widthClass}`}
					title={reservedHint}
					ariaLabel="Copies obtained without pulling"
					ariaInvalid={reservedStatus === "over"}
					disabled={!hasBanner}
					onChange={handleReservedChange}
				/>
			</CountStepper>
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
			summary={excluded ? <div className="opacity-50">{statsDisplay}</div> : statsDisplay}
			notice={renderExcludedNotice("border-t border-gray-700 px-3 py-2")}
			pullsInput={pullsInput}
			reservedInput={renderReservedInput("w-14")}
			chanceDisplay={null}
			noteButton={renderNoteButton(
				"my-auto mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-(--tile-button-border) bg-black/10 transition hover:bg-black/25"
			)}
			oddsPanel={phoneOdds.hidden ? null : renderOddsPanel("border-t border-gray-700 p-2")}
			noteEditor={renderNoteEditor("border-t border-gray-700 p-2")}
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
						title={`View ${bannerName} on the timeline`}
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
			<div className={`flex min-w-0 items-center justify-center px-1 py-2 ${excluded ? "opacity-50" : ""}`}>
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
			{/* py-1 when the strip carries its caption line: strip (41px) plus
			    caption (13px) is 54px, and py-2 leaves only 48px inside this h-16
			    row. Same trade as the reserved cell's py-0.5 above. */}
			<div className={`flex items-center justify-center px-2 min-w-0 ${oddsCaption ? "py-1" : "py-2"} ${excluded ? "opacity-50" : ""}`}>
				{odds ? (
					<MLBChanceDisplay
						plannedBanner={plannedBanner}
						values={odds}
						header={oddsCaption}
						pairedWith={pairedTopLabel}
					/>
				) : (
					<div className="w-full text-center text-xs text-gray-500">Select a banner</div>
				)}
			</div>

			{/* === Note + delete === */}
			{/* Stacked in the ONE 2.5rem track. The note button gets no track of its
			    own because the fixed tracks already sum to the table's minimum width
			    (see the ceiling on --container-banner-table in
			    frontend/docs/ui-conventions.md); halving this h-16 cell still leaves
			    two 40x32px targets. */}
			<div className="flex flex-col">
			{renderNoteButton(
				"flex flex-1 items-center justify-center border-l border-b border-gray-700 bg-gray-800 transition hover:bg-gray-700 cursor-pointer"
			)}
			<button
				onClick={handleDeleteBannerClick}
				aria-label="Delete banner"
				title="Delete banner"
				className="banner-delete-btn flex-1"
			>
				<TrashIcon />
			</button>
			</div>
		</div>

		{/* The open note, as a strip under the table row. Outside the grid so the
		    row keeps its fixed h-16 and the columns stay aligned; the motion.div
		    around each row (CaratCalculator) animates the height change. */}
		{/* The odds-card picker, the same way: a strip under the row. */}
		{renderExcludedNotice(
			"hidden @banner-table:block border-t border-gray-700 bg-gray-800 px-3 py-1.5"
		)}
		{renderOddsPanel(
			"hidden @banner-table:flex border-t border-gray-700 bg-gray-800 px-3 py-2"
		)}
		{renderNoteEditor(
			`hidden @banner-table:flex border-t border-gray-700 bg-gray-800 px-3 py-2 ${ROW_DRAWER_CLASS[bannerType]}`
		)}
		</>
	)
}
