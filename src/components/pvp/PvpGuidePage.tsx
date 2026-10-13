/**
 * The PvP tab (route: /app/pvp): one Champions Meeting or League of Heroes
 * event at a time, with its guide.
 *
 * The event comes from `?event=cm-12` (utils/pvpEvent.ts); with none, the page
 * opens on the event running now, else the next one (`defaultPvpEvent`).
 * Previous / Next and the dropdown write the parameter, so every view is a
 * link someone can paste.
 *
 * The events, banners and constants are already in the calculator payload;
 * only the guide is fetched, on demand (hooks/usePvpGuide.ts). The page reads
 * the event header (dates, course, key dates) from the payload, so it renders
 * even for an event with no guide.
 *
 * Inside the /app loading gate, so it is never prerendered and may read the
 * clock freely. Its head tags come from AppRouteMeta.
 */

import { useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { CalendarClock, ChevronLeft, ChevronRight, Clock3, History, Loader2, Swords } from "lucide-react"
import { useCalculatorData } from "../../services/CalculatorContext"
import { useSiteContent } from "../../services/SiteContentContext"
import { MarkdownContent } from "../info/MarkdownContent"
import PredictedBadge from "../PredictedBadge"
import { CourseDetails } from "../timeline/CourseDetails"
import {
	categorySelectClass,
	controlButtonClass,
	getCountdownLabel,
	paginationButtonClass,
} from "../timeline/timelineShared"
import { usePvpGuide } from "../../hooks/usePvpGuide"
import { formatDate } from "../../utils/dateFormat"
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
import type { RaceEvent } from "../../types"

/** The heading while the page's admin row has not loaded. Mirrors the seed's title. */
const FALLBACK_TITLE = "PvP Guides"

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

	// Past events stay out of the dropdown unless asked for, or unless the
	// event on screen is itself past (a link to an old guide).
	const [showPastChoice, setShowPastChoice] = useState(false)
	const showPast = showPastChoice || (event !== null && hasEnded(event, now))
	const choices = events.filter((candidate) => showPast || !hasEnded(candidate, now) || candidate === event)
	const index = event ? choices.indexOf(event) : -1

	const select = (next: RaceEvent | undefined) => {
		if (!next) return
		setSearchParams(
			(params) => {
				params.set(PVP_EVENT_PARAM, formatPvpEvent(refForRaceEvent(next)))
				return params
			},
			{ replace: false }
		)
	}

	const guideState = usePvpGuide(event ? refForRaceEvent(event) : null)

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

			<div className="mx-auto mt-4 flex w-[calc(100%-1rem)] max-w-[96rem] flex-col gap-4 sm:w-[calc(100%-2rem)]">
				<header>
					<h1 className="flex items-center gap-2 text-xl font-bold text-brand">
						<Swords className="h-5 w-5 shrink-0" />
						{page?.title ?? FALLBACK_TITLE}
					</h1>
					{page && (
						<div className="text-sm">
							<MarkdownContent markdown={page.body} paragraphClassName="mt-1 leading-relaxed text-gray-300" />
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
							scenario={guideState.status === "ready" ? guideState.guide.scenario : null}
							keyDates={milestones(event, calculationConstants)}
						/>

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
							event={event}
							previous={previousPvpEvent(events, event)}
							umaBanners={umaBannerData}
							supportBanners={supportBannerData}
						/>
					</>
				)}
			</div>
		</div>
	)
}

/** "CM 12: Aquarius Cup" style option text, with a star on events that have a guide. */
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
	return (
		<div className="border-y border-gray-700/60 bg-gray-950/40 shadow-[0_8px_24px_rgba(0,0,0,0.22)] app-shell:sticky app-shell:top-0 app-shell:z-30 app-shell:bg-gray-950">
			<div className="mx-auto grid w-full max-w-[96rem] grid-cols-1 items-stretch gap-3 px-3 py-3 md:grid-cols-[1fr_auto_1fr] md:items-center md:px-2">
				<div className="flex w-full justify-self-start md:w-auto">
					<button type="button" className={`${controlButtonClass} w-full sm:w-auto`} onClick={onTogglePast}>
						<History className="h-4 w-4 text-brand" />
						{showPast ? "Hide past events" : "Show past events"}
					</button>
				</div>
				<div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
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
						className={`${categorySelectClass} max-w-[18rem]`}
						value={event ? formatPvpEvent(refForRaceEvent(event)) : ""}
						onChange={(change) =>
							onSelect(events.find((candidate) => formatPvpEvent(refForRaceEvent(candidate)) === change.target.value))
						}
					>
						{upcoming.length > 0 && (
							<optgroup label="Upcoming">
								{upcoming.map((candidate) => (
									<option key={formatPvpEvent(refForRaceEvent(candidate))} value={formatPvpEvent(refForRaceEvent(candidate))}>
										{optionLabel(candidate)}
									</option>
								))}
							</optgroup>
						)}
						{past.length > 0 && (
							<optgroup label="Past">
								{past.map((candidate) => (
									<option key={formatPvpEvent(refForRaceEvent(candidate))} value={formatPvpEvent(refForRaceEvent(candidate))}>
										{optionLabel(candidate)}
									</option>
								))}
							</optgroup>
						)}
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

function EventHeader({ event, now, scenario, keyDates }: {
	event: RaceEvent
	now: Date
	scenario: { name: string; image: string | null } | null
	keyDates: ReturnType<typeof milestones>
}) {
	return (
		<section className="card-panel flex flex-col gap-3 rounded-xl p-3 sm:p-4" aria-labelledby="pvp-event-name">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<h2 id="pvp-event-name" className="text-xl font-semibold text-gray-100 sm:text-2xl">
							{event.name}
						</h2>
						{event.is_predicted && <PredictedBadge />}
					</div>
					<p className="mt-0.5 text-sm text-gray-400">
						{formatDate(event.start_date)} through {formatDate(event.end_date)}
						{scenario && <> · {scenario.name}</>}
					</p>
				</div>
				<div className="flex w-fit items-center gap-2 rounded-full border border-gray-600 bg-gray-700 px-3 py-1 text-sm font-semibold text-gray-100">
					<span>{getCountdownLabel(event.start_date, event.end_date, now)}</span>
					<Clock3 className="h-4 w-4 text-brand" />
				</div>
			</div>

			<CourseDetails event={event} />

			{keyDates.length > 0 && (
				<div>
					<div className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand">
						<CalendarClock className="h-4 w-4" />
						<span>Key dates</span>
						{event.is_predicted && <span className="font-normal text-gray-400">(estimated)</span>}
					</div>
					<ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
						{keyDates.map((milestone) => (
							<li key={milestone.label} className="rounded-lg border border-gray-600/80 bg-gray-700/70 px-2 py-1.5">
								<div className="text-xs font-medium uppercase tracking-wide text-gray-400">{milestone.label}</div>
								<div className="mt-0.5 text-sm font-semibold text-gray-100">{formatDate(milestone.date)}</div>
							</li>
						))}
					</ol>
				</div>
			)}
		</section>
	)
}

/** Cards whose first global banner fell between the previous PvP event and this one. */
function NewCardsSection({ event, previous, umaBanners, supportBanners }: {
	event: RaceEvent
	previous: RaceEvent | null
	umaBanners: Parameters<typeof newCardsBetween>[2]
	supportBanners: Parameters<typeof newCardsBetween>[3]
}) {
	const cards = useMemo(
		() => (previous ? newCardsBetween(previous.start_date, event.start_date, umaBanners, supportBanners) : null),
		[previous, event, umaBanners, supportBanners]
	)
	if (!previous || !cards || cards.umas.length + cards.supports.length === 0) return null
	return (
		<section className="rounded-xl border border-gray-700 bg-gray-800/60 p-3 sm:p-4" aria-labelledby="pvp-new-cards">
			<h3 id="pvp-new-cards" className="text-base font-semibold text-gray-100">
				New since{" "}
				<Link to={pvpEventHref(refForRaceEvent(previous))} className="text-brand transition hover:text-brand/75">
					{previous.name}
				</Link>
			</h3>
			{cards.umas.length > 0 && (
				<div className="mt-2 flex flex-wrap gap-2">
					{cards.umas.map((uma) => (
						<UmaTile key={uma.id} uma={uma} stars={0} role="" note={uma.purpose ?? ""} />
					))}
				</div>
			)}
			{cards.supports.length > 0 && (
				<div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-8">
					{cards.supports.map((card) => (
						<SupportTile key={card.id} card={{ ...card, card_type: null, rarity: card.rarity ?? null }} note="" />
					))}
				</div>
			)}
		</section>
	)
}
