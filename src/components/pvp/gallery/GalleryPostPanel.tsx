/**
 * One post, opened from the feed or from its link (`?post=<public_id>`, which
 * is where /post/<id> sends people): who posted it, their caption in full,
 * the whole team, its numbers, and what can be done with it (upvote, copy it
 * into My team, share its link, report it, or take your own down). The
 * comments sit beside it on a wide pane and under it otherwise.
 *
 * Not a dialog. From `lg` up it is the sticky right-hand pane of
 * GalleryView, beside the list; below that it takes the list's place. So the
 * page behind it stays usable, toasts show above it, and Back closes it.
 * Escape closes it while focus is inside.
 *
 * Opening it counts one view (the server ignores your own, and counts each
 * person once a day). A post that is hidden, taken down or never existed says
 * so, the same way for all three.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { ArrowLeft, ChevronDown, ChevronUp, Copy, Eye, Flag, Link2, Loader2, MessageSquare, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { GalleryComments } from "./GalleryComments"
import { GalleryTeam, GalleryUpvote, PosterLine, YouChip } from "./GalleryBits"
import { ReportDialog } from "./ReportDialog"
import { ACTION_BUTTON, DANGER_BUTTON, SECONDARY_BUTTON } from "./galleryStyles"
import { useAccount } from "../../../services/AuthContext"
import { usePvpTeams } from "../../../services/PvpTeamsContext"
import { useCardReleases } from "../../../hooks/useCardReleases"
import { useSignInPrompt } from "../../../hooks/useSignInPrompt"
import type { PvpCatalogueIndex } from "../../../hooks/usePvpCatalogue"
import { galleryCopy, galleryShareUrl, galleryView, refusalText } from "../../../services/galleryFetchCalls"
import { failureText, useGalleryPost, useTakeDownPost } from "../../../services/galleryQueries"
import { HttpError } from "../../../services/queryClient"
import { PVP_TEAM_CAP_PER_EVENT, withinRelease } from "../../../utils/pvpTeams"
import { refForRaceEvent } from "../../../utils/pvpEvent"
import { formatDate } from "../../../utils/dateFormat"
import { formatTimeAgo } from "../../../utils/relativeDate"
import { countLabel } from "../../../utils/plural"
import { teamTitle } from "../../../utils/galleryText"
import type { RaceEvent } from "../../../types"
import type { GalleryCopy, GalleryPost } from "../../../types/gallery"

export function GalleryPostPanel({ publicId, event, index, neighbours, onOpenPost, onClose, onOpenMyTeam }: {
	publicId: string
	event: RaceEvent
	index: PvpCatalogueIndex
	/** The posts above and below this one in the list, when it is in the list. */
	neighbours: { previous: string | null; next: string | null }
	onOpenPost: (publicId: string) => void
	onClose: () => void
	onOpenMyTeam: () => void
}) {
	const post = useGalleryPost(publicId)
	const headingId = useId()
	const headingRef = useRef<HTMLHeadingElement>(null)

	// Focus moves to the title when a post opens (GalleryView mounts one panel
	// per post), without scrolling: on a wide screen the pane is already in
	// view, and on a phone GalleryView has just scrolled to it.
	useEffect(() => {
		headingRef.current?.focus({ preventScroll: true })
	}, [])

	// One view per post per opening, once it has loaded (the server ignores
	// your own and counts each viewer once a day).
	const ready = post.data !== undefined
	useEffect(() => {
		if (ready) galleryView(publicId)
	}, [ready, publicId])

	const missing = post.error instanceof HttpError && post.error.status === 404
	const title = post.data ? teamTitle(post.data.poster) : "Team"

	return (
		<section
			aria-labelledby={headingId}
			onKeyDown={(key) => {
				if (key.key === "Escape") onClose()
			}}
			// Sticky below PvpGuidePage's own sticky event bar (about 54px from
			// md up, so 4.5rem leaves a gap), and no taller than the app
			// scroller (the viewport less the 4.125rem navbar) minus that
			// offset and 1rem underneath, so its own body scrolls.
			className="card-panel flex flex-col overflow-hidden app-shell:sticky app-shell:top-[4.5rem] app-shell:max-h-[calc(100dvh-9.625rem)]"
		>
			<header className="flex items-center gap-1 border-b border-gray-700 px-2 py-2 lg:px-4">
				<button
					type="button"
					onClick={onClose}
					className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-sm text-gray-300 transition hover:bg-gray-700 hover:text-gray-100 lg:hidden"
				>
					<ArrowLeft className="h-4 w-4" aria-hidden="true" />
					All teams
				</button>
				<h2
					id={headingId}
					ref={headingRef}
					tabIndex={-1}
					className="min-w-0 flex-1 truncate px-2 text-base font-semibold text-gray-100 outline-none lg:px-0"
				>
					{title}
				</h2>
				<StepButton label="Previous team" target={neighbours.previous} onOpenPost={onOpenPost}>
					<ChevronUp className="h-5 w-5" />
				</StepButton>
				<StepButton label="Next team" target={neighbours.next} onOpenPost={onOpenPost}>
					<ChevronDown className="h-5 w-5" />
				</StepButton>
				<button
					type="button"
					aria-label="Close"
					onClick={onClose}
					className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-700 hover:text-gray-100 lg:flex"
				>
					<X className="h-5 w-5" />
				</button>
			</header>

			{/* The @container is a wrapper of its own because a container query
			    styles descendants, never the container itself, and it is the
			    scroller below whose overflow has to change with the pane's width. */}
			<div className="@container flex min-h-0 flex-1 flex-col">
				{post.isPending ? (
					<p className="flex items-center gap-2 p-4 text-sm text-gray-400" role="status">
						<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
						Loading the team…
					</p>
				) : missing ? (
					<p className="p-4 text-sm text-gray-300">This team isn't available any more.</p>
				) : post.isError ? (
					<div className="flex flex-col items-start gap-3 p-4 text-sm text-gray-300" role="alert">
						The team didn't load.
						<button type="button" onClick={() => void post.refetch()} className={SECONDARY_BUTTON}>
							Try again
						</button>
					</div>
				) : (
					// Narrow pane: team, then comments, scrolling together (a
					// scroller inside a scroller would be worse). Wide pane (@4xl):
					// side by side, and this stops scrolling; the comments scroll in
					// their own column, so the team stays put while you read them.
					// The team column scrolls too, but only on a window too short
					// to show it whole. All flex, no percentage heights: the panel
					// has a max-height, not a height, so `h-full` would resolve to
					// nothing and the columns would never be held in.
					<div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain @4xl:flex-row @4xl:overflow-hidden">
						<div className="shrink-0 p-4 @4xl:min-w-0 @4xl:flex-1 @4xl:overflow-y-auto @4xl:overscroll-contain">
							<PostBody post={post.data} event={event} index={index} onOpenMyTeam={onOpenMyTeam} onTakenDown={onClose} />
						</div>
						<div className="shrink-0 px-4 pt-2 pb-4 @4xl:w-[22rem] @4xl:overflow-y-auto @4xl:overscroll-contain @4xl:border-l @4xl:border-gray-700 @4xl:p-4">
							<GalleryComments publicId={publicId} />
						</div>
					</div>
				)}
			</div>
		</section>
	)
}

function StepButton({ label, target, onOpenPost, children }: {
	label: string
	target: string | null
	onOpenPost: (publicId: string) => void
	children: ReactNode
}) {
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			disabled={target === null}
			onClick={() => target && onOpenPost(target)}
			className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-gray-400 transition enabled:hover:bg-gray-700 enabled:hover:text-gray-100 disabled:opacity-30"
		>
			{children}
		</button>
	)
}

/** Everything but the comments: the poster in their look, caption, team, strategy, numbers, actions. */
function PostBody({ post, event, index, onOpenMyTeam, onTakenDown }: {
	post: GalleryPost
	event: RaceEvent
	index: PvpCatalogueIndex
	onOpenMyTeam: () => void
	onTakenDown: () => void
}) {
	const { isLoggedIn } = useAccount()
	const { teams, createTeam, ensureLoaded, setTeamPost } = usePvpTeams()
	const releaseFor = useCardReleases(event, index)
	const { prompt } = useSignInPrompt()
	const takeDown = useTakeDownPost()
	const [copying, setCopying] = useState(false)
	const [reporting, setReporting] = useState(false)
	const [confirmTakeDown, setConfirmTakeDown] = useState(false)
	const look = post.poster.gallery_style
	const updated = post.content_updated_at !== post.published_at
	const strategyId = useId()

	const copy = async () => {
		ensureLoaded()
		setCopying(true)
		try {
			const response = await galleryCopy(post.public_id)
			if (!response.ok) {
				toast.error(await refusalText(response, "That team couldn't be copied. Try again in a moment."))
				return
			}
			const copied = (await response.json()) as GalleryCopy
			const key = createTeam(refForRaceEvent(event), { members: withinRelease(copied.members, releaseFor) })
			if (!key) {
				toast.error(`You can keep up to ${PVP_TEAM_CAP_PER_EVENT} teams for one event.`)
				return
			}
			toast.success("Copied to My team.", { action: { label: "Open", onClick: onOpenMyTeam } })
		} catch {
			toast.error("That team couldn't be copied. Try again in a moment.")
		} finally {
			setCopying(false)
		}
	}

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
				const team = teams.find((candidate) => candidate.post === post.public_id)
				if (team) setTeamPost(team.key, null)
				toast.success("Your post is down.")
				onTakenDown()
			},
			onError: (error) => toast.error(failureText(error, "Your post couldn't be taken down. Try again in a moment.")),
		})

	return (
		<div className="flex min-w-0 flex-col gap-5">
			{post.hidden && (
				<p className="rounded-lg border border-highlight/50 bg-highlight/10 p-3 text-sm text-gray-100">
					Hidden while we review it. Only you can see it.
				</p>
			)}

			{/* The poster in their look. Senior Class is the quiet panel here
			    too, the foil edge on the ordinary surface: its coloured fill
			    is off for now (App.css, .ssr-panel--rainbow). */}
			<div
				data-gallery-style={look ?? undefined}
				className={`flex flex-col gap-2 ${look === "ssr" ? "ssr-panel ssr-panel--quiet rounded-xl border p-3" : look ? "card-panel p-3" : ""}`}
			>
				<div className="flex flex-col gap-2">
					<PosterLine poster={post.poster} mine={post.is_mine} extra={post.is_mine && <YouChip />} />
					<p className="text-xs text-gray-400">
						<time dateTime={post.published_at} title={formatDate(post.published_at)}>
							Posted {formatTimeAgo(post.published_at)}
						</time>
						{updated && (
							<time dateTime={post.content_updated_at} title={formatDate(post.content_updated_at)}>
								, updated {formatTimeAgo(post.content_updated_at)}
							</time>
						)}
					</p>
					{post.caption && <p className="whitespace-pre-line break-words text-sm text-gray-100">{post.caption}</p>}
				</div>
			</div>

			<GalleryTeam members={post.team} index={index} />

			{/* The poster's longer text, after the team it talks about. Plain
			    text with its line breaks; nothing in it becomes a link. */}
			{post.strategy && (
				<section aria-labelledby={strategyId} className="flex flex-col gap-1.5 rounded-xl border border-gray-700 bg-gray-900/40 p-3">
					<h3 id={strategyId} className="text-sm font-semibold text-gray-100">
						Strategy
					</h3>
					<p className="whitespace-pre-line break-words text-sm leading-relaxed text-gray-200">{post.strategy}</p>
				</section>
			)}

			<div className="flex flex-wrap items-center gap-3">
				<GalleryUpvote post={post} layout="row" />
				<span className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
					<span className="flex items-center gap-1">
						<Eye className="h-3.5 w-3.5" aria-hidden="true" />
						{countLabel(post.stats.views, "view")}
					</span>
					<span className="flex items-center gap-1">
						<MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
						{countLabel(post.stats.comments, "comment")}
					</span>
					<span className="flex items-center gap-1">
						<Copy className="h-3.5 w-3.5" aria-hidden="true" />
						{countLabel(post.stats.copies, "copy", "copies")}
					</span>
				</span>
			</div>

			<div className="flex flex-wrap gap-2">
				<button type="button" disabled={copying} onClick={() => void copy()} className={ACTION_BUTTON}>
					{copying ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
					Copy to My team
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
						onClick={() => (isLoggedIn ? setReporting(true) : prompt("Sign in to report a team."))}
						className={ACTION_BUTTON}
					>
						<Flag className="h-4 w-4" aria-hidden="true" />
						Report
					</button>
				)}
			</div>
			{reporting && <ReportDialog target={{ post: post.public_id }} what="team" onClose={() => setReporting(false)} />}
		</div>
	)
}
