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
 * An empty ticket starts in one tap from a team in My team: a button per
 * team, the one the ticket before ran first ("Use Team 1"); "Pick a team"
 * shows them with their umas. A ticket only ever holds a team (owner,
 * 2026-11-12, Daptrius's ask): "Same three as Ticket 2" is gone. The lineup
 * is COPIED into the ticket, so editing the team later never changes what was
 * logged. "Use Team 1 for all of them" (EveryTicketLeft) puts a team on every
 * ticket not raced yet and the Finals at once, replacing what was there, and
 * each day can do the same for itself; both can clear, and both offer Undo.
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
 * League of Heroes is this same view with a different RunShape: thirty tickets
 * in tabs of five, no rounds and no days (a ticket can be saved for later:
 * utils/pvpRuns.ts), and a Top 96 tab where the Finals would be, which takes the
 * team entered, a typed placement and a note (TopBody). Everything else reads
 * the shape, so a fix to a ticket reaches both.
 *
 * Inside the /app loading gate, so it may read the clock during render.
 */

import { Fragment, useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react"
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
import { PvpCardPicker } from "./PvpCardPicker"
import { ReplayImport } from "./ReplayImport"
import { useReplayContext, useReplayWatch, type ReplayWatch } from "../../hooks/useReplayWatch"
import { SaveStatus } from "./SaveStatus"
import { STYLE_LABELS, styleColor } from "../../utils/pvpGuide"
import { formatDate, parseApiDate } from "../../utils/dateFormat"
import { refForRaceEvent, sameEvent, splitEventName } from "../../utils/pvpEvent"
import {
	CM_NOT_STARTED,
	LOH_MAX_PLACEMENT,
	RUN_RACES,
	bestTicketWins,
	dayLabel,
	clearLineup,
	isUnraced,
	contentOf,
	emptyContent,
	findRun,
	formatPoints,
	formatRate,
	fullyPlaced,
	isPastDay,
	lossReasonLabel,
	lossReasons,
	nextRaceToPlace,
	lineupFromTeam,
	logRace,
	openingTab,
	ordinal,
	placeOf,
	placeTallies,
	racePoints,
	beatenBy,
	setLostTo,
	setPlace,
	previousRun,
	registeredLineups,
	roundOfDay,
	runDayAt,
	runShape,
	runsOf,
	sameLineup,
	setRace,
	summarizeRuns,
	tallyPoints,
	tallyRun,
	ticketCounts,
	ticketNumber,
	ticketRange,
	ticketState,
	unloggedTickets,
	unracedSlots,
	type PointsTally,
	type RunShape,
	type Tally,
	type TicketState,
} from "../../utils/pvpRuns"
import type { CalculationConstants, RaceEvent } from "../../types"
import type { CatalogueSkill, CatalogueUma, MemberStyle, PvpTeam } from "../../types/pvpTeam"
import type { PvpFinalsGroup, PvpRun, PvpRunContent, PvpRunRace, PvpRunRunner, PvpRunSlot } from "../../types/pvpRun"
import { hoverCardProps } from "../../utils/hoverCards"

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
/** The same for runs not loaded yet (the folder watch's deps). */
const NO_RUNS: PvpRun[] = []
// The Won by picker recommends nothing.
const NO_PICKS = new Set<number>()
/** Won by's quick chips, before "Other…" (notes/cm-runs-plan-2.md, "Won by"). */
const WON_BY_CHIPS = 4

/** A day tab's id: a CM day 1..4, or the Finals. */
type DayTab = number | "final"

/** The races a ticket can hold, 1..5. */
const RACES = Array.from({ length: RUN_RACES }, (_, index) => index + 1)

/** What a lineup choice is called and what it copies in. */
interface LineupChoice {
	key: string
	/** The team's name, or "Same three as Ticket 2" for a LoH Top 96 (topChoices). */
	label: string
	/** A small tag on the right: "Team 2" on a named team. */
	badge: string | null
	/** A logged ticket's three (the Top 96 only), drawn in the brand colour. */
	previous: boolean
	/** The team's id, which the ticket then follows (null: the Top 96's, or a team not saved yet). */
	team: number | null
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
	/** The catalogue, for the Won by picker (PvpCardPicker). */
	umas: CatalogueUma[]
	skillsById: Map<number, CatalogueSkill>
	event: RaceEvent
	/** "Log places" (on this device): the place strips under the open race. */
	logPlaces: boolean
	onLogPlaces: (on: boolean) => void
	/** Runners in a race, so the strip runs 1st to this: 9 in a CM, 12 in a LoH (RunShape). */
	places: number
	/** A LoH: races are scored (LOH_PLACE_POINTS), and points show where a CM shows wins. */
	points: boolean
	/** Won by's quick picks: the umas that beat the player most this event, at most four. */
	wonByChips: number[]
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
	const [logPlaces, setLogPlaces] = useLogPlaces()
	// The catalogue's umas, for the Won by picker.
	const catalogueById = catalogue.status === "ready" ? catalogue.umasById : null
	const catalogueUmas = useMemo(() => [...(catalogueById?.values() ?? [])], [catalogueById])
	const saving = useRunsSaving(ref)
	const [failed, setFailed] = useState(false)
	const save = useSaveRun(ref, (message) => {
		setFailed(true)
		toast.error(message)
	})

	useEffect(() => {
		ensureLoaded()
	}, [ensureLoaded])

	// The tab the player chose. Until they do it's openingTab's, worked out
	// once the runs are here; the first write pins it, so logging the last
	// race of a LoH's five tickets doesn't move them on mid-tap.
	const [chosenTab, setTab] = useState<DayTab | null>(null)
	// Which ticket is open on each day, once the player has opened, closed or
	// written one there. Until then the day opens its ticket in progress
	// (defaultOpenTicket), worked out afresh on each render; the first write
	// pins it, so logging a ticket's fifth race doesn't fold it away.
	const [openByDay, setOpenByDay] = useState<Record<number, number | null>>({})
	// The "Fill from replays" panel (ReplayImport): open or folded (per device),
	// and what it previews: files the player picks, or what the folder watch read.
	const [replaysOpen, setReplaysOpen] = useReplaysOpen()
	const [replaySource, setReplaySource] = useState<{ from: "files" | "watch"; round: number }>({ from: "files", round: 0 })

	// The event's teams with at least one uma: the lineups a ticket can copy.
	const eventTeams = useMemo(() => {
		const eventRef = refForRaceEvent(event)
		return teams.filter((team) => sameEvent({ kind: team.kind, id: team.event }, eventRef) && team.members.length > 0)
	}, [teams, event])

	// Replays: one context for the files and the folder watch (notes/cm-runs-plan-2.md, PRs 5 and 6).
	const replayContext = useReplayContext(event, calculationConstants, catalogueUmas, veterans, eventTeams)
	const saveReplay = (slot: PvpRunSlot, change: RunChange) => {
		setFailed(false)
		save(slot, change)
	}
	const watch = useReplayWatch({
		// A CM only, and never against runs or a catalogue not loaded yet.
		ready: shape.rounds && runsQuery.data !== undefined && catalogue.status === "ready",
		runs: runsQuery.data ?? NO_RUNS,
		ctx: replayContext,
		onSave: saveReplay,
	})

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
	const shared: Shared = {
		umasById: catalogue.umasById,
		umas: catalogueUmas,
		skillsById: catalogue.skillsById,
		event,
		logPlaces,
		onLogPlaces: setLogPlaces,
		places: shape.places,
		points: shape.points,
		wonByChips: beatenBy(runs).umas.slice(0, WON_BY_CHIPS).map((entry) => entry.uma),
		oshiIds,
		veterans,
		onOpenMyTeam,
	}
	const today = runDayAt(event, calculationConstants, new Date(), shape)
	const tab: DayTab = chosenTab ?? openingTab(runs, today, shape)
	const openOn = (day: number) => (day in openByDay ? openByDay[day] : defaultOpenTicket(runs, day, shape.tickets))
	const setOpen = (day: number, ticket: number | null) => setOpenByDay((open) => ({ ...open, [day]: ticket }))

	const write = (slot: PvpRunSlot, change: RunChange) => {
		setFailed(false)
		setTab(tab)
		// Pin the day's open ticket as it is now, unless the player already chose
		// one (a ticket just started opens itself in the same click).
		if (slot.stage === "day") {
			const pinned = openOn(slot.day)
			setOpenByDay((open) => (slot.day in open ? open : { ...open, [slot.day]: pinned }))
		}
		save(slot, change)
	}
	// One change on many unraced tickets (EveryTicketLeft, DayBulk). Each slot
	// saves on its own, through the event's one save queue; Undo writes back
	// what each held, from the runs as they are now.
	const bulk = (slots: PvpRunSlot[], change: RunChange, message: string) => {
		setFailed(false)
		const before = slots.map((slot) => {
			const run = findRun(runs, slot)
			return { slot, content: run ? contentOf(run) : null }
		})
		for (const slot of slots) save(slot, change)
		toast.success(message, {
			action: { label: "Undo", onClick: () => before.forEach(({ slot, content }) => save(slot, () => content)) },
		})
	}
	const bulkTeam = (slots: PvpRunSlot[], choice: LineupChoice, where: string) =>
		bulk(slots, (current) => withLineup(current, choice), `${choice.label} is on ${where}.`)
	const bulkClear = (slots: PvpRunSlot[], where: string) => bulk(slots, clearLineup, `Cleared the teams from ${where}.`)
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
					<LeagueTabs tab={tab} runs={runs} final={final} shape={shape} onChange={setTab} />
				)}
				<SaveStatus mode="account" saveState={failed ? "error" : saving ? "saving" : "saved"} hasTeam={runs.length > 0} />
			</div>

			{shape.rounds && watch.state !== "off" && (
				<WatchBar
					watch={watch}
					onLook={() => {
						setReplaysOpen(true)
						setReplaySource({ from: "watch", round: replaySource.round + 1 })
					}}
				/>
			)}

			{/* A CM only: the import reads Champions replays (notes/cm-runs-plan-2.md, PR 5). */}
			{shape.rounds && (
				<ReplayImport
					// A fresh panel per source and after each Save or Clear.
					key={`${replaySource.from}-${replaySource.round}`}
					open={replaysOpen}
					onToggle={() => setReplaysOpen(!replaysOpen)}
					ctx={replayContext}
					runs={runs}
					initialRaces={replaySource.from === "watch" ? watch.races : undefined}
					watch={watch.supported && watch.state === "off" ? { onStart: watch.start } : undefined}
					onSave={saveReplay}
					onSaved={(day) => setTab(day)}
					onClear={() => setReplaySource({ from: "files", round: replaySource.round + 1 })}
				/>
			)}

			{!noLineups && (
				<EveryTicketLeft
					runs={runs}
					choices={lineupChoices(runs, eventTeams, shape.days + 1, 1)}
					today={today}
					shape={shape}
					onTeam={(slots, choice) => bulkTeam(slots, choice, "every ticket left")}
					onClear={(slots) => bulkClear(slots, "every ticket left")}
				/>
			)}

			<div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1fr)_22.5rem] lg:gap-5">
				<section className="card-panel min-w-0" aria-label={tab === "final" ? (shape.rounds ? "Finals" : "Placement") : dayLabel(tab, shape)}>
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
							shape={shape}
							open={openOn(tab)}
							onOpen={(ticket) => setOpen(tab, ticket)}
							shared={shared}
							onWrite={write}
							onTeam={(slots, choice) => bulkTeam(slots, choice, `${dayLabel(tab, shape)}'s tickets`)}
							onClear={(slots) => bulkClear(slots, `${dayLabel(tab, shape)}'s tickets`)}
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

/** "Ticket 2" on the same day, else "Day 1, Ticket 2". A LoH's numbers need no day. */
function ticketSource(run: PvpRun, shape: RunShape, sameDay: boolean): string {
	const number = ticketNumber(run.day ?? 1, run.ticket ?? 1, shape)
	return sameDay || !shape.rounds ? `Ticket ${number}` : `Day ${run.day}, Ticket ${number}`
}

/**
 * Who could run a ticket: the event's teams from My team, and only those (owner,
 * 2026-11-12: a ticket always holds a team). The team the latest earlier
 * ticket ran comes first, since most players run the same team all day, so
 * the one-tap button repeats it. An unnamed team is "Team 2" (TeamBuilder's
 * rule); a named one carries that as its badge.
 */
function lineupChoices(runs: PvpRun[], teams: PvpTeam[], day: number, ticket: number): LineupChoice[] {
	const choices: LineupChoice[] = teams.map((team, index) => {
		const named = team.name.trim()
		return {
			key: team.key,
			label: named || `Team ${index + 1}`,
			badge: named ? `Team ${index + 1}` : null,
			previous: false,
			team: team.id,
			runners: lineupFromTeam(team.members),
		}
	})
	const previous = previousRun(runs, day, ticket)
	// The team it follows, else (filled before the link existed) the same three.
	const ranBefore = previous
		? choices.findIndex((choice) => (previous.team !== null && choice.team === previous.team) || sameLineup(choice.runners, previous.runners))
		: -1
	if (ranBefore > 0) choices.unshift(...choices.splice(ranBefore, 1))
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
		label: `Same three as ${ticketSource(run, shape, false)}`,
		badge: null,
		previous: true,
		team: null,
		runners: run.runners,
	}))
}

/**
 * "Use Team 1 for all of them": one tap puts a team on every ticket not raced
 * yet (unracedSlots: today's and later days', and the Finals), replacing what
 * was there, where it took a tap per ticket, 17 in all. A button per team
 * (Daptrius, 2026-11-05), and Clear once any of them holds a team. Gone once
 * fewer than two tickets are left: a single ticket starts from its own row.
 */
function EveryTicketLeft({ runs, choices, today, shape, onTeam, onClear }: {
	runs: PvpRun[]
	choices: LineupChoice[]
	today: number | null
	shape: RunShape
	onTeam: (slots: PvpRunSlot[], choice: LineupChoice) => void
	onClear: (slots: PvpRunSlot[]) => void
}) {
	const slots = unracedSlots(runs, today, shape)
	if (slots.length < 2 || choices.length === 0) return null
	// Two slots or more, and only one can be the Finals, so there is always a ticket.
	const tickets = slots.filter((slot) => slot.stage === "day").length
	const finals = slots.some((slot) => slot.stage === "final")
	const what = `${tickets} ${tickets === 1 ? "ticket" : "tickets"}${finals ? " and the Finals" : ""}`
	const withTeam = slots.filter((slot) => (findRun(runs, slot)?.runners.length ?? 0) > 0)
	return (
		<section aria-label="Every ticket left" className="card-panel">
			<div className="flex flex-wrap items-center gap-2.5 px-3 py-2.5 sm:px-3.5">
				<p className="min-w-0 flex-1 basis-56 text-[13px] text-gray-300 sm:text-sm">
					{what} not raced yet{withTeam.length > 0 ? `, ${withTeam.length} with a team on` : ""}.
				</p>
				<span className="flex flex-wrap gap-1.5 sm:gap-2">
					{choices.map((choice) => (
						<button key={choice.key} type="button" className={SOFT_BUTTON} onClick={() => onTeam(slots, choice)}>
							<Users className="h-4 w-4 shrink-0" aria-hidden="true" />
							{`Use ${choice.label} for all of them`}
						</button>
					))}
					{withTeam.length > 0 && (
						<button type="button" className={SOFT_BUTTON} onClick={() => onClear(withTeam)}>
							Clear them
						</button>
					)}
				</span>
			</div>
		</section>
	)
}

/**
 * One day's tickets in one go (Daptrius, 2026-11-05: "replace all tickets on a
 * specific day"): a team on each ticket of the day not raced yet, or Clear.
 * Shown while two or more of the day's tickets are unraced.
 */
function DayBulk({ day, runs, choices, shape, onTeam, onClear }: {
	day: number
	runs: PvpRun[]
	choices: LineupChoice[]
	shape: RunShape
	onTeam: (slots: PvpRunSlot[], choice: LineupChoice) => void
	onClear: (slots: PvpRunSlot[]) => void
}) {
	const slots = unracedSlots(runs, null, shape, day)
	if (slots.length < 2 || choices.length === 0) return null
	const withTeam = slots.filter((slot) => (findRun(runs, slot)?.runners.length ?? 0) > 0)
	const chip = soft({ size: "min-h-9 px-2.5 text-[13px]" })
	return (
		<div className="mx-2 mt-2 flex flex-wrap items-center gap-1.5 sm:mx-2.5 sm:mt-2.5 sm:gap-2" aria-label={`All of ${dayLabel(day, shape)}`} role="group">
			<span className="text-xs text-gray-400">All {slots.length} not raced:</span>
			{choices.map((choice) => (
				<button key={choice.key} type="button" className={chip} onClick={() => onTeam(slots, choice)}>
					{choice.label}
				</button>
			))}
			{withTeam.length > 0 && (
				<button type="button" className={chip} onClick={() => onClear(withTeam)}>
					Clear
				</button>
			)}
		</div>
	)
}

/** The first choice as the one-tap button's words. */
function startLabel(choice: LineupChoice): string {
	return choice.previous ? choice.label : `Use ${choice.label}`
}

/**
 * A ticket's content with a choice's lineup, following its team (null for the
 * Top 96's "Same three as"). A race won by a spot the new lineup leaves empty
 * goes back to "not run".
 */
function withLineup(current: PvpRunContent, choice: Pick<LineupChoice, "runners" | "team">): PvpRunContent {
	const spots = new Set(choice.runners.map((runner) => runner.position))
	return {
		...current,
		runners: choice.runners,
		team: choice.team,
		races: current.races.filter((race) => race.winner === null || spots.has(race.winner)),
	}
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
							<DayTabButton key={day} day={day} today={today === day} runs={runs} shape={shape} active={tab === day} onPick={() => onChange(day)} />
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
function LeagueTabs({ tab, runs, final, shape, onChange }: Omit<DayTabsProps, "today">) {
	return (
		<div role="tablist" aria-label="Tickets" className="grid w-full grid-cols-4 gap-1.5 sm:flex sm:w-auto sm:flex-wrap sm:gap-2">
			{Array.from({ length: shape.days }, (_, index) => index + 1).map((day) => (
				<DayTabButton key={day} day={day} today={false} runs={runs} shape={shape} active={tab === day} onPick={() => onChange(day)} row="" />
			))}
			<TabFrame active={tab === "final"} onPick={() => onChange("final")} row="">
				<span className={`flex items-center gap-2 text-xs font-bold sm:text-[15px] ${tab === "final" ? "text-brand" : "text-gray-100"} max-sm:flex-col max-sm:gap-1.5`}>
					<Medal className="h-4 w-4" aria-hidden="true" />
					Placement
				</span>
				<span className="hidden text-xs text-gray-300 sm:block">{final?.placement ? ordinal(final.placement) : "Your placement"}</span>
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

function DayTabButton({ day, today, runs, shape, active, onPick, row }: {
	day: number
	today: boolean
	runs: PvpRun[]
	shape: RunShape
	active: boolean
	onPick: () => void
	row?: string
}) {
	const tally = summarizeRuns(runsOf(runs, { day })).total
	const points = tallyPoints(runsOf(runs, { day }))
	return (
		<TabFrame active={active} onPick={onPick} row={row}>
			<span className="flex w-full items-center justify-center gap-1 sm:justify-between sm:gap-2.5">
				{today && <span className="size-1.5 rounded-full bg-brand sm:hidden" aria-hidden="true" />}
				<span className={`text-[13px] font-bold sm:text-[15px] ${active ? "text-brand" : "text-gray-100"}`}>
					{/* Four LoH tabs share a phone's width: the range alone fits. */}
					{shape.rounds ? `Day ${day}` : (
						<>
							<span className="sr-only sm:not-sr-only">Tickets </span>
							{ticketRange(day, shape)}
						</>
					)}
				</span>
				{today && (
					<span className="max-sm:sr-only rounded-full bg-brand px-1.75 py-px text-[11px] font-bold text-black">Today</span>
				)}
			</span>
			{/* One segment per ticket: grey unlogged, ringed started, half gold raced some, gold done or stopped, outlined skipped. */}
			<span className="flex gap-0.5 sm:gap-0.75" aria-hidden="true">
				{Array.from({ length: shape.tickets }, (_, index) => {
					const run = findRun(runs, { stage: "day", day, ticket: index + 1 })
					return <span key={index} className={`block h-1 w-2.5 rounded-xs sm:h-1.25 sm:w-4.5 sm:rounded-sm ${segmentClass(run)}`} />
				})}
			</span>
			<span className="text-[11px] text-gray-300 sm:text-xs">
				{shape.points ? (
					// A LoH: the tickets' points (utils/pvpRuns.ts, "A LoH race is scored").
					<>
						<span className="sm:hidden">{points.scored ? formatPoints(points.points) : "–"}</span>
						<span className="max-sm:hidden">{points.scored ? `${formatPoints(points.points)} points` : tally.raced ? "No places yet" : "Not started"}</span>
					</>
				) : (
					<>
						<span className="sm:hidden">{tally.raced ? `${tally.wins}/${tally.raced}` : "–"}</span>
						<span className="max-sm:hidden">{tally.raced ? `${tally.wins} of ${tally.raced} won` : "Not started"}</span>
					</>
				)}
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
	const points = tallyPoints(runsOf(runs, { day }))
	// During registration Day 1 says when Round 1 starts, as the Finals header gives its date.
	const when = shape.rounds && day === today ? " · Today" : day === 1 && today === CM_NOT_STARTED ? ` · Starts ${formatDate(event.start_date)}` : ""
	return (
		<CardHeader
			eyebrow={`${shape.rounds ? `Round ${roundOfDay(day)}` : "League of Heroes"}${when}`}
			title={dayLabel(day, shape)}
			score={shape.points ? (points.scored ? formatPoints(points.points) : "–") : tally.raced ? `${tally.wins} of ${tally.raced}` : "–"}
			detail={
				shape.points
					? points.scored
						? `points from ${points.scored} ${points.scored === 1 ? "race" : "races"}`
						: tally.raced
							? "Log places to add up points"
							: "Nothing logged yet"
					: tally.raced
						? `races won · ${formatRate(tally)}`
						: "Nothing logged yet"
			}
		/>
	)
}

function DayTickets({ day, today, runs, teams, shape, open, onOpen, shared, onWrite, onTeam, onClear }: {
	day: number
	today: number | null
	runs: PvpRun[]
	teams: PvpTeam[]
	shape: RunShape
	open: number | null
	onOpen: (ticket: number | null) => void
	shared: Shared
	onWrite: (slot: PvpRunSlot, change: RunChange) => void
	onTeam: (slots: PvpRunSlot[], choice: LineupChoice) => void
	onClear: (slots: PvpRunSlot[]) => void
}) {
	// A day that is over, with tickets that have nothing logged: offered as
	// skipped in one tap, never assumed (the player may still type them in).
	const unlogged = isPastDay(day, today) ? unloggedTickets(runs, day, shape.tickets) : []
	return (
		<>
			{unlogged.length > 0 && (
				<div className="mx-2 mt-2 flex flex-col gap-2 rounded-[10px] border border-brand/30 bg-brand/5 px-3 py-2.5 sm:mx-2.5 sm:mt-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:px-3.5">
					<span className="text-[13px] text-gray-200 sm:flex-[1_1_260px] sm:text-sm">
						{shape.rounds ? `Day ${day}` : "The League of Heroes"} is over. Nothing is logged for{" "}
						{ticketList(unlogged.map((ticket) => ticketNumber(day, ticket, shape)))}.
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
			<DayBulk day={day} runs={runs} choices={lineupChoices(runs, teams, day, 1)} shape={shape} onTeam={onTeam} onClear={onClear} />
			<ol className="flex flex-col gap-1.5 p-2 sm:p-2.5">
				{Array.from({ length: shape.tickets }, (_, index) => {
					const ticket = index + 1
					const slot: PvpRunSlot = { stage: "day", day, ticket }
					return (
						<li key={`runs-${day}-${ticket}`}>
							<TicketRow
								title={`Ticket ${ticketNumber(day, ticket, shape)}`}
								eyebrow={shape.rounds ? `Day ${day} · Round ${roundOfDay(day)}` : "League of Heroes"}
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
			onWrite((current) => withLineup(current, choice))
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
					{/* A button per team, the one the ticket before ran first (Daptrius,
					    2026-11-05: "no need to only show team 1"); they wrap on a phone. */}
					<span className="flex w-full flex-wrap gap-1.5 sm:w-auto sm:gap-2">
						{first && (
							<button type="button" className={`${PRIMARY_BUTTON} flex-auto sm:flex-none`} onClick={() => start(first)}>
								<Repeat className="h-4 w-4 shrink-0" aria-hidden="true" />
								{startLabel(first)}
							</button>
						)}
						{choices.slice(1).map((choice) => (
							<button key={choice.key} type="button" className={soft({ size: "min-h-11 px-3 sm:min-h-10" })} onClick={() => start(choice)}>
								{startLabel(choice)}
							</button>
						))}
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
	// A LoH ticket's points: its races with all three placed (utils/pvpRuns.ts).
	const ticketPoints = shared.points ? tallyPoints([run]) : null
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
				aria-label={`${title}, ${status}${ticketPoints ? (ticketPoints.scored ? `, ${formatPoints(ticketPoints.points)} points` : "") : raced ? `, ${wins} of ${raced} won` : ""}`}
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
					{ticketPoints ? (
						<>
							{ticketPoints.scored ? formatPoints(ticketPoints.points) : "–"}
							{ticketPoints.scored > 0 && <span className="text-[13px] font-medium text-gray-400 sm:text-[15px]"> pts</span>}
						</>
					) : (
						<>
							{raced ? wins : "–"}
							{raced > 0 && <span className="text-[13px] font-medium text-gray-400 sm:text-[15px]">/{raced}</span>}
						</>
					)}
				</span>
				<ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
			</button>
			{!open && run.note && <p className="-mt-1 truncate px-2.5 pb-2 text-xs text-gray-400 sm:px-3.5">{run.note}</p>}
			{open && (
				<div className="flex flex-col gap-3.5 px-2.5 pb-3.5 pt-1 sm:gap-4.5 sm:px-3.5 sm:pb-4.5 sm:pt-1.5">
					<LineupBlock title={title} eyebrow={eyebrow} run={run} choices={choices} shared={shared} onWrite={onWrite} />
					<RaceGrid title={title} run={run} shared={shared} onWrite={onWrite} />
					<div className="flex flex-col gap-2 empty:hidden sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2.5">
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
				src={uma?.portrait ?? uma?.image ?? null} layers={uma?.portrait_layers}
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
						src={uma?.portrait ?? uma?.image ?? null} layers={uma?.portrait_layers}
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
	// "follows Team 1" while nothing is raced: a My team edit still changes it.
	const followed = run.team !== null && isUnraced(run) ? choices.find((choice) => choice.team === run.team)?.label : undefined
	return (
		<div className="flex flex-col gap-2.5">
			<div className="flex items-center justify-between gap-2 sm:gap-3">
				<span className={EYEBROW}>
					Who ran it
					{followed && <span className="ml-1.5 normal-case tracking-normal text-gray-400">· follows {followed}</span>}
				</span>
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
							onWrite((current) => withLineup(current, choice))
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
								src={uma?.portrait ?? uma?.image ?? null} layers={uma?.portrait_layers}
								oshi={shared.oshiIds.has(runner.uma)}
								hover={hoverCardProps("uma", runner.uma)}
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
 * A yes/no kept per device in localStorage ("on" / "off"), as an external
 * store whose server snapshot is its fallback, like courseMapStore's
 * switches: /app is prerendered, so a render never reads localStorage
 * itself. Storage blocked: it lasts this page's life.
 */
function deviceSwitch(key: string, fallback: boolean): () => [boolean, (on: boolean) => void] {
	let value: boolean | null = null
	const listeners = new Set<() => void>()
	const read = () => {
		try {
			const stored = localStorage.getItem(key)
			return stored === null ? fallback : stored === "on"
		} catch {
			return fallback
		}
	}
	const subscribe = (listener: () => void) => {
		listeners.add(listener)
		return () => listeners.delete(listener)
	}
	const set = (next: boolean) => {
		value = next
		try {
			localStorage.setItem(key, next ? "on" : "off")
		} catch {
			// Storage blocked: this page's life only.
		}
		listeners.forEach((listener) => listener())
	}
	return function useDeviceSwitch() {
		return [useSyncExternalStore(subscribe, () => (value ??= read()), () => fallback), set]
	}
}

/**
 * "Log places", per device (notes/cm-runs-plan-2.md: a PC filling places and
 * a phone tapping want different answers). Off to start.
 */
const useLogPlaces = deviceSwitch("uma-runs-log-places", false)

/**
 * The "Fill from replays" panel open or folded, per device (owner, 2026-11-25:
 * it took a lot of room). Open to start, so a player finds it once.
 */
const useReplaysOpen = deviceSwitch("uma-runs-replays-open", true)

/**
 * The strip's buttons, 1st to the race's runners (PVP_RACE_RUNNERS in the API:
 * 9 in a CM, 12 in a LoH), with each width's grid as a literal class so
 * Tailwind sees it.
 */
const PLACE_GRID: Record<number, string> = { 9: "grid-cols-9", 12: "grid-cols-12" }
const placeChoices = (places: number) => Array.from({ length: places }, (_, index) => index + 1)

/**
 * The "Log places" switch over a ticket's races (mock 01), a CM's or a League
 * of Heroes' (notes/loh-places-plan.md). One switch for both, per device.
 */
function PlacesSwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={on}
			aria-label="Log places"
			onClick={() => onChange(!on)}
			className="flex shrink-0 items-center gap-2.5 rounded-lg py-0.5 text-left"
		>
			{/* The track and knob. A white knob on brand: the grey scale flips on the light themes, so grey-50 went dark there. */}
			<span className={`relative h-5.5 w-10 shrink-0 rounded-full border transition ${on ? "border-brand bg-brand" : "border-gray-600 bg-gray-700"}`} aria-hidden="true">
				<span className={`absolute top-0.5 size-4 rounded-full transition-all ${on ? "left-5 bg-white" : "left-0.5 bg-gray-300"}`} />
			</span>
			<span className="flex flex-col" aria-hidden="true">
				<span className="text-xs font-bold text-gray-50 sm:text-[13px]">Log places</span>
				<span className="text-[11px] text-gray-400">On this device</span>
			</span>
		</button>
	)
}

/**
 * The open ticket's races: a column per runner and one for Loss, a row per
 * race, and a Total row counting each column. One tap logs a race, a tap on
 * the chosen button clears it back to "not run". A cell shows where its uma
 * finished whenever that's known, switch or not (decision 1).
 *
 * With "Log places" on one race at a time is open, with a place strip per uma
 * under it (1 to 9 in a CM, 1 to 12 in a LoH), and the places ARE the input (notes/cm-runs-plan-2.md,
 * decision 7): a 1st is a win, all three placed with no 1st a loss. The open
 * race is the next one to place (nextRaceToPlace) unless the player tapped a
 * race's name or result; placing the last of the three hands it back, so the
 * next race opens by itself and a race is 3 taps. A result button still works
 * with the switch on: a winner is her 1st, and the strips stay for the rest.
 *
 * Every loss gets a Won by, switch or not (decision 6). Its chips open by
 * themselves only on the loss just logged, never on older ones.
 *
 * Note that setPlace makes a race a loss on its FIRST non-1st place (a race
 * row always has a winner field), so "a loss was just logged" is worked out
 * from the race as the tap leaves it: all placed with no 1st, or a Loss tap.
 */
function RaceGrid({ title, run, shared, onWrite }: {
	title: string
	run: PvpRun
	shared: Shared
	onWrite: (change: RunChange) => void
}) {
	// The race the strips sit under: undefined follows nextRaceToPlace, null is none.
	const [chosenRace, setChosenRace] = useState<number | null | undefined>(undefined)
	// The loss whose Won by chips are open, or null.
	const [wonByOpen, setWonByOpen] = useState<number | null>(null)
	// A spot per runner, then null for Loss.
	const columns: Array<number | null> = [...run.runners.map((runner) => runner.position), null]
	const placing = shared.logPlaces
	const openRace = placing ? (chosenRace === undefined ? nextRaceToPlace(run) : chosenRace) : null
	// The race `race` as a change would leave it, read from the run on screen
	// (the cache is written before the save, so that is the latest).
	const after = (change: (content: PvpRunContent) => PvpRunContent, race: number) =>
		change(contentOf(run)).races.find((entry) => entry.race === race)

	const onResult = (race: number, column: number | null, on: boolean) => {
		if (on) {
			// The second tap clears the race: nothing left to place or name.
			setChosenRace(undefined)
			if (wonByOpen === race) setWonByOpen(null)
			onWrite((current) => logRace(current, race, undefined))
			return
		}
		if (column === null) setWonByOpen(race)
		else if (wonByOpen === race) setWonByOpen(null)
		// With places on, a winner tapped is her 1st (setPlace logs the win).
		const change = (current: PvpRunContent) =>
			placing && column !== null ? setPlace(current, race, column, 1) : logRace(current, race, column)
		// The strips stay on this race until all three are placed.
		if (placing) setChosenRace(fullyPlaced(after(change, race), run.runners) ? undefined : race)
		onWrite(change)
	}

	const onPlace = (race: number, position: number, place: number | null) => {
		const before = run.races.find((entry) => entry.race === race)
		const change = (current: PvpRunContent) => setPlace(current, race, position, place)
		const next = after(change, race)
		// The tap that places the last of the three moves on; a fix to a race
		// already placed stays put, so a second fix needs no reopening.
		if (!fullyPlaced(before, run.runners) && fullyPlaced(next, run.runners)) {
			setChosenRace(undefined)
			// Three places and no 1st: a loss, so ask who won it.
			if (next?.winner === null) setWonByOpen(race)
		}
		if (next?.winner !== null && wonByOpen === race) setWonByOpen(null)
		onWrite(change)
	}

	// The label column is a CSS variable so one class switches it at sm.
	const grid = "grid gap-1.25 [--label:50px] [--points:38px] sm:gap-1.5 sm:[--label:76px] sm:[--points:56px]"
	// A LoH adds a Points column at the end: each race's, the ticket's in Total.
	const template: CSSProperties = {
		gridTemplateColumns: `var(--label) repeat(${columns.length}, minmax(0, 1fr))${shared.points ? " var(--points)" : ""}`,
	}
	const pointsCell = (value: number | null, strong = false) => (
		<span className={`text-right font-display font-bold tabular-nums ${strong ? "text-base sm:text-lg" : "text-sm sm:text-base"} ${value === null ? "text-gray-500" : "text-gray-50"}`}>
			{value === null ? "–" : formatPoints(value)}
		</span>
	)
	return (
		<div className="flex flex-col gap-1.5" role="group" aria-label="Who won each race">
			<div className="mb-1 flex items-start justify-between gap-3">
				<p className="text-xs text-gray-300 sm:text-[13px]">
					{placing
						? shared.points
							? "Tap where each of your umas finished. Their points add up once all three are placed."
							: "Tap where each of your umas finished. A 1st is a win, and three places with no 1st is a loss."
						: shared.points
							? "Tap the uma that finished first, or Loss. Turn on Log places to count points."
							: "Tap the uma that finished first, or Loss. Tap it again to clear."}
				</p>
				<PlacesSwitch on={shared.logPlaces} onChange={shared.onLogPlaces} />
			</div>
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
								src={uma?.portrait ?? uma?.image ?? null} layers={uma?.portrait_layers}
								oshi={shared.oshiIds.has(runner.uma)}
								hover={hoverCardProps("uma", runner.uma)}
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
				{shared.points && <span className={`${EYEBROW} pb-1.5 text-right`}>Points</span>}
			</div>
			{RACES.map((race) => {
				const entry = run.races.find((candidate) => candidate.race === race)
				// A race a stopped ticket doesn't list was skipped: the player said it never ran.
				const skipped = entry === undefined && run.skipped
				const open = openRace === race
				const loss = entry !== undefined && entry.winner === null
				// Mid-placing (some of the three placed), a race is a loss only
				// until a 1st turns up, so its Won by waits unless asked for.
				const midPlacing = open && (entry?.places?.length ?? 0) > 0 && !fullyPlaced(entry, run.runners)
				const showWonBy = loss && (wonByOpen === race || Boolean(entry?.lost_to) || !midPlacing)
				const label = `${title}, race ${race}`
				const status = open ? "Open" : skipped ? "Skipped" : null
				return (
					<Fragment key={race}>
						<div className={`${grid} items-center`} style={template}>
							{placing ? (
								// With places on, a race's name opens its strips (to fix an
								// older race, or place one logged with a winner only).
								<button
									type="button"
									aria-expanded={open}
									aria-label={`${label}: places`}
									onClick={() => setChosenRace(open ? null : race)}
									className="flex min-h-11 flex-col items-start justify-center rounded-md text-left hover:text-brand"
								>
									<RaceName race={race} logged={entry !== undefined} status={status} />
								</button>
							) : (
								<span className="flex flex-col">
									<RaceName race={race} logged={entry !== undefined} status={status} />
								</span>
							)}
							{columns.map((column) => {
								const runner = run.runners.find((candidate) => candidate.position === column)
								return (
									<RaceButton
										key={column ?? "loss"}
										label={`${label}: ${column === null ? "Loss" : `${umaName(shared.umasById, runner)} won`}`}
										loss={column === null}
										decided={entry !== undefined}
										skipped={skipped}
										on={entry !== undefined && entry.winner === column}
										place={column === null ? null : placeOf(entry, column)}
										onClick={(on) => onResult(race, column, on)}
									/>
								)
							})}
							{shared.points && pointsCell(racePoints(entry, run.runners))}
						</div>
						{open && (
							<PlaceStrips
								label={label}
								entry={entry}
								runners={run.runners}
								shared={shared}
								onPlace={(position, place) => onPlace(race, position, place)}
							/>
						)}
						{showWonBy && entry && (
							<WonBy
								label={label}
								entry={entry}
								open={wonByOpen === race}
								onOpen={(isOpen) => setWonByOpen(isOpen ? race : null)}
								shared={shared}
								onPick={(uma) => onWrite((current) => setLostTo(current, race, uma))}
							/>
						)}
					</Fragment>
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
				{shared.points && pointsCell(tallyPoints([run]).scored ? tallyPoints([run]).points : null, true)}
			</div>
		</div>
	)
}

/** "Race 3" over its state ("Open", "Skipped"). */
function RaceName({ race, logged, status }: { race: number; logged: boolean; status: string | null }) {
	return (
		<>
			<span className={`text-xs font-semibold sm:text-[13px] ${logged ? "text-gray-100" : "text-gray-400"}`}>Race {race}</span>
			{status && <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-gray-400 sm:text-[11px]">{status}</span>}
		</>
	)
}

/**
 * A place strip per uma for one race (mocks 01 and 02): 1 to 9 in a CM, 1 to
 * 12 in a LoH. One tap places her,
 * a tap on her place clears it. A place another of yours holds is greyed and
 * can't be tapped: two of yours never share one, and the API refuses it.
 *
 * At 390 px the portrait sits beside the strip (the canvas's layout): the
 * buttons share what's left through `grid-cols-9` / `grid-cols-12`, equal
 * fractions with a zero minimum, so the strip shrinks with the card and can't
 * push the page sideways. They're taller than wide there, which a thumb can
 * still hit; a LoH's twelve are about 20px wide at 390, so their gap shrinks.
 */
function PlaceStrips({ label, entry, runners, shared, onPlace }: {
	label: string
	entry: PvpRunRace | undefined
	runners: PvpRunRunner[]
	shared: Shared
	onPlace: (position: number, place: number | null) => void
}) {
	return (
		<div role="group" aria-label={`${label}: where your umas finished`} className="flex flex-col gap-1.5 py-0.5">
			{runners.map((runner) => {
				const uma = shared.umasById.get(runner.uma)
				const mine = placeOf(entry, runner.position)
				const name = umaName(shared.umasById, runner)
				return (
					<div key={runner.position} className="grid grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-1.5 sm:grid-cols-[2rem_minmax(0,1fr)] sm:gap-2">
						<FramedUma
							src={uma?.portrait ?? uma?.image ?? null} layers={uma?.portrait_layers}
							oshi={shared.oshiIds.has(runner.uma)}
							hover={hoverCardProps("uma", runner.uma)}
							alt=""
							className="w-7 sm:w-8"
						/>
						<div className={`grid ${PLACE_GRID[shared.places] ?? "grid-cols-9"} ${shared.places > 9 ? "gap-0.5" : "gap-1"} sm:gap-1.5`}>
							{placeChoices(shared.places).map((place) => {
								const on = mine === place
								const taken = !on && (entry?.places ?? []).some((held) => held.place === place && held.position !== runner.position)
								const look = on
									? place === 1
										? "border-brand bg-brand text-black"
										: "border-brand bg-brand/20 text-gray-50"
									: taken
										? "cursor-not-allowed border-dashed border-gray-700 text-gray-600 line-through"
										: "border-edge bg-gray-900/60 text-gray-200 hover:border-brand"
								return (
									<button
										key={place}
										type="button"
										aria-pressed={on}
										disabled={taken}
										aria-label={`${label}: ${name} finished ${ordinal(place)}`}
										onClick={() => onPlace(runner.position, on ? null : place)}
										className={`h-10 min-w-0 rounded-lg border text-[13px] font-bold transition ${look}`}
									>
										{place}
									</button>
								)
							})}
						</div>
					</div>
				)
			})}
		</div>
	)
}

/**
 * Who won a lost race (decision 6: on every loss, and skippable). Open, it
 * offers up to four chips, the umas that beat this player most this event
 * (the most recent first on a tie: beatenBy), and "Other…", the full uma
 * picker. Named, it's one line with Change; unnamed and closed, one quiet
 * button. Only the uma is set by hand: its style comes from replays, since a
 * guessed style would muddy the stats.
 */
function WonBy({ label, entry, open, onOpen, shared, onPick }: {
	/** "Ticket 2, race 4" or "The Finals race". */
	label: string
	entry: PvpRunRace
	open: boolean
	onOpen: (open: boolean) => void
	shared: Shared
	onPick: (uma: number | null) => void
}) {
	const [picking, setPicking] = useState(false)
	const beaten = entry.lost_to ? shared.umasById.get(entry.lost_to) : undefined
	const pick = (uma: number | null) => {
		setPicking(false)
		onOpen(false)
		onPick(uma)
	}
	const chip = "inline-flex min-h-9 min-w-0 max-w-full items-center gap-1.5 rounded-full border text-xs font-semibold transition"
	return (
		<>
			{open ? (
				<div role="group" aria-label={`${label}: who won it`} className="flex flex-wrap items-center gap-1.5 rounded-[10px] border border-highlight/40 bg-highlight/10 px-2.5 py-2 sm:gap-2 sm:px-3">
					<span className="mr-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-highlight sm:text-[11px]">Won by</span>
					{shared.wonByChips.map((id) => {
						const uma = shared.umasById.get(id)
						if (!uma) return null
						const on = entry.lost_to === id
						return (
							<button
								key={id}
								type="button"
								aria-pressed={on}
								title={uma.title}
								onClick={() => pick(id)}
								className={`${chip} py-1 pl-1 pr-3 ${on ? "border-brand text-gray-50" : "border-edge bg-gray-900/60 text-gray-100 hover:border-brand"}`}
							>
								<FramedUma src={uma.portrait ?? uma.image ?? null} layers={uma.portrait_layers} oshi={shared.oshiIds.has(id)} alt="" className="w-6 shrink-0" />
								<span className="truncate">{uma.name}</span>
							</button>
						)
					})}
					<button type="button" onClick={() => setPicking(true)} className={`${chip} border-edge bg-gray-900/60 px-3 text-gray-100 hover:border-brand`}>
						Other…
					</button>
					<button type="button" onClick={() => onOpen(false)} className="ml-auto min-h-9 px-1.5 text-xs text-gray-400 underline underline-offset-2 hover:text-gray-200">
						Skip
					</button>
				</div>
			) : beaten ? (
				<div className="flex min-w-0 items-center gap-2 text-xs text-gray-400 sm:text-[13px]">
					<span className="shrink-0">Won by</span>
					<FramedUma src={beaten.portrait ?? beaten.image ?? null} layers={beaten.portrait_layers} oshi={shared.oshiIds.has(beaten.id)} alt="" className="w-5.5 shrink-0" />
					<span className="truncate font-semibold text-gray-100" title={beaten.title}>{beaten.name}</span>
					<button
						type="button"
						aria-label={`${label}: change who won it`}
						onClick={() => onOpen(true)}
						className="min-h-8 shrink-0 px-1 text-gray-400 underline underline-offset-2 hover:text-gray-200"
					>
						Change
					</button>
				</div>
			) : (
				<button
					type="button"
					aria-label={`${label}: who won it?`}
					onClick={() => onOpen(true)}
					className="min-h-8 self-start px-0.5 text-xs text-gray-400 underline underline-offset-2 hover:text-gray-200 sm:text-[13px]"
				>
					Won by…
				</button>
			)}
			{picking && (
				<PvpCardPicker
					pool="uma"
					items={shared.umas}
					title={`${label}: the uma that won`}
					skillsById={shared.skillsById}
					event={shared.event}
					style={null}
					recommended={NO_PICKS}
					blockReason={() => null}
					selectedId={entry.lost_to ?? null}
					onPick={(id) => pick(id)}
					onRemove={() => pick(null)}
					onClose={() => setPicking(false)}
				/>
			)}
		</>
	)
}

/**
 * One button of the race grid: gold with "Won" when it won, red with "Lost" for
 * a picked loss, a hollow ring while the race is open, and the uma's place
 * ("4th") once it's logged. A race the player skipped (a stopped ticket) is
 * faded and dashed with a dash in it, like its square on the closed row. It
 * still takes a tap: logging it means it ran after all, and logRace takes the
 * stop back.
 */
function RaceButton({ label, loss, decided, skipped, on, place, onClick }: {
	label: string
	loss: boolean
	decided: boolean
	skipped: boolean
	on: boolean
	/** Where this column's uma finished, or null (always null for Loss). */
	place: number | null
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
				<span className="flex flex-col items-center leading-tight">
					<span className="flex items-center gap-1">
						<Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
						Won
					</span>
					{place !== null && <span className="text-[11px] font-semibold">{ordinal(place)}</span>}
				</span>
			)}
			{on && loss && (
				<>
					<X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
					<span>Lost</span>
				</>
			)}
			{!on && place !== null && <span className="text-gray-200">{ordinal(place)}</span>}
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

/**
 * The folder watch's line (mock 06's foot), under the tabs while it runs:
 * what it last saved, the replays that need a look (they open the preview),
 * and Stop, which forgets the folder on this device. When the browser didn't
 * keep the grant, one click asks again.
 */
function WatchBar({ watch, onLook }: { watch: ReplayWatch; onLook: () => void }) {
	const name = watch.folderName ?? "the folder"
	return (
		<div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-edge bg-gray-900/40 px-3 py-2 text-xs text-gray-300 sm:text-[13px]">
			{watch.state === "watching" ? (
				// Its own line on a phone, the buttons under it; beside them from sm.
				<span className="flex min-w-0 basis-full items-center gap-2 sm:flex-1 sm:basis-auto">
					<span className="size-2 shrink-0 rounded-full bg-status-running" aria-hidden="true" />
					<span className="min-w-0">
						Watching <code className="text-gray-100">{name}</code>. {watch.last ? `${watch.last}.` : "Each race is saved as it lands."}
					</span>
				</span>
			) : (
				<span className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
					Your browser needs your OK to read <code className="text-gray-100">{name}</code> again.
				</span>
			)}
			{watch.state === "needs-grant" && (
				<button type="button" className={soft({ size: "min-h-8 px-2.5" })} onClick={watch.regrant}>
					Watch it again
				</button>
			)}
			{watch.state === "watching" && watch.needLook > 0 && (
				<button type="button" className={soft({ size: "min-h-8 px-2.5", look: "border-brand text-gray-50 hover:border-brand/70" })} onClick={onLook}>
					{watch.needLook === 1 ? "1 replay needs a look" : `${watch.needLook} replays need a look`}
				</button>
			)}
			<button type="button" className={soft({ size: "min-h-8 px-2.5" })} onClick={watch.stop}>
				Stop watching
			</button>
		</div>
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
			eyebrow="Final bracket"
			title="Placement"
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
		if (next !== null && !(Number.isInteger(next) && next >= 1 && next <= LOH_MAX_PLACEMENT)) {
			input.value = saved === null ? "" : String(saved)
			toast.error(`A placement is 1 to ${LOH_MAX_PLACEMENT.toLocaleString("en-US")}.`)
			return
		}
		if (next !== saved) onWrite((current) => ({ ...current, placement: next }))
	}
	return (
		<div className="flex flex-col gap-4 px-3.5 pb-5 pt-4 sm:gap-5 sm:px-5 sm:pb-6 sm:pt-5">
			<p className="text-sm text-gray-200 sm:text-[15px]">Everyone in a League of Heroes gets a placement, Top 96 or not. Made the Top 96? Add the team you entered too.</p>
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
						question="Which team did you enter? It has to be one you registered."
						eyebrow="Top 96"
						choices={choices}
						shared={shared}
						onPick={(choice) => onWrite((current) => withLineup(current, choice))}
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
					max={LOH_MAX_PLACEMENT}
					defaultValue={saved ?? ""}
					onBlur={(blur) => save(blur.target)}
					onKeyDown={(key) => {
						if (key.key === "Enter") key.currentTarget.blur()
					}}
					className="min-h-11 rounded-lg border border-gray-600 bg-gray-900 px-3 text-sm font-normal text-gray-100 focus:border-brand focus:outline-none sm:min-h-10"
				/>
			</label>
			<NoteField note={run?.note ?? ""} label="Note for your placement" onWrite={onWrite} />
		</div>
	)
}

/**
 * A row with no lineup yet (the Finals, the Top 96): the first choice in one
 * tap, or the whole list as cards. With `everyTeam`, a button per team, the
 * one run last first, as a ticket shows them (Daptrius, board "CM Runs, Finals
 * Team select", 2026-11-17: the Finals offered only the last team). The Top 96
 * keeps one button: its choices are long "Same three as..." lines.
 */
function LineupStart({ question, eyebrow, choices, shared, onPick, everyTeam = false }: {
	question: string
	eyebrow: string
	choices: LineupChoice[]
	shared: Shared
	onPick: (choice: LineupChoice) => void
	everyTeam?: boolean
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
					{everyTeam && choices.slice(1).map((choice) => (
						<button key={choice.key} type="button" className={soft({ size: "min-h-11 px-3 sm:min-h-10" })} onClick={() => start(choice)}>
							{startLabel(choice)}
						</button>
					))}
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
	// The Won by chips, open on the loss just logged (RaceGrid's rule).
	const [wonByOpen, setWonByOpen] = useState(false)
	if (!run || run.runners.length === 0) {
		return (
			<div className="px-3.5 pb-5.5 pt-5 sm:px-5 sm:pb-8 sm:pt-7">
				<LineupStart
					question="Who ran the Finals?"
					eyebrow="Finals"
					everyTeam
					choices={choices}
					shared={shared}
					onPick={(choice) => onWrite((current) => withLineup(current, choice))}
				/>
			</div>
		)
	}

	const race = run.races.find((entry) => entry.race === 1)
	const columns: Array<number | null> = [...run.runners.map((runner) => runner.position), null]
	// One race, so no open race to pick: the strips show with the switch on,
	// or once a place is logged (decision 1).
	const placing = shared.logPlaces || (race?.places?.length ?? 0) > 0
	// A win is 1st place for the player, so a winner fills a blank placement.
	// Two different places: `placement` is the player's 1st to 3rd of the
	// three trainers, the strips each uma's 1st to 9th of the nine runners.
	const withPlacement = (next: PvpRunContent): PvpRunContent => {
		const winner = next.races.find((entry) => entry.race === 1)?.winner
		return { ...next, placement: typeof winner === "number" && next.placement === null ? 1 : next.placement }
	}
	const onResult = (column: number | null, on: boolean) => {
		setWonByOpen(!on && column === null)
		onWrite((current) => {
			if (on) return { ...current, races: setRace(current.races, 1, undefined) }
			// With places on, a winner tapped is her 1st, as on a ticket.
			if (placing && column !== null) return withPlacement(setPlace(current, 1, column, 1))
			return withPlacement({ ...current, races: setRace(current.races, 1, column) })
		})
	}
	const onPlace = (position: number, place: number | null) => {
		const change = (current: PvpRunContent) => withPlacement(setPlace(current, 1, position, place))
		const next = change(contentOf(run)).races.find((entry) => entry.race === 1)
		// The last of the three placed with no 1st: a loss, so ask who won it.
		if (!fullyPlaced(race, run.runners) && fullyPlaced(next, run.runners) && next?.winner === null) setWonByOpen(true)
		if (next?.winner !== null) setWonByOpen(false)
		onWrite(change)
	}
	const lostRace = race !== undefined && race.winner === null
	const midPlacing = (race?.places?.length ?? 0) > 0 && !fullyPlaced(race, run.runners)
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
					label="Your placement"
					options={[1, 2, 3].map((place) => ({ key: String(place), label: ordinal(place), on: run.placement === place }))}
					onPick={(place) =>
						onWrite((current) => ({ ...current, placement: current.placement === Number(place) ? null : Number(place) }))
					}
				/>
			</div>
			<div className="flex flex-col gap-1.5 sm:gap-2" role="group" aria-label="Who won the Finals race">
				<span className="flex items-end justify-between gap-3">
					<span className={EYEBROW}>Who won the race</span>
					<PlacesSwitch on={shared.logPlaces} onChange={shared.onLogPlaces} />
				</span>
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
								onClick={() => onResult(column, on)}
								className={`flex min-h-13 min-w-0 items-center gap-2 rounded-[10px] border px-2.5 py-1.5 text-left text-xs font-bold transition sm:min-h-14 sm:text-[13px] ${look}`}
							>
								{runner ? (
									<FramedUma
										src={uma?.portrait ?? uma?.image ?? null} layers={uma?.portrait_layers}
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
				{lostRace && race && (wonByOpen || Boolean(race.lost_to) || !midPlacing) && (
					<WonBy
						label="The Finals race"
						entry={race}
						open={wonByOpen}
						onOpen={setWonByOpen}
						shared={shared}
						onPick={(uma) => onWrite((current) => setLostTo(current, 1, uma))}
					/>
				)}
				<p className="mt-1 text-xs text-gray-400 sm:mt-1.5 sm:text-[13px]">
					One of yours winning means you placed 1st, so that fills in by itself.
				</p>
			</div>
			{placing && (
				<div className="flex flex-col gap-1.5 sm:gap-2">
					<span className={EYEBROW}>Where your umas finished, of nine</span>
					<PlaceStrips label="The Finals race" entry={race} runners={run.runners} shared={shared} onPlace={onPlace} />
				</div>
			)}
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

/** A LoH's best ticket by points, or an en dash before any race has all three placed. */
function bestPointsText(runs: PvpRun[]): string {
	const scored = runsOf(runs, {}).map((run) => tallyPoints([run])).filter((tally) => tally.scored > 0)
	return scored.length ? formatPoints(Math.max(...scored.map((tally) => tally.points))) : "–"
}

/** "220 per ticket" over the tickets with points, or null before any. */
function perTicketText(points: PointsTally): string | null {
	return points.tickets ? `${formatPoints(Math.round(points.points / points.tickets))} per ticket` : null
}

/**
 * The phone's three numbers, over the tabs: the win rate, today's races (the
 * Finals once Round 2 has ended) and the current round's best ticket. The per-uma
 * bars stay in the Summary, which a phone shows under the day.
 */
function WinRateStrip({ event, runs, today, shape }: { event: RaceEvent; runs: PvpRun[]; today: number | null; shape: RunShape }) {
	const { total } = summarizeRuns(runsOf(runs, {}))
	const points = tallyPoints(runsOf(runs, {}))
	// Before Round 1 no day is today, so the middle cell shows Day 1, the day the view opens on.
	const shown = today === null ? null : Math.max(1, today)
	// A LoH has no today to show (utils/pvpRuns.ts), so that cell is its Top 96.
	const day = shown === null || !shape.rounds ? null : summarizeRuns(runsOf(runs, { day: shown })).total
	const final = findRun(runs, { stage: "final" })
	const round = shown === null ? 2 : roundOfDay(shown)
	const cell = "border-l border-edge pl-2.5"
	return (
		<section aria-label={shape.points ? "Points so far" : "Win rate so far"} className="card-panel flex flex-col gap-2.5 px-3.5 pb-3.5 pt-3 sm:hidden">
			<h2 className="flex items-center gap-1.5 font-display text-[15px] font-bold text-gray-50">
				<Trophy className="h-4 w-4 text-brand" aria-hidden="true" />
				{splitEventName(event).title} so far
			</h2>
			<dl className="grid grid-cols-[1.2fr_1fr_1fr] gap-2">
				{shape.points ? (
					<div>
						<dt className="text-[11px] text-gray-400">Points</dt>
						<dd className="mt-0.5 font-display text-[30px] font-bold leading-none text-gray-50">{points.scored ? formatPoints(points.points) : "–"}</dd>
						<dd className="mt-1 text-[11px] text-gray-400">{perTicketText(points) ?? "Log places to count"}</dd>
					</div>
				) : (
					<div>
						<dt className="text-[11px] text-gray-400">Win rate</dt>
						<dd className="mt-0.5 font-display text-[30px] font-bold leading-none text-gray-50">{formatRate(total)}</dd>
						<dd className="mt-1 text-[11px] text-gray-400">{`${total.wins} of ${total.raced} races`}</dd>
					</div>
				)}
				{day ? (
					<div className={cell}>
						<dt className="text-[11px] text-gray-400">{today === CM_NOT_STARTED ? "Day 1" : "Today"}</dt>
						<dd className="mt-0.5 font-display text-[22px] font-bold leading-tight text-gray-50">{day.raced ? `${day.wins}/${day.raced}` : "–"}</dd>
						<dd className="mt-0.5 text-[11px] text-gray-400">races won</dd>
					</div>
				) : (
					<div className={cell}>
						<dt className="text-[11px] text-gray-400">{shape.rounds ? "Finals" : "Placement"}</dt>
						<dd className="mt-0.5 font-display text-[22px] font-bold leading-tight text-gray-50">{final?.placement ? ordinal(final.placement) : "–"}</dd>
						<dd className="mt-0.5 text-[11px] text-gray-400">{final?.finals_group ? `Group ${final.finals_group}` : shape.rounds ? "One race" : "your placement"}</dd>
					</div>
				)}
				<div className={cell}>
					<dt className="text-[11px] text-gray-400">{shape.rounds ? `Round ${round} best` : "Best"}</dt>
					<dd className="mt-0.5 font-display text-[22px] font-bold leading-tight text-gray-50">{shape.points ? bestPointsText(runs) : bestText(runs, shape.rounds ? round : undefined)}</dd>
					<dd className="mt-0.5 text-[11px] text-gray-400">{shape.points ? "points, one ticket" : "one ticket"}</dd>
				</div>
			</dl>
			{!shape.points && <RateBar tally={total} className="h-1.5" label={`Win rate ${formatRate(total)}`} />}
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
	// A LoH's headline is points, not a win rate (notes/loh-places-plan.md).
	const points = tallyPoints(dayRuns)
	// Places and who beat you (notes/cm-runs-plan-2.md): over every logged race, the Finals included.
	// Places over the same day tickets as the win rates beside them ("Days 1
	// to 4. The Finals race counts on its own."): with the Finals in, a line
	// read "2 of 11 won" over "top 3 in 10 of 10". Beaten by is the whole
	// event, the Finals too: it answers "who beat me this CM".
	const places = placeTallies(dayRuns)
	const reasons = lossReasons(dayRuns)
	const beaten = beatenBy(runs)
	// A ticket with a lineup and nothing raced yet makes a "0 of 0" row: left out.
	const umas = tallies.filter((tally) => tally.raced > 0)
	const final = findRun(runs, { stage: "final" })
	// Each tally's style, from the runs it ran in (a tally is an uma and veteran, not a style).
	const styles = new Map<string, MemberStyle>()
	for (const run of dayRuns) {
		for (const runner of run.runners) styles.set(`${runner.uma}:${runner.trained_uma ?? ""}`, runner.style)
	}
	const footnote = shape.rounds ? `Days 1 to ${shape.days}. The Finals race counts on its own.` : `All ${shape.days * shape.tickets} tickets.`
	return (
		<aside aria-label={shape.points ? "Your points" : "Your win rates"} className="card-panel min-w-0">
			<div className="hidden flex-col gap-3.5 border-b border-edge px-5 py-4.5 sm:flex">
				<div className="flex items-center gap-2 text-brand">
					<Trophy className="h-4 w-4" aria-hidden="true" />
					<h2 className="font-display text-lg font-bold text-gray-50">{splitEventName(event).title} so far</h2>
				</div>
				{shape.points ? (
					<div className="flex items-end gap-3">
						<span className="font-display text-[56px] font-bold leading-[0.9] text-gray-50">{points.scored ? formatPoints(points.points) : "–"}</span>
						<span className="flex flex-col gap-0.5 pb-0.5">
							<span className="text-sm font-semibold text-gray-200">points</span>
							<span className="text-[13px] text-gray-400">{perTicketText(points) ?? "Log places to count them"}</span>
							<span className="text-[13px] text-gray-400">{ticketsText(ticketCounts(runs))}</span>
						</span>
					</div>
				) : (
					<>
						<div className="flex items-end gap-3">
							<span className="font-display text-[56px] font-bold leading-[0.9] text-gray-50">{formatRate(total)}</span>
							<span className="flex flex-col gap-0.5 pb-0.5">
								<span className="text-sm font-semibold text-gray-200">win rate</span>
								<span className="text-[13px] text-gray-400">{`${total.wins} of ${total.raced} races`}</span>
								<span className="text-[13px] text-gray-400">{ticketsText(ticketCounts(runs))}</span>
							</span>
						</div>
						<RateBar tally={total} className="h-2" label={`Win rate ${formatRate(total)}`} />
					</>
				)}
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
						<Stat label="Best ticket" value={bestPointsText(runs)} detail="points" />
						<Stat label="Placement" value={final?.placement ? ordinal(final.placement) : "–"} detail={final?.placement ? undefined : "Not logged"} />
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
							// A LoH uma's headline is her points over the races she has a place in.
							const placed = places.get(key)
							return (
								<li key={key} className="flex items-center gap-2.5 sm:gap-3">
									<FramedUma
										src={uma?.portrait ?? uma?.image ?? null} layers={uma?.portrait_layers}
										oshi={oshiIds.has(tally.uma)}
										hover={hoverCardProps("uma", tally.uma)}
										alt=""
										className="w-9.5 shrink-0 sm:w-10.5"
									/>
									<div className="flex min-w-0 flex-1 flex-col gap-1.25 sm:gap-1.5">
										<div className="flex items-baseline justify-between gap-2">
											<span className="truncate text-[13px] font-semibold text-gray-100 sm:text-sm" title={uma?.name}>
												{uma?.name ?? "Unknown uma"}
											</span>
											<span className="font-display text-base font-bold text-gray-50 sm:text-[17px]">
												{shape.points ? (placed ? `${formatPoints(placed.points)} pts` : "–") : formatRate(tally)}
											</span>
										</div>
										{!shape.points && <RateBar tally={tally} className="h-1.5" />}
										<div className="flex justify-between gap-2 text-[11px] text-gray-400 sm:text-xs">
											<span className="flex min-w-0 items-center gap-1.5">
												{style && <StyleTag style={style} />}
												<VeteranLink
													veteran={veterans.find((veteran) => veteran.id === tally.trained_uma)}
													linked={tally.trained_uma !== null}
													hasVeterans={veteransOf(veterans, tally.uma).length > 0}
												/>
											</span>
											<span className="shrink-0">
												{shape.points
													? placed
														? `${formatPoints(Math.round(placed.points / placed.placed))} a race`
														: "No places yet"
													: `${tally.wins} of ${tally.raced} won`}
											</span>
										</div>
										{placed && (
											<div className="text-[11px] text-gray-400 sm:text-xs">
												{`Average place ${(placed.total / placed.placed).toFixed(1)} · top 3 in ${placed.top3} of ${placed.placed}`}
											</div>
										)}
										{/* From replays only: the game's reason, per race she lost (mock 04). */}
										{(reasons.get(key)?.length ?? 0) > 0 && (
											<div className="text-[11px] text-gray-400 sm:text-xs">
												Why she lost:{" "}
												<span className="font-semibold text-gray-200">
													{reasons.get(key)?.map(({ code, count }) => `${lossReasonLabel(code)} ${count}`).join(", ")}
												</span>
											</div>
										)}
									</div>
								</li>
							)
						})}
					</ul>
				)}
				<p className="border-t border-edge pt-2.5 text-[11px] text-gray-400 sm:hidden">{footnote}</p>
			</div>

			{beaten.named > 0 && (
				<div className="flex flex-col gap-2.5 border-t border-edge p-3.5 sm:px-5 sm:py-4.5">
					<h3 className={EYEBROW}>Beaten by</h3>
					<ul className="flex flex-col gap-2">
						{beaten.umas.slice(0, 5).map(({ uma: id, losses }) => {
							const uma = umasById.get(id)
							return (
								<li key={id} className="flex items-center gap-2.5">
									<FramedUma src={uma?.portrait ?? uma?.image ?? null} layers={uma?.portrait_layers} oshi={oshiIds.has(id)} hover={hoverCardProps("uma", id)} alt="" className="w-8 shrink-0" />
									<span className="min-w-0 flex-1 truncate text-[13px] text-gray-100" title={uma?.name}>{uma?.name ?? "Unknown uma"}</span>
									<span className="shrink-0 text-xs text-gray-400">{`${losses} of ${beaten.named} named losses`}</span>
								</li>
							)
						})}
					</ul>
				</div>
			)}

			<div className="hidden flex-col gap-3 px-5 py-4.5 sm:flex">
				<h3 className={EYEBROW}>{shape.rounds ? "By day" : "By tickets"}</h3>
				<div className={`grid gap-2 ${shape.rounds ? "grid-cols-4" : "grid-cols-3"}`}>
					{Array.from({ length: shape.days }, (_, index) => {
						const day = index + 1
						const tally = summarizeRuns(runsOf(runs, { day })).total
						const dayPoints = tallyPoints(runsOf(runs, { day }))
						return (
							<div key={day} className={`${INSET} min-w-0 p-2 text-center`}>
								<div className="text-[11px] font-semibold text-gray-400">{shape.rounds ? `Day ${day}` : ticketRange(day, shape)}</div>
								{shape.points ? (
									<>
										<div className={`font-display text-lg font-bold ${dayPoints.scored ? "text-gray-50" : "text-gray-400"}`}>{dayPoints.scored ? formatPoints(dayPoints.points) : "–"}</div>
										<div className="text-[11px] text-gray-400">{dayPoints.scored ? "points" : tally.raced ? "No places yet" : "Not started"}</div>
									</>
								) : (
									<>
										<div className={`font-display text-lg font-bold ${tally.raced ? "text-gray-50" : "text-gray-400"}`}>{formatRate(tally)}</div>
										<div className="text-[11px] text-gray-400">{tally.raced ? `${tally.wins} of ${tally.raced}` : "Not started"}</div>
									</>
								)}
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
