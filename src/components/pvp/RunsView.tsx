/**
 * The PvP page's "CM Runs" view: log how each ticket of a Champions Meeting
 * went, and see the win rates (Henry's board post, 2026-10-24;
 * notes/pvp-planner-plan.md, "R3 CM Runs").
 *
 * A day tab per CM day (Round 1 is days 1-2, Round 2 days 3-4) and one for the
 * Finals. A day shows its four tickets side by side. A ticket starts empty and
 * asks who ran it: the previous ticket's three, or one of the event's teams
 * from My team. The lineup is COPIED into the ticket, so editing the team
 * later never changes what was logged. Then five dropdowns say which of the
 * three won each race, or Loss.
 *
 * Account only (owner, 2026-10-26): a guest gets a sign-in card and nothing is
 * kept on the device. Every change saves at once through
 * services/pvpRunQueries.ts. League of Heroes runs fit the same API but have no
 * screen yet.
 *
 * Inside the /app loading gate, so it may read the clock during render.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { Loader2, Trash2, Trophy } from "lucide-react"
import { useAccount } from "../../services/AuthContext"
import { useCalculatorData } from "../../services/CalculatorContext"
import { usePvpTeams } from "../../services/PvpTeamsContext"
import { usePvpRuns, useRunsSaving, useSaveRun, type RunChange } from "../../services/pvpRunQueries"
import { useTrainedUmas } from "../../services/trainedUmaQueries"
import { statLine } from "../../utils/trainedUmas"
import { VeteranPicker } from "../collection/VeteranPicker"
import type { TrainedUma } from "../../types/trainedUma"
import { usePvpCatalogue } from "../../hooks/usePvpCatalogue"
import { useOshiIds } from "../../hooks/useOshiIds"
import { useSignInPrompt } from "../../hooks/useSignInPrompt"
import { FramedUma } from "../FramedUma"
import { SaveStatus } from "./SaveStatus"
import { STYLE_LABELS } from "../../utils/pvpGuide"
import { refForRaceEvent, sameEvent } from "../../utils/pvpEvent"
import {
	CM_RUN_DAYS,
	CM_RUN_TICKETS,
	RUN_RACES,
	bestTicketWins,
	cmDayAt,
	findRun,
	formatRate,
	lineupFromTeam,
	ordinal,
	previousLineup,
	roundOfDay,
	runsOf,
	sameLineup,
	setRace,
	summarizeRuns,
	tallyRun,
} from "../../utils/pvpRuns"
import type { RaceEvent } from "../../types"
import type { CatalogueUma, PvpTeam } from "../../types/pvpTeam"
import type { PvpFinalsGroup, PvpRun, PvpRunRunner, PvpRunSlot } from "../../types/pvpRun"

const SELECT =
	"min-h-9 w-full rounded-md border border-gray-600 bg-gray-800 px-2 py-1 text-sm text-gray-100 transition hover:border-gray-500 focus:border-brand focus:outline-none disabled:opacity-50"
const SMALL_BUTTON =
	"rounded-md border border-gray-600 px-2.5 py-1 text-xs font-medium text-gray-200 transition hover:border-brand hover:text-brand"

/** One shared empty list, so "no veterans yet" is the same array on every render. */
const NO_VETERANS: TrainedUma[] = []

/** A day tab's id: a CM day 1..4, or the Finals. */
type DayTab = number | "final"

/** What a lineup choice is called and what it copies in. */
interface LineupChoice {
	label: string
	runners: PvpRunRunner[]
}

/** "Team 2" when the player hasn't named it (TeamBuilder's rule). */
function teamLabel(team: PvpTeam, index: number): string {
	return team.name.trim() || `Team ${index + 1}`
}

export function RunsView({ event, onOpenMyTeam }: { event: RaceEvent; onOpenMyTeam: () => void }) {
	const { isLoggedIn } = useAccount()
	const { signInState } = useSignInPrompt()

	if (event.event_type !== "champions_meeting") {
		return <Notice>Logging runs works for Champions Meetings for now. League of Heroes is coming later.</Notice>
	}
	if (!isLoggedIn) {
		return (
			<div className="card-panel flex flex-wrap items-center gap-3 p-4 text-sm text-gray-300">
				<span className="min-w-0 flex-1">
					Sign in to log your tickets and see your win rates. Your runs are kept on your account.
				</span>
				<Link to="/login" state={signInState} className={SMALL_BUTTON}>
					Sign in
				</Link>
			</div>
		)
	}
	// Keyed by event, so switching events starts on that event's current day.
	return <SignedInRuns key={event.id} event={event} onOpenMyTeam={onOpenMyTeam} />
}

function SignedInRuns({ event, onOpenMyTeam }: { event: RaceEvent; onOpenMyTeam: () => void }) {
	const ref = refForRaceEvent(event)
	const { calculationConstants } = useCalculatorData()
	const runsQuery = usePvpRuns(ref, true)
	const catalogue = usePvpCatalogue()
	const { teams, ensureLoaded } = usePvpTeams()
	const oshiIds = useOshiIds()
	// The account's veterans, for "which veteran ran" under each runner.
	const veterans = useTrainedUmas(true).data ?? NO_VETERANS
	const saving = useRunsSaving(ref)
	const [failed, setFailed] = useState(false)
	const save = useSaveRun(ref, (message) => {
		setFailed(true)
		toast.error(message)
	})

	useEffect(() => {
		ensureLoaded()
	}, [ensureLoaded])

	// The tab opens on the day the CM is on now, or on the Finals once they start.
	const [tab, setTab] = useState<DayTab>(() => cmDayAt(event, calculationConstants, new Date()) ?? "final")

	// The event's teams with at least one uma: the lineups a ticket can copy.
	const eventTeams = useMemo(() => {
		const eventRef = refForRaceEvent(event)
		return teams.filter((team) => sameEvent({ kind: team.kind, id: team.event }, eventRef) && team.members.length > 0)
	}, [teams, event])

	if (runsQuery.isError) return <Notice>Your runs didn't load. Reload the page to try again.</Notice>
	if (catalogue.status === "error") {
		return <Notice>The uma list didn't load. Reload the page to try again.</Notice>
	}
	if (runsQuery.isPending || catalogue.status !== "ready") {
		return (
			<div className="flex items-center gap-2 text-sm text-gray-400" role="status">
				<Loader2 className="h-4 w-4 animate-spin" />
				Loading your runs…
			</div>
		)
	}

	const runs = runsQuery.data
	const umasById = catalogue.umasById
	const write = (slot: PvpRunSlot, change: RunChange) => {
		setFailed(false)
		save(slot, change)
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<DayTabs tab={tab} runs={runs} onChange={setTab} />
				<SaveStatus
					mode="account"
					saveState={failed ? "error" : saving ? "saving" : "saved"}
					hasTeam={runs.length > 0}
				/>
			</div>

			{tab === "final" ? (
				<FinalCard
					run={findRun(runs, { stage: "final" })}
					choices={lineupChoices(runs, eventTeams, CM_RUN_DAYS + 1, 1)}
					umasById={umasById}
					oshiIds={oshiIds}
					veterans={veterans}
					onOpenMyTeam={onOpenMyTeam}
					onWrite={(change) => write({ stage: "final" }, change)}
				/>
			) : (
				<div className="grid gap-3 sm:grid-cols-2">
					{Array.from({ length: CM_RUN_TICKETS }, (_, index) => {
						const ticket = index + 1
						const slot: PvpRunSlot = { stage: "day", day: tab, ticket }
						return (
							<TicketCard
								key={`runs-${tab}-${ticket}`}
								title={`Ticket ${ticket}`}
								run={findRun(runs, slot)}
								choices={lineupChoices(runs, eventTeams, tab, ticket)}
								umasById={umasById}
								oshiIds={oshiIds}
								veterans={veterans}
								onOpenMyTeam={onOpenMyTeam}
								onWrite={(change) => write(slot, change)}
							/>
						)
					})}
				</div>
			)}

			<Summary runs={runs} umasById={umasById} oshiIds={oshiIds} veterans={veterans} />
		</div>
	)
}

/**
 * Who could have run a ticket: the latest earlier ticket's three first (most
 * players run the same team all day), then each of the event's teams that
 * differs from it.
 */
function lineupChoices(runs: PvpRun[], teams: PvpTeam[], day: number, ticket: number): LineupChoice[] {
	const choices: LineupChoice[] = []
	const previous = previousLineup(runs, day, ticket)
	if (previous) choices.push({ label: "Same as last ticket", runners: previous })
	teams.forEach((team, index) => {
		const runners = lineupFromTeam(team.members)
		if (!previous || !sameLineup(previous, runners)) choices.push({ label: teamLabel(team, index), runners })
	})
	return choices
}

function DayTabs({ tab, runs, onChange }: { tab: DayTab; runs: PvpRun[]; onChange: (tab: DayTab) => void }) {
	const tabs: DayTab[] = [...Array.from({ length: CM_RUN_DAYS }, (_, index) => index + 1), "final"]
	return (
		<div role="tablist" aria-label="Day" className="flex flex-wrap gap-1">
			{tabs.map((entry) => {
				const active = entry === tab
				const label = entry === "final" ? "Finals" : `Day ${entry}`
				const tally = entry === "final" ? null : summarizeRuns(runsOf(runs, { day: entry })).total
				return (
					<button
						key={label}
						type="button"
						role="tab"
						aria-selected={active}
						onClick={() => onChange(entry)}
						className={`flex flex-col items-center rounded-md border px-3 py-1 text-sm font-semibold transition ${
							active ? "border-brand text-brand" : "border-gray-600 text-gray-300 hover:border-gray-500 hover:text-gray-100"
						}`}
					>
						{label}
						<span className="text-[11px] font-medium text-gray-400">
							{entry === "final" ? "1 race" : `Round ${roundOfDay(entry)}${tally && tally.raced ? ` · ${tally.wins}/${tally.raced}` : ""}`}
						</span>
					</button>
				)
			})}
		</div>
	)
}

// ── A ticket ─────────────────────────────────────────────────────────────

interface CardProps {
	run: PvpRun | undefined
	choices: LineupChoice[]
	umasById: Map<number, CatalogueUma>
	oshiIds: ReadonlySet<number>
	/** The account's veterans (the Collection page), for each runner's pick. */
	veterans: TrainedUma[]
	onOpenMyTeam: () => void
	/** A change to the ticket as it is when the save runs (pvpRunQueries.ts says why). */
	onWrite: (change: RunChange) => void
}

function TicketCard({ title, ...props }: CardProps & { title: string }) {
	const { run, umasById, onWrite } = props
	return (
		<RunCard title={title} {...props}>
			{run && run.runners.length > 0 && (
				<>
					<div className="flex flex-col gap-1.5">
						{Array.from({ length: RUN_RACES }, (_, index) => (
							<RaceRow
								key={index}
								race={index + 1}
								label={`${title}, race ${index + 1}`}
								run={run}
								umasById={umasById}
								onChange={(winner) =>
									onWrite((current) => ({ ...current, races: setRace(current.races, index + 1, winner) }))
								}
							/>
						))}
					</div>
					<p className="text-sm text-gray-300">
						{(() => {
							const { wins, raced } = tallyRun(run)
							return raced ? `${wins} of ${raced} won (${formatRate({ wins, raced })})` : "No races logged yet."
						})()}
					</p>
				</>
			)}
		</RunCard>
	)
}

function FinalCard(props: CardProps) {
	const { run, umasById, onWrite } = props
	return (
		<RunCard title="Finals" {...props}>
			{run && run.runners.length > 0 && (
				<div className="flex flex-col gap-2">
					<RaceRow
						race={1}
						label="Finals race"
						run={run}
						umasById={umasById}
						// A win is 1st place, so a winner fills a blank placement.
						onChange={(winner) =>
							onWrite((current) => ({
								...current,
								races: setRace(current.races, 1, winner),
								placement: typeof winner === "number" && current.placement === null ? 1 : current.placement,
							}))
						}
					/>
					<div className="grid grid-cols-2 gap-2">
						<label className="flex flex-col gap-1 text-xs font-medium text-gray-400">
							Finals group
							<select
								className={SELECT}
								value={run.finals_group}
								onChange={(change) => {
									const group = change.target.value as PvpFinalsGroup
									onWrite((current) => ({ ...current, finals_group: group }))
								}}
							>
								<option value="">–</option>
								<option value="A">Group A</option>
								<option value="B">Group B</option>
							</select>
						</label>
						<label className="flex flex-col gap-1 text-xs font-medium text-gray-400">
							Your placement
							<select
								className={SELECT}
								value={run.placement ?? ""}
								onChange={(change) => {
									const placement = change.target.value ? Number(change.target.value) : null
									onWrite((current) => ({ ...current, placement }))
								}}
							>
								<option value="">–</option>
								{[1, 2, 3].map((place) => (
									<option key={place} value={place}>
										{ordinal(place)}
									</option>
								))}
							</select>
						</label>
					</div>
				</div>
			)}
		</RunCard>
	)
}

/**
 * The frame both cards share: the title, the lineup (or the choice of one),
 * and Change / Clear. The races go in `children`.
 */
function RunCard({ title, run, choices, umasById, oshiIds, veterans, onOpenMyTeam, onWrite, children }: CardProps & {
	title: string
	children: ReactNode
}) {
	const [picking, setPicking] = useState(false)
	const [confirmClear, setConfirmClear] = useState(false)
	const runners = run?.runners ?? []
	const hasLineup = runners.length > 0

	const pick = (choice: LineupChoice) => {
		setPicking(false)
		// A race won by a spot the new lineup leaves empty goes back to "not run".
		const spots = new Set(choice.runners.map((runner) => runner.position))
		onWrite((current) => ({
			...current,
			runners: choice.runners,
			races: current.races.filter((race) => race.winner === null || spots.has(race.winner)),
		}))
	}

	return (
		<section className="card-panel flex flex-col gap-3 p-3" aria-label={title}>
			<div className="flex items-center justify-between gap-2">
				<h3 className="text-sm font-semibold text-gray-100">{title}</h3>
				{hasLineup && (
					<div className="flex gap-1.5">
						<button type="button" className={SMALL_BUTTON} onClick={() => setPicking((open) => !open)}>
							Change umas
						</button>
						{confirmClear ? (
							<button
								type="button"
								className={`${SMALL_BUTTON} border-highlight text-highlight`}
								onClick={() => {
									setConfirmClear(false)
									onWrite(() => null)
								}}
								onBlur={() => setConfirmClear(false)}
							>
								Clear it?
							</button>
						) : (
							<button
								type="button"
								className={SMALL_BUTTON}
								aria-label={`Clear ${title}`}
								onClick={() => setConfirmClear(true)}
							>
								<Trash2 className="h-3.5 w-3.5" />
							</button>
						)}
					</div>
				)}
			</div>

			{hasLineup && (
				<Lineup
					runners={runners}
					umasById={umasById}
					oshiIds={oshiIds}
					veterans={veterans}
					onVeteranChange={(position, trainedUma) =>
						onWrite((current) => ({
							...current,
							runners: current.runners.map((runner) =>
								runner.position === position ? { ...runner, trained_uma: trainedUma } : runner
							),
						}))
					}
				/>
			)}

			{(!hasLineup || picking) &&
				(choices.length > 0 ? (
					<div className="flex flex-col gap-1.5">
						<p className="text-xs text-gray-400">{hasLineup ? "Swap in:" : "Who ran it?"}</p>
						<div className="flex flex-wrap gap-1.5">
							{choices.map((choice) => (
								<button key={choice.label} type="button" className={SMALL_BUTTON} onClick={() => pick(choice)}>
									{choice.label}
								</button>
							))}
						</div>
					</div>
				) : (
					<p className="text-sm text-gray-400">
						Build your team in{" "}
						<button type="button" className="font-medium text-brand hover:text-brand/75" onClick={onOpenMyTeam}>
							My team
						</button>{" "}
						first, then log who ran each ticket here.
					</p>
				))}

			{children}
		</section>
	)
}

function Lineup({ runners, umasById, oshiIds, veterans, onVeteranChange }: {
	runners: PvpRunRunner[]
	umasById: Map<number, CatalogueUma>
	oshiIds: ReadonlySet<number>
	veterans: TrainedUma[]
	onVeteranChange: (position: number, trainedUma: number | null) => void
}) {
	return (
		<ul className="grid grid-cols-3 gap-2">
			{runners.map((runner) => {
				const uma = umasById.get(runner.uma)
				return (
					<li key={runner.position} className="flex min-w-0 flex-col items-center gap-1 text-center">
						<FramedUma
							src={uma?.portrait ?? uma?.image ?? null}
							oshi={oshiIds.has(runner.uma)}
							alt={uma?.name ?? ""}
							className="w-12"
						/>
						<span className="w-full truncate text-xs font-medium text-gray-200" title={uma?.name}>
							{uma?.name ?? "Unknown uma"}
						</span>
						<span className="text-[11px] text-gray-400">{STYLE_LABELS[runner.style]}</span>
						<VeteranPicker
							uma={uma}
							value={runner.trained_uma}
							veterans={veterans}
							oshi={oshiIds.has(runner.uma)}
							onChange={(trainedUma) => onVeteranChange(runner.position, trainedUma)}
						/>
					</li>
				)
			})}
		</ul>
	)
}

/** One race: which of the three won it, Loss, or not run yet. */
function RaceRow({ race, label, run, umasById, onChange }: {
	race: number
	label: string
	run: PvpRun
	umasById: Map<number, CatalogueUma>
	/** A spot, null for a loss, undefined for "not run yet". */
	onChange: (winner: number | null | undefined) => void
}) {
	const entry = run.races.find((candidate) => candidate.race === race)
	// "" = not run, "loss" = lost, a number = the spot that won.
	const value = entry === undefined ? "" : entry.winner === null ? "loss" : String(entry.winner)
	return (
		<label className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-2 text-xs font-medium text-gray-400">
			Race {race}
			<select
				aria-label={label}
				className={SELECT}
				value={value}
				onChange={(change) => {
					const next = change.target.value
					onChange(next === "" ? undefined : next === "loss" ? null : Number(next))
				}}
			>
				<option value="">–</option>
				{run.runners.map((runner) => (
					<option key={runner.position} value={runner.position}>
						{umasById.get(runner.uma)?.name ?? `Uma ${runner.position + 1}`} won
					</option>
				))}
				<option value="loss">Loss</option>
			</select>
		</label>
	)
}

// ── The totals ───────────────────────────────────────────────────────────

function Summary({ runs, umasById, oshiIds, veterans }: {
	runs: PvpRun[]
	umasById: Map<number, CatalogueUma>
	oshiIds: ReadonlySet<number>
	veterans: TrainedUma[]
}) {
	const { total, umas } = summarizeRuns(runsOf(runs, {}))
	const final = findRun(runs, { stage: "final" })
	if (!total.raced && !final) return null
	const rounds = [1, 2].map((round) => ({ round, best: bestTicketWins(runs, round) }))
	return (
		<section className="card-panel flex flex-col gap-3 p-3" aria-label="Your win rates">
			<h3 className="flex items-center gap-1.5 text-sm font-semibold text-gray-100">
				<Trophy className="h-4 w-4 text-brand" />
				This Champions Meeting
			</h3>
			<dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
				<Stat label="Win rate" value={formatRate(total)} detail={`${total.wins} of ${total.raced} races`} />
				{rounds.map(({ round, best }) => (
					<Stat
						key={round}
						label={`Round ${round} best ticket`}
						value={best === null ? "–" : `${best} of ${RUN_RACES}`}
					/>
				))}
				<Stat
					label="Finals"
					value={final?.placement ? ordinal(final.placement) : "–"}
					detail={final?.finals_group ? `Group ${final.finals_group}` : undefined}
				/>
			</dl>
			{umas.length > 0 && (
				<ul className="flex flex-col gap-1.5">
					{umas.map((tally) => {
						const uma = umasById.get(tally.uma)
						return (
							<li key={`${tally.uma}:${tally.trained_uma ?? ""}`} className="flex items-center gap-2 text-sm">
								<FramedUma
									src={uma?.portrait ?? uma?.image ?? null}
									oshi={oshiIds.has(tally.uma)}
									alt=""
									className="w-8 shrink-0"
								/>
								<span className="min-w-0 flex-1 truncate text-gray-200">
									{uma?.name ?? "Unknown uma"}
									<VeteranLink veteran={veterans.find((veteran) => veteran.id === tally.trained_uma)} linked={tally.trained_uma !== null} />
								</span>
								<span className="text-gray-400">
									{tally.wins} of {tally.raced}
								</span>
								<span className="w-12 text-right font-semibold text-gray-100">{formatRate(tally)}</span>
							</li>
						)
					})}
				</ul>
			)}
			<p className="text-xs text-gray-500">Days 1 to 4 only. The finals race is counted on its own.</p>
		</section>
	)
}

/**
 * A summary row's veteran: her label (else her stats), linked to her on the
 * Collection page, which scrolls to and rings her (`?veteran=`). A linked
 * veteran since deleted reads as such; a runner with none shows nothing.
 */
function VeteranLink({ veteran, linked }: { veteran: TrainedUma | undefined; linked: boolean }) {
	if (!linked) return null
	if (!veteran) return <span className="ml-1.5 text-xs text-gray-500">(a deleted veteran)</span>
	return (
		<Link
			to={`/app/collection?veteran=${veteran.id}`}
			className="ml-1.5 text-xs font-medium text-brand hover:text-brand/75"
			title={`Speed ${veteran.speed}, Stamina ${veteran.stamina}, Power ${veteran.power}, Guts ${veteran.guts}, Wit ${veteran.wit}`}
		>
			{veteran.label || statLine(veteran)}
		</Link>
	)
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
	return (
		<div className="rounded-md border border-edge p-2">
			<dt className="text-xs text-gray-400">{label}</dt>
			<dd className="text-lg font-semibold text-gray-100">{value}</dd>
			{detail && <dd className="text-xs text-gray-400">{detail}</dd>}
		</div>
	)
}

function Notice({ children }: { children: ReactNode }) {
	return <p className="rounded-xl border border-edge bg-gray-800/60 p-4 text-sm text-gray-300">{children}</p>
}
