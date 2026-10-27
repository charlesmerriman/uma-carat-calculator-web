/**
 * The Rankings page's Guide rankings tab (`?view=guides`, the default): how
 * often the PvP guides use each support card and uma. The source Google
 * Sheet's "Number of Times Each Card Appears in the PvP Recommendations"
 * table with its filters one to one (Henry, 2026-10-27): card type,
 * scenario, strategy and "Include" (CM, LoH, deck tiers), a card search, an
 * overall ranking, and one ranking per card type. Plus our event window
 * (every guide, or the next 3 / 5 / 10 events from a picked one).
 *
 * Counting is utils/guideRankings.ts, which has the rules. This draws them.
 */

import { useCallback, useMemo, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { Loader2, Search } from "lucide-react"
import type { RaceEvent } from "../../types"
import type { PvpStyle } from "../../types/pvpGuide"
import type { GuideRankingsPayload, RankingTier } from "../../types/guideRankings"
import type { CatalogueSupportCard } from "../../types/pvpTeam"
import { useCalculatorData } from "../../services/CalculatorContext"
import { useGuideRankings } from "../../hooks/useGuideRankings"
import { usePvpCatalogue, type PvpCatalogueIndex } from "../../hooks/usePvpCatalogue"
import { useOshiIds } from "../../hooks/useOshiIds"
import { FramedUma } from "../FramedUma"
import { STYLE_LABELS, defaultPvpEvent, raceEventsInOrder } from "../../utils/pvpGuide"
import { pvpEventHref, refForRaceEvent, shortEventName, type PvpEventKind } from "../../utils/pvpEvent"
import { formatDate } from "../../utils/dateFormat"
import { formatTimeAgo } from "../../utils/relativeDate"
import {
	NO_SCENARIO,
	RANKING_TIERS,
	WINDOW_SIZES,
	allFilters,
	breakdown,
	countedDecks,
	countedGuides,
	eventsWithGuide,
	formatShare,
	hasUnsetScenario,
	rankCards,
	rankUmas,
	type CardRank,
	type EventWindow,
	type GuideFilters,
	type RankingAppearance,
	type UmaRank,
} from "../../utils/guideRankings"
import { RankList, type RankListRow } from "./RankList"

const STYLES: PvpStyle[] = ["runaway", "front", "pace", "late", "end"]
const KINDS: Array<{ id: PvpEventKind; label: string }> = [
	{ id: "cm", label: "Champions Meeting" },
	{ id: "loh", label: "League of Heroes" },
]
const TIER_LABELS: Record<RankingTier, string> = {
	beginner: "Beginner",
	standard: "Standard",
	whale: "Whale",
	honorable: "Honorable Mentions",
	other: "Other decks",
}
// "Friend" as on the rest of the site (the sheet says "Pal").
const CARD_TYPES: Array<{ id: string; label: string }> = [
	{ id: "speed", label: "Speed" },
	{ id: "stamina", label: "Stamina" },
	{ id: "power", label: "Power" },
	{ id: "guts", label: "Guts" },
	{ id: "wit", label: "Wit" },
	{ id: "friend", label: "Friend" },
	{ id: "group", label: "Group" },
]
const CARD_TYPE_IDS = CARD_TYPES.map((type) => type.id)

/** How many card search results show at once. */
const SEARCH_RESULTS = 6

const SEGMENTS = "flex flex-wrap gap-0.5 rounded-lg bg-gray-900/70 p-0.5"
const segment = (on: boolean) =>
	`rounded-md px-2.5 py-0.5 text-xs font-medium transition ${on ? "bg-gray-700 text-brand shadow-sm" : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"}`
const chip = (on: boolean) =>
	`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${on ? "border-brand bg-brand/15 text-brand" : "border-gray-600 text-gray-400 hover:border-gray-500"}`

const PANEL_NOTE = "rounded-xl border border-edge bg-gray-800/60 p-4 text-sm text-gray-300"

export function GuideRankings() {
	const rankings = useGuideRankings()
	const catalogue = usePvpCatalogue()
	const { championsMeetingData, leagueOfHeroesData } = useCalculatorData()
	const events = useMemo(() => raceEventsInOrder(championsMeetingData, leagueOfHeroesData), [championsMeetingData, leagueOfHeroesData])

	if (rankings.status === "refused") return <p className={PANEL_NOTE}>Rankings are open to supporters first.</p>
	if (rankings.status === "error" || catalogue.status === "error") {
		return <p className={PANEL_NOTE}>The rankings didn't load. Reload the page to try again.</p>
	}
	if (rankings.status !== "ready" || catalogue.status !== "ready") {
		return (
			<div className="flex items-center gap-2 text-sm text-gray-400" role="status">
				<Loader2 className="h-4 w-4 animate-spin" />
				Counting the guides...
			</div>
		)
	}
	// Keyed by the build, so a newer payload starts from fresh filters (its scenarios may differ).
	return <GuideRankingsBody key={rankings.payload.generated_at} payload={rankings.payload} catalogue={catalogue} events={events} />
}

function GuideRankingsBody({ payload, catalogue, events }: {
	payload: GuideRankingsPayload
	catalogue: PvpCatalogueIndex
	events: RaceEvent[]
}) {
	const oshiIds = useOshiIds()
	const [filters, setFilters] = useState<GuideFilters>(() => allFilters(payload, STYLES, CARD_TYPE_IDS))
	const guided = useMemo(() => eventsWithGuide(events, payload), [events, payload])
	// One clock reading per mount: the window's default start and the "Updated" line.
	const [now] = useState(() => new Date())
	const [windowSize, setWindowSize] = useState<number | null>(null)
	const [from, setFrom] = useState<RaceEvent | null>(() => defaultPvpEvent(guided, now))
	const [query, setQuery] = useState("")

	const eventWindow = useMemo<EventWindow>(
		() => (windowSize === null || from === null ? { size: null } : { size: windowSize, from }),
		[windowSize, from]
	)
	const { cardsById, umasById } = catalogue
	const typeOf = useCallback((card: number) => cardsById.get(card)?.card_type, [cardsById])

	const guides = useMemo(() => countedGuides(events, payload, filters, eventWindow), [events, payload, filters, eventWindow])
	const cards = useMemo(() => rankCards(guides, filters, typeOf), [guides, filters, typeOf])
	const umas = useMemo(() => rankUmas(guides, filters, (id) => umasById.has(id)), [guides, filters, umasById])
	const deckCount = useMemo(() => countedDecks(guides, filters), [guides, filters])

	const toggle = <K extends keyof GuideFilters>(key: K, value: GuideFilters[K] extends ReadonlySet<infer V> ? V : never) => {
		const next = new Set(filters[key] as ReadonlySet<typeof value>)
		if (next.has(value)) next.delete(value)
		else next.add(value)
		setFilters({ ...filters, [key]: next })
	}

	const scenarioOptions: Array<{ id: number | null; label: string }> = [
		...payload.scenarios.map((scenario) => ({ id: scenario.id, label: scenario.name })),
		...(hasUnsetScenario(payload) ? [{ id: NO_SCENARIO, label: "Not set" }] : []),
	]

	const cardRow = (rank: CardRank, place: number): RankListRow => {
		const card = cardsById.get(rank.card)
		const parts = [`${rank.decks} ${rank.decks === 1 ? "deck" : "decks"} · ${formatShare(rank.share)}`]
		if (rank.borrows > 0) parts.push(`${rank.borrows} borrowed`)
		if (rank.alternatives > 0) parts.push(`also an alternative in ${rank.alternatives}`)
		return {
			key: rank.card,
			place,
			name: card?.name ?? "Unknown card",
			art: <CardArt card={card} />,
			counts: parts.join(" · "),
			details: details(rank.appearances, true),
		}
	}
	const umaRow = (rank: UmaRank, place: number): RankListRow => {
		const uma = umasById.get(rank.uma)
		return {
			key: rank.uma,
			place,
			name: uma?.name ?? "Unknown uma",
			art: <FramedUma src={uma?.portrait ?? uma?.image} oshi={uma ? oshiIds.has(uma.id) : false} className="w-full" />,
			counts: `Recommended ${rank.picks} ${rank.picks === 1 ? "time" : "times"} · ${formatShare(rank.share)}`,
			details: details(rank.appearances, false),
		}
	}

	const searched = query.trim().length < 2 ? [] : searchCards(query, cardsById, cards)

	return (
		<div className="flex flex-col gap-4">
			<section className="card-panel flex flex-col gap-3 p-3 sm:p-4" aria-label="What to count">
				<FilterRow label="Events">
					<div className={SEGMENTS} role="group" aria-label="How many events">
						<button type="button" aria-pressed={windowSize === null} onClick={() => setWindowSize(null)} className={segment(windowSize === null)}>
							All guides
						</button>
						{WINDOW_SIZES.map((size) => (
							<button key={size} type="button" aria-pressed={windowSize === size} onClick={() => setWindowSize(size)} className={segment(windowSize === size)} disabled={from === null}>
								Next {size}
							</button>
						))}
					</div>
					{windowSize !== null && from !== null && (
						<label className="flex items-center gap-1.5 text-xs text-gray-400">
							from
							<select
								value={guided.indexOf(from)}
								onChange={(event) => setFrom(guided[Number(event.target.value)] ?? null)}
								className="rounded-md border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-gray-100 focus:border-brand focus:outline-none"
							>
								{guided.map((option, index) => (
									<option key={`${option.event_type}-${option.id}`} value={index}>
										{option.name}
									</option>
								))}
							</select>
						</label>
					)}
				</FilterRow>
				<FilterRow label="Include">
					<Ticks options={KINDS} selected={filters.kinds} onToggle={(id) => toggle("kinds", id)} />
					<Ticks options={RANKING_TIERS.map((id) => ({ id, label: TIER_LABELS[id] }))} selected={filters.tiers} onToggle={(id) => toggle("tiers", id)} />
				</FilterRow>
				<FilterRow label="Strategy">
					<Ticks options={STYLES.map((id) => ({ id, label: STYLE_LABELS[id] }))} selected={filters.styles} onToggle={(id) => toggle("styles", id)} />
				</FilterRow>
				<FilterRow label="Scenario">
					<Ticks options={scenarioOptions} selected={filters.scenarios} onToggle={(id) => toggle("scenarios", id)} />
				</FilterRow>
				<FilterRow label="Card type">
					<Ticks options={CARD_TYPES} selected={filters.cardTypes} onToggle={(id) => toggle("cardTypes", id)} />
				</FilterRow>
				<p className="text-xs text-gray-400">
					{guides.length === 0
						? "No guide fits these filters."
						: `Counting ${guides.length === 1 ? "1 guide" : `${guides.length} guides`} and ${deckCount} ${deckCount === 1 ? "deck" : "decks"}. `}
					<time dateTime={payload.generated_at} title={formatDate(payload.generated_at)}>
						Updated {formatTimeAgo(payload.generated_at, now.getTime())}.
					</time>
				</p>
			</section>

			<p className="text-xs leading-relaxed text-gray-400">
				A lot of scenarios still haven't been QC'd, so some cards may be overrepresented. The scores come from the
				number of times a card or uma was used and found to be effective. They don't show how much stronger one uma
				is than another.
			</p>

			<section className="card-panel flex flex-col gap-2 p-3 sm:p-4" aria-label="Card search">
				<div className="relative w-full sm:w-80">
					<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
					<input
						type="search"
						aria-label="Search for a card"
						placeholder="Search for a card..."
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						className="w-full rounded-lg border border-gray-600 bg-gray-800 py-2 pl-9 pr-3 text-sm text-gray-100 placeholder-gray-500 focus:border-brand focus:outline-none"
					/>
				</div>
				{query.trim().length >= 2 && (
					searched.length === 0 ? (
						<p className="text-sm text-gray-400">No card by that name.</p>
					) : (
						<ul className="flex flex-col gap-1">
							{searched.map(({ card, rank, place }) => (
								<li key={card.id} className="flex items-center gap-3 text-sm">
									<span className="w-8 shrink-0"><CardArt card={card} /></span>
									<span className="min-w-0 flex-1 truncate text-gray-100">{card.name}</span>
									<span className="shrink-0 text-xs tabular-nums text-gray-400">
										{rank ? `#${place} · ${rank.decks} ${rank.decks === 1 ? "deck" : "decks"} · ${formatShare(rank.share)}` : "Not used with these filters"}
									</span>
								</li>
							))}
						</ul>
					)
				)}
			</section>

			<div className="grid items-start gap-4 lg:grid-cols-2">
				<RankList
					title="Overall"
					hint="Decks a card is in, the borrowed card included. Alternatives don't count."
					rows={cards.map((rank, index) => cardRow(rank, index + 1))}
					empty="No card fits these filters."
				/>
				<RankList
					title="Umas"
					hint="Times a guide recommends her for a strategy. Card type and deck filters don't apply."
					rows={umas.map((rank, index) => umaRow(rank, index + 1))}
					empty="No uma fits these filters."
				/>
			</div>

			<div className="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
				{CARD_TYPES.filter((type) => filters.cardTypes.has(type.id)).map((type) => (
					<RankList
						key={type.id}
						title={type.label}
						start={10}
						rows={cards.filter((rank) => typeOf(rank.card) === type.id).map((rank, index) => cardRow(rank, index + 1))}
						empty={`No ${type.label} card fits these filters.`}
					/>
				))}
			</div>
		</div>
	)
}

/** By event (each linked to its guide), by style, and for a card by deck tier. */
function details(appearances: RankingAppearance[], isCard: boolean): RankListRow["details"] {
	const byEvent = breakdown(appearances, (appearance) => appearance.event)
	const byStyle = breakdown(appearances, (appearance) => appearance.style).sort(([a], [b]) => STYLES.indexOf(a) - STYLES.indexOf(b))
	const lines: RankListRow["details"] = [
		[
			"By event",
			<span className="flex flex-wrap gap-x-3">
				{byEvent.map(([event, count]) => (
					<Link key={`${event.event_type}-${event.id}`} to={pvpEventHref(refForRaceEvent(event))} className="text-brand transition hover:text-brand/75">
						{shortEventName(event)} {count}
					</Link>
				))}
			</span>,
		],
		["By strategy", byStyle.map(([style, count]) => `${STYLE_LABELS[style]} ${count}`).join(" · ")],
	]
	if (isCard) {
		const byTier = breakdown(appearances, (appearance) => appearance.tier ?? "other").sort(([a], [b]) => RANKING_TIERS.indexOf(a) - RANKING_TIERS.indexOf(b))
		lines.push(["By deck", byTier.map(([tier, count]) => `${TIER_LABELS[tier]} ${count}`).join(" · ")])
	}
	return lines
}

/**
 * Cards whose name holds the query, ranked ones first in rank order, then the
 * rest by name. A placeholder is never a pick, so it never shows.
 */
function searchCards(query: string, cardsById: Map<number, CatalogueSupportCard>, ranked: CardRank[]) {
	const needle = query.trim().toLowerCase()
	const places = new Map(ranked.map((rank, index) => [rank.card, { rank, place: index + 1 }]))
	return [...cardsById.values()]
		.filter((card) => !card.placeholder && card.name.toLowerCase().includes(needle))
		.map((card) => ({ card, rank: places.get(card.id)?.rank ?? null, place: places.get(card.id)?.place ?? null }))
		.sort((a, b) => (a.place ?? Infinity) - (b.place ?? Infinity) || a.card.name.localeCompare(b.card.name))
		.slice(0, SEARCH_RESULTS)
}

function CardArt({ card }: { card: CatalogueSupportCard | undefined }) {
	return card?.image ? (
		<img src={card.image} alt="" loading="lazy" decoding="async" className="block aspect-[3/4] w-full rounded object-cover" />
	) : (
		<span className="block aspect-[3/4] w-full rounded bg-gray-700" />
	)
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
			<span className="w-20 shrink-0 pt-0.5 text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</span>
			<div className="flex min-w-0 flex-wrap items-center gap-1.5">{children}</div>
		</div>
	)
}

/** A row of tick boxes, drawn as the site's chips: on is ticked. */
function Ticks<T extends string | number | null>({ options, selected, onToggle }: {
	options: Array<{ id: T; label: string }>
	selected: ReadonlySet<T>
	onToggle: (id: T) => void
}) {
	return (
		<>
			{options.map((option) => (
				<button key={String(option.id)} type="button" aria-pressed={selected.has(option.id)} onClick={() => onToggle(option.id)} className={chip(selected.has(option.id))}>
					{option.label}
				</button>
			))}
		</>
	)
}
