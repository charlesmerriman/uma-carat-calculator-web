/**
 * The Rankings page's PvP tab (`?view=pvp`), one event at a time: what
 * players build (every finished saved team, posted or not; the PvP page's own
 * Rankings view counts only the gallery), what wins (CM Runs' win rate
 * per uma and strategy, utils/runResults.ts, with the average place and top-3
 * rate where enough races have places), and what beats players (each uma's
 * share of the losses players named; notes/cm-runs-plan-2.md, mock 05).
 *
 * THE REDESIGN (notes/rankings-redesign-plan.md step 2, mocks 09, 10, 21;
 * the 2026-11-25 polish, notes/rankings-polish-plan.md, canvas shot 08):
 * the event strip, the hero (the uma built most, on her colours, with the
 * best win rate, the uma that beats players most and the gallery's posts
 * beside her), then two ranked lists on the kit (umas with a
 * stacked style bar, cards in their decks), "What wins" with how much to
 * trust each rate, and "Your team". An opened uma row reads her build rate,
 * her share of the gallery's posts and her CM Runs win rate together.
 * "Trios players build most" reads the server's exact three-uma teams. The
 * two lists are TeamLists.tsx, shared with the PvP page's Rankings view.
 *
 * THE EVENT: `?event=cm-21`, like the PvP page, then the one remembered on
 * the device (rankingsPinStore choices, shared with the pinned window), then
 * the one running now or next. Picking writes both.
 *
 * SHARES, NOT COUNTS (owner, 2026-10-28): nothing here says how many teams
 * were saved, races logged or players took part, so no one can estimate the
 * site's players from it; the server sends shares and win rates only
 * (types/rankingsTabs.ts). Gallery posts are public, so their count stays.
 */

import { useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Loader2 } from "lucide-react"
import type { RaceEvent } from "../../types"
import type { BeatenByRow, PvpRankingsPayload, WinRateRow } from "../../types/rankingsTabs"
import { useCalculatorData } from "../../services/CalculatorContext"
import { chooseRankings, useRankingsChoices } from "../../services/rankingsPinStore"
import { useRankingsPayload } from "../../hooks/useRankingsPayload"
import { useGalleryRankings } from "../../hooks/useGalleryRankings"
import { usePvpCatalogue, type PvpCatalogueIndex } from "../../hooks/usePvpCatalogue"
import { useOshiIds } from "../../hooks/useOshiIds"
import { useEncyclopediaHrefs } from "../../hooks/useEncyclopediaHrefs"
import { FramedUma } from "../FramedUma"
import { STYLE_LABELS, defaultPvpEvent, findEvent, raceEventsInOrder } from "../../utils/pvpGuide"
import { PVP_EVENT_PARAM, formatPvpEvent, parsePvpEvent, refForRaceEvent, splitEventName } from "../../utils/pvpEvent"
import { formatShare } from "../../utils/guideRankings"
import { winRates } from "../../utils/runResults"
import { movement } from "../../utils/rankingsMovement"
import { useReportUpdated } from "./rankingsUpdated"
import { Bar } from "./kit/Bar"
import { Detail, DetailBlock } from "./kit/Detail"
import { RankRow } from "./kit/RankRow"
import { RankedList } from "./kit/RankedList"
import { RankHero } from "./kit/RankHero"
import { StyleLegend } from "./kit/StyleLegend"
import { stylePart } from "./kit/stylePart"
import { CardBuildList, TrioList, UmaBuildList } from "./TeamLists"
import { knownUmas, stylesOf, type UmaBuildRow } from "./teamCounts"
import { EventStrip } from "./EventStrip"
import { YourTeam } from "./YourTeam"
import { hoverCardProps } from "../../utils/hoverCards"

const PANEL_NOTE = "rk-panel p-4 text-sm text-gray-300"
/** Two lists side by side when both fit at 26rem, else stacked: by the container, like the kit. */
const GRID = "grid items-start gap-3.5 grid-cols-[repeat(auto-fit,minmax(min(100%,26rem),1fr))]"

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
	const key = event ? `${event.event_type}-${event.id}` : ""

	const pick = (next: RaceEvent) => {
		const value = formatPvpEvent(refForRaceEvent(next))
		chooseRankings("pvp", { event: value })
		const params = new URLSearchParams(searchParams)
		params.set(PVP_EVENT_PARAM, value)
		setSearchParams(params)
	}

	if (!event || !anchor) return <p className={PANEL_NOTE}>No PvP events are listed yet.</p>
	return (
		<div className="flex flex-col gap-[1.125rem]">
			<EventStrip events={events} anchor={anchor} chosen={event} now={now} onPick={pick} />
			{/* Keyed by the event, so a new one starts fresh. */}
			<PvpEventRankings key={key} event={event} />
		</div>
	)
}

function PvpEventRankings({ event }: { event: RaceEvent }) {
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
	return <PvpBody event={event} payload={state.payload} catalogue={catalogue} />
}

function PvpBody({ event, payload, catalogue }: { event: RaceEvent; payload: PvpRankingsPayload; catalogue: PvpCatalogueIndex }) {
	useReportUpdated(payload.generated_at)
	const gallery = useGalleryRankings(refForRaceEvent(event))
	const { built, runs } = payload
	const umas = knownUmas(built, catalogue)
	// The hero: the uma built most; beside her the best ranked win rate and the uma
	// players lose to most (the first row of What beats players the catalogue knows).
	const topUma = umas[0] ? catalogue.umasById.get(umas[0].uma) : undefined
	const bestRate = winRates(runs).ranked.find((row) => catalogue.umasById.has(row.uma))
	const beatsMost = (payload.beaten_by ?? []).find((row) => catalogue.umasById.has(row.uma))
	const pairs = catalogue.catalogue.character_colours
	const oshiIds = useOshiIds()
	const hrefs = useEncyclopediaHrefs()
	// Rank movement against the week's start (the server's snapshot), by id.
	const umaMoves = movement(built.umas.map((row) => row.uma), payload.previous?.umas)
	const cardMoves = movement(built.cards.map((row) => row.card), payload.previous?.cards)
	const posted = gallery.status === "ready" ? gallery.payload : null
	const { title } = splitEventName(event)

	/** An uma opened: her strategies, her share of the gallery's posts, her CM Runs win rate per strategy. */
	const umaDetail = (row: UmaBuildRow) => {
		const styles = stylesOf(row)
		const inGallery = posted?.umas.find((entry) => entry.uma === row.uma)?.share ?? 0
		// A rate per strategy: the server sends no races to add two of them up by.
		const raced = runs.filter((entry) => entry.uma === row.uma)
		return (
			<Detail>
				<DetailBlock heading="By strategy">
					<Bar fill={1} parts={styles.map(([style, share]) => stylePart(style, share))} />
					<StyleLegend entries={styles.map(([style, share]) => [style, formatShare(share)])} />
				</DetailBlock>
				{posted && (
					<DetailBlock heading="Posted to the gallery">
						<span className="text-[13px] text-gray-300">
							{inGallery > 0 ? (
								<>
									In <b className="font-semibold text-gray-100">{formatShare(inGallery)}</b> of the{" "}
									{plural(posted.posts, "posted team")}
								</>
							) : (
								`In none of the ${plural(posted.posts, "posted team")}`
							)}
						</span>
					</DetailBlock>
				)}
				<DetailBlock heading="In CM Runs">
					<span className="text-[13px] text-gray-300">
						{raced.length > 0
							? raced.map((entry, index) => (
									<span key={entry.style}>
										{index > 0 && " · "}
										{STYLE_LABELS[entry.style]} wins <b className="font-semibold text-gray-100">{formatShare(entry.rate)}</b>
										{placeText(entry) && `, ${placeText(entry)}`}
									</span>
								))
							: "Not enough races logged yet"}
					</span>
				</DetailBlock>
			</Detail>
		)
	}

	return (
		<div className="flex flex-col gap-[1.125rem]">
			<RankHero
				title={`${title}: what players build, and what wins`}
				top={
					topUma
						? {
								place: "#1 most built",
								name: topUma.name,
								line: (
									<>
										On <b>{formatShare(umas[0].share)}</b> of the teams saved for this event
									</>
								),
								art: <FramedUma src={topUma.portrait ?? topUma.image} layers={topUma.portrait_layers} oshi={oshiIds.has(topUma.id)} className="enc-hero__art" />,
								shape: "uma",
								colours: topUma.character_id != null ? pairs?.[String(topUma.character_id)] : undefined,
								href: hrefs.uma(topUma.id),
								hover: hoverCardProps("uma", topUma.id),
							}
						: null
				}
				figures={[
					...(bestRate ? [{ label: "Best win rate", value: formatShare(bestRate.rate), suffix: catalogue.umasById.get(bestRate.uma)?.name }] : []),
					...(beatsMost ? [{ label: "Beats players most", value: formatShare(beatsMost.share), suffix: catalogue.umasById.get(beatsMost.uma)?.name }] : []),
					...(gallery.status === "error" || gallery.status === "refused"
						? []
						: [{ label: "Posted to the gallery", value: posted ? posted.posts.toLocaleString() : "…" }]),
				]}
			/>

			{built.umas.length === 0 ? (
				<p className={PANEL_NOTE}>Nobody has saved a team for this event yet.</p>
			) : (
				<div className={GRID}>
					<UmaBuildList
						label="Umas players build"
						hint="Share of teams with her. The bar is split by running style."
						counts={built}
						catalogue={catalogue}
						detail={umaDetail}
						moves={umaMoves}
					/>
					<CardBuildList
						label="Cards in their decks"
						hint="Share of member decks with the card, the borrowed one included."
						counts={built}
						catalogue={catalogue}
						moves={cardMoves}
					/>
				</div>
			)}

			<div className={GRID}>
				<WhatWins runs={runs} umas={umas} catalogue={catalogue} previous={payload.previous?.runs} />
				{/* Beside What wins at the top of the column (mock 05). A payload cached before api #321 has no list. */}
				<div className="flex min-w-0 flex-col gap-3">
					<WhatBeatsPlayers rows={payload.beaten_by ?? []} catalogue={catalogue} />
					{built.trios && <TrioList trios={built.trios} catalogue={catalogue} />}
					<YourTeam event={event} ranked={umas.map((row) => row.uma)} catalogue={catalogue} />
				</div>
			</div>
		</div>
	)
}

/**
 * Win rates from CM Runs, ranked from 100 races up; thinner rows (from the
 * server's floor) sit under them, muted, with no place. The server ranks them. Each rate carries
 * its confidence marks. The bar is the running green, scaled to the best
 * ranked rate.
 */
function WhatWins({ runs, umas, catalogue, previous }: {
	runs: PvpRankingsPayload["runs"]
	umas: PvpRankingsPayload["built"]["umas"]
	catalogue: PvpCatalogueIndex
	/** The ranked rows at the week's start, as "<uma>-<style>". */
	previous: string[] | undefined
}) {
	const oshiIds = useOshiIds()
	const hrefs = useEncyclopediaHrefs()
	const known = (row: WinRateRow) => catalogue.umasById.has(row.uma)
	const rates = winRates(runs)
	const ranked = rates.ranked.filter(known)
	const unranked = rates.unranked.filter(known)
	const leader = ranked[0]?.rate ?? unranked[0]?.rate ?? 0
	// Only a ranked row has a place to move from.
	const moves = movement(rates.ranked.map((entry) => `${entry.uma}-${entry.style}`), previous)
	const row = (entry: WinRateRow, place: number | null) => {
		const uma = catalogue.umasById.get(entry.uma)
		const styleShare = umas.find((built) => built.uma === entry.uma)?.styles[entry.style] ?? 0
		return (
			<RankRow
				place={place}
				muted={place === null}
				movement={place === null ? undefined : moves.get(`${entry.uma}-${entry.style}`)}
				// At full strength under the floor too: the muted name and the missing place say it (nothing is dimmed).
				art={<FramedUma src={uma?.portrait ?? uma?.image} layers={uma?.portrait_layers} oshi={oshiIds.has(entry.uma)} className="w-14" />}
				name={uma?.name ?? "Unknown uma"}
				sub={
					<span>
						{STYLE_LABELS[entry.style]}
						{styleShare > 0 && ` · ${formatShare(styleShare)} of teams`}
					</span>
				}
				// Its own line: at the end of the sub it was cut off on a phone.
				note={placeText(entry) || undefined}
				fill={leader > 0 ? Math.min(1, entry.rate / leader) : 0}
				tone="win"
				count={formatShare(entry.rate)}
				share={<Marks marks={entry.marks} />}
				href={hrefs.uma(entry.uma)}
				hover={hoverCardProps("uma", entry.uma)}
			/>
		)
	}
	return (
		<RankedList
			label="What wins"
			title
			hint="Win rate from CM Runs, with how much to trust it. Under 100 races sinks to the bottom. Average place and top 3 count the races with places, once there are 20."
			items={ranked}
			itemKey={(entry) => `${entry.uma}-${entry.style}`}
			empty="Not enough runs yet."
			render={(entry, index) => row(entry, index + 1)}
			after={unranked.map((entry) => <li key={`${entry.uma}-${entry.style}`}>{row(entry, null)}</li>)}
		/>
	)
}

/**
 * "avg place 3.1, top 3 in 58%", or "" when the server sent no places (under
 * 20 placed races, or a payload cached before api #321).
 */
function placeText(entry: WinRateRow): string {
	if (entry.avg_place == null) return ""
	const top3 = entry.top3 == null ? "" : `, top 3 in ${formatShare(entry.top3)}`
	return `avg place ${entry.avg_place.toFixed(1)}${top3}`
}

/**
 * "What beats players" (notes/cm-runs-plan-2.md, mock 05): each uma's share
 * of the event's named losses, the losses where the player said which uma
 * won. Shares only, most first, as the server sends them; nothing until the
 * event has 20 named losses, and a row from 5. The bar is the loss red,
 * scaled to the top row.
 */
function WhatBeatsPlayers({ rows, catalogue }: { rows: BeatenByRow[]; catalogue: PvpCatalogueIndex }) {
	const oshiIds = useOshiIds()
	const hrefs = useEncyclopediaHrefs()
	const known = rows.filter((row) => catalogue.umasById.has(row.uma))
	const leader = known[0]?.share ?? 0
	return (
		<RankedList
			label="What beats players"
			title
			hint="Share of the losses players named that each uma won. A loss counts here once the player says who won it."
			items={known}
			itemKey={(row) => row.uma}
			empty="Not enough named losses yet."
			render={(row, index) => {
				const uma = catalogue.umasById.get(row.uma)
				return (
					<RankRow
						place={index + 1}
						art={<FramedUma src={uma?.portrait ?? uma?.image} layers={uma?.portrait_layers} oshi={oshiIds.has(row.uma)} className="w-14" />}
						name={uma?.name ?? "Unknown uma"}
						fill={leader > 0 ? Math.min(1, row.share / leader) : 0}
						tone="loss"
						count={formatShare(row.share)}
						href={hrefs.uma(row.uma)}
						hover={hoverCardProps("uma", row.uma)}
					/>
				)
			}}
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
