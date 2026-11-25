/**
 * The Rankings page's Guides tab (`?view=guides`, the default): how often
 * the PvP guides use each support card and uma. The source Google Sheet's
 * "Number of Times Each Card Appears in the PvP Recommendations" table with
 * its filters one to one (Henry, 2026-10-27): card type, scenario, strategy
 * and "Include" (CM, LoH, deck tiers), a card search, an overall ranking and
 * one per card type. Plus our event window (every guide, or the next 3 / 5 /
 * 10 events from a picked one).
 *
 * THE LAYOUT (notes/rankings-redesign-plan.md step 1, then the 2026-11-25
 * polish, notes/rankings-polish-plan.md, canvas shot 04), top to bottom: one
 * filter card (the search, the pills, the token line), the hero (first
 * place on her colours, with what is counted beside her), second and third,
 * then ONE list with a lens (Overall, each card type, Umas) in place of nine
 * tables, beside a rail (search results, the QC note, guides with no
 * scenario). The lens is remembered on the device with the pinned window's
 * (rankingsPinStore `choices`).
 *
 * Counting is utils/guideRankings.ts, which has the rules. This draws them.
 */

import { useCallback, useMemo, useState, type ReactNode } from "react"
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
import { useEncyclopediaHrefs } from "../../hooks/useEncyclopediaHrefs"
import { EncyclopediaName } from "../EncyclopediaLinks"

const RESULT_NAME = "truncate text-sm font-bold text-gray-100"
import { FramedUma } from "../FramedUma"
import { STYLE_LABELS, defaultPvpEvent, hasEnded, isRunning, raceEventsInOrder } from "../../utils/pvpGuide"
import { pvpEventHref, refForRaceEvent, sameEvent, shortEventName, type PvpEventKind } from "../../utils/pvpEvent"
import { CARD_TYPE_COLORS, CARD_TYPE_LABELS } from "../../utils/cardTypes"
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
import { movement } from "../../utils/rankingsMovement"
import { useReportUpdated } from "./rankingsUpdated"
import { CardArt } from "./kit/CardArt"
import { CardTypeChip } from "./kit/CardTypeChip"
import { FilterPill, FilterToolbar, GroupPill, Tokens, type FilterGroup, type FilterToken } from "./kit/FilterToolbar"
import { FilterSheet } from "./kit/FilterSheet"
import { tickSummary } from "./kit/tickSummary"
import { Lens, type LensOption } from "./kit/Lens"
import { PANEL } from "./kit/Panel"
import { Podium, type PodiumEntry } from "./kit/Podium"
import { RankHero, type HeroTop } from "./kit/RankHero"
import { RankRow } from "./kit/RankRow"
import { RankedList } from "./kit/RankedList"
import { Sparkline } from "./kit/Sparkline"
import { Bar } from "./kit/Bar"
import { Detail, DetailBlock } from "./kit/Detail"
import { StyleLegend } from "./kit/StyleLegend"
import { stylePart } from "./kit/stylePart"
import { hoverCardProps } from "../../utils/hoverCards"
import { nameMatches } from "../../utils/searchText"

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
/** How many search results show at once. */
const SEARCH_RESULTS = 5

const PANEL_NOTE = "rk-panel p-4 text-sm text-gray-300"
/** A note in the rail: the card surface, ruled off on the left in the page's colour (no dashed box). */
const ASIDE = "rounded-xl border-l-[3px] border-(--c1-line) bg-(--card-fill) px-4 py-3.5 text-[13px] leading-relaxed text-gray-300"

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
	const hrefs = useEncyclopediaHrefs()
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
	// A character's two colours (the hero's field, second and third's silk), by her character id.
	const pairs = catalogue.catalogue.character_colours
	const coloursOf = (characterId: number | null | undefined) => (characterId != null ? pairs?.[String(characterId)] : undefined)

	const guides = useMemo(() => countedGuides(events, payload, filters, eventWindow), [events, payload, filters, eventWindow])
	const cards = useMemo(() => rankCards(guides, filters, typeOf), [guides, filters, typeOf])
	const umas = useMemo(() => rankUmas(guides, filters, (id) => umasById.has(id)), [guides, filters, umasById])
	const deckCount = useMemo(() => countedDecks(guides, filters), [guides, filters])
	const countedEvents = useMemo(() => guides.map((counted) => counted.event), [guides])
	// The sparkline's mark: the first counted event still running or ahead.
	const nextEvent = countedEvents.find((event) => !hasEnded(event, now)) ?? null
	const nextLabel = nextEvent ? `${shortEventName(nextEvent)}, ${isRunning(nextEvent, now) ? "the event running now" : "the next event"}` : null
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
	const lensCards = useMemo(
		() => (lens === "overall" ? cards : lens === "umas" ? [] : cards.filter((rank) => typeOf(rank.card) === lens)),
		[lens, cards, typeOf]
	)

	// RANK MOVEMENT: the week's start counted under the same filters and lens, so a chip
	// never reports a change the filters made.
	const previousGuides = useMemo(
		() => (payload.previous ? countedGuides(events, { ...payload, guides: payload.previous.guides }, filters, eventWindow) : null),
		[events, payload, filters, eventWindow]
	)
	const moves = useMemo(() => {
		if (!previousGuides) return new Map<number, number | "new">()
		if (lens === "umas") {
			return movement(umas.map((rank) => rank.uma), rankUmas(previousGuides, filters, (id) => umasById.has(id)).map((rank) => rank.uma))
		}
		const before = rankCards(previousGuides, filters, typeOf).filter((rank) => lens === "overall" || typeOf(rank.card) === lens)
		return movement(lensCards.map((rank) => rank.card), before.map((rank) => rank.card))
	}, [previousGuides, lens, umas, lensCards, filters, typeOf, umasById])
	const leader = lens === "umas" ? (umas[0]?.picks ?? 0) : (lensCards[0]?.decks ?? 0)
	const fillOf = (count: number) => (leader > 0 ? count / leader : 0)

	const cardRow = (rank: CardRank, index: number) => {
		const card = cardsById.get(rank.card)
		return (
			<RankRow
				place={index + 1}
				art={<CardArt card={card} className="w-12" />}
				name={card?.name ?? "Unknown card"}
				movement={moves.get(rank.card)}
				sub={
					<>
						<CardTypeChip type={card?.card_type} />
						{rank.borrows > 0 && <span>{rank.borrows} borrowed</span>}
					</>
				}
				fill={fillOf(rank.decks)}
				// The type's hue, the same as the chip's dot: Speed's blue, Wit's green.
				barColor={card?.card_type ? CARD_TYPE_COLORS[card.card_type] : undefined}
				count={plural(rank.decks, "deck")}
				share={formatShare(rank.share)}
				detail={<RowDetail appearances={rank.appearances} alternatives={rank.alternatives} events={countedEvents} next={nextEvent} nextLabel={nextLabel} isCard />}
				href={hrefs.card(rank.card)}
			/>
		)
	}
	const umaRow = (rank: UmaRank, index: number) => {
		const uma = umasById.get(rank.uma)
		return (
			<RankRow
				place={index + 1}
				art={<FramedUma src={uma?.portrait ?? uma?.image} layers={uma?.portrait_layers} oshi={uma ? oshiIds.has(uma.id) : false} className="w-14" />}
				name={uma?.name ?? "Unknown uma"}
				movement={moves.get(rank.uma)}
				fill={fillOf(rank.picks)}
				count={plural(rank.picks, "pick")}
				share={formatShare(rank.share)}
				detail={<RowDetail appearances={rank.appearances} alternatives={0} events={countedEvents} next={nextEvent} nextLabel={nextLabel} isCard={false} />}
				href={hrefs.uma(rank.uma)}
			/>
		)
	}
	const lensLabel = lensOptions.find((option) => option.id === lens)?.label ?? "Overall"
	// "#1 overall", "#1 speed", "#1 uma": the hero's plate; the kicker over second and third.
	const placeWord = lens === "umas" ? "uma" : lensLabel.toLowerCase()

	// THE TOP THREE: first place is the hero, second and third sit under it.
	const podium: PodiumEntry[] =
		lens === "umas"
			? umas.slice(1, 3).map((rank, index) => {
					const uma = umasById.get(rank.uma)
					return {
						key: rank.uma,
						place: index + 2,
						art: <FramedUma src={uma?.portrait ?? uma?.image} layers={uma?.portrait_layers} oshi={uma ? oshiIds.has(uma.id) : false} className="w-[5.25rem]" />,
						name: uma?.name ?? "Unknown uma",
						count: plural(rank.picks, "pick"),
						share: formatShare(rank.share),
						fill: fillOf(rank.picks),
						colours: coloursOf(uma?.character_id),
						movement: moves.get(rank.uma),
						href: hrefs.uma(rank.uma),
						hover: hoverCardProps("uma", rank.uma),
					}
				})
			: lensCards.slice(1, 3).map((rank, index) => {
					const card = cardsById.get(rank.card)
					return {
						key: rank.card,
						place: index + 2,
						art: <CardArt card={card} className="w-[4.5rem]" />,
						name: card?.name ?? "Unknown card",
						count: plural(rank.decks, "deck"),
						share: formatShare(rank.share),
						fill: fillOf(rank.decks),
						colours: coloursOf(card?.character_id),
						movement: moves.get(rank.card),
						href: hrefs.card(rank.card),
						hover: hoverCardProps("card", rank.card),
					}
				})
	const firstUma = lens === "umas" ? umas[0] : undefined
	const firstCard = lens === "umas" ? undefined : lensCards[0]
	let top: HeroTop | null = null
	if (firstUma) {
		const uma = umasById.get(firstUma.uma)
		top = {
			place: `#1 ${placeWord}`,
			name: uma?.name ?? "Unknown uma",
			line: (
				<>
					<b>{plural(firstUma.picks, "pick")}</b>, <b>{formatShare(firstUma.share)}</b> of those counted
				</>
			),
			art: <FramedUma src={uma?.portrait ?? uma?.image} layers={uma?.portrait_layers} oshi={uma ? oshiIds.has(uma.id) : false} className="enc-hero__art" />,
			shape: "uma",
			colours: coloursOf(uma?.character_id),
			href: hrefs.uma(firstUma.uma),
			hover: hoverCardProps("uma", firstUma.uma),
		}
	} else if (firstCard) {
		const card = cardsById.get(firstCard.card)
		top = {
			place: `#1 ${placeWord}`,
			name: card?.name ?? "Unknown card",
			line: (
				<>
					In <b>{plural(firstCard.decks, "deck")}</b>, <b>{formatShare(firstCard.share)}</b> of those counted
				</>
			),
			art: <CardArt card={card} className="enc-hero__art--card" />,
			shape: "card",
			colours: coloursOf(card?.character_id),
			tags: (
				<>
					<CardTypeChip type={card?.card_type} />
					{firstCard.borrows > 0 && <span>{firstCard.borrows} borrowed</span>}
				</>
			),
			href: hrefs.card(firstCard.card),
			hover: hoverCardProps("card", firstCard.card),
		}
	}

	// In event order, for the "no scenario yet" note.
	const unset = events.filter((event) =>
		payload.guides.some((guide) => guide.scenario === NO_SCENARIO && sameEvent({ kind: guide.kind, id: guide.event }, refForRaceEvent(event)))
	)

	// THE FILTERS AS DATA: the toolbar's pills (desktop-nav up) and the phone sheet draw these.
	const items = <T,>(key: keyof GuideFilters, options: Array<{ id: T; label: string; count?: ReactNode }>, selected: ReadonlySet<T>) =>
		options.map((option) => ({
			key: String(option.id),
			label: option.label,
			count: option.count,
			on: selected.has(option.id),
			toggle: () => toggle(key, option.id as never),
		}))
	const groups: FilterGroup[] = [
		{
			key: "include",
			label: "Include",
			title: "Events and decks",
			state: tickSummary(includeTicked, includeTotal, "Everything"),
			changed: includeTicked < includeTotal,
			reset: () => resetKeys("kinds", "tiers"),
			sections: [
				items("kinds", KINDS.map((kind) => ({ ...kind, count: plural(menuCounts.kinds.get(kind.id) ?? 0, "guide") })), filters.kinds),
				items("tiers", RANKING_TIERS.map((id) => ({ id, label: TIER_LABELS[id], count: plural(menuCounts.tiers.get(id) ?? 0, "deck") })), filters.tiers),
			],
		},
		{
			key: "strategy",
			label: "Strategy",
			title: "Running style",
			state: tickSummary(filters.styles.size, STYLES.length),
			changed: filters.styles.size < STYLES.length,
			reset: () => resetKeys("styles"),
			sections: [items("styles", STYLES.map((id) => ({ id, label: STYLE_LABELS[id], count: menuCounts.styles.get(id) ?? 0 })), filters.styles)],
		},
		{
			key: "scenario",
			label: "Scenario",
			title: "Training scenario",
			state: tickSummary(filters.scenarios.size, scenarioOptions.length),
			changed: filters.scenarios.size < scenarioOptions.length,
			reset: () => resetKeys("scenarios"),
			sections: [items("scenarios", scenarioOptions.map((option) => ({ ...option, count: menuCounts.scenarios.get(option.id) ?? 0 })), filters.scenarios)],
			collapse: true,
		},
		{
			key: "cardTypes",
			label: "Card type",
			title: "Card type",
			state: tickSummary(filters.cardTypes.size, CARD_TYPE_IDS.length, `All ${CARD_TYPE_IDS.length}`),
			changed: filters.cardTypes.size < CARD_TYPE_IDS.length,
			reset: () => resetKeys("cardTypes"),
			sections: [items("cardTypes", CARD_TYPE_IDS.map((id) => ({ id: id as string, label: CARD_TYPE_LABELS[id] })), filters.cardTypes)],
		},
	]
	// The Events window: inside its pill on a desktop, the sheet's first group on a phone.
	const eventsMenu = (
		<>
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
		</>
	)
	const resetAll = () => {
		setFilters(defaults)
		setWindowSize(null)
	}

	return (
		<div className="flex flex-col gap-[1.125rem]">
			{/* One filter card, as on the Encyclopedia's lists: the search first, then the pills. */}
			<div className="rk-panel flex flex-col gap-3 px-4 py-4 @min-[40rem]:px-[1.125rem]">
				<div className="flex flex-wrap items-center gap-2">
					<label className="relative w-full @min-[40rem]:mr-2 @min-[40rem]:w-[17rem]">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
						<input
							type="search"
							aria-label="Find a card or uma"
							placeholder="Find a card or uma"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							className="w-full rounded-lg border border-gray-600 bg-gray-900 py-2 pl-9 pr-3 text-sm text-gray-100 placeholder-gray-500 focus:border-brand focus:outline-none"
						/>
					</label>
					<FilterToolbar className="hidden desktop-nav:flex">
						<FilterPill label="Events" state={windowSize === null ? "All guides" : `Next ${windowSize}`} changed={windowSize !== null} title="Which guides">
							{eventsMenu}
						</FilterPill>
						{groups.map((group) => (
							<GroupPill key={group.key} group={group} />
						))}
					</FilterToolbar>
				</div>
				<Tokens
					summary={
						guides.length === 0
							? "No guide fits these filters."
							: `Showing ${plural(guides.length, "guide")} and ${plural(deckCount, "deck")}${tokens.length > 0 ? " for" : "."}`
					}
					tokens={tokens}
					onReset={resetAll}
				/>
				{/* Below desktop-nav the pills give way to one button and a bottom sheet. */}
				<FilterSheet
					groups={groups}
					lead={
						<div role="group" aria-label="Which guides" className="flex flex-col gap-1">
							<span className="text-[10px] uppercase tracking-wider text-gray-400">Events</span>
							{eventsMenu}
						</div>
					}
					changed={tokens.length}
					result={`Show ${plural(deckCount, "deck")}`}
					onReset={resetAll}
				/>
			</div>

			<RankHero
				title="What the guides recommend"
				top={top}
				figures={[
					{ label: "Guides counted", value: guides.length.toLocaleString() },
					{ label: "Decks", value: deckCount.toLocaleString() },
					{ label: scenarioCount === 1 ? "Scenario" : "Scenarios", value: scenarioCount.toLocaleString() },
				]}
			/>

			<Podium entries={podium} kicker={lens === "umas" ? "Umas" : lensLabel} label={`Second and third, ${lensLabel}`} />

			<div className="flex flex-col gap-1.5">
				<Lens label="Which list" options={lensOptions} value={lens} onChange={setLens} />
				<span className="text-[13px] text-gray-400">
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
				<div className="flex min-w-0 flex-col gap-3">
					<SearchPanel query={query} cards={cards} umas={umas} cardsById={cardsById} umasById={umasById} oshiIds={oshiIds} />
					<aside className={ASIDE}>
						<b className="font-bold text-gray-50">Read the counts loosely.</b> A lot of scenarios still haven't been QC'd, so
						some cards may be overrepresented. A score is how often a card or uma was used and found to be effective. It doesn't
						show how much stronger one is than another.
					</aside>
					{unset.length > 0 && (
						<aside className={ASIDE}>
							<b className="font-bold text-gray-50">
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
 * use across every counted event as a sparkline, marked at the event running
 * now or next (mock 04-guides-row-open.png; the span is the owner's call,
 * 2026-10-28).
 */
function RowDetail({ appearances, alternatives, events, next, nextLabel, isCard }: {
	appearances: RankingAppearance[]
	alternatives: number
	events: RaceEvent[]
	/** The counted event running now or next, marked on the sparkline. */
	next: RaceEvent | null
	nextLabel: string | null
	isCard: boolean
}) {
	const byEvent = breakdown(appearances, (appearance) => appearance.event)
	const byStyle = breakdown(appearances, (appearance) => appearance.style).sort(([a], [b]) => STYLES.indexOf(a) - STYLES.indexOf(b))
	const byTier = isCard
		? breakdown(appearances, (appearance) => appearance.tier ?? "other").sort(([a], [b]) => RANKING_TIERS.indexOf(a) - RANKING_TIERS.indexOf(b))
		: []
	const usage = usageByEvent(appearances, events)
	return (
		<Detail>
			<DetailBlock heading="By event">
				<span className="flex flex-wrap gap-1.5">
					{byEvent.map(([event, count]) => (
						<Link
							key={`${event.event_type}-${event.id}`}
							to={pvpEventHref(refForRaceEvent(event))}
							className="rounded-full border border-brand/40 px-2.5 py-0.5 text-[13px] tabular-nums text-brand transition hover:bg-brand/15"
						>
							{shortEventName(event)} {count}
						</Link>
					))}
				</span>
			</DetailBlock>
			<DetailBlock heading="By strategy">
				<Bar fill={1} parts={byStyle.map(([style, count]) => stylePart(style, count))} />
				<StyleLegend entries={byStyle} />
			</DetailBlock>
			{isCard && (
				<DetailBlock heading="By deck">
					<span className="flex flex-wrap gap-x-4 gap-y-2">
						{byTier.map(([tier, count]) => (
							<span key={tier} className="flex flex-col text-xs text-gray-400">
								<b className="font-display text-lg font-bold leading-tight tabular-nums text-gray-100">{count}</b>
								{TIER_LABELS[tier]}
							</span>
						))}
						{alternatives > 0 && (
							<span className="flex flex-col text-xs text-gray-400">
								<b className="font-display text-lg font-bold leading-tight tabular-nums text-gray-100">{alternatives}</b>
								as an alternative
							</span>
						)}
					</span>
				</DetailBlock>
			)}
			{events.length >= 2 && (
				<DetailBlock heading={`Across ${events.length} events`}>
					<Sparkline
						points={usage}
						marker={next ? events.indexOf(next) : null}
						label={`${isCard ? "Decks" : "Picks"} per event, oldest first${nextLabel ? `, marked at ${nextLabel}` : ""}`}
					/>
					{nextLabel && <span className="text-xs text-gray-400">Oldest on the left. The mark is {nextLabel}.</span>}
				</DetailBlock>
			)}
		</Detail>
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
	const hrefs = useEncyclopediaHrefs()
	const needle = query.trim().toLowerCase()
	const searching = needle.length >= 2
	const results = useMemo(() => {
		if (!searching) return []
		const cardPlaces = new Map(cards.map((rank, index) => [rank.card, { rank, place: index + 1 }]))
		const umaPlaces = new Map(umas.map((rank, index) => [rank.uma, { rank, place: index + 1 }]))
		const found = [
			...[...cardsById.values()]
				.filter((card) => !card.placeholder && nameMatches(needle, card.name))
				.map((card) => ({ kind: "card" as const, card, hit: cardPlaces.get(card.id) ?? null })),
			...[...umasById.values()]
				.filter((uma) => nameMatches(needle, uma.name))
				.map((uma) => ({ kind: "uma" as const, uma, hit: umaPlaces.get(uma.id) ?? null })),
		]
		const nameOf = (entry: (typeof found)[number]) => (entry.kind === "card" ? entry.card.name : entry.uma.name)
		return found
			.sort((a, b) => (a.hit?.place ?? Infinity) - (b.hit?.place ?? Infinity) || nameOf(a).localeCompare(nameOf(b)))
			.slice(0, SEARCH_RESULTS)
	}, [searching, needle, cards, umas, cardsById, umasById])

	return (
		<section aria-label="Search" className={`${PANEL} gap-3`}>
			<h3 className="enc-section__title text-[1.3125rem]">Search</h3>
			{!searching ? (
				<p className="text-[13px] text-gray-400">Type a card or uma's name above to see where it ranks under these filters, even outside the top ten.</p>
			) : results.length === 0 ? (
				<p className="text-[13px] text-gray-400">Nothing by that name.</p>
			) : (
				<ul className="flex flex-col gap-2.5">
					{results.map((entry) =>
						entry.kind === "card" ? (
							<li key={`card-${entry.card.id}`} className="flex items-center gap-2.5" {...hoverCardProps("card", entry.card.id)}>
								<CardArt card={entry.card} />
								<span className="flex min-w-0 flex-col gap-0.5">
									<EncyclopediaName href={hrefs.card(entry.card.id)} name={entry.card.name} className={RESULT_NAME} />
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
							<li key={`uma-${entry.uma.id}`} className="flex items-center gap-2.5" {...hoverCardProps("uma", entry.uma.id)}>
								<FramedUma src={entry.uma.portrait ?? entry.uma.image} layers={entry.uma.portrait_layers} oshi={oshiIds.has(entry.uma.id)} className="w-10" />
								<span className="flex min-w-0 flex-col gap-0.5">
									<EncyclopediaName href={hrefs.uma(entry.uma.id)} name={entry.uma.name} className={RESULT_NAME} />
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
