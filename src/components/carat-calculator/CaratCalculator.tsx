import type React from "react"
import { Fragment, useMemo } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { toast } from "sonner"
import { useCalculatorData } from "../../services/CalculatorContext"
import { BannerRow } from "./BannerRow"
import { IncomeForm } from "./IncomeForm"
import { StagedBannerRow } from "./StagedBannerRow"
import { ReservedColumnIcons, RESERVED_COLUMN_TITLE } from "./ReservedColumnIcons"
import { PlannerSectionBand } from "./PlannerSectionBand"
import { buildPlannerRows, SCENARIO_BANDS_ONLY } from "../../utils/plannerSections"
import { PlanSwitcher } from "./PlanSwitcher"
import { EMPTY_BANNER_RESOURCES } from "../../hooks/bannerResources"
import { useBannerResources } from "../../hooks/useBannerResources"
import {
	nextTempId,
	plannedBannerKey,
	plannedBannerTarget,
	comparePlannedBanners,
} from "../../utils/bannerHelpers"
import type { BannerRowType } from "../../utils/bannerHelpers"
import type { UserPlannedBanner } from "../../types"

/**
 * The three "add a row" buttons, in one place rather than three near-identical
 * blocks — the same reason `TYPE_STYLES` exists in MobileBannerCard. A fourth
 * banner kind is one entry here.
 *
 * `short` is what a phone shows; `full` is the accessible name at every width.
 * The step-up is outlined in its own purple rather than the brand colour its
 * neighbours share: it plans a different kind of thing (a paid-only cost ladder,
 * not pulls), and the row it creates carries that purple on its type badge.
 */
const ADD_BANNER_BUTTONS: {
	type: BannerRowType
	short: string
	full: string
	className: string
}[] = [
	{
		type: "Uma",
		short: "Uma",
		full: "New Uma Banner",
		className: "bg-brand text-black hover:bg-brand/90",
	},
	{
		type: "Support",
		short: "Support",
		full: "New Support Banner",
		className: "border border-brand bg-transparent text-brand hover:bg-brand/10",
	},
	{
		type: "StepUp",
		// "Step Up", unhyphenated, matching the type tile on the row this creates.
		short: "Step Up",
		full: "New Step-Up Banner",
		className: "step-up-add-button border bg-transparent",
	},
]

export const CaratCalculator: React.FC = () => {
	const {
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		leagueOfHeroesRankData,
		umaBannerData,
		supportBannerData,
		stepUpBannerData,
		userStepUpSelectionData,
		userPlannedBannerData,
		stagedBanners,
		anniversaryEventData,
		scenarioData,
		userPlannedPurchaseData,
		incomeLedger,
		calculationConstants,
		setUserPlannedBannerData,
		setStagedBanners,
	} = useCalculatorData()

	const bannerResources = useBannerResources({
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		leagueOfHeroesRankData,
		userPlannedBannerData,
		anniversaryEventData,
		userPlannedPurchaseData,
		incomeLedger,
		constants: calculationConstants,
	})

	// The sheet's render list: the same rows, with section bands interleaved for
	// the scenarios launching between the first and last banner.
	// Each row keeps its ORIGINAL index — bannerResources is positional against
	// userPlannedBannerData, so reading it by position in THIS list would
	// silently mis-attribute every row's resources once a band appears.
	// Scenario bands only, by constant rather than by setting — see
	// SCENARIO_BANDS_ONLY. anniversaryEventData is still passed because the
	// builder is what filters; the argument is not dead, it is just fully
	// filtered out today.
	const plannerRows = useMemo(
		() =>
			buildPlannerRows(
				userPlannedBannerData,
				scenarioData,
				anniversaryEventData,
				SCENARIO_BANDS_ONLY
			),
		[userPlannedBannerData, scenarioData, anniversaryEventData]
	)

	if (!userStatsData) {
		return <div>Loading...</div>
	}

	// Every click stages another row. The staging area is a queue, not a single
	// slot: a user planning several banners can line them all up, fill each one
	// in, and confirm them independently.
	const handleAddBanner = (bannerType: BannerRowType): void => {
		setStagedBanners((prev) => [
			...prev,
			{
				// From `prev`, never from the render-scoped stagedBanners — see nextTempId.
				tempId: nextTempId(userPlannedBannerData, prev),
				number_of_pulls: 0,
				reserved_copies: 0,
				initialBannerType: bannerType,
			} satisfies UserPlannedBanner,
		])
	}

	// Updates a single staged banner in the array when the user edits it.
	const handleUpdateStagedBanner = (updated: UserPlannedBanner): void => {
		setStagedBanners((prev) => prev.map((b) => (b.tempId === updated.tempId ? updated : b)))
	}

	const handleConfirmStagedBanner = (tempId: number): void => {
		const banner = stagedBanners.find((b) => b.tempId === tempId)
		if (!banner) return
		if (plannedBannerTarget(banner).type === "Empty") {
			toast.error("Please select a banner before adding it.")
			return
		}
		// Compare by type+id, never by bare id — uma and support banners have
		// independent primary keys, so a bare id would reject the same-date support
		// counterpart of an already-planned uma banner (see plannedBannerKey).
		// The null guard matters here too: two rows with no banner selected are not
		// duplicates of each other.
		const stagedKey = plannedBannerKey(banner)
		const isDuplicate = stagedKey !== null && userPlannedBannerData.some((b) => plannedBannerKey(b) === stagedKey)
		if (isDuplicate) {
			toast.error("This banner is already in your calculator.")
			return
		}

		// Sorted by start date, ties broken by banner kind — see
		// comparePlannedBanners. The tie-break matters most here: appending then
		// sorting would otherwise drop the new row BELOW every existing row
		// sharing its start date, purely because it was added last.
		const updated = [...userPlannedBannerData, banner].sort(comparePlannedBanners)

		setUserPlannedBannerData(updated)
		setStagedBanners((prev) => prev.filter((b) => b.tempId !== tempId))
	}

	const handleDiscardStagedBanner = (tempId: number): void => {
		setStagedBanners((prev) => prev.filter((b) => b.tempId !== tempId))
	}

	// The two section headings are gated SEPARATELY, and deliberately.
	//
	// They used to share one flag requiring BOTH sections to be populated, which
	// hid the "Staging" heading from the only people who needed it: a first-time
	// user has an empty calculator, so staging their first banner rendered an
	// unlabelled table that looked exactly like the sheet it isn't. The heading
	// only appeared once they had already worked it out.
	//
	// Staging is labelled whenever it exists. The calculator heading still needs
	// staging on screen to be worth drawing — with nothing staged there is only
	// one section, and naming it is noise.
	const showStagingLabel = stagedBanners.length > 0
	const showCalculatorLabel = stagedBanners.length > 0

	// The calculator section renders while EMPTY if something is staged, so the
	// staged row has a visible destination to contrast against — see the
	// empty-state placeholder below. With nothing staged and nothing planned
	// there is no section at all.
	const showCalculatorSection = userPlannedBannerData.length > 0 || stagedBanners.length > 0

	// Icon-only header, shared by the staging and sheet header rows below so the
	// two can't drift. Same icons the mobile card labels its Reserved cell with.
	const reservedHeaderCell = (
		<div className="flex items-center justify-center gap-1" title={RESERVED_COLUMN_TITLE}>
			<ReservedColumnIcons />
		</div>
	)

	return (
		<div className="w-full bg-gray-900">
			{/* The calculator gets a wider desktop canvas without changing Timeline's
			    shared .page-container. Income & Resources and the banner sheet share
			    this same width so their edges stay aligned. */}
			<div className="mx-auto w-full max-w-[96rem]">
				<div className="flex mx-2 flex-col items-center sm:mx-4">
					{/* Income inputs first, then the banner sheet they feed. IncomeForm
				    owns its own collapse state — it is a zero-prop panel like every
				    other one here, reading everything from the calculator context. */}
					{/* Square-cornered on a phone. With only an 8px gutter either side the
					    panel is all but full-bleed there, and a 12px radius on a band that
					    wide reads as a stray curve rather than a card — most visibly on the
					    Income & Resources header, which is the top edge. The BOTTOM corners
					    take the card shape back from `sm:`, where the gutter is wide enough to
					    earn it — but the TOP stays square at EVERY width, so the Income &
					    Resources header meets the band above it on a straight edge.

					    @container: IncomeForm's whole layout is keyed to THIS box's width
					    (`@income-wide:`, see --container-income-wide in index.css), so the
					    income panel and the banner sheet below it switch to their desktop
					    forms together. The sheet's own `@container`s are nested inside this
					    one and shadow it, so `@banner-table:` still measures the sheet's
					    box, not this one — that is the whole reason the two tokens differ
					    by the gutter. */}
					<div className="@container w-full overflow-hidden rounded-none border border-gray-600 bg-gray-900 shadow-sm sm:rounded-b-xl">
						<IncomeForm />

						<div className="border-t border-gray-700 pb-4">
							{/* Which plan the sheet below is showing, and the menu to switch.
							    Renders nothing at all for a guest, row padding included. */}
							<PlanSwitcher />
							{/* Add banner buttons — one row at EVERY width. Stacked, the three
							    of them cost ~156px of a phone screen before a single planner
							    row appeared; side by side they cost ~44px. */}
							<div className="flex w-full gap-2 px-3 py-3 sm:gap-4 sm:px-4 sm:py-4">
								{ADD_BANNER_BUTTONS.map((button, index) => (
									<Fragment key={button.type}>
										{index > 0 && (
											<div className="hidden w-px bg-gray-700 self-stretch sm:block" />
										)}
										<button
											className={`flex-1 rounded-lg py-2.5 font-medium transition ${button.className}`}
											onClick={() => handleAddBanner(button.type)}
										>
											⊕{" "}
											{/* Short visible label on a phone, full one from `sm:` — but
											    the full text is in the DOM at both widths, so the
											    button's ACCESSIBLE NAME never changes with the viewport.
											    A screen reader always hears "New Uma Banner", never a
											    bare "Uma", and selectors that query by name keep working
											    on a phone. */}
											<span className="sm:hidden" aria-hidden="true">
												{button.short}
											</span>
											<span className="sr-only sm:not-sr-only">{button.full}</span>
										</button>
									</Fragment>
								))}
							</div>

							{/* Staging area — slides in/out as stagedBanners are added or cleared */}
							<AnimatePresence>
								{stagedBanners.length > 0 && (
									<motion.div
										key="staging-area"
										initial={{ opacity: 0, y: -6 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0, y: -6 }}
										transition={{ duration: 0.18 }}
										className="mx-3 sm:mx-4"
									>
										{showStagingLabel && (
											<div className="pb-2 px-1">
												<div className="flex items-center gap-2">
													<span className="text-xs font-semibold text-staging uppercase tracking-wider">Staging</span>
													<div className="flex-1 h-px bg-staging/25" />
												</div>
												{/* The sentence that actually corrects the misreading. The
												    heading names the section; this says what being in it
												    COSTS you, which is the part people get wrong. Kept to one
												    line — it sits above every staged row, not just the first. */}
												<p className="mt-1 text-[11px] leading-snug text-staging/85">
													Not counted in your carats until you add it. Staged rows are
													temporary and are lost if you reload.
												</p>
											</div>
										)}
										{/* @container: the card/table switch inside is keyed to THIS box's
								    width, not the viewport's, so the table is only ever shown at a
								    width that fits it and never has to scroll sideways. See
								    --container-banner-table in index.css. */}
										<div className="@container">
											{/* Eight cells, not the sheet's nine: .banner-grid--staged drops the
											    MLB column and widens the select with it. Keep this row and
											    StagedBannerRow on the same modifier or they drift apart. */}
											<div className="banner-grid banner-grid--staged staged-surface-header hidden w-full items-center text-xs text-gray-400 font-medium border-b border-gray-700 rounded-t-lg py-1.5 @banner-table:grid">
												<div className="text-center">Type</div>
												<div className="text-center">Images</div>
												<div className="text-center">Banner</div>
												<div className="text-center">Start / End Date</div>
												<div className="text-center">Confirm</div>
												<div className="text-center"># Pulls</div>
												{reservedHeaderCell}
												<div className="text-center"></div>
											</div>
											{/* Same spacing/divider rules as the sheet below: several staged
											    rows have to read as one list, gapped as cards on mobile and
											    ruled as table rows once the grid kicks in. */}
											<div className="space-y-3 @banner-table:space-y-0 @banner-table:divide-y @banner-table:divide-gray-700">
												<AnimatePresence initial={false}>
													{stagedBanners.map((banner) => (
														<motion.div
															key={banner.tempId}
															layout
															initial={{ opacity: 0, y: -6 }}
															animate={{ opacity: 1, y: 0 }}
															exit={{ opacity: 0, y: -6 }}
															transition={{ duration: 0.18 }}
														>
															<StagedBannerRow
																stagedBanner={banner}
																setStagedBanner={handleUpdateStagedBanner}
																onConfirm={() => handleConfirmStagedBanner(banner.tempId!)}
																onDiscard={() => handleDiscardStagedBanner(banner.tempId!)}
																umaBannerData={umaBannerData}
																supportBannerData={supportBannerData}
																stepUpBannerData={stepUpBannerData}
																userPlannedBannerData={userPlannedBannerData}
																stagedBanners={stagedBanners}
															/>
														</motion.div>
													))}
												</AnimatePresence>
											</div>
										</div>
									</motion.div>
								)}
							</AnimatePresence>

							{/* The calculator proper — the rows that actually count. */}
							{showCalculatorSection && (
								<div className="mx-3 sm:mx-4">
									{showCalculatorLabel && (
										<div className="flex items-center gap-2 pt-3 pb-2 px-1">
											<span className="text-xs font-semibold text-brand uppercase tracking-wider">Calculator</span>
											<div className="flex-1 h-px bg-brand/20" />
										</div>
									)}
									{/* Own @container, as in the staging area above. */}
									<div className="@container">
										<div className="banner-grid hidden w-full items-center text-xs text-gray-400 font-medium bg-gray-800 border-b border-gray-700 rounded-t-lg py-1.5 @banner-table:grid">
											<div className="text-center">Type</div>
											<div className="text-center">Images</div>
											<div className="text-center">Banner</div>
											<div className="text-center">Start / End Date</div>
											<div className="text-center">Derived Stats (Auto-Calculated)</div>
											<div className="text-center"># Pulls</div>
											{reservedHeaderCell}
											<div className="text-center">% Chance to MLB (5x Copies)</div>
											<div className="text-center"></div>
										</div>
										{/* Empty state, shown only while something is staged (the section
										    doesn't render at all otherwise). It exists to give the staged
										    row above a visible DESTINATION: "this is staging, not the
										    calculator" is unlearnable when the calculator isn't on screen
										    to be compared against. It names the button that bridges them. */}
										{userPlannedBannerData.length === 0 && (
											<div className="rounded-lg border border-gray-700 bg-gray-800/40 px-4 py-6 text-center @banner-table:rounded-t-none @banner-table:border-t-0">
												<p className="text-sm text-gray-400">Nothing in your calculator yet.</p>
												<p className="mt-1 text-xs text-gray-500">
													Pick a banner above, then press{" "}
													<span className="add-to-calculator-label font-semibold text-green-400">Add to calculator</span>{" "}
													to start counting it.
												</p>
											</div>
										)}
										<div className="space-y-3 @banner-table:space-y-0 @banner-table:divide-y @banner-table:divide-gray-700">
											<AnimatePresence initial={false}>
												{plannerRows.map((plannerRow) => {
													if (plannerRow.kind === "band") {
														return (
															<motion.div
																key={plannerRow.key}
																layout
																initial={{ opacity: 0, y: -6 }}
																animate={{ opacity: 1, y: 0 }}
																exit={{ opacity: 0, y: -6 }}
																transition={{ duration: 0.18 }}
															>
																<PlannerSectionBand markers={plannerRow.markers} />
															</motion.div>
														)
													}

													const plannedBanner = plannerRow.banner
													const resources =
														bannerResources[plannerRow.index] ?? EMPTY_BANNER_RESOURCES

													return (
														<motion.div
															key={plannedBanner.id ?? plannedBanner.tempId}
															layout
															initial={{ opacity: 0, y: -6 }}
															animate={{ opacity: 1, y: 0 }}
															exit={{ opacity: 0, y: -6 }}
															transition={{ duration: 0.18 }}
														>
															<BannerRow
																plannedBanner={plannedBanner}
																userPlannedBannerData={userPlannedBannerData}
																clubRankData={clubRankData}
																teamTrialsRankData={teamTrialsRankData}
																championsMeetingRankData={championsMeetingRankData}
																userStatsData={userStatsData}
																umaBannerData={umaBannerData}
																supportBannerData={supportBannerData}
																stepUpBannerData={stepUpBannerData}
																userStepUpSelectionData={userStepUpSelectionData}
																constants={calculationConstants}
																setUserPlannedBannerData={setUserPlannedBannerData}
																resources={resources}
																initialBannerType={plannedBanner.initialBannerType}
															/>
														</motion.div>
													)
												})}
											</AnimatePresence>
										</div>
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
