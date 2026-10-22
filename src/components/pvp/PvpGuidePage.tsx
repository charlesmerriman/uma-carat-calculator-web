/**
 * The PvP tab (route: /app/pvp): one Champions Meeting or League of Heroes
 * event at a time.
 *
 * Top to bottom: the control band (past toggle, Previous / event / Next), a
 * compact event header (name, dates, countdown, course pills, key dates), then
 * three views of the event:
 *
 *   Recommendations  the guide (PvpGuideView), live now
 *   My team          the player's own team builder (TeamBuilder)
 *   Gallery          teams other players posted for this event (GalleryView)
 *
 * The event, the view and the guide's running style are all URL parameters
 * (`?event=cm-12&view=team`, `?event=cm-12&style=pace`), so every screen is a
 * link someone can paste, and "Copy link" in the header copies one. With no
 * event the page opens on the one running now, else the next one
 * (`defaultPvpEvent`).
 *
 * The tab remembers where it left the page (services/pvpPageMemory.ts): a bare
 * /app/pvp (the navbar link) goes back to that address, and an address with no
 * style opens on the last style shown.
 *
 * The header reads the calculator payload, so it renders even for an event
 * with no guide; only the guide is fetched (hooks/usePvpGuide.ts).
 *
 * In early access (hooks/usePvpAccess.ts) the page still renders for everyone,
 * but someone it is locked to can read one guide: the event running now, else
 * the next (`defaultPvpEvent`, the event a bare /app/pvp opens on), so the
 * free guide moves with the calendar (owner, 2026-10-22: the ad review should
 * land on a real guide, not a lock card). One CM is open in full, its My team
 * and Gallery too (`isOpenPvpEvent`, CM 21). Every other guide, My team and
 * Gallery draw the early-access card in their panel instead.
 *
 * Inside the /app loading gate, so it is never prerendered and may read the
 * clock freely. Its head tags come from AppRouteMeta.
 */

import { Suspense, lazy, useEffect, useMemo, useRef, useState, type CSSProperties, type Ref } from "react"
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import {
	BookOpen,
	CalendarDays,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Clock3,
	History,
	LayoutGrid,
	Link2,
	Loader2,
	PenLine,
	Swords,
	Users,
	type LucideIcon,
} from "lucide-react"
import { useAccount } from "../../services/AuthContext"
import { useCalculatorData } from "../../services/CalculatorContext"
import {
	markPvpIntroSeen,
	pvpIntroSeen,
	recalledPvpPage,
	recalledPvpStyle,
	rememberPvpPage,
	rememberPvpStyle,
} from "../../services/pvpPageMemory"
import { useSiteContent } from "../../services/SiteContentContext"
import { MarkdownContent } from "../info/MarkdownContent"
import PredictedBadge from "../PredictedBadge"
import {
	categorySelectClass,
	controlButtonClass,
	getCountdownLabel,
	paginationButtonClass,
} from "../timeline/timelineShared"
import { usePvpGuide } from "../../hooks/usePvpGuide"
import { usePvpStickyOffsets } from "../../hooks/usePvpStickyOffsets"
import { availableCourseDetails } from "../../utils/courseDetails"
import { formatDate } from "../../utils/dateFormat"
import { timelineFocusHref } from "../../utils/timelineFocus"
import {
	PVP_EVENT_PARAM,
	formatPvpEvent,
	parsePvpEvent,
	pvpEventHref,
	refForRaceEvent,
} from "../../utils/pvpEvent"
import {
	PVP_STYLE_PARAM,
	defaultPvpEvent,
	findEvent,
	hasEnded,
	milestones,
	newCardsBetween,
	parsePvpStyle,
	pickStyle,
	previousPvpEvent,
	raceEventsInOrder,
	stylesWithContent,
} from "../../utils/pvpGuide"
import { PvpGuideView } from "./PvpGuideView"
import { PvpEarlyAccess } from "./PvpEarlyAccess"
import { isOpenPvpEvent, lockedPvpEvents, usePvpAccess } from "../../hooks/usePvpAccess"
import { SupportTile, UmaTile } from "./PvpTiles"
import { TeamBuilder } from "./TeamBuilder"
import { loadGalleryView } from "./gallery/loadGallery"
import { loadGuideEditor } from "./editor/loadGuideEditor"
import type { BannerSupport, BannerUma, RaceEvent } from "../../types"
import type { PvpStyleTab } from "../../types/pvpGuide"

/** The heading while the page's admin row has not loaded. Mirrors the seed's title. */
const FALLBACK_TITLE = "PvP Guides"

/** The page's views, in tab order. The id is the `?view=` value. */
type PvpView = "recommendations" | "team" | "gallery" | "editor"
const VIEW_PARAM = "view"
/**
 * `short`, when set, is the label a phone shows; the full one stays the
 * tab's name. `editors` marks the view only a guide editor gets
 * (`account.guide_editor`): for anyone else the tab is not drawn and
 * `?view=editor` reads as Recommendations.
 */
const VIEWS: Array<{ id: PvpView; label: string; short?: string; icon: LucideIcon; soon: boolean; editors?: boolean }> = [
	{ id: "recommendations", label: "Recommendations", short: "Guide", icon: BookOpen, soon: false },
	{ id: "team", label: "My team", icon: Users, soon: false },
	{ id: "gallery", label: "Gallery", icon: LayoutGrid, soon: false },
	{ id: "editor", label: "Edit guide", short: "Edit", icon: PenLine, soon: false, editors: true },
]

function parseView(value: string | null, isEditor: boolean): PvpView {
	const view = VIEWS.find((candidate) => candidate.id === value)
	return view && (!view.editors || isEditor) ? view.id : "recommendations"
}

// The editor and dnd-kit are a chunk of their own, fetched the first time
// an editor opens the tab (components/pvp/editor/loadGuideEditor.ts).
const GuideEditor = lazy(loadGuideEditor)
// The gallery is a chunk of its own too (gallery/loadGallery.ts).
const GalleryView = lazy(() => loadGalleryView().then((module) => ({ default: module.GalleryView })))

/** The page's own parameters, in the order an address names them. "Copy link" builds the same order. */
const PARAM_ORDER = [PVP_EVENT_PARAM, VIEW_PARAM, PVP_STYLE_PARAM]

/**
 * The params with the page's own first, in PARAM_ORDER, so the address bar
 * reads the same whichever control was clicked last. Anything else (the
 * gallery's `sort`, `uma`, `post`) follows in the order it already had.
 */
function inPageOrder(params: URLSearchParams): URLSearchParams {
	const ordered = new URLSearchParams()
	for (const name of PARAM_ORDER) {
		const value = params.get(name)
		if (value !== null) ordered.set(name, value)
	}
	params.forEach((value, name) => {
		if (!PARAM_ORDER.includes(name)) ordered.append(name, value)
	})
	return ordered
}

/**
 * The route's component: a "checking your account" line while the account
 * loads (so a supporter never sees the early-access card flash up), then the
 * page, told whether it is `locked` (hooks/usePvpAccess.ts).
 */
export const PvpGuidePage = () => {
	const access = usePvpAccess()
	const { search } = useLocation()
	if (access === "pending") return <PvpEarlyAccess pending />
	const locked = access === "locked"
	// A bare /app/pvp (the navbar link) goes back to where this tab left the
	// page. Read at render: the route renders only behind the /app loading
	// gate, never during the build. `replace`, so Back skips the bare address.
	// Not while locked: a bare address then opens on the free guide, so the
	// navbar link always lands somewhere readable.
	const recalled = search === "" && !locked ? recalledPvpPage() : ""
	if (recalled) return <Navigate to={{ search: recalled }} replace />
	return <PvpGuide locked={locked} />
}

const PvpGuide = ({ locked }: { locked: boolean }) => {
	const {
		championsMeetingData,
		leagueOfHeroesData,
		umaBannerData,
		supportBannerData,
		calculationConstants,
	} = useCalculatorData()
	const page = useSiteContent().page("pvp-guides", { optional: true })
	const [searchParams, setSearchParams] = useSearchParams()
	const { search } = useLocation()
	// Whether the Edit guide tab is drawn. The server checks every write
	// again, so this only decides what is on screen.
	const isEditor = Boolean(useAccount().account?.guide_editor)

	// One clock reading per mount, so every label measures from the same "now".
	const now = useMemo(() => new Date(), [])
	const events = useMemo(
		() => raceEventsInOrder(championsMeetingData, leagueOfHeroesData),
		[championsMeetingData, leagueOfHeroesData]
	)

	// The event a bare address opens on is also the one guide that is free
	// while the page is locked (see the header).
	const freeEvent = defaultPvpEvent(events, now)
	const requested = findEvent(events, parsePvpEvent(searchParams.get(PVP_EVENT_PARAM)))
	const event = requested ?? freeEvent
	const view = parseView(searchParams.get(VIEW_PARAM), isEditor)
	// Whether the view on screen is closed to this reader: while locked,
	// anything but the free event's guide and the open CM's guide, My team and
	// Gallery. An editor is staff, so never locked.
	const viewLocked =
		locked &&
		!(view === "recommendations" && event === freeEvent) &&
		!(view !== "editor" && event !== null && isOpenPvpEvent(event))

	// The events this reader can open: all of them, or while locked only the
	// free guide's and the open CM's (lockedPvpEvents), so the list never
	// offers a lock card. The event on screen is always listed, so a link to a
	// locked one still shows it selected (with its card).
	const reachable = locked ? lockedPvpEvents(events, now) : events
	// Past events stay out of the dropdown unless asked for, or unless the
	// event on screen is itself past (a link to an old guide).
	const [showPastChoice, setShowPastChoice] = useState(false)
	const showPast = showPastChoice || (event !== null && hasEnded(event, now))
	const choices = events.filter(
		(candidate) => candidate === event || (reachable.includes(candidate) && (showPast || !hasEnded(candidate, now)))
	)
	// No past event to offer (a locked reader, before the open CM ends): no toggle.
	const hasPast = reachable.some((candidate) => hasEnded(candidate, now))
	const index = event ? choices.indexOf(event) : -1

	// The running style asked for: the URL's, else the last one this tab was
	// on, since a Timeline card's link names only the event. Read at render
	// (behind the loading gate, like the clock above); the store changes only
	// in the effect below, after the URL already has.
	const urlStyle = parsePvpStyle(searchParams.get(PVP_STYLE_PARAM))
	const wantedStyle = urlStyle ?? recalledPvpStyle()

	// Where the tab left the page, for the next visit (services/pvpPageMemory.ts).
	useEffect(() => rememberPvpPage(search), [search])
	useEffect(() => {
		if (urlStyle) rememberPvpStyle(urlStyle)
	}, [urlStyle])

	/**
	 * Every address the page writes names its event, the one on screen when the
	 * address lacks it. Without that, Recommendations (which DELETES `?view=`)
	 * turned a page opened bare from the navbar back into the bare `/app/pvp`,
	 * and the wrapper above read that as a fresh arrival and sent it back to the
	 * remembered `?view=team`: the tab could not be reached until the event was
	 * changed. Pinned, the bare address only ever comes from outside the page,
	 * and the memory only ever gets an address this page wrote with its event.
	 */
	const setParam = (key: string, value: string | null, options?: { replace?: boolean }) =>
		setSearchParams((params) => {
			if (value === null) params.delete(key)
			else params.set(key, value)
			if (event && !params.has(PVP_EVENT_PARAM)) params.set(PVP_EVENT_PARAM, formatPvpEvent(refForRaceEvent(event)))
			return inPageOrder(params)
		}, options)
	// Changing the event keeps `?style=`, so Next stays on the reader's style.
	const select = (next: RaceEvent | undefined) => {
		if (next) setParam(PVP_EVENT_PARAM, formatPvpEvent(refForRaceEvent(next)))
	}
	// A style is a tab inside the guide: `replace`, so Back leaves the page
	// (or the event) instead of stepping back through every tab clicked.
	const selectStyle = (next: PvpStyleTab) => setParam(PVP_STYLE_PARAM, next, { replace: true })

	// Fetched only on the view that shows it.
	const guideState = usePvpGuide(event && view === "recommendations" && !viewLocked ? refForRaceEvent(event) : null)

	// The intro shows in full until a guide has been on screen once on this
	// device, then folds behind a link (services/pvpPageMemory.ts). Read once
	// per mount, at render, which is safe here: this page renders only behind
	// the /app loading gate. Marking it does not fold the intro on this visit;
	// the next one opens folded.
	const [introSeen] = useState(pvpIntroSeen)
	const [introOpen, setIntroOpen] = useState(false)
	useEffect(() => {
		if (guideState.status === "ready") markPvpIntroSeen()
	}, [guideState.status])
	// The tab the guide shows, the same pick PvpGuideView makes, for the link.
	const shownStyle =
		guideState.status === "ready" ? pickStyle(stylesWithContent(guideState.guide), wantedStyle) : null

	// The pinned rows' offsets, as CSS variables on the page root.
	const rootRef = useRef<HTMLDivElement>(null)
	const bandRef = useRef<HTMLDivElement>(null)
	const tabsRef = useRef<HTMLDivElement>(null)
	usePvpStickyOffsets(rootRef, bandRef, tabsRef, event !== null)

	/**
	 * A link to what is on screen, for someone else: the event, always (a bare
	 * /app/pvp moves with the calendar), the style on screen, and the Gallery
	 * view. Never My team: that view is the reader's own, so the link opens the
	 * guide. Never an open post: a post has its own link, /post/<id>.
	 * Built at click time from the page the reader is on, so a link copied on a
	 * dev server points at that server; never during a build.
	 */
	const copyLink = async (shown: RaceEvent) => {
		const params = new URLSearchParams({ [PVP_EVENT_PARAM]: formatPvpEvent(refForRaceEvent(shown)) })
		if (view === "gallery") params.set(VIEW_PARAM, view)
		if (view === "recommendations" && shownStyle) params.set(PVP_STYLE_PARAM, shownStyle)
		const url = `${window.location.origin}/app/pvp?${params}`
		try {
			await navigator.clipboard.writeText(url)
			toast.success("Link copied.")
		} catch {
			// No clipboard (an insecure origin, or a refused permission): show
			// the link so it can be copied by hand, as the gallery does.
			toast(url)
		}
	}

	return (
		<div ref={rootRef} className="w-full pb-8">
			<ControlBand
				ref={bandRef}
				events={choices}
				event={event}
				index={index}
				now={now}
				showPast={showPast}
				hasPast={hasPast}
				onTogglePast={() => setShowPastChoice(!showPast)}
				onSelect={select}
			/>

			<div className="mx-auto mt-3 flex w-[calc(100%-1rem)] max-w-[96rem] flex-col gap-3 sm:w-[calc(100%-2rem)]">
				<header>
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
						<h1 className="font-display flex items-center gap-2 text-lg font-bold text-brand">
							<Swords className="h-5 w-5 shrink-0" />
							{page?.title ?? FALLBACK_TITLE}
						</h1>
						{page && introSeen && (
							<button
								type="button"
								aria-expanded={introOpen}
								onClick={() => setIntroOpen((open) => !open)}
								className="text-xs font-medium text-gray-400 underline-offset-2 transition hover:text-gray-100 hover:underline"
							>
								{introOpen ? "Hide the intro" : "About these guides"}
							</button>
						)}
					</div>
					{page && (!introSeen || introOpen) && (
						<div className="text-sm">
							<MarkdownContent markdown={page.body} paragraphClassName="mt-1 leading-relaxed text-gray-400" />
						</div>
					)}
				</header>

				{event === null ? (
					<p className="text-sm text-gray-400">
						No Champions Meeting or League of Heroes events are listed yet.
					</p>
				) : (
					<>
						<EventHeader
							event={event}
							now={now}
							keyDates={milestones(event, calculationConstants)}
							onCopyLink={() => copyLink(event)}
						/>

						{/* Pinned under the event band (desktop) or the navbar (phone)
						    while the page scrolls, so the views stay one tap away
						    (Daptrius, 2026-10-22). Opaque, or the page shows through. */}
						<div ref={tabsRef} className="sticky top-(--pvp-tabs-top,0px) z-20 bg-gray-900">
							<ViewTabs view={view} isEditor={isEditor} onChange={(next) => setParam(VIEW_PARAM, next === "recommendations" ? null : next)} />
						</div>

						<div role="tabpanel" aria-label={VIEWS.find((entry) => entry.id === view)?.label}>
							{/* A locked guide fetches nothing (guideState stays idle), so
							    only the card and the event's new cards show under it. */}
							{viewLocked && <PvpEarlyAccess pending={false} freeEvent={freeEvent} />}
							{view === "recommendations" && (
								<div className="flex flex-col gap-4">
									{guideState.status === "loading" && (
										<div className="flex items-center gap-2 text-sm text-gray-400" role="status">
											<Loader2 className="h-4 w-4 animate-spin" />
											Loading the guide…
										</div>
									)}
									{guideState.status === "none" && (
										<p className="rounded-xl border border-edge bg-gray-800/60 p-4 text-sm text-gray-300">
											No guide for this event yet.
										</p>
									)}
									{guideState.status === "error" && (
										<p className="rounded-xl border border-edge bg-gray-800/60 p-4 text-sm text-gray-300">
											The guide didn't load. Try another event, or reload the page.
										</p>
									)}
									{guideState.status === "ready" && (
										<PvpGuideView guide={guideState.guide} style={wantedStyle} onStyleChange={selectStyle} />
									)}

									<NewCardsSection
										key={formatPvpEvent(refForRaceEvent(event))}
										event={event}
										previous={previousPvpEvent(events, event)}
										umaBanners={umaBannerData}
										supportBanners={supportBannerData}
									/>
								</div>
							)}
							{view === "team" && !viewLocked && <TeamBuilder event={event} />}
							{view === "gallery" && !viewLocked && (
								<Suspense
									fallback={
										<div className="flex items-center gap-2 text-sm text-gray-400" role="status">
											<Loader2 className="h-4 w-4 animate-spin" />
											Loading the gallery…
										</div>
									}
								>
									<GalleryView event={event} onOpenMyTeam={() => setParam(VIEW_PARAM, "team")} />
								</Suspense>
							)}
							{view === "editor" && !viewLocked && (
								<Suspense
									fallback={
										<div className="flex items-center gap-2 text-sm text-gray-400" role="status">
											<Loader2 className="h-4 w-4 animate-spin" />
											Loading the editor…
										</div>
									}
								>
									{/* Keyed by event, so switching events starts a fresh editor on that guide. */}
									<GuideEditor key={formatPvpEvent(refForRaceEvent(event))} event={event} onViewAsVisitor={() => setParam(VIEW_PARAM, null)} />
								</Suspense>
							)}
						</div>
					</>
				)}
			</div>
		</div>
	)
}

function prefetchGallery() {
	void loadGalleryView().catch(() => {})
}

function ViewTabs({ view, isEditor, onChange }: { view: PvpView; isEditor: boolean; onChange: (view: PvpView) => void }) {
	const shown = VIEWS.filter((entry) => !entry.editors || isEditor)
	return (
		// No overflow-x-auto here: overflow on one axis makes the other "auto"
		// too, and each tab's -mb-px underline (which sits on the row's border)
		// overflowed by 1px and drew a vertical scrollbar. A grid with a column
		// per tab, so the tabs share the width and never wrap: at 390px a flex
		// row dropped "Gallery" alone onto a second line. On a phone a tab with
		// a `short` label shows that, while its full label stays its name for a
		// screen reader (and for tests querying by name). An editor gets a
		// fourth column; both class strings are literal so Tailwind sees them.
		<div role="tablist" aria-label="View" className={`grid gap-1 border-b border-gray-700 ${shown.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
			{shown.map((entry) => {
				const Icon = entry.icon
				const active = entry.id === view
				return (
					<button
						key={entry.id}
						type="button"
						role="tab"
						aria-selected={active}
						onClick={() => onChange(entry.id)}
						// Start the gallery's chunk on the way to a click, so the
						// tab rarely shows its loading line. A failed start just
						// means the lazy() fetches it on render instead.
						onPointerEnter={entry.id === "gallery" ? prefetchGallery : undefined}
						onFocus={entry.id === "gallery" ? prefetchGallery : undefined}
						className={`-mb-px flex min-w-0 items-center justify-center gap-1.5 border-b-2 px-2 py-2 text-sm font-semibold transition sm:px-3 ${
							active
								? "border-brand text-brand"
								: "border-transparent text-gray-400 hover:border-gray-500 hover:text-gray-100"
						}`}
					>
						<Icon className="h-4 w-4 shrink-0" />
						{entry.short ? (
							<>
								<span className="sm:hidden" aria-hidden="true">{entry.short}</span>
								<span className="sr-only sm:not-sr-only">{entry.label}</span>
							</>
						) : (
							entry.label
						)}
						{entry.soon && (
							<span className="rounded-full border border-gray-600 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-gray-400">
								Soon
							</span>
						)}
					</button>
				)
			})}
		</div>
	)
}

/** "Champions Meeting 20 Sagittarius Cup (2026/10/10)", starred when it has a guide. */
function optionLabel(event: RaceEvent): string {
	return `${event.has_guide ? "★ " : ""}${event.name} (${formatDate(event.start_date)})`
}

function ControlBand({ ref, events, event, index, now, showPast, hasPast, onTogglePast, onSelect }: {
	ref: Ref<HTMLDivElement>
	events: RaceEvent[]
	event: RaceEvent | null
	index: number
	now: Date
	showPast: boolean
	hasPast: boolean
	onTogglePast: () => void
	onSelect: (event: RaceEvent | undefined) => void
}) {
	const upcoming = events.filter((candidate) => !hasEnded(candidate, now))
	const past = events.filter((candidate) => hasEnded(candidate, now))
	const option = (candidate: RaceEvent) => {
		const value = formatPvpEvent(refForRaceEvent(candidate))
		return (
			<option key={value} value={value}>
				{optionLabel(candidate)}
			</option>
		)
	}
	return (
		<div ref={ref} className="border-y border-gray-700/60 bg-gray-950/40 shadow-[0_8px_24px_rgba(0,0,0,0.22)] app-shell:sticky app-shell:top-0 app-shell:z-30 app-shell:bg-gray-950">
			{/* One centred group from `md:`: the past toggle sits beside the event
			    controls it changes. It was pinned to the far left of a three-column
			    grid, with the right column left empty to balance it. Stacked on a
			    phone, toggle first. */}
			<div className="mx-auto flex w-full max-w-[96rem] flex-col items-stretch gap-2 px-3 py-2 md:flex-row md:items-center md:justify-center md:px-2">
				{hasPast && (
					<button type="button" className={`${controlButtonClass} w-full md:w-auto`} onClick={onTogglePast}>
						<History className="h-4 w-4 text-brand" />
						{showPast ? "Hide past events" : "Show past events"}
					</button>
				)}
				<div className="flex items-center justify-center gap-2">
					<button
						type="button"
						className={paginationButtonClass}
						disabled={index <= 0}
						onClick={() => onSelect(events[index - 1])}
					>
						<ChevronLeft className="h-4 w-4" />
						Previous
					</button>
					<select
						aria-label="Event"
						className={`${categorySelectClass} min-w-0 max-w-[22rem] flex-1 md:w-[22rem] md:flex-none`}
						value={event ? formatPvpEvent(refForRaceEvent(event)) : ""}
						onChange={(change) =>
							onSelect(events.find((candidate) => formatPvpEvent(refForRaceEvent(candidate)) === change.target.value))
						}
					>
						{upcoming.length > 0 && <optgroup label="Upcoming">{upcoming.map(option)}</optgroup>}
						{past.length > 0 && <optgroup label="Past">{past.map(option)}</optgroup>}
					</select>
					<button
						type="button"
						className={paginationButtonClass}
						disabled={index < 0 || index >= events.length - 1}
						onClick={() => onSelect(events[index + 1])}
					>
						Next
						<ChevronRight className="h-4 w-4" />
					</button>
				</div>
			</div>
		</div>
	)
}

/**
 * "Champions Meeting 20 Sagittarius Cup" -> kicker "Champions Meeting 20",
 * title "Sagittarius Cup". A name with nothing after its number ("League of
 * Heroes 6") keeps the whole name as the title and no kicker.
 */
function splitEventName(event: RaceEvent): { kicker: string; title: string } {
	const match = /^((?:Champions Meeting|League of Heroes)\s+\d+)\s+(.+)$/i.exec(event.name.trim())
	return match ? { kicker: match[1], title: match[2] } : { kicker: "", title: event.name }
}

/** The course as label/value pairs, distance and length folded into one. */
function courseRows(event: RaceEvent): Array<{ label: string; value: string }> {
	const byLabel = new Map(availableCourseDetails(event).map((detail) => [detail.label, detail.value.trim()]))
	const length = byLabel.get("Length")
	const metres = length && /^\d+$/.test(length) ? `${length}m` : length
	const distance = [metres, byLabel.get("Distance")].filter(Boolean).join(" · ")
	const rows: Array<[string, string | undefined]> = [
		["Racecourse", byLabel.get("Racecourse")],
		["Surface", byLabel.get("Surface")],
		["Distance", distance || undefined],
		["Direction", byLabel.get("Direction")],
		["Condition", byLabel.get("Track condition")],
		["Season", byLabel.get("Season")],
		["Weather", byLabel.get("Weather")],
	]
	return rows.filter((row): row is [string, string] => Boolean(row[1])).map(([label, value]) => ({ label, value }))
}

const PANEL_LABEL = "mb-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500"

/**
 * The event: art, name and countdown, then the course and the schedule side
 * by side. Kept light on purpose (the owner, 2026-10-13: boxed grids, then
 * pills, both read as congested): labels above values, no boxes, and the key
 * dates as a step line that shows how far the event has got.
 */
function EventHeader({ event, now, keyDates, onCopyLink }: {
	event: RaceEvent
	now: Date
	keyDates: ReturnType<typeof milestones>
	onCopyLink: () => void
}) {
	const { kicker, title } = splitEventName(event)
	const course = courseRows(event)
	// The first milestone still ahead is "next"; everything before it is done.
	const nextIndex = keyDates.findIndex((milestone) => new Date(milestone.date).getTime() > now.getTime())

	return (
		<section className="card-panel overflow-hidden rounded-xl" aria-labelledby="pvp-event-name">
			<div className="flex items-center gap-4 p-3 sm:p-4">
				{event.image && (
					<img
						src={event.image}
						alt=""
						loading="lazy"
						decoding="async"
						className="hidden aspect-[16/9] w-36 shrink-0 rounded-lg object-cover sm:block"
					/>
				)}
				<div className="min-w-0 flex-1">
					{kicker && <p className="text-xs font-semibold uppercase tracking-wider text-brand">{kicker}</p>}
					<h2 id="pvp-event-name" className="truncate text-xl font-bold text-gray-100 sm:text-2xl">
						{title}
					</h2>
					<p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-gray-400">
						{formatDate(event.start_date)} through {formatDate(event.end_date)}
						{event.is_predicted && <PredictedBadge />}
						{/* The way back to the event's Timeline card. A PvpEventRef is
						    a TimelineFocus, so the ref passes straight through. */}
						<Link
							to={timelineFocusHref(refForRaceEvent(event))}
							className="inline-flex items-center gap-1 text-brand transition hover:text-brand/75"
						>
							<CalendarDays className="h-3.5 w-3.5" />
							View on Timeline
						</Link>
						<button
							type="button"
							onClick={onCopyLink}
							className="inline-flex items-center gap-1 text-brand transition hover:text-brand/75"
						>
							<Link2 className="h-3.5 w-3.5" aria-hidden="true" />
							Copy link
						</button>
					</p>
				</div>
				<span className="flex shrink-0 items-center gap-1.5 self-start rounded-full border border-gray-600 bg-gray-700 px-3 py-1 text-xs font-semibold text-gray-100">
					{getCountdownLabel(event.start_date, event.end_date, now)}
					<Clock3 className="h-3.5 w-3.5 text-brand" />
				</span>
			</div>

			<div className="grid gap-4 border-t border-gray-700/70 bg-gray-900/30 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-8">
				<div className="min-w-0">
					<h3 className={PANEL_LABEL}>Course</h3>
					{course.length > 0 ? (
						<dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4" aria-label="Course">
							{course.map((row) => (
								<div key={row.label} className="min-w-0">
									<dt className="text-[11px] text-gray-500">{row.label}</dt>
									<dd className="truncate text-sm font-medium text-gray-100" title={row.value}>
										{row.value}
									</dd>
								</div>
							))}
						</dl>
					) : (
						<p className="text-sm text-gray-400">Not announced yet.</p>
					)}
				</div>

				{keyDates.length > 0 && (
					<div className="min-w-0">
						<h3 className={PANEL_LABEL}>
							Schedule{event.is_predicted && <span className="normal-case tracking-normal"> (estimated)</span>}
						</h3>
						{/* A rail across from sm; below sm a list DOWN the page with the
						    rail on its left (design polish item 26). Five milestones
						    across 350px overlapped: "Round 1 2026/10/31Round 2 2026/11/2".
						    The column count is a variable so the grid template can be an
						    sm: class; an inline grid-template would apply at every width. */}
						<ol
							className="flex flex-col gap-3 sm:grid sm:grid-cols-[repeat(var(--schedule-columns),minmax(0,1fr))] sm:gap-y-2"
							style={{ "--schedule-columns": keyDates.length } as CSSProperties}
							aria-label="Key dates"
						>
							{keyDates.map((milestone, position) => {
								const done = nextIndex === -1 || position < nextIndex
								const isNext = position === nextIndex
								return (
									<li key={milestone.label} className="relative flex min-w-0 items-start gap-3 sm:block sm:pr-2" aria-current={isNext ? "step" : undefined}>
										{/* The line runs from this dot to the next one: down the
										    left edge on a phone (through the 12px gap to the next
										    dot), across on wider screens. */}
										{position < keyDates.length - 1 && (
											<span
												aria-hidden="true"
												className={`absolute -bottom-3.5 left-[5px] top-3.5 w-0.5 sm:bottom-auto sm:left-1.5 sm:right-0 sm:top-[5px] sm:h-0.5 sm:w-auto ${done ? "bg-brand/60" : "bg-gray-700"}`}
											/>
										)}
										<span
											aria-hidden="true"
											className={`relative mt-0.5 block h-3 w-3 shrink-0 rounded-full border-2 sm:mt-0 ${
												isNext
													? "border-brand bg-gray-900 ring-4 ring-brand/20"
													: done
														? "border-brand bg-brand"
														: "border-gray-600 bg-gray-800"
											}`}
										/>
										<div className="flex min-w-0 flex-1 items-baseline justify-between gap-3 sm:block">
											<div className={`text-sm leading-tight sm:mt-1.5 sm:text-[11px] ${isNext ? "text-brand" : "text-gray-400"}`}>
												{milestone.label}
											</div>
											<div className={`shrink-0 text-xs font-semibold ${done && !isNext ? "text-gray-400" : "text-gray-100"}`}>
												{formatDate(milestone.date)}
											</div>
										</div>
									</li>
								)
							})}
						</ol>
					</div>
				)}
			</div>
		</section>
	)
}

/**
 * Cards whose first global banner fell between the previous PvP event and this
 * one. Collapsed by default: it is background, and open it read as the guide's
 * umas listed a second time.
 */
function NewCardsSection({ event, previous, umaBanners, supportBanners }: {
	event: RaceEvent
	previous: RaceEvent | null
	umaBanners: BannerUma[]
	supportBanners: BannerSupport[]
}) {
	const [open, setOpen] = useState(false)
	const cards = useMemo(
		() => (previous ? newCardsBetween(previous.start_date, event.start_date, umaBanners, supportBanners) : null),
		[previous, event, umaBanners, supportBanners]
	)
	if (!previous || !cards) return null
	const count = cards.umas.length + cards.supports.length
	if (count === 0) return null
	return (
		<section className="rounded-xl border border-edge bg-gray-800/60 p-3" aria-labelledby="pvp-new-cards">
			<h3 id="pvp-new-cards" className="text-sm font-semibold text-gray-100">
				<button
					type="button"
					aria-expanded={open}
					onClick={() => setOpen(!open)}
					className="flex items-center gap-1.5 transition hover:text-brand"
				>
					<ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden="true" />
					New since {previous.name} ({count})
				</button>
			</h3>
			{open && (
				<div className="mt-3 flex flex-col gap-3">
					<Link to={pvpEventHref(refForRaceEvent(previous))} className="w-fit text-xs text-brand transition hover:text-brand/75">
						Open {previous.name}
					</Link>
					{cards.umas.length > 0 && (
						<div className="flex flex-wrap gap-2">
							{cards.umas.map((uma) => (
								<UmaTile key={uma.id} uma={uma} stars={0} role="" note={uma.purpose ?? ""} />
							))}
						</div>
					)}
					{cards.supports.length > 0 && (
						<div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-8">
							{cards.supports.map((card) => (
								<SupportTile key={card.id} card={{ ...card, card_type: null, rarity: card.rarity ?? null }} note="" />
							))}
						</div>
					)}
				</div>
			)}
		</section>
	)
}
