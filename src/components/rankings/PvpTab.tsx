/**
 * The Rankings page's PvP tab (`?view=pvp`), one event at a time: what
 * players build (every saved team, posted or not; the PvP page's own
 * Rankings view counts only the gallery) and what wins (CM Runs' win rate
 * per uma and strategy, utils/runResults.ts).
 *
 * THE REDESIGN (notes/rankings-redesign-plan.md step 2, mocks 09, 10, 21):
 * the event strip, the band, then two ranked lists on the kit (umas with a
 * stacked style bar, cards in their decks), "What wins" with how much to
 * trust each rate, and "Your team". An opened uma row reads her build rate,
 * her share of the gallery's posts and her CM Runs win rate together.
 * "Trios players build most" comes in step 4 with the server's figure.
 *
 * THE EVENT: `?event=cm-21`, like the PvP page, then the one remembered on
 * the device (rankingsPinStore choices, shared with the pinned window), then
 * the one running now or next. Picking writes both.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Loader2 } from "lucide-react"
import type { RaceEvent } from "../../types"
import type { PvpStyle } from "../../types/pvpGuide"
import type { PvpRankingsPayload } from "../../types/rankingsTabs"
import { useCalculatorData } from "../../services/CalculatorContext"
import { chooseRankings, useRankingsChoices } from "../../services/rankingsPinStore"
import { useRankingsPayload } from "../../hooks/useRankingsPayload"
import { useGalleryRankings } from "../../hooks/useGalleryRankings"
import { usePvpCatalogue, type PvpCatalogueIndex } from "../../hooks/usePvpCatalogue"
import { useOshiIds } from "../../hooks/useOshiIds"
import { FramedUma } from "../FramedUma"
import { STYLE_LABELS, defaultPvpEvent, findEvent, raceEventsInOrder } from "../../utils/pvpGuide"
import { PVP_EVENT_PARAM, formatPvpEvent, parsePvpEvent, refForRaceEvent, shortEventName, splitEventName } from "../../utils/pvpEvent"
import { formatShare } from "../../utils/guideRankings"
import { winRates, type WinRateRow } from "../../utils/runResults"
import { useReportUpdated } from "./rankingsUpdated"
import { Bar } from "./kit/Bar"
import { CardArt } from "./kit/CardArt"
import { CardTypeChip } from "./kit/CardTypeChip"
import { Detail, DetailBlock } from "./kit/Detail"
import { RankRow } from "./kit/RankRow"
import { RankedList } from "./kit/RankedList"
import { StatBand } from "./kit/StatBand"
import { StyleLegend } from "./kit/StyleLegend"
import { stylePart } from "./kit/stylePart"
import { EventStrip } from "./EventStrip"
import { YourTeam } from "./YourTeam"

const STYLES: Exclude<PvpStyle, "everyone">[] = ["runaway", "front", "pace", "late", "end"]
const PANEL_NOTE = "rounded-xl border border-edge bg-gray-800/60 p-4 text-sm text-gray-300"
/** Two lists side by side when both fit at 26rem, else stacked: by the container, like the kit. */
const GRID = "grid items-start gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,26rem),1fr))]"

const plural = (count: number, one: string, many = `${one}s`) => `${count.toLocaleString()} ${count === 1 ? one : many}`

export function PvpTab() {
	const { championsMeetingData, leagueOfHeroesData } = useCalculatorData()
	const events = useMemo(() => raceEventsInOrder(championsMeetingData, leagueOfHeroesData), [championsMeetingData, leagueOfHeroesData])
	const [searchParams, setSearchParams] = useSearchParams()
	const remembered = useRankingsChoices().pvp?.event
	// One clock reading per mount, for the default event and the strip's statuses.
	const [now] = useState(() => new Date())
	const anchor = defaultPvpEvent(events, now)
	const fromAddress = findEvent(events, parsePvpEvent(searchParams.get(PVP_EVENT_PARAM)))
	const event = fromAddress ?? findEvent(events, parsePvpEvent(remembered)) ?? anchor
	const [teams, setTeams] = useState<{ key: string; teams: number } | null>(null)
	const key = event ? `${event.event_type}-${event.id}` : ""
	// Stable per event, so the body's effect reports once.
	const onTeams = useCallback((count: number) => setTeams({ key, teams: count }), [key])

	const pick = (next: RaceEvent) => {
		const value = formatPvpEvent(refForRaceEvent(next))
		chooseRankings("pvp", { event: value })
		const params = new URLSearchParams(searchParams)
		params.set(PVP_EVENT_PARAM, value)
		setSearchParams(params)
	}

	if (!event || !anchor) return <p className={PANEL_NOTE}>No PvP events are listed yet.</p>
	return (
		<div className="flex flex-col gap-3.5">
			<EventStrip events={events} anchor={anchor} chosen={event} teams={teams?.key === key ? teams.teams : null} now={now} onPick={pick} />
			{/* Keyed by the event, so a new one starts fresh. */}
			<PvpEventRankings key={key} event={event} onTeams={onTeams} />
		</div>
	)
}

function PvpEventRankings({ event, onTeams }: { event: RaceEvent; onTeams: (teams: number) => void }) {
	const ref = refForRaceEvent(event)
	const state = useRankingsPayload<PvpRankingsPayload>(`/rankings/pvp/${ref.kind}/${ref.id}`)
	const catalogue = usePvpCatalogue()
	if (state.status === "refused") return <p className={PANEL_NOTE}>Rankings are open to supporters first.</p>
	if (state.status === "error" || catalogue.status === "error") {
		return <p className={PANEL_NOTE}>The rankings didn't load. Reload the page to try again.</p>
	}
	if (state.status !== "ready" || catalogue.status !== "ready") {
		return (
			<div className="flex items-center gap-2 text-sm text-gray-400" role="status">
				<Loader2 className="h-4 w-4 animate-spin" />
				Counting the teams...
			</div>
		)
	}
	return <PvpBody event={event} payload={state.payload} catalogue={catalogue} onTeams={onTeams} />
}

function PvpBody({ event, payload, catalogue, onTeams }: {
	event: RaceEvent
	payload: PvpRankingsPayload
	catalogue: PvpCatalogueIndex
	onTeams: (teams: number) => void
}) {
	useReportUpdated(payload.generated_at)
	// The strip shows the chosen event's team count once its payload is in.
	useEffect(() => onTeams(payload.built.teams), [onTeams, payload.built.teams])
	const oshiIds = useOshiIds()
	const gallery = useGalleryRankings(refForRaceEvent(event))
	const { built, runs } = payload
	// An id that left the catalogue can't be drawn, so it is left off.
	const umas = built.umas.filter((row) => catalogue.umasById.has(row.uma))
	const cards = built.cards.filter((row) => catalogue.cardsById.has(row.card))
	const posted = gallery.status === "ready" ? gallery.payload : null
	const { title } = splitEventName(event)
	const short = shortEventName(event)

	const umaLeader = umas[0]?.teams ?? 0
	const cardLeader = cards[0]?.decks ?? 0
	const stylesOf = (row: (typeof umas)[number]) =>
		STYLES.filter((style) => (row.styles[style] ?? 0) > 0).map((style) => [style, row.styles[style] ?? 0] as [PvpStyle, number])
	const usedStyles = STYLES.filter((style) => umas.some((row) => (row.styles[style] ?? 0) > 0))

	return (
		<div className="flex flex-col gap-3.5">
			<StatBand
				title={`${title}: what players build, and what wins`}
				stats={[
					{ label: "Saved teams", value: built.teams.toLocaleString() },
					...(gallery.status === "error" || gallery.status === "refused"
						? []
						: [{ label: "Posted to the gallery", value: posted ? posted.posts.toLocaleString() : "…" }]),
					{ label: "Races logged", value: runs.races.toLocaleString(), suffix: runs.players > 0 ? `by ${plural(runs.players, "player")}` : undefined },
				]}
			>
				Every team saved for {short} on the site, posted or not, and every ticket logged in CM Runs.
			</StatBand>

			{built.teams === 0 ? (
				<p className={PANEL_NOTE}>Nobody has saved a team for this event yet.</p>
			) : (
				<div className={GRID}>
					<RankedList
						label="Umas players build"
						title
						hint="Teams with her. The bar is split by running style."
						items={umas}
						itemKey={(row) => row.uma}
						empty="No uma to show."
						footnote={<StyleLegend entries={usedStyles.map((style) => [style, null])} />}
						render={(row, index) => {
							const uma = catalogue.umasById.get(row.uma)
							const styles = stylesOf(row)
							const inGallery = posted?.umas.find((entry) => entry.uma === row.uma)?.teams ?? 0
							const raced = runs.rows.filter((entry) => entry.uma === row.uma)
							const races = raced.reduce((sum, entry) => sum + entry.races, 0)
							const wins = raced.reduce((sum, entry) => sum + entry.wins, 0)
							return (
								<RankRow
									place={index + 1}
									art={<FramedUma src={uma?.portrait ?? uma?.image} oshi={oshiIds.has(row.uma)} className="w-12" />}
									name={uma?.name ?? "Unknown uma"}
									fill={umaLeader > 0 ? row.teams / umaLeader : 0}
									parts={styles.map(([style, count]) => stylePart(style, count))}
									count={plural(row.teams, "team")}
									share={formatShare(built.teams ? row.teams / built.teams : 0)}
									detail={
										<Detail>
											<DetailBlock heading="By strategy">
												<Bar fill={1} parts={styles.map(([style, count]) => stylePart(style, count))} />
												<StyleLegend entries={styles} />
											</DetailBlock>
											{posted && (
												<DetailBlock heading="Posted to the gallery">
													<span className="text-[11px] text-gray-300">
														{inGallery > 0 ? (
															<>
																In <b className="font-semibold text-gray-100">{formatShare(inGallery / posted.posts)}</b> of the{" "}
																{plural(posted.posts, "posted team")}
															</>
														) : (
															`In none of the ${plural(posted.posts, "posted team")}`
														)}
													</span>
												</DetailBlock>
											)}
											<DetailBlock heading="In CM Runs">
												<span className="text-[11px] text-gray-300">
													{races > 0 ? (
														<>
															Wins <b className="font-semibold text-gray-100">{formatShare(wins / races)}</b> of {plural(races, "race")}
														</>
													) : (
														"No races logged yet"
													)}
												</span>
											</DetailBlock>
										</Detail>
									}
								/>
							)
						}}
					/>
					<RankedList
						label="Cards in their decks"
						title
						hint="Member decks with the card, the borrowed one included."
						items={cards}
						itemKey={(row) => row.card}
						empty="No card to show."
						render={(row, index) => {
							const card = catalogue.cardsById.get(row.card)
							return (
								<RankRow
									place={index + 1}
									art={<CardArt card={card} />}
									name={card?.name ?? "Unknown card"}
									sub={
										<>
											<CardTypeChip type={card?.card_type} />
											{row.borrows > 0 && <span>{row.borrows.toLocaleString()} borrowed</span>}
										</>
									}
									fill={cardLeader > 0 ? row.decks / cardLeader : 0}
									count={plural(row.decks, "deck")}
									share={formatShare(built.decks ? row.decks / built.decks : 0)}
								/>
							)
						}}
					/>
				</div>
			)}

			<div className={GRID}>
				<WhatWins runs={runs} umas={umas} teams={built.teams} catalogue={catalogue} />
				<YourTeam event={event} ranked={umas.map((row) => row.uma)} catalogue={catalogue} />
			</div>
		</div>
	)
}

/**
 * Win rates from CM Runs, ranked from RANKED_RACES up; thinner rows (from the
 * server's floor) sit under them, muted, with no place. Each rate carries
 * its confidence marks. The bar is the running green, scaled to the best
 * ranked rate.
 */
function WhatWins({ runs, umas, teams, catalogue }: {
	runs: PvpRankingsPayload["runs"]
	umas: PvpRankingsPayload["built"]["umas"]
	teams: number
	catalogue: PvpCatalogueIndex
}) {
	const oshiIds = useOshiIds()
	const known = (row: WinRateRow) => catalogue.umasById.has(row.uma)
	const rates = winRates(runs.rows, runs.min_races)
	const ranked = rates.ranked.filter(known)
	const unranked = rates.unranked.filter(known)
	const leader = ranked[0]?.rate ?? unranked[0]?.rate ?? 0
	const row = (entry: WinRateRow, place: number | null) => {
		const uma = catalogue.umasById.get(entry.uma)
		const styleTeams = umas.find((built) => built.uma === entry.uma)?.styles[entry.style] ?? 0
		return (
			<RankRow
				place={place}
				muted={place === null}
				art={<FramedUma src={uma?.portrait ?? uma?.image} oshi={oshiIds.has(entry.uma)} className={`w-12 ${place === null ? "opacity-60" : ""}`} />}
				name={uma?.name ?? "Unknown uma"}
				sub={
					<span>
						{STYLE_LABELS[entry.style]}
						{teams > 0 && ` · ${formatShare(styleTeams / teams)} of teams`}
					</span>
				}
				fill={leader > 0 ? Math.min(1, entry.rate / leader) : 0}
				tone="win"
				count={formatShare(entry.rate)}
				share={
					<span className="inline-flex items-center gap-1.5">
						{plural(entry.races, "race")}
						<Marks marks={entry.marks} />
					</span>
				}
			/>
		)
	}
	return (
		<RankedList
			label="What wins"
			title
			hint={`Win rate from CM Runs, with how much to trust it. Under 100 races sinks to the bottom. From ${plural(runs.players, "player")}.`}
			items={ranked}
			itemKey={(entry) => `${entry.uma}-${entry.style}`}
			empty="Not enough runs yet."
			render={(entry, index) => row(entry, index + 1)}
			after={
				unranked.length > 0
					? unranked.map((entry) => <li key={`${entry.uma}-${entry.style}`}>{row(entry, null)}</li>)
					: undefined
			}
		/>
	)
}

/** One to three small bars: how much to trust a win rate (20, 100, 300 races). */
function Marks({ marks }: { marks: 1 | 2 | 3 }) {
	return (
		<span role="img" aria-label={`Trust ${marks} of 3`} className="inline-flex items-end gap-px">
			{[1, 2, 3].map((step) => (
				<i key={step} className={`inline-block h-2.5 w-[3px] rounded-[1px] ${step <= marks ? "bg-status-running" : "bg-gray-600"}`} />
			))}
		</span>
	)
}
