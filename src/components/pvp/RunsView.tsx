/**
 * The PvP page's "CM Runs" view: log how each ticket of a Champions Meeting
 * went, and see the win rates (Henry's board post, 2026-10-24;
 * notes/pvp-planner-plan.md, "R3 CM Runs"). The look is the owner's redesign
 * (notes/cm-runs-plan.md, section 0, and its claude.ai mockup).
 *
 * Day tabs grouped by round (Round 1 is days 1-2, Round 2 days 3-4), each with
 * a four-segment bar, one segment per ticket, and a tab for the Finals. A day
 * is a LIST, one row per ticket: five small squares (the winner's portrait, a
 * red cross for a loss, a dashed number for a race not run) and a score. Only
 * one ticket is open at a time, the one in progress: its lineup once, then per
 * race a row of four buttons (the three umas and Loss). One tap logs, a second
 * clears. Twenty selects a day was the old look's problem.
 *
 * An empty ticket starts in one tap: "Same three as Ticket 2" copies the
 * latest earlier ticket's lineup (`previousRun`), or "Use Team 1" one of the
 * event's teams from My team; "Pick a team" lists them all. The lineup is
 * COPIED into the ticket, so editing the team later never changes what was
 * logged. "Use Team 1 for all of them" (FillEveryTicket) does the same for
 * every empty ticket ahead and the Finals at once: it took 17 taps.
 *
 * A ticket can be skipped whole or stopped after some races, and both can be
 * taken back (owner, 2026-10-26: a player may just be slow to type it in). A
 * day that is over offers its unlogged tickets as skipped in one tap; nothing
 * is ever skipped for the player (utils/pvpRuns.ts, "SKIPPED TICKETS").
 *
 * The totals sit in a side column from `lg`. On a phone, a three-number strip
 * goes on top and the per-uma bars at the bottom; between the two the side
 * column falls under the day.
 *
 * Account only (owner, 2026-10-26): a guest gets a sign-in card and nothing is
 * kept on the device. Every change saves at once through
 * services/pvpRunQueries.ts.
 *
 * League of Heroes is this same view with a different RunShape: six day tabs
 * of five tickets, no rounds, and a Top 96 tab where the Finals would be, which
 * takes the team entered, a typed placement and a note (TopBody). Everything
 * else reads the shape, so a fix to a ticket reaches both.
 *
 * Inside the /app loading gate, so it may read the clock during render.
 */

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeftRight, Check, ChevronDown, Crown, Medal, Loader2, Repeat, Trash2, Trophy, Users, X } from "lucide-react"
import { useAccount } from "../../services/AuthContext"
import { useCalculatorData } from "../../services/CalculatorContext"
import { usePvpTeams } from "../../services/PvpTeamsContext"
import { usePvpRuns, useRunsSaving, useSaveRun, type RunChange } from "../../services/pvpRunQueries"
import { useTrainedUmas } from "../../services/trainedUmaQueries"
import { statsTitle, veteranText } from "../../utils/veteranGrade"
import { veteransOf } from "../../utils/trainedUmas"
import { VeteranPicker } from "../collection/VeteranPicker"
import type { TrainedUma } from "../../types/trainedUma"
import { usePvpCatalogue } from "../../hooks/usePvpCatalogue"
import { useOshiIds } from "../../hooks/useOshiIds"
import { useSignInPrompt } from "../../hooks/useSignInPrompt"
import { FramedUma } from "../FramedUma"
import { SaveStatus } from "./SaveStatus"
import { STYLE_LABELS, styleColor } from "../../utils/pvpGuide"
import { formatDate, parseApiDate } from "../../utils/dateFormat"
import { refForRaceEvent, sameEvent, splitEventName } from "../../utils/pvpEvent"
import {
	CM_NOT_STARTED,
	LOH_TOP_PLACEMENTS,
	RUN_RACES,
	bestTicketWins,
	emptyContent,
	findRun,
	formatRate,
	isPastDay,
	lineupFromTeam,
	logRace,
	ordinal,
	previousRun,
	registeredLineups,
	roundOfDay,
	runDayAt,
	runShape,
	runsOf,
	sameLineup,
	setRace,
	slotsWithoutLineup,
	summarizeRuns,
	tallyRun,
	ticketCounts,
	ticketState,
	unloggedTickets,
	type RunShape,
	type Tally,
	type TicketState,
} from "../../utils/pvpRuns"
import type { CalculationConstants, RaceEvent } from "../../types"
import type { CatalogueUma, MemberStyle, PvpTeam } from "../../types/pvpTeam"
import type { PvpFinalsGroup, PvpRun, PvpRunContent, PvpRunRunner, PvpRunSlot } from "../../types/pvpRun"

/**
 * A quiet bordered button (Change umas, Skip, Undo). A button that needs another
 * size or colour passes it here, never as a second class on top: two classes for
 * one property resolve by Tailwind's stylesheet order, not by the order written.
 */
function soft({
	size = "min-h-9 px-3",
	look = "border-gray-600 text-gray-200 hover:border-gray-400 hover:text-gray-50",
}: { size?: string; look?: string } = {}): string {
	return `inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border text-[13px] font-semibold transition ${size} ${look}`
}
const SOFT_BUTTON = soft()
/** The one solid button a state leads with. `bg-brand text-black` turns white on the light themes (index.css). */
const PRIMARY_BUTTON =
	"inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand bg-brand px-3.5 text-[13px] font-bold text-black transition hover:opacity-90 sm:min-h-10"
/** The small capitals over a group: "Who ran it", "By uma". */
const EYEBROW = "text-[10px] font-bold uppercase tracking-[0.08em] text-gray-300 sm:text-[11px]"
/** A surface sunk into a card: a runner, a stat, a lineup choice. */
const INSET = "rounded-[10px] border border-edge bg-gray-900/60"

/** One shared empty list, so "no veterans yet" is the same array on every render. */
const NO_VETERANS: TrainedUma[] = []

/** A day tab's id: a CM day 1..4, or the Finals. */
type DayTab = number | "final"

/** The races a ticket can hold, 1..5. */
const RACES = Array.from({ length: RUN_RACES }, (_, index) => index + 1)

/** What a lineup choice is called and what it copies in. */
interface LineupChoice {
	key: string
	/** "Same three as Ticket 2", or the team's name. */
	label: string
	/** A small tag on the right: "Use these" on the previous ticket, "Team 2" on a named team. */
	badge: string | null
	/** The previous ticket's three, drawn in the brand colour. */
	previous: boolean
	runners: PvpRunRunner[]
}

interface DayTabsProps {
	tab: DayTab
	today: number | null
	runs: PvpRun[]
	final: PvpRun | undefined
	shape: RunShape
	onChange: (tab: DayTab) => void
}

/** Everything a ticket or the Finals needs to draw umas and save. */
interface Shared {
	umasById: Map<number, CatalogueUma>
	oshiIds: ReadonlySet<number>
	/** The account's veterans (the Collection page), for each runner's pick. */
	veterans: TrainedUma[]
	onOpenMyTeam: () => void
}

export function RunsView({ event, onOpenMyTeam }: { event: RaceEvent; onOpenMyTeam: () => void }) {
	const { isLoggedIn } = useAccount()
	const { signInState } = useSignInPrompt()

	if (!isLoggedIn) {
		return (
			<div className="card-panel flex flex-col gap-4.5 p-4 sm:p-6">
				{/* A faded glimpse of a day, so the card shows what signing in gets. */}
				<div className="flex flex-col gap-2 opacity-35" aria-hidden="true">
					<GhostRow title="Ticket 1" pips={["won", "won", "loss", "won", "empty"]} score="3/4" />
					<GhostRow title="Ticket 2" pips={["empty", "empty", "empty", "empty", "empty"]} />
				</div>
				<div className="flex flex-wrap items-center gap-4">
					<span className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
						<span className="text-base font-bold text-gray-50">Keep score of every ticket</span>
						<span className="text-sm leading-relaxed text-gray-300">
							Sign in to log your tickets and see your win rates. Your runs are kept on your account.
						</span>
					</span>
					<Link to="/login" state={signInState} className={PRIMARY_BUTTON}>
						Sign in
					</Link>
				</div>
			</div>
		)
	}
	// Keyed by event, so switching events starts on that event's current day.
	return <SignedInRuns key={event.id} event={event} onOpenMyTeam={onOpenMyTeam} />
}

function GhostRow({ title, pips, score }: { title: string; pips: Array<"won" | "loss" | "empty">; score?: string }) {
	return (
		<div className="flex items-center gap-3.5 rounded-xl border border-edge bg-gray-900/60 px-3 py-2.5">
			<span className="w-21 text-sm font-bold text-gray-100">{title}</span>
			<span className="flex gap-1.5">
				{pips.map((pip, index) => (
					<span
						key={index}
						className={`size-7 rounded-[7px] ${
							pip === "won" ? "bg-brand" : pip === "loss" ? "border border-highlight" : "border-[1.5px] border-dashed border-gray-600"
						}`}
					/>
				))}
			</span>
			{score && <span className="ml-auto font-display text-[22px] font-bold text-gray-50">{score}</span>}
		</div>
	)
}

function SignedInRuns({ event, onOpenMyTeam }: { event: RaceEvent; onOpenMyTeam: () => void }) {
	const ref = refForRaceEvent(event)
	const shape = runShape(event)
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

	// The tab opens on the day the event is on now (Day 1 until it starts),
	// or on the Finals or Top 96 once the days are over.
	const [tab, setTab] = useState<DayTab>(() => {
		const day = runDayAt(event, calculationConstants, new Date(), shape)
		return day === null ? "final" : Math.max(1, day)
	})
	// Which ticket is open on each day, once the player has opened, closed or
	// written one there. Until then the day opens its ticket in progress
	// (defaultOpenTicket), worked out afresh on each render; the first write
	// pins it, so logging a ticket's fifth race doesn't fold it away.
	const [openByDay, setOpenByDay] = useState<Record<number, number | null>>({})

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
	const shared: Shared = { umasById: catalogue.umasById, oshiIds, veterans, onOpenMyTeam }
	const today = runDayAt(event, calculationConstants, new Date(), shape)
	const openOn = (day: number) => (day in openByDay ? openByDay[day] : defaultOpenTicket(runs, day, shape.tickets))
	const setOpen = (day: number, ticket: number | null) => setOpenByDay((open) => ({ ...open, [day]: ticket }))

	const write = (slot: PvpRunSlot, change: RunChange) => {
		setFailed(false)
		// Pin the day's open ticket as it is now, unless the player already chose
		// one (a ticket just started opens itself in the same click).
		if (slot.stage === "day") {
			const pinned = openOn(slot.day)
			setOpenByDay((open) => (slot.day in open ? open : { ...open, [slot.day]: pinned }))
		}
		save(slot, change)
	}
	// One lineup on every empty ticket ahead and the Finals (FillEveryTicket).
	// Each slot saves on its own, through the event's one save queue.
	const fillEvery = (slots: PvpRunSlot[], choice: LineupChoice) => {
		setFailed(false)
		for (const slot of slots) save(slot, (current) => withLineup(current, choice.runners))
		toast.success(`${choice.previous ? "Those three are" : `${choice.label} is`} on every ticket left.`)
	}
	// No team in My team and nothing logged yet: there is nothing a ticket could copy.
	const noLineups = eventTeams.length === 0 && !runs.some((run) => run.runners.length > 0)
	const final = findRun(runs, { stage: "final" })

	return (
		<div className="flex flex-col gap-3.5 sm:gap-5">
			<WinRateStrip event={event} runs={runs} today={today} shape={shape} />

			<div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
				{shape.rounds ? (
					<DayTabs tab={tab} today={today} runs={runs} final={final} shape={shape} onChange={setTab} />
				) : (
					<LeagueTabs tab={tab} today={today} runs={runs} final={final} shape={shape} onChange={setTab} />
				)}
				<SaveStatus mode="account" saveState={failed ? "error" : saving ? "saving" : "saved"} hasTeam={runs.length > 0} />
			</div>

			{!noLineups && <FillEveryTicket runs={runs} teams={eventTeams} today={today} shape={shape} shared={shared} onFill={fillEvery} />}

			<div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_22.5rem] lg:gap-5">
				<section className="card-panel min-w-0" aria-label={tab === "final" ? (shape.rounds ? "Finals" : "Top 96") : `Day ${tab}`}>
					{tab !== "final" ? (
						<DayHeader event={event} day={tab} today={today} runs={runs} shape={shape} />
					) : shape.rounds ? (
						<FinalsHeader event={event} constants={calculationConstants} run={final} />
					) : (
						<TopHeader run={final} />
					)}
					{tab === "final" && !shape.rounds ? (
						<TopBody
							run={final}
							choices={topChoices(runs, eventTeams, shape)}
							shared={shared}
							onWrite={(change) => write({ stage: "final" }, change)}
						/>
					) : noLineups ? (
						<NoTeamYet onOpenMyTeam={onOpenMyTeam} />
					) : tab === "final" ? (
						<FinalsBody
							run={final}
							choices={lineupChoices(runs, eventTeams, shape.days + 1, 1)}
							shared={shared}
							onWrite={(change) => write({ stage: "final" }, change)}
						/>
					) : (
						<DayTickets
							day={tab}
							today={today}
							runs={runs}
							teams={eventTeams}
							tickets={shape.tickets}
							open={openOn(tab)}
							onOpen={(ticket) => setOpen(tab, ticket)}
							shared={shared}
							onWrite={write}
						/>
					)}
				</section>

				<Summary runs={runs} event={event} shape={shape} umasById={shared.umasById} oshiIds={oshiIds} veterans={veterans} />
			</div>
		</div>
	)
}

/**
 * The ticket a day opens on: the first one in progress (a lineup, races to
 * go, not stopped), unless an unlogged ticket comes before it. Nothing when
 * every ticket is done, or the next one hasn't started.
 */
function defaultOpenTicket(runs: PvpRun[], day: number, tickets: number): number | null {
	for (let ticket = 1; ticket <= tickets; ticket++) {
		const state = rowState(findRun(runs, { stage: "day", day, ticket }))
		if (state === "unlogged") return null
		if (state === "started") return ticket
	}
	return null
}

/** ticketState, with a row that holds no lineup and no skip read as unlogged (nothing to draw). */
function rowState(run: PvpRun | undefined): TicketState {
	if (run && run.runners.length === 0 && !run.skipped) return "unlogged"
	return ticketState(run)
}

/** "Ticket 3", "Tickets 3 and 4", "Tickets 2, 3 and 4". */
function ticketList(tickets: number[]): string {
	if (tickets.length === 1) return `Ticket ${tickets[0]}`
	return `Tickets ${tickets.slice(0, -1).join(", ")} and ${tickets[tickets.length - 1]}`
}

/** "1 ticket used, 3 skipped". */
function ticketsText({ used, skipped }: { used: number; skipped: number }): string {
	return `${used} ${used === 1 ? "ticket" : "tickets"} used${skipped ? `, ${skipped} skipped` : ""}`
}

/**
 * Who could have run a ticket: the latest earlier ticket's three first (most
 * players run the same team all day), named by where they came from, then
 * each of the event's teams that differs from it. An unnamed team is "Team 2"
 * (TeamBuilder's rule); a named one carries that as its badge.
 */
function lineupChoices(runs: PvpRun[], teams: PvpTeam[], day: number, ticket: number): LineupChoice[] {
	const choices: LineupChoice[] = []
	const previous = previousRun(runs, day, ticket)
	if (previous) {
		const source = previous.day === day ? `Ticket ${previous.ticket}` : `Day ${previous.day}, Ticket ${previous.ticket}`
		choices.push({
			key: "previous",
			label: `Same three as ${source}`,
			badge: "Use these",
			previous: true,
			runners: previous.runners,
		})
	}
	teams.forEach((team, index) => {
		const runners = lineupFromTeam(team.members)
		if (previous && sameLineup(previous.runners, runners)) return
		const named = team.name.trim()
		choices.push({
			key: team.key,
			label: named || `Team ${index + 1}`,
			badge: named ? `Team ${index + 1}` : null,
			previous: false,
			runners,
		})
	})
	return choices
}

/**
 * Who could have run a LoH's Top 96: the lineups logged on the days, since it
 * has to be a team the player registered. With nothing logged the site can't
 * know what that was, so it offers the event's teams.
 */
function topChoices(runs: PvpRun[], teams: PvpTeam[], shape: RunShape): LineupChoice[] {
	const registered = registeredLineups(runs)
	if (registered.length === 0) return lineupChoices(runs, teams, shape.days + 1, 1)
	return registered.map((run) => ({
		key: `ticket-${run.day}-${run.ticket}`,
		label: `Same three as Day ${run.day}, Ticket ${run.ticket}`,
		badge: null,
		previous: true,
		runners: run.runners,
	}))
}

/**
 * "Use Team 1 for all of them": one tap puts a lineup on every ticket left
 * (slotsWithoutLineup: the empty tickets of today and later days, and the
 * Finals), where it took a tap per ticket, 17 in all (owner's pick B,
 * 2026-10-29). With one lineup to offer the button uses it; with several it
 * opens the picker first. Gone once fewer than two slots are empty: a single
 * ticket starts from its own row.
 */
function FillEveryTicket({ runs, teams, today, shape, shared, onFill }: {
	runs: PvpRun[]
	teams: PvpTeam[]
	today: number | null
	shape: RunShape
	shared: Shared
	onFill: (slots: PvpRunSlot[], choice: LineupChoice) => void
}) {
	const [picking, setPicking] = useState(false)
	const slots = slotsWithoutLineup(runs, today, shape)
	// The latest ticket's three first, then each team that differs: what the Finals offers.
	const choices = lineupChoices(runs, teams, shape.days + 1, 1)
	if (slots.length < 2 || choices.length === 0) return null

	// Two slots or more, and only one can be the Finals, so there is always a ticket.
	const tickets = slots.filter((slot) => slot.stage === "day").length
	const finals = slots.some((slot) => slot.stage === "final")
	const what = `${tickets} ${tickets === 1 ? "ticket" : "tickets"}${finals ? " and the Finals" : ""}`
	const only = choices.length === 1 ? choices[0] : null
	const fill = (choice: LineupChoice) => {
		setPicking(false)
		onFill(slots, choice)
	}
	return (
		<section aria-label="Every ticket left" className="card-panel">
			<div className="flex flex-wrap items-center gap-2.5 px-3 py-2.5 sm:px-3.5">
				<p className="min-w-0 flex-1 text-[13px] text-gray-300 sm:text-sm">{what} have no lineup yet.</p>
				<button
					type="button"
					className={SOFT_BUTTON}
					aria-expanded={only ? undefined : picking}
					onClick={() => (only ? fill(only) : setPicking((open) => !open))}
				>
					<Users className="h-4 w-4 shrink-0" aria-hidden="true" />
					{only ? (only.previous ? "Same three for all of them" : `Use ${only.label} for all of them`) : "Pick a team for all of them"}
				</button>
			</div>
			{picking && (
				<LineupPicker eyebrow="Every ticket left" heading="Who runs all of them?" choices={choices} shared={shared} onPick={fill} />
			)}
		</section>
	)
}

/** The first choice as the one-tap button's words. */
function startLabel(choice: LineupChoice): string {
	return choice.previous ? choice.label : `Use ${choice.label}`
}

/** A ticket's content with a new lineup. A race won by a spot the new lineup leaves empty goes back to "not run". */
function withLineup(current: PvpRunContent, runners: PvpRunRunner[]): PvpRunContent {
	const spots = new Set(runners.map((runner) => runner.position))
	return { ...current, runners, races: current.races.filter((race) => race.winner === null || spots.has(race.winner)) }
}

function umaName(umasById: Map<number, CatalogueUma>, runner: PvpRunRunner | undefined): string {
	return (runner && umasById.get(runner.uma)?.name) ?? "Unknown uma"
}

// ── The day tabs ─────────────────────────────────────────────────────────

/**
 * Round 1, Round 2 and Finals, each a label over its tabs. From `sm` the groups
 * sit side by side; below it the tabs are a five-column grid under one row of
 * labels. The groups are `display: contents` there, so the labels and tabs are
 * the grid's own items: the labels lock to row 1 and the tabs to row 2, and
 * each flows into the next free column.
 */
function DayTabs({ tab, today, runs, final, shape, onChange }: DayTabsProps) {
	const rounds = [1, 2].map((round) => ({
		round,
		days: Array.from({ length: shape.days }, (_, index) => index + 1).filter((day) => roundOfDay(day) === round),
	}))
	const label = "row-start-1 text-[10px] font-bold uppercase tracking-[0.08em] text-gray-400 sm:text-[11px]"
	return (
		<div role="tablist" aria-label="Day" className="grid w-full grid-cols-5 gap-1.5 sm:flex sm:w-auto sm:flex-wrap sm:items-end sm:gap-6">
			{rounds.map(({ round, days }) => (
				<div key={round} className="contents sm:flex sm:flex-col sm:gap-2">
					<span className={`${label} col-span-2`} aria-hidden="true">
						Round {round}
					</span>
					<div className="contents sm:flex sm:gap-2">
						{days.map((day) => (
							<DayTabButton key={day} day={day} today={today === day} runs={runs} tickets={shape.tickets} active={tab === day} onPick={() => onChange(day)} />
						))}
					</div>
				</div>
			))}
			<div className="contents sm:flex sm:flex-col sm:gap-2">
				<span className={label} aria-hidden="true">
					Finals
				</span>
				<TabFrame active={tab === "final"} onPick={() => onChange("final")}>
					<span className={`flex items-center gap-2 text-xs font-bold sm:text-[15px] ${tab === "final" ? "text-brand" : "text-gray-100"} max-sm:flex-col max-sm:gap-1.5`}>
						<Crown className="h-4 w-4" aria-hidden="true" />
						Finals
					</span>
					<span className="hidden text-xs text-gray-300 sm:block">
						{final?.placement ? `${ordinal(final.placement)}${final.finals_group ? `, Group ${final.finals_group}` : ""}` : "One race"}
					</span>
				</TabFrame>
			</div>
		</div>
	)
}

/**
 * A League of Heroes has no rounds to label, so its seven tabs just wrap: four
 * across on a phone, one row from `sm` where there's room.
 */
function LeagueTabs({ tab, today, runs, final, shape, onChange }: DayTabsProps) {
	return (
		<div role="tablist" aria-label="Day" className="grid w-full grid-cols-4 gap-1.5 sm:flex sm:w-auto sm:flex-wrap sm:gap-2">
			{Array.from({ length: shape.days }, (_, index) => index + 1).map((day) => (
				<DayTabButton key={day} day={day} today={today === day} runs={runs} tickets={shape.tickets} active={tab === day} onPick={() => onChange(day)} row="" />
			))}
			<TabFrame active={tab === "final"} onPick={() => onChange("final")} row="">
				<span className={`flex items-center gap-2 text-xs font-bold sm:text-[15px] ${tab === "final" ? "text-brand" : "text-gray-100"} max-sm:flex-col max-sm:gap-1.5`}>
					<Medal className="h-4 w-4" aria-hidden="true" />
					Top 96
				</span>
				<span className="hidden text-xs text-gray-300 sm:block">{final?.placement ? ordinal(final.placement) : "If you made it"}</span>
			</TabFrame>
		</div>
	)
}

function TabFrame({ active, onPick, row = "row-start-2", children }: { active: boolean; onPick: () => void; row?: string; children: ReactNode }) {
	return (
		<button
			type="button"
			role="tab"
			aria-selected={active}
			onClick={onPick}
			className={`${row} flex min-h-16.5 min-w-0 flex-col items-center justify-center gap-1.5 rounded-[10px] border px-1 py-2 text-center transition sm:min-h-19.5 sm:min-w-33 sm:items-start sm:justify-between sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-left ${
				active ? "border-brand bg-brand/10" : "border-edge bg-gray-800/60 hover:border-gray-500"
			}`}
		>
			{children}
		</button>
	)
}

function DayTabButton({ day, today, runs, tickets, active, onPick, row }: {
	day: number
	today: boolean
	runs: PvpRun[]
	tickets: number
	active: boolean
	onPick: () => void
	row?: string
}) {
	const tally = summarizeRuns(runsOf(runs, { day })).total
	return (
		<TabFrame active={active} onPick={onPick} row={row}>
			<span className="flex w-full items-center justify-center gap-1 sm:justify-between sm:gap-2.5">
				{today && <span className="size-1.5 rounded-full bg-brand sm:hidden" aria-hidden="true" />}
				<span className={`text-[13px] font-bold sm:text-[15px] ${active ? "text-brand" : "text-gray-100"}`}>Day {day}</span>
				{today && (
					<span className="max-sm:sr-only rounded-full bg-brand px-1.75 py-px text-[11px] font-bold text-black">Today</span>
				)}
			</span>
			{/* One segment per ticket: grey unlogged, ringed started, half gold raced some, gold done or stopped, outlined skipped. */}
			<span className="flex gap-0.5 sm:gap-0.75" aria-hidden="true">
				{Array.from({ length: tickets }, (_, index) => {
					const run = findRun(runs, { stage: "day", day, ticket: index + 1 })
					return <span key={index} className={`block h-1 w-2.5 rounded-xs sm:h-1.25 sm:w-4.5 sm:rounded-sm ${segmentClass(run)}`} />
				})}
			</span>
			<span className="text-[11px] text-gray-300 sm:text-xs">
				<span className="sm:hidden">{tally.raced ? `${tally.wins}/${tally.raced}` : "–"}</span>
				<span className="max-sm:hidden">{tally.raced ? `${tally.wins} of ${tally.raced} won` : "Not started"}</span>
			</span>
		</TabFrame>
	)
}

function segmentClass(run: PvpRun | undefined): string {
	const state = rowState(run)
	if (state === "unlogged") return "bg-gray-600"
	if (state === "skipped") return "ring-1 ring-inset ring-gray-500"
	if (state === "done" || state === "stopped") return "bg-brand"
	return run && run.races.length ? "bg-brand/45" : "bg-gray-800 ring-1 ring-inset ring-brand/55"
}

// ── A day ────────────────────────────────────────────────────────────────

function CardHeader({ eyebrow, title, score, detail }: { eyebrow: string; title: string; score: string; detail: string }) {
	return (
		<header className="flex items-center justify-between gap-3 border-b border-edge px-3.5 py-3.5 sm:gap-4 sm:px-5 sm:py-4.5">
			<div className="flex flex-col gap-px sm:gap-0.5">
				<span className="text-[11px] font-bold uppercase tracking-[0.06em] text-brand sm:text-xs">{eyebrow}</span>
				<h2 className="font-display text-[22px] font-bold leading-tight text-gray-50 sm:text-[28px]">{title}</h2>
			</div>
			<div className="text-right">
				<div className="font-display text-[22px] font-bold leading-tight text-gray-50 sm:text-[28px]">{score}</div>
				<div className="text-xs text-gray-400 sm:text-[13px]">{detail}</div>
			</div>
		</header>
	)
}

function DayHeader({ event, day, today, runs, shape }: { event: RaceEvent; day: number; today: number | null; runs: PvpRun[]; shape: RunShape }) {
	const tally = summarizeRuns(runsOf(runs, { day })).total
	// During registration Day 1 says when Round 1 starts, as the Finals header gives its date.
	const when = day === today ? " · Today" : day === 1 && today === CM_NOT_STARTED ? ` · Starts ${formatDate(event.start_date)}` : ""
	return (
		<CardHeader
			eyebrow={`${shape.rounds ? `Round ${roundOfDay(day)}` : "League of Heroes"}${when}`}
			title={`Day ${day}`}
			score={tally.raced ? `${tally.wins} of ${tally.raced}` : "–"}
			detail={tally.raced ? `races won · ${formatRate(tally)}` : "Nothing logged yet"}
		/>
	)
}

function DayTickets({ day, today, runs, teams, tickets, open, onOpen, shared, onWrite }: {
	day: number
	today: number | null
	runs: PvpRun[]
	teams: PvpTeam[]
	tickets: number
	open: number | null
	onOpen: (ticket: number | null) => void
	shared: Shared
	onWrite: (slot: PvpRunSlot, change: RunChange) => void
}) {
	// A day that is over, with tickets that have nothing logged: offered as
	// skipped in one tap, never assumed (the player may still type them in).
	const unlogged = isPastDay(day, today) ? unloggedTickets(runs, day, tickets) : []
	return (
		<>
			{unlogged.length > 0 && (
				<div className="mx-2 mt-2 flex flex-col gap-2 rounded-[10px] border border-brand/30 bg-brand/5 px-3 py-2.5 sm:mx-2.5 sm:mt-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-3.5">
					<span className="text-[13px] text-gray-200 sm:flex-[1_1_260px] sm:text-sm">
						Day {day} is over. Nothing is logged for {ticketList(unlogged)}.
					</span>
					<button
						type="button"
						className="min-h-10 self-start rounded-lg border border-brand px-3.5 text-[13px] font-bold text-brand transition hover:bg-brand/10 sm:min-h-9 sm:self-auto"
						onClick={() =>
							unlogged.forEach((ticket) =>
								onWrite({ stage: "day", day, ticket }, () => ({ ...emptyContent(), skipped: true }))
							)
						}
					>
						Mark the rest skipped
					</button>
				</div>
			)}
			<ol className="flex flex-col gap-1.5 p-2 sm:p-2.5">
				{Array.from({ length: tickets }, (_, index) => {
					const ticket = index + 1
					const slot: PvpRunSlot = { stage: "day", day, ticket }
					return (
						<li key={`runs-${day}-${ticket}`}>
							<TicketRow
								title={`Ticket ${ticket}`}
								eyebrow={`Day ${day} · Round ${roundOfDay(day)}`}
								run={findRun(runs, slot)}
								choices={lineupChoices(runs, teams, day, ticket)}
								open={open === ticket}
								onOpen={(isOpen) => onOpen(isOpen ? ticket : null)}
								shared={shared}
								onWrite={(change) => onWrite(slot, change)}
							/>
						</li>
					)
				})}
			</ol>
		</>
	)
}

/** A ticket's row on the day's list, closed or open, in each of its states. */
function TicketRow({ title, eyebrow, run, choices, open, onOpen, shared, onWrite }: {
	title: string
	/** Over the lineup picker: "Day 3 · Round 2". */
	eyebrow: string
	run: PvpRun | undefined
	choices: LineupChoice[]
	open: boolean
	onOpen: (open: boolean) => void
	shared: Shared
	/** A change to the ticket as it is when the save runs (pvpRunQueries.ts says why). */
	onWrite: (change: RunChange) => void
}) {
	const [picking, setPicking] = useState(false)
	const state = rowState(run)
	const box = "rounded-xl border"
	const quiet = `${box} border-edge bg-gray-900/40`

	if (state === "skipped") {
		return (
			<section aria-label={title} className={`${quiet} flex min-h-14.5 items-center gap-2.5 px-2.5 py-2 sm:min-h-15.5 sm:gap-4.5 sm:px-3.5`}>
				<span className="flex min-w-0 flex-1 flex-col gap-px sm:w-28 sm:flex-none sm:gap-0.5">
					<span className="text-sm font-bold text-gray-300 sm:text-[15px]">{title}</span>
					<span className="text-[11px] text-gray-400 sm:text-xs">
						<span>Skipped</span>
						<span className="sm:hidden">. Not used, so nothing counts.</span>
					</span>
				</span>
				<span className="hidden flex-1 text-[13px] text-gray-400 sm:block">Not used, so nothing counts.</span>
				{/* Back to how it was: its lineup if it had one, else nothing logged. */}
				<button
					type="button"
					className={SOFT_BUTTON}
					onClick={() => onWrite((current) => (current.runners.length ? { ...current, skipped: false } : null))}
				>
					Undo
				</button>
			</section>
		)
	}

	if (state === "unlogged" || !run) {
		const first = choices.at(0)
		const start = (choice: LineupChoice) => {
			setPicking(false)
			onOpen(true)
			onWrite((current) => withLineup(current, choice.runners))
		}
		return (
			<section aria-label={title} className={quiet}>
				<div className="flex flex-wrap items-center gap-2.5 px-2.5 py-2.5 sm:min-h-15.5 sm:gap-4.5 sm:px-3.5">
					<TicketTitle title={title} status="Not logged yet" muted />
					<span className="flex gap-1.25 sm:flex-1 sm:gap-1.5" aria-hidden="true">
						{RACES.map((race) => (
							<span key={race} className="size-6.5 rounded-md border-[1.5px] border-dashed border-gray-700 sm:size-7.5 sm:rounded-[7px]" />
						))}
					</span>
					<button
						type="button"
						className={`${soft({ size: "min-h-9 px-2", look: "border-transparent text-gray-300 hover:text-gray-50" })} ml-auto sm:order-last sm:ml-0`}
						onClick={() => onWrite(() => ({ ...emptyContent(), skipped: true }))}
					>
						Skip
					</button>
					{/* On a phone the two share a line when they fit; a long "Same three as Day 1, Ticket 4" pushes Pick a team under it. */}
					<span className="flex w-full flex-wrap gap-1.5 sm:w-auto sm:flex-nowrap sm:gap-2">
						{first && (
							<button type="button" className={`${PRIMARY_BUTTON} flex-auto sm:flex-none`} onClick={() => start(first)}>
								<Repeat className="h-4 w-4 shrink-0" aria-hidden="true" />
								{startLabel(first)}
							</button>
						)}
						<button type="button" className={soft({ size: "min-h-11 px-3 sm:min-h-10" })} aria-expanded={picking} onClick={() => setPicking((isOpen) => !isOpen)}>
							Pick a team
						</button>
					</span>
				</div>
				{picking && (
					<LineupPicker eyebrow={eyebrow} heading={`Who ran ${title}?`} choices={choices} shared={shared} onPick={start} />
				)}
			</section>
		)
	}

	const { wins, raced } = tallyRun(run)
	const status =
		state === "stopped"
			? `Stopped after ${raced}`
			: state === "done"
				? `All ${RUN_RACES} raced`
				: raced === 0
					? `${RUN_RACES} races to go`
					: `${RUN_RACES - raced} to go`
	return (
		<section aria-label={title} className={`${box} ${open ? "border-brand/40 bg-gray-800/60" : "border-edge bg-gray-900/40"}`}>
			<button
				type="button"
				aria-expanded={open}
				aria-label={`${title}, ${status}${raced ? `, ${wins} of ${raced} won` : ""}`}
				onClick={() => onOpen(!open)}
				className="flex min-h-14.5 w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left sm:min-h-15.5 sm:gap-4.5 sm:px-3.5 sm:py-2.5"
			>
				<TicketTitle title={title} status={status} />
				{/* The three faces on a closed row, from sm: they tell a mid-day lineup change apart. */}
				<span className="hidden shrink-0 sm:flex" aria-hidden="true">
					<Faces runners={run.runners} shared={shared} className="w-7" />
				</span>
				<span className="flex flex-1 gap-1.25 sm:gap-1.5">
					{RACES.map((race) => (
						<Pip key={race} race={race} run={run} shared={shared} />
					))}
				</span>
				<span className="min-w-10 text-right font-display text-xl font-bold text-gray-50 sm:min-w-12 sm:text-2xl">
					{raced ? wins : "–"}
					{raced > 0 && <span className="text-[13px] font-medium text-gray-400 sm:text-[15px]">/{raced}</span>}
				</span>
				<ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
			</button>
			{!open && run.note && <p className="-mt-1 truncate px-2.5 pb-2 text-xs text-gray-400 sm:px-3.5">{run.note}</p>}
			{open && (
				<div className="flex flex-col gap-3.5 px-2.5 pb-3.5 pt-1 sm:gap-4.5 sm:px-3.5 sm:pb-4.5 sm:pt-1.5">
					<LineupBlock title={title} eyebrow={eyebrow} run={run} choices={choices} shared={shared} onWrite={onWrite} />
					<RaceGrid title={title} run={run} shared={shared} onWrite={onWrite} />
					<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2.5">
						<p className="text-xs text-gray-400 sm:text-[13px]">Tap the uma that finished first, or Loss. Tap it again to clear.</p>
						{state === "started" && (
							<button type="button" className={`${soft({ size: "min-h-10 px-3 sm:min-h-9" })} self-start`} onClick={() => onWrite((current) => ({ ...current, skipped: true }))}>
								{raced ? "Skip the rest" : "Skip this ticket"}
							</button>
						)}
						{state === "stopped" && (
							<span className="flex items-center justify-between gap-2.5 text-xs text-gray-300 sm:text-[13px]">
								Stopped after {raced === 1 ? "1 race" : `${raced} races`}
								<button type="button" className={soft({ size: "min-h-10 px-3 sm:min-h-9" })} onClick={() => onWrite((current) => ({ ...current, skipped: false }))}>
									Undo
								</button>
							</span>
						)}
					</div>
					<NoteField note={run.note} label={`Note for ${title}`} onWrite={onWrite} />
				</div>
			)}
		</section>
	)
}

function TicketTitle({ title, status, muted = false }: { title: string; status: string; muted?: boolean }) {
	return (
		<span className="flex w-18.5 shrink-0 flex-col gap-px sm:w-28 sm:gap-0.5">
			<span className={`text-sm font-bold sm:text-[15px] ${muted ? "text-gray-200" : "text-gray-100"}`}>{title}</span>
			<span className="text-[11px] text-gray-400 sm:text-xs">{status}</span>
		</span>
	)
}

/** One race on a closed row: the winner's face, a cross for a loss, a dash if stopped before it, else its number. */
function Pip({ race, run, shared }: { race: number; run: PvpRun; shared: Shared }) {
	const size = "size-6.5 rounded-md sm:size-7.5 sm:rounded-[7px]"
	const entry = run.races.find((candidate) => candidate.race === race)
	if (entry && entry.winner !== null) {
		const runner = run.runners.find((candidate) => candidate.position === entry.winner)
		const uma = runner && shared.umasById.get(runner.uma)
		const label = `Race ${race}: ${umaName(shared.umasById, runner)} won`
		return (
			<FramedUma
				src={uma?.portrait ?? uma?.image ?? null}
				oshi={runner ? shared.oshiIds.has(runner.uma) : false}
				alt={label}
				title={label}
				className="w-6.5 ring-2 ring-brand sm:w-7.5"
			/>
		)
	}
	if (entry) {
		return (
			<span title={`Race ${race}: lost`} className={`${size} flex items-center justify-center border border-highlight/55 bg-highlight/15 text-highlight`}>
				<X className="h-3.5 w-3.5" aria-hidden="true" />
			</span>
		)
	}
	if (run.skipped) {
		return (
			<span title={`Race ${race}: not run, stopped early`} className={`${size} flex items-center justify-center border border-edge bg-gray-900/60`}>
				<span className="h-0.5 w-2.5 rounded-full bg-gray-500 sm:w-3" />
			</span>
		)
	}
	return (
		<span
			title={`Race ${race}: not raced yet`}
			className={`${size} flex items-center justify-center border-[1.5px] border-dashed border-gray-600 text-[11px] font-semibold text-gray-400 sm:text-xs`}
		>
			{race}
		</span>
	)
}

/** Three faces overlapping, each edged in the card's fill so they read apart. */
function Faces({ runners, shared, className }: { runners: PvpRunRunner[]; shared: Shared; className: string }) {
	return (
		<>
			{runners.map((runner, index) => {
				const uma = shared.umasById.get(runner.uma)
				return (
					<FramedUma
						key={runner.position}
						src={uma?.portrait ?? uma?.image ?? null}
						oshi={shared.oshiIds.has(runner.uma)}
						className={`${className} shadow-[0_0_0_2px_var(--card-fill)] ${index ? "-ml-2" : ""}`}
					/>
				)
			})}
		</>
	)
}

/**
 * The lineups to copy, as cards: three faces, the choice's name, the three
 * names, and a badge. Under a ticket that has none yet ("Pick a team") or
 * one being swapped ("Change umas").
 */
function LineupPicker({ eyebrow, heading, choices, shared, onPick }: {
	eyebrow: string
	heading: string
	choices: LineupChoice[]
	shared: Shared
	onPick: (choice: LineupChoice) => void
}) {
	return (
		<div className="mx-2 mb-2 flex flex-col gap-2.5 rounded-xl border border-brand/40 bg-gray-800/60 p-3 sm:mx-2.5 sm:mb-2.5 sm:gap-3.5 sm:p-3.5">
			<div className="flex items-center justify-between gap-3">
				<span className="flex flex-col gap-0.5">
					<span className="text-[11px] font-bold uppercase tracking-[0.06em] text-brand sm:text-xs">{eyebrow}</span>
					<span className="text-base font-bold text-gray-50 sm:text-[17px]">{heading}</span>
				</span>
				<span className="hidden text-xs text-gray-300 sm:inline">Pick one, you can swap later</span>
			</div>
			{choices.map((choice) => (
				<button
					key={choice.key}
					type="button"
					onClick={() => onPick(choice)}
					className={`flex items-center gap-3 rounded-xl border p-2.5 text-left transition sm:gap-3.5 sm:p-3 ${
						choice.previous ? "border-brand bg-brand/10 hover:bg-brand/15" : "border-gray-600 bg-gray-900/60 hover:border-gray-400"
					}`}
				>
					<span className="flex shrink-0" aria-hidden="true">
						<Faces runners={choice.runners} shared={shared} className="w-9 sm:w-10" />
					</span>
					<span className="flex min-w-0 flex-1 flex-col gap-0.5">
						<span className={`text-sm font-bold ${choice.previous ? "text-brand" : "text-gray-100"}`}>{choice.label}</span>
						<span className="truncate text-xs text-gray-300">
							{choice.runners.map((runner) => umaName(shared.umasById, runner)).join(", ")}
						</span>
					</span>
					{choice.badge && (
						<span
							className={`shrink-0 text-xs ${
								choice.previous ? "rounded-full bg-brand px-2.25 py-0.75 font-bold text-black" : "text-gray-400"
							}`}
						>
							{choice.badge}
						</span>
					)}
				</button>
			))}
			<p className="text-[13px] text-gray-400">
				Ran someone else?{" "}
				<button type="button" className="font-semibold text-brand hover:text-brand/75" onClick={shared.onOpenMyTeam}>
					Build another team in My team
				</button>
			</p>
		</div>
	)
}

/**
 * "Who ran it": the lineup once, each runner with her style and veteran, and
 * Change umas / Clear. Shared by an open ticket and the Finals.
 */
function LineupBlock({ title, eyebrow, run, choices, shared, onWrite }: {
	title: string
	eyebrow: string
	run: PvpRun
	choices: LineupChoice[]
	shared: Shared
	onWrite: (change: RunChange) => void
}) {
	const [picking, setPicking] = useState(false)
	const [confirmClear, setConfirmClear] = useState(false)
	return (
		<div className="flex flex-col gap-2.5">
			<div className="flex items-center justify-between gap-2 sm:gap-3">
				<span className={EYEBROW}>Who ran it</span>
				<div className="flex gap-1.5 sm:gap-2">
					<button type="button" className={SOFT_BUTTON} aria-expanded={picking} onClick={() => setPicking((isOpen) => !isOpen)}>
						<ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
						Change umas
					</button>
					{confirmClear ? (
						<button
							type="button"
							className={soft({ look: "border-highlight text-highlight" })}
							onClick={() => {
								setConfirmClear(false)
								onWrite(() => null)
							}}
							onBlur={() => setConfirmClear(false)}
						>
							Clear it?
						</button>
					) : (
						<button type="button" className={soft({ size: "min-h-9 w-9" })} aria-label={`Clear ${title}`} onClick={() => setConfirmClear(true)}>
							<Trash2 className="h-3.5 w-3.5" />
						</button>
					)}
				</div>
			</div>
			{picking && (
				<div className="-mx-2 sm:-mx-2.5">
					<LineupPicker
						eyebrow={eyebrow}
						heading={`Who ran ${title}?`}
						choices={choices}
						shared={shared}
						onPick={(choice) => {
							setPicking(false)
							onWrite((current) => withLineup(current, choice.runners))
						}}
					/>
				</div>
			)}
			<ul className="grid grid-cols-3 gap-1.5 sm:gap-2">
				{run.runners.map((runner) => {
					const uma = shared.umasById.get(runner.uma)
					return (
						// From sm the portrait is as tall as the card's text column: one
						// line of name (20px), the style (16px) and the veteran button
						// (28px), 4px apart, is 72px, and so is the portrait (w-18). The
						// column is held to that so a long name can't outgrow her. On a
						// phone the card stacks, and the portrait fills its width.
						<li
							key={runner.position}
							className={`${INSET} flex min-w-0 flex-col items-center gap-1.5 p-1.5 pb-2 text-center sm:flex-row sm:gap-3 sm:pb-1.5 sm:text-left`}
						>
							<FramedUma
								src={uma?.portrait ?? uma?.image ?? null}
								oshi={shared.oshiIds.has(runner.uma)}
								alt={uma?.name ?? ""}
								className="w-full max-w-24 shrink-0 sm:w-18"
							/>
							<div className="flex min-w-0 max-w-full flex-col items-center gap-1 sm:max-h-18 sm:items-start">
								<span className="line-clamp-2 max-w-full text-xs font-semibold text-gray-100 sm:line-clamp-1 sm:text-sm" title={uma?.name}>
									{uma?.name ?? "Unknown uma"}
								</span>
								<StyleTag style={runner.style} />
								<VeteranPicker
									uma={uma}
									value={runner.trained_uma}
									veterans={shared.veterans}
									oshi={shared.oshiIds.has(runner.uma)}
									buttonClassName={(linked) =>
										`block h-7 max-w-full truncate rounded-md px-1.75 text-[11px] leading-6.5 transition hover:border-gray-400 sm:px-2 sm:text-xs ${
											linked
												? "border border-gray-600 bg-gray-800 font-bold text-brand"
												: "border border-dashed border-gray-600 font-semibold text-gray-300"
										}`
									}
									onChange={(trainedUma) =>
										onWrite((current) => ({
											...current,
											runners: current.runners.map((entry) =>
												entry.position === runner.position ? { ...entry, trained_uma: trainedUma } : entry
											),
										}))
									}
								/>
							</div>
						</li>
					)
				})}
			</ul>
		</div>
	)
}

/** A running style's word with a dot in its Hakuraku colour (index.css, --color-style-*). */
function StyleTag({ style }: { style: MemberStyle }) {
	return (
		<span className="flex items-center gap-1.25 text-[11px] text-gray-300 sm:gap-1.5 sm:text-xs">
			<span className="size-1.75 shrink-0 rounded-full sm:size-2" style={{ background: styleColor(style) }} aria-hidden="true" />
			{STYLE_LABELS[style]}
		</span>
	)
}

/**
 * The open ticket's races: a column per runner and one for Loss, a row per
 * race, and a Total row counting each column. One tap logs a race, a tap on
 * the chosen button clears it back to "not run".
 */
function RaceGrid({ title, run, shared, onWrite }: {
	title: string
	run: PvpRun
	shared: Shared
	onWrite: (change: RunChange) => void
}) {
	// A spot per runner, then null for Loss.
	const columns: Array<number | null> = [...run.runners.map((runner) => runner.position), null]
	// The label column is a CSS variable so one class switches it at sm.
	const grid = "grid gap-1.25 [--label:50px] sm:gap-1.5 sm:[--label:76px]"
	const template: CSSProperties = { gridTemplateColumns: `var(--label) repeat(${columns.length}, minmax(0, 1fr))` }
	return (
		<div className="flex flex-col gap-1.5" role="group" aria-label="Who won each race">
			<div className={`${grid} items-end pb-0.5 sm:pb-1`} style={template}>
				<span className={`${EYEBROW} pb-1.5 max-sm:invisible`}>Who won</span>
				{columns.map((column) => {
					const runner = run.runners.find((candidate) => candidate.position === column)
					if (!runner) {
						return (
							<div key="loss" className="flex min-w-0 flex-col items-center gap-0.75 sm:flex-row sm:gap-2 sm:px-0.5">
								<span className="flex size-7.5 shrink-0 items-center justify-center rounded-[7px] border-[1.5px] border-dashed border-gray-600 text-gray-400 sm:size-8 sm:rounded-lg">
									<X className="h-3.5 w-3.5" aria-hidden="true" />
								</span>
								<span className="flex min-w-0 flex-col gap-px">
									<span className="text-[10px] font-semibold text-gray-300 sm:text-xs">Loss</span>
									<span className="hidden truncate text-[11px] text-gray-400 sm:block">None of yours won</span>
								</span>
							</div>
						)
					}
					const uma = shared.umasById.get(runner.uma)
					return (
						<div key={runner.position} className="flex min-w-0 flex-col items-center gap-0.75 sm:flex-row sm:gap-2 sm:px-0.5">
							<FramedUma
								src={uma?.portrait ?? uma?.image ?? null}
								oshi={shared.oshiIds.has(runner.uma)}
								alt=""
								className="w-7.5 shrink-0 sm:w-8"
							/>
							<span className="flex min-w-0 flex-col gap-px">
								<span className="hidden truncate text-xs font-semibold text-gray-200 sm:block" title={uma?.name}>
									{uma?.name ?? "Unknown uma"}
								</span>
								<StyleTag style={runner.style} />
							</span>
						</div>
					)
				})}
			</div>
			{RACES.map((race) => {
				const entry = run.races.find((candidate) => candidate.race === race)
				// A race a stopped ticket doesn't list was skipped: the player said it never ran.
				const skipped = entry === undefined && run.skipped
				return (
					<div key={race} className={`${grid} items-center`} style={template}>
						<span className="flex flex-col">
							<span className={`text-xs font-semibold sm:text-[13px] ${entry ? "text-gray-100" : "text-gray-400"}`}>Race {race}</span>
							{skipped && <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-gray-500 sm:text-[11px]">Skipped</span>}
						</span>
						{columns.map((column) => {
							const runner = run.runners.find((candidate) => candidate.position === column)
							return (
								<RaceButton
									key={column ?? "loss"}
									label={`${title}, race ${race}: ${column === null ? "Loss" : `${umaName(shared.umasById, runner)} won`}`}
									loss={column === null}
									decided={entry !== undefined}
									skipped={skipped}
									on={entry !== undefined && entry.winner === column}
									onClick={(on) => onWrite((current) => logRace(current, race, on ? undefined : column))}
								/>
							)
						})}
					</div>
				)
			})}
			<div className={`${grid} mt-0.5 items-center border-t border-edge pt-2 sm:mt-1 sm:pt-2.5`} style={template}>
				<span className="text-xs font-semibold text-gray-300 sm:text-[13px]">Total</span>
				{columns.map((column) => {
					const count = run.races.filter((race) => race.winner === column).length
					return (
						<span
							key={column ?? "loss"}
							className={`text-center font-display text-base font-bold sm:text-lg ${
								count === 0 ? "text-gray-400" : column === null ? "text-highlight" : "text-gray-50"
							}`}
						>
							{count}
						</span>
					)
				})}
			</div>
		</div>
	)
}

/**
 * One button of the race grid: gold with "Won" when it won, red with "Lost" for
 * a picked loss, a hollow ring while the race is open. A race the player
 * skipped (a stopped ticket) is faded and dashed with a dash in it, like its
 * square on the closed row. It still takes a tap: logging it means it ran after
 * all, and logRace takes the stop back.
 */
function RaceButton({ label, loss, decided, skipped, on, onClick }: {
	label: string
	loss: boolean
	decided: boolean
	skipped: boolean
	on: boolean
	onClick: (on: boolean) => void
}) {
	const look = on
		? loss
			? "border-highlight/60 bg-highlight/15 text-highlight"
			: "border-brand bg-brand text-black"
		: decided
			? "border-edge text-gray-400 hover:border-brand"
			: skipped
				? "border-dashed border-gray-700 opacity-60 hover:border-brand hover:opacity-100"
				: "border-edge bg-gray-900/60 text-gray-300 hover:border-brand"
	return (
		<button
			type="button"
			aria-pressed={on}
			aria-label={label}
			onClick={() => onClick(on)}
			className={`flex h-11 min-w-0 items-center justify-center gap-1 rounded-[9px] border text-xs font-bold transition sm:gap-1.5 sm:rounded-[10px] sm:text-[13px] ${look}`}
		>
			{on && !loss && (
				<>
					<Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
					<span>Won</span>
				</>
			)}
			{on && loss && (
				<>
					<X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
					<span>Lost</span>
				</>
			)}
			{!decided && !skipped && <span className="size-3 rounded-full border-[1.5px] border-gray-600 sm:size-3.5" aria-hidden="true" />}
			{skipped && <span className="h-0.5 w-2.5 rounded-full bg-gray-500 sm:w-3" aria-hidden="true" />}
		</button>
	)
}

/**
 * The ticket's note (`PvpRun.note`, 120 characters; notes/cm-runs-plan.md,
 * section 1). Saved when the field loses focus or on Enter, not per key: a
 * save is a PUT. Keyed by the saved note, so a save from elsewhere refills it.
 */
function NoteField({ note, label, onWrite }: { note: string; label: string; onWrite: (change: RunChange) => void }) {
	return (
		<label className="flex flex-col gap-1.5 text-xs font-semibold text-gray-300">
			Note
			<input
				key={note}
				type="text"
				maxLength={120}
				defaultValue={note}
				aria-label={label}
				placeholder="Anything to remember about this ticket"
				onBlur={(blur) => {
					const next = blur.target.value.trim()
					if (next !== note) onWrite((current) => ({ ...current, note: next }))
				}}
				onKeyDown={(key) => {
					if (key.key === "Enter") key.currentTarget.blur()
				}}
				className="min-h-11 rounded-lg border border-gray-600 bg-gray-900 px-3 text-sm font-normal text-gray-100 placeholder:text-gray-500 focus:border-brand focus:outline-none sm:min-h-10"
			/>
		</label>
	)
}

/** Before any team exists and nothing is logged: one way forward, to My team. */
function NoTeamYet({ onOpenMyTeam }: { onOpenMyTeam: () => void }) {
	return (
		<div className="flex flex-col items-center gap-3.5 px-4 py-7 text-center sm:px-6">
			<span className="flex gap-2" aria-hidden="true">
				{[0, 1, 2].map((index) => (
					<span key={index} className="size-13 rounded-[10px] border-[1.5px] border-dashed border-gray-600" />
				))}
			</span>
			<h3 className="font-display text-xl font-bold text-gray-50">Who's running this CM?</h3>
			<p className="max-w-100 text-sm leading-relaxed text-gray-300">
				Build your team in My team first. After that, each ticket copies it in with one tap.
			</p>
			<button type="button" className={PRIMARY_BUTTON} onClick={onOpenMyTeam}>
				<Users className="h-4 w-4" aria-hidden="true" />
				Open My team
			</button>
		</div>
	)
}

// ── The Finals ───────────────────────────────────────────────────────────

function FinalsHeader({ event, constants, run }: { event: RaceEvent; constants: CalculationConstants; run: PvpRun | undefined }) {
	// The Finals start cm_finals_hours after the event does (cmDayAt's rule).
	const start = parseApiDate(event.start_date)
	const finalsDate = start ? formatDate(new Date(start.getTime() + constants.cm_finals_hours * 3_600_000).toISOString()) : ""
	const placement = run?.placement ?? null
	return (
		<CardHeader
			eyebrow={finalsDate ? `${finalsDate} · One race` : "One race"}
			title="Finals"
			score={placement ? ordinal(placement) : "–"}
			detail={placement ? (run?.finals_group ? `in Group ${run.finals_group}` : "Group not set") : "Not logged yet"}
		/>
	)
}

function TopHeader({ run }: { run: PvpRun | undefined }) {
	const placement = run?.placement ?? null
	return (
		<CardHeader
			eyebrow="After day 6"
			title="Top 96"
			score={placement ? ordinal(placement) : "–"}
			detail={placement ? "your placement" : "Not logged yet"}
		/>
	)
}

/**
 * The Top 96: the team entered, where the player finished, and a note. The
 * placement saves when the field loses focus or on Enter, like NoteField, and
 * a number the game can't give goes back to the saved one. Taking the team off
 * leaves the placement and note: LineupBlock's clear means the whole row on a
 * ticket, and nothing here is a ticket's.
 */
function TopBody({ run, choices, shared, onWrite }: {
	run: PvpRun | undefined
	choices: LineupChoice[]
	shared: Shared
	onWrite: (change: RunChange) => void
}) {
	const saved = run?.placement ?? null
	const save = (input: HTMLInputElement) => {
		const text = input.value.trim()
		const next = text === "" ? null : Number(text)
		if (next !== null && !(Number.isInteger(next) && next >= 1 && next <= LOH_TOP_PLACEMENTS)) {
			input.value = saved === null ? "" : String(saved)
			toast.error(`A Top 96 placement is 1 to ${LOH_TOP_PLACEMENTS}.`)
			return
		}
		if (next !== saved) onWrite((current) => ({ ...current, placement: next }))
	}
	return (
		<div className="flex flex-col gap-4 px-3.5 pb-5 pt-4 sm:gap-5 sm:px-5 sm:pb-6 sm:pt-5">
			<p className="text-sm text-gray-200 sm:text-[15px]">Made the Top 96? Add the team you entered and where you finished. If you didn't, leave this empty.</p>
			{run && run.runners.length > 0 ? (
				<LineupBlock
					title="Top 96"
					eyebrow="Top 96"
					run={run}
					choices={choices}
					shared={shared}
					onWrite={(change) => onWrite((current) => change(current) ?? { ...current, runners: [] })}
				/>
			) : (
				choices.length > 0 && (
					<LineupStart
						question="Which team did you enter? It has to be one you registered on days 1 to 6."
						eyebrow="Top 96"
						choices={choices}
						shared={shared}
						onPick={(choice) => onWrite((current) => withLineup(current, choice.runners))}
					/>
				)
			)}
			<label className="flex w-40 flex-col gap-1.5 text-xs font-semibold text-gray-300">
				Your placement
				<input
					key={saved ?? "none"}
					type="number"
					inputMode="numeric"
					min={1}
					max={LOH_TOP_PLACEMENTS}
					defaultValue={saved ?? ""}
					onBlur={(blur) => save(blur.target)}
					onKeyDown={(key) => {
						if (key.key === "Enter") key.currentTarget.blur()
					}}
					className="min-h-11 rounded-lg border border-gray-600 bg-gray-900 px-3 text-sm font-normal text-gray-100 focus:border-brand focus:outline-none sm:min-h-10"
				/>
			</label>
			<NoteField note={run?.note ?? ""} label="Note for the Top 96" onWrite={onWrite} />
		</div>
	)
}

/** A row with no lineup yet: the first choice in one tap, or the whole list. */
function LineupStart({ question, eyebrow, choices, shared, onPick }: {
	question: string
	eyebrow: string
	choices: LineupChoice[]
	shared: Shared
	onPick: (choice: LineupChoice) => void
}) {
	const [picking, setPicking] = useState(false)
	const first = choices.at(0)
	const start = (choice: LineupChoice) => {
		setPicking(false)
		onPick(choice)
	}
	return (
		<>
			<div className="flex flex-col gap-3 sm:items-start sm:gap-3.5">
				<p className="text-sm text-gray-200 sm:text-[15px]">{question}</p>
				<span className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
					{first && (
						<button type="button" className={PRIMARY_BUTTON} onClick={() => start(first)}>
							<Repeat className="h-4 w-4 shrink-0" aria-hidden="true" />
							{startLabel(first)}
						</button>
					)}
					<button type="button" className={soft({ size: "min-h-11 px-3 sm:min-h-10" })} aria-expanded={picking} onClick={() => setPicking((isOpen) => !isOpen)}>
						Pick a team
					</button>
				</span>
			</div>
			{picking && <LineupPicker eyebrow={eyebrow} heading={question} choices={choices} shared={shared} onPick={start} />}
		</>
	)
}

function FinalsBody({ run, choices, shared, onWrite }: {
	run: PvpRun | undefined
	choices: LineupChoice[]
	shared: Shared
	onWrite: (change: RunChange) => void
}) {
	if (!run || run.runners.length === 0) {
		return (
			<div className="px-3.5 pb-5.5 pt-5 sm:px-5 sm:pb-8 sm:pt-7">
				<LineupStart
					question="Who ran the Finals?"
					eyebrow="Finals"
					choices={choices}
					shared={shared}
					onPick={(choice) => onWrite((current) => withLineup(current, choice.runners))}
				/>
			</div>
		)
	}

	const race = run.races.find((entry) => entry.race === 1)
	const columns: Array<number | null> = [...run.runners.map((runner) => runner.position), null]
	return (
		<div className="flex flex-col gap-4 px-3 pb-4.5 pt-3.5 sm:gap-5.5 sm:px-5 sm:pb-6 sm:pt-4.5">
			<LineupBlock title="Finals" eyebrow="Finals" run={run} choices={choices} shared={shared} onWrite={onWrite} />
			<div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:gap-7">
				<ChoiceGroup
					label="Your group"
					options={(["A", "B"] as const).map((group) => ({ key: group, label: `Group ${group}`, on: run.finals_group === group }))}
					wide
					// A second tap on the chosen group clears it.
					onPick={(group) =>
						onWrite((current) => ({ ...current, finals_group: (current.finals_group === group ? "" : group) as PvpFinalsGroup }))
					}
				/>
				<ChoiceGroup
					label="Where you placed"
					options={[1, 2, 3].map((place) => ({ key: String(place), label: ordinal(place), on: run.placement === place }))}
					onPick={(place) =>
						onWrite((current) => ({ ...current, placement: current.placement === Number(place) ? null : Number(place) }))
					}
				/>
			</div>
			<div className="flex flex-col gap-1.5 sm:gap-2" role="group" aria-label="Who won the Finals race">
				<span className={EYEBROW}>Who won the race</span>
				<div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
					{columns.map((column) => {
						const runner = run.runners.find((candidate) => candidate.position === column)
						const uma = runner && shared.umasById.get(runner.uma)
						const on = race !== undefined && race.winner === column
						const loss = column === null
						const look = on
							? loss
								? "border-highlight/60 bg-highlight/15 text-highlight"
								: "border-brand bg-brand text-black"
							: race
								? "border-edge text-gray-300 hover:border-brand"
								: "border-edge bg-gray-900/60 text-gray-300 hover:border-brand"
						return (
							<button
								key={column ?? "loss"}
								type="button"
								aria-pressed={on}
								aria-label={`The Finals race: ${loss ? "Loss" : `${umaName(shared.umasById, runner)} won`}`}
								// A win is 1st place, so a winner fills a blank placement.
								onClick={() =>
									onWrite((current) => {
										const winner = on ? undefined : column
										return {
											...current,
											races: setRace(current.races, 1, winner),
											placement: typeof winner === "number" && current.placement === null ? 1 : current.placement,
										}
									})
								}
								className={`flex min-h-13 min-w-0 items-center gap-2 rounded-[10px] border px-2.5 py-1.5 text-left text-xs font-bold transition sm:min-h-14 sm:text-[13px] ${look}`}
							>
								{runner ? (
									<FramedUma
										src={uma?.portrait ?? uma?.image ?? null}
										oshi={shared.oshiIds.has(runner.uma)}
										className="w-7.5 shrink-0 sm:w-8"
									/>
								) : (
									<span className="flex size-7.5 shrink-0 items-center justify-center rounded-[7px] border-[1.5px] border-dashed border-current opacity-70 sm:size-8 sm:rounded-lg">
										<X className="h-3.5 w-3.5" aria-hidden="true" />
									</span>
								)}
								<span className="flex min-w-0 flex-col">
									<span className="line-clamp-2">{loss ? "Loss" : umaName(shared.umasById, runner)}</span>
									{on && <span className="text-[11px] font-semibold">{loss ? "Lost" : "Won"}</span>}
								</span>
							</button>
						)
					})}
				</div>
				<p className="mt-1 text-xs text-gray-400 sm:mt-1.5 sm:text-[13px]">
					One of yours winning means you placed 1st, so that fills in by itself.
				</p>
			</div>
			<NoteField note={run.note} label="Note for the Finals" onWrite={onWrite} />
		</div>
	)
}

/** A row of radio buttons; a tap on the chosen one clears it. */
function ChoiceGroup({ label, options, wide = false, onPick }: {
	label: string
	options: Array<{ key: string; label: string; on: boolean }>
	/** Wider buttons (Group A / Group B). */
	wide?: boolean
	onPick: (key: string) => void
}) {
	return (
		<div role="radiogroup" aria-label={label} className="flex flex-col gap-1.5 sm:gap-2">
			<span className={EYEBROW}>{label}</span>
			<div className="grid gap-1.5 sm:flex" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
				{options.map((option) => (
					<button
						key={option.key}
						type="button"
						role="radio"
						aria-checked={option.on}
						onClick={() => onPick(option.key)}
						className={`min-h-11 rounded-[10px] border px-4 text-sm font-bold transition ${wide ? "sm:min-w-26" : "sm:min-w-18"} ${
							option.on ? "border-brand bg-brand text-black" : "border-gray-600 bg-gray-900 text-gray-200 hover:border-gray-400"
						}`}
					>
						{option.label}
					</button>
				))}
			</div>
		</div>
	)
}

// ── The totals ───────────────────────────────────────────────────────────

/** A thin bar filled to the win rate. Named for a screen reader only when `label` is given. */
function RateBar({ tally, className, label }: { tally: Tally; className: string; label?: string }) {
	const width = tally.raced ? (tally.wins / tally.raced) * 100 : 0
	return (
		<div
			className={`overflow-hidden rounded-full bg-gray-700 ${className}`}
			{...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
		>
			<div className="h-full rounded-full bg-brand" style={{ width: `${width}%` }} />
		</div>
	)
}

/** "4 of 5", or an en dash when nothing was raced. No round: the whole event. */
function bestText(runs: PvpRun[], round?: number): string {
	const best = bestTicketWins(runs, round)
	return best === null ? "–" : `${best} of ${RUN_RACES}`
}

/**
 * The phone's three numbers, over the tabs: the win rate, today's races (the
 * Finals once Round 2 has ended) and the current round's best ticket. The per-uma
 * bars stay in the Summary, which a phone shows under the day.
 */
function WinRateStrip({ event, runs, today, shape }: { event: RaceEvent; runs: PvpRun[]; today: number | null; shape: RunShape }) {
	const { total } = summarizeRuns(runsOf(runs, {}))
	// Before Round 1 no day is today, so the middle cell shows Day 1, the day the view opens on.
	const shown = today === null ? null : Math.max(1, today)
	const day = shown === null ? null : summarizeRuns(runsOf(runs, { day: shown })).total
	const final = findRun(runs, { stage: "final" })
	const round = shown === null ? 2 : roundOfDay(shown)
	const cell = "border-l border-edge pl-2.5"
	return (
		<section aria-label="Win rate so far" className="card-panel flex flex-col gap-2.5 px-3.5 pb-3.5 pt-3 sm:hidden">
			<h2 className="flex items-center gap-1.5 font-display text-[15px] font-bold text-gray-50">
				<Trophy className="h-4 w-4 text-brand" aria-hidden="true" />
				{splitEventName(event).title} so far
			</h2>
			<dl className="grid grid-cols-[1.2fr_1fr_1fr] gap-2">
				<div>
					<dt className="text-[11px] text-gray-400">Win rate</dt>
					<dd className="mt-0.5 font-display text-[30px] font-bold leading-none text-gray-50">{formatRate(total)}</dd>
					<dd className="mt-1 text-[11px] text-gray-400">{`${total.wins} of ${total.raced} races`}</dd>
				</div>
				{day ? (
					<div className={cell}>
						<dt className="text-[11px] text-gray-400">{today === CM_NOT_STARTED ? "Day 1" : "Today"}</dt>
						<dd className="mt-0.5 font-display text-[22px] font-bold leading-tight text-gray-50">{day.raced ? `${day.wins}/${day.raced}` : "–"}</dd>
						<dd className="mt-0.5 text-[11px] text-gray-400">races won</dd>
					</div>
				) : (
					<div className={cell}>
						<dt className="text-[11px] text-gray-400">{shape.rounds ? "Finals" : "Top 96"}</dt>
						<dd className="mt-0.5 font-display text-[22px] font-bold leading-tight text-gray-50">{final?.placement ? ordinal(final.placement) : "–"}</dd>
						<dd className="mt-0.5 text-[11px] text-gray-400">{final?.finals_group ? `Group ${final.finals_group}` : shape.rounds ? "One race" : "your placement"}</dd>
					</div>
				)}
				<div className={cell}>
					<dt className="text-[11px] text-gray-400">{shape.rounds ? `Round ${round} best` : "Best"}</dt>
					<dd className="mt-0.5 font-display text-[22px] font-bold leading-tight text-gray-50">{bestText(runs, shape.rounds ? round : undefined)}</dd>
					<dd className="mt-0.5 text-[11px] text-gray-400">one ticket</dd>
				</div>
			</dl>
			<RateBar tally={total} className="h-1.5" label={`Win rate ${formatRate(total)}`} />
			<p className="text-[11px] text-gray-400">{ticketsText(ticketCounts(runs))}</p>
		</section>
	)
}

/**
 * The side column: the win rate, tickets used, each round's best ticket and
 * the Finals; each uma (each veteran) with a bar; each day. On a phone only
 * the per-uma part shows: WinRateStrip carries the headline numbers.
 */
function Summary({ runs, event, shape, umasById, oshiIds, veterans }: {
	runs: PvpRun[]
	event: RaceEvent
	shape: RunShape
	umasById: Map<number, CatalogueUma>
	oshiIds: ReadonlySet<number>
	veterans: TrainedUma[]
}) {
	const dayRuns = runsOf(runs, {})
	const { total, umas: tallies } = summarizeRuns(dayRuns)
	// A ticket with a lineup and nothing raced yet makes a "0 of 0" row: left out.
	const umas = tallies.filter((tally) => tally.raced > 0)
	const final = findRun(runs, { stage: "final" })
	// Each tally's style, from the runs it ran in (a tally is an uma and veteran, not a style).
	const styles = new Map<string, MemberStyle>()
	for (const run of dayRuns) {
		for (const runner of run.runners) styles.set(`${runner.uma}:${runner.trained_uma ?? ""}`, runner.style)
	}
	const footnote = shape.rounds ? `Days 1 to ${shape.days}. The Finals race counts on its own.` : `Days 1 to ${shape.days}.`
	return (
		<aside aria-label="Your win rates" className="card-panel min-w-0">
			<div className="hidden flex-col gap-3.5 border-b border-edge px-5 py-4.5 sm:flex">
				<div className="flex items-center gap-2 text-brand">
					<Trophy className="h-4 w-4" aria-hidden="true" />
					<h2 className="font-display text-lg font-bold text-gray-50">{splitEventName(event).title} so far</h2>
				</div>
				<div className="flex items-end gap-3">
					<span className="font-display text-[56px] font-bold leading-[0.9] text-gray-50">{formatRate(total)}</span>
					<span className="flex flex-col gap-0.5 pb-0.5">
						<span className="text-sm font-semibold text-gray-200">win rate</span>
						<span className="text-[13px] text-gray-400">{`${total.wins} of ${total.raced} races`}</span>
						<span className="text-[13px] text-gray-400">{ticketsText(ticketCounts(runs))}</span>
					</span>
				</div>
				<RateBar tally={total} className="h-2" label={`Win rate ${formatRate(total)}`} />
				{shape.rounds ? (
					<dl className="grid grid-cols-3 gap-2">
						<Stat label="Round 1 best" value={bestText(runs, 1)} />
						<Stat label="Round 2 best" value={bestText(runs, 2)} />
						<Stat
							label="Finals"
							value={final?.placement ? ordinal(final.placement) : "–"}
							detail={final?.finals_group ? `Group ${final.finals_group}` : final?.placement ? "Group not set" : "Not run yet"}
						/>
					</dl>
				) : (
					<dl className="grid grid-cols-2 gap-2">
						<Stat label="Best ticket" value={bestText(runs)} />
						<Stat label="Top 96" value={final?.placement ? ordinal(final.placement) : "–"} detail={final?.placement ? undefined : "Not logged"} />
					</dl>
				)}
			</div>

			<div className="flex flex-col gap-3.5 p-3.5 sm:gap-4 sm:border-b sm:border-edge sm:px-5 sm:py-4.5">
				<h3 className={EYEBROW}>By uma</h3>
				{umas.length === 0 ? (
					<p className="text-[13px] text-gray-400">Log a race to see how each uma does.</p>
				) : (
					<ul className="flex flex-col gap-3.5 sm:gap-4">
						{umas.map((tally) => {
							const key = `${tally.uma}:${tally.trained_uma ?? ""}`
							const uma = umasById.get(tally.uma)
							const style = styles.get(key)
							return (
								<li key={key} className="flex items-center gap-2.5 sm:gap-3">
									<FramedUma
										src={uma?.portrait ?? uma?.image ?? null}
										oshi={oshiIds.has(tally.uma)}
										alt=""
										className="w-9.5 shrink-0 sm:w-10.5"
									/>
									<div className="flex min-w-0 flex-1 flex-col gap-1.25 sm:gap-1.5">
										<div className="flex items-baseline justify-between gap-2">
											<span className="truncate text-[13px] font-semibold text-gray-100 sm:text-sm" title={uma?.name}>
												{uma?.name ?? "Unknown uma"}
											</span>
											<span className="font-display text-base font-bold text-gray-50 sm:text-[17px]">{formatRate(tally)}</span>
										</div>
										<RateBar tally={tally} className="h-1.5" />
										<div className="flex justify-between gap-2 text-[11px] text-gray-400 sm:text-xs">
											<span className="flex min-w-0 items-center gap-1.5">
												{style && <StyleTag style={style} />}
												<VeteranLink
													veteran={veterans.find((veteran) => veteran.id === tally.trained_uma)}
													linked={tally.trained_uma !== null}
													hasVeterans={veteransOf(veterans, tally.uma).length > 0}
												/>
											</span>
											<span className="shrink-0">{`${tally.wins} of ${tally.raced} won`}</span>
										</div>
									</div>
								</li>
							)
						})}
					</ul>
				)}
				<p className="border-t border-edge pt-2.5 text-[11px] text-gray-400 sm:hidden">{footnote}</p>
			</div>

			<div className="hidden flex-col gap-3 px-5 py-4.5 sm:flex">
				<h3 className={EYEBROW}>By day</h3>
				<div className={`grid gap-2 ${shape.rounds ? "grid-cols-4" : "grid-cols-3"}`}>
					{Array.from({ length: shape.days }, (_, index) => {
						const day = index + 1
						const tally = summarizeRuns(runsOf(runs, { day })).total
						return (
							<div key={day} className={`${INSET} min-w-0 p-2 text-center`}>
								<div className="text-[11px] font-semibold text-gray-400">Day {day}</div>
								<div className={`font-display text-lg font-bold ${tally.raced ? "text-gray-50" : "text-gray-400"}`}>{formatRate(tally)}</div>
								<div className="text-[11px] text-gray-400">{tally.raced ? `${tally.wins} of ${tally.raced}` : "Not started"}</div>
							</div>
						)
					})}
				</div>
				<p className="text-xs text-gray-400">{footnote}</p>
			</div>
		</aside>
	)
}

/**
 * A summary row's veteran: her label or memo and her grade and score
 * ("A+ 13,815"; utils/veteranGrade.ts), stats in the tooltip, linked to her on the
 * Collection page, which scrolls to and rings her (`?veteran=`). A linked
 * veteran since deleted reads as such. A runner with none says so only when
 * the account has a veteran of that uma to pick.
 */
function VeteranLink({ veteran, linked, hasVeterans }: { veteran: TrainedUma | undefined; linked: boolean; hasVeterans: boolean }) {
	if (!linked) return hasVeterans ? <span className="truncate">No veteran picked</span> : null
	if (!veteran) return <span className="truncate text-gray-500">(a deleted veteran)</span>
	return (
		<Link
			to={`/app/collection?veteran=${veteran.id}`}
			className="truncate font-bold text-brand hover:text-brand/75"
			title={statsTitle(veteran)}
		>
			{veteranText(veteran)}
		</Link>
	)
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
	return <p className="rounded-xl border border-edge bg-gray-800/60 p-4 text-sm text-gray-300">{children}</p>
}
