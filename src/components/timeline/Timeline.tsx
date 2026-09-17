import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
	BookOpen,
	ChevronLeft,
	ChevronRight,
	History,
	Infinity as InfinityIcon,
	Search,
} from "lucide-react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { OguriSpinner } from "../OguriSpinner"
import { useCalculatorData } from "../../services/CalculatorContext"
import { nextTempId, plannedBannerKey } from "../../utils/bannerHelpers"
import type { BannerKey } from "../../utils/bannerHelpers"
import { RaceEventCard } from "./RaceEventCard"
import { BannerWindowCard } from "./BannerWindowCard"
import { EventMarkerCard, EventMarkerPairCard } from "./EventMarkerCard"
import { BackToTopButton, FloatingBackToTop } from "../BackToTop"
import {
	CATEGORY_LABELS,
	CATEGORY_ORDER,
	MARKER_LABELS,
	MARKER_ORDER,
	bannerWindowHasFreePulls,
	bannerWindowHasRecommended,
	buildMarkerRows,
	buildTimelineMarkers,
	groupTimelineEvents,
	markerRowMatchesKind,
	markerRowMatchesSearch,
	rowMatchesFocus,
	spliceMarkerRows,
	timelineRowKey,
	timelineRowStart,
} from "./timelineShared"
import type { TimelineFocusProps, TimelineMarker, TimelineRow } from "./timelineShared"
import { FOCUS_TAILROOM, useFocusScroll } from "../../hooks/useFocusScroll"
import { useBackToTop } from "../../hooks/useBackToTop"
import { TIMELINE_FOCUS_PARAM, parseTimelineFocus } from "../../utils/timelineFocus"
import { isRaceEvent } from "../../types"
import type {
	BannerCategory,
	BannerUma,
	BannerSupport,
	UserPlannedBanner,
	TimelineEvent,
} from "../../types"

const PAGE_SIZE = 10

/**
 * How the list is chunked.
 *
 * `PAGE_SIZE` slices the paged view. `INFINITE_CHUNK_SIZE` is how many more
 * cards each scroll append reveals — deliberately the same number so the two
 * modes feel equivalent, and small because a banner card carries up to five
 * images. `INFINITE_ROOT_MARGIN` starts the next append while the sentinel is
 * still that far below the fold, so the list has usually grown before the user
 * reaches the bottom.
 */
const INFINITE_CHUNK_SIZE = 10
const INFINITE_ROOT_MARGIN = "800px"

/**
 * Extra rows revealed BELOW a deep link's target, past the chunk it sits in.
 *
 * Without this the target lands in the LAST revealed chunk, so between 0 and 9
 * rows follow it — and at 0 the scroller has nothing left to scroll, so
 * `block: "start"` cannot lift the card to the top and it strands mid-screen.
 * It looked like an intermittent bug because it depended entirely on where the
 * target fell inside its chunk: measured against live data, Project L'Arc (row
 * 44, five rows below it) landed correctly while Grand Masters (row 19, the
 * last of its chunk) did not.
 *
 * A whole chunk of tailroom is ~6000px against a ~900px viewport, so this is
 * not a close-run margin. Targets within one chunk of the END of the list have
 * no rows left to reveal and are covered by FOCUS_TAILROOM instead.
 */
const FOCUS_TRAILING_ROWS = INFINITE_CHUNK_SIZE

/**
 * Infinite scroll needs an IntersectionObserver to advance. Where there isn't
 * one (jsdom under test, pre-2019 browsers) the list renders unwindowed instead
 * — slower on a long list, but every event stays reachable, which is the whole
 * point of the mode.
 */
const SUPPORTS_INTERSECTION_OBSERVER = typeof IntersectionObserver !== "undefined"

/** The user's chosen list style. Infinite is the default; paged is opt-in. */
type TimelineViewMode = "infinite" | "paged"

const VIEW_MODE_STORAGE_KEY = "uma-planner-timeline-view"
const DEFAULT_VIEW_MODE: TimelineViewMode = "infinite"

// Read/write are wrapped because localStorage throws outright (not returns null)
// in some privacy modes. A blocked store should cost the user their saved
// preference, not the whole Timeline route.
function readStoredViewMode(): TimelineViewMode {
	try {
		return localStorage.getItem(VIEW_MODE_STORAGE_KEY) === "paged" ? "paged" : DEFAULT_VIEW_MODE
	} catch {
		return DEFAULT_VIEW_MODE
	}
}

function storeViewMode(mode: TimelineViewMode): void {
	try {
		localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode)
	} catch {
		// Preference simply won't persist across reloads.
	}
}

/**
 * The paged view's current page, persisted so it survives an unmount.
 *
 * This route unmounts whenever the user switches to the calculator, which
 * throws away every piece of local state — so without this, coming back always
 * landed on page 1 no matter how far they'd paged in.
 *
 * `sessionStorage`, not `localStorage`: a page index is "where I am right now",
 * not a preference like the view mode. It's meaningful for the length of a
 * visit, but restoring page 12 in a browser opened a week later would point at
 * completely different events, since the timeline is date-filtered.
 */
const PAGE_STORAGE_KEY = "uma-planner-timeline-page"

function readStoredPage(): number {
	try {
		const stored = Number(sessionStorage.getItem(PAGE_STORAGE_KEY))
		// Anything absent, non-numeric, or out of range falls back to page 1.
		// The upper bound can't be checked here — the event list hasn't loaded
		// yet at mount — so the render clamps against totalPages instead.
		return Number.isInteger(stored) && stored > 0 ? stored : 1
	} catch {
		return 1
	}
}

function storePage(page: number): void {
	try {
		sessionStorage.setItem(PAGE_STORAGE_KEY, String(page))
	} catch {
		// Position simply won't survive leaving the route.
	}
}
const controlButtonClass =
	"inline-flex min-h-10 items-center justify-center gap-2 rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm font-medium text-gray-100 shadow-sm transition hover:border-gray-500 hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-45 md:min-h-0 md:py-1.5"
const paginationButtonClass = `${controlButtonClass} min-w-28`
const pageIndicatorClass =
	"inline-flex min-h-10 items-center justify-center rounded border border-gray-700 bg-gray-950/50 px-4 py-2 text-sm font-semibold text-gray-200 shadow-inner md:min-h-0 md:py-1.5"
const searchInputClass =
	"w-full rounded border border-gray-600 bg-gray-800 py-2 pl-9 pr-3 text-sm text-gray-100 shadow-sm placeholder:text-gray-400 transition focus:border-gray-500 focus:bg-gray-800 focus:outline-none md:py-1.5"
// Matches controlButtonClass so the filter reads as a third control in that row
// rather than a form field that wandered in.
const categorySelectClass =
	"inline-flex min-h-10 items-center rounded border border-gray-600 bg-gray-800 px-3 py-2 text-sm font-medium text-gray-100 shadow-sm transition hover:border-gray-500 hover:bg-gray-700 focus:border-gray-500 focus:outline-none md:min-h-0 md:py-1.5"

/**
 * The filter's value: the absence of a filter, a banner category, a marker
 * kind, "recommended only" or "free pulls".
 *
 * Five sources in one string, which is what a `<select>` gives you, so the
 * axes have to stay tellable apart. Marker kinds are namespaced with a
 * `marker:` prefix rather than sitting bare alongside the categories — a
 * scenario has no `banner_category` and never will, and an unprefixed
 * `"scenario"` would be one added BannerCategory away from quietly meaning both
 * things at once. The prefix also makes narrowing a string test instead of a
 * membership check against a list that has to be kept in sync.
 *
 * `RECOMMENDED_FILTER` needs no such prefix: it names no BannerCategory or
 * marker kind and never will, since "recommended" is an editorial flag on a
 * banner rather than a value either axis could take. `FREE_PULLS_FILTER` is
 * the same kind of thing: a fact about a banner (it gives pulls away), true of
 * banners in any category.
 *
 * `"all"` is neither axis: it's the only value that keeps race events, and the
 * only one that shows banners and markers together.
 */
const MARKER_FILTER_PREFIX = "marker:"
const RECOMMENDED_FILTER = "recommended"
const FREE_PULLS_FILTER = "free_pulls"

type MarkerFilter = `${typeof MARKER_FILTER_PREFIX}${TimelineMarker["kind"]}`
type EventFilter =
	| "all"
	| BannerCategory
	| MarkerFilter
	| typeof RECOMMENDED_FILTER
	| typeof FREE_PULLS_FILTER

/** The marker kind a filter selects, or null when it selects banners. */
function markerFilterKind(filter: EventFilter): TimelineMarker["kind"] | null {
	return filter.startsWith(MARKER_FILTER_PREFIX)
		? (filter.slice(MARKER_FILTER_PREFIX.length) as TimelineMarker["kind"])
		: null
}

type PaginationControlsProps = {
	currentPage: number
	totalPages: number
	onPrevious: () => void
	onNext: () => void
}

function PaginationControls({
	currentPage,
	totalPages,
	onPrevious,
	onNext,
}: PaginationControlsProps) {
	return (
		<div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
			<button
				type="button"
				className={paginationButtonClass}
				disabled={currentPage === 1}
				onClick={onPrevious}
			>
				<ChevronLeft className="h-4 w-4" />
				Previous
			</button>
			<span className={pageIndicatorClass}>
				Page <span className="mx-1 text-brand">{currentPage}</span> of {totalPages}
			</span>
			<button
				type="button"
				className={paginationButtonClass}
				disabled={currentPage === totalPages}
				onClick={onNext}
			>
				Next
				<ChevronRight className="h-4 w-4" />
			</button>
		</div>
	)
}

function eventMatchesSearch(event: TimelineEvent, query: string): boolean {
	const q = query.toLowerCase()
	if (isRaceEvent(event)) {
		return event.name.toLowerCase().includes(q) || event.track.toLowerCase().includes(q)
	}
	const bannerEvent = event
	if (bannerEvent.name.toLowerCase().includes(q)) return true
	for (const banner of bannerEvent.banner_umas) {
		for (const uma of banner.umas) {
			if (uma.name.toLowerCase().includes(q)) return true
		}
	}
	for (const banner of bannerEvent.banner_supports) {
		for (const card of banner.support_cards) {
			if (card.name.toLowerCase().includes(q)) return true
		}
	}
	return false
}

export const Timeline = () => {
	const {
		organizedTimelineData,
		userPlannedBannerData,
		umaBannerData,
		supportBannerData,
		stagedBanners,
		setStagedBanners,
		scenarioData,
		anniversaryEventData,
	} = useCalculatorData()
	const [searchParams, setSearchParams] = useSearchParams()
	/**
	 * Which half of the calendar to show, as an OVERRIDE rather than the value.
	 *
	 * A deep link routinely points at something that has already happened — the
	 * scenario band above your third planned banner launched two years ago — and
	 * the past/future split would otherwise hide the very card the link exists to
	 * reach. Storing the user's choice as `null` until they make one lets the
	 * focus target decide the default (see `showPast` below) without an effect
	 * writing state after the first paint, which would flash the wrong half of
	 * the timeline and is what `react-hooks/set-state-in-effect` warns about.
	 */
	const [showPastOverride, setShowPastOverride] = useState<boolean | null>(null)
	const [searchQuery, setSearchQuery] = useState("")
	// Not persisted, matching the search box and the past/future toggle: it's a
	// question you're asking right now, not a preference. Only the view mode and
	// the paged position survive leaving the route.
	const [eventFilter, setEventFilter] = useState<EventFilter>("all")
	const [currentPage, setCurrentPage] = useState(readStoredPage)
	const [viewMode, setViewMode] = useState<TimelineViewMode>(readStoredViewMode)
	const [visibleCount, setVisibleCount] = useState(INFINITE_CHUNK_SIZE)
	const sentinelRef = useRef<HTMLDivElement | null>(null)
	// One ref for whichever card the list is anchored on — see TimelineFocusProps.
	const focusCardRef = useRef<HTMLDivElement | null>(null)
	// The card list and the controls band, both measured when the reader clears
	// the search box: the first to find which row they are looking at, the second
	// because it is sticky and covers the top of the scrollport, so "the topmost
	// row" means the topmost row BELOW it. See measureAnchorRow.
	const listRef = useRef<HTMLDivElement | null>(null)
	const controlsRef = useRef<HTMLDivElement | null>(null)

	/**
	 * The row the list is held on after the search box is cleared.
	 *
	 * Clearing a search does not widen the list, it REPLACES it — eight rows
	 * become two hundred and fifty — so there is no scroll offset worth
	 * preserving: pixel 4200 of the filtered list and pixel 4200 of the full one
	 * are unrelated places. The thing that survives the change is a row identity,
	 * and everything else is derived from where that row lands in the new list.
	 *
	 * Held as a `timelineRowKey` rather than a `TimelineFocus` for two reasons.
	 * A key exists for all three row kinds, where a focus cannot name a race event
	 * at all (see rowMatchesFocus) — and a search matches race events, so one is
	 * routinely on screen when the box is cleared. And it stays out of the URL,
	 * which keeps the deep-link contract in utils/timelineFocus.ts to the one job
	 * it was written for.
	 */
	const [anchorRowKey, setAnchorRowKey] = useState<string | null>(null)
	// Where on screen that row sat at the moment of clearing, so it can be put
	// back there rather than jumped to the top. A ref, not state: it is read once
	// during the scroll and must never itself cause a render.
	const anchorOffsetRef = useRef<number | null>(null)

	// Back to top. Measured off an anchor node rather than window.scrollY,
	// which is always 0 on the desktop shell — see hooks/useBackToTop.
	const { topRef, isAwayFromTop, scrollToTop } = useBackToTop()

	// Built once per mount rather than per render. Every event is compared
	// against it, and a fresh Date each render would invalidate the memo below
	// on every single pass — defeating the point of memoizing at all.
	const today = useMemo(() => new Date(), [])

	// The card this visit is aimed at, if the calculator sent us here. Memoized
	// on the raw string so the parsed object is referentially stable — it feeds
	// the dependency lists below, and a fresh object each render would defeat
	// every one of them.
	const focusParam = searchParams.get(TIMELINE_FOCUS_PARAM)
	const focus = useMemo(() => parseTimelineFocus(focusParam), [focusParam])

	/**
	 * Whether the focus target is behind us — null when there is no focus, or
	 * when the data naming it hasn't loaded yet.
	 *
	 * Answered from the RAW data rather than from `timelineRows`, because the
	 * rows are already filtered by the very value this decides. The rules match
	 * the ones the row list applies: a banner is past once it has ENDED, while a
	 * marker is past once it has STARTED (a scenario has no end — it stays
	 * playable — so its launch instant is the only thing to classify it on).
	 */
	const focusIsPast = useMemo(() => {
		if (!focus) return null
		if (focus.kind === "banner") {
			// Guarded on isRaceEvent so a Champions Meeting sharing the id can't
			// answer for a banner: ids are unique per model, not across them.
			const event = organizedTimelineData.find(
				(candidate) => !isRaceEvent(candidate) && candidate.id === focus.id
			)
			return event ? new Date(event.end_date) < today : null
		}
		if (focus.kind === "scenario") {
			const scenario = scenarioData.find((candidate) => candidate.id === focus.id)
			return scenario?.start_date ? new Date(scenario.start_date) < today : null
		}
		const event = anniversaryEventData.find((candidate) => candidate.id === focus.id)
		// main_start_date ?? start_date — where the campaign actually lands, the
		// same instant buildTimelineMarkers sorts its card on.
		const startDate = event ? event.main_start_date ?? event.start_date : null
		return startDate ? new Date(startDate) < today : null
	}, [focus, organizedTimelineData, scenarioData, anniversaryEventData, today])

	// The user's choice wins; failing that a deep link picks the half its target
	// lives in; failing that, the future.
	const showPast = showPastOverride ?? focusIsPast ?? false

	// Keys of banners already on the planner sheet — used for duplicate checks and button state.
	// Keyed by type+id, never by bare id: uma and support banners have independent
	// primary keys, so a bare id would make an uma banner block its same-date
	// support counterpart (see plannedBannerKey).
	const plannedBannerKeys = new Set(
		userPlannedBannerData
			.map(plannedBannerKey)
			.filter((key): key is BannerKey => key !== null)
	)

	// Banners nested inside BannerTimelineForViewing have banner_timeline omitted by the API serializer.
	// We look up the full object from umaBannerData/supportBannerData (which always include it)
	// so the staged banner in CaratCalculator is structurally complete.
	const handleAddBanner = (banner: BannerUma | BannerSupport, type: "Uma" | "Support"): void => {
		const fullBanner = type === "Uma"
			? umaBannerData.find((b) => b.id === banner.id)
			: supportBannerData.find((b) => b.id === banner.id)

		if (!fullBanner) {
			toast.error("Could not find banner data. Try refreshing the page.")
			return
		}

		setStagedBanners((prev) => {
			// From `prev`, never from the render-scoped stagedBanners — staging two
			// banners in quick succession is the normal way to use this page, and a
			// stale list would mint the same tempId twice. See nextTempId.
			const tempId = nextTempId(userPlannedBannerData, prev)

			const newStaged: UserPlannedBanner = type === "Uma"
				? { tempId, number_of_pulls: 0, reserved_copies: 0, banner_uma: fullBanner as BannerUma, initialBannerType: "Uma" }
				: { tempId, number_of_pulls: 0, reserved_copies: 0, banner_support: fullBanner as BannerSupport, initialBannerType: "Support" }

			return [...prev, newStaged]
		})
		toast.success(`${fullBanner.name} staged! Head to the Calculator to confirm.`)
	}

	// Memoized because infinite scroll re-renders this component on every append,
	// and re-scanning ~250 events (each search walking every featured uma and
	// support card) on each one is real work for no benefit.
	//
	// Grouping runs LAST, on the already-filtered list. Doing it first would let
	// a window straddle the past/future boundary and drag an ended banner into
	// the current view, and would make a search match pull in banners that don't
	// match. Everything downstream — paging, the reveal window, the counts —
	// therefore measures ROWS (cards on screen), not raw events.
	const timelineRows = useMemo(() => {
		// Both filter values that show markers — "all" and a marker filter — want
		// the same past/future and search passes first, so they live here rather
		// than being written out at each branch.
		//
		// A scenario has no end date, so it can never be "over" the way a banner
		// is. The past/future split classifies it on its start instant instead:
		// once it has launched it belongs behind you in the calendar, even though
		// it is still playable. That is a deliberate reading of an endless event,
		// not an oversight.
		//
		// Rows are built (sorted and PAIRED) before any of these filters run, and
		// the filters judge a pair by either half. Filtering the markers first
		// would strip a pair's other half, so the same launch would be one row
		// under "All events" and a different row, with a different key, under
		// "Scenarios" — and the key is what holds the reader's place when the
		// filter is lifted. See rowMarkers.
		const matchingMarkerRows = (): TimelineRow[] => {
			const query = searchQuery.toLowerCase()
			return buildMarkerRows(buildTimelineMarkers(scenarioData, anniversaryEventData))
				.filter((row) =>
					showPast
						? timelineRowStart(row) < today.getTime()
						: timelineRowStart(row) >= today.getTime()
				)
				.filter((row) => query === "" || markerRowMatchesSearch(row, query))
		}

		// A marker filter drops the banner stream entirely, so it returns before
		// any of the event work below: asking for scenarios means asking for
		// scenarios, not for the banners that happen to open alongside them. The
		// marker rows are already in chronological order, so there is nothing to
		// splice them between.
		const markerKind = markerFilterKind(eventFilter)
		if (markerKind !== null) {
			return matchingMarkerRows().filter((row) => markerRowMatchesKind(row, markerKind))
		}

		const rows = groupTimelineEvents(
			organizedTimelineData
				.filter((event) =>
					showPast
						? new Date(event.end_date) < today
						: new Date(event.end_date) >= today
				)
				.filter((event) => searchQuery === "" || eventMatchesSearch(event, searchQuery))
		)

		if (eventFilter === "all") {
			// Markers merge in AFTER grouping, on the final row order — running
			// earlier would let one land inside a window that later folds together.
			return spliceMarkerRows(rows, matchingMarkerRows())
		}

		// Markers are deliberately absent under a BANNER CATEGORY or RECOMMENDED
		// filter: they are cross-cutting context rather than banners, so a
		// scenario card stranded in a list of reruns (or of recommended picks)
		// would answer a question nobody asked. The marker filters above are how
		// you ask for them. Race events drop out below for the same reason.
		//
		// Applied AFTER grouping, and a group survives if ANY constituent matches
		// — a revival window with an ordinary banner alongside it stays on screen
		// under "Recommended only" if either half carries the star, the same rule
		// the category filter uses just below.
		if (eventFilter === RECOMMENDED_FILTER) {
			return rows.filter(
				(row) =>
					row.kind === "banner_window" &&
					row.group.banners.some(bannerWindowHasRecommended)
			)
		}

		// "Free pulls" is the same cut on a different fact: a window stays if
		// either side of any banner in it hands some out.
		if (eventFilter === FREE_PULLS_FILTER) {
			return rows.filter(
				(row) =>
					row.kind === "banner_window" &&
					row.group.banners.some(bannerWindowHasFreePulls)
			)
		}

		// Filtering the events first would drop the ordinary banner that shares a
		// revival's window, leaving a card that misrepresents the week — the
		// reader would see the revival alone and conclude nothing else was on.
		//
		// Race events drop out here on purpose: a Champions Meeting has no banner
		// category, so "show me only reruns" cannot meaningfully include one.
		return rows.filter(
			(row) =>
				row.kind === "banner_window" &&
				row.group.banners.some((banner) => banner.banner_category === eventFilter)
		)
	}, [
		organizedTimelineData,
		scenarioData,
		anniversaryEventData,
		showPast,
		searchQuery,
		eventFilter,
		today,
	])

	// Only offer categories the data actually contains. `race_prep_support` has
	// no rows until the support backfill lands, and an option that can only ever
	// return "No events found." is a dead end rather than a filter.
	const availableCategories = useMemo(() => {
		const present = new Set<BannerCategory>()
		for (const event of organizedTimelineData) {
			if (!isRaceEvent(event)) present.add(event.banner_category)
		}
		return CATEGORY_ORDER.filter((category) => present.has(category))
	}, [organizedTimelineData])

	// Same rule, a third axis over: only offer "Recommended only" once some
	// banner on the timeline actually carries the flag, so the option is never
	// a dead end back to "No events found."
	const hasRecommendedBanner = useMemo(
		() =>
			organizedTimelineData.some(
				(event) => !isRaceEvent(event) && bannerWindowHasRecommended(event)
			),
		[organizedTimelineData]
	)

	// And again for "Free pulls": most stretches of the calendar have none.
	const hasFreePullsBanner = useMemo(
		() =>
			organizedTimelineData.some(
				(event) => !isRaceEvent(event) && bannerWindowHasFreePulls(event)
			),
		[organizedTimelineData]
	)

	// Same rule, one axis over: only offer a marker kind the data can actually
	// produce a card for. Asked of buildTimelineMarkers rather than counted off
	// scenarioData/anniversaryEventData directly, because it is the authority on
	// what earns a card — it drops the undated, and drops `event_type:
	// "campaign"` rows outright (the Trainer Support Pack marks no moment on the
	// calendar). Re-deriving those exclusions here is how the option list and the
	// list it filters drift apart.
	const availableMarkerKinds = useMemo(() => {
		const present = new Set<TimelineMarker["kind"]>()
		for (const marker of buildTimelineMarkers(scenarioData, anniversaryEventData)) {
			present.add(marker.kind)
		}
		return MARKER_ORDER.filter((kind) => present.has(kind))
	}, [scenarioData, anniversaryEventData])

	/**
	 * Where the row the list is anchored on ended up, once filtering, grouping and
	 * marker merging are all done — -1 when there is nothing to anchor to.
	 *
	 * TWO SOURCES, ONE INDEX. A deep link from the calculator names a target in
	 * the URL; clearing the search box names one in `anchorRowKey`. Everything
	 * downstream — the reveal window, the page, the tailroom, the scroll — only
	 * ever wanted "which row", so they are resolved to a single index here rather
	 * than each learning about both. The URL wins where both exist, though in
	 * practice they cannot: typing in the search box drops the deep link (see
	 * clearFocus), so by the time a search is cleared there is no focus left.
	 *
	 * -1 also covers an anchor the new list doesn't hold — narrow the category
	 * filter after clearing and the row is simply gone. That degrades to the
	 * ordinary reset rather than needing a case of its own.
	 */
	const anchorRowIndex = useMemo(() => {
		if (focus) return timelineRows.findIndex((row) => rowMatchesFocus(row, focus))
		if (anchorRowKey !== null) {
			return timelineRows.findIndex((row) => timelineRowKey(row) === anchorRowKey)
		}
		return -1
	}, [focus, anchorRowKey, timelineRows])

	// Resolved back to a key so the render can ask "is this the anchor row?"
	// without comparing positions. visibleRows is a SLICE in paged mode, so its
	// indices don't line up with timelineRows' and an index comparison there would
	// hand the ref to the wrong card.
	const anchoredRowKey =
		anchorRowIndex >= 0 ? timelineRowKey(timelineRows[anchorRowIndex]) : null

	const totalPages = Math.max(1, Math.ceil(timelineRows.length / PAGE_SIZE))

	/**
	 * Drop the `focus` parameter from the URL.
	 *
	 * Called from every control that moves or narrows the list. Once the reader
	 * pages, filters or searches, the deep link has been answered and holding on
	 * to it would fight them — the focus target overrides the current page below,
	 * so "Next" would appear to do nothing. Dropping it also retires the arrival
	 * ring at the moment the reader moves on.
	 *
	 * `replace` so the back button returns to the calculator rather than stepping
	 * through the reader's own filtering.
	 */
	const clearFocus = useCallback((): void => {
		// The local anchor goes with it, and goes FIRST — before the early return,
		// which only knows about the URL. An anchor left standing would override the
		// page below exactly the way a stale focus parameter would, so "Next" would
		// appear to do nothing.
		setAnchorRowKey(null)
		anchorOffsetRef.current = null
		if (!searchParams.has(TIMELINE_FOCUS_PARAM)) return
		const next = new URLSearchParams(searchParams)
		next.delete(TIMELINE_FOCUS_PARAM)
		setSearchParams(next, { replace: true })
	}, [searchParams, setSearchParams])

	// The only writer of the page, so every path that moves it — the buttons, the
	// filter resets — also persists it. Nothing sets `currentPage` directly.
	const goToPage = useCallback((page: number): void => {
		setCurrentPage(page)
		storePage(page)
		clearFocus()
	}, [clearFocus])

	// A restored page can outrun the list it's indexing: the events are fetched
	// after mount (so totalPages is 1 for the first render or two), and the user
	// may return with fewer matches than they left with. Clamping here — rather
	// than correcting the state from an effect — means the list and the "Page X
	// of Y" label are never briefly inconsistent, and the stored page is left
	// intact so a slow fetch doesn't permanently knock the reader back to 1.
	// A resolved focus target takes the page over until the reader moves — every
	// control that moves or narrows the list clears the parameter first (see
	// clearFocus), so this can't strand them on one page.
	const anchorPage =
		anchorRowIndex >= 0 ? Math.floor(anchorRowIndex / PAGE_SIZE) + 1 : null
	const effectivePage = Math.min(anchorPage ?? currentPage, totalPages)

	/**
	 * How much of the infinite list is on screen: the revealed prefix, widened to
	 * cover the focus target.
	 *
	 * Derived rather than pushed into `visibleCount` from an effect, for the same
	 * reason `showPast` is: setting state in response to the data arriving
	 * commits the un-widened list first and then re-renders over it. Rounded up
	 * to a whole chunk so a jump lands on the same boundaries scrolling would,
	 * then extended by FOCUS_TRAILING_ROWS so the target has something below it
	 * to scroll against — see that constant for why the landing was erratic
	 * without it.
	 */
	const revealCount =
		anchorRowIndex >= 0
			? Math.max(
					visibleCount,
					Math.ceil((anchorRowIndex + 1) / INFINITE_CHUNK_SIZE) * INFINITE_CHUNK_SIZE +
						FOCUS_TRAILING_ROWS
				)
			: visibleCount

	/**
	 * Whether the LIST ITSELF runs out below the target, leaving it nothing to
	 * scroll against however much is revealed.
	 *
	 * Measured against every row rather than the revealed window, so it is true
	 * only at the genuine end of the timeline — the one case revealing more
	 * cannot fix.
	 */
	const anchorNeedsTailroom =
		anchorRowIndex >= 0 &&
		timelineRows.length - (anchorRowIndex + 1) < FOCUS_TRAILING_ROWS

	// Paged mode windows by page; infinite mode reveals a prefix that only grows.
	// Without an IntersectionObserver there is nothing to drive the growth, so
	// that case skips windowing entirely rather than stranding the reader ten
	// cards in with no way to reach the rest.
	const visibleRows =
		viewMode === "paged"
			? timelineRows.slice((effectivePage - 1) * PAGE_SIZE, effectivePage * PAGE_SIZE)
			: SUPPORTS_INTERSECTION_OBSERVER
				? timelineRows.slice(0, revealCount)
				: timelineRows

	const hasMoreToReveal =
		viewMode === "infinite" &&
		SUPPORTS_INTERSECTION_OBSERVER &&
		revealCount < timelineRows.length

	// Restarting both windows is the right response to any change in what the
	// list contains: page 7 of a now-two-page result renders empty, and a search
	// matching three events must not still claim to be showing sixty.
	//
	// Done in the handlers rather than an effect keyed on the filters. Resetting
	// from an effect means React commits the stale window first and immediately
	// re-renders over it — a visible flash of the wrong list, and what
	// `react-hooks/set-state-in-effect` warns about.
	// goToPage clears the focus parameter, so every caller of this drops the deep
	// link too — which is the intent: the reader has taken over.
	const resetListWindow = (): void => {
		goToPage(1)
		setVisibleCount(INFINITE_CHUNK_SIZE)
	}

	/**
	 * Which row the reader is currently looking at, and where on screen it sits.
	 *
	 * Read straight off the DOM, and only at the moment the search box is cleared
	 * — the alternative, an IntersectionObserver tracking the topmost row
	 * continuously, would run on every scroll frame of a page that can hold 250
	 * image-heavy cards to produce a value wanted once per visit, if ever.
	 *
	 * The list container's leading children ARE the rendered cards, one per
	 * `visibleRows` entry and in the same order — the sentinel, the end-of-list
	 * line and the tailroom all come after them, and the "No events found." line
	 * only renders when there are no rows at all (so `limit` is 0 and the loop
	 * never runs). That correspondence is what lets this find a row without
	 * threading a data attribute through all three card components.
	 *
	 * "Topmost" is measured against the BOTTOM OF THE CONTROLS BAND, not the top of
	 * the viewport. That band is sticky at the app-shell breakpoint, so the first
	 * few hundred pixels of the scrollport are covered by it and a row measured as
	 * being at the top may be one the reader cannot see at all.
	 *
	 * A row is "the one being read" if any part of it is still below that line —
	 * hence `bottom`, not `top`. Someone halfway down a tall banner card is
	 * reading that card, not the one after it, and the offset returned is
	 * negative in that case so it can be put back exactly as scrolled rather than
	 * pulled down into view.
	 */
	const measureAnchorRow = (): { key: string; offset: number } | null => {
		const list = listRef.current
		if (!list) return null

		const floor = controlsRef.current?.getBoundingClientRect().bottom ?? 0
		const limit = Math.min(list.children.length, visibleRows.length)

		for (let index = 0; index < limit; index += 1) {
			const rect = list.children[index].getBoundingClientRect()
			// jsdom reports every rect as zero, so nothing here ever matches under
			// test and the anchor stays null — which is the pre-existing behaviour.
			if (rect.bottom > floor) {
				return { key: timelineRowKey(visibleRows[index]), offset: rect.top }
			}
		}
		return null
	}

	/**
	 * Restart the list window, optionally holding the reader's place.
	 *
	 * Order matters here and is not incidental. `resetListWindow` clears the
	 * anchor along with the deep link (via clearFocus), so the captured row is
	 * re-applied AFTER it — set first, it would be thrown away by the very reset
	 * it exists to survive.
	 */
	const rebuildList = (anchor: { key: string; offset: number } | null): void => {
		resetListWindow()
		if (anchor) {
			setAnchorRowKey(anchor.key)
			anchorOffsetRef.current = anchor.offset
		}
	}

	/**
	 * NARROWING RESTARTS THE LIST; WIDENING KEEPS YOUR PLACE.
	 *
	 * The two controls below share one rule. Cutting the list down is a fresh
	 * question and belongs at the top of the answer — page 7 of a now-two-page
	 * result renders empty, which is what resetListWindow has always been for.
	 * Going back to the whole list is the opposite: the reader has found what they
	 * were looking for and now wants to see what surrounds it, so the row they are
	 * on is captured first and the full list is rebuilt around it.
	 *
	 * Each control has its own un-narrowed value — an empty query, and "all" —
	 * and the capture happens on the transition INTO it, never on a move between
	 * two narrow values. Those degrade on their own: a rerun banner is not in the
	 * revivals list, so the anchor simply doesn't resolve and the reset stands.
	 *
	 * Both measure before any state is set, while the DOM still holds the list the
	 * reader is actually looking at.
	 */
	const handleSearchChange = (value: string): void => {
		const anchor = searchQuery !== "" && value === "" ? measureAnchorRow() : null
		setSearchQuery(value)
		rebuildList(anchor)
	}

	const handleFilterChange = (value: EventFilter): void => {
		const anchor = eventFilter !== "all" && value === "all" ? measureAnchorRow() : null
		setEventFilter(value)
		rebuildList(anchor)
	}

	const changeViewMode = (mode: TimelineViewMode): void => {
		setViewMode(mode)
		storeViewMode(mode)
		// Land at the top rather than mid-window, whose beginning the reader
		// would have no way to scroll back to.
		resetListWindow()
	}

	// Measured from `revealCount`, not from the raw state: after a focus jump the
	// state still says 10 while 90 rows are on screen, and `count + 10` would
	// append nothing visible for eight scrolls running.
	const revealMore = useCallback(() => {
		setVisibleCount((count) => Math.max(count, revealCount) + INFINITE_CHUNK_SIZE)
	}, [revealCount])

	// Reveal the next chunk as the sentinel approaches the viewport.
	//
	// `visibleCount` is in the dependency list on purpose. An IntersectionObserver
	// fires only when intersection *changes*, so an observer left attached across
	// an append would go quiet while the sentinel was still on screen and the list
	// would stall one chunk in — the usual failure on tall viewports, where one
	// chunk doesn't fill the fold. Tearing the observer down and rebuilding it
	// each append forces a fresh evaluation, so appends keep coming until the
	// sentinel is genuinely pushed out of range.
	useEffect(() => {
		if (!hasMoreToReveal) return

		const sentinel = sentinelRef.current
		if (!sentinel) return

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) revealMore()
			},
			{ rootMargin: INFINITE_ROOT_MARGIN }
		)
		observer.observe(sentinel)
		return () => observer.disconnect()
	}, [hasMoreToReveal, revealCount, revealMore])

	// Bring the focus target into view once it is rendered, and hold it there
	// while the page settles — see hooks/useFocusScroll, shared with the
	// Selectors page's campaign deep link.
	//
	// Composite key: `focusParam` alone would not re-run when the row index
	// moves from -1 to a real position as the data arrives, and that is the
	// commit which first puts the card in the DOM.
	// The key names the SOURCE as well as the position — `focusParam` alone would
	// be null for a search-clear anchor, so two consecutive clears landing on
	// different rows at the same index would not re-run.
	useFocusScroll(
		focusCardRef,
		anchorRowIndex >= 0 ? `${focusParam ?? anchorRowKey}#${anchorRowIndex}` : null,
		anchorOffsetRef
	)

	return (
		<div className="w-full bg-gray-900 pb-6">
			{/* Scroll anchor for "back to top" — zero-height, so it costs no layout.
			    First child, above the controls band, so returning to it returns to the
			    top of the PAGE rather than to the top of the list. */}
			<div ref={topRef} aria-hidden="true" />
			{/* Pinned only at app-shell: that is both where there is vertical room for
			    a three-column band and where `sticky` has a scroller to resolve
			    against. Below that breakpoint the shell is only min-h-dvh, the document
			    scrolls, and this band sits inside a div that is not a scrollport —
			    sticky there would simply never engage.

			    Opaque at that breakpoint too. The resting bg-gray-950/40 reads as a
			    darker band against the page, but 60% of a banner card would show
			    through it once cards start passing underneath. The two colors are
			    within a few percent of each other on every theme, so nothing visibly
			    changes at rest. z-30 sits above the cards, below FloatingBackToTop. */}
			<div
				ref={controlsRef}
				className="border-y border-gray-700/60 bg-gray-950/40 shadow-[0_8px_24px_rgba(0,0,0,0.22)] app-shell:sticky app-shell:top-0 app-shell:z-30 app-shell:bg-gray-950"
			>
				<div className="mx-auto grid w-full max-w-[96rem] grid-cols-1 items-stretch gap-3 px-3 py-3 md:grid-cols-[1fr_auto_1fr] md:items-center md:px-2">
					<div className="flex w-full flex-col gap-2 justify-self-start sm:flex-row sm:flex-wrap md:w-auto">
						{/* Desktop only — on a phone this band scrolls away, so the floating
						    button at the foot of the component carries the arrow instead.
						    Hidden through a wrapper because controlButtonClass already sets
						    inline-flex, and two display utilities on one element resolve by
						    stylesheet order rather than class order; `contents` keeps the
						    button itself a direct flex child of this row. */}
						<span className="hidden app-shell:contents">
							<BackToTopButton
								onClick={scrollToTop}
								disabled={!isAwayFromTop}
								className={`${controlButtonClass} px-2.5`}
							/>
						</span>
						<button
							type="button"
							className={`${controlButtonClass} w-full sm:w-auto`}
							onClick={() => { setShowPastOverride(!showPast); resetListWindow() }}
						>
							<History className="h-4 w-4 text-brand" />
							{showPast ? "Show current/future events" : "Show past events"}
						</button>
						{/* Labelled with the mode it switches *to*, matching the past/future
						    button beside it rather than reading as a state indicator. */}
						<button
							type="button"
							className={`${controlButtonClass} w-full sm:w-auto`}
							title={
								viewMode === "infinite"
									? "Show a fixed number of events per page"
									: "Load every event continuously as you scroll"
							}
							onClick={() => changeViewMode(viewMode === "infinite" ? "paged" : "infinite")}
						>
							{viewMode === "infinite" ? (
								<BookOpen className="h-4 w-4 text-brand" />
							) : (
								<InfinityIcon className="h-4 w-4 text-brand" />
							)}
							{viewMode === "infinite" ? "Use pages" : "Use infinite scroll"}
						</button>
					</div>
					{viewMode === "paged" && totalPages > 1 ? (
						<PaginationControls
							currentPage={effectivePage}
							totalPages={totalPages}
							onPrevious={() => goToPage(Math.max(1, effectivePage - 1))}
							onNext={() => goToPage(Math.min(totalPages, effectivePage + 1))}
						/>
					) : viewMode === "infinite" && timelineRows.length > 0 ? (
						<span className={pageIndicatorClass}>
							Showing <span className="mx-1 text-brand">{visibleRows.length}</span> of{" "}
							{timelineRows.length}
						</span>
					) : <div />}
					{/* Narrowing controls, grouped at the trailing edge: the category
					    filter and the search box both cut the list down, so they belong
					    beside each other rather than one of them sitting among the
					    view-mode toggles on the far side of the bar. */}
					<div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end md:w-auto md:justify-self-end">
						{/* Hidden only when there is nothing to choose between — a
						    single-option filter is just clutter. Counted across all three
						    axes: one banner category plus one marker kind is still a real
						    choice, and so is "Recommended only" or "Free pulls" plus nothing else. */}
						{availableCategories.length +
							availableMarkerKinds.length +
							(hasRecommendedBanner ? 1 : 0) +
							(hasFreePullsBanner ? 1 : 0) >
							1 && (
							<>
								<label className="sr-only" htmlFor="timeline-event-filter">
									Filter events
								</label>
								<select
									id="timeline-event-filter"
									className={`${categorySelectClass} w-full sm:w-auto`}
									value={eventFilter}
									onChange={(e) => handleFilterChange(e.target.value as EventFilter)}
								>
									<option value="all">All events</option>
									{/* Ungrouped, sitting beside "All events" rather than in
									    either optgroup below: recommended is an editorial flag
									    that cuts across every category, not a value either axis
									    below can take. */}
									{hasRecommendedBanner && (
										<option value={RECOMMENDED_FILTER}>Recommended only</option>
									)}
									{hasFreePullsBanner && (
										<option value={FREE_PULLS_FILTER}>Free pulls</option>
									)}
									{/* Grouped, because the two lists answer different
									    questions and a flat run of options would read as one
									    list of banner categories with two odd entries at the
									    end. The headings are the axis names. */}
									{availableCategories.length > 0 && (
										<optgroup label="Banner type">
											{availableCategories.map((category) => (
												<option key={category} value={category}>
													{CATEGORY_LABELS[category]}
												</option>
											))}
										</optgroup>
									)}
									{availableMarkerKinds.length > 0 && (
										<optgroup label="Other events">
											{availableMarkerKinds.map((kind) => (
												<option key={kind} value={`${MARKER_FILTER_PREFIX}${kind}`}>
													{MARKER_LABELS[kind]}
												</option>
											))}
										</optgroup>
									)}
								</select>
							</>
						)}
						<div className="relative w-full md:w-64">
							<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
							<input
								type="text"
								className={searchInputClass}
								placeholder="Search characters or events..."
								value={searchQuery}
								onChange={(e) => handleSearchChange(e.target.value)}
							/>
						</div>
					</div>
				</div>
			</div>

			<div ref={listRef} className="page-container flex flex-col items-center">
				{timelineRows.length === 0 && (
					<div className="text-gray-500 mt-8">No events found.</div>
				)}
				{visibleRows.map((row) => {
					const rowKey = timelineRowKey(row)

					// THE REF AND THE RING ARE NO LONGER THE SAME QUESTION.
					//
					// The ref goes to whichever row the list is anchored on, from either
					// source. The ring means "this is the card you clicked through for"
					// and so stays on the deep link alone: a reader who cleared the search
					// box arrived nowhere, and lighting up a card they never chose would
					// be the only thing that visibly happened — the row itself is being
					// held exactly where it already was.
					//
					// Still spread rather than passed as props, so every card but at most
					// one stays literally empty and neither can be claimed twice.
					const focusProps: TimelineFocusProps = {
						...(rowKey === anchoredRowKey ? { focusRef: focusCardRef } : {}),
						...(focus && rowMatchesFocus(row, focus) ? { isFocused: true } : {}),
					}

					// Champions Meetings and League of Heroes events share one card — they
					// carry the same data and are meant to look the same. Everything else
					// is a banner window, which may hold more than one concurrent banner.
					//
					// A race takes the ref but never the ring — it can be the anchor (a
					// search matches race events) but never a deep link target, which is
					// why RaceEventCard accepts only the one prop.
					return row.kind === "race" ? (
						<RaceEventCard
							key={rowKey}
							event={row.event}
							today={today}
							focusRef={focusProps.focusRef}
						/>
					) : row.kind === "marker" ? (
						<EventMarkerCard key={rowKey} marker={row.marker} {...focusProps} />
					) : row.kind === "marker_pair" ? (
						<EventMarkerPairCard
							key={rowKey}
							scenario={row.scenario}
							anniversary={row.anniversary}
							{...focusProps}
						/>
					) : (
						<BannerWindowCard
							key={rowKey}
							group={row.group}
							today={today}
							plannedBannerKeys={plannedBannerKeys}
							stagedBanners={stagedBanners}
							onAddBanner={handleAddBanner}
							{...focusProps}
						/>
					)
				})}

				{viewMode === "infinite" && (
					<>
						{/* Scroll tripwire. Kept mounted whenever the mode is active (not just
						    when there's more to load) so the observer effect always has a node
						    to attach to on the render where `hasMoreToReveal` flips true. */}
						<div ref={sentinelRef} aria-hidden="true" className="h-px w-full shrink-0" />
						{hasMoreToReveal ? (
							<div
								role="status"
								className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-400"
							>
								<OguriSpinner size="sm" />
								Loading more events...
							</div>
						) : timelineRows.length > 0 ? (
							<div className="mt-4 text-sm text-gray-500">
								That's all {timelineRows.length} events.
							</div>
						) : null}
					</>
				)}

				{/* Room to scroll a target that the list runs out beneath. Last, so
				    the reader sees the end-of-list line before the empty space, and
				    aria-hidden because there is nothing here to read. */}
				{anchorNeedsTailroom && (
					<div aria-hidden="true" className={FOCUS_TAILROOM} />
				)}
			</div>

			{viewMode === "paged" && totalPages > 1 && (
				<div className="mx-auto mt-2 w-fit max-w-[calc(100%-1.5rem)] rounded-lg border border-gray-700/60 bg-gray-950/40 px-3 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
					<PaginationControls
						currentPage={effectivePage}
						totalPages={totalPages}
						onPrevious={() => goToPage(Math.max(1, effectivePage - 1))}
						onNext={() => goToPage(Math.min(totalPages, effectivePage + 1))}
					/>
				</div>
			)}

			{/* Phones and short viewports, where the band above is not pinned and the
			    arrow would otherwise be 250 cards out of reach. */}
			<FloatingBackToTop
				onClick={scrollToTop}
				visible={isAwayFromTop}
				className="app-shell:hidden"
			/>
		</div>
	)
}
