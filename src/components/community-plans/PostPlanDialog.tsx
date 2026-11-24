/**
 * "Post this plan": the moment a person agrees to show a plan to everyone
 * in Community plans (notes/pull-plan-database-plan.md, PR 4; canvas r4-08).
 * The PublishDialog pattern, on GalleryModal, refusals shown inline.
 *
 * WHAT IT ASKS, AND WHAT IT NEVER ASSUMES
 * ---------------------------------------
 *   Title            required, the row's headline
 *   About this plan  optional, only on the opened post
 *   Spending, Sweat, Strategy   optional picks, the list's filters; every
 *                    label and meaning from the feed's `filters` block
 *   Range            shown, never asked: the server works it out from the
 *                    plan's last counted banner
 *   Include my notes / Include my income   UNTICKED ON EVERY OPEN. Showing
 *                    them is the author's choice each time they post, never
 *                    carried over from a share link or an earlier post
 *   The agree box    their name, picture and tier show beside it
 *
 * Updating keeps the link, the comments and the votes, and starts from the
 * post's current words (loaded first), so an update can't wipe a long
 * description. A posted plan also offers "Take it down".
 *
 * The send is CalculatorProvider.postPlan, which saves any pending edit
 * first: the post is a copy of the saved rows. A refused note names its
 * banner and shows beside the notes box. No display name yet: the same way
 * to set one the team dialog offers.
 */

import { useId, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { useCalculatorData } from "../../services/CalculatorContext"
import { useAccount } from "../../services/AuthContext"
import { failureText, rememberPublished, usePlanFeed, usePlanPost, useTakeDownPost } from "../../services/galleryQueries"
import {
	GALLERY_CAPTION_MAX,
	GALLERY_FEED_STEP,
	GALLERY_STRATEGY_MAX,
	NO_PLAN_FILTERS,
	type PlanFilterChoices,
	type PlanPost,
	type PlanSpending,
	type PlanStrategy,
	type PlanSweat,
} from "../../types/gallery"
import type { Plan } from "../../types"
import { planPostHref } from "../../utils/galleryPost"
import { spendingOptionLabel } from "../../utils/planFeedView"
import { planRange } from "../../utils/planRange"
import { GalleryModal } from "../pvp/gallery/GalleryModal"
import { DANGER_BUTTON, FIELD, PRIMARY_BUTTON, SECONDARY_BUTTON } from "../pvp/gallery/galleryStyles"

const HEADING = "text-[11px] font-bold uppercase tracking-[0.08em] text-gray-400"

export function PostPlanDialog({ plan, onClose }: { plan: Plan; onClose: () => void }) {
	const { account } = useAccount()
	const displayName = account?.display_name ?? ""
	const postId = plan.post_public_id ?? null
	const existing = usePlanPost(postId)
	// The same request the page's default list makes, so it is usually cached.
	const feed = usePlanFeed({ sort: "top", window: "week", filters: NO_PLAN_FILTERS, limit: GALLERY_FEED_STEP })
	const updating = postId !== null
	// A disabled query reads as pending too, hence the postId check. A post
	// that doesn't load (taken down meanwhile) just means blank boxes.
	const loading = (updating && existing.isPending) || feed.isPending

	return (
		<GalleryModal title={updating ? "Update your plan's post" : "Post this plan to the Pull Plan Library"} onClose={onClose}>
			{!displayName ? (
				<div className="flex flex-col gap-4 text-sm text-gray-300">
					<p>A post shows your display name, and you haven't set one yet.</p>
					<div className="flex justify-end gap-2">
						<button type="button" onClick={onClose} className={SECONDARY_BUTTON}>
							Not now
						</button>
						<Link to="/account" className={PRIMARY_BUTTON}>
							Set a display name
						</Link>
					</div>
				</div>
			) : loading ? (
				<div className="flex items-center justify-center gap-2 p-6 text-sm text-gray-400" role="status">
					<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
					Loading…
				</div>
			) : feed.isError || !feed.data ? (
				<p className="text-sm text-gray-300" role="alert">
					{failureText(feed.error, "The Pull Plan Library didn't load. Try again in a moment.")}
				</p>
			) : (
				<PostForm plan={plan} displayName={displayName} choices={feed.data.filters} initial={existing.data} onClose={onClose} />
			)}
		</GalleryModal>
	)
}

function PostForm({ plan, displayName, choices, initial, onClose }: {
	plan: Plan
	displayName: string
	choices: PlanFilterChoices
	/** The post being updated: its words and picks fill the form. Never its two ticks. */
	initial: PlanPost | undefined
	onClose: () => void
}) {
	const { postPlan, forgetPlanPost, isPlanBusy, activePlanId, userPlannedBannerData, scenarioData } = useCalculatorData()
	const queryClient = useQueryClient()
	const navigate = useNavigate()
	const takeDown = useTakeDownPost()
	const [caption, setCaption] = useState(initial?.caption ?? "")
	const [about, setAbout] = useState(initial?.strategy ?? "")
	const [spending, setSpending] = useState<PlanSpending | "">(initial?.spending ?? "")
	const [sweat, setSweat] = useState<PlanSweat | "">(initial?.sweat ?? "")
	const [strategies, setStrategies] = useState<PlanStrategy[]>(initial?.strategies ?? [])
	// Unticked on every open: see the header.
	const [includeNotes, setIncludeNotes] = useState(false)
	const [includeIncome, setIncludeIncome] = useState(false)
	const [agreed, setAgreed] = useState(false)
	const [sending, setSending] = useState(false)
	const [confirmTakeDown, setConfirmTakeDown] = useState(false)
	const [error, setError] = useState<{ text: string; field: string | null } | null>(null)
	const errorId = useId()
	const updating = plan.post_public_id != null
	// What the post's range will be, worked out from the rows on screen when
	// they are this plan's (the dialog posts the open plan); else the post's own.
	const range = plan.id === activePlanId ? planRange(userPlannedBannerData, scenarioData ?? [])?.name : initial?.range?.label

	/** Marks the box a refusal named, and points it at the message. */
	const faultProps = (field: string) =>
		error?.field === field ? { "aria-invalid": true, "aria-describedby": errorId } : {}

	const send = async () => {
		setSending(true)
		setError(null)
		const result = await postPlan(plan.id, {
			caption: caption.trim(),
			strategy: about.trim(),
			spending,
			sweat,
			strategies,
			include_notes: includeNotes,
			include_income: includeIncome,
			confirm_public_identity: agreed,
		})
		setSending(false)
		if (!result.ok) {
			setError({ text: result.text, field: result.field })
			return
		}
		rememberPublished(queryClient, result.post)
		onClose()
		// After the close, so it is not hidden under the dialog.
		toast.success(updating ? "Your post is updated." : "Your plan is in the Pull Plan Library.", {
			action: { label: "Open", onClick: () => navigate(planPostHref(result.post.public_id)) },
		})
	}

	const remove = () => {
		const publicId = plan.post_public_id
		if (!publicId) return
		takeDown.mutate(publicId, {
			onSuccess: () => {
				forgetPlanPost(publicId)
				onClose()
				toast.success("Your post is down.")
			},
			onError: (failure) => setError({ text: failureText(failure, "Your post couldn't be taken down. Try again in a moment."), field: null }),
		})
	}

	const toggleStrategy = (style: PlanStrategy, on: boolean) =>
		setStrategies(choices.strategies.map((choice) => choice.value).filter((value) => (value === style ? on : strategies.includes(value))))

	// The error, placed beside the field it is about when the API named one.
	const errorBox = (
		<p id={errorId} className="rounded-lg border border-highlight/50 bg-highlight/10 p-3 text-gray-100" role="alert">
			{error?.text}
		</p>
	)
	const errorAt = (field: string | null) => error && (error.field ?? null) === field && errorBox
	const errorElsewhere = error && !["caption", "strategy", "notes"].includes(error.field ?? "") && errorBox

	return (
		<form
			className="flex flex-col gap-4 text-sm text-gray-300"
			onSubmit={(submit) => {
				submit.preventDefault()
				void send()
			}}
		>
			<p>
				Everyone who opens the Pull Plan Library will see this plan's banners and pulls with your display name,{" "}
				<span className="font-semibold text-gray-100">{displayName}</span>, your favorite uma picture and, if you support us on
				Patreon, your tier. You can take it down any time.
			</p>
			{updating && (
				<p className="rounded-lg border border-gray-600 bg-gray-900/60 p-3">
					This updates your post with the plan as it is now. The link, comments and votes stay.
				</p>
			)}

			<label className="flex flex-col gap-1">
				Title
				<input
					type="text"
					value={caption}
					maxLength={GALLERY_CAPTION_MAX}
					onChange={(change) => setCaption(change.target.value)}
					placeholder="F2P road to the anniversary"
					className={`${FIELD} aria-invalid:border-highlight`}
					{...faultProps("caption")}
				/>
				<span className="text-xs text-gray-500">
					{caption.length}/{GALLERY_CAPTION_MAX}. The headline in the list. No links.
				</span>
			</label>
			{errorAt("caption")}

			<label className="flex flex-col gap-1">
				About this plan (optional)
				<textarea
					value={about}
					maxLength={GALLERY_STRATEGY_MAX}
					rows={4}
					onChange={(change) => setAbout(change.target.value)}
					placeholder="What you're saving for, what you skip and why"
					className={`${FIELD} resize-y aria-invalid:border-highlight`}
					{...faultProps("strategy")}
				/>
				<span className="text-xs text-gray-500">
					{about.length}/{GALLERY_STRATEGY_MAX}. Shows when someone opens your plan. No links.
				</span>
			</label>
			{errorAt("strategy")}

			{/* One box per line: "Orca - Discounted packs only" is wider than half
			    of the dialog's 32rem, and a closed select cuts its text off. */}
			<div className="grid gap-3">
				<label className="flex flex-col gap-1">
					Spending level (optional)
					<select value={spending} onChange={(change) => setSpending(change.target.value as PlanSpending | "")} className={FIELD}>
						<option value="">Not saying</option>
						{/* "Minnow - Daily Carat Pack only": what a level means shows
						    before it is picked (Henry, board 2026-11-24). */}
						{choices.spending.map((level) => (
							<option key={level.value} value={level.value}>
								{spendingOptionLabel(level)}
							</option>
						))}
					</select>
				</label>
				<label className="flex flex-col gap-1">
					Sweat level (optional)
					<select value={sweat} onChange={(change) => setSweat(change.target.value as PlanSweat | "")} className={FIELD}>
						<option value="">Not saying</option>
						{choices.sweat.map((level) => (
							<option key={level.value} value={level.value}>
								{level.label}
							</option>
						))}
					</select>
				</label>
			</div>

			<fieldset className="flex flex-col gap-1.5">
				<legend className="mb-1">Strategy (optional)</legend>
				<div className="flex flex-wrap gap-x-4 gap-y-1.5">
					{choices.strategies.map((style) => (
						<label key={style.value} className="flex cursor-pointer items-center gap-2 text-gray-200">
							<input
								type="checkbox"
								checked={strategies.includes(style.value)}
								onChange={(change) => toggleStrategy(style.value, change.target.checked)}
								className="h-4 w-4 accent-brand"
							/>
							{style.label}
						</label>
					))}
				</div>
			</fieldset>

			<p className="text-xs text-gray-400">
				{range ? `Runs up to ${range}. ` : ""}
				The range filter is worked out from your plan's last banner each time you post.
			</p>

			<div className="flex flex-col gap-3 rounded-lg border border-gray-700 bg-gray-900/40 p-3">
				<p className={HEADING}>Also show</p>
				<label className="flex cursor-pointer items-start gap-2 text-gray-100">
					<input
						type="checkbox"
						checked={includeNotes}
						onChange={(change) => setIncludeNotes(change.target.checked)}
						className="mt-0.5 accent-brand"
						{...faultProps("notes")}
					/>
					<span>
						Include my notes
						<span className="block text-xs text-gray-400">Everyone will see the note on each banner.</span>
					</span>
				</label>
				{errorAt("notes")}
				<label className="flex cursor-pointer items-start gap-2 text-gray-100">
					<input
						type="checkbox"
						checked={includeIncome}
						onChange={(change) => setIncludeIncome(change.target.checked)}
						className="mt-0.5 accent-brand"
					/>
					<span>
						Include my income
						<span className="block text-xs text-gray-400">
							Everyone will see your ranks, your income settings and what they earn a month. Your carats, tickets and crystals
							are never shown.
						</span>
					</span>
				</label>
			</div>

			<label className="flex cursor-pointer items-start gap-2 text-gray-100">
				<input type="checkbox" checked={agreed} onChange={(change) => setAgreed(change.target.checked)} className="mt-0.5 accent-brand" />
				Show my name, picture and tier with this plan
			</label>
			<p className="text-xs text-gray-500">
				You can hide your tier on your{" "}
				<Link to="/account" className="text-brand hover:text-brand/75">
					account page
				</Link>
				. Please keep to the{" "}
				<Link to="/terms" className="text-brand hover:text-brand/75">
					posting rules
				</Link>
				.
			</p>
			{errorElsewhere}

			<div className="flex flex-wrap items-center justify-end gap-2">
				{updating &&
					(confirmTakeDown ? (
						<span className="mr-auto flex items-center gap-1.5 text-gray-300">
							Take it down?
							<button type="button" disabled={takeDown.isPending} onClick={remove} className={DANGER_BUTTON}>
								Take down
							</button>
							<button type="button" onClick={() => setConfirmTakeDown(false)} className={SECONDARY_BUTTON}>
								Keep
							</button>
						</span>
					) : (
						<button type="button" onClick={() => setConfirmTakeDown(true)} className={`${SECONDARY_BUTTON} mr-auto`}>
							Take it down
						</button>
					))}
				<button type="button" onClick={onClose} className={SECONDARY_BUTTON}>
					Cancel
				</button>
				<button type="submit" disabled={!agreed || sending || isPlanBusy || caption.trim() === ""} className={PRIMARY_BUTTON}>
					{sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
					{updating ? "Update post" : "Post plan"}
				</button>
			</div>
		</form>
	)
}
