/**
 * A plan's banner rows, as the share card (SharedPlanLanding) and an opened
 * Community plans post (community-plans/PlanPostBody) both draw them: art,
 * name, kind, end date, the plan's pulls and "Your max", the projection run
 * on THESE rows with the VIEWER'S own resources. One component, so the two
 * pages can never show the same plan two ways.
 *
 * Also MakeRoom: the plan cap's "delete one to make room", which both pages'
 * copy forms show.
 */

import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import { useCalculatorData } from "../../services/CalculatorContext"
import { guestPlanToState } from "../../services/guestPlanStore"
import type { PlannedBannerPayload } from "../../services/calculatorFetchCalls"
import { PLAN_CAP } from "../../types"
import type { Plan, UserPlannedBanner } from "../../types"
import type { BannerResources } from "../../hooks/bannerResources"
import { plannedBannerTarget, plannedPulls, plannedSteps } from "../../utils/bannerHelpers"
import type { BannerRowType, PlannedBannerTarget } from "../../utils/bannerHelpers"
import { bannerRowFigures } from "../../utils/bannerRowFigures"
import { formatDate } from "../../utils/dateFormat"
import { plural } from "../../utils/planTotals"
import { BannerTypeIcon } from "../carat-calculator/BannerTypeBadge"
import { FramedUma } from "../FramedUma"
import { useBannerProjection } from "../../hooks/useBannerResources"
import { useOshiIds } from "../../hooks/useOshiIds"
import { FramedCard } from "../FramedCard"
import { cardFrameArt } from "../../utils/cardFrame"

const TYPE_LABEL: Record<BannerRowType, string> = {
	Uma: "Uma banner",
	Support: "Support banner",
	StepUp: "Step-up"
}

/**
 * The columns past the art line up with PlanRows' header row. With an action
 * (a posted plan's "Add to my plan") a fourth column holds it from `sm` up;
 * on a phone it drops under the name.
 */
const ROW_GRID = "grid grid-cols-[6.25rem_minmax(0,1fr)] items-center gap-x-3 sm:grid-cols-[6.25rem_minmax(0,1fr)_5.5rem_5.5rem]"
const ROW_GRID_WITH_ACTION =
	"grid grid-cols-[6.25rem_minmax(0,1fr)] items-center gap-x-3 sm:grid-cols-[6.25rem_minmax(0,1fr)_5.5rem_5.5rem_8.5rem]"

/** One banner of the plan as the card shows it: art, name, kind and end date.
 * The date is the catalogue's, so it says when the banner closes, which is
 * what a reader weighs a plan by. */
const BannerLine = ({ target, planned, max, note, counted, action }: {
	target: Exclude<PlannedBannerTarget, { type: "Empty" }>
	/** "120" or "12 steps"; null on an API older than the table. */
	planned: string | null
	max: string | null
	note: string | undefined
	/** False on a row the owner left out of the projection. */
	counted: boolean
	/** The row's own control, when the list has an action column; null leaves the cell empty. */
	action?: ReactNode
}) => {
	const oshiIds = useOshiIds()
	// The same two thumbnails a planner row shows. A step-up features no cards,
	// so it shows its campaign art when there is some, else its kind's glyph.
	return (
		<li className={`${action === undefined ? ROW_GRID : ROW_GRID_WITH_ACTION} rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2`}>
			{/* Fixed width, sized for two 48px tiles (the phone card's height), so
			    the names line up whether a row has one card or two. Uma art is
			    square and support art portrait; neither may overflow into the name. */}
			<div className="flex h-12 items-center justify-center gap-1">
				{target.type === "StepUp" ? (
					target.banner.image ? (
						<img src={target.banner.image} alt="" className="h-full w-auto object-contain" />
					) : (
						<BannerTypeIcon type="StepUp" className="h-6 w-6 text-step-up" />
					)
				) : target.type === "Uma" ? (
					target.banner.umas.slice(0, 2).map((uma) => (
						<FramedUma key={uma.id} src={uma.portrait ?? uma.image} layers={uma.portrait_layers} alt={uma.name} oshi={oshiIds.has(uma.id)} className="h-full" />
					))
				) : (
					target.banner.support_cards.slice(0, 2).map((card) => (
						<FramedCard key={card.id} card={cardFrameArt(card)} alt={card.name} className="h-full" />
					))
				)}
			</div>
			<div className="min-w-0">
				<p className="truncate text-sm font-medium text-gray-100" title={target.banner.name}>{target.banner.name}</p>
				<p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-xs text-gray-400">
					<BannerTypeIcon type={target.type} className="h-3.5 w-3.5" />
					<span>{TYPE_LABEL[target.type]}</span>
					<span className="text-gray-500">· ends {formatDate(target.timeline.end_date)}</span>
					{!counted && <span className="text-gray-500">· not counted in the plan</span>}
				</p>
				{planned !== null && (
					<p className="mt-0.5 text-xs text-gray-300 sm:hidden">
						{target.type === "StepUp" ? planned : `${planned} pulls`} · your max {max}
					</p>
				)}
				{note && <p className="mt-1 whitespace-pre-line text-xs text-gray-300">{note}</p>}
			</div>
			{planned !== null && (
				<>
					<span className="hidden text-right text-sm font-semibold text-gray-100 sm:block">{planned}</span>
					<span className="hidden text-right text-sm text-gray-300 sm:block">{max}</span>
				</>
			)}
			{action !== undefined && (
				// Under the name on a phone; its own right-hand column from `sm` up.
				<div className="col-start-2 mt-1.5 flex sm:col-start-5 sm:mt-0 sm:justify-end">{action}</div>
			)}
		</li>
	)
}

/** What the row's Max Pulls box would say: "Passed" for a banner that has ended, as the planner does. */
const maxText = (row: UserPlannedBanner, resources: BannerResources | undefined, isStepUp: boolean, now: Date): string => {
	if (!resources) return "–"
	const { maxPossiblePulls, maxPossibleSteps } = bannerRowFigures(row, resources, isStepUp, now)
	return (isStepUp ? maxPossibleSteps : maxPossiblePulls).toLocaleString()
}

/**
 * The plan's banners. Its own component so the projection's hook runs only
 * once the rows have arrived. The rows are rebuilt against the catalogue the
 * way a guest copy is, so a banner that has left it drops off here too.
 *
 * `action`, when given, draws one control per row in a column of its own
 * (Community plans' "Add to my plan"); the share card passes none and keeps
 * its three columns.
 */
export const PlanRows = ({ rows: payload, action }: {
	/** The share link's row shape: catalogue ids, counts, choices, `note` when shared. */
	rows: PlannedBannerPayload[]
	action?: (row: UserPlannedBanner, target: Exclude<PlannedBannerTarget, { type: "Empty" }>) => ReactNode
}) => {
	const {
		umaBannerData,
		supportBannerData,
		stepUpBannerData,
		anniversaryEventData,
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		leagueOfHeroesRankData,
		userPlannedPurchaseData,
		userStepUpSelectionData,
		incomeLedger,
		calculationConstants
	} = useCalculatorData()
	const hasCounts = payload.every((row) => typeof row.number_of_pulls === "number")
	const rows = useMemo(
		() =>
			guestPlanToState(
				{
					version: 1,
					savedAt: 0,
					stats: null,
					banners: payload.map((row) => ({ ...row, number_of_pulls: row.number_of_pulls ?? 0, reserved_copies: row.reserved_copies ?? 0 })),
					purchases: [],
					stepUpSelections: []
				},
				{
					banner_uma_data: umaBannerData,
					banner_support_data: supportBannerData,
					banner_step_up_data: stepUpBannerData,
					club_rank_data: [],
					team_trials_rank_data: [],
					champions_meeting_rank_data: [],
					league_of_heroes_rank_data: []
				}
			).banners,
		[payload, umaBannerData, supportBannerData, stepUpBannerData]
	)
	const { rows: resources } = useBannerProjection({
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		leagueOfHeroesRankData,
		userPlannedBannerData: rows,
		anniversaryEventData,
		userPlannedPurchaseData,
		incomeLedger,
		constants: calculationConstants,
		umaBannerData,
		supportBannerData,
		userStepUpSelectionData
	})

	const now = new Date()
	if (rows.length === 0) return <p className="mt-4 text-sm text-gray-400">This plan has no banners in it yet.</p>
	return (
		<>
			{hasCounts && (
				<>
					<p className="mt-2 text-xs text-gray-400">Your max is what your own resources would cover on each banner if you copied this plan.</p>
					<div className={`${action === undefined ? ROW_GRID : ROW_GRID_WITH_ACTION} mt-3 hidden px-3 text-xs font-semibold uppercase tracking-wide text-gray-400 sm:grid`} aria-hidden="true">
						<span className="col-start-3 text-right">Pulls</span>
						<span className="text-right">Your max</span>
					</div>
				</>
			)}
			<ul className="mt-1.5 flex flex-col gap-1.5">
				{rows.map((row, index) => {
					const target = plannedBannerTarget(row)
					if (target.type === "Empty") return null
					const isStepUp = target.type === "StepUp"
					const steps = plannedSteps(row)
					return (
						<BannerLine
							key={row.tempId}
							target={target}
							planned={hasCounts ? (isStepUp ? plural(steps, "step", "steps") : plannedPulls(row).toLocaleString()) : null}
							max={maxText(row, resources[index], isStepUp, now)}
							note={row.note}
							counted={!row.excluded_from_projection}
							action={action?.(row, target)}
						/>
					)
				})}
			</ul>
		</>
	)
}

/**
 * At the plan cap, the plans themselves with a delete on each, so making room
 * for a copy doesn't mean leaving the link (and finding it again). A delete
 * can't be undone, so each asks once. Buttons are type="button": this sits
 * inside the copy form.
 */
export const MakeRoom = ({ plans, disabled, onDelete }: { plans: Plan[]; disabled: boolean; onDelete: (planId: number) => void }) => {
	const [confirmingId, setConfirmingId] = useState<number | null>(null)
	return (
		<div className="mt-3">
			<p className="text-sm text-gray-400">You're at the {PLAN_CAP}-plan limit. Delete one to make room.</p>
			<ul className="mt-2 flex flex-col gap-1.5" aria-label="Your plans">
				{plans.map((plan) => (
					<li key={plan.id} className="flex items-center justify-between gap-3 rounded-md border border-gray-700 bg-gray-900/60 px-3 py-1.5">
						<span className="min-w-0 truncate text-sm text-gray-100">{plan.name}</span>
						{confirmingId === plan.id ? (
							<span className="flex shrink-0 items-center gap-2">
								<span className="text-xs text-gray-400">Delete for good?</span>
								<button type="button" disabled={disabled} onClick={() => onDelete(plan.id)} className="text-sm font-semibold text-red-400 transition hover:text-red-300 disabled:opacity-50">
									Yes, delete
								</button>
								<button type="button" onClick={() => setConfirmingId(null)} className="text-sm text-gray-400 transition hover:text-gray-100">
									Keep
								</button>
							</span>
						) : (
							<button
								type="button"
								aria-label={`Delete ${plan.name}`}
								disabled={disabled}
								onClick={() => setConfirmingId(plan.id)}
								className="shrink-0 text-sm text-gray-400 transition hover:text-gray-100 disabled:opacity-50"
							>
								Delete
							</button>
						)}
					</li>
				))}
			</ul>
		</div>
	)
}
