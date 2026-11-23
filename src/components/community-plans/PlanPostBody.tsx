/**
 * An opened Community plans post, drawn inside its row (PlanFeedRow), never
 * in a side panel or a dialog (decision 8). Top to bottom: About this plan,
 * the author's income when they posted it, every banner row (the share card's
 * PlanRows, with "Add to my plan" on each), Copy to my plans / Copy link /
 * Report, then the comments.
 *
 * The full post (GET /gallery/posts/<id>) is fetched when the row opens, and
 * a view is counted once it has loaded: never for a row scrolling by.
 *
 * "ADD TO MY PLAN" IS STAGING (decision 14). It puts that one banner, with the
 * author's pulls (or steps), in the Calculator's staging area through the
 * Timeline's own path (useStageBanner); the player confirms it there. It is
 * not a copy: nothing writes a plan, and the post's copy count doesn't move.
 * A banner that has ended has no button.
 *
 * "COPY TO MY PLANS" is CalculatorProvider.copyPostedPlan. Signed in, a new
 * plan named here and opened in the calculator; at the plan cap, MakeRoom.
 * A guest (once the page opens to everyone) replaces the device's rows, so
 * the card asks first when the device holds a plan.
 */

import { useEffect, useId, useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { Copy, Flag, Link2, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { useCalculatorData } from "../../services/CalculatorContext"
import { useAccount } from "../../services/AuthContext"
import { galleryShareUrl, galleryView } from "../../services/galleryFetchCalls"
import { failureText, postThread, usePlanPost, useTakeDownPost } from "../../services/galleryQueries"
import { HttpError } from "../../services/queryClient"
import { useStageBanner } from "../../hooks/useStageBanner"
import { useSignInPrompt } from "../../hooks/useSignInPrompt"
import { PLAN_CAP, PLAN_NAME_MAX_LENGTH } from "../../types"
import type { UserPlannedBanner } from "../../types"
import type { PlanPost } from "../../types/gallery"
import type { PlannedBannerTarget } from "../../utils/bannerHelpers"
import { planTotalsLine, plural } from "../../utils/planTotals"
import { posterName } from "../../utils/galleryText"
import { MakeRoom, PlanRows } from "../shared-plan/PlanRows"
import { GalleryComments } from "../pvp/gallery/GalleryComments"
import { ReportDialog } from "../pvp/gallery/ReportDialog"
import { ACTION_BUTTON, DANGER_BUTTON, FIELD, PRIMARY_BUTTON, SECONDARY_BUTTON, SMALL_BUTTON } from "../pvp/gallery/galleryStyles"
import { PostedIncome } from "./PostedIncome"

type Target = Exclude<PlannedBannerTarget, { type: "Empty" }>

const SECTION = "rounded-xl border border-gray-700 bg-gray-800/50 p-3 sm:p-4"

export function PlanPostBody({ publicId, onTakenDown }: { publicId: string; onTakenDown: () => void }) {
	const post = usePlanPost(publicId)

	// One view per opening, once it has loaded (the server ignores your own
	// and counts each viewer once a day).
	const ready = post.data !== undefined
	useEffect(() => {
		if (ready) galleryView(publicId)
	}, [ready, publicId])

	if (post.isPending) {
		return (
			<p className="flex items-center gap-2 text-sm text-gray-400" role="status">
				<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
				Loading the plan…
			</p>
		)
	}
	if (post.isError) {
		const gone = post.error instanceof HttpError && post.error.status === 404
		return (
			<div className="flex flex-col items-start gap-2 text-sm text-gray-300" role="alert">
				{gone ? "This plan isn't up any more." : failureText(post.error, "The plan didn't load.")}
				{!gone && (
					<button type="button" onClick={() => void post.refetch()} className={SECONDARY_BUTTON}>
						Try again
					</button>
				)}
			</div>
		)
	}
	return <Body post={post.data} onTakenDown={onTakenDown} />
}

function Body({ post, onTakenDown }: { post: PlanPost; onTakenDown: () => void }) {
	const aboutId = useId()
	const { pull_count: pulls, step_count: steps, row_count: rowCount } = post.plan
	return (
		<div className="flex min-w-0 flex-col gap-4">
			{post.hidden && (
				<p className="rounded-lg border border-highlight/50 bg-highlight/10 p-3 text-sm text-gray-100">
					Hidden while we review it. Only you can see it.
				</p>
			)}

			{/* The author's own words. Plain text with its line breaks; nothing
			    in it becomes a link. */}
			{post.strategy && (
				<section aria-labelledby={aboutId} className={SECTION}>
					<h3 id={aboutId} className="text-sm font-semibold text-gray-100">
						About this plan
					</h3>
					<p className="mt-1.5 whitespace-pre-line break-words text-sm leading-relaxed text-gray-200">{post.strategy}</p>
				</section>
			)}

			{post.income && <PostedIncome income={post.income} authorName={posterName(post.poster)} />}

			<section className={SECTION} aria-label="Banners">
				<p className="text-sm text-gray-300">
					{plural(rowCount, "banner", "banners")} · {planTotalsLine(pulls, steps)}
				</p>
				<StagedRows post={post} />
			</section>

			<Actions post={post} onTakenDown={onTakenDown} />

			<GalleryComments source={postThread(post.public_id)} placeholder="Leave some feedback on this plan" />
		</div>
	)
}

/** The banner rows, each with "Add to my plan". */
function StagedRows({ post }: { post: PlanPost }) {
	const { status, stage } = useStageBanner()
	const [now] = useState(() => new Date())

	const action = (row: UserPlannedBanner, target: Target) => {
		const where = status(row, target.timeline.end_date, now)
		if (where === "ended") return null
		if (where !== "available") {
			return (
				<span className="text-xs font-semibold text-gray-300">{where === "planned" ? "Already in calculator" : "Already staged"}</span>
			)
		}
		// The author's pulls (steps on a step-up), and the banner. Nothing else
		// of theirs: the row's options are the player's to set at "Add to calculator".
		const banner =
			target.type === "Uma"
				? { banner_uma: target.banner }
				: target.type === "Support"
					? { banner_support: target.banner }
					: { banner_step_up: target.banner }
		return (
			<button
				type="button"
				onClick={() =>
					stage({ number_of_pulls: row.number_of_pulls, reserved_copies: 0, initialBannerType: target.type, ...banner }, target.banner.name)
				}
				className={`${SMALL_BUTTON} border border-gray-600 text-gray-100`}
			>
				Add to my plan
			</button>
		)
	}

	return <PlanRows rows={post.rows} action={action} />
}

/** Copy to my plans, Copy link, and Report (or Take down, on your own). */
function Actions({ post, onTakenDown }: { post: PlanPost; onTakenDown: () => void }) {
	const { isLoggedIn } = useAccount()
	const { prompt } = useSignInPrompt()
	const takeDown = useTakeDownPost()
	const [copyOpen, setCopyOpen] = useState(false)
	const [reporting, setReporting] = useState(false)
	const [confirmTakeDown, setConfirmTakeDown] = useState(false)

	const share = async () => {
		const url = galleryShareUrl(post.public_id)
		try {
			await navigator.clipboard.writeText(url)
			toast.success("Link copied.")
		} catch {
			toast(url)
		}
	}

	const remove = () =>
		takeDown.mutate(post.public_id, {
			onSuccess: () => {
				toast.success("Your post is down.")
				onTakenDown()
			},
			onError: (error) => toast.error(failureText(error, "Your post couldn't be taken down. Try again in a moment.")),
		})

	return (
		<div className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2">
				<button type="button" aria-expanded={copyOpen} onClick={() => setCopyOpen((was) => !was)} className={ACTION_BUTTON}>
					<Copy className="h-4 w-4" aria-hidden="true" />
					Copy to my plans
				</button>
				<button type="button" onClick={() => void share()} className={ACTION_BUTTON}>
					<Link2 className="h-4 w-4" aria-hidden="true" />
					Copy link
				</button>
				{post.is_mine ? (
					confirmTakeDown ? (
						<span className="flex items-center gap-1.5 text-sm text-gray-300">
							Take it down?
							<button type="button" disabled={takeDown.isPending} onClick={remove} className={DANGER_BUTTON}>
								Take down
							</button>
							<button type="button" onClick={() => setConfirmTakeDown(false)} className={SECONDARY_BUTTON}>
								Keep
							</button>
						</span>
					) : (
						<button type="button" onClick={() => setConfirmTakeDown(true)} className={ACTION_BUTTON}>
							<Trash2 className="h-4 w-4" aria-hidden="true" />
							Take down
						</button>
					)
				) : (
					<button
						type="button"
						onClick={() => (isLoggedIn ? setReporting(true) : prompt("Sign in to report a plan."))}
						className={ACTION_BUTTON}
					>
						<Flag className="h-4 w-4" aria-hidden="true" />
						Report
					</button>
				)}
			</div>
			{copyOpen && <CopyForm post={post} />}
			{reporting && <ReportDialog target={{ post: post.public_id }} what="plan" onClose={() => setReporting(false)} />}
		</div>
	)
}

/**
 * The copy, both paths. Signed in: name it (the post's title, cut to the
 * name limit), and at the cap delete one first. A guest: the copy replaces
 * the device's rows (a post carries no resources, so the guest's own stay),
 * asked once when there are rows to lose.
 */
function CopyForm({ post }: { post: PlanPost }) {
	const { plans, activePlanId, isPlanBusy, userPlannedBannerData, copyPostedPlan, deletePlan } = useCalculatorData()
	const navigate = useNavigate()
	const [name, setName] = useState(() => post.caption.slice(0, PLAN_NAME_MAX_LENGTH))
	const [confirmingReplace, setConfirmingReplace] = useState(false)
	// A guest has one unnamed plan on the device: no plan list, no active id.
	const isAccount = activePlanId !== null
	const atCap = isAccount && plans.length >= PLAN_CAP
	const guestHasPlan = !isAccount && userPlannedBannerData.length > 0

	const submit = async (event: FormEvent) => {
		event.preventDefault()
		if (isAccount && name.trim() === "") return
		if (guestHasPlan && !confirmingReplace) {
			setConfirmingReplace(true)
			return
		}
		if (await copyPostedPlan(post.public_id, isAccount ? name.trim() : undefined)) navigate("/app")
	}

	return (
		<form onSubmit={(event) => void submit(event)} className={SECTION}>
			{isAccount && (
				<label className="flex max-w-sm flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
					Name your copy
					<input
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						maxLength={PLAN_NAME_MAX_LENGTH}
						className={`${FIELD} font-normal normal-case tracking-normal`}
					/>
				</label>
			)}
			{atCap && <MakeRoom plans={plans} disabled={isPlanBusy} onDelete={(planId) => void deletePlan(planId)} />}
			{confirmingReplace ? (
				<div className="mt-3">
					<p className="text-sm font-semibold text-gray-100">Replace the plan on this device?</p>
					<p className="mt-1 text-sm text-gray-400">Your banners here will be replaced.</p>
					<div className="mt-3 flex gap-2">
						<button type="submit" disabled={isPlanBusy} className={PRIMARY_BUTTON}>
							Replace it
						</button>
						<button type="button" onClick={() => setConfirmingReplace(false)} className={SECONDARY_BUTTON}>
							Cancel
						</button>
					</div>
				</div>
			) : (
				<div className="mt-3 flex flex-wrap items-center gap-3">
					<button type="submit" disabled={isPlanBusy || atCap || (isAccount && name.trim() === "")} className={PRIMARY_BUTTON}>
						{isAccount ? "Copy as a new plan" : "Copy to this device"}
					</button>
					<span className="text-xs text-gray-400">
						{isAccount ? "A new plan with these banners. Your resources stay yours." : "Your resources here stay as they are."}
					</span>
				</div>
			)}
		</form>
	)
}
