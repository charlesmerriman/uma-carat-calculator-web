/**
 * The Rankings page's PvP tab (`?view=pvp`), one event at a time: "Teams
 * players build" counts every saved team (posted or not; the PvP page's own
 * Rankings view counts only the gallery), and "What wins" is CM Runs' win
 * rate per uma and strategy (utils/runResults.ts), shown only where there
 * are enough races.
 *
 * The event is `?event=cm-21`, like the PvP page, defaulting to the one
 * running now or the next. In the pinned panel it is the panel's own state:
 * the address bar there belongs to the page underneath.
 */

import { useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Loader2 } from "lucide-react"
import type { RaceEvent } from "../../types"
import type { PvpRankingsPayload } from "../../types/rankingsTabs"
import type { PvpEventRef } from "../../utils/pvpEvent"
import { useCalculatorData } from "../../services/CalculatorContext"
import { useRankingsPayload } from "../../hooks/useRankingsPayload"
import { usePvpCatalogue, type PvpCatalogueIndex } from "../../hooks/usePvpCatalogue"
import { useOshiIds } from "../../hooks/useOshiIds"
import { FramedUma } from "../FramedUma"
import { STYLE_LABELS, defaultPvpEvent, findEvent, raceEventsInOrder } from "../../utils/pvpGuide"
import { PVP_EVENT_PARAM, formatPvpEvent, parsePvpEvent, refForRaceEvent } from "../../utils/pvpEvent"
import { formatDate } from "../../utils/dateFormat"
import { formatTimeAgo } from "../../utils/relativeDate"
import { formatShare } from "../../utils/guideRankings"
import { winRates } from "../../utils/runResults"
import { TeamCounts } from "./TeamCounts"

const PANEL_NOTE = "rounded-xl border border-edge bg-gray-800/60 p-4 text-sm text-gray-300"
const CELL = "px-2 py-1.5 text-right tabular-nums"

export function PvpTab({ inPanel = false }: { inPanel?: boolean }) {
	const { championsMeetingData, leagueOfHeroesData } = useCalculatorData()
	const events = useMemo(() => raceEventsInOrder(championsMeetingData, leagueOfHeroesData), [championsMeetingData, leagueOfHeroesData])
	const [searchParams, setSearchParams] = useSearchParams()
	const [panelRef, setPanelRef] = useState<PvpEventRef | null>(null)
	// One clock reading per mount, for the default event.
	const [now] = useState(() => new Date())
	const chosen = inPanel ? panelRef : parsePvpEvent(searchParams.get(PVP_EVENT_PARAM))
	const event = findEvent(events, chosen) ?? defaultPvpEvent(events, now)

	const pick = (next: RaceEvent) => {
		if (inPanel) {
			setPanelRef(refForRaceEvent(next))
			return
		}
		const params = new URLSearchParams(searchParams)
		params.set(PVP_EVENT_PARAM, formatPvpEvent(refForRaceEvent(next)))
		setSearchParams(params)
	}

	if (!event) return <p className={PANEL_NOTE}>No PvP events are listed yet.</p>
	return (
		<div className="flex flex-col gap-4">
			<label className="flex items-center gap-2 text-sm text-gray-300">
				Event
				<select
					value={events.indexOf(event)}
					onChange={(change) => pick(events[Number(change.target.value)])}
					className="min-w-0 rounded-md border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-gray-100 focus:border-brand focus:outline-none"
				>
					{events.map((option, index) => (
						<option key={`${option.event_type}-${option.id}`} value={index}>
							{option.name}
						</option>
					))}
				</select>
			</label>
			{/* Keyed by the event, so a new one starts fresh. */}
			<PvpEventRankings key={`${event.event_type}-${event.id}`} event={event} />
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
	const { payload } = state
	return (
		<div className="flex flex-col gap-6">
			<section className="flex flex-col gap-3" aria-label="Teams players build">
				<div className="flex flex-col gap-0.5">
					<h2 className="font-display text-lg font-bold text-gray-100">Teams players build</h2>
					<p className="text-xs text-gray-400">
						{payload.built.teams === 0
							? "Nobody has saved a team for this event yet. "
							: `Every team saved for this event on the site, posted or not: ${payload.built.teams.toLocaleString()} ${payload.built.teams === 1 ? "team" : "teams"}. `}
						<time dateTime={payload.generated_at} title={formatDate(payload.generated_at)}>
							Updated {formatTimeAgo(payload.generated_at)}.
						</time>
					</p>
				</div>
				{payload.built.teams > 0 && (
					<TeamCounts
						counts={payload.built}
						catalogue={catalogue}
						umaHint="Saved teams with her, and the strategies they run her on."
						cardHint="Decks with the card, the borrowed card included."
					/>
				)}
			</section>
			<WhatWins runs={payload.runs} catalogue={catalogue} />
		</div>
	)
}

function WhatWins({ runs, catalogue }: { runs: PvpRankingsPayload["runs"]; catalogue: PvpCatalogueIndex }) {
	const oshiIds = useOshiIds()
	const rows = winRates(runs.rows, runs.min_races).filter((row) => catalogue.umasById.has(row.uma))
	return (
		<section className="card-panel flex min-w-0 flex-col gap-3 p-3 sm:p-4" aria-label="What wins">
			<div className="flex flex-col gap-0.5">
				<h2 className="font-display text-base font-bold text-brand">What wins</h2>
				<p className="text-xs text-gray-400">
					From the tickets players log in CM Runs: {runs.players.toLocaleString()} {runs.players === 1 ? "player" : "players"},{" "}
					{runs.races.toLocaleString()} {runs.races === 1 ? "race" : "races"}. Wins are races she finished first. Only umas with at
					least {runs.min_races} races are shown.
				</p>
			</div>
			{rows.length === 0 ? (
				<p className="text-sm text-gray-400">Not enough runs yet.</p>
			) : (
				<div className="overflow-x-auto">
					<table className="w-full min-w-[26rem] text-sm">
						<thead className="text-xs text-gray-400">
							<tr className="border-b border-gray-700">
								<th scope="col" className="px-2 py-1.5 text-left font-semibold">Uma</th>
								<th scope="col" className="px-2 py-1.5 text-left font-semibold">Strategy</th>
								<th scope="col" className={`${CELL} font-semibold`}>Races</th>
								<th scope="col" className={`${CELL} font-semibold`}>Wins</th>
								<th scope="col" className={`${CELL} font-semibold`}>Win rate</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-700/70 text-gray-200">
							{rows.map((row) => {
								const uma = catalogue.umasById.get(row.uma)
								return (
									<tr key={`${row.uma}-${row.style}`}>
										<td className="px-2 py-1.5">
											<span className="flex min-w-0 items-center gap-2">
												<span className="w-7 shrink-0">
													<FramedUma src={uma?.portrait ?? uma?.image} oshi={oshiIds.has(row.uma)} className="w-full" />
												</span>
												<span className="truncate">{uma?.name}</span>
											</span>
										</td>
										<td className="px-2 py-1.5">{STYLE_LABELS[row.style]}</td>
										<td className={CELL}>{row.races.toLocaleString()}</td>
										<td className={CELL}>{row.wins.toLocaleString()}</td>
										<td className={CELL}>{formatShare(row.rate)}</td>
									</tr>
								)
							})}
						</tbody>
					</table>
				</div>
			)}
		</section>
	)
}
