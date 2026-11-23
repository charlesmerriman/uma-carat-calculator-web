/**
 * /app/plans: Community plans, pull plans players have posted
 * (notes/pull-plan-database-plan.md, Design 6 to 8).
 *
 * Top to bottom: the heading with "My plans" (the way back to the
 * calculator) and "Post a plan" (the open plan, through PostPlanDialog); the
 * sort bar (Top for Today / This week / This month / All
 * time, and New) with the count; then the filter sidebar beside the list.
 * Below `lg` the sidebar is a "Filters" button opening the same controls in a
 * sheet. A row opens its post in place (PlanFeedRow, PlanPostBody), one at a
 * time.
 *
 * THE ADDRESS HOLDS THE VIEW. Sort, window, the four filters and the open
 * post are query parameters (`?sort=new&spending=f2p&strategy=front,pace&
 * post=<id>`), so a filtered list or one post can be linked. The sort,
 * window and filters are also remembered per device: on a visit with none in
 * the address, the last ones are put back. That read is in an effect, never
 * at render: PR 5 prerenders this page, and render-time code here must never
 * touch `localStorage` (frontend-ui.md).
 *
 * `?post=` opens that post and scrolls to it. A post the current sort and
 * filters leave out of the list is shown on its own above it.
 *
 * EARLY ACCESS FIRST (Design 8). The page reads `account.early_access`;
 * without it, or on the server's 403, it shows the supporters-first note.
 * The server decides (plan_gallery.can_use); the page never decides alone.
 */

import { useContext, useEffect, useId, useLayoutEffect, useRef, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { Loader2, SlidersHorizontal } from "lucide-react"
import { AuthContext } from "../../services/AuthContext"
import { useCalculatorData } from "../../services/CalculatorContext"
import { usePlanFeed, usePlanPost } from "../../services/galleryQueries"
import { HttpError } from "../../services/queryClient"
import { GALLERY_FEED_STEP, NO_PLAN_FILTERS } from "../../types/gallery"
import type { PlanFeed, PlanPostRow, PlanSort, PlanWindow } from "../../types/gallery"
import { REMEMBER_KEY, VIEW_PARAMS, filtersSet, readView, writeView, type PlanView } from "../../utils/planFeedView"
import { SupportersFirstNote } from "../SupportersFirstNote"
import { GalleryModal } from "../pvp/gallery/GalleryModal"
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "../pvp/gallery/galleryStyles"
import { PostPlanDialog } from "./PostPlanDialog"
import { PlanFeedHeading, PlanFeedRow } from "./PlanFeedRow"
import { PlanFilters } from "./PlanFilters"
import { PlanPostBody } from "./PlanPostBody"

// Wider than the other tabs' 80rem: the list beside the 16rem sidebar needs
// 64rem (PlanFeedRow's `@5xl/plans`) to draw the banner pictures, which a
// 1440 screen gives it at 96rem and an 80rem page never would.
const CONTAINER = "mx-auto my-3 flex w-[calc(100%-1rem)] max-w-[96rem] flex-col gap-4 sm:w-[calc(100%-2rem)]"

/** Top's windows, in the sort bar's order. */
const WINDOWS: Array<{ value: PlanWindow; label: string }> = [
	{ value: "day", label: "Today" },
	{ value: "week", label: "This week" },
	{ value: "month", label: "This month" },
	{ value: "all", label: "All time" },
]

export const CommunityPlansPage = () => {
	const auth = useContext(AuthContext)
	if (!auth?.account?.early_access) {
		return (
			<div className={CONTAINER}>
				<SupportersFirstNote feature="Community plans are" />
			</div>
		)
	}
	return <CommunityPlansBody />
}

function CommunityPlansBody() {
	const [params, setParams] = useSearchParams()
	const view = readView(params)
	const openId = params.get("post")
	const [limit, setLimit] = useState(GALLERY_FEED_STEP)
	const [sheetOpen, setSheetOpen] = useState(false)
	const [posting, setPosting] = useState(false)
	const { plans, activePlanId } = useCalculatorData()
	// A guest has no plan list (activePlanId null): nothing to post from here.
	const activePlan = plans.find((plan) => plan.id === activePlanId)
	const feed = usePlanFeed({ ...view, limit })
	const refused = feed.error instanceof HttpError && feed.error.status === 403

	// Put back the last view on a visit whose address has none, and remember
	// each new one. Both in effects: see the header.
	const restored = useRef(false)
	useEffect(() => {
		if (restored.current) return
		restored.current = true
		if (VIEW_PARAMS.some((key) => params.has(key))) return
		try {
			const saved = window.localStorage.getItem(REMEMBER_KEY)
			if (saved) setParams(writeView(params, readView(new URLSearchParams(saved))), { replace: true })
		} catch {
			// Storage blocked: the page just starts on the defaults.
		}
	}, [params, setParams])
	const viewKey = writeView(new URLSearchParams(), view).toString()
	useEffect(() => {
		if (!restored.current) return
		try {
			window.localStorage.setItem(REMEMBER_KEY, viewKey)
		} catch {
			// Not remembered; nothing else depends on it.
		}
	}, [viewKey])

	const changeView = (next: Partial<PlanView>) => {
		setLimit(GALLERY_FEED_STEP)
		setParams(writeView(params, { ...view, ...next }), { replace: true })
	}
	const setOpen = (publicId: string | null) => {
		const next = new URLSearchParams(params)
		if (publicId) next.set("post", publicId)
		else next.delete("post")
		setParams(next, { replace: true })
	}

	// Keep the pressed row in view: opening one post closes the other, and a
	// long post closing above would otherwise carry the pressed row off the
	// top of the screen. `?post=` on arrival scrolls to its row the same way.
	// ONCE per opened post, the first time its row exists: a vote or a new
	// comment rewrites the feed's data, and scrolling again then would yank
	// the page back to the row while someone reads the post.
	const scrolledTo = useRef<string | null>(null)
	useLayoutEffect(() => {
		if (!openId) {
			scrolledTo.current = null
			return
		}
		if (scrolledTo.current === openId) return
		// Matched by the attribute's value, never by pasting the address's id
		// into a selector.
		const rows = document.querySelectorAll<HTMLElement>("[data-plan-row]")
		const row = Array.from(rows).find((candidate) => candidate.dataset.planRow === openId)
		if (!row) return
		row.scrollIntoView({ block: "nearest" })
		scrolledTo.current = openId
	}, [openId, feed.data])

	if (refused) {
		return (
			<div className={CONTAINER}>
				<SupportersFirstNote feature="Community plans are" />
			</div>
		)
	}

	const results = feed.data?.results ?? []
	const soloId = openId && feed.data && !results.some((row) => row.public_id === openId) ? openId : null
	const setCount = filtersSet(view.filters)

	return (
		<div className={CONTAINER}>
			<header className="flex flex-wrap items-start gap-x-4 gap-y-2">
				<div className="mr-auto min-w-0">
					<h1 className="font-display text-xl font-bold text-gray-100 sm:text-2xl">Community plans</h1>
					<p className="mt-1 text-sm text-gray-400">
						Pull plans other players have posted. Open one to see every banner and what your own resources would cover, then
						copy it or take single banners.
					</p>
				</div>
				<div className="flex gap-2">
					<Link to="/app" className={SECONDARY_BUTTON}>
						My plans
					</Link>
					{activePlan && activePlan.post_public_id !== undefined && (
						<button type="button" onClick={() => setPosting(true)} className={PRIMARY_BUTTON}>
							{activePlan.post_public_id ? "Update my post" : "Post a plan"}
						</button>
					)}
				</div>
			</header>
			{posting && activePlan && <PostPlanDialog plan={activePlan} onClose={() => setPosting(false)} />}

			<SortBar view={view} count={feed.data?.count} onChange={changeView} />

			<div className="flex flex-col gap-4 lg:flex-row lg:items-start">
				<aside className="card-panel hidden w-64 shrink-0 p-3 lg:block" aria-label="Filters">
					<h2 className="mb-3 text-sm font-semibold text-gray-100">Filters</h2>
					{feed.data && <PlanFilters choices={feed.data.filters} value={view.filters} onChange={(filters) => changeView({ filters })} />}
				</aside>
				<button type="button" onClick={() => setSheetOpen(true)} className={`${SECONDARY_BUTTON} self-start lg:hidden`}>
					<SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
					{setCount > 0 ? `Filters (${setCount})` : "Filters"}
				</button>
				{sheetOpen && feed.data && (
					<GalleryModal title="Filters" onClose={() => setSheetOpen(false)}>
						<PlanFilters choices={feed.data.filters} value={view.filters} onChange={(filters) => changeView({ filters })} />
					</GalleryModal>
				)}

				<div className="@container/plans flex min-w-0 flex-1 flex-col gap-2">
					{soloId && (
						<SoloPost publicId={soloId} feed={feed.data} onClose={() => setOpen(null)} />
					)}
					<FeedList
						feed={feed.data}
						isPending={feed.isPending}
						isError={feed.isError}
						onRetry={() => void feed.refetch()}
						openId={openId}
						onToggle={(publicId) => setOpen(openId === publicId ? null : publicId)}
						onClearFilters={setCount > 0 ? () => changeView({ filters: NO_PLAN_FILTERS }) : null}
					/>
					{feed.data?.has_more && (
						<button
							type="button"
							disabled={feed.isFetching}
							onClick={() => setLimit((was) => was + GALLERY_FEED_STEP)}
							className={`${SECONDARY_BUTTON} self-center`}
						>
							{feed.isFetching && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
							Load more
						</button>
					)}
				</div>
			</div>
		</div>
	)
}

function SortBar({ view, count, onChange }: {
	view: PlanView
	count: number | undefined
	onChange: (next: { sort: PlanSort; window?: PlanWindow }) => void
}) {
	const tab = (selected: boolean) =>
		`rounded-md px-3 py-1.5 text-sm transition ${selected ? "bg-brand/15 font-semibold text-brand" : "text-gray-300 hover:bg-gray-700 hover:text-gray-100"}`
	return (
		<nav className="flex flex-wrap items-center gap-x-1 gap-y-2" aria-label="Sort">
			{/* On a phone "Top" takes its own line, so the four windows fit on one
			    (canvas r4-10); from `sm` it sits beside them. */}
			<span className="w-full text-sm text-gray-400 sm:mr-1 sm:w-auto">Top</span>
			<span className="flex items-center gap-1">
				{WINDOWS.map((choice) => {
					const selected = view.sort === "top" && view.window === choice.value
					return (
						<button key={choice.value} type="button" aria-pressed={selected} onClick={() => onChange({ sort: "top", window: choice.value })} className={`${tab(selected)} whitespace-nowrap`}>
							{choice.label}
						</button>
					)
				})}
			</span>
			<span className="mx-2 hidden h-5 w-px bg-gray-700 sm:block" aria-hidden="true" />
			<button type="button" aria-pressed={view.sort === "new"} onClick={() => onChange({ sort: "new" })} className={tab(view.sort === "new")}>
				New
			</button>
			{count !== undefined && (
				<span className="ml-auto text-sm text-gray-400">{count === 1 ? "1 plan" : `${count.toLocaleString()} plans`}</span>
			)}
		</nav>
	)
}

function FeedList({ feed, isPending, isError, onRetry, openId, onToggle, onClearFilters }: {
	feed: PlanFeed | undefined
	isPending: boolean
	isError: boolean
	onRetry: () => void
	openId: string | null
	onToggle: (publicId: string) => void
	/** Set when filters are on: the empty state offers to clear them. */
	onClearFilters: (() => void) | null
}) {
	if (isError && !feed) {
		return (
			<div className="card-panel flex flex-col items-start gap-3 p-4 text-sm text-gray-300" role="alert">
				Community plans didn't load.
				<button type="button" onClick={onRetry} className={SECONDARY_BUTTON}>
					Try again
				</button>
			</div>
		)
	}
	if (isPending || !feed) {
		return (
			<p className="card-panel flex items-center justify-center gap-2 p-8 text-sm text-gray-400" role="status">
				<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
				Loading plans…
			</p>
		)
	}
	if (feed.results.length === 0) {
		return (
			<div className="card-panel flex flex-col items-center gap-2 p-6 text-center text-sm text-gray-300">
				{onClearFilters ? (
					<>
						No plans match these filters.
						<button type="button" onClick={onClearFilters} className="font-medium text-brand transition hover:text-brand/75">
							Clear filters
						</button>
					</>
				) : (
					"Nobody has posted a plan yet."
				)}
			</div>
		)
	}
	return (
		<>
			<PlanFeedHeading />
			<ul className="flex flex-col gap-2" aria-label="Plans">
				{feed.results.map((row) => (
					<Row key={row.public_id} row={row} feed={feed} open={openId === row.public_id} onToggle={() => onToggle(row.public_id)} />
				))}
			</ul>
		</>
	)
}

function Row({ row, feed, open, onToggle }: { row: PlanPostRow; feed: PlanFeed | undefined; open: boolean; onToggle: () => void }) {
	const bodyId = useId()
	return (
		<PlanFeedRow row={row} choices={feed?.filters} open={open} onToggle={onToggle} bodyId={bodyId}>
			<PlanPostBody publicId={row.public_id} onTakenDown={onToggle} />
		</PlanFeedRow>
	)
}

/** A linked post the list leaves out: drawn on its own above the list, from the full post. */
function SoloPost({ publicId, feed, onClose }: { publicId: string; feed: PlanFeed | undefined; onClose: () => void }) {
	const post = usePlanPost(publicId)
	const bodyId = useId()
	if (post.isPending) {
		return (
			<p className="card-panel flex items-center gap-2 p-4 text-sm text-gray-400" role="status">
				<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
				Loading the plan…
			</p>
		)
	}
	if (post.isError) {
		const gone = post.error instanceof HttpError && post.error.status === 404
		return (
			<div className="card-panel flex flex-wrap items-center gap-3 p-4 text-sm text-gray-300" role="alert">
				{gone ? "This plan isn't up any more." : "That plan didn't load."}
				<button type="button" onClick={onClose} className={SECONDARY_BUTTON}>
					Close
				</button>
			</div>
		)
	}
	return (
		<ul aria-label="Linked plan">
			<PlanFeedRow row={post.data} choices={feed?.filters} open onToggle={onClose} bodyId={bodyId}>
				<PlanPostBody publicId={publicId} onTakenDown={onClose} />
			</PlanFeedRow>
		</ul>
	)
}
