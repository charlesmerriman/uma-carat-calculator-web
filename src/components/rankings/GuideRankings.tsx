/**
 * The Rankings page's Guides tab (`?view=guides`, the default): how often
 * the PvP guides use each support card and uma. The source Google Sheet's
 * "Number of Times Each Card Appears in the PvP Recommendations" table with
 * its filters one to one (Henry, 2026-10-27): card type, scenario, strategy
 * and "Include" (CM, LoH, deck tiers), a card search, an overall ranking and
 * one per card type. Plus our event window (every guide, or the next 3 / 5 /
 * 10 events from a picked one).
 *
 * THE REDESIGN (notes/rankings-redesign-plan.md, step 1; mocks 03 to 06 and
 * 19 in notes/rankings-redesign/mocks/), top to bottom: the band (what is
 * counted, three figures), the filter pills with their token line, the top
 * three, then ONE list with a lens (Overall, each card type, Umas) in place
 * of nine tables, beside a rail (search, the QC note, guides with no
 * scenario). The lens is remembered on the device with the pinned window's
 * (rankingsPinStore `choices`).
 *
 * Counting is utils/guideRankings.ts, which has the rules. This draws them.
 */

import { useCallback, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Loader2, Search } from "lucide-react"
import type { RaceEvent } from "../../types"
import type { PvpStyle } from "../../types/pvpGuide"
import type { GuideRankingsPayload, RankingTier } from "../../types/guideRankings"
import type { CatalogueSupportCard, CatalogueUma } from "../../types/pvpTeam"
import { useCalculatorData } from "../../services/CalculatorContext"
import { chooseRankings, useRankingsChoices, type GuideLens } from "../../services/rankingsPinStore"
import { useGuideRankings } from "../../hooks/useGuideRankings"
import { usePvpCatalogue, type PvpCatalogueIndex } from "../../hooks/usePvpCatalogue"
import { useOshiIds } from "../../hooks/useOshiIds"
import { FramedUma } from "../FramedUma"
import { STYLE_LABELS, defaultPvpEvent, raceEventsInOrder } from "../../utils/pvpGuide"
import { pvpEventHref, refForRaceEvent, sameEvent, shortEventName, type PvpEventKind } from "../../utils/pvpEvent"
import { CARD_TYPE_LABELS } from "../../utils/cardTypes"
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
	usageByEvent,
	type CardRank,
	type EventWindow,
	type GuideFilters,
	type RankingAppearance,
	type UmaRank,
} from "../../utils/guideRankings"
import { useReportUpdated } from "./rankingsUpdated"
import { CardArt } from "./kit/CardArt"
import { CardTypeChip } from "./kit/CardTypeChip"
import { FilterPill, FilterToolbar, TickOptions, Tokens, type FilterToken } from "./kit/FilterToolbar"
import { tickSummary } from "./kit/tickSummary"
import { Lens, type LensOption } from "./kit/Lens"
import { Podium, type PodiumEntry } from "./kit/Podium"
import { RankRow } from "./kit/RankRow"
import { RankedList } from "./kit/RankedList"
import { Sparkline } from "./kit/Sparkline"
import { StatBand } from "./kit/StatBand"
import { Bar } from "./kit/Bar"

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
const CARD_TYPE_IDS = ["speed", "stamina", "power", "guts", "wit", "friend", "group"] as const
/** The sparkline's span: the last ten events with a guide in the window. */
const USAGE_EVENTS = 10
/** How many search results show at once. */
const SEARCH_RESULTS = 5

const PANEL_NOTE = "rounded-xl border border-edge bg-gray-800/60 p-4 text-sm text-gray-300"
const ASIDE = "rounded-[10px] border border-dashed border-gray-600 bg-gray-900/70 px-3 py-2.5 text-[11px] leading-normal text-gray-400"

const plural = (count: number, one: string, many = `${one}s`) => `${count.toLocaleString()} ${count === 1 ? one : many}`

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
	useReportUpdated(payload.generated_at)
	const oshiIds = useOshiIds()
	const defaults = useMemo(() => allFilters(payload, STYLES, CARD_TYPE_IDS), [payload])
	const [filters, setFilters] = useState<GuideFilters>(defaults)
	const guided = useMemo(() => eventsWithGuide(events, payload), [events, payload])
	// One clock reading per mount: the window's default start.
	const [now] = useState(() => new Date())
	const [windowSize, setWindowSize] = useState<number | null>(null)
	const [from, setFrom] = useState<RaceEvent | null>(() => defaultPvpEvent(guided, now))
	const [query, setQuery] = useState("")
	const lens: GuideLens = useRankingsChoices().guides?.lens ?? "overall"
	const setLens = (next: GuideLens) => chooseRankings("guides", { lens: next })

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
	const countedEvents = useMemo(() => guides.map((counted) => counted.event), [guides])
	const scenarioCount = new Set(guides.map((counted) => counted.guide.scenario).filter((id) => id !== NO_SCENARIO)).size
	const menuCounts = useMemo(() => countOptions(payload), [payload])

	const toggle = <K extends keyof GuideFilters>(key: K, value: GuideFilters[K] extends ReadonlySet<infer V> ? V : never) => {
		const next = new Set(filters[key] as ReadonlySet<typeof value>)
		if (next.has(value)) next.delete(value)
		else next.add(value)
		setFilters({ ...filters, [key]: next })
	}
	const resetKeys = (...keys: Array<keyof GuideFilters>) => {
		const next = { ...filters }
		for (const key of keys) (next as Record<string, unknown>)[key] = defaults[key]
		setFilters(next)
	}

	const scenarioOptions = [
		...payload.scenarios.map((scenario) => ({ id: scenario.id as number | null, label: scenario.name })),
		...(hasUnsetScenario(payload) ? [{ id: NO_SCENARIO, label: "Not set" }] : []),
	]
	const includeTotal = KINDS.length + RANKING_TIERS.length
	const includeTicked = filters.kinds.size + filters.tiers.size

	// THE TOKEN LINE: one token per filter that differs from everything on.
	const tokens: FilterToken[] = []
	if (windowSize !== null && from !== null) {
		tokens.push({ key: "events", label: `Next ${windowSize} from ${shortEventName(from)}`, removeLabel: "Count every guide", onRemove: () => setWindowSize(null) })
	}
	const tickToken = (key: string, name: string, labels: string[], total: number, reset: () => void) => {
		if (labels.length >= total) return
		const label = labels.length === 0 ? `No ${name.toLowerCase()}` : labels.length <= 3 ? labels.join(", ") : `${name} ${labels.length} of ${total}`
		tokens.push({ key, label, removeLabel: `Remove the ${name} filter`, onRemove: reset })
	}
	tickToken(
		"include",
		"Include",
		[...KINDS.filter((kind) => filters.kinds.has(kind.id)).map((kind) => kind.label), ...RANKING_TIERS.filter((tier) => filters.tiers.has(tier)).map((tier) => TIER_LABELS[tier])],
		includeTotal,
		() => resetKeys("kinds", "tiers")
	)
	tickToken("strategy", "Strategy", STYLES.filter((style) => filters.styles.has(style)).map((style) => STYLE_LABELS[style]), STYLES.length, () => resetKeys("styles"))
	tickToken("scenario", "Scenario", scenarioOptions.filter((option) => filters.scenarios.has(option.id)).map((option) => option.label), scenarioOptions.length, () => resetKeys("scenarios"))
	tickToken("cardTypes", "Card type", CARD_TYPE_IDS.filter((type) => filters.cardTypes.has(type)).map((type) => CARD_TYPE_LABELS[type]), CARD_TYPE_IDS.length, () => resetKeys("cardTypes"))

	// THE LENS: Overall, a card type, or Umas; places are within what the lens shows.
	const lensOptions: LensOption<GuideLens>[] = [
		{ id: "overall", label: "Overall", count: cards.length },
		...CARD_TYPE_IDS.map((type) => ({ id: type as GuideLens, label: CARD_TYPE_LABELS[type], count: cards.filter((rank) => typeOf(rank.card) === type).length })),
		{ id: "umas", label: "Umas", count: umas.length },
	]
	const lensCards = lens === "overall" ? cards : lens === "umas" ? [] : cards.filter((rank) => typeOf(rank.card) === lens)
	const leader = lens === "umas" ? (umas[0]?.picks ?? 0) : (lensCards[0]?.decks ?? 0)
	const fillOf = (count: number) => (leader > 0 ? count / leader : 0)

	const cardRow = (rank: CardRank, index: number) => {
		const card = cardsById.get(rank.card)
		return (
			<RankRow
				place={index + 1}
				art={<CardArt card={card} />}
				name={card?.name ?? "Unknown card"}
				sub={
					<>
						<CardTypeChip type={card?.card_type} />
						{rank.borrows > 0 && <span>{rank.borrows} borrowed</span>}
					</>
				}
				fill={fillOf(rank.decks)}
				count={plural(rank.decks, "deck")}
				share={formatShare(rank.share)}
				detail={<RowDetail appearances={rank.appearances} alternatives={rank.alternatives} events={countedEvents} isCard />}
			/>
		)
	}
	const umaRow = (rank: UmaRank, index: number) => {
		const uma = umasById.get(rank.uma)
		return (
			<RankRow
				place={index + 1}
				art={<FramedUma src={uma?.portrait ?? uma?.image} oshi={uma ? oshiIds.has(uma.id) : false} className="w-12" />}
				name={uma?.name ?? "Unknown uma"}
				fill={fillOf(rank.picks)}
				count={plural(rank.picks, "pick")}
				share={formatShare(rank.share)}
				detail={<RowDetail appearances={rank.appearances} alternatives={0} events={countedEvents} isCard={false} />}
			/>
		)
	}
	const podium: PodiumEntry[] =
		lens === "umas"
			? umas.slice(0, 3).map((rank) => {
					const uma = umasById.get(rank.uma)
					return {
						key: rank.uma,
						art: <FramedUma src={uma?.portrait ?? uma?.image} oshi={uma ? oshiIds.has(uma.id) : false} className="w-16" />,
						name: uma?.name ?? "Unknown uma",
						count: plural(rank.picks, "pick"),
						share: formatShare(rank.share),
						fill: fillOf(rank.picks),
					}
				})
			: lensCards.slice(0, 3).map((rank) => {
					const card = cardsById.get(rank.card)
					return {
						key: rank.card,
						art: <CardArt card={card} className="w-14" />,
						name: card?.name ?? "Unknown card",
						count: plural(rank.decks, "deck"),
						share: formatShare(rank.share),
						fill: fillOf(rank.decks),
					}
				})
	const lensLabel = lensOptions.find((option) => option.id === lens)?.label ?? "Overall"

	// In event order, for the "no scenario yet" note.
	const unset = events.filter((event) =>
		payload.guides.some((guide) => guide.scenario === NO_SCENARIO && sameEvent({ kind: guide.kind, id: guide.event }, refForRaceEvent(event)))
	)

	return (
		<div className="flex flex-col gap-3.5">
			<StatBand
				title="What the guides recommend"
				stats={[
					{ label: "Guides counted", value: guides.length.toLocaleString() },
					{ label: "Decks", value: deckCount.toLocaleString() },
					{ label: scenarioCount === 1 ? "Scenario" : "Scenarios", value: scenarioCount.toLocaleString() },
				]}
			>
				Every card and uma the published guides put in a deck, counted. The source sheet's filters, one to one, plus our event window.
			</StatBand>

			<div className="flex flex-col gap-2">
				<div className="flex flex-wrap items-center gap-1.5">
					<FilterToolbar>
						<FilterPill label="Events" state={windowSize === null ? "All guides" : `Next ${windowSize}`} changed={windowSize !== null} title="Which guides">
							<Lens
								label="How many events"
								className="mx-1.5 mb-1.5"
								options={[{ id: 0, label: "All" }, ...WINDOW_SIZES.map((size) => ({ id: size, label: `Next ${size}` }))]}
								value={windowSize ?? 0}
								onChange={(size) => setWindowSize(size === 0 || from === null ? null : size)}
							/>
							{from !== null && (
								<label className="flex items-center gap-2 px-1.5 py-1 text-xs text-gray-300">
									Starting from
									<select
										value={guided.indexOf(from)}
										onChange={(event) => setFrom(guided[Number(event.target.value)] ?? null)}
										className="min-w-0 flex-1 rounded-md border border-gray-600 bg-gray-900 px-2 py-1 text-xs text-gray-100 focus:border-brand focus:outline-none"
									>
										{guided.map((option, index) => (
											<option key={`${option.event_type}-${option.id}`} value={index}>
												{option.name}
											</option>
										))}
									</select>
								</label>
							)}
						</FilterPill>
						<FilterPill
							label="Include"
							state={tickSummary(includeTicked, includeTotal, "Everything")}
							changed={includeTicked < includeTotal}
							title="Events and decks"
							onAll={() => resetKeys("kinds", "tiers")}
						>
							<TickOptions
								options={KINDS.map((kind) => ({ ...kind, count: plural(menuCounts.kinds.get(kind.id) ?? 0, "guide") }))}
								selected={filters.kinds}
								onToggle={(id) => toggle("kinds", id)}
							/>
							<hr className="mx-1.5 my-0.5 border-gray-600" />
							<TickOptions
								options={RANKING_TIERS.map((id) => ({ id, label: TIER_LABELS[id], count: plural(menuCounts.tiers.get(id) ?? 0, "deck") }))}
								selected={filters.tiers}
								onToggle={(id) => toggle("tiers", id)}
							/>
						</FilterPill>
						<FilterPill
							label="Strategy"
							state={tickSummary(filters.styles.size, STYLES.length)}
							changed={filters.styles.size < STYLES.length}
							title="Running style"
							onAll={() => resetKeys("styles")}
						>
							<TickOptions
								options={STYLES.map((id) => ({ id, label: STYLE_LABELS[id], count: menuCounts.styles.get(id) ?? 0 }))}
								selected={filters.styles}
								onToggle={(id) => toggle("styles", id)}
							/>
						</FilterPill>
						<FilterPill
							label="Scenario"
							state={tickSummary(filters.scenarios.size, scenarioOptions.length)}
							changed={filters.scenarios.size < scenarioOptions.length}
							title="Training scenario"
							onAll={() => resetKeys("scenarios")}
						>
							<TickOptions
								options={scenarioOptions.map((option) => ({ ...option, count: menuCounts.scenarios.get(option.id) ?? 0 }))}
								selected={filters.scenarios}
								onToggle={(id) => toggle("scenarios", id)}
							/>
						</FilterPill>
						<FilterPill
							label="Card type"
							state={tickSummary(filters.cardTypes.size, CARD_TYPE_IDS.length, `All ${CARD_TYPE_IDS.length}`)}
							changed={filters.cardTypes.size < CARD_TYPE_IDS.length}
							title="Card type"
							onAll={() => resetKeys("cardTypes")}
						>
							<TickOptions
								options={CARD_TYPE_IDS.map((id) => ({ id: id as string, label: CARD_TYPE_LABELS[id] }))}
								selected={filters.cardTypes}
								onToggle={(id) => toggle("cardTypes", id)}
							/>
						</FilterPill>
					</FilterToolbar>
					<label className="relative w-full @min-[40rem]:ml-auto @min-[40rem]:w-auto @min-[40rem]:min-w-[12rem]">
						<Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" aria-hidden="true" />
						<input
							type="search"
							aria-label="Find a card or uma"
							placeholder="Find a card or uma"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							className="w-full rounded-full border border-gray-600 bg-gray-900/70 py-[5px] pl-8 pr-3 text-xs text-gray-100 placeholder-gray-400 focus:border-brand focus:outline-none"
						/>
					</label>
				</div>
				<Tokens
					summary={
						guides.length === 0
							? "No guide fits these filters."
							: `Showing ${plural(guides.length, "guide")} and ${plural(deckCount, "deck")}${tokens.length > 0 ? " for" : "."}`
					}
					tokens={tokens}
					onReset={() => {
						setFilters(defaults)
						setWindowSize(null)
					}}
				/>
			</div>

			<Podium entries={podium} kicker={lens === "umas" ? "" : lens === "overall" ? "overall" : lensLabel} label={`Top three, ${lensLabel}`} />

			<div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
				<Lens label="Which list" options={lensOptions} value={lens} onChange={setLens} />
				<span className="text-[11px] text-gray-400">
					{lens === "umas"
						? "Times a guide recommends her for a strategy. Card type and deck filters don't apply."
						: "Decks a card is in, the borrowed card included. Alternatives don't count."}
				</span>
			</div>

			<div className="grid items-start gap-3 @min-[56.25rem]:grid-cols-[minmax(0,1fr)_17rem]">
				{lens === "umas" ? (
					<RankedList key="umas" label="Umas" items={umas} itemKey={(rank) => rank.uma} render={umaRow} empty="No uma fits these filters." />
				) : (
					<RankedList
						key={lens}
						label={lensLabel}
						items={lensCards}
						itemKey={(rank) => rank.card}
						render={cardRow}
						empty={lens === "overall" ? "No card fits these filters." : `No ${lensLabel} card fits these filters.`}
					/>
				)}
				<div className="flex min-w-0 flex-col gap-2.5">
					<SearchPanel query={query} cards={cards} umas={umas} cardsById={cardsById} umasById={umasById} oshiIds={oshiIds} />
					<aside className={ASIDE}>
						<b className="font-semibold text-gray-300">Read the counts loosely.</b> A lot of scenarios still haven't been QC'd, so
						some cards may be overrepresented. A score is how often a card or uma was used and found to be effective. It doesn't
						show how much stronger one is than another.
					</aside>
					{unset.length > 0 && (
						<aside className={ASIDE}>
							<b className="font-semibold text-gray-300">
								{unset.length === 1 ? "1 guide has no scenario yet" : `${unset.length} guides have no scenario yet`}
							</b>{" "}
							({unset.map(shortEventName).join(", ")}). {unset.length === 1 ? "It counts" : "They count"} only under "Not set".
						</aside>
					)}
				</div>
			</div>
		</div>
	)
}

/**
 * An opened row, drawn: by event as chips linking to each guide, by strategy
 * as a stacked bar with a legend, a card's decks by tier as figures, and its
 * use across the last ten counted events as a sparkline (mock
 * 04-guides-row-open.png).
 */
function RowDetail({ appearances, alternatives, events, isCard }: {
	appearances: RankingAppearance[]
	alternatives: number
	events: RaceEvent[]
	isCard: boolean
}) {
	const byEvent = breakdown(appearances, (appearance) => appearance.event)
	const byStyle = breakdown(appearances, (appearance) => appearance.style).sort(([a], [b]) => STYLES.indexOf(a) - STYLES.indexOf(b))
	const byTier = isCard
		? breakdown(appearances, (appearance) => appearance.tier ?? "other").sort(([a], [b]) => RANKING_TIERS.indexOf(a) - RANKING_TIERS.indexOf(b))
		: []
	const usage = usageByEvent(appearances, events, USAGE_EVENTS)
	const heading = "text-[10px] uppercase tracking-wider text-gray-400"
	return (
		<div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-x-[18px] gap-y-2.5">
			<div className="flex min-w-0 flex-col gap-1.5">
				<span className={heading}>By event</span>
				<span className="flex flex-wrap gap-1">
					{byEvent.map(([event, count]) => (
						<Link
							key={`${event.event_type}-${event.id}`}
							to={pvpEventHref(refForRaceEvent(event))}
							className="rounded-full border border-brand/35 px-2 py-0.5 text-[11px] tabular-nums text-brand transition hover:bg-brand/15"
						>
							{shortEventName(event)} {count}
						</Link>
					))}
				</span>
			</div>
			<div className="flex min-w-0 flex-col gap-1.5">
				<span className={heading}>By strategy</span>
				<Bar
					fill={1}
					parts={byStyle.map(([style, count]) => ({ key: style, value: count, color: `var(--color-style-${style})`, label: STYLE_LABELS[style] }))}
				/>
				<span className="flex flex-wrap gap-x-2.5 gap-y-1 text-[11px] tabular-nums text-gray-400" aria-hidden="true">
					{byStyle.map(([style, count]) => (
						<span key={style} className="inline-flex items-center gap-1">
							<i className="inline-block h-2 w-2 rounded-sm" style={{ background: `var(--color-style-${style})` }} />
							{STYLE_LABELS[style]} {count}
						</span>
					))}
				</span>
			</div>
			{isCard && (
				<div className="flex min-w-0 flex-col gap-1.5">
					<span className={heading}>By deck</span>
					<span className="flex flex-wrap gap-x-2.5 gap-y-1.5">
						{byTier.map(([tier, count]) => (
							<span key={tier} className="flex flex-col text-[10px] text-gray-400">
								<b className="text-xs font-semibold tabular-nums text-gray-100">{count}</b>
								{TIER_LABELS[tier]}
							</span>
						))}
						{alternatives > 0 && (
							<span className="flex flex-col text-[10px] text-gray-400">
								<b className="text-xs font-semibold tabular-nums text-gray-100">{alternatives}</b>
								as an alternative
							</span>
						)}
					</span>
				</div>
			)}
			{events.length >= 2 && (
				<div className="flex min-w-0 flex-col gap-1.5">
					<span className={heading}>Across the last {Math.min(USAGE_EVENTS, events.length)} events</span>
					<Sparkline points={usage} label={isCard ? "Decks per event, oldest first" : "Picks per event, oldest first"} />
				</div>
			)}
		</div>
	)
}

/**
 * The rail's search: any card or uma by name, with its place under the
 * current filters, so one outside the top ten (or the lens) can still be
 * found. Ranked ones first in rank order, then the rest by name. A
 * placeholder card is never a pick, so it never shows.
 */
function SearchPanel({ query, cards, umas, cardsById, umasById, oshiIds }: {
	query: string
	cards: CardRank[]
	umas: UmaRank[]
	cardsById: Map<number, CatalogueSupportCard>
	umasById: Map<number, CatalogueUma>
	oshiIds: ReadonlySet<number>
}) {
	const needle = query.trim().toLowerCase()
	const searching = needle.length >= 2
	const results = useMemo(() => {
		if (!searching) return []
		const cardPlaces = new Map(cards.map((rank, index) => [rank.card, { rank, place: index + 1 }]))
		const umaPlaces = new Map(umas.map((rank, index) => [rank.uma, { rank, place: index + 1 }]))
		const found = [
			...[...cardsById.values()]
				.filter((card) => !card.placeholder && card.name.toLowerCase().includes(needle))
				.map((card) => ({ kind: "card" as const, card, hit: cardPlaces.get(card.id) ?? null })),
			...[...umasById.values()]
				.filter((uma) => uma.name.toLowerCase().includes(needle))
				.map((uma) => ({ kind: "uma" as const, uma, hit: umaPlaces.get(uma.id) ?? null })),
		]
		const nameOf = (entry: (typeof found)[number]) => (entry.kind === "card" ? entry.card.name : entry.uma.name)
		return found
			.sort((a, b) => (a.hit?.place ?? Infinity) - (b.hit?.place ?? Infinity) || nameOf(a).localeCompare(nameOf(b)))
			.slice(0, SEARCH_RESULTS)
	}, [searching, needle, cards, umas, cardsById, umasById])

	return (
		<section aria-label="Search" className="card-panel flex flex-col gap-2.5 p-3">
			<h3 className="font-display text-[15px] font-bold text-brand">Search</h3>
			{!searching ? (
				<p className="text-xs text-gray-400">Type a card or uma's name above to see where it ranks under these filters, even outside the top ten.</p>
			) : results.length === 0 ? (
				<p className="text-xs text-gray-400">Nothing by that name.</p>
			) : (
				<ul className="flex flex-col gap-2.5">
					{results.map((entry) =>
						entry.kind === "card" ? (
							<li key={`card-${entry.card.id}`} className="flex items-center gap-2.5">
								<CardArt card={entry.card} />
								<span className="flex min-w-0 flex-col gap-0.5">
									<b className="truncate text-[13px] font-semibold text-gray-100">{entry.card.name}</b>
									<span className="text-[11px] tabular-nums text-gray-400">
										{entry.hit
											? `#${entry.hit.place} overall · ${plural(entry.hit.rank.decks, "deck")} · ${formatShare(entry.hit.rank.share)}`
											: "Not used with these filters"}
									</span>
									{entry.hit && entry.hit.rank.borrows > 0 && (
										<span className="text-[11px] tabular-nums text-gray-400">{entry.hit.rank.borrows} of them as the borrowed card</span>
									)}
								</span>
							</li>
						) : (
							<li key={`uma-${entry.uma.id}`} className="flex items-center gap-2.5">
								<FramedUma src={entry.uma.portrait ?? entry.uma.image} oshi={oshiIds.has(entry.uma.id)} className="w-10" />
								<span className="flex min-w-0 flex-col gap-0.5">
									<b className="truncate text-[13px] font-semibold text-gray-100">{entry.uma.name}</b>
									<span className="text-[11px] tabular-nums text-gray-400">
										{entry.hit
											? `#${entry.hit.place} of the umas · ${plural(entry.hit.rank.picks, "pick")} · ${formatShare(entry.hit.rank.share)}`
											: "Not recommended with these filters"}
									</span>
								</span>
							</li>
						)
					)}
				</ul>
			)}
		</section>
	)
}

/** The counts each filter menu shows beside its boxes, over every published guide. */
function countOptions(payload: GuideRankingsPayload) {
	const kinds = new Map<PvpEventKind, number>()
	const scenarios = new Map<number | null, number>()
	const tierDecks = new Map<RankingTier, Set<number>>()
	const styleDecks = new Map<PvpStyle, Set<number>>()
	for (const guide of payload.guides) {
		kinds.set(guide.kind, (kinds.get(guide.kind) ?? 0) + 1)
		scenarios.set(guide.scenario, (scenarios.get(guide.scenario) ?? 0) + 1)
		for (const row of guide.cards) {
			if (!tierDecks.has(row.tier)) tierDecks.set(row.tier, new Set())
			tierDecks.get(row.tier)!.add(row.deck)
			if (!styleDecks.has(row.style)) styleDecks.set(row.style, new Set())
			styleDecks.get(row.style)!.add(row.deck)
		}
	}
	const sizes = <K,>(map: Map<K, Set<number>>) => new Map([...map].map(([key, decks]) => [key, decks.size]))
	return { kinds, scenarios, tiers: sizes(tierDecks), styles: sizes(styleDecks) }
}
