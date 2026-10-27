/**
 * The PvP page's Rankings view (`?view=rankings`): which support cards and
 * umas the guides recommend most across the coming events. Early access only
 * (owner, 2026-10-27), on the server as well; the page shows the early-access
 * card instead for anyone else.
 *
 * Counting is utils/pvpRankings.ts, which has the rules. This draws the
 * filters, the two lists, and each row's details: every deck or style the
 * pick appears in, linked to that guide.
 *
 * It counts from the event on screen onward, so the page's Previous and Next
 * also move the window.
 */

import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { ChevronDown, Loader2, Star } from "lucide-react"
import type { RaceEvent } from "../../types"
import type { PvpStyle } from "../../types/pvpGuide"
import type { RankingTier } from "../../types/pvpRankings"
import type { CatalogueSupportCard, CatalogueUma } from "../../types/pvpTeam"
import { usePvpCatalogue } from "../../hooks/usePvpCatalogue"
import { usePvpRankings } from "../../hooks/usePvpRankings"
import { useOshiIds } from "../../hooks/useOshiIds"
import { FramedUma } from "../FramedUma"
import { STYLE_LABELS } from "../../utils/pvpGuide"
import { pvpEventHref, refForRaceEvent, shortEventName, type PvpEventKind } from "../../utils/pvpEvent"
import {
	DEFAULT_EVENT_COUNT,
	DEFAULT_TIERS,
	EVENT_COUNTS,
	breakdown,
	rankCards,
	rankingEvents,
	rankUmas,
	type CardRank,
	type RankingAppearance,
	type UmaRank,
} from "../../utils/pvpRankings"

/** How many rows a list shows before "Show all". */
const LIST_START = 20

const STYLES: PvpStyle[] = ["runaway", "front", "pace", "late", "end"]
const TIERS: Array<{ id: RankingTier; label: string }> = [
	{ id: "beginner", label: "Beginner" },
	{ id: "standard", label: "Standard" },
	{ id: "whale", label: "Whale" },
	{ id: "other", label: "Other decks" },
]
const CARD_TYPES: Array<{ id: string; label: string }> = [
	{ id: "speed", label: "Speed" },
	{ id: "stamina", label: "Stamina" },
	{ id: "power", label: "Power" },
	{ id: "guts", label: "Guts" },
	{ id: "wit", label: "Wit" },
	{ id: "friend", label: "Friend" },
	{ id: "group", label: "Group" },
]

// The card picker's switch and chip looks, so the filters read the same.
const SEGMENTS = "flex flex-wrap gap-0.5 rounded-lg bg-gray-900/70 p-0.5"
const segment = (on: boolean) =>
	`rounded-md px-2.5 py-0.5 text-xs font-medium transition ${on ? "bg-gray-700 text-brand shadow-sm" : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"}`
const chip = (on: boolean) =>
	`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${on ? "border-brand bg-brand/15 text-brand" : "border-gray-600 text-gray-300 hover:border-gray-500"}`

export function PvpRankingsView({ event, events }: { event: RaceEvent; events: RaceEvent[] }) {
	const rankings = usePvpRankings()
	const catalogue = usePvpCatalogue()
	const [kind, setKind] = useState<PvpEventKind | null>(null)
	const [style, setStyle] = useState<PvpStyle | null>(null)
	const [tiers, setTiers] = useState<ReadonlySet<RankingTier>>(DEFAULT_TIERS)
	const [eventCount, setEventCount] = useState<number | null>(DEFAULT_EVENT_COUNT)
	const [cardType, setCardType] = useState<string | null>(null)

	const ready = rankings.status === "ready" && catalogue.status === "ready"
	const counted = useMemo(
		() => (rankings.status === "ready" ? rankingEvents(events, event, rankings.payload, { kind, eventCount }) : []),
		[rankings, events, event, kind, eventCount]
	)
	const cards = useMemo(() => {
		if (rankings.status !== "ready" || catalogue.status !== "ready") return []
		return rankCards(rankings.payload, counted, { style, tiers }, (id) => {
			const card = catalogue.cardsById.get(id)
			return card !== undefined && (cardType === null || card.card_type === cardType)
		})
	}, [rankings, catalogue, counted, style, tiers, cardType])
	const umas = useMemo(() => {
		if (rankings.status !== "ready" || catalogue.status !== "ready") return []
		return rankUmas(rankings.payload, counted, { style }, (id) => catalogue.umasById.has(id))
	}, [rankings, catalogue, counted, style])

	if (rankings.status === "refused") {
		return <p className="rounded-xl border border-edge bg-gray-800/60 p-4 text-sm text-gray-300">Rankings are open to supporters first.</p>
	}
	if (rankings.status === "error" || catalogue.status === "error") {
		return <p className="rounded-xl border border-edge bg-gray-800/60 p-4 text-sm text-gray-300">The rankings didn't load. Reload the page to try again.</p>
	}
	if (!ready) {
		return (
			<div className="flex items-center gap-2 text-sm text-gray-400" role="status">
				<Loader2 className="h-4 w-4 animate-spin" />
				Counting the guides…
			</div>
		)
	}

	const toggleTier = (tier: RankingTier) => {
		const next = new Set(tiers)
		if (next.has(tier)) next.delete(tier)
		else next.add(tier)
		setTiers(next)
	}

	return (
		<div className="flex flex-col gap-4">
			<section className="card-panel flex flex-col gap-3 p-3 sm:p-4" aria-label="What to count">
				<div className="flex flex-wrap items-center gap-x-4 gap-y-2">
					<FilterGroup label="Events">
						<div className={SEGMENTS} role="group" aria-label="How many events">
							{EVENT_COUNTS.map((count) => (
								<button key={count ?? "all"} type="button" aria-pressed={eventCount === count} onClick={() => setEventCount(count)} className={segment(eventCount === count)}>
									{count === null ? "All" : `Next ${count}`}
								</button>
							))}
						</div>
						<div className={SEGMENTS} role="group" aria-label="Event kind">
							{([null, "cm", "loh"] as const).map((option) => (
								<button key={option ?? "both"} type="button" aria-pressed={kind === option} onClick={() => setKind(option)} className={segment(kind === option)}>
									{option === null ? "CM and LoH" : option === "cm" ? "CM" : "LoH"}
								</button>
							))}
						</div>
					</FilterGroup>
					<FilterGroup label="Style">
						<div className={SEGMENTS} role="group" aria-label="Running style">
							<button type="button" aria-pressed={style === null} onClick={() => setStyle(null)} className={segment(style === null)}>
								All
							</button>
							{STYLES.map((option) => (
								<button key={option} type="button" aria-pressed={style === option} onClick={() => setStyle(option)} className={segment(style === option)}>
									{STYLE_LABELS[option]}
								</button>
							))}
						</div>
					</FilterGroup>
				</div>
				<p className="text-xs text-gray-400">
					{counted.length === 0
						? "No guides to count from this event on."
						: `Counting ${counted.length === 1 ? "1 guide" : `${counted.length} guides`}: ${counted.map(shortEventName).join(", ")}.`}
				</p>
			</section>

			<div className="grid items-start gap-4 lg:grid-cols-2">
				<RankList
					title="Support cards"
					hint="Decks it is in, the borrowed card included. Alternatives don't count."
					filters={
						<div className="flex flex-col gap-2">
							<div className="flex flex-wrap gap-1.5" role="group" aria-label="Deck tier">
								{TIERS.map((tier) => (
									<button key={tier.id} type="button" aria-pressed={tiers.has(tier.id)} onClick={() => toggleTier(tier.id)} className={chip(tiers.has(tier.id))}>
										{tier.label}
									</button>
								))}
							</div>
							<div className="flex flex-wrap gap-1.5" role="group" aria-label="Card type">
								{CARD_TYPES.map((type) => (
									<button key={type.id} type="button" aria-pressed={cardType === type.id} onClick={() => setCardType(cardType === type.id ? null : type.id)} className={chip(cardType === type.id)}>
										{type.label}
									</button>
								))}
							</div>
						</div>
					}
					rows={cards.map((rank) => ({
						key: rank.card,
						render: (place: number) => <CardRow place={place} rank={rank} card={catalogue.cardsById.get(rank.card)} />,
					}))}
					empty="No card fits these filters."
				/>
				<RankList
					title="Umas"
					hint="Stars added up over the events, so a 3-star pick counts three times a 1-star one."
					rows={umas.map((rank) => ({
						key: rank.uma,
						render: (place: number) => <UmaRow place={place} rank={rank} uma={catalogue.umasById.get(rank.uma)} />,
					}))}
					empty="No uma fits these filters."
				/>
			</div>
		</div>
	)
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</span>
			{children}
		</div>
	)
}

function RankList({ title, hint, filters, rows, empty }: {
	title: string
	hint: string
	filters?: React.ReactNode
	rows: Array<{ key: number; render: (place: number) => React.ReactNode }>
	empty: string
}) {
	const [all, setAll] = useState(false)
	const shown = all ? rows : rows.slice(0, LIST_START)
	return (
		<section className="card-panel flex min-w-0 flex-col gap-3 p-3 sm:p-4" aria-label={title}>
			<div className="flex flex-col gap-0.5">
				<h3 className="font-display text-base font-bold text-brand">{title}</h3>
				<p className="text-xs text-gray-400">{hint}</p>
			</div>
			{filters}
			{rows.length === 0 ? (
				<p className="text-sm text-gray-400">{empty}</p>
			) : (
				<ol className="flex flex-col divide-y divide-gray-700/70">
					{shown.map((row, index) => (
						<li key={row.key}>{row.render(index + 1)}</li>
					))}
				</ol>
			)}
			{rows.length > LIST_START && (
				<button type="button" onClick={() => setAll(!all)} className="self-start text-sm text-brand transition hover:text-brand/75">
					{all ? "Show the top 20" : `Show all ${rows.length}`}
				</button>
			)}
		</section>
	)
}

/**
 * One ranked row: place, art, name, its count, and the count per event. A
 * click opens three short lines (by event, by style, by tier) rather than
 * every deck (owner, 2026-10-27: "how many times, not every single one").
 * The "by event" line links each event's guide; the row itself is a button,
 * and a link can't sit inside one.
 */
function RankRow({ place, art, name, counts, appearances, unit }: {
	place: number
	art: React.ReactNode
	name: string
	counts: React.ReactNode
	appearances: RankingAppearance[]
	/** "decks" counts decks, "stars" an uma's stars. */
	unit: "decks" | "stars"
}) {
	const [open, setOpen] = useState(false)
	const amount = (value: number) => (unit === "stars" ? `★${value}` : String(value))
	const byEvent = breakdown(appearances, (appearance) => appearance.event)
	const byStyle = breakdown(appearances, (appearance) => appearance.style)
	const byTier = unit === "decks" ? breakdown(appearances, (appearance) => appearance.tier ?? "other") : []
	return (
		<div className="py-2">
			<button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full min-w-0 items-center gap-3 rounded-md text-left transition hover:bg-gray-800/60">
				<span className="w-6 shrink-0 text-right font-mono text-sm tabular-nums text-gray-400">{place}</span>
				<span className="w-10 shrink-0">{art}</span>
				<span className="flex min-w-0 flex-1 flex-col">
					<span className="truncate text-sm font-semibold text-gray-100">{name}</span>
					<span className="text-xs text-gray-400">{counts}</span>
				</span>
				<span className="hidden max-w-[45%] flex-wrap justify-end gap-1 sm:flex">
					{byEvent.map(([event, value]) => (
						<span key={`${event.event_type}-${event.id}`} className="rounded bg-gray-700/70 px-1.5 py-0.5 text-[11px] tabular-nums text-gray-300">
							{shortEventName(event)} <span className="text-gray-400">·</span> {amount(value)}
						</span>
					))}
				</span>
				<ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden="true" />
			</button>
			{open && (
				<dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 pl-[4.75rem] text-xs tabular-nums">
					<dt className="text-gray-400">By event</dt>
					<dd className="flex flex-wrap gap-x-3 text-gray-200">
						{byEvent.map(([event, value]) => (
							<Link key={`${event.event_type}-${event.id}`} to={pvpEventHref(refForRaceEvent(event))} className="text-brand transition hover:text-brand/75">
								{shortEventName(event)} {amount(value)}
							</Link>
						))}
					</dd>
					<dt className="text-gray-400">By style</dt>
					<dd className="text-gray-200">{byStyle.sort(([a], [b]) => STYLES.indexOf(a) - STYLES.indexOf(b)).map(([style, value]) => `${STYLE_LABELS[style]} ${amount(value)}`).join(" · ")}</dd>
					{byTier.length > 0 && (
						<>
							<dt className="text-gray-400">By tier</dt>
							<dd className="text-gray-200">{byTier.sort(([a], [b]) => tierOrder(a) - tierOrder(b)).map(([tier, value]) => `${tierLabel(tier)} ${value}`).join(" · ")}</dd>
						</>
					)}
				</dl>
			)}
		</div>
	)
}

function tierOrder(tier: RankingTier): number {
	return TIERS.findIndex((entry) => entry.id === tier)
}

function tierLabel(tier: RankingTier): string {
	return TIERS.find((entry) => entry.id === tier)?.label ?? tier
}

function CardRow({ place, rank, card }: { place: number; rank: CardRank; card: CatalogueSupportCard | undefined }) {
	const parts = [`${rank.decks} ${rank.decks === 1 ? "deck" : "decks"}`]
	if (rank.borrows > 0) parts.push(`${rank.borrows} borrowed`)
	if (rank.alternatives > 0) parts.push(`also an alternative in ${rank.alternatives}`)
	return (
		<RankRow
			place={place}
			name={card?.name ?? "Unknown card"}
			art={card?.image ? <img src={card.image} alt="" loading="lazy" decoding="async" className="block aspect-[3/4] w-full rounded object-cover" /> : <span className="block aspect-[3/4] w-full rounded bg-gray-700" />}
			counts={parts.join(" · ")}
			appearances={rank.appearances}
			unit="decks"
		/>
	)
}

function UmaRow({ place, rank, uma }: { place: number; rank: UmaRank; uma: CatalogueUma | undefined }) {
	const oshiIds = useOshiIds()
	return (
		<RankRow
			place={place}
			name={uma?.name ?? "Unknown uma"}
			art={<FramedUma src={uma?.portrait ?? uma?.image} oshi={uma ? oshiIds.has(uma.id) : false} className="w-full" />}
			counts={
				<span className="inline-flex items-center gap-1">
					<Star className="h-3 w-3 fill-recommended text-recommended" aria-hidden="true" />
					{rank.stars} {rank.stars === 1 ? "star" : "stars"} · best {rank.best} · {rank.events.length} {rank.events.length === 1 ? "event" : "events"}
				</span>
			}
			appearances={rank.appearances}
			unit="stars"
		/>
	)
}
