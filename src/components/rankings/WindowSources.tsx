/**
 * What the pinned Rankings window shows, one source per section
 * (notes/rankings-redesign-plan.md step 3, mocks 12 to 15): each fetches its
 * section's payload, ranks ONE list the way the full page does, and hands it
 * to the window as rows, a context line and the one or two settings that
 * change it. The window never shows the full filters: Guides counts every
 * guide with every box ticked, and the settings are the ones the page
 * remembers (rankingsPinStore choices: the Guides lens, the PvP event and
 * list, the Pull plans type and sort), so the page opens on what the window
 * showed.
 *
 * A source renders its children with the list (a render prop) so the dock
 * keeps it mounted while the window is retracted: the edge tab counts what
 * moved in the top ten, which needs the list either way.
 */

import { useCallback, useMemo, useState, type ReactNode } from "react"
import type { RaceEvent } from "../../types"
import type { PvpStyle } from "../../types/pvpGuide"
import type { GuideRankingsPayload } from "../../types/guideRankings"
import type { PullPlanRankingsPayload } from "../../types/pullPlanRankings"
import type { PlayersRankingsPayload, PvpRankingsPayload } from "../../types/rankingsTabs"
import { useCalculatorData } from "../../services/CalculatorContext"
import { chooseRankings, GUIDE_LENSES, useRankingsChoices, type GuideLens, type RankingsSection } from "../../services/rankingsPinStore"
import { useRankingsPayload, type RankingsState } from "../../hooks/useRankingsPayload"
import { usePvpCatalogue } from "../../hooks/usePvpCatalogue"
import { useOshiIds } from "../../hooks/useOshiIds"
import { FramedUma } from "../FramedUma"
import { allFilters, countedGuides, formatShare, rankCards, rankUmas } from "../../utils/guideRankings"
import { CARD_TYPE_LABELS } from "../../utils/cardTypes"
import { defaultPvpEvent, findEvent, raceEventsInOrder } from "../../utils/pvpGuide"
import { formatPvpEvent, parsePvpEvent, refForRaceEvent, shortEventName, splitEventName } from "../../utils/pvpEvent"
import { pullPlanRows, type PullPlanSort } from "../../utils/pullPlanRankings"
import { eventsAround } from "../../utils/rankingsWindow"
import { CardArt } from "./kit/CardArt"
import type { LensOption } from "./kit/Lens"

export interface WindowRow {
	id: string
	name: string
	art: ReactNode
	/** count / the list's leader. */
	fill: number
	count: string
	share: string
}

export interface WindowSetting {
	label: string
	options: LensOption<string>[]
	value: string
	onChange: (value: string) => void
}

export interface WindowList {
	status: "loading" | "refused" | "error" | "ready"
	/** After the section's name: "Overall · all 51 guides". */
	context: string
	/** The edge tab's name from desktop-nav up: "PvP · CM 21". */
	tabName: string
	/** The whole ranked list; the window shows ten. */
	rows: WindowRow[]
	/** The search box's placeholder; none and the window has no search. */
	search?: string
	settings: WindowSetting[]
}

type Render = (list: WindowList) => ReactNode

const STYLES: PvpStyle[] = ["runaway", "front", "pace", "late", "end"]
const CARD_TYPE_IDS = ["speed", "stamina", "power", "guts", "wit", "friend", "group"]
const LENS_LABELS: Record<GuideLens, string> = { overall: "Overall", umas: "Umas", ...(CARD_TYPE_LABELS as Record<Exclude<GuideLens, "overall" | "umas">, string>) }

/** Rows with their fill against the first one. */
function withFill<T>(items: T[], count: (item: T) => number, row: (item: T, fill: number) => WindowRow): WindowRow[] {
	const leader = items.length > 0 ? count(items[0]) : 0
	return items.map((item) => row(item, leader > 0 ? count(item) / leader : 0))
}

/** A payload's state as the window's, before its rows are ready. */
function pending(state: RankingsState<unknown>, base: Omit<WindowList, "status" | "rows">): WindowList | null {
	if (state.status === "ready") return null
	return { ...base, status: state.status, rows: [] }
}

export function WindowSource({ section, children }: { section: RankingsSection; children: Render }) {
	if (section === "guides") return <GuidesSource>{children}</GuidesSource>
	if (section === "pull-plans") return <PullPlansSource>{children}</PullPlansSource>
	if (section === "pvp") return <PvpSource>{children}</PvpSource>
	return <PlayersSource>{children}</PlayersSource>
}

function GuidesSource({ children }: { children: Render }) {
	const state = useRankingsPayload<GuideRankingsPayload>("/rankings/guides")
	const catalogue = usePvpCatalogue()
	const oshiIds = useOshiIds()
	const { championsMeetingData, leagueOfHeroesData } = useCalculatorData()
	const events = useMemo(() => raceEventsInOrder(championsMeetingData, leagueOfHeroesData), [championsMeetingData, leagueOfHeroesData])
	const lens: GuideLens = useRankingsChoices().guides?.lens ?? "overall"
	// The payload and the catalogue's maps keep their identity between renders, so the count reruns only when they change.
	const payload = state.status === "ready" ? state.payload : null
	const cardsById = catalogue.status === "ready" ? catalogue.cardsById : null
	const umasById = catalogue.status === "ready" ? catalogue.umasById : null
	const typeOf = useCallback((card: number) => cardsById?.get(card)?.card_type, [cardsById])

	const list = useMemo(() => {
		if (!payload || !cardsById || !umasById) return null
		const index = { cardsById, umasById }
		// Every box ticked, every guide: the window never shows the filters.
		const filters = allFilters(payload, STYLES, CARD_TYPE_IDS)
		const guides = countedGuides(events, payload, filters, { size: null })
		if (lens === "umas") {
			const rows = withFill(rankUmas(guides, filters, (id) => index.umasById.has(id)), (rank) => rank.picks, (rank, fill) => {
				const uma = index.umasById.get(rank.uma)
				return {
					id: `uma-${rank.uma}`,
					name: uma?.name ?? "Unknown uma",
					art: <FramedUma src={uma?.portrait ?? uma?.image} oshi={oshiIds.has(rank.uma)} className="w-8" />,
					fill,
					count: rank.picks.toLocaleString(),
					share: formatShare(rank.share),
				}
			})
			return { rows, guides: guides.length }
		}
		const cards = rankCards(guides, filters, typeOf).filter((rank) => lens === "overall" || typeOf(rank.card) === lens)
		const rows = withFill(cards, (rank) => rank.decks, (rank, fill) => {
			const card = index.cardsById.get(rank.card)
			return {
				id: `card-${rank.card}`,
				name: card?.name ?? "Unknown card",
				art: <CardArt card={card} className="w-7" />,
				fill,
				count: rank.decks.toLocaleString(),
				share: formatShare(rank.share),
			}
		})
		return { rows, guides: guides.length }
	}, [payload, cardsById, umasById, events, lens, typeOf, oshiIds])

	const base = {
		context: list ? `${LENS_LABELS[lens]} · all ${list.guides} guides` : LENS_LABELS[lens],
		tabName: "Guides",
		search: "Find a card or uma",
		settings: [
			{
				label: "List",
				options: GUIDE_LENSES.map((id) => ({ id, label: LENS_LABELS[id] })),
				value: lens,
				onChange: (value: string) => chooseRankings("guides", { lens: value as GuideLens }),
			},
		],
	}
	if (catalogue.status === "error") return children({ ...base, status: "error", rows: [] })
	return children(pending(state, base) ?? (list ? { ...base, status: "ready", rows: list.rows } : { ...base, status: "loading", rows: [] }))
}

const TYPE_OPTIONS = [
	{ id: "all", label: "All" },
	{ id: "uma", label: "Uma" },
	{ id: "support", label: "Support" },
	{ id: "step_up", label: "Step-up" },
]
const SORT_OPTIONS = [
	{ id: "planners", label: "By planners" },
	{ id: "date", label: "By date" },
]
const KIND_CLASS = { uma: "banner-type-tile--uma", support: "banner-type-tile--support", step_up: "banner-type-tile--step-up" }

function PullPlansSource({ children }: { children: Render }) {
	const state = useRankingsPayload<PullPlanRankingsPayload>("/rankings/pull-plans")
	const choices = useRankingsChoices()["pull-plans"]
	const type = TYPE_OPTIONS.some((option) => option.id === choices?.type) ? (choices?.type ?? "all") : "all"
	const sort: PullPlanSort = choices?.sort === "planners" ? "planners" : "date"
	const rows = useMemo(() => {
		if (state.status !== "ready") return []
		const everyone = state.payload.planners
		const shown = pullPlanRows(state.payload.banners, { type: type === "all" ? null : (type as "uma" | "support" | "step_up"), sort, showEnded: false })
		// The fill is planners against the most planned banner shown, whatever the order.
		const leader = Math.max(0, ...shown.map((row) => row.planners))
		return shown.map((row) => ({
			id: `${row.type}-${row.id}`,
			name: row.name,
			art: <span className={`${KIND_CLASS[row.type]} rounded px-1 py-0.5 text-[8px] font-bold uppercase leading-none`}>{TYPE_OPTIONS.find((option) => option.id === row.type)?.label}</span>,
			fill: leader > 0 ? row.planners / leader : 0,
			count: row.planners.toLocaleString(),
			share: everyone ? formatShare(row.planners / everyone) : "",
		}))
	}, [state, type, sort])
	const base = {
		context: `${SORT_OPTIONS.find((option) => option.id === sort)?.label} · ${TYPE_OPTIONS.find((option) => option.id === type)?.label}`,
		tabName: "Pull plans",
		settings: [
			{ label: "Type", options: TYPE_OPTIONS, value: type, onChange: (value: string) => chooseRankings("pull-plans", { type: value }) },
			{ label: "Order", options: SORT_OPTIONS, value: sort, onChange: (value: string) => chooseRankings("pull-plans", { sort: value }) },
		],
	}
	return children(pending(state, base) ?? { ...base, status: "ready", rows })
}

function PvpSource({ children }: { children: Render }) {
	const { championsMeetingData, leagueOfHeroesData } = useCalculatorData()
	const events = useMemo(() => raceEventsInOrder(championsMeetingData, leagueOfHeroesData), [championsMeetingData, leagueOfHeroesData])
	const choices = useRankingsChoices().pvp
	// One clock reading per mount, for the default event.
	const [now] = useState(() => new Date())
	const anchor = defaultPvpEvent(events, now)
	const event = findEvent(events, parsePvpEvent(choices?.event)) ?? anchor
	if (!event || !anchor) {
		return children({ status: "error", context: "No PvP events yet", tabName: "PvP", rows: [], settings: [] })
	}
	return (
		<PvpEventSource key={`${event.event_type}-${event.id}`} event={event} options={eventsAround(events, anchor, event)} list={choices?.list ?? "umas"}>
			{children}
		</PvpEventSource>
	)
}

function PvpEventSource({ event, options, list, children }: { event: RaceEvent; options: RaceEvent[]; list: "umas" | "cards"; children: Render }) {
	const ref = refForRaceEvent(event)
	const state = useRankingsPayload<PvpRankingsPayload>(`/rankings/pvp/${ref.kind}/${ref.id}`)
	const catalogue = usePvpCatalogue()
	const oshiIds = useOshiIds()
	const rows = useMemo(() => {
		if (state.status !== "ready" || catalogue.status !== "ready") return null
		const { built } = state.payload
		if (list === "cards") {
			return withFill(built.cards.filter((row) => catalogue.cardsById.has(row.card)), (row) => row.decks, (row, fill) => {
				const card = catalogue.cardsById.get(row.card)
				return {
					id: `card-${row.card}`,
					name: card?.name ?? "Unknown card",
					art: <CardArt card={card} className="w-7" />,
					fill,
					count: row.decks.toLocaleString(),
					share: formatShare(built.decks ? row.decks / built.decks : 0),
				}
			})
		}
		return withFill(built.umas.filter((row) => catalogue.umasById.has(row.uma)), (row) => row.teams, (row, fill) => {
			const uma = catalogue.umasById.get(row.uma)
			return {
				id: `uma-${row.uma}`,
				name: uma?.name ?? "Unknown uma",
				art: <FramedUma src={uma?.portrait ?? uma?.image} oshi={oshiIds.has(row.uma)} className="w-8" />,
				fill,
				count: row.teams.toLocaleString(),
				share: formatShare(built.teams ? row.teams / built.teams : 0),
			}
		})
	}, [state, catalogue, list, oshiIds])
	const { title } = splitEventName(event)
	const short = shortEventName(event)
	const base = {
		context: `${short}${title !== event.name ? ` ${title}` : ""} · ${list === "umas" ? "Umas" : "Cards"}`,
		tabName: `PvP · ${short}`,
		search: list === "umas" ? "Find an uma" : "Find a card",
		settings: [
			{
				label: "Event",
				options: options.map((option) => ({ id: formatPvpEvent(refForRaceEvent(option)), label: shortEventName(option) })),
				value: formatPvpEvent(ref),
				onChange: (value: string) => chooseRankings("pvp", { event: value }),
			},
			{
				label: "List",
				options: [
					{ id: "umas", label: "Umas" },
					{ id: "cards", label: "Cards" },
				],
				value: list,
				onChange: (value: string) => chooseRankings("pvp", { list: value === "cards" ? "cards" : "umas" }),
			},
		],
	}
	if (catalogue.status === "error") return children({ ...base, status: "error", rows: [] })
	return children(pending(state, base) ?? (rows ? { ...base, status: "ready", rows } : { ...base, status: "loading", rows: [] }))
}

function PlayersSource({ children }: { children: Render }) {
	const state = useRankingsPayload<PlayersRankingsPayload>("/rankings/players")
	const catalogue = usePvpCatalogue()
	const oshiIds = useOshiIds()
	const rows = useMemo(() => {
		if (state.status !== "ready" || catalogue.status !== "ready") return null
		const { favourites, engaged } = state.payload
		return withFill(favourites.filter((row) => catalogue.umasById.has(row.uma)), (row) => row.people, (row, fill) => {
			const uma = catalogue.umasById.get(row.uma)
			return {
				id: `uma-${row.uma}`,
				name: uma?.name ?? "Unknown uma",
				art: <FramedUma src={uma?.portrait ?? uma?.image} oshi={oshiIds.has(row.uma)} className="w-8" />,
				fill,
				count: row.people.toLocaleString(),
				share: formatShare(engaged ? row.people / engaged : 0),
			}
		})
	}, [state, catalogue, oshiIds])
	const base = { context: "Favourite umas", tabName: "Players", settings: [] }
	if (catalogue.status === "error") return children({ ...base, status: "error", rows: [] })
	return children(pending(state, base) ?? (rows ? { ...base, status: "ready", rows } : { ...base, status: "loading", rows: [] }))
}
