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
 *
 * The limits mirror the API (models/pvp_run.py): a CM is 4 days of 4 tickets
 * of 5 races, Round 1 days 1-2 and Round 2 days 3-4, then one final race.
 */

import { parseApiDate } from "./dateFormat"
import type { CalculationConstants, RaceEvent } from "../types"
import type { PvpRun, PvpRunContent, PvpRunRace, PvpRunRunner, PvpRunSlot } from "../types/pvpRun"
import type { PvpTeamMember } from "../types/pvpTeam"

export const CM_RUN_DAYS = 4
export const CM_RUN_TICKETS = 4
export const RUN_RACES = 5
/** Round 1 is days 1-2, Round 2 days 3-4. */
export const CM_DAYS_PER_ROUND = 2
/** Round 1's best ticket needs this many wins for Group A (GameTora, 2026-10-26). */
export const GROUP_A_WINS = 3

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
 * The CM day `now` falls on: 1 from the start date, a new day every 24 hours,
 * held at 1 before the start and at the last day after it. `null` once the
 * final has started (`cm_finals_hours` after the start), so the view opens on
 * the final. Days count from the event's own start time, which is how the
 * game's rounds are spaced (Round 2 is `cm_round_two_hours` = 48 in).
 */
export function cmDayAt(event: RaceEvent, constants: CalculationConstants, now: Date): number | null {
	const start = parseApiDate(event.start_date)
	if (!start) return 1
	const elapsed = now.getTime() - start.getTime()
	if (elapsed >= constants.cm_finals_hours * 3_600_000) return null
	return Math.min(CM_RUN_DAYS, Math.max(1, Math.floor(elapsed / DAY_MS) + 1))
}

/** A team's members as a ticket's lineup: the uma and style per spot, no deck. */
export function lineupFromTeam(members: PvpTeamMember[]): PvpRunRunner[] {
	return [...members]
		.sort((a, b) => a.position - b.position)
		.map(({ position, uma, style }) => ({ position, uma, style }))
}

/** Two lineups with the same uma and style in every spot. */
export function sameLineup(a: PvpRunRunner[], b: PvpRunRunner[]): boolean {
	if (a.length !== b.length) return false
	const sorted = (lineup: PvpRunRunner[]) => [...lineup].sort((x, y) => x.position - y.position)
	const left = sorted(a)
	const right = sorted(b)
	return left.every((runner, index) => {
		const other = right[index]
		return runner.position === other.position && runner.uma === other.uma && runner.style === other.style
	})
}

/**
 * The lineup a new ticket starts with: the latest earlier ticket's (players
 * usually run the same three all day), else nothing, and the view offers the
 * event's teams.
 */
export function previousLineup(runs: PvpRun[], day: number, ticket: number): PvpRunRunner[] | null {
	const earlier = runs
		.filter((run) => run.stage === "day" && run.runners.length > 0)
		.filter((run) => (run.day ?? 0) < day || ((run.day ?? 0) === day && (run.ticket ?? 0) < ticket))
		.sort((a, b) => (a.day ?? 0) - (b.day ?? 0) || (a.ticket ?? 0) - (b.ticket ?? 0))
	return earlier.at(-1)?.runners ?? null
}

/** An empty ticket's content: a lineup and nothing else. */
export function emptyContent(runners: PvpRunRunner[] = []): PvpRunContent {
	return { runners, races: [], finals_group: "", placement: null, note: "" }
}

/** A run's content, the part a PUT sends. */
export function contentOf(run: PvpRun): PvpRunContent {
	const { runners, races, finals_group, placement, note } = run
	return { runners, races, finals_group, placement, note }
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

// ── Win rates ────────────────────────────────────────────────────────────

export interface Tally {
	wins: number
	/** Races run, wins and losses together. */
	raced: number
}

export interface UmaTally extends Tally {
	uma: number
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

/** The team's and each uma's wins over `runs`. See the header for the rules. */
export function summarizeRuns(runs: Array<Pick<PvpRun, "races" | "runners">>): RunsSummary {
	const total = { ...EMPTY }
	const byUma = new Map<number, UmaTally>()
	for (const run of runs) {
		const { wins, raced } = tallyRun(run)
		total.wins += wins
		total.raced += raced
		for (const runner of run.runners) {
			const tally = byUma.get(runner.uma) ?? { uma: runner.uma, wins: 0, raced: 0 }
			tally.raced += raced
			tally.wins += run.races.filter((race) => race.winner === runner.position).length
			byUma.set(runner.uma, tally)
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
 * attempt, so this is the number the round's result came from. null when
 * nothing in the round was raced.
 */
export function bestTicketWins(runs: PvpRun[], round: number): number | null {
	const raced = runsOf(runs, { round }).filter((run) => run.races.length > 0)
	return raced.length ? Math.max(...raced.map((run) => tallyRun(run).wins)) : null
}

/** "75%", or an en dash when nothing was raced. Whole percent, rounded. */
export function formatRate({ wins, raced }: Tally): string {
	return raced ? `${Math.round((wins / raced) * 100)}%` : "–"
}

/** "1st", "2nd", "3rd". */
export function ordinal(place: number): string {
	return place === 1 ? "1st" : place === 2 ? "2nd" : place === 3 ? "3rd" : `${place}th`
}
