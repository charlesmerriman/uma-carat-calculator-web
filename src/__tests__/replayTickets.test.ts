import { describe, expect, it } from "vitest"
import { DEFAULT_CONSTANTS } from "../constants/gameConstants"
import { groupReplays, mergeReplays, planReplays, replayDay, type ReplayContext } from "../utils/replayTickets"
import type { ReplayRace, ReplayRunner } from "../utils/gameImport/umadumpReplays"
import type { RaceEvent } from "../types"
import type { PvpRun, PvpRunContent } from "../types/pvpRun"
import type { PvpTeam } from "../types/pvpTeam"

/**
 * Slotting replays into tickets and merging them (utils/replayTickets.ts).
 * CM 22's dates: Round 1 from 2026-11-21 22:00 UTC, so Day 4 is 11-24 22:00
 * to 11-25 22:00, Round 2 ends 96 hours in, the Finals start at 120.
 *
 * Outfits (game ids) to our umas: Kitasan Black 106801 -> 41, Seiun Sky
 * 102001 -> 42, TM Opera O 101502 -> 43, the Oguri Cap that beats them
 * 100601 -> 50. The account's veteran 7 is Kitasan, import_key 1001.
 */

const HOUR = 3_600_000
const START = Date.UTC(2026, 10, 21, 22)
const EVENT = { id: 22, event_type: "champions_meeting", cm_number: 22, start_date: "2026-11-21T22:00:00Z", end_date: "2026-11-27T22:00:00Z" } as RaceEvent
const TEAM: PvpTeam = {
	key: "t1", id: 3, kind: "cm", event: 22, name: "", notes: [], isFocus: false, updatedAt: 0,
	// The team's spots differ from the file's order: Seiun Sky leads.
	members: [
		{ position: 0, uma: 42, style: "front", cards: [] },
		{ position: 1, uma: 41, style: "front", cards: [] },
		{ position: 2, uma: 43, style: "pace", cards: [] },
	],
}
const CTX: ReplayContext = {
	event: EVENT,
	constants: DEFAULT_CONSTANTS,
	umaByCard: new Map([[106801, 41], [102001, 42], [101502, 43], [100601, 50]]),
	veteranByKey: new Map([[1001, 7]]),
	teams: [TEAM],
}

const runner = (card: number, place: number, lossReason = "", trainedCharaId: number | null = null): ReplayRunner => ({
	card, style: card === 101502 ? "pace" : "front", trainedCharaId, place, lossReason,
})
/** A race at `hours` after the start: a loss to Oguri Cap (8th, 9th, 7th), or Kitasan winning. */
const race = (hours: number, won = false): ReplayRace => ({
	at: START + hours * HOUR,
	runners: won
		? [runner(106801, 1, "Win", 1001), runner(102001, 4, "Speed"), runner(101502, 6, "Stamina")]
		: [runner(106801, 8, "ProperGround", 1001), runner(102001, 9, "ProperGround"), runner(101502, 7, "ProperDistance")],
	winner: won ? { card: 106801, style: "front", mine: true } : { card: 100601, style: "late", mine: false },
})
/** Day 4, minutes apart. */
const day4 = (count: number, wins: number[] = []) => Array.from({ length: count }, (_, index) => race(82 + index * 0.1, wins.includes(index)))

const run = (ticket: number, content: Partial<PvpRunContent>): PvpRun => ({
	kind: "cm", event: 22, stage: "day", day: 4, ticket, runners: [], races: [], finals_group: "", placement: null,
	note: "", skipped: false, team: null, updated_at: "", ...content,
} as PvpRun)
const LINEUP = TEAM.members.map(({ position, uma, style }) => ({ position, uma, style, trained_uma: null }))

describe("replayDay", () => {
	it("reads the day on the event's clock, the Finals in their own day, and nothing else", () => {
		expect(replayDay(START + 2 * HOUR, CTX)).toBe(1)
		expect(replayDay(START + 82 * HOUR, CTX)).toBe(4)
		expect(replayDay(START + 121 * HOUR, CTX)).toBe("final")
		// Before Round 1, between Round 2 and the Finals, and after the Finals' day.
		expect(replayDay(START - HOUR, CTX)).toBeNull()
		expect(replayDay(START + 100 * HOUR, CTX)).toBeNull()
		expect(replayDay(START + 150 * HOUR, CTX)).toBeNull()
	})
})

describe("groupReplays", () => {
	it("makes a ticket of every five races of one day, and a new one when the three change", () => {
		const other = { ...race(82.9), runners: [runner(106801, 3, "", 1001), runner(100601, 5), runner(101502, 6)] }
		const { groups, outside } = groupReplays([...day4(7), other, race(-5)], CTX)
		expect(groups.map((group) => [group.day, group.races.length])).toEqual([[4, 5], [4, 2], [4, 1]])
		expect(outside).toBe(1)
	})
})

describe("planReplays and mergeReplays", () => {
	it("writes an empty ticket whole: the team's spots, the replay's styles, the veteran, places and Won by", () => {
		const plan = planReplays(day4(5, [2]), [], CTX)
		expect(plan.groups.map((group) => [group.slot, group.outcome.status])).toEqual([[{ stage: "day", day: 4, ticket: 1 }, "new"]])
		const { content } = mergeReplays(null, plan.groups[0].races, CTX)
		expect(content?.team).toBe(3)
		expect(content?.runners).toEqual([
			{ position: 0, uma: 42, style: "front", trained_uma: null },
			{ position: 1, uma: 41, style: "front", trained_uma: 7 },
			{ position: 2, uma: 43, style: "pace", trained_uma: null },
		])
		expect(content?.races[0]).toEqual({
			race: 1, winner: null, lost_to: 50, lost_to_style: "late",
			places: [
				{ position: 0, place: 9, loss_reason: "ProperGround" },
				{ position: 1, place: 8, loss_reason: "ProperGround" },
				{ position: 2, place: 7, loss_reason: "ProperDistance" },
			],
		})
		// Race 3: Kitasan, in spot 1, won.
		expect(content?.races[2]).toMatchObject({ race: 3, winner: 1 })
		expect(content?.races[2].lost_to).toBeUndefined()
	})

	it("fills a ticket the player tapped, adding only what's missing", () => {
		const tapped = run(1, { runners: LINEUP, races: [{ race: 1, winner: null }, { race: 2, winner: null, lost_to: 99 }] })
		const plan = planReplays(day4(3), [tapped], CTX)
		expect(plan.groups[0].outcome).toEqual({ status: "fill", added: 1, placed: 2, named: 1 })
		const { content } = mergeReplays(tapped, day4(3), CTX)
		// Race 1 gains places and Won by; race 2 keeps the player's Won by; race 3 is added.
		expect(content?.races[0]).toMatchObject({ lost_to: 50, places: expect.any(Array) })
		expect(content?.races[1].lost_to).toBe(99)
		expect(content?.races.map((entry) => entry.race)).toEqual([1, 2, 3])
	})

	it("never overwrites a tapped result: a ticket that disagrees is left as it is", () => {
		// The player says Kitasan won race 2; the replay says Oguri Cap did.
		const tapped = run(1, { runners: LINEUP, races: [{ race: 1, winner: null }, { race: 2, winner: 1 }] })
		const merged = mergeReplays(tapped, day4(3), CTX)
		expect(merged.outcome).toEqual({ status: "mismatch", reason: "Race 2 has another result in what you logged." })
		expect(merged.content).toBe(tapped)
		// Other umas on the ticket, or a stopped ticket the replays run past, are left alone too.
		const others = run(1, { runners: LINEUP.map((member) => (member.position === 0 ? { ...member, uma: 77 } : member)), races: [{ race: 1, winner: null }] })
		expect(mergeReplays(others, day4(2), CTX).outcome.status).toBe("mismatch")
		const stopped = run(1, { runners: LINEUP, races: [{ race: 1, winner: null }], skipped: true })
		expect(mergeReplays(stopped, day4(2), CTX).outcome.status).toBe("mismatch")
	})

	it("finds the tapped ticket that agrees, wherever it sits, before a free one", () => {
		// Ticket 1 was another run (Kitasan won race 1); Ticket 2 is these races, tapped.
		const other = run(1, { runners: LINEUP, races: [{ race: 1, winner: 1 }] })
		const these = run(2, { runners: LINEUP, races: [{ race: 1, winner: null }, { race: 2, winner: null }] })
		const plan = planReplays(day4(5), [other, these], CTX)
		expect(plan.groups[0].slot).toEqual({ stage: "day", day: 4, ticket: 2 })
		expect(plan.groups[0].outcome.status).toBe("fill")
		// With no ticket agreeing and none free after it, the next logged one says why.
		const lone = planReplays(day4(2), [other, run(2, { runners: LINEUP, races: [{ race: 1, winner: 0 }] }), run(3, { skipped: true }), run(4, { runners: LINEUP, races: [{ race: 1, winner: 2 }] })], CTX)
		expect(lone.groups[0]).toMatchObject({ slot: { ticket: 1 }, outcome: { status: "mismatch" } })
	})

	it("passes over a ticket skipped whole, and says when a day runs out of tickets", () => {
		const skipped = run(1, { skipped: true })
		const plan = planReplays(day4(20), [skipped], CTX)
		expect(plan.groups.map((group) => group.slot && "ticket" in group.slot ? group.slot.ticket : null)).toEqual([2, 3, 4, null])
		expect(plan.groups[3].outcome).toEqual({ status: "mismatch", reason: "More than 4 tickets of races on this day." })
	})

	it("puts a Finals win at 1st place, as the Finals' winner button does", () => {
		const finals = race(121, true)
		const plan = planReplays([finals], [], CTX)
		expect(plan.groups[0].slot).toEqual({ stage: "final" })
		const { content } = mergeReplays(null, [finals], CTX, true)
		expect(content?.placement).toBe(1)
		expect(content?.races).toHaveLength(1)
	})

	it("leaves out a race with an uma the site doesn't have", () => {
		const unknown = { ...race(82), runners: [runner(106801, 8), runner(123456, 9), runner(101502, 7)] }
		expect(mergeReplays(null, [unknown], CTX).outcome).toEqual({ status: "mismatch", reason: "An uma in these races isn't on the site yet." })
	})
})
