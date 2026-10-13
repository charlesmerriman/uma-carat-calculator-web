import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useCalculatorData } from "../../services/CalculatorContext"
import { sharedPlanSummaryFetch } from "../../services/planFetchCalls"
import { statsAreDirty } from "../../services/guestMigration"
import { PLAN_CAP, PLAN_NAME_MAX_LENGTH } from "../../types"
import type { SharedPlanSummary } from "../../types"
import { plannedBannerTarget } from "../../utils/bannerHelpers"
import type { BannerRowType, PlannedBannerTarget } from "../../utils/bannerHelpers"
import { formatDate } from "../../utils/dateFormat"
import { BannerTypeIcon } from "../carat-calculator/BannerTypeBadge"
import { OguriSpinner } from "../OguriSpinner"

/**
 * /app/<public_id>: somebody's shared plan, and one thing to do with it.
 *
 * A SHARED PLAN IS COPIED, NEVER VIEWED. The owner's rule (2026-10-12): a plan
 * is editable only by the person who made it, and anyone else sees it by
 * taking a copy that is then theirs. So this is a card, not the calculator: it
 * says what the plan holds (which banners, how many, how recently changed, how
 * often copied) and offers "Copy". No pull counts, no numbers, nothing
 * editable. The summary the server sends carries catalogue ids only; names and
 * art come from the catalogue the app already holds, which is why this renders
 * INSIDE the /app loading gate.
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
	"rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-black transition hover:bg-brand/85 disabled:cursor-not-allowed disabled:opacity-50"
const BUTTON_GHOST =
	"rounded-lg border border-gray-600 px-4 py-2 text-sm font-medium text-gray-300 transition hover:border-gray-500 hover:bg-gray-700 hover:text-gray-100 disabled:cursor-not-allowed disabled:opacity-50"

type SummaryState =
	| { status: "loading" }
	| { status: "notFound" }
	| { status: "error" }
	| { status: "ready"; summary: SharedPlanSummary }

const plural = (count: number, one: string, many: string): string =>
	`${count} ${count === 1 ? one : many}`

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

/** One banner of the plan as the card shows it: art, name and kind. */
const BannerLine = ({ target }: { target: Exclude<PlannedBannerTarget, { type: "Empty" }> }) => {
	// The same two thumbnails a planner row shows. A step-up features no cards,
	// so it shows its campaign art when there is some, else its kind's glyph.
	const images =
		target.type === "Uma"
			? target.banner.umas
			: target.type === "Support"
				? target.banner.support_cards
				: []
	return (
		<li className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2">
			{/* Fixed width, sized for two 48px tiles (the phone card's height), so
			    the names line up whether a row has one card or two. Uma art is
			    square and support art portrait; neither may overflow into the name. */}
			<div className="flex h-12 w-[6.25rem] shrink-0 items-center justify-center gap-1">
				{target.type === "StepUp" ? (
					target.banner.image ? (
						<img src={target.banner.image} alt="" className="h-full w-auto object-contain" />
					) : (
						<BannerTypeIcon type="StepUp" className="h-6 w-6 text-step-up" />
					)
				) : (
					images.slice(0, 2).map((img) => (
						<img
							key={img.name}
							src={img.image}
							alt={img.name}
							// The uma frame is baked into the art; round to match it, as the rows do.
							className={`h-full w-auto min-w-0 object-contain ${target.type === "Uma" ? "rounded-md" : ""}`}
						/>
					))
				)}
			</div>
			<div className="min-w-0">
				<p className="truncate text-sm font-medium text-gray-100">{target.banner.name}</p>
				<p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
					<BannerTypeIcon type={target.type} className="h-3.5 w-3.5" />
					{TYPE_LABEL[target.type]}
				</p>
			</div>
		</li>
	)
}

export const SharedPlanLanding = ({ publicId }: { publicId: string }) => {
	const {
		umaBannerData,
		supportBannerData,
		stepUpBannerData,
		plans,
		activePlanId,
		isPlanBusy,
		userPlannedBannerData,
		userPlannedPurchaseData,
		userStatsData,
		copySharedPlan,
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
				<h1 className="text-2xl font-bold text-gray-100">
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

	// The summary's ids resolved against the catalogue, then narrowed with the
	// same helper every planner row uses. A banner that has left the catalogue
	// resolves to Empty and is left off the list; the count above still says
	// how many rows the plan holds.
	const targets = summary.rows
		.map((row) =>
			plannedBannerTarget({
				banner_uma:
					row.banner_uma === null ? null : (umaBannerData.find((b) => b.id === row.banner_uma) ?? null),
				banner_support:
					row.banner_support === null
						? null
						: (supportBannerData.find((b) => b.id === row.banner_support) ?? null),
				banner_step_up:
					row.banner_step_up === null
						? null
						: (stepUpBannerData.find((b) => b.id === row.banner_step_up) ?? null)
			})
		)
		.filter((target): target is Exclude<PlannedBannerTarget, { type: "Empty" }> => target.type !== "Empty")

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
		<div className="mx-auto max-w-2xl px-4 py-10">
			<h1 className="text-2xl font-bold text-gray-100">Someone shared a pull plan with you</h1>

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

				{atCap && (
					<p className="mt-3 text-sm text-gray-400">
						You're at the {PLAN_CAP}-plan limit. Delete one first.
					</p>
				)}

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

			<div className="mt-6 rounded-xl border border-gray-700 bg-gray-800/50 p-4 sm:p-5">
				<p className="text-sm text-gray-400">
					{[
						plural(summary.row_count, "banner", "banners"),
						`Updated ${formatDate(summary.updated_at.slice(0, 10))}`,
						copiedLine(summary.copy_count),
						includes
					]
						.filter(Boolean)
						.join(" · ")}
				</p>

				{targets.length > 0 ? (
					<ul className="mt-4 flex flex-col gap-2">
						{targets.map((target) => (
							<BannerLine key={`${target.type}-${target.banner.id}`} target={target} />
						))}
					</ul>
				) : (
					<p className="mt-4 text-sm text-gray-400">This plan has no banners in it yet.</p>
				)}
			</div>
		</div>
	)
}
