import { Fragment } from "react"
import type { BannerSupport, BannerUma, UserStepUpSelection } from "../../../types"
import type { BannerResources } from "../../../hooks/bannerResources"
import { EMPTY_BANNER_RESOURCES } from "../../../hooks/bannerResources"
import { plannedBannerRowType, plannedBannerTarget, plannedBannerTimeline, plannedPulls, plannedSteps } from "../../../utils/bannerHelpers"
import { bannerRowFigures } from "../../../utils/bannerRowFigures"
import { formatDate } from "../../../utils/dateFormat"
import { isExcludedFromProjection } from "../../../utils/rowOptions"
import type { PlannerRow } from "../../../utils/plannerSections"
import { BannerArt } from "../BannerArt"
import { BannerTypeBadge } from "../BannerTypeBadge"
import { PlannerSectionBand } from "../PlannerSectionBand"

/**
 * The pull plan as a picture: the desktop sheet's rows, read-only, with a
 * header and a totals line around them (notes/share-plan-image-plan.md).
 *
 * A separate component, not a read-only flag on BannerRow: the picture keeps
 * the art, the name, the dates, the four stat boxes, the pulls and the reserved
 * copies, and drops everything you act on (the select, the odds grid, the note
 * and delete buttons). Its numbers come from the same `bannerRowFigures` the
 * sheet reads, so the two can't disagree.
 *
 * Always the wide layout, whatever the screen: `.banner-grid--share` sets the
 * grid itself instead of waiting on the sheet's container query, and the root
 * has a fixed width. It renders in the page's own theme, since it lives in the
 * same document while it is drawn.
 */
export function ShareableBannerTable({
	plannerRows,
	bannerResources,
	umaBannerData,
	supportBannerData,
	userStepUpSelectionData,
	ownerName,
	hideSpend,
	now,
}: {
	plannerRows: PlannerRow[]
	/** Positional against the plan's rows: read by each row's ORIGINAL index. */
	bannerResources: BannerResources[]
	umaBannerData: BannerUma[]
	supportBannerData: BannerSupport[]
	userStepUpSelectionData: UserStepUpSelection[]
	/** Shown only when the player ticks the box; null reads "Pull plan". */
	ownerName: string | null
	/** Blanks the paid carat box and the paid total, for players who'd rather not show spend. */
	hideSpend: boolean
	now: Date
}) {
	const banners = plannerRows.flatMap((row) => (row.kind === "banner" ? [row] : []))
	const resourcesOf = (index: number) => bannerResources[index] ?? EMPTY_BANNER_RESOURCES

	const totalPulls = banners.reduce((sum, row) => sum + plannedPulls(row.banner), 0)
	const totalSteps = banners.reduce((sum, row) => sum + plannedSteps(row.banner), 0)
	const freeSpent = banners.reduce((sum, row) => sum + resourcesOf(row.index).freeCaratsSpent, 0)
	const paidSpent = banners.reduce((sum, row) => sum + resourcesOf(row.index).paidCaratsSpent, 0)

	const totals = [
		`${banners.length} ${banners.length === 1 ? "banner" : "banners"}`,
		`${totalPulls.toLocaleString()} pulls`,
		totalSteps > 0 ? `${totalSteps} step-up steps` : null,
		`${freeSpent.toLocaleString()} free carats spent`,
		hideSpend || paidSpent === 0 ? null : `${paidSpent.toLocaleString()} paid carats spent`,
	].filter((part): part is string => part !== null)

	// The plan's tightest moment, the same figure as the forecast's headline
	// (CaratForecastChart): the free carats left after each banner that is
	// charged and still running, at the lowest. Short is the over-budget red.
	const charged = banners.filter(
		(row) =>
			!isExcludedFromProjection(row.banner) &&
			!bannerRowFigures(row.banner, resourcesOf(row.index), plannedBannerRowType(row.banner) === "StepUp", now).bannerHasEnded
	)
	const lowest = charged.length
		? Math.min(...charged.map((row) => resourcesOf(row.index).freeCarats - resourcesOf(row.index).freeCaratsSpent))
		: null

	return (
		// 962px of grid tracks (.banner-grid--share) + 2px of border + 40px of padding.
		<div className="w-[1004px] bg-gray-900 p-5 text-gray-100">
			<header className="mb-4 flex items-end justify-between gap-4">
				<div className="min-w-0">
					<h2 className="font-display text-2xl font-bold text-gray-100">
						{ownerName ? `${ownerName}'s pull plan` : "Pull plan"}
					</h2>
					<p className="text-sm text-gray-400">As of {formatDate(now.toISOString())}</p>
				</div>
				<p className="font-display text-lg font-bold text-brand">Uma Carat Calculator</p>
			</header>

			<div className="overflow-hidden rounded-lg border border-edge">
				<div className="banner-grid--share items-center border-b border-edge bg-gray-800 py-1.5 text-xs font-medium text-gray-400">
					<div className="text-center">Type</div>
					<div className="text-center">Images</div>
					<div className="text-center">Banner</div>
					<div className="text-center">Start / End Date</div>
					<div className="text-center">Derived Stats</div>
					<div className="text-center"># Pulls</div>
					<div className="text-center">Reserved</div>
				</div>
				<div className="divide-y divide-gray-700">
					{plannerRows.map((plannerRow) =>
						plannerRow.kind === "band" ? (
							<PlannerSectionBand key={plannerRow.key} markers={plannerRow.markers} />
						) : (
							<ShareRow
								key={plannerRow.banner.id ?? plannerRow.banner.tempId}
								plannerRow={plannerRow}
									resources={resourcesOf(plannerRow.index)}
									umaBannerData={umaBannerData}
									supportBannerData={supportBannerData}
									userStepUpSelectionData={userStepUpSelectionData}
								hideSpend={hideSpend}
								now={now}
							/>
						)
					)}
				</div>
			</div>

			<footer className="mt-3 flex items-center justify-between gap-4 text-sm">
				<p className="text-gray-200">
					{totals.join(" · ")}
					{lowest !== null &&
						(lowest < 0 ? (
							<span className="font-semibold text-(--color-pull-over)"> · Short by {(-lowest).toLocaleString()} carats</span>
						) : (
							<span> · {lowest.toLocaleString()} carats to spare</span>
						))}
				</p>
				<p className="text-gray-400">umacaratcalculator.com</p>
			</footer>
		</div>
	)
}

function ShareRow({ plannerRow, resources, umaBannerData, supportBannerData, userStepUpSelectionData, hideSpend, now }: {
	plannerRow: Extract<PlannerRow, { kind: "banner" }>
	resources: BannerResources
	umaBannerData: BannerUma[]
	supportBannerData: BannerSupport[]
	userStepUpSelectionData: UserStepUpSelection[]
	hideSpend: boolean
	now: Date
}) {
	const banner = plannerRow.banner
	const target = plannedBannerTarget(banner)
	const bannerType = plannedBannerRowType(banner)
	const isStepUp = bannerType === "StepUp"
	const figures = bannerRowFigures(banner, resources, isStepUp, now)
	const timeline = plannedBannerTimeline(banner)
	// The paid box stays in place, blanked, so the strip keeps its shape.
	const stats = figures.stats.map((stat) =>
		hideSpend && stat.label === "Paid Carat Est." ? { ...stat, value: "–" } : stat
	)

	return (
		<div className="banner-grid--share min-h-16 items-stretch bg-gray-800">
			<BannerTypeBadge type={bannerType} />
			<div className="flex items-center justify-center gap-1.5 px-1 py-1">
				<BannerArt
					target={target}
					userStepUpSelectionData={userStepUpSelectionData}
					umaBannerData={umaBannerData}
					supportBannerData={supportBannerData}
				/>
			</div>
			<div className="flex items-center px-2 py-2 text-sm leading-snug text-gray-100">
				<span className="line-clamp-3">{target.type === "Empty" ? "–" : target.banner.name}</span>
			</div>
			<div className="flex min-w-0 flex-col justify-center gap-0.5 px-1 py-2 text-xs text-gray-400">
				{timeline ? (
					<>
						<span>Start: <span className="text-gray-100">{formatDate(timeline.start_date)}</span></span>
						<span>End: <span className="text-gray-100">{formatDate(timeline.end_date)}</span></span>
					</>
				) : (
					<span className="text-gray-600">–</span>
				)}
			</div>
			<div className="flex min-w-0 items-center justify-center px-1 py-2">
				<div className="flex w-full items-stretch overflow-hidden rounded-lg border border-gray-600 bg-gray-700">
					{stats.map((stat, index) => (
						<Fragment key={stat.label}>
							{index > 0 && <div className="w-px self-stretch bg-gray-600" />}
							<div className="flex flex-1 flex-col items-center justify-center px-1 py-1.5">
								<span className="banner-stat-box-label">{stat.label}</span>
								<span className={`banner-stat-box-value ${stat.valueClass ?? ""}`}>{stat.value}</span>
							</div>
						</Fragment>
					))}
				</div>
			</div>
			{/* Plain text in the field's own colours, so an over-budget count is still red. */}
			<div className="flex items-center justify-center px-1 py-2">
				<div className={`pull-input pull-input--${figures.countStatus} flex w-14 items-center justify-center`}>
					{banner.number_of_pulls}
				</div>
			</div>
			<div className="flex items-center justify-center px-1 py-2">
				<div className={`pull-input pull-input--${figures.reservedStatus} flex w-14 items-center justify-center`}>
					{banner.reserved_copies}
				</div>
			</div>
		</div>
	)
}
