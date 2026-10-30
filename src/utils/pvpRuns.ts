/**
 * The CM Runs view's pure helpers: slots, the day a CM is on, lineups, and
 * win rates. No React, no fetches, so every rule here has a plain test
 * (src/__tests__/pvpRuns.test.ts).
 *
 * THE COUNTING RULES
 * ------------------
 * A race is won when one of the player's three finishes first, so it has ONE
 * winner at most and an uma's wins add up to the team's. A race with no row
 * has not been run and counts nowhere; a race with a null winner is a loss
 * and counts in the denominator. Worked example, one ticket:
 *
 *   races   Oguri, Loss, Oguri, Maruzensky, (not run yet)
 *   ticket  3 wins of 4 run = 75%
 *   Oguri   2 of 4 = 50%, Maruzensky 1 of 4 = 25%, Gold Ship 0 of 4
 *
 * Each uma is measured against every race she ran in, won by anyone or lost.
 * Two different veterans of one uma are two rows (owner, 2026-10-26): a tally
 * is per uma AND veteran, and a runner with no veteran linked is her own row.
 *
 * SKIPPED TICKETS (owner, 2026-10-26)
 * -----------------------------------
 * A ticket's `skipped` flag is the player saying the races it does not list
 * never ran: none listed = the ticket went unused, some = they stopped after
 * those. It changes no win rate (an unlisted race was never counted) and only
 * the player sets it: a past day's empty ticket may just not be typed in yet,
 * so the view offers "Mark the rest skipped" and never assumes it. Logging a
 * race the ticket did not list takes the skip back (logRace): it ran after all.
 *
 * The limits mirror the API (models/pvp_run.py): a CM is 4 days of 4 tickets
 * of 5 races, Round 1 days 1-2 and Round 2 days 3-4, then one final race. A
 * League of Heroes is 6 days of 5 tickets of 5 races with no rounds, then the
 * Top 96: the team the player entered, one they registered on days 1-6, and a
 * placement they type in, 1 to 96, with no race (the two brackets are only
 * watched; Daptrius, 2026-10-30). A LoH race is
 * counted like a CM's, won when one of your three finishes first. RunShape is
 * the one place the two differ.
 */

import { parseApiDate } from "./dateFormat"
import { refForRaceEvent } from "./pvpEvent"
import type { CalculationConstants, RaceEvent } from "../types"
import type { PvpRun, PvpRunContent, PvpRunRace, PvpRunRunner, PvpRunSlot } from "../types/pvpRun"
import type { PvpTeamMember } from "../types/pvpTeam"

export const CM_RUN_DAYS = 4
export const CM_RUN_TICKETS = 4
export const RUN_RACES = 5
/** Round 1 is days 1-2, Round 2 days 3-4. */
export const CM_DAYS_PER_ROUND = 2
export const LOH_TOP_PLACEMENTS = 96

/** What an event kind's runs look like. `rounds`: a CM's two rounds and its one final race. */
export interface RunShape {
	days: number
	tickets: number
	rounds: boolean
}
export const CM_SHAPE: RunShape = { days: CM_RUN_DAYS, tickets: CM_RUN_TICKETS, rounds: true }
const LOH_SHAPE: RunShape = { days: 6, tickets: 5, rounds: false }

export function runShape(event: Pick<RaceEvent, "event_type">): RunShape {
	return event.event_type === "champions_meeting" ? CM_SHAPE : LOH_SHAPE
}

const DAY_MS = 86_400_000

export function slotOf(run: PvpRun): PvpRunSlot {
	return run.stage === "final" ? { stage: "final" } : { stage: "day", day: run.day ?? 0, ticket: run.ticket ?? 0 }
}

export function sameSlot(a: PvpRunSlot, b: PvpRunSlot): boolean {
	if (a.stage === "final" || b.stage === "final") return a.stage === b.stage
	return a.day === b.day && a.ticket === b.ticket
}

export function findRun(runs: PvpRun[], slot: PvpRunSlot): PvpRun | undefined {
	return runs.find((run) => sameSlot(slotOf(run), slot))
}

/** "Round 1" for days 1-2, "Round 2" for days 3-4. */
export function roundOfDay(day: number): number {
	return Math.ceil(day / CM_DAYS_PER_ROUND)
}

/**
 * cmDayAt's answer before Round 1 starts: no day is today and none is over.
 * The view still opens on Day 1 (Math.max(1, today)).
 */
export const CM_NOT_STARTED = 0

/**
 * The CM day `now` falls on: 1 from the start date, a new day every 24 hours.
 * Days count from the event's own start time, which is how the game's rounds
 * are spaced (Round 2 is `cm_round_two_hours` = 48 in, and runs two days).
 *
 * The race days have quiet time on both sides, and neither is a day:
 *
 *   before the start     CM_NOT_STARTED. The start date is Round 1, and
 *                        registration opens three days earlier
 *                        (`cm_registration_opens_hours`). Holding at 1 there
 *                        badged Day 1 "Today" the moment CM 21's registration
 *                        post went out (2026-10-28).
 *   after Round 2 ends   null, so every day is over and the view opens on the
 *                        Finals. Round 2 ends 96 hours in, and the Finals are
 *                        a day later (`cm_finals_hours` = 120); finals
 *                        registration fills the gap. Holding at 4 called Day 4
 *                        "Today" all through it (owner, 2026-10-28).
 *
 * Worked through CM 21 (start 2026-10-31 22:00 UTC): Oct 30 is 0, Nov 1 21:59
 * is 1, Nov 4 21:59 is 4, Nov 4 22:00 onward is null.
 */
export function cmDayAt(event: RaceEvent, constants: CalculationConstants, now: Date): number | null {
	const start = parseApiDate(event.start_date)
	if (!start) return 1
	const elapsed = now.getTime() - start.getTime()
	if (elapsed < 0) return CM_NOT_STARTED
	const roundTwoEnds = constants.cm_round_two_hours * 3_600_000 + CM_DAYS_PER_ROUND * DAY_MS
	if (elapsed >= roundTwoEnds) return null
	return Math.min(CM_RUN_DAYS, Math.floor(elapsed / DAY_MS) + 1)
}

/**
 * The event day `now` falls on, for either kind. A LoH has no round times yet
 * (its `loh_*` constants are unset until known), so it counts 24 hours a day
 * from its start date, like a CM, and is over after day 6.
 */
export function runDayAt(event: RaceEvent, constants: CalculationConstants, now: Date, shape: RunShape): number | null {
	if (shape.rounds) return cmDayAt(event, constants, now)
	const start = parseApiDate(event.start_date)
	if (!start) return 1
	const elapsed = now.getTime() - start.getTime()
	if (elapsed < 0) return CM_NOT_STARTED
	const day = Math.floor(elapsed / DAY_MS) + 1
	return day > shape.days ? null : day
}

/** A team's members as a ticket's lineup: the uma, style and veteran per spot, no deck. */
export function lineupFromTeam(members: PvpTeamMember[]): PvpRunRunner[] {
	return [...members]
		.sort((a, b) => a.position - b.position)
		.map(({ position, uma, style, trained_uma }) => ({ position, uma, style, trained_uma: trained_uma ?? null }))
}

/**
 * The tickets that show each different lineup logged on the days, latest
 * first: the teams a player registered, which is what a LoH's Top 96 allows
 * (Daptrius, 2026-10-30).
 */
export function registeredLineups(runs: PvpRun[]): PvpRun[] {
	const found: PvpRun[] = []
	const latestFirst = runs
		.filter((run) => run.stage === "day" && run.runners.length > 0)
		.sort((a, b) => (b.day ?? 0) - (a.day ?? 0) || (b.ticket ?? 0) - (a.ticket ?? 0))
	for (const run of latestFirst) {
		if (!found.some((kept) => sameLineup(kept.runners, run.runners))) found.push(run)
	}
	return found
}

/** Two lineups with the same uma, style and veteran in every spot. */
export function sameLineup(a: PvpRunRunner[], b: PvpRunRunner[]): boolean {
	if (a.length !== b.length) return false
	const sorted = (lineup: PvpRunRunner[]) => [...lineup].sort((x, y) => x.position - y.position)
	const left = sorted(a)
	const right = sorted(b)
	return left.every((runner, index) => {
		const other = right[index]
		return (
			runner.position === other.position &&
			runner.uma === other.uma &&
			runner.style === other.style &&
			(runner.trained_uma ?? null) === (other.trained_uma ?? null)
		)
	})
}

/**
 * The ticket a new one copies its lineup from: the latest earlier ticket with
 * one (players usually run the same three all day), else null, and the view
 * offers the event's teams. Returned whole so the view can name it ("Same
 * three as Day 1, Ticket 4"). The final asks with day 5, ticket 1.
 */
export function previousRun(runs: PvpRun[], day: number, ticket: number): PvpRun | null {
	const earlier = runs
		.filter((run) => run.stage === "day" && run.runners.length > 0)
		.filter((run) => (run.day ?? 0) < day || ((run.day ?? 0) === day && (run.ticket ?? 0) < ticket))
		.sort((a, b) => (a.day ?? 0) - (b.day ?? 0) || (a.ticket ?? 0) - (b.ticket ?? 0))
	return earlier.at(-1) ?? null
}

/** An empty ticket's content: a lineup and nothing else. */
export function emptyContent(runners: PvpRunRunner[] = []): PvpRunContent {
	return { runners, races: [], finals_group: "", placement: null, note: "", skipped: false }
}

/** A run's content, the part a PUT sends. */
export function contentOf(run: PvpRun): PvpRunContent {
	const { runners, races, finals_group, placement, note, skipped } = run
	return { runners, races, finals_group, placement, note, skipped }
}

/**
 * The races with race `race` set to `winner`: a spot, `null` for a loss, or
 * `undefined` to mark it not run (the row goes). Kept in race order.
 */
export function setRace(races: PvpRunRace[], race: number, winner: number | null | undefined): PvpRunRace[] {
	const others = races.filter((entry) => entry.race !== race)
	const next = winner === undefined ? others : [...others, { race, winner }]
	return next.sort((a, b) => a.race - b.race)
}

/**
 * The ticket with race `race` set as setRace does. Logging a race the ticket
 * did not list takes a skip back: the player says it ran after all (they were
 * slow to type it in, owner 2026-10-26). Changing or clearing a listed race
 * keeps the skip, so "stopped after 2" stays stopped after a winner is fixed.
 */
export function logRace(content: PvpRunContent, race: number, winner: number | null | undefined): PvpRunContent {
	const added = winner !== undefined && !content.races.some((entry) => entry.race === race)
	return { ...content, races: setRace(content.races, race, winner), skipped: content.skipped && !added }
}

// ── Skips ────────────────────────────────────────────────────────────────

/**
 * Where a day's ticket stands, from its row (undefined = no row):
 *
 *   unlogged  no row: not played yet, or played and not typed in yet
 *   skipped   the player skipped it whole (no races listed)
 *   stopped   the player stopped after the races listed
 *   started   a lineup, fewer than five races so far
 *   done      all five raced
 */
export type TicketState = "unlogged" | "skipped" | "stopped" | "started" | "done"

export function ticketState(run: Pick<PvpRun, "races" | "skipped"> | undefined): TicketState {
	if (!run) return "unlogged"
	if (run.skipped) return run.races.length ? "stopped" : "skipped"
	return run.races.length >= RUN_RACES ? "done" : "started"
}

/** Day tickets played (a race or more listed, stopped ones too) and skipped whole. */
export function ticketCounts(runs: PvpRun[]): { used: number; skipped: number } {
	const days = runs.filter((run) => run.stage === "day")
	return {
		used: days.filter((run) => run.races.length > 0).length,
		skipped: days.filter((run) => ticketState(run) === "skipped").length,
	}
}

/** The tickets of `day` with no row at all: what "Mark the rest skipped" marks. */
export function unloggedTickets(runs: PvpRun[], day: number, tickets = CM_RUN_TICKETS): number[] {
	return Array.from({ length: tickets }, (_, index) => index + 1).filter(
		(ticket) => !findRun(runs, { stage: "day", day, ticket })
	)
}

/**
 * A day that is over, given cmDayAt's answer for now: every day before it,
 * and all of them once Round 2 has ended (null). Before the event starts
 * cmDayAt is CM_NOT_STARTED (0), so nothing is over yet.
 */
export function isPastDay(day: number, today: number | null): boolean {
	return today === null || day < today
}

// ── One lineup for every ticket ──────────────────────────────────────────

/**
 * The slots "Use Team 1 for all of them" fills (owner's pick, 2026-10-29;
 * notes/v2-10-feedback-plan.md, item 10): every ticket with no lineup on a
 * day that isn't over, then the Finals if it has none. A lineup with no races
 * reads "started" (ticketState), so a past day's unplayed tickets are left
 * for "Mark the rest skipped", and a ticket that is skipped or already has a
 * lineup is never touched. A LoH's Top 96 has no lineup to fill.
 */
export function slotsWithoutLineup(runs: PvpRun[], today: number | null, shape: RunShape = CM_SHAPE): PvpRunSlot[] {
	const empty = (slot: PvpRunSlot) => {
		const run = findRun(runs, slot)
		return !run || (run.runners.length === 0 && run.races.length === 0 && !run.skipped)
	}
	const slots: PvpRunSlot[] = []
	for (let day = 1; day <= shape.days; day++) {
		if (isPastDay(day, today)) continue
		for (let ticket = 1; ticket <= shape.tickets; ticket++) {
			const slot: PvpRunSlot = { stage: "day", day, ticket }
			if (empty(slot)) slots.push(slot)
		}
	}
	const final: PvpRunSlot = { stage: "final" }
	if (shape.rounds && empty(final)) slots.push(final)
	return slots
}

// ── Win rates ────────────────────────────────────────────────────────────

export interface Tally {
	wins: number
	/** Races run, wins and losses together. */
	raced: number
}

export interface UmaTally extends Tally {
	uma: number
	/** The veteran that ran, or null when none was linked. */
	trained_uma: number | null
}

export interface RunsSummary {
	total: Tally
	/** One per uma that ran, most races first, then most wins. */
	umas: UmaTally[]
}

const EMPTY: Tally = { wins: 0, raced: 0 }

/** Wins and races run for one run. */
export function tallyRun(run: Pick<PvpRun, "races">): Tally {
	return { wins: run.races.filter((race) => race.winner !== null).length, raced: run.races.length }
}

/** The team's and each uma's (each veteran's) wins over `runs`. See the header for the rules. */
export function summarizeRuns(runs: Array<Pick<PvpRun, "races" | "runners">>): RunsSummary {
	const total = { ...EMPTY }
	const byUma = new Map<string, UmaTally>()
	for (const run of runs) {
		const { wins, raced } = tallyRun(run)
		total.wins += wins
		total.raced += raced
		for (const runner of run.runners) {
			const veteran = runner.trained_uma ?? null
			const key = `${runner.uma}:${veteran ?? ""}`
			const tally = byUma.get(key) ?? { uma: runner.uma, trained_uma: veteran, wins: 0, raced: 0 }
			tally.raced += raced
			tally.wins += run.races.filter((race) => race.winner === runner.position).length
			byUma.set(key, tally)
		}
	}
	const umas = [...byUma.values()].sort((a, b) => b.raced - a.raced || b.wins - a.wins)
	return { total, umas }
}

/** The day tickets of one round, or of one day. */
export function runsOf(runs: PvpRun[], filter: { round?: number; day?: number }): PvpRun[] {
	return runs.filter(
		(run) =>
			run.stage === "day" &&
			(filter.day === undefined || run.day === filter.day) &&
			(filter.round === undefined || roundOfDay(run.day ?? 0) === filter.round)
	)
}

/**
 * The most wins on one ticket in a round: the game counts a round's best
 * attempt, so this is the number the round's result came from. No round: the
 * whole event (a LoH). null when nothing there was raced.
 */
export function bestTicketWins(runs: PvpRun[], round?: number): number | null {
	const raced = runsOf(runs, { round }).filter((run) => run.races.length > 0)
	return raced.length ? Math.max(...raced.map((run) => tallyRun(run).wins)) : null
}

// ── History (the Collection's CM history tab) ───────────────────────────

/** One event's line in the history. The counting is the CM Runs view's. */
export interface EventHistory {
	event: RaceEvent
	runs: PvpRun[]
	/** Days 1 to 4 (every day, for LoH), as the CM Runs view counts them. */
	total: Tally
	/** Each uma (each veteran) that raced, most races first. */
	umas: UmaTally[]
	final: PvpRun | undefined
}

/**
 * The runs grouped by event, newest event first. `events` is every event in
 * date order (raceEventsInOrder); a run whose event isn't in it (removed in
 * the admin) is left out. An event shows once anything was logged, even a
 * skipped ticket.
 */
export function eventHistory(runs: PvpRun[], events: RaceEvent[]): EventHistory[] {
	const byEvent = new Map<string, PvpRun[]>()
	for (const run of runs) {
		const key = `${run.kind}-${run.event}`
		byEvent.set(key, [...(byEvent.get(key) ?? []), run])
	}
	const history: EventHistory[] = []
	for (const event of [...events].reverse()) {
		const ref = refForRaceEvent(event)
		const own = byEvent.get(`${ref.kind}-${ref.id}`)
		if (!own) continue
		const { total, umas } = summarizeRuns(runsOf(own, {}))
		history.push({ event, runs: own, total, umas: umas.filter((tally) => tally.raced > 0), final: findRun(own, { stage: "final" }) })
	}
	return history
}

export interface VeteranRecord extends Tally {
	trained_uma: number
	uma: number
	/** How many events she raced in. */
	events: number
}

/**
 * Each linked veteran's record across every event ("which of my Oguris wins
 * most"): the same counting as one event's, over every day ticket. Best win
 * rate first, then most races. Runners with no veteran linked are left out:
 * the event rows already count them.
 */
export function veteranRecords(runs: PvpRun[]): VeteranRecord[] {
	const dayRuns = runsOf(runs, {})
	const events = new Map<number, Set<string>>()
	for (const run of dayRuns) {
		if (!run.races.length) continue
		for (const runner of run.runners) {
			if (runner.trained_uma == null) continue
			const seen = events.get(runner.trained_uma) ?? new Set<string>()
			seen.add(`${run.kind}-${run.event}`)
			events.set(runner.trained_uma, seen)
		}
	}
	const rate = (tally: Tally) => (tally.raced ? tally.wins / tally.raced : 0)
	return summarizeRuns(dayRuns)
		.umas.filter((tally): tally is UmaTally & { trained_uma: number } => tally.trained_uma !== null && tally.raced > 0)
		.map((tally) => ({ ...tally, events: events.get(tally.trained_uma)?.size ?? 0 }))
		.sort((a, b) => rate(b) - rate(a) || b.raced - a.raced)
}

/** "75%", or an en dash when nothing was raced. Whole percent, rounded. */
export function formatRate({ wins, raced }: Tally): string {
	return raced ? `${Math.round((wins / raced) * 100)}%` : "–"
}

/** "1st", "2nd", "3rd", "11th", "22nd". */
export function ordinal(place: number): string {
	const lastTwo = place % 100
	if (lastTwo >= 11 && lastTwo <= 13) return `${place}th`
	return `${place}${["th", "st", "nd", "rd"][place % 10] ?? "th"}`
}
