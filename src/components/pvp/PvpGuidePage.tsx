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
 * The event and the view are both URL parameters (`?event=cm-12&view=team`),
 * so every screen is a link someone can paste. With no event the page opens on
 * the one running now, else the next one (`defaultPvpEvent`).
 *
 * The header reads the calculator payload, so it renders even for an event
 * with no guide; only the guide is fetched (hooks/usePvpGuide.ts).
 *
 * Inside the /app loading gate, so it is never prerendered and may read the
 * clock freely. Its head tags come from AppRouteMeta.
 */

import { useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import {
	BookOpen,
	CalendarDays,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	Clock3,
	History,
	LayoutGrid,
	Loader2,
	Swords,
	Users,
	type LucideIcon,
} from "lucide-react"
import { useCalculatorData } from "../../services/CalculatorContext"
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
	defaultPvpEvent,
	findEvent,
	hasEnded,
	milestones,
	newCardsBetween,
	previousPvpEvent,
	raceEventsInOrder,
} from "../../utils/pvpGuide"
import { PvpGuideView } from "./PvpGuideView"
import { SupportTile, UmaTile } from "./PvpTiles"
import { TeamBuilder } from "./TeamBuilder"
import { GalleryView } from "./gallery/GalleryView"
import type { BannerSupport, BannerUma, RaceEvent } from "../../types"

/** The heading while the page's admin row has not loaded. Mirrors the seed's title. */
const FALLBACK_TITLE = "PvP Guides"

/** The page's views, in tab order. The id is the `?view=` value. */
type PvpView = "recommendations" | "team" | "gallery"
const VIEW_PARAM = "view"
const VIEWS: Array<{ id: PvpView; label: string; icon: LucideIcon; soon: boolean }> = [
	{ id: "recommendations", label: "Recommendations", icon: BookOpen, soon: false },
	{ id: "team", label: "My team", icon: Users, soon: false },
	{ id: "gallery", label: "Gallery", icon: LayoutGrid, soon: false },
]

function parseView(value: string | null): PvpView {
	return VIEWS.some((view) => view.id === value) ? (value as PvpView) : "recommendations"
}

export const PvpGuidePage = () => {
	const {
		championsMeetingData,
		leagueOfHeroesData,
		umaBannerData,
		supportBannerData,
		calculationConstants,
	} = useCalculatorData()
	const page = useSiteContent().page("pvp-guides", { optional: true })
	const [searchParams, setSearchParams] = useSearchParams()

	// One clock reading per mount, so every label measures from the same "now".
	const now = useMemo(() => new Date(), [])
	const events = useMemo(
		() => raceEventsInOrder(championsMeetingData, leagueOfHeroesData),
		[championsMeetingData, leagueOfHeroesData]
	)

	const requested = findEvent(events, parsePvpEvent(searchParams.get(PVP_EVENT_PARAM)))
	const event = requested ?? defaultPvpEvent(events, now)
	const view = parseView(searchParams.get(VIEW_PARAM))

	// Past events stay out of the dropdown unless asked for, or unless the
	// event on screen is itself past (a link to an old guide).
	const [showPastChoice, setShowPastChoice] = useState(false)
	const showPast = showPastChoice || (event !== null && hasEnded(event, now))
	const choices = events.filter((candidate) => showPast || !hasEnded(candidate, now) || candidate === event)
	const index = event ? choices.indexOf(event) : -1

	const setParam = (key: string, value: string | null) =>
		setSearchParams((params) => {
			if (value === null) params.delete(key)
			else params.set(key, value)
			return params
		})
	const select = (next: RaceEvent | undefined) => {
		if (next) setParam(PVP_EVENT_PARAM, formatPvpEvent(refForRaceEvent(next)))
	}

	// Fetched only on the view that shows it.
	const guideState = usePvpGuide(event && view === "recommendations" ? refForRaceEvent(event) : null)

	return (
		<div className="w-full bg-gray-900 pb-8">
			<ControlBand
				events={choices}
				event={event}
				index={index}
				now={now}
				showPast={showPast}
				onTogglePast={() => setShowPastChoice(!showPast)}
				onSelect={select}
			/>

			<div className="mx-auto mt-3 flex w-[calc(100%-1rem)] max-w-[96rem] flex-col gap-3 sm:w-[calc(100%-2rem)]">
				<header>
					<h1 className="flex items-center gap-2 text-lg font-bold text-brand">
						<Swords className="h-5 w-5 shrink-0" />
						{page?.title ?? FALLBACK_TITLE}
					</h1>
					{page && (
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
						<EventHeader event={event} now={now} keyDates={milestones(event, calculationConstants)} />

						<ViewTabs view={view} onChange={(next) => setParam(VIEW_PARAM, next === "recommendations" ? null : next)} />

						<div role="tabpanel" aria-label={VIEWS.find((entry) => entry.id === view)?.label}>
							{view === "recommendations" && (
								<div className="flex flex-col gap-4">
									{guideState.status === "loading" && (
										<div className="flex items-center gap-2 text-sm text-gray-400" role="status">
											<Loader2 className="h-4 w-4 animate-spin" />
											Loading the guide…
										</div>
									)}
									{guideState.status === "none" && (
										<p className="rounded-xl border border-gray-700 bg-gray-800/60 p-4 text-sm text-gray-300">
											No guide for this event yet.
										</p>
									)}
									{guideState.status === "error" && (
										<p className="rounded-xl border border-gray-700 bg-gray-800/60 p-4 text-sm text-gray-300">
											The guide didn't load. Try another event, or reload the page.
										</p>
									)}
									{guideState.status === "ready" && <PvpGuideView guide={guideState.guide} />}

									<NewCardsSection
										key={formatPvpEvent(refForRaceEvent(event))}
										event={event}
										previous={previousPvpEvent(events, event)}
										umaBanners={umaBannerData}
										supportBanners={supportBannerData}
									/>
								</div>
							)}
							{view === "team" && <TeamBuilder event={event} />}
							{view === "gallery" && (
								<GalleryView event={event} onOpenMyTeam={() => setParam(VIEW_PARAM, "team")} />
							)}
						</div>
					</>
				)}
			</div>
		</div>
	)
}

function ViewTabs({ view, onChange }: { view: PvpView; onChange: (view: PvpView) => void }) {
	return (
		// No overflow-x-auto here: overflow on one axis makes the other "auto"
		// too, and each tab's -mb-px underline (which sits on the row's border)
		// overflowed by 1px and drew a vertical scrollbar. Three short tabs
		// wrap on a narrow screen instead of scrolling.
		<div role="tablist" aria-label="View" className="flex flex-wrap gap-1 border-b border-gray-700">
			{VIEWS.map((entry) => {
				const Icon = entry.icon
				const active = entry.id === view
				return (
					<button
						key={entry.id}
						type="button"
						role="tab"
						aria-selected={active}
						onClick={() => onChange(entry.id)}
						className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition ${
							active
								? "border-brand text-brand"
								: "border-transparent text-gray-400 hover:border-gray-500 hover:text-gray-100"
						}`}
					>
						<Icon className="h-4 w-4" />
						{entry.label}
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

function ControlBand({ events, event, index, now, showPast, onTogglePast, onSelect }: {
	events: RaceEvent[]
	event: RaceEvent | null
	index: number
	now: Date
	showPast: boolean
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
		<div className="border-y border-gray-700/60 bg-gray-950/40 shadow-[0_8px_24px_rgba(0,0,0,0.22)] app-shell:sticky app-shell:top-0 app-shell:z-30 app-shell:bg-gray-950">
			<div className="mx-auto grid w-full max-w-[96rem] grid-cols-1 items-stretch gap-2 px-3 py-2 md:grid-cols-[1fr_auto_1fr] md:items-center md:px-2">
				<div className="flex w-full justify-self-start md:w-auto">
					<button type="button" className={`${controlButtonClass} w-full sm:w-auto`} onClick={onTogglePast}>
						<History className="h-4 w-4 text-brand" />
						{showPast ? "Hide past events" : "Show past events"}
					</button>
				</div>
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
						className={`${categorySelectClass} min-w-0 max-w-[22rem] flex-1`}
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
				<div />
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
function EventHeader({ event, now, keyDates }: {
	event: RaceEvent
	now: Date
	keyDates: ReturnType<typeof milestones>
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
						<ol
							className="grid gap-y-2"
							style={{ gridTemplateColumns: `repeat(${keyDates.length}, minmax(0, 1fr))` }}
							aria-label="Key dates"
						>
							{keyDates.map((milestone, position) => {
								const done = nextIndex === -1 || position < nextIndex
								const isNext = position === nextIndex
								return (
									<li key={milestone.label} className="relative min-w-0 pr-2" aria-current={isNext ? "step" : undefined}>
										{/* The line runs from this dot to the next one. */}
										{position < keyDates.length - 1 && (
											<span
												aria-hidden="true"
												className={`absolute left-1.5 right-0 top-[5px] h-0.5 ${done ? "bg-brand/60" : "bg-gray-700"}`}
											/>
										)}
										<span
											aria-hidden="true"
											className={`relative block h-3 w-3 rounded-full border-2 ${
												isNext
													? "border-brand bg-gray-900 ring-4 ring-brand/20"
													: done
														? "border-brand bg-brand"
														: "border-gray-600 bg-gray-800"
											}`}
										/>
										<div className={`mt-1.5 text-[11px] leading-tight ${isNext ? "text-brand" : "text-gray-400"}`}>
											{milestone.label}
										</div>
										<div className={`text-xs font-semibold ${done && !isNext ? "text-gray-400" : "text-gray-100"}`}>
											{formatDate(milestone.date)}
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
		<section className="rounded-xl border border-gray-700 bg-gray-800/60 p-3" aria-labelledby="pvp-new-cards">
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
