/**
 * Which ticket each umadump race replay belongs to, and what it adds there
 * (notes/cm-runs-plan-2.md, PR 5, "Slotting"). Pure: the CM Runs view's
 * "Fill from replays" previews planReplays and saves mergeReplays through
 * useSaveRun, the path every ticket write takes.
 *
 * A replay says nothing about its ticket (no race or ticket number; checked
 * on the owner's CM 22 files), so:
 *
 *   1. THE DAY comes from the file's modified time on the event's own clock
 *      (cmDayAt). A race after Round 2, in the 24 hours from cm_finals_hours,
 *      is the Finals; anything else outside the event is left out.
 *   2. WITHIN A DAY, oldest first, a new ticket starts every 5 races, or when
 *      the three umas change (by veteran, else by outfit).
 *   3. THE GROUPS TAKE THE DAY'S TICKETS IN ORDER, passing over a ticket the
 *      player skipped whole. More groups than tickets: the rest are shown and
 *      left out.
 *   4. EACH GROUP MERGES INTO ITS TICKET (mergeReplays), all or nothing:
 *      - a ticket with nothing raced takes the replays' lineup and races;
 *      - a logged ticket must have the same three, and every race it lists
 *        the same winner as the replay. Then the import only ADDS: races it
 *        doesn't list, places on races without them, the loss reasons, and
 *        Won by where it is blank. **A tapped result is never overwritten**;
 *      - any disagreement leaves the ticket exactly as it is, and the preview
 *        says why.
 *
 * Worked: Day 3, the player tapped Ticket 1 by hand (Oguri, Loss, Oguri) and
 * drops 8 replays of the same three. Group A is races 1-5, group B races 1-3.
 * A goes to Ticket 1: races 1-3 agree, so they gain places, Won by and loss
 * reasons, and races 4-5 are added. B goes to Ticket 2, which is empty, so it
 * is written whole.
 */

import { cmDayAt, CM_NOT_STARTED, CM_RUN_TICKETS, findRun, RUN_RACES } from "./pvpRuns"
import { parseApiDate } from "./dateFormat"
import type { ReplayRace } from "./gameImport/umadumpReplays"
import type { CalculationConstants, RaceEvent } from "../types"
import type { PvpRun, PvpRunContent, PvpRunRace, PvpRunRunner, PvpRunSlot } from "../types/pvpRun"
import type { PvpTeam } from "../types/pvpTeam"

const HOUR_MS = 3_600_000

/** What the import needs from the account and the catalogue. */
export interface ReplayContext {
	event: RaceEvent
	constants: CalculationConstants
	/** Our uma id by the game's outfit id (Uma.game_id). */
	umaByCard: Map<number, number>
	/** The account's veteran id by its import_key (the game's trained_chara_id). */
	veteranByKey: Map<number, number>
	/** The event's teams: a new ticket takes a matching one's spots and id. */
	teams: PvpTeam[]
}

export type ReplayOutcome =
	| { status: "new" }
	| { status: "fill"; added: number; placed: number; named: number }
	| { status: "same" }
	| { status: "mismatch"; reason: string }

export interface PlannedGroup {
	/** 1-4, or the Finals. */
	day: number | "final"
	/** The ticket it goes to, or null when the day has no ticket left for it. */
	slot: PvpRunSlot | null
	races: ReplayRace[]
	outcome: ReplayOutcome
}

export interface ReplayPlan {
	groups: PlannedGroup[]
	/** Races outside this CM's days (another event, or between Round 2 and the Finals). */
	outside: number
}

/** The day a race at `at` was run, or null when it isn't one of this CM's. */
export function replayDay(at: number, ctx: Pick<ReplayContext, "event" | "constants">): number | "final" | null {
	const start = parseApiDate(ctx.event.start_date)
	if (!start) return null
	const day = cmDayAt(ctx.event, ctx.constants, new Date(at))
	if (day === CM_NOT_STARTED) return null
	if (day !== null) return day
	const finals = start.getTime() + ctx.constants.cm_finals_hours * HOUR_MS
	return at >= finals && at < finals + 24 * HOUR_MS ? "final" : null
}

/** The three that ran, as one key: veterans when the file has them, else outfits. */
function lineupKey(race: ReplayRace): string {
	return race.runners
		.map((runner) => (runner.trainedCharaId !== null ? `v${runner.trainedCharaId}` : `c${runner.card}`))
		.sort()
		.join(",")
}

/** Races into tickets: by day, oldest first, five a ticket (one for the Finals) or a new three. */
export function groupReplays(races: ReplayRace[], ctx: Pick<ReplayContext, "event" | "constants">): { groups: Array<{ day: number | "final"; races: ReplayRace[] }>; outside: number } {
	const groups: Array<{ day: number | "final"; races: ReplayRace[] }> = []
	let outside = 0
	for (const race of [...races].sort((a, b) => a.at - b.at)) {
		const day = replayDay(race.at, ctx)
		if (day === null) {
			outside += 1
			continue
		}
		const last = groups.at(-1)
		const size = day === "final" ? 1 : RUN_RACES
		if (last && last.day === day && last.races.length < size && lineupKey(last.races[0]) === lineupKey(race)) last.races.push(race)
		else groups.push({ day, races: [race] })
	}
	return { groups, outside }
}

/** The plan the preview shows: each group's ticket and what saving it would do. */
export function planReplays(races: ReplayRace[], runs: PvpRun[], ctx: ReplayContext): ReplayPlan {
	const { groups, outside } = groupReplays(races, ctx)
	const next = new Map<number | "final", number>()
	const planned: PlannedGroup[] = []
	for (const group of groups) {
		let slot: PvpRunSlot | null = null
		if (group.day === "final") {
			// One Finals race; a second one is left out.
			if (!next.has("final")) slot = { stage: "final" }
			next.set("final", 1)
		} else {
			let ticket = next.get(group.day) ?? 1
			// A ticket the player skipped whole wasn't played: the races are a later one's.
			while (ticket <= CM_RUN_TICKETS && isSkippedWhole(findRun(runs, { stage: "day", day: group.day, ticket }))) ticket += 1
			if (ticket <= CM_RUN_TICKETS) slot = { stage: "day", day: group.day, ticket }
			next.set(group.day, ticket + 1)
		}
		const run = slot ? findRun(runs, slot) : undefined
		const outcome: ReplayOutcome = slot
			? mergeReplays(run ? toContent(run) : null, group.races, ctx, slot.stage === "final").outcome
			: { status: "mismatch", reason: group.day === "final" ? "A second Finals race." : `More than ${CM_RUN_TICKETS} tickets of races on this day.` }
		planned.push({ day: group.day, slot, races: group.races, outcome })
	}
	return { groups: planned, outside }
}

function isSkippedWhole(run: PvpRun | undefined): boolean {
	return Boolean(run?.skipped) && (run?.races.length ?? 0) === 0
}

function toContent(run: PvpRun): PvpRunContent {
	const { runners, races, finals_group, placement, note, skipped, team } = run
	return { runners, races, finals_group, placement, note, skipped, team: team ?? null }
}

/** Nothing raced, skipped or placed: a ticket the import may write whole (pvpRuns.isUnraced's rule, on content). */
function isUnracedContent(content: PvpRunContent | null): boolean {
	return !content || (content.races.length === 0 && !content.skipped)
}

/**
 * `current` with the group's races merged in, and what that did. On a
 * mismatch `content` is `current` itself, untouched: a save of it changes
 * nothing. Called again at save time on the ticket as it is then, so a tap
 * made after the preview still wins.
 */
export function mergeReplays(
	current: PvpRunContent | null,
	races: ReplayRace[],
	ctx: ReplayContext,
	/** The Finals: a win also fills a blank placement with 1st. */
	final = false,
): { content: PvpRunContent | null; outcome: ReplayOutcome } {
	const keep = (reason: string) => ({ content: current, outcome: { status: "mismatch" as const, reason } })
	const first = races[0]
	if (!first) return { content: current, outcome: { status: "same" } }
	const umas = first.runners.map((runner) => ctx.umaByCard.get(runner.card))
	if (umas.some((uma) => uma === undefined) || umas.length === 0) return keep("An uma in these races isn't on the site yet.")

	if (isUnracedContent(current)) return writeWhole(current, races, umas as number[], ctx, final)

	// A logged ticket: the same three, by uma.
	const runners = current!.runners
	const spotOf = new Map(runners.map((runner) => [runner.uma, runner.position]))
	if (runners.length !== umas.length || umas.some((uma) => !spotOf.has(uma as number))) return keep("You logged other umas on this ticket.")

	let added = 0
	let placed = 0
	let named = 0
	const byRace = new Map(current!.races.map((entry) => [entry.race, entry]))
	for (const [index, race] of races.entries()) {
		const number = index + 1
		const winner = winnerSpot(race, spotOf, ctx)
		const logged = byRace.get(number)
		if (logged) {
			if (logged.winner !== winner) return keep(`Race ${number} has another result in what you logged.`)
			const next = fillRace(logged, race, spotOf, ctx)
			if (next.placed) placed += 1
			if (next.named) named += 1
			byRace.set(number, next.entry)
		} else {
			if (current!.skipped) return keep(`You marked this ticket stopped after ${current!.races.length}.`)
			byRace.set(number, fillRace({ race: number, winner }, race, spotOf, ctx).entry)
			added += 1
		}
	}
	if (!added && !placed && !named) return { content: current, outcome: { status: "same" } }
	const content = { ...current!, races: [...byRace.values()].sort((a, b) => a.race - b.race) }
	return { content: withFinalsPlacement(content, final), outcome: { status: "fill", added, placed, named } }
}

/** A ticket with nothing raced: the replays' three, in a matching team's spots when there is one. */
function writeWhole(current: PvpRunContent | null, races: ReplayRace[], umas: number[], ctx: ReplayContext, final: boolean) {
	const first = races[0]
	const wanted = [...umas].sort().join(",")
	const team = ctx.teams.find((candidate) => candidate.members.map((member) => member.uma).sort().join(",") === wanted)
	const runners: PvpRunRunner[] = first.runners.map((runner, index) => {
		const uma = umas[index]
		const member = team?.members.find((candidate) => candidate.uma === uma)
		return {
			position: member?.position ?? index,
			uma,
			// The replay says how she ran; a team's style only fills a gap.
			style: runner.style ?? member?.style ?? "pace",
			trained_uma: runner.trainedCharaId !== null ? (ctx.veteranByKey.get(runner.trainedCharaId) ?? null) : null,
		}
	})
	runners.sort((a, b) => a.position - b.position)
	const spotOf = new Map(runners.map((runner) => [runner.uma, runner.position]))
	const raceRows = races.map((race, index) => fillRace({ race: index + 1, winner: winnerSpot(race, spotOf, ctx) }, race, spotOf, ctx).entry)
	const base = current ?? { runners: [], races: [], finals_group: "", placement: null, note: "", skipped: false, team: null }
	const content: PvpRunContent = { ...base, runners, races: raceRows, skipped: false, team: team?.id ?? null }
	return { content: withFinalsPlacement(content, final), outcome: { status: "new" as const } }
}

/** The spot of ours that won, or null for a loss. */
function winnerSpot(race: ReplayRace, spotOf: Map<number, number>, ctx: ReplayContext): number | null {
	if (!race.winner?.mine) return null
	const ours = race.runners.find((runner) => runner.place === 1)
	const uma = ours ? ctx.umaByCard.get(ours.card) : undefined
	return uma !== undefined ? (spotOf.get(uma) ?? null) : null
}

/**
 * One race with what the replay adds and nothing it would change: places when
 * the race has none (or the loss reasons, when the places it has are the
 * replay's), and Won by when blank (its style too, when the uma agrees).
 */
function fillRace(entry: PvpRunRace, race: ReplayRace, spotOf: Map<number, number>, ctx: ReplayContext): { entry: PvpRunRace; placed: boolean; named: boolean } {
	const next: PvpRunRace = { ...entry }
	const places = race.runners
		.map((runner) => {
			const uma = ctx.umaByCard.get(runner.card)
			const position = uma !== undefined ? spotOf.get(uma) : undefined
			return position === undefined ? null : { position, place: runner.place, loss_reason: runner.lossReason }
		})
		.filter((place): place is { position: number; place: number; loss_reason: string } => place !== null)
		.sort((a, b) => a.position - b.position)
	const had = entry.places ?? []
	let placed = false
	if (had.length === 0) {
		next.places = places
		placed = places.length > 0
	} else if (sameNumbers(had, places)) {
		// The player's places agree: add the reasons they couldn't type.
		const filled = had.map((place) => ({ ...place, loss_reason: place.loss_reason || (places.find((p) => p.position === place.position)?.loss_reason ?? "") }))
		placed = filled.some((place, index) => place.loss_reason !== (had[index].loss_reason ?? ""))
		next.places = filled
	}
	let named = false
	if (entry.winner === null && race.winner && !race.winner.mine) {
		const uma = ctx.umaByCard.get(race.winner.card) ?? null
		if (uma !== null && (entry.lost_to ?? null) === null) {
			next.lost_to = uma
			next.lost_to_style = race.winner.style ?? ""
			named = true
		} else if (uma !== null && entry.lost_to === uma && !entry.lost_to_style && race.winner.style) {
			next.lost_to_style = race.winner.style
			named = true
		}
	}
	return { entry: next, placed, named }
}

function sameNumbers(a: Array<{ position: number; place: number }>, b: Array<{ position: number; place: number }>): boolean {
	return a.length === b.length && a.every((place) => b.some((other) => other.position === place.position && other.place === place.place))
}

/** The Finals: one of yours winning is 1st place, as the Finals' own winner button does. */
function withFinalsPlacement(content: PvpRunContent, final: boolean): PvpRunContent {
	const won = typeof content.races.find((entry) => entry.race === 1)?.winner === "number"
	return final && won && content.placement === null ? { ...content, placement: 1 } : content
}
