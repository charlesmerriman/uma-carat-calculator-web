/**
 * The PvP page's Gallery view: teams other players posted for the selected
 * event, ranked Hot (default), Top or New, twenty at a time.
 *
 * A row is compact on purpose (who posted, the caption, the three umas, the
 * numbers, the upvote) so the feed scans; the whole team, its cards and the
 * comments open in the post panel. The sort and the open post are URL
 * parameters (`?sort=top&post=k3Df8aQ2`), so both are links; /post/<id> sends
 * people here with `post` set.
 *
 * Supporter looks come from the post's `gallery_style` key only: `ssr` swaps
 * the row onto the SSR panel the Timeline uses for recommended banners, `sr`
 * and `rose` are edges (App.css, "Gallery looks"). The tier name is always
 * text beside the picture.
 *
 * Inside the /app loading gate, so it may use the browser freely.
 */

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Eye, Loader2, MessageSquare, Users } from "lucide-react"
import { toast } from "sonner"
import { GalleryPostPanel } from "./GalleryPostPanel"
import { PosterLine, UpvoteButton } from "./GalleryBits"
import { useAccount } from "../../../services/AuthContext"
import { usePvpCatalogue, type PvpCatalogueIndex } from "../../../hooks/usePvpCatalogue"
import { galleryFeedFetch, galleryVote, refusalText } from "../../../services/galleryFetchCalls"
import { refForRaceEvent } from "../../../utils/pvpEvent"
import { STYLE_LABELS } from "../../../utils/pvpGuide"
import { formatDate } from "../../../utils/dateFormat"
import type { RaceEvent } from "../../../types"
import { GALLERY_SORTS, type GalleryFeed, type GalleryRow as Row, type GallerySort } from "../../../types/gallery"

const SORT_PARAM = "sort"
const POST_PARAM = "post"

function parseSort(value: string | null): GallerySort {
	return GALLERY_SORTS.some((sort) => sort.id === value) ? (value as GallerySort) : "hot"
}

type FeedState =
	| { status: "loading" }
	| { status: "error" }
	| { status: "ready"; rows: Row[]; count: number; page: number; hasMore: boolean; loadingMore: boolean }

export function GalleryView({ event, onOpenMyTeam }: { event: RaceEvent; onOpenMyTeam: () => void }) {
	const [searchParams, setSearchParams] = useSearchParams()
	const sort = parseSort(searchParams.get(SORT_PARAM))
	const openPost = searchParams.get(POST_PARAM)
	const catalogue = usePvpCatalogue()
	const { isLoggedIn } = useAccount()
	const [feed, setFeed] = useState<FeedState>({ status: "loading" })
	const [voting, setVoting] = useState<string | null>(null)
	const { kind, id } = refForRaceEvent(event)

	const setParam = (name: string, value: string | null) =>
		setSearchParams(
			(params) => {
				const next = new URLSearchParams(params)
				if (value === null) next.delete(name)
				else next.set(name, value)
				return next
			},
			{ replace: name === SORT_PARAM }
		)

	const load = useCallback(
		async (page: number) => {
			try {
				const response = await galleryFeedFetch({ kind, id }, sort, page)
				if (!response.ok) throw new Error(String(response.status))
				const body = (await response.json()) as GalleryFeed
				setFeed((current) => ({
					status: "ready",
					rows: page === 1 || current.status !== "ready" ? body.results : [...current.rows, ...body.results],
					count: body.count,
					page: body.page,
					hasMore: body.has_more,
					loadingMore: false,
				}))
			} catch {
				setFeed((current) =>
					current.status === "ready" && page > 1 ? { ...current, loadingMore: false } : { status: "error" }
				)
			}
		},
		[kind, id, sort]
	)

	useEffect(() => {
		setFeed({ status: "loading" })
		void load(1)
	}, [load])

	const changeRow = (publicId: string, changes: Partial<Row>) =>
		setFeed((current) =>
			current.status === "ready"
				? { ...current, rows: current.rows.map((row) => (row.public_id === publicId ? { ...row, ...changes } : row)) }
				: current
		)

	const vote = async (row: Row) => {
		if (row.my_vote === null) {
			toast("Sign in to upvote teams.")
			return
		}
		const on = !row.my_vote
		// Optimistic: the arrow and the count move at once, and go back if the
		// server says no.
		changeRow(row.public_id, { my_vote: on, stats: { ...row.stats, upvotes: row.stats.upvotes + (on ? 1 : -1) } })
		setVoting(row.public_id)
		try {
			const response = await galleryVote(row.public_id, on)
			if (!response.ok) throw new Error(await refusalText(response, "Your upvote didn't go through. Try again in a moment."))
			const body = (await response.json()) as { upvotes: number; my_vote: boolean }
			changeRow(row.public_id, { my_vote: body.my_vote, stats: { ...row.stats, upvotes: body.upvotes } })
		} catch (error) {
			changeRow(row.public_id, { my_vote: row.my_vote, stats: row.stats })
			toast.error(error instanceof Error && error.message ? error.message : "Your upvote didn't go through. Try again in a moment.")
		} finally {
			setVoting(null)
		}
	}

	return (
		<div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
			<div className="flex flex-wrap items-center gap-2">
				<div className="flex gap-1 rounded-lg bg-gray-900/70 p-1" role="group" aria-label="Sort teams">
					{GALLERY_SORTS.map((option) => (
						<button
							key={option.id}
							type="button"
							aria-pressed={sort === option.id}
							onClick={() => setParam(SORT_PARAM, option.id === "hot" ? null : option.id)}
							className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
								sort === option.id ? "bg-gray-700 text-brand shadow-sm" : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
							}`}
						>
							{option.label}
						</button>
					))}
				</div>
				{feed.status === "ready" && (
					<span className="ml-auto text-sm text-gray-400">
						{feed.count === 1 ? "1 team" : `${feed.count} teams`}
					</span>
				)}
			</div>

			{feed.status === "loading" || catalogue.status === "loading" ? (
				<p className="flex items-center gap-2 text-sm text-gray-400" role="status">
					<Loader2 className="h-4 w-4 animate-spin" />
					Loading teams…
				</p>
			) : feed.status === "error" || catalogue.status === "error" ? (
				<p className="rounded-xl border border-gray-700 bg-gray-800/60 p-4 text-sm text-gray-300">
					The gallery didn't load. Try again in a moment.
				</p>
			) : feed.rows.length === 0 ? (
				<div className="card-panel flex flex-col items-center gap-2 p-6 text-center">
					<Users className="h-6 w-6 text-gray-500" aria-hidden="true" />
					<p className="text-sm text-gray-300">Nobody has posted a team for {event.name} yet.</p>
					<button type="button" onClick={onOpenMyTeam} className="text-sm font-medium text-brand hover:text-brand/75">
						Build yours on My team
					</button>
				</div>
			) : (
				<>
					<ol className="flex flex-col gap-3" aria-label={`Teams for ${event.name}`}>
						{feed.rows.map((row) => (
							<li key={row.public_id}>
								<GalleryRow
									row={row}
									index={catalogue}
									voting={voting === row.public_id}
									onOpen={() => setParam(POST_PARAM, row.public_id)}
									onVote={() => void vote(row)}
								/>
							</li>
						))}
					</ol>
					{feed.hasMore && (
						<button
							type="button"
							disabled={feed.loadingMore}
							onClick={() => {
								setFeed({ ...feed, loadingMore: true })
								void load(feed.page + 1)
							}}
							className="flex items-center justify-center gap-2 self-center rounded-md border border-gray-600 px-4 py-2 text-sm text-gray-200 transition hover:border-brand hover:text-brand disabled:opacity-50"
						>
							{feed.loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
							Load more
						</button>
					)}
					{!isLoggedIn && (
						<p className="text-center text-xs text-gray-500">Sign in to upvote, comment and post your own team.</p>
					)}
				</>
			)}

			{openPost && catalogue.status === "ready" && (
				<GalleryPostPanel
					publicId={openPost}
					event={event}
					index={catalogue}
					onClose={() => setParam(POST_PARAM, null)}
					onChange={changeRow}
					onTakenDown={(publicId) =>
						setFeed((current) =>
							current.status === "ready"
								? { ...current, count: current.count - 1, rows: current.rows.filter((row) => row.public_id !== publicId) }
								: current
						)
					}
					onOpenMyTeam={() => {
						setParam(POST_PARAM, null)
						onOpenMyTeam()
					}}
				/>
			)}
		</div>
	)
}

/** One post in the feed. The look comes from the poster's key only. */
export function GalleryRow({ row, index, voting, onOpen, onVote }: {
	row: Row
	index: Pick<PvpCatalogueIndex, "umasById">
	voting: boolean
	onOpen: () => void
	onVote: () => void
}) {
	const look = row.poster.gallery_style
	return (
		<article
			data-gallery-style={look ?? undefined}
			className={look === "ssr" ? "ssr-panel rounded-xl border" : "card-panel"}
		>
			<div className="flex items-start gap-3 p-3">
				<UpvoteButton count={row.stats.upvotes} voted={row.my_vote} own={row.is_mine} busy={voting} onClick={onVote} />
				<button type="button" onClick={onOpen} className="flex min-w-0 flex-1 flex-col gap-2 text-left">
					<PosterLine poster={row.poster} />
					{row.caption && <p className="break-words text-sm text-gray-200">{row.caption}</p>}
					<ul className="flex gap-2" aria-label="Umas">
						{row.umas.map((member) => {
							const uma = index.umasById.get(member.uma)
							return (
								<li key={member.uma} className="flex w-16 flex-col items-center gap-0.5 text-center">
									{uma?.portrait || uma?.image ? (
										<img src={uma.portrait ?? uma.image ?? ""} alt={uma.name} className="aspect-square w-14 rounded-md bg-gray-700 object-cover" />
									) : (
										<div className="aspect-square w-14 rounded-md bg-gray-700" />
									)}
									<span className="text-[11px] text-gray-400">{STYLE_LABELS[member.style]}</span>
								</li>
							)
						})}
					</ul>
					<span className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
						<span className="flex items-center gap-1">
							<Eye className="h-3.5 w-3.5" aria-hidden="true" />
							{row.stats.views} views
						</span>
						<span className="flex items-center gap-1">
							<MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
							{row.stats.comments} comments
						</span>
						<span>{formatDate(row.content_updated_at)}</span>
					</span>
				</button>
			</div>
		</article>
	)
}
