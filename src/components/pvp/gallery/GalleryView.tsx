/**
 * The PvP page's Gallery view: teams other players posted for the selected
 * event, ranked Hot (default), Top or New, filterable by uma.
 *
 * LAYOUT. From `lg` (64rem, the width of `desktop-nav`) up it is two panes:
 * the feed on the left and the open post beside it, inline and sticky, so
 * moving from team to team is one click and the list never goes dark behind
 * an overlay. Below that the post
 * takes the feed's place (the feed stays mounted, hidden, so it keeps its
 * rows), and closing it goes back to where you were in the list.
 *
 * ADDRESSES. Sort, filter and open post are URL parameters
 * (`?sort=top&uma=12&post=k3Df8aQ2`), and every row is a real link, so a post
 * opens in a new tab with a middle click and /post/<id> lands here with
 * `post` set. Opening a post from the list pushes a history entry marked
 * `galleryFromFeed`; closing it then goes Back, so Back and the close button
 * agree. Switching posts while one is open, sorting and filtering replace.
 *
 * DATA. Rows come from the query cache (services/galleryQueries.ts). "Load
 * more" asks for a longer list from the top, never a next page: Hot and Top
 * are re-ranked on every request, so an offset page repeats or skips posts
 * that moved meanwhile.
 *
 * Supporter looks come from the post's `gallery_style` key only. In the list
 * they are quiet (App.css, "Gallery looks": a foil or gold edge, the SSR
 * shine only on hover) so rank, not tier, decides what stands out; the open
 * post wears the full look. The tier name is always text beside the picture.
 *
 * Inside the /app loading gate, so it may use the browser freely.
 */

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Link, useLocation, useNavigate, useNavigationType, useSearchParams } from "react-router-dom"
import { Eye, Loader2, MessageSquare, MousePointerClick, Send, Users } from "lucide-react"
import { GalleryPostPanel } from "./GalleryPostPanel"
import { GalleryUpvote, PosterLine, StyleChip, UmaPortrait, YouChip } from "./GalleryBits"
import { ACTION_BUTTON, SECONDARY_BUTTON } from "./galleryStyles"
import { useAccount } from "../../../services/AuthContext"
import { usePvpTeams } from "../../../services/PvpTeamsContext"
import { useGalleryFeed, useGalleryPost } from "../../../services/galleryQueries"
import { useSignInPrompt } from "../../../hooks/useSignInPrompt"
import { usePvpCatalogue, type PvpCatalogueIndex } from "../../../hooks/usePvpCatalogue"
import { refForRaceEvent, sameEvent, type PvpEventRef } from "../../../utils/pvpEvent"
import { formatDate } from "../../../utils/dateFormat"
import { formatTimeAgo } from "../../../utils/relativeDate"
import { countLabel } from "../../../utils/plural"
import { teamTitle } from "../../../utils/galleryText"
import type { RaceEvent } from "../../../types"
import {
	GALLERY_FEED_STEP,
	GALLERY_SORTS,
	type GalleryFeed,
	type GalleryRow as Row,
	type GallerySort,
} from "../../../types/gallery"

const SORT_PARAM = "sort"
const UMA_PARAM = "uma"
const POST_PARAM = "post"

/**
 * `lg`, where the post moves beside the feed. The same 64rem as the custom
 * `desktop-nav` variant, but the layout uses `lg:` because Tailwind emits
 * custom variants AFTER its breakpoints, so a `desktop-nav:` column would
 * beat the `xl:` one meant to widen it.
 */
const TWO_PANES = "(min-width: 64rem)"

/**
 * Under the sort buttons: what the order means. Hot and Top say that
 * supporters weigh more, because the counts on the rows are people and the
 * order is points, and without the sentence a 5 above a 7 looks like a bug.
 */
const SORT_NOTES: Record<GallerySort, string> = {
	hot: "Upvoted teams rise to the top and sink as they age.",
	top: "The most upvoted teams first.",
	new: "The newest teams first.",
}
const WEIGHT_NOTE = "Upvotes from supporters, and supporters' own posts, count a bit extra, so the order won't always match the numbers."

function parseSort(value: string | null): GallerySort {
	return GALLERY_SORTS.some((sort) => sort.id === value) ? (value as GallerySort) : "hot"
}

function parseUma(value: string | null): number | null {
	const id = Number(value)
	return value && Number.isInteger(id) && id > 0 ? id : null
}

/** The id of a row's link, so focus can go back to it when its post closes. */
function rowLinkId(publicId: string): string {
	return `gallery-row-${publicId}`
}

interface FeedHistoryState {
	/** This entry was pushed by opening a post from the list, so closing it is Back. */
	galleryFromFeed?: boolean
}

export function GalleryView({ event, onOpenMyTeam }: { event: RaceEvent; onOpenMyTeam: () => void }) {
	const [searchParams] = useSearchParams()
	const location = useLocation()
	const navigate = useNavigate()
	const navigationType = useNavigationType()
	const sort = parseSort(searchParams.get(SORT_PARAM))
	const uma = parseUma(searchParams.get(UMA_PARAM))
	const openPost = searchParams.get(POST_PARAM)
	const fromFeed = (location.state as FeedHistoryState | null)?.galleryFromFeed === true
	const ref = refForRaceEvent(event)
	const catalogue = usePvpCatalogue()

	// How long each list has grown, remembered per event, sort and filter, so
	// switching back to a sort you had expanded keeps it expanded.
	const listKey = `${ref.kind}-${ref.id}-${sort}-${uma ?? "any"}`
	const [limits, setLimits] = useState<Record<string, number>>({})
	const limit = limits[listKey] ?? GALLERY_FEED_STEP
	const feed = useGalleryFeed(ref, sort, uma, limit)
	const rows = feed.data?.results ?? []

	/** This address with some parameters changed (`null` removes one). */
	const withParams = (changes: Record<string, string | null>) => {
		const next = new URLSearchParams(searchParams)
		for (const [name, value] of Object.entries(changes)) {
			if (value === null) next.delete(name)
			else next.set(name, value)
		}
		return `?${next}`
	}
	const replaceParams = (changes: Record<string, string | null>) =>
		navigate(withParams(changes), { replace: true, preventScrollReset: true })

	const closePost = () => {
		if (fromFeed) navigate(-1)
		else replaceParams({ [POST_PARAM]: null })
	}
	const switchPost = (publicId: string) =>
		navigate(withParams({ [POST_PARAM]: publicId }), { replace: true, state: location.state, preventScrollReset: true })

	// Below two panes the post replaces the list, so its top has to be brought
	// into view when it opens, and the list put back where it was when it
	// closes: Back restores the scroll on its own (useScrollReset); a close
	// that replaced the address scrolls to the row instead. Either way focus
	// returns to the row's link, for keyboards and screen readers.
	const rootRef = useRef<HTMLDivElement>(null)
	const lastOpened = useRef<string | null>(null)
	useEffect(() => {
		const twoPanes = window.matchMedia(TWO_PANES).matches
		if (openPost) {
			lastOpened.current = openPost
			if (!twoPanes) rootRef.current?.scrollIntoView({ block: "start" })
			return
		}
		const closed = lastOpened.current
		lastOpened.current = null
		if (!closed) return
		const link = document.getElementById(rowLinkId(closed))
		if (!twoPanes && navigationType !== "POP") link?.scrollIntoView({ block: "center" })
		link?.focus({ preventScroll: true })
	}, [openPost, navigationType])

	const openIndex = openPost ? rows.findIndex((row) => row.public_id === openPost) : -1
	const neighbours = {
		previous: openIndex > 0 ? rows[openIndex - 1].public_id : null,
		next: openIndex >= 0 && openIndex < rows.length - 1 ? rows[openIndex + 1].public_id : null,
	}

	const nobodyPosted = feed.data !== undefined && !feed.isPlaceholderData && feed.data.count === 0 && uma === null
	const failed = feed.isError || catalogue.status === "error"

	const list = (
		<div className={`flex min-w-0 flex-col gap-3 ${openPost ? "hidden lg:flex" : ""}`}>
			<FeedToolbar
				sort={sort}
				uma={uma}
				feed={feed.data}
				index={catalogue.status === "ready" ? catalogue : null}
				onSort={(next) => replaceParams({ [SORT_PARAM]: next === "hot" ? null : next })}
				onFilter={(next) => replaceParams({ [UMA_PARAM]: next === null ? null : String(next) })}
			/>
			<YourPostBar
				eventRef={ref}
				eventName={event.name}
				postHref={(publicId) => withParams({ [POST_PARAM]: publicId })}
				onOpenMyTeam={onOpenMyTeam}
			/>

			{failed ? (
				<div className="card-panel flex flex-col items-start gap-3 p-4 text-sm text-gray-300" role="alert">
					The gallery didn't load.
					<button type="button" onClick={() => void feed.refetch()} className={SECONDARY_BUTTON}>
						Try again
					</button>
				</div>
			) : feed.data === undefined || catalogue.status === "loading" ? (
				<FeedSkeleton />
			) : rows.length === 0 ? (
				<div className="card-panel flex flex-col items-center gap-2 p-6 text-center text-sm text-gray-300">
					<Users className="h-6 w-6 text-gray-500" aria-hidden="true" />
					No teams with {catalogue.umasById.get(uma ?? 0)?.name ?? "that uma"} yet.
					<button type="button" onClick={() => replaceParams({ [UMA_PARAM]: null })} className="font-medium text-brand hover:text-brand/75">
						Show every team
					</button>
				</div>
			) : (
				<>
					<ol
						className={`flex flex-col gap-3 transition-opacity ${feed.isPlaceholderData ? "opacity-60" : ""}`}
						aria-label={`Teams for ${event.name}`}
						aria-busy={feed.isPlaceholderData}
					>
						{rows.map((row) => (
							<li key={row.public_id}>
								<GalleryRow
									row={row}
									index={catalogue}
									selected={row.public_id === openPost}
									link={
										<Link
											id={rowLinkId(row.public_id)}
											to={withParams({ [POST_PARAM]: row.public_id })}
											// Opening from the list is a step Back undoes; moving
											// between posts while one is open is not.
											replace={openPost !== null}
											state={{ galleryFromFeed: openPost === null ? true : fromFeed } satisfies FeedHistoryState}
											preventScrollReset
											aria-label={`Open ${teamTitle(row.poster)}`}
											aria-current={row.public_id === openPost ? "true" : undefined}
											className="absolute inset-0 z-[1] rounded-xl focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
										/>
									}
								/>
							</li>
						))}
					</ol>
					{feed.data.has_more && (
						<button
							type="button"
							disabled={feed.isPlaceholderData}
							onClick={() => setLimits((current) => ({ ...current, [listKey]: limit + GALLERY_FEED_STEP }))}
							className={`self-center ${SECONDARY_BUTTON}`}
						>
							{feed.isPlaceholderData && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
							Load more
						</button>
					)}
				</>
			)}
		</div>
	)

	if (nobodyPosted && !openPost) {
		return (
			<div className="mx-auto flex w-full max-w-xl flex-col gap-3">
				<YourPostBar
					eventRef={ref}
					eventName={event.name}
					postHref={(publicId) => withParams({ [POST_PARAM]: publicId })}
					onOpenMyTeam={onOpenMyTeam}
				/>
				<div className="card-panel flex flex-col items-center gap-2 p-6 text-center">
					<Users className="h-6 w-6 text-gray-500" aria-hidden="true" />
					<p className="text-sm text-gray-300">Nobody has posted a team for {event.name} yet.</p>
					<button type="button" onClick={onOpenMyTeam} className="text-sm font-medium text-brand hover:text-brand/75">
						Build yours on My team
					</button>
				</div>
			</div>
		)
	}

	return (
		<div
			ref={rootRef}
			className="grid scroll-mt-4 gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]"
		>
			{list}
			<div className={`min-w-0 ${openPost ? "" : "hidden lg:block"}`}>
				{openPost && catalogue.status === "ready" ? (
					<GalleryPostPanel
						key={openPost}
						publicId={openPost}
						event={event}
						index={catalogue}
						neighbours={neighbours}
						onOpenPost={switchPost}
						onClose={closePost}
						onOpenMyTeam={() => {
							replaceParams({ [POST_PARAM]: null })
							onOpenMyTeam()
						}}
					/>
				) : (
					<div className="card-panel flex flex-col items-center gap-2 p-8 text-center app-shell:sticky app-shell:top-[4.5rem]">
						<MousePointerClick className="h-6 w-6 text-gray-500" aria-hidden="true" />
						<p className="text-sm font-medium text-gray-200">Pick a team to see it here</p>
						<p className="max-w-xs text-sm text-gray-400">The whole team and its comments open beside the list.</p>
					</div>
				)}
			</div>
		</div>
	)
}

/** The sort buttons, what the sort means, the count, and the uma filter. */
function FeedToolbar({ sort, uma, feed, index, onSort, onFilter }: {
	sort: GallerySort
	uma: number | null
	feed: GalleryFeed | undefined
	index: Pick<PvpCatalogueIndex, "umasById"> | null
	onSort: (sort: GallerySort) => void
	onFilter: (uma: number | null) => void
}) {
	const tally = feed?.umas ?? []
	// A filter from a link can name an uma nobody uses any more; it stays in
	// the menu (at 0) so the menu shows what is applied.
	const options = uma !== null && !tally.some((entry) => entry.uma === uma) ? [...tally, { uma, count: 0 }] : tally
	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center gap-2">
				<div className="flex gap-1 rounded-lg bg-gray-900/70 p-1" role="group" aria-label="Sort teams">
					{GALLERY_SORTS.map((option) => (
						<button
							key={option.id}
							type="button"
							aria-pressed={sort === option.id}
							onClick={() => onSort(option.id)}
							className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
								sort === option.id ? "bg-gray-700 text-brand shadow-sm" : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
							}`}
						>
							{option.label}
						</button>
					))}
				</div>
				{feed && <span className="ml-auto text-sm text-gray-400">{countLabel(feed.count, "team")}</span>}
			</div>
			<p className="text-xs leading-relaxed text-gray-400">
				{SORT_NOTES[sort]} {sort !== "new" && WEIGHT_NOTE}
			</p>
			{options.length > 0 && index && (
				<label className="flex items-center gap-2 text-sm text-gray-300">
					With
					<select
						value={uma ?? ""}
						onChange={(change) => onFilter(change.target.value === "" ? null : Number(change.target.value))}
						className="min-w-0 flex-1 rounded-md border border-gray-600 bg-gray-900 px-2 py-1.5 text-sm text-gray-100 outline-none focus:border-brand"
					>
						<option value="">Any uma</option>
						{options.map((entry) => (
							<option key={entry.uma} value={entry.uma}>
								{index.umasById.get(entry.uma)?.name ?? "Unknown uma"} ({entry.count})
							</option>
						))}
					</select>
				</label>
			)}
		</div>
	)
}

/**
 * Above the list: your own post for this event with its numbers, or the way
 * to post one, or (for a guest) the way to sign in. Posting itself happens on
 * My team, where the team is.
 */
function YourPostBar({ eventRef, eventName, postHref, onOpenMyTeam }: {
	eventRef: PvpEventRef
	eventName: string
	postHref: (publicId: string) => string
	onOpenMyTeam: () => void
}) {
	const { isLoggedIn } = useAccount()
	const { teams, ensureLoaded } = usePvpTeams()
	const { signInState } = useSignInPrompt()
	useEffect(() => {
		if (isLoggedIn) ensureLoaded()
	}, [isLoggedIn, ensureLoaded])

	const posted = isLoggedIn
		? teams.find((team) => team.post && sameEvent({ kind: team.kind, id: team.event }, eventRef))?.post ?? null
		: null
	const post = useGalleryPost(posted)

	if (!isLoggedIn) {
		return (
			<Bar>
				<span className="min-w-0 flex-1">Sign in to upvote, comment and post your own team.</span>
				<Link to="/login" state={signInState} className={ACTION_BUTTON}>
					Sign in
				</Link>
			</Bar>
		)
	}
	if (posted && post.data) {
		return (
			<Bar>
				<span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
					<span className="font-medium text-gray-100">Your post</span>
					{post.data.hidden ? (
						<span className="text-highlight">Hidden while we review it</span>
					) : (
						<>
							<span>{countLabel(post.data.stats.upvotes, "upvote")}</span>
							<span>{countLabel(post.data.stats.comments, "comment")}</span>
						</>
					)}
				</span>
				<Link to={postHref(posted)} state={{ galleryFromFeed: true } satisfies FeedHistoryState} preventScrollReset className={ACTION_BUTTON}>
					Open
				</Link>
			</Bar>
		)
	}
	if (posted) return null
	return (
		<Bar>
			<span className="min-w-0 flex-1">Got a team for {eventName}? Post it from My team.</span>
			<button type="button" onClick={onOpenMyTeam} className={ACTION_BUTTON}>
				<Send className="h-4 w-4" aria-hidden="true" />
				Post a team
			</button>
		</Bar>
	)
}

function Bar({ children }: { children: ReactNode }) {
	return (
		<div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-700 bg-gray-900/40 px-3 py-2 text-sm text-gray-300">
			{children}
		</div>
	)
}

/** Grey rows the shape of real ones, while the first answer loads. */
function FeedSkeleton() {
	return (
		<div className="flex flex-col gap-3" role="status" aria-label="Loading teams">
			{[0, 1, 2].map((key) => (
				<div key={key} className="card-panel flex animate-pulse gap-3 p-3">
					<div className="h-14 w-12 rounded-lg bg-gray-700" />
					<div className="flex flex-1 flex-col gap-2">
						<div className="h-4 w-1/3 rounded bg-gray-700" />
						<div className="h-3 w-2/3 rounded bg-gray-700" />
						<div className="grid grid-cols-3 gap-2">
							{[0, 1, 2].map((tile) => (
								<div key={tile} className="mx-auto aspect-square w-14 rounded-md bg-gray-700" />
							))}
						</div>
					</div>
				</div>
			))}
		</div>
	)
}

/**
 * One post in the feed. The whole row opens the post through `link`, an
 * empty link stretched over it (a link wrapped around the row would put
 * lists and paragraphs inside an <a> or <button>, which is invalid and makes
 * a screen reader read the whole row as its name); the upvote sits above it.
 */
export function GalleryRow({ row, index, selected, link }: {
	row: Row
	index: Pick<PvpCatalogueIndex, "umasById">
	selected: boolean
	link: ReactNode
}) {
	const look = row.poster.gallery_style
	const updated = row.content_updated_at !== row.published_at
	return (
		<article
			data-gallery-style={look ?? undefined}
			className={`${look === "ssr" ? "ssr-panel ssr-panel--quiet ssr-panel--rainbow rounded-xl border" : "card-panel"} ${
				selected ? "outline-2 outline-offset-2 outline-brand" : ""
			}`}
		>
			{/* One child, so .ssr-panel's "every child above the surface" rule
			    lands here and the link inside can still be absolute. */}
			<div className="relative flex gap-3 p-3">
				{link}
				<div className="relative z-[2] self-start">
					<GalleryUpvote post={row} layout="column" />
				</div>
				<div className="flex min-w-0 flex-1 flex-col gap-2">
					<div className="flex items-center gap-2">
						<div className="min-w-0 flex-1">
							<PosterLine poster={row.poster} mine={row.is_mine} extra={row.is_mine && <YouChip />} />
						</div>
						<time
							dateTime={row.content_updated_at}
							title={`${updated ? "Updated" : "Posted"} ${formatDate(row.content_updated_at)}`}
							className="shrink-0 text-xs text-gray-500"
						>
							{updated ? "updated " : ""}
							{formatTimeAgo(row.content_updated_at)}
						</time>
					</div>
					{row.caption && <p className="line-clamp-2 break-words text-sm text-gray-200">{row.caption}</p>}
					<ul className="grid grid-cols-3 gap-2" aria-label="Umas">
						{row.umas.map((member) => {
							const uma = index.umasById.get(member.uma)
							return (
								<li key={member.uma} className="flex min-w-0 flex-col items-center gap-1 text-center">
									<UmaPortrait uma={uma} className="w-14" />
									<span className="w-full truncate text-xs text-gray-200">{uma?.name ?? "Unknown uma"}</span>
									<StyleChip style={member.style} />
								</li>
							)
						})}
					</ul>
					<p className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
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
