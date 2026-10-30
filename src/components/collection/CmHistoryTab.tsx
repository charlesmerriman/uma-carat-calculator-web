/**
 * The Collection's CM history tab (`?tab=history`): every event the player
 * logged in CM Runs, newest first, and each veteran's record across all of
 * them (notes/cm-runs-plan.md, section 3; Henry's "have your account keep
 * track of previous CM results").
 *
 * Read only. The runs are written in CM Runs, and each event's line links
 * back there. The counting is CM Runs' own (utils/pvpRuns.ts: summarizeRuns,
 * bestTicketWins), so an event's numbers here match its CM Runs tab: days 1
 * to 4 make the win rate, and the Finals race counts on its own.
 */

import { useMemo, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { History, Loader2 } from "lucide-react"
import { useCalculatorData } from "../../services/CalculatorContext"
import { usePvpRunHistory } from "../../services/pvpRunQueries"
import { useTrainedUmas } from "../../services/trainedUmaQueries"
import { usePvpCatalogue } from "../../hooks/usePvpCatalogue"
import { useOshiIds } from "../../hooks/useOshiIds"
import { FramedUma } from "../FramedUma"
import { formatDate } from "../../utils/dateFormat"
import { raceEventsInOrder } from "../../utils/pvpGuide"
import { pvpEventHref, refForRaceEvent, splitEventName } from "../../utils/pvpEvent"
import {
	bestTicketWins,
	eventHistory,
	formatRate,
	ordinal,
	RUN_RACES,
	ticketCounts,
	veteranRecords,
	type EventHistory,
	type Tally,
	type VeteranRecord,
} from "../../utils/pvpRuns"
import { statsTitle, veteranText } from "../../utils/veteranGrade"
import type { CatalogueUma } from "../../types/pvpTeam"
import type { TrainedUma } from "../../types/trainedUma"

const EYEBROW = "text-[10px] font-bold uppercase tracking-[0.08em] text-gray-300 sm:text-[11px]"
const INSET = "rounded-[10px] border border-edge bg-gray-900/60"

export function CmHistoryTab() {
	const history = usePvpRunHistory(true)
	const veterans = useTrainedUmas(true).data
	const catalogue = usePvpCatalogue()
	const oshiIds = useOshiIds()
	const { championsMeetingData, leagueOfHeroesData } = useCalculatorData()
	const events = useMemo(
		() => raceEventsInOrder(championsMeetingData ?? [], leagueOfHeroesData ?? []),
		[championsMeetingData, leagueOfHeroesData]
	)
	const rows = useMemo(() => eventHistory(history.data ?? [], events), [history.data, events])
	const records = useMemo(() => veteranRecords(history.data ?? []), [history.data])

	if (history.isError || catalogue.status === "error") {
		return <Notice>Your CM history didn't load. Reload the page to try again.</Notice>
	}
	if (history.isPending || catalogue.status !== "ready") {
		return (
			<div className="flex items-center gap-2 text-sm text-gray-400" role="status">
				<Loader2 className="h-4 w-4 animate-spin" />
				Loading your CM history…
			</div>
		)
	}
	if (rows.length === 0) {
		return (
			<Notice>
				Nothing logged yet. Log your races in the PvP page's{" "}
				<Link to="/app/pvp?view=runs" className="font-semibold text-brand hover:text-brand/75">
					CM Runs
				</Link>{" "}
				tab and every event adds up here.
			</Notice>
		)
	}
	const { umasById } = catalogue
	return (
		<div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
			<section aria-labelledby="history-events" className="flex min-w-0 flex-col gap-3">
				<h2 id="history-events" className={EYEBROW}>
					By event
				</h2>
				<ol className="flex flex-col gap-3">
					{rows.map((row) => (
						<EventRow key={`${row.event.event_type}-${row.event.id}`} row={row} umasById={umasById} oshiIds={oshiIds} />
					))}
				</ol>
			</section>
			<section aria-labelledby="history-veterans" className="card-panel flex min-w-0 flex-col gap-3.5 p-4">
				<h2 id="history-veterans" className={EYEBROW}>
					By veteran, every event
				</h2>
				{records.length === 0 ? (
					<p className="text-[13px] text-gray-400">
						Pick a veteran for each runner in CM Runs to see which of yours wins most.
					</p>
				) : (
					<ul className="flex flex-col gap-3.5">
						{records.map((record) => (
							<VeteranRow
								key={record.trained_uma}
								record={record}
								veteran={veterans?.find((each) => each.id === record.trained_uma)}
								uma={umasById.get(record.uma)}
								oshi={oshiIds.has(record.uma)}
							/>
						))}
					</ul>
				)}
			</section>
		</div>
	)
}

/**
 * One event: its name and dates, the win rate, each round's best ticket and
 * the Finals (a CM; an LoH has neither yet), and the umas that ran. Links to
 * the event's CM Runs tab.
 */
function EventRow({ row, umasById, oshiIds }: { row: EventHistory; umasById: Map<number, CatalogueUma>; oshiIds: ReadonlySet<number> }) {
	const { event, runs, total, umas, final } = row
	const { kicker, title } = splitEventName(event)
	const isCm = event.event_type === "champions_meeting"
	const { used, skipped } = ticketCounts(runs)
	const runsHref = `${pvpEventHref(refForRaceEvent(event))}&view=runs`
	return (
		<li className="card-panel flex flex-col gap-3.5 p-4">
			<div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
				<div className="min-w-0">
					{kicker && <p className="text-xs font-semibold text-gray-400">{kicker}</p>}
					<h3 className="font-display text-lg font-bold text-gray-50">{title}</h3>
					<p className="text-xs text-gray-400">
						{formatDate(event.start_date)} to {formatDate(event.end_date)}
					</p>
				</div>
				<Link to={runsHref} className="shrink-0 text-sm font-semibold text-brand hover:text-brand/75">
					Open in CM Runs
				</Link>
			</div>
			<div className="flex flex-wrap items-end gap-x-6 gap-y-3">
				<div className="flex items-end gap-3">
					<span className="font-display text-[40px] font-bold leading-[0.9] text-gray-50">{formatRate(total)}</span>
					<span className="flex flex-col gap-0.5 pb-0.5 text-[13px] text-gray-400">
						<span className="text-sm font-semibold text-gray-200">win rate</span>
						<span>{`${total.wins} of ${total.raced} races`}</span>
						<span>{`${used} ${used === 1 ? "ticket" : "tickets"} used${skipped ? `, ${skipped} skipped` : ""}`}</span>
					</span>
				</div>
				{isCm && (
					<dl className="grid min-w-0 flex-1 grid-cols-3 gap-2 sm:max-w-md">
						<Stat label="Round 1 best" value={bestText(runs, 1)} />
						<Stat label="Round 2 best" value={bestText(runs, 2)} />
						<Stat
							label="Finals"
							value={final?.placement ? ordinal(final.placement) : "–"}
							detail={final?.finals_group ? `Group ${final.finals_group}` : final?.placement ? "Group not set" : "Not logged"}
						/>
					</dl>
				)}
			</div>
			{umas.length > 0 && (
				<ul className="flex flex-wrap gap-x-4 gap-y-2.5" aria-label="Umas that ran">
					{umas.map((tally) => {
						const uma = umasById.get(tally.uma)
						return (
							<li key={`${tally.uma}:${tally.trained_uma ?? ""}`} className="flex items-center gap-2">
								<FramedUma src={uma?.portrait ?? uma?.image ?? null} oshi={oshiIds.has(tally.uma)} alt="" className="w-8 shrink-0" />
								<span className="flex flex-col leading-tight">
									<span className="max-w-36 truncate text-[13px] font-semibold text-gray-100" title={uma?.name}>
										{uma?.name ?? "Unknown uma"}
									</span>
									<span className="text-xs text-gray-400">{`${formatRate(tally)}, ${tally.wins} of ${tally.raced}`}</span>
								</span>
							</li>
						)
					})}
				</ul>
			)}
		</li>
	)
}

/** A veteran's record: her portrait, her name linked to her card, the rate with a bar. */
function VeteranRow({ record, veteran, uma, oshi }: { record: VeteranRecord; veteran: TrainedUma | undefined; uma: CatalogueUma | undefined; oshi: boolean }) {
	return (
		<li className="flex items-center gap-3">
			<FramedUma src={uma?.portrait ?? uma?.image ?? null} oshi={oshi} alt="" className="w-10 shrink-0" />
			<div className="flex min-w-0 flex-1 flex-col gap-1.5">
				<div className="flex items-baseline justify-between gap-2">
					<span className="flex min-w-0 flex-col">
						<span className="truncate text-[13px] font-semibold text-gray-100" title={uma?.name}>
							{uma?.name ?? "Unknown uma"}
						</span>
						{veteran ? (
							<Link
								to={`/app/collection?veteran=${veteran.id}`}
								className="truncate text-xs font-bold text-brand hover:text-brand/75"
								title={statsTitle(veteran)}
							>
								{veteranText(veteran)}
							</Link>
						) : (
							<span className="truncate text-xs text-gray-500">(a deleted veteran)</span>
						)}
					</span>
					<span className="font-display text-base font-bold text-gray-50">{formatRate(record)}</span>
				</div>
				<RateBar tally={record} />
				<span className="text-[11px] text-gray-400">
					{`${record.wins} of ${record.raced} races in ${record.events} ${record.events === 1 ? "event" : "events"}`}
				</span>
			</div>
		</li>
	)
}

function RateBar({ tally }: { tally: Tally }) {
	const width = tally.raced ? (tally.wins / tally.raced) * 100 : 0
	return (
		<div className="h-1.5 overflow-hidden rounded-full bg-gray-700" aria-hidden="true">
			<div className="h-full rounded-full bg-brand" style={{ width: `${width}%` }} />
		</div>
	)
}

/** "4 of 5", or an en dash when the round has nothing raced. */
function bestText(runs: EventHistory["runs"], round: number): string {
	const best = bestTicketWins(runs, round)
	return best === null ? "–" : `${best} of ${RUN_RACES}`
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
	return (
		<div className={`${INSET} min-w-0 p-2.5`}>
			<dt className="text-[11px] font-semibold text-gray-400">{label}</dt>
			<dd className="mt-1 font-display text-[19px] font-bold text-gray-50">{value}</dd>
			{detail && <dd className="text-[11px] text-gray-400">{detail}</dd>}
		</div>
	)
}

function Notice({ children }: { children: ReactNode }) {
	return (
		<p className="flex items-start gap-2 rounded-xl border border-edge bg-gray-800/60 p-4 text-sm text-gray-300">
			<History className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
			<span>{children}</span>
		</p>
	)
}
