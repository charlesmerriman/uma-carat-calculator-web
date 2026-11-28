/**
 * Community guides on the PvP page's Recommendations view: players' own
 * guides for one event (notes/community-guides-plan.md). A chunk of its own
 * (loadCommunityGuides.ts): only a reader the switch is drawn for loads it.
 *
 *   the list    the event's guides, Top or New: the gallery's own row with the
 *               guide's title leading, three lead umas, views and comments
 *   one guide   a band (vote, title, writer, Copy link, Report or Take down)
 *               over PvpGuideView drawing the guide, then ONE comment thread,
 *               the post's (owner, 2026-11-27, decision 5)
 *
 * The guide arrives from the server already in the reader's shape, exactly as
 * the site's guide does (backend guide_gallery.render_post), so it is drawn by
 * the same component with nothing rebuilt here. Two contexts mark it as a
 * player's: its text draws no pictures and no links (UntrustedTextContext),
 * and the guide's per-section threads stand aside (CommunityGuideContext).
 *
 * `top` is the row the page draws above (the switch); `writer` the writer's
 * own bar (PR 4: "Write a guide" or "My guides"), slotted under it.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { ArrowLeft, Eye, Flag, Link2, Loader2, MessageSquare, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { GalleryComments } from "../gallery/GalleryComments"
import { GalleryVote, PosterLine, UmaPortrait, YouChip } from "../gallery/GalleryBits"
import { ReportDialog } from "../gallery/ReportDialog"
import { ACTION_BUTTON, DANGER_BUTTON, SECONDARY_BUTTON } from "../gallery/galleryStyles"
import { PvpGuideView } from "../PvpGuideView"
import { CommunityGuideContext } from "../communityGuideContext"
import { UntrustedTextContext } from "../../info/untrustedText"
import { useAccount } from "../../../services/AuthContext"
import { useSignInPrompt } from "../../../hooks/useSignInPrompt"
import { usePvpCatalogue, type PvpCatalogueIndex } from "../../../hooks/usePvpCatalogue"
import { galleryShareUrl, galleryView } from "../../../services/galleryFetchCalls"
import { guideDeckUsed } from "../../../services/guideGalleryFetchCalls"
import { failureText, postThread, useGuideFeed, useGuidePost, useTakeDownPost } from "../../../services/galleryQueries"
import { HttpError } from "../../../services/queryClient"
import { refForRaceEvent } from "../../../utils/pvpEvent"
import { formatDate } from "../../../utils/dateFormat"
import { formatTimeAgo } from "../../../utils/relativeDate"
import { countLabel } from "../../../utils/plural"
import { GUIDE_SORTS, type GuidePostRow, type GuideSort } from "../../../types/gallery"
import type { RaceEvent } from "../../../types"
import type { PvpDeck, PvpStyleTab } from "../../../types/pvpGuide"

const PILL_GROUP = "flex gap-1 rounded-lg bg-gray-900/70 p-1"
const PILL = "rounded-md px-3 py-1.5 text-sm font-medium transition"
const PILL_ON = "bg-gray-700 text-brand shadow-sm"
const PILL_OFF = "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
const LOADING = "flex items-center gap-2 text-sm text-gray-400"
const NOTE = "rounded-xl border border-edge bg-gray-800/60 p-4 text-sm text-gray-300"

export function CommunityGuides({ event, sort, onSort, openGuide, guideHref, onBack, style, onStyleChange, onUseDeck, top, writer }: {
	event: RaceEvent
	sort: GuideSort
	onSort: (sort: GuideSort) => void
	/** The guide open, by its post's public id, or null for the list. */
	openGuide: string | null
	/** The address that opens one guide, for the rows' links. */
	guideHref: (publicId: string) => string
	/** Back from one guide to the list. */
	onBack: () => void
	style: PvpStyleTab | null
	onStyleChange: (style: PvpStyleTab) => void
	/** "Use this deck"; absent where My team is closed to the reader. */
	onUseDeck?: (deck: PvpDeck) => void
	top: ReactNode
	writer?: ReactNode
}) {
	if (openGuide !== null) {
		return (
			<CommunityGuideReader
				key={openGuide}
				publicId={openGuide}
				event={event}
				onBack={onBack}
				style={style}
				onStyleChange={onStyleChange}
				onUseDeck={onUseDeck}
				top={top}
			/>
		)
	}
	return <GuideList event={event} sort={sort} onSort={onSort} guideHref={guideHref} top={top} writer={writer} />
}

function GuideList({ event, sort, onSort, guideHref, top, writer }: {
	event: RaceEvent
	sort: GuideSort
	onSort: (sort: GuideSort) => void
	guideHref: (publicId: string) => string
	top: ReactNode
	writer?: ReactNode
}) {
	const feed = useGuideFeed(refForRaceEvent(event), sort)
	const loaded = usePvpCatalogue()
	// The rows draw their umas once the catalogue is in; until then, empty frames.
	const catalogue = loaded.status === "ready" ? loaded : null
	return (
		<div className="@container/feed flex min-w-0 flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2">
				{top}
				<div className={`${PILL_GROUP} ml-auto`} role="group" aria-label="Sort guides">
					{GUIDE_SORTS.map((option) => (
						<button
							key={option.id}
							type="button"
							aria-pressed={sort === option.id}
							onClick={() => onSort(option.id)}
							className={`${PILL} ${sort === option.id ? PILL_ON : PILL_OFF}`}
						>
							{option.label}
						</button>
					))}
				</div>
			</div>
			{writer}
			{feed.isPending && (
				<p className={LOADING} role="status">
					<Loader2 className="h-4 w-4 animate-spin" />
					Loading the community guides…
				</p>
			)}
			{feed.isError && <p className={NOTE}>{failureText(feed.error, "The community guides didn't load.")}</p>}
			{feed.data && feed.data.results.length === 0 && (
				<p className={NOTE}>No community guides for this event yet.</p>
			)}
			{feed.data && feed.data.results.length > 0 && (
				<ol className="flex flex-col gap-3" aria-label={`Community guides for ${event.name}`}>
					{feed.data.results.map((row) => (
						<li key={row.public_id}>
							<GuideRow row={row} index={catalogue} href={guideHref(row.public_id)} />
						</li>
					))}
				</ol>
			)}
		</div>
	)
}

/**
 * One guide on the list: the gallery's row (GalleryRow) with the guide's title
 * leading, the writer and when under it, its lead umas without a team's style
 * chips, and its views and comments. A supporter's row wears their gallery
 * look. The whole row is a link to the guide.
 */
function GuideRow({ row, index, href }: { row: GuidePostRow; index: Pick<PvpCatalogueIndex, "umasById"> | null; href: string }) {
	const look = row.poster.gallery_style
	const updated = row.content_updated_at !== row.published_at
	return (
		<article
			data-gallery-style={look ?? undefined}
			className={look === "ssr" ? "ssr-panel ssr-panel--quiet rounded-xl border" : "card-panel"}
		>
			<div className="relative flex gap-3 p-3">
				<Link
					to={href}
					aria-label={`Open ${row.caption}`}
					className="absolute inset-0 z-[1] rounded-xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
				/>
				<div className="relative z-[2] self-start @4xl/feed:self-center">
					<GalleryVote post={row} layout="column" />
				</div>
				<div className="flex min-w-0 flex-1 flex-col gap-2 @4xl/feed:flex-row @4xl/feed:items-center @4xl/feed:gap-6">
					<div className="flex min-w-0 flex-col gap-1.5 @4xl/feed:flex-1">
						<p className="break-words text-base font-semibold text-gray-100">{row.caption}</p>
						<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
							<PosterLine
								poster={row.poster}
								mine={row.is_mine}
								extra={row.is_mine && <YouChip />}
								avatarClassName="@4xl/feed:h-9 @4xl/feed:w-9"
								nameClassName="@4xl/feed:text-base"
							/>
							<time
								dateTime={row.published_at}
								title={`Posted ${formatDate(row.published_at)}${updated ? `, edited ${formatDate(row.content_updated_at)}` : ""}`}
								className="shrink-0 text-xs text-gray-500"
							>
								{formatTimeAgo(row.published_at)}
								{updated ? ", edited" : ""}
							</time>
						</div>
					</div>
					{row.umas.length > 0 && (
						<ul className="grid grid-cols-3 gap-2 @4xl/feed:w-80 @4xl/feed:shrink-0 @6xl/feed:w-[30rem]" aria-label="Umas">
							{row.umas.map((member) => {
								const uma = index?.umasById.get(member.uma)
								return (
									<li key={member.uma} className="flex min-w-0 flex-col items-center gap-1 text-center">
										<UmaPortrait uma={uma} className="w-14" />
										<span className="w-full truncate text-xs text-gray-200">{uma?.name ?? "Unknown uma"}</span>
									</li>
								)
							})}
						</ul>
					)}
					<p className="flex flex-wrap items-center gap-3 text-xs text-gray-400 @4xl/feed:w-28 @4xl/feed:shrink-0 @4xl/feed:flex-col @4xl/feed:items-start @4xl/feed:gap-1.5">
						<span className="flex items-center gap-1">
							<Eye className="h-3.5 w-3.5" aria-hidden="true" />
							{countLabel(row.stats.views, "view")}
						</span>
						<span className="flex items-center gap-1">
							<MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
							{countLabel(row.stats.comments, "comment")}
						</span>
					</p>
				</div>
			</div>
		</article>
	)
}

function CommunityGuideReader({ publicId, event, onBack, style, onStyleChange, onUseDeck, top }: {
	publicId: string
	event: RaceEvent
	onBack: () => void
	style: PvpStyleTab | null
	onStyleChange: (style: PvpStyleTab) => void
	onUseDeck?: (deck: PvpDeck) => void
	top: ReactNode
}) {
	const post = useGuidePost(publicId)
	const { isLoggedIn } = useAccount()
	const { prompt } = useSignInPrompt()
	const takeDown = useTakeDownPost()
	const [reporting, setReporting] = useState(false)
	const [confirmTakeDown, setConfirmTakeDown] = useState(false)
	const headingId = useId()
	const headingRef = useRef<HTMLHeadingElement>(null)

	// One view per opening, once it has loaded (the server ignores your own
	// and counts each viewer once a day).
	const ready = post.data !== undefined
	useEffect(() => {
		if (ready) galleryView(publicId)
	}, [ready, publicId])

	const back = (
		<button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-sm text-brand transition hover:text-brand/75">
			<ArrowLeft className="h-4 w-4" aria-hidden="true" />
			All community guides
		</button>
	)
	const header = (
		<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
			{top}
			{back}
		</div>
	)

	if (post.isPending) {
		return (
			<div className="flex flex-col gap-3">
				{header}
				<p className={LOADING} role="status">
					<Loader2 className="h-4 w-4 animate-spin" />
					Loading the guide…
				</p>
			</div>
		)
	}
	if (post.isError || !post.data) {
		const missing = post.error instanceof HttpError && post.error.status === 404
		return (
			<div className="flex flex-col gap-3">
				{header}
				<p className={NOTE}>{missing ? "This guide isn't available any more." : failureText(post.error, "The guide didn't load.")}</p>
			</div>
		)
	}

	const guidePost = post.data
	const look = guidePost.poster.gallery_style
	const updated = guidePost.content_updated_at !== guidePost.published_at
	const share = async () => {
		const url = galleryShareUrl(guidePost.public_id)
		try {
			await navigator.clipboard.writeText(url)
			toast.success("Link copied.")
		} catch {
			toast(url)
		}
	}
	const remove = () =>
		takeDown.mutate(guidePost.public_id, {
			onSuccess: () => {
				toast.success("Your guide is down.")
				onBack()
			},
			onError: (error) => toast.error(failureText(error, "Your guide couldn't be taken down. Try again in a moment.")),
		})
	// The deck itself goes along: its ids are this guide's own (utils/pvpTeams.ts).
	const useDeck = onUseDeck
		? (deck: PvpDeck) => {
				guideDeckUsed(guidePost.public_id)
				onUseDeck(deck)
			}
		: undefined

	return (
		<div className="flex flex-col gap-4">
			{header}
			{guidePost.hidden && (
				<p className="rounded-lg border border-highlight/50 bg-highlight/10 p-3 text-sm text-gray-100">
					Hidden while we review it. Only you can see it.
				</p>
			)}
			<article
				aria-labelledby={headingId}
				data-gallery-style={look ?? undefined}
				className={look === "ssr" ? "ssr-panel ssr-panel--quiet rounded-xl border" : "card-panel"}
			>
				<div className="flex flex-wrap items-center gap-3 p-3">
					<GalleryVote post={guidePost} layout="column" />
					<div className="flex min-w-[12rem] flex-1 flex-col gap-1.5">
						<h2 id={headingId} ref={headingRef} tabIndex={-1} className="break-words text-xl font-bold text-gray-100 outline-none">
							{guidePost.caption}
						</h2>
						<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
							<PosterLine
								poster={guidePost.poster}
								mine={guidePost.is_mine}
								card={{ kind: "post", id: guidePost.public_id }}
								extra={guidePost.is_mine && <YouChip />}
							/>
							<time dateTime={guidePost.published_at} title={formatDate(guidePost.published_at)}>
								{formatTimeAgo(guidePost.published_at)}
								{updated ? ", edited" : ""}
							</time>
							<span className="flex items-center gap-1">
								<Eye className="h-3.5 w-3.5" aria-hidden="true" />
								{countLabel(guidePost.stats.views, "view")}
							</span>
							<span className="flex items-center gap-1">
								<MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
								{countLabel(guidePost.stats.comments, "comment")}
							</span>
						</div>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<button type="button" onClick={() => void share()} className={ACTION_BUTTON}>
							<Link2 className="h-4 w-4" aria-hidden="true" />
							Copy link
						</button>
						{guidePost.is_mine ? (
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
								onClick={() => (isLoggedIn ? setReporting(true) : prompt("Sign in to report a guide."))}
								className={ACTION_BUTTON}
							>
								<Flag className="h-4 w-4" aria-hidden="true" />
								Report
							</button>
						)}
					</div>
				</div>
			</article>

			{guidePost.guide ? (
				<UntrustedTextContext.Provider value={true}>
					<CommunityGuideContext.Provider value={true}>
						<PvpGuideView guide={guidePost.guide} style={style} onStyleChange={onStyleChange} event={event} onUseDeck={useDeck} />
					</CommunityGuideContext.Provider>
				</UntrustedTextContext.Provider>
			) : (
				<p className={NOTE}>The guide didn't load.</p>
			)}

			{/* The thread names its own region ("Comments"). */}
			<div className="rounded-xl border border-edge bg-gray-800/60 p-3">
				<GalleryComments source={postThread(guidePost.public_id)} placeholder="Leave some feedback on this guide" />
			</div>
			{reporting && <ReportDialog target={{ post: guidePost.public_id }} what="guide" onClose={() => setReporting(false)} />}
		</div>
	)
}
