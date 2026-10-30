import { useEffect, useMemo, useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useCalculatorData } from "../../services/CalculatorContext"
import { sharedPlanSummaryFetch } from "../../services/planFetchCalls"
import { statsAreDirty } from "../../services/guestMigration"
import { guestPlanToState } from "../../services/guestPlanStore"
import { PLAN_CAP, PLAN_NAME_MAX_LENGTH } from "../../types"
import type { Plan, SharedPlanSummary, UserPlannedBanner } from "../../types"
import type { BannerResources } from "../../hooks/bannerResources"
import { plannedBannerTarget, plannedPulls, plannedSteps } from "../../utils/bannerHelpers"
import type { BannerRowType, PlannedBannerTarget } from "../../utils/bannerHelpers"
import { bannerRowFigures } from "../../utils/bannerRowFigures"
import { formatDate } from "../../utils/dateFormat"
import { planTotalsLine, plural } from "../../utils/planTotals"
import { BannerTypeIcon } from "../carat-calculator/BannerTypeBadge"
import { OguriSpinner } from "../OguriSpinner"
import { FramedUma } from "../FramedUma"
import { useBannerProjection } from "../../hooks/useBannerResources"
import { useOshiIds } from "../../hooks/useOshiIds"

/**
 * /app/<public_id>: somebody's shared plan, and one thing to do with it.
 *
 * A SHARED PLAN IS COPIED, NOT OPENED. The owner's rule (2026-10-12): a plan is
 * editable only by the person who made it, and anyone else takes a copy that
 * is then theirs. So this is a card, not the calculator: it says what the plan
 * holds and offers "Copy", and nothing here is editable.
 *
 * Each banner shows its pulls and, under share_notes, the owner's note (owner,
 * 2026-10-30, after players asked to see them without copying). The rows are
 * the ones a guest copy takes, so this shows nothing the link didn't already
 * give away. "Your max" is the projection run on THOSE rows with the VIEWER'S
 * own resources: the number they'd see after copying, and none of the owner's
 * stats, which leave the account only in a guest's copy. Names and art come
 * from the catalogue the app already holds, which is why this renders INSIDE
 * the /app loading gate.
 *
 * Opening the link creates nothing. A plan is made only by the button, because
 * link previews and crawlers open links too.
 *
 * Signed in, the copy is a new plan in the account (named here, prefilled like
 * Duplicate's suggestion) and the calculator opens on it. As a guest, the copy
 * replaces the plan on this device, so if there is one worth keeping the card
 * asks first. A guest's own resources (carats, ranks, planned purchases) stay
 * unless they tick the box to take the owner's (offered only when the owner
 * shared them): the device holds one set, so losing theirs is the guest's
 * call, never a side effect of the owner's. Both paths are CalculatorProvider.copySharedPlan; this component
 * only decides when to call it and where to go afterwards.
 */

const DEFAULT_COPY_NAME = "Copied plan"

const TYPE_LABEL: Record<BannerRowType, string> = {
	Uma: "Uma banner",
	Support: "Support banner",
	StepUp: "Step-up"
}

const BUTTON_PRIMARY =
	"rounded-md bg-brand px-4 py-2 text-sm font-semibold text-black transition hover:bg-brand/85 disabled:cursor-not-allowed disabled:opacity-50"
const BUTTON_GHOST =
	"rounded-md border border-gray-600 px-4 py-2 text-sm font-medium text-gray-300 transition hover:border-gray-500 hover:bg-gray-700 hover:text-gray-100 disabled:cursor-not-allowed disabled:opacity-50"

type SummaryState =
	| { status: "loading" }
	| { status: "notFound" }
	| { status: "error" }
	| { status: "ready"; summary: SharedPlanSummary }

const copiedLine = (count: number): string =>
	count === 0 ? "Not copied yet" : count === 1 ? "Copied once" : `Copied ${count} times`

/** "Includes their resources and notes", or null when a copy is rows only. */
const includesLine = (resources: boolean, notes: boolean): string | null =>
	resources && notes
		? "Includes their resources and notes"
		: resources
			? "Includes their resources"
			: notes
				? "Includes their notes"
				: null

/** One banner of the plan as the card shows it: art, name, kind and end date.
 * The date is the catalogue's, so it says when the banner closes, which is
 * what a reader weighs a plan by; the owner's pull count for the row is not
 * in the summary and is not shown. */
/** The three columns past the art line up with PlanRows' header row. */
const ROW_GRID = "grid grid-cols-[6.25rem_minmax(0,1fr)] items-center gap-x-3 sm:grid-cols-[6.25rem_minmax(0,1fr)_5.5rem_5.5rem]"

const BannerLine = ({ target, planned, max, note, counted }: {
	target: Exclude<PlannedBannerTarget, { type: "Empty" }>
	/** "120" or "12 steps"; null on an API older than the table. */
	planned: string | null
	max: string | null
	note: string | undefined
	/** False on a row the owner left out of the projection. */
	counted: boolean
}) => {
	const oshiIds = useOshiIds()
	// The same two thumbnails a planner row shows. A step-up features no cards,
	// so it shows its campaign art when there is some, else its kind's glyph.
	const images =
		target.type === "Uma"
			? target.banner.umas
			: target.type === "Support"
				? target.banner.support_cards
				: []
	return (
		<li className={`${ROW_GRID} rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2`}>
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
						<FramedUma key={uma.id} src={uma.portrait ?? uma.image} alt={uma.name} oshi={oshiIds.has(uma.id)} className="h-full" />
					))
				) : (
					images.slice(0, 2).map((img) => (
						<img key={img.name} src={img.image} alt={img.name} className="h-full w-auto min-w-0 object-contain" />
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
 * once the summary has arrived. The rows are rebuilt against the catalogue
 * the way a guest copy is, so a banner that has left it drops off here too.
 */
const PlanRows = ({ summary }: { summary: SharedPlanSummary }) => {
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
	const hasCounts = summary.rows.every((row) => typeof row.number_of_pulls === "number")
	const rows = useMemo(
		() =>
			guestPlanToState(
				{
					version: 1,
					savedAt: 0,
					stats: null,
					banners: summary.rows.map((row) => ({ ...row, number_of_pulls: row.number_of_pulls ?? 0, reserved_copies: row.reserved_copies ?? 0 })),
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
		[summary.rows, umaBannerData, supportBannerData, stepUpBannerData]
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
					<div className={`${ROW_GRID} mt-3 hidden px-3 text-xs font-semibold uppercase tracking-wide text-gray-400 sm:grid`} aria-hidden="true">
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
const MakeRoom = ({ plans, disabled, onDelete }: { plans: Plan[]; disabled: boolean; onDelete: (planId: number) => void }) => {
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

export const SharedPlanLanding = ({ publicId }: { publicId: string }) => {
	const {
		plans,
		activePlanId,
		isPlanBusy,
		userPlannedBannerData,
		userPlannedPurchaseData,
		userStatsData,
		copySharedPlan,
		deletePlan,
		switchPlan
	} = useCalculatorData()
	const navigate = useNavigate()

	// Starts loading, and a new id starts a new card: SharedPlanRoute keys this
	// component on the id, so nothing here has to reset itself between links.
	const [state, setState] = useState<SummaryState>({ status: "loading" })
	// Bumped by "Try again" to refetch after a network failure.
	const [attempt, setAttempt] = useState(0)
	const [name, setName] = useState(DEFAULT_COPY_NAME)
	const [confirmingReplace, setConfirmingReplace] = useState(false)
	// Guest only, and off until ticked. See the header comment.
	const [takeStats, setTakeStats] = useState(false)

	useEffect(() => {
		const controller = new AbortController()
		sharedPlanSummaryFetch(publicId)
			.then(async (response) => {
				if (controller.signal.aborted) return
				if (response.status === 404) {
					setState({ status: "notFound" })
					return
				}
				if (!response.ok) {
					setState({ status: "error" })
					return
				}
				const summary = (await response.json()) as SharedPlanSummary
				if (!controller.signal.aborted) setState({ status: "ready", summary })
			})
			.catch(() => {
				if (!controller.signal.aborted) setState({ status: "error" })
			})
		return () => controller.abort()
	}, [publicId, attempt])

	if (state.status === "loading") {
		return (
			<div className="flex min-h-[60vh] items-center justify-center" role="status" aria-live="polite">
				<OguriSpinner />
				<span className="sr-only">Loading the shared plan…</span>
			</div>
		)
	}

	if (state.status === "notFound" || state.status === "error") {
		return (
			<div className="mx-auto max-w-xl px-4 py-16 text-center">
				<h1 className="font-display text-2xl font-bold text-gray-100">
					{state.status === "notFound" ? "Plan not found" : "Couldn't load this plan"}
				</h1>
				<p className="mt-3 text-gray-400">
					{state.status === "notFound"
						? "This plan isn't shared, or the link is wrong."
						: "Something went wrong on our side or with your connection."}
				</p>
				<div className="mt-6 flex justify-center gap-3">
					{state.status === "error" && (
						<button
							type="button"
							onClick={() => {
								setState({ status: "loading" })
								setAttempt((n) => n + 1)
							}}
							className={BUTTON_GHOST}
						>
							Try again
						</button>
					)}
					<Link to="/app" className={BUTTON_PRIMARY}>
						Go to the calculator
					</Link>
				</div>
			</div>
		)
	}

	const { summary } = state
	// A guest has one unnamed plan on the device: no plan list, no active id.
	const isAccount = activePlanId !== null
	const ownPlan = plans.find((plan) => plan.public_id === summary.public_id)
	const atCap = isAccount && plans.length >= PLAN_CAP

	// The box is offered only when there is something to take.
	const includeStats = !isAccount && summary.share_stats && takeStats
	// What a guest copy would replace (CalculatorProvider.copySharedPlan): the
	// rows always, and the stats and purchases when the guest takes the
	// owner's stats. Asked only when one of those holds something.
	const guestHasPlan =
		!isAccount &&
		(userPlannedBannerData.length > 0 ||
			(includeStats && (statsAreDirty(userStatsData) || userPlannedPurchaseData.length > 0)))

	const copy = async (): Promise<void> => {
		const worked = await copySharedPlan(
			summary.public_id,
			isAccount ? { name: name.trim() } : { includeStats }
		)
		if (worked) navigate("/app")
	}

	const handleSubmit = (e: FormEvent): void => {
		e.preventDefault()
		if (isAccount && name.trim() === "") return
		if (guestHasPlan && !confirmingReplace) {
			setConfirmingReplace(true)
			return
		}
		void copy()
	}

	const openOwnPlan = async (): Promise<void> => {
		if (ownPlan && (await switchPlan(ownPlan.id))) navigate("/app")
	}

	// A guest decides about the resources with the box below, so the line only
	// states them for an account, whose copy takes them as it is.
	const includes = includesLine(isAccount && summary.share_stats, summary.share_notes)

	return (
		<div className="mx-auto max-w-3xl px-4 py-10">
			<h1 className="font-display text-2xl font-bold text-gray-100">Someone shared a pull plan with you</h1>

			{/* The copy controls sit ABOVE the banner list: a long plan pushed them
			    off the bottom of the screen, behind dozens of rows. */}
			{ownPlan && (
				<p className="mt-4 text-sm text-gray-400">
					This is your plan.{" "}
					<button
						type="button"
						disabled={isPlanBusy}
						onClick={() => void openOwnPlan()}
						className="font-medium text-brand underline-offset-2 hover:underline disabled:opacity-50"
					>
						Open it
					</button>
				</p>
			)}

			<form onSubmit={handleSubmit} className="mt-6">
				{isAccount && (
					<label className="flex max-w-sm flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
						Name your copy
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							maxLength={PLAN_NAME_MAX_LENGTH}
							className="rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm font-normal normal-case tracking-normal text-gray-100 outline-none transition placeholder:text-gray-500 focus:border-brand"
						/>
					</label>
				)}

				{!isAccount && summary.share_stats && (
					<label className="flex max-w-md cursor-pointer items-start gap-2.5">
						<input
							type="checkbox"
							checked={takeStats}
							onChange={(e) => {
								setTakeStats(e.target.checked)
								// The question below depends on this answer, so ask it again.
								setConfirmingReplace(false)
							}}
							className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
						/>
						<span className="text-sm text-gray-200">Use their resources instead of mine</span>
					</label>
				)}

				{atCap && <MakeRoom plans={plans} disabled={isPlanBusy} onDelete={(planId) => void deletePlan(planId)} />}

				{confirmingReplace ? (
					<div className="mt-4 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
						<p className="text-sm font-semibold text-gray-100">Replace the plan on this device?</p>
						<p className="mt-1 text-sm text-gray-400">
							{includeStats
								? "Your banners, carats and purchases here will be replaced."
								: "Your banners here will be replaced."}
						</p>
						<div className="mt-3 flex gap-2">
							<button type="submit" disabled={isPlanBusy} className={BUTTON_PRIMARY}>
								Replace it
							</button>
							<button type="button" onClick={() => setConfirmingReplace(false)} className={BUTTON_GHOST}>
								Cancel
							</button>
						</div>
					</div>
				) : (
					<div className="mt-4">
						<button
							type="submit"
							disabled={isPlanBusy || atCap || (isAccount && name.trim() === "")}
							className={BUTTON_PRIMARY}
						>
							{isAccount ? "Copy to my plans" : "Copy to this device"}
						</button>
					</div>
				)}
			</form>

			<div className="mt-6 rounded-xl border border-edge bg-gray-800/50 p-4 sm:p-5">
				<p className="text-sm text-gray-400">
					{[
						plural(summary.row_count, "banner", "banners"),
						// Absent from an API older than the link preview (dev:live
						// against prod before the release), so the line just skips them.
						summary.pull_count !== undefined && planTotalsLine(summary.pull_count, summary.step_count ?? 0),
						`Updated ${formatDate(summary.updated_at.slice(0, 10))}`,
						copiedLine(summary.copy_count),
						includes
					]
						.filter(Boolean)
						.join(" · ")}
				</p>

				<PlanRows summary={summary} />
			</div>
		</div>
	)
}
