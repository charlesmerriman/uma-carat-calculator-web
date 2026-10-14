/**
 * The PvP page's Gallery view: teams other players posted for the selected
 * event, ranked Hot (default), Top or New, filterable by uma.
 *
 * LAYOUT. With no post open the feed spans the page, and each row is one short
 * band: upvote, poster and caption, the three umas, the counts. Open one and,
 * from `lg` (64rem, the width of `desktop-nav`) up, it is two panes: the feed
 * on the left and the post beside it, inline and sticky, so moving from team
 * to team is one click and the list never goes dark behind an overlay. Below
 * that the post takes the feed's place (the feed stays mounted, hidden, so it
 * keeps its rows), and closing it goes back to where you were in the list.
 *
 * The rows pick their shape from the FEED's width (a container query, `feed`),
 * not the screen's, so the narrow left pane and a phone get the stacked row
 * and a wide feed gets the band. Between the two the rows morph (Framer
 * Motion layout animations, two panes only) while the post slides in or out,
 * and `KeepRowInPlace` scrolls in step so the row you opened or closed stays
 * where it was on screen.
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

import { Component, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react"
import { Link, useLocation, useNavigate, useNavigationType, useSearchParams } from "react-router-dom"
import { AnimatePresence, MotionConfig, animate, motion, useReducedMotion, type MotionProps } from "framer-motion"
import { Eye, Loader2, MessageSquare, Send, Users } from "lucide-react"
import { GalleryPostPanel } from "./GalleryPostPanel"
import { GalleryUpvote, PosterLine, StyleChip, UmaPortrait, YouChip } from "./GalleryBits"
import { ACTION_BUTTON, SECONDARY_BUTTON } from "./galleryStyles"
import { useAccount } from "../../../services/AuthContext"
import { usePvpTeams } from "../../../services/PvpTeamsContext"
import { useGalleryFeed, useGalleryPost } from "../../../services/galleryQueries"
import { useSignInPrompt } from "../../../hooks/useSignInPrompt"
import { APP_SCROLLER_SELECTOR, claimScrollRestore } from "../../../hooks/useScrollReset"
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
 * The one timing for the whole change of shape: the rows' morph, the post
 * sliding in, and KeepRowInPlace's scroll. The scroll only cancels the row's
 * own slide if the two run on the same curve for the same time.
 */
const MORPH = { duration: 0.35, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] }

/**
 * Motion props for a piece of the feed that should glide when it changes
 * shape: `layout="position"` (its size snaps, which keeps text from being
 * stretched mid-morph), and measured only when `split` flips, since rows
 * re-render on every vote and refetch and a reorder is not meant to slide.
 * Empty below two panes: there the feed is hidden while a post is open, and a
 * hidden element measures as an empty box at the corner of the screen.
 */
type Glide = Pick<MotionProps, "layout" | "layoutDependency">

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
	const split = openPost !== null
	const twoPanes = useMediaQuery(TWO_PANES)
	const reduceMotion = useReducedMotion() ?? false
	const glide: Glide = twoPanes ? { layout: "position", layoutDependency: split } : {}

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
	// returns to the row's link, for keyboards and screen readers. (With two
	// panes the scroll is KeepRowInPlace's.)
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

	// `@container/feed`: the rows and the toolbar lay themselves out by this
	// column's width (see GalleryRow).
	const list = (
		<div className={`@container/feed flex min-w-0 flex-col gap-3 ${openPost ? "hidden lg:flex" : ""}`}>
			<FeedToolbar
				sort={sort}
				uma={uma}
				feed={feed.data}
				index={catalogue.status === "ready" ? catalogue : null}
				glide={glide}
				onSort={(next) => replaceParams({ [SORT_PARAM]: next === "hot" ? null : next })}
				onFilter={(next) => replaceParams({ [UMA_PARAM]: next === null ? null : String(next) })}
			/>
			<YourPostBar
				eventRef={ref}
				eventName={event.name}
				postHref={(publicId) => withParams({ [POST_PARAM]: publicId })}
				onOpenMyTeam={onOpenMyTeam}
				glide={glide}
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
									glide={glide}
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

	// One column until a post opens, then the feed and the post side by side.
	// `relative` is for AnimatePresence's popLayout, which takes a closing post
	// out of the grid (absolute, where it was) so the feed can widen under it
	// as it slides away. [overflow-anchor:none] keeps the browser's own scroll
	// anchoring from jumping the page when the rows change height: the
	// scrolling during a change of shape is KeepRowInPlace's alone.
	return (
		<MotionConfig transition={MORPH} reducedMotion="user">
			<KeepRowInPlace split={split} openPost={openPost} locationKey={location.key} instant={reduceMotion} />
			<div
				ref={rootRef}
				className={`relative grid scroll-mt-4 grid-cols-1 gap-6 [overflow-anchor:none] ${
					split ? "lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]" : ""
				}`}
			>
				{list}
				{/* initial={false}: a post that is open when the gallery mounts (a
				    shared link) is just there, with no slide. */}
				<AnimatePresence initial={false} mode="popLayout">
					{openPost && (
						<motion.div
							key="post"
							className="min-w-0"
							initial={{ opacity: 0, x: 32 }}
							animate={{ opacity: 1, x: 0 }}
							exit={{ opacity: 0, x: 32, transition: { ...MORPH, duration: 0.2 } }}
						>
							{catalogue.status === "ready" ? (
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
								<div
									className="card-panel flex items-center justify-center gap-2 p-8 text-sm text-gray-400 app-shell:sticky app-shell:top-[4.5rem]"
									role="status"
								>
									{catalogue.status === "error" ? (
										"The gallery didn't load."
									) : (
										<>
											<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
											Loading the team…
										</>
									)}
								</div>
							)}
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</MotionConfig>
	)
}

/** Whether a media query matches, kept up to date as the window changes. */
function useMediaQuery(query: string): boolean {
	return useSyncExternalStore(
		(onChange) => {
			const list = window.matchMedia(query)
			list.addEventListener("change", onChange)
			return () => list.removeEventListener("change", onChange)
		},
		() => window.matchMedia(query).matches,
		// Never rendered on the server (GalleryView is inside the /app gate);
		// here because useSyncExternalStore wants one.
		() => false,
	)
}

/** `element`'s top inside `scroller`'s content, from layout, so a running animation's transform doesn't count. */
function topWithin(element: HTMLElement, scroller: HTMLElement): number | null {
	let top = 0
	let node: HTMLElement | null = element
	while (node && node !== scroller) {
		top += node.offsetTop
		node = node.offsetParent as HTMLElement | null
	}
	// The scroller is `relative`, so every offsetParent chain inside it ends
	// on it. One that doesn't wasn't inside it.
	return node === scroller ? top : null
}

interface KeepRowInPlaceProps {
	split: boolean
	openPost: string | null
	locationKey: string
	/** Reduced motion: the rows don't morph, so the scroll jumps with them. */
	instant: boolean
}

interface RowPlace {
	scroller: HTMLElement
	publicId: string | null
	/** Where the row's top was on screen, from the scroller's top; null when it was out of sight. */
	top: number | null
}

/**
 * Holds the row being opened or closed still on screen while the feed changes
 * shape. Opening a post makes every row about twice as tall, so without this
 * the row you clicked lands a screen or more below where you clicked it, and
 * closing throws you as far the other way.
 *
 * It only acts where the app scroller scrolls (the `app-shell` desktop frame,
 * which two panes always are, give or take a very short window). Below two
 * panes the post replaces the feed instead, and GalleryView's effect places
 * that.
 *
 * HOW IT STAYS STILL. Framer measures the new layout a microtask after this
 * commit and slides each row from its old place on screen to its new one. The
 * scroller has not moved yet at that point, so the opened row is set to slide
 * by exactly the distance this then scrolls; running the scroll on the same
 * curve for the same time (MORPH) cancels the two out, and the row stays put
 * while everything around it moves. That needs nothing else to move the
 * scroller first, which is why the grid opts out of the browser's scroll
 * anchoring and why this claims the navigation from useScrollReset, whose
 * Back restore would jump it. Closing with the close button is a Back.
 *
 * A row that was out of sight (Next team ran past the screen, or "Open" on
 * your post at the top) has no place on screen to keep, so the scroll stays
 * where it is.
 *
 * A class because getSnapshotBeforeUpdate is React's only hook into the
 * moment after the new layout is decided and before it reaches the screen,
 * which is when the row's old place can still be read.
 */
class KeepRowInPlace extends Component<KeepRowInPlaceProps, object, RowPlace | null> {
	private scrolling: { stop: () => void } | null = null

	getSnapshotBeforeUpdate(previous: Readonly<KeepRowInPlaceProps>): RowPlace | null {
		if (previous.split === this.props.split) return null
		const scroller = document.querySelector<HTMLElement>(APP_SCROLLER_SELECTOR)
		if (!scroller) return null
		// Opening keeps the row being opened; closing, the one that was open.
		const publicId = this.props.openPost ?? previous.openPost
		const link = publicId ? document.getElementById(rowLinkId(publicId)) : null
		const top = link ? link.getBoundingClientRect().top - scroller.getBoundingClientRect().top : null
		const inSight = top !== null && top >= 0 && top < scroller.clientHeight
		return { scroller, publicId, top: inSight ? top : null }
	}

	componentDidUpdate(_previous: Readonly<KeepRowInPlaceProps>, _state: object, place: RowPlace | null) {
		if (!place) return
		const { scroller } = place
		// The document is what scrolls (a phone, or a very short window).
		if (scroller.scrollHeight <= scroller.clientHeight) return
		claimScrollRestore(this.props.locationKey)
		this.scrolling?.stop()
		this.scrolling = null

		const link = place.publicId && place.top !== null ? document.getElementById(rowLinkId(place.publicId)) : null
		const rowTop = link ? topWithin(link, scroller) : null
		if (rowTop === null || place.top === null) return
		// Read after topWithin, which made the browser lay the new rows out: a
		// feed that just got shorter has already pulled scrollTop back by now.
		const from = scroller.scrollTop
		const to = Math.min(Math.max(rowTop - place.top, 0), scroller.scrollHeight - scroller.clientHeight)
		if (Math.abs(to - from) < 1) return
		if (this.props.instant) {
			scroller.scrollTop = to
			return
		}
		this.scrolling = animate(from, to, {
			...MORPH,
			onUpdate: (value) => {
				scroller.scrollTop = value
			},
		})
	}

	componentWillUnmount() {
		this.scrolling?.stop()
	}

	render() {
		return null
	}
}

/**
 * The sort buttons, what the sort means, the count, and the uma filter.
 * Stacked in a narrow feed (sort and count, the note, the filter); in a wide
 * one the filter moves up between the sort and the count (the inner row turns
 * into `contents` and `order` places them) and the note takes the line below.
 */
function FeedToolbar({ sort, uma, feed, index, glide, onSort, onFilter }: {
	sort: GallerySort
	uma: number | null
	feed: GalleryFeed | undefined
	index: Pick<PvpCatalogueIndex, "umasById"> | null
	glide: Glide
	onSort: (sort: GallerySort) => void
	onFilter: (uma: number | null) => void
}) {
	const tally = feed?.umas ?? []
	// A filter from a link can name an uma nobody uses any more; it stays in
	// the menu (at 0) so the menu shows what is applied.
	const options = uma !== null && !tally.some((entry) => entry.uma === uma) ? [...tally, { uma, count: 0 }] : tally
	return (
		<div className="flex flex-col gap-2 @2xl/feed:flex-row @2xl/feed:flex-wrap @2xl/feed:items-center @2xl/feed:gap-x-3">
			<div className="flex flex-wrap items-center gap-2 @2xl/feed:contents">
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
				{feed && (
					<motion.span {...glide} className="ml-auto text-sm text-gray-400 @2xl/feed:order-2">
						{countLabel(feed.count, "team")}
					</motion.span>
				)}
			</div>
			<motion.p {...glide} className="text-xs leading-relaxed text-gray-400 @2xl/feed:order-3 @2xl/feed:basis-full">
				{SORT_NOTES[sort]} {sort !== "new" && WEIGHT_NOTE}
			</motion.p>
			{options.length > 0 && index && (
				<motion.label {...glide} className="flex items-center gap-2 text-sm text-gray-300 @2xl/feed:order-1 @2xl/feed:w-80">
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
				</motion.label>
			)}
		</div>
	)
}

/**
 * Above the list: your own post for this event with its numbers, or the way
 * to post one, or (for a guest) the way to sign in. Posting itself happens on
 * My team, where the team is.
 */
function YourPostBar({ eventRef, eventName, postHref, onOpenMyTeam, glide = {} }: {
	eventRef: PvpEventRef
	eventName: string
	postHref: (publicId: string) => string
	onOpenMyTeam: () => void
	glide?: Glide
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
			<Bar glide={glide}>
				<span className="min-w-0 flex-1">Sign in to upvote, comment and post your own team.</span>
				<Link to="/login" state={signInState} className={ACTION_BUTTON}>
					Sign in
				</Link>
			</Bar>
		)
	}
	if (posted && post.data) {
		return (
			<Bar glide={glide}>
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
		<Bar glide={glide}>
			<span className="min-w-0 flex-1">Got a team for {eventName}? Post it from My team.</span>
			<button type="button" onClick={onOpenMyTeam} className={ACTION_BUTTON}>
				<Send className="h-4 w-4" aria-hidden="true" />
				Post a team
			</button>
		</Bar>
	)
}

function Bar({ children, glide }: { children: ReactNode; glide: Glide }) {
	return (
		<motion.div
			{...glide}
			className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-700 bg-gray-900/40 px-3 py-2 text-sm text-gray-300"
		>
			{children}
		</motion.div>
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
 *
 * TWO SHAPES, by the feed's width (`@4xl/feed`, 56rem). Narrow (beside an
 * open post, or a phone) it stacks: poster, caption, umas, counts. Wide (the
 * feed with nothing open) it is one band about half as tall: poster and
 * caption, then the umas, then the counts, side by side, everything centred
 * on the band's middle. The time sits right after the name rather than at
 * the far end of the poster's column (which is most of the row), and the
 * picture and name are a size up. The poster and caption share a wrapper
 * that is `contents` when stacked, so both shapes keep the same reading
 * order.
 *
 * `glide` morphs one shape into the other: the card animates its size, and
 * each piece inside only its position, so text is never stretched. The
 * border radius is inline because Framer can only keep a corner round
 * through the morph when it owns the value.
 */
export function GalleryRow({ row, index, selected, link, glide = {} }: {
	row: Row
	index: Pick<PvpCatalogueIndex, "umasById">
	selected: boolean
	link: ReactNode
	glide?: Glide
}) {
	const look = row.poster.gallery_style
	const updated = row.content_updated_at !== row.published_at
	return (
		<motion.article
			{...glide}
			layout={glide.layout ? true : undefined}
			style={glide.layout ? { borderRadius: 12 } : undefined}
			data-gallery-style={look ?? undefined}
			className={`${look === "ssr" ? "ssr-panel ssr-panel--quiet rounded-xl border" : "card-panel"} ${
				selected ? "outline-2 outline-offset-2 outline-brand" : ""
			}`}
		>
			{/* One child, so .ssr-panel's "every child above the surface" rule
			    lands here and the link inside can still be absolute. */}
			<div className="relative flex gap-3 p-3">
				{link}
				<motion.div {...glide} className="relative z-[2] self-start @4xl/feed:self-center">
					<GalleryUpvote post={row} layout="column" />
				</motion.div>
				<div className="flex min-w-0 flex-1 flex-col gap-2 @4xl/feed:flex-row @4xl/feed:items-center @4xl/feed:gap-6">
					<div className="contents @4xl/feed:flex @4xl/feed:min-w-0 @4xl/feed:flex-1 @4xl/feed:flex-col @4xl/feed:gap-2">
						<motion.div {...glide} className="flex items-center gap-2 @4xl/feed:gap-3">
							<div className="min-w-0 flex-1 @4xl/feed:flex-initial">
								<PosterLine
									poster={row.poster}
									mine={row.is_mine}
									extra={row.is_mine && <YouChip />}
									avatarClassName="@4xl/feed:h-11 @4xl/feed:w-11"
									nameClassName="@4xl/feed:text-base"
								/>
							</div>
							<time
								dateTime={row.content_updated_at}
								title={`${updated ? "Updated" : "Posted"} ${formatDate(row.content_updated_at)}`}
								className="shrink-0 text-xs text-gray-500"
							>
								{updated ? "updated " : ""}
								{formatTimeAgo(row.content_updated_at)}
							</time>
						</motion.div>
						{row.caption && (
							<motion.p {...glide} className="line-clamp-2 break-words text-sm text-gray-200">
								{row.caption}
							</motion.p>
						)}
					</div>
					<motion.ul {...glide} className="grid grid-cols-3 gap-2 @4xl/feed:w-80 @4xl/feed:shrink-0 @6xl/feed:w-[30rem]" aria-label="Umas">
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
					</motion.ul>
					<motion.p
						{...glide}
						className="flex flex-wrap items-center gap-3 text-xs text-gray-400 @4xl/feed:w-28 @4xl/feed:shrink-0 @4xl/feed:flex-col @4xl/feed:items-start @4xl/feed:gap-1.5"
					>
						<span className="flex items-center gap-1">
							<Eye className="h-3.5 w-3.5" aria-hidden="true" />
							{countLabel(row.stats.views, "view")}
						</span>
						<span className="flex items-center gap-1">
							<MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
							{countLabel(row.stats.comments, "comment")}
						</span>
					</motion.p>
				</div>
			</div>
		</motion.article>
	)
}
