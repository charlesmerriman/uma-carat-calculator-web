import { describe, expect, it } from "vitest"
import { DEFAULT_CONSTANTS } from "../constants/gameConstants"
import {
	CM_NOT_STARTED,
	bestTicketWins,
	cmDayAt,
	emptyContent,
	formatRate,
	isPastDay,
	lineupFromTeam,
	logRace,
	previousRun,
	runsOf,
	sameLineup,
	sameSlot,
	setRace,
	summarizeRuns,
	tallyRun,
	ticketCounts,
	ticketState,
	unloggedTickets,
} from "../utils/pvpRuns"
import type { RaceEvent } from "../types"
import type { PvpRun, PvpRunRace, PvpRunRunner } from "../types/pvpRun"

/**
 * The CM Runs view's maths. The worked example is the one in
 * utils/pvpRuns.ts's header: Oguri (spot 0), Maruzensky (1), Gold Ship (2).
 */

const OGURI = 41
const MARU = 42
const GOLD = 43

const LINEUP: PvpRunRunner[] = [
	{ position: 0, uma: OGURI, style: "pace" },
	{ position: 1, uma: MARU, style: "front" },
	{ position: 2, uma: GOLD, style: "end" },
]

const races = (...winners: Array<number | null>): PvpRunRace[] =>
	winners.map((winner, index) => ({ race: index + 1, winner }))

const ticket = (day: number, number: number, raced: PvpRunRace[], runners: PvpRunRunner[] = LINEUP): PvpRun => ({
	kind: "cm",
	event: 21,
	stage: "day",
	day,
	ticket: number,
	runners,
	races: raced,
	finals_group: "",
	placement: null,
	note: "",
	skipped: false,
	updated_at: "2026-11-01T00:00:00Z",
})

describe("win rates", () => {
	it("counts the worked example: a race not run is in no denominator", () => {
		const run = ticket(1, 1, races(0, null, 0, 1))
		expect(tallyRun(run)).toEqual({ wins: 3, raced: 4 })
		const { total, umas } = summarizeRuns([run])
		expect(total).toEqual({ wins: 3, raced: 4 })
		expect(umas).toEqual([
			{ uma: OGURI, trained_uma: null, wins: 2, raced: 4 },
			{ uma: MARU, trained_uma: null, wins: 1, raced: 4 },
			{ uma: GOLD, trained_uma: null, wins: 0, raced: 4 },
		])
		expect(formatRate(total)).toBe("75%")
	})

	it("adds up an uma across tickets, and only the races she ran", () => {
		const swapped: PvpRunRunner[] = [LINEUP[0], LINEUP[1], { position: 2, uma: 44, style: "late" }]
		const { umas } = summarizeRuns([ticket(1, 1, races(2, 2, null)), ticket(1, 2, races(0, null), swapped)])
		expect(umas.find((tally) => tally.uma === GOLD)).toEqual({ uma: GOLD, trained_uma: null, wins: 2, raced: 3 })
		expect(umas.find((tally) => tally.uma === OGURI)).toEqual({ uma: OGURI, trained_uma: null, wins: 1, raced: 5 })
		expect(umas.find((tally) => tally.uma === 44)).toEqual({ uma: 44, trained_uma: null, wins: 0, raced: 2 })
	})

	it("keeps two veterans of one uma, and a runner with none, as separate rows", () => {
		const withVeteran = (veteran: number | null): PvpRunRunner[] => [{ ...LINEUP[0], trained_uma: veteran }]
		const { umas } = summarizeRuns([
			ticket(1, 1, races(0, 0), withVeteran(5)),
			ticket(1, 2, races(null), withVeteran(6)),
			ticket(1, 3, races(0), withVeteran(null)),
		])
		expect(umas).toEqual([
			{ uma: OGURI, trained_uma: 5, wins: 2, raced: 2 },
			{ uma: OGURI, trained_uma: null, wins: 1, raced: 1 },
			{ uma: OGURI, trained_uma: 6, wins: 0, raced: 1 },
		])
	})

	it("shows an en dash when nothing was raced", () => {
		expect(formatRate({ wins: 0, raced: 0 })).toBe("–")
	})

	it("takes a round's best ticket, the game's rule", () => {
		const runs = [ticket(1, 1, races(0, null, null)), ticket(2, 3, races(0, 1, 2, null)), ticket(3, 1, races(null))]
		expect(bestTicketWins(runs, 1)).toBe(3)
		expect(bestTicketWins(runs, 2)).toBe(0)
		expect(runsOf(runs, { round: 2 })).toHaveLength(1)
	})

	it("has no best ticket for a round with nothing raced", () => {
		expect(bestTicketWins([ticket(3, 1, [])], 2)).toBeNull()
	})
})

describe("editing a ticket", () => {
	it("sets, changes and clears a race, keeping race order", () => {
		let raced = setRace([], 3, 1)
		raced = setRace(raced, 1, null)
		expect(raced).toEqual([{ race: 1, winner: null }, { race: 3, winner: 1 }])
		raced = setRace(raced, 3, 2)
		expect(raced).toEqual([{ race: 1, winner: null }, { race: 3, winner: 2 }])
		expect(setRace(raced, 1, undefined)).toEqual([{ race: 3, winner: 2 }])
	})

	it("copies a team's umas, styles and veterans into a lineup, in spot order, without the deck", () => {
		expect(
			lineupFromTeam([
				{ position: 1, uma: MARU, style: "front", cards: [{ slot: 1, support_card: 9 }], trained_uma: 7 },
				{ position: 0, uma: OGURI, style: "pace", cards: [] },
			])
		).toEqual([{ ...LINEUP[0], trained_uma: null }, { ...LINEUP[1], trained_uma: 7 }])
	})

	it("counts a different veteran as a different lineup", () => {
		const withVeteran = LINEUP.map((runner) => ({ ...runner, trained_uma: runner.position === 0 ? 7 : null }))
		expect(sameLineup(LINEUP, LINEUP.map((runner) => ({ ...runner, trained_uma: null })))).toBe(true)
		expect(sameLineup(LINEUP, withVeteran)).toBe(false)
	})

	it("offers the latest EARLIER ticket's lineup for a new one", () => {
		const other = [LINEUP[0]]
		const runs = [ticket(1, 2, [], other), ticket(1, 1, []), ticket(2, 1, [])]
		expect(previousRun(runs, 1, 4)?.runners).toEqual(other)
		expect(previousRun(runs, 1, 4)?.ticket).toBe(2)
		expect(previousRun(runs, 1, 2)?.runners).toEqual(LINEUP)
		expect(previousRun(runs, 1, 1)).toBeNull()
		// The final copies the last ticket of the event.
		expect(previousRun(runs, 5, 1)).toMatchObject({ day: 2, ticket: 1 })
	})

	it("tells a final from a ticket", () => {
		expect(sameSlot({ stage: "final" }, { stage: "final" })).toBe(true)
		expect(sameSlot({ stage: "final" }, { stage: "day", day: 1, ticket: 1 })).toBe(false)
		expect(sameSlot({ stage: "day", day: 1, ticket: 2 }, { stage: "day", day: 1, ticket: 2 })).toBe(true)
	})
})

describe("skipped tickets", () => {
	const skipped = (run: PvpRun): PvpRun => ({ ...run, skipped: true })

	it("tells every state of a ticket apart", () => {
		expect(ticketState(undefined)).toBe("unlogged")
		expect(ticketState(skipped(ticket(1, 1, [], [])))).toBe("skipped")
		expect(ticketState(skipped(ticket(1, 1, races(0, null))))).toBe("stopped")
		expect(ticketState(ticket(1, 1, []))).toBe("started")
		expect(ticketState(ticket(1, 1, races(0, null, 1)))).toBe("started")
		expect(ticketState(ticket(1, 1, races(0, 0, 0, 0, 0)))).toBe("done")
	})

	it("takes a skip back when a race it did not list is logged, and only then", () => {
		const stopped = { ...emptyContent(LINEUP), races: races(0, null), skipped: true }
		expect(logRace(stopped, 3, 1).skipped).toBe(false)
		expect(logRace(stopped, 3, null).skipped).toBe(false)
		// Fixing or clearing a race already listed is still "stopped after".
		expect(logRace(stopped, 2, 1)).toMatchObject({ races: races(0, 1), skipped: true })
		expect(logRace(stopped, 2, undefined)).toMatchObject({ races: races(0), skipped: true })
	})

	it("counts tickets used, stopped ones too, apart from those skipped whole", () => {
		const runs = [
			ticket(1, 1, races(0, 0, 0, 0, 0)),
			skipped(ticket(1, 2, races(0, null))),
			skipped(ticket(1, 3, [], [])),
			ticket(1, 4, []),
		]
		expect(ticketCounts(runs)).toEqual({ used: 2, skipped: 1 })
		// A skip changes no win rate: the unlisted races were never counted.
		expect(summarizeRuns(runs).total).toEqual({ wins: 6, raced: 7 })
	})

	it("lists the tickets of a day with nothing logged", () => {
		expect(unloggedTickets([ticket(1, 2, []), ticket(2, 1, [])], 1)).toEqual([1, 3, 4])
		expect(unloggedTickets([], 3)).toEqual([1, 2, 3, 4])
	})

	it("knows a day is over only once the next has started", () => {
		expect(isPastDay(1, 1)).toBe(false)
		expect(isPastDay(1, 2)).toBe(true)
		expect(isPastDay(2, 2)).toBe(false)
		expect(isPastDay(4, null)).toBe(true)
	})
})

describe("the day a CM is on", () => {
	// CM 21 Capricorn Cup's real dates; Round 2 is 48 hours in, the final 120.
	const cm = { start_date: "2026-10-31T22:00:00Z" } as RaceEvent
	const at = (iso: string) => cmDayAt(cm, DEFAULT_CONSTANTS, new Date(iso))

	it("is no day while registration is open, before Round 1 starts", () => {
		// Registration opened 72 hours before the start: 2026-10-28 22:00 UTC.
		expect(at("2026-10-28T22:00:00Z")).toBe(CM_NOT_STARTED)
		expect(at("2026-10-31T21:59:00Z")).toBe(CM_NOT_STARTED)
		expect(isPastDay(1, CM_NOT_STARTED)).toBe(false)
	})

	it("counts 24-hour days from the start, held at 4 after it", () => {
		expect(at("2026-10-31T22:00:00Z")).toBe(1)
		expect(at("2026-11-01T21:59:00Z")).toBe(1)
		expect(at("2026-11-01T22:00:00Z")).toBe(2)
		expect(at("2026-11-02T22:00:00Z")).toBe(3)
		expect(at("2026-11-04T21:00:00Z")).toBe(4)
		expect(at("2026-11-05T12:00:00Z")).toBe(4)
	})

	it("is the final once the final has started", () => {
		expect(DEFAULT_CONSTANTS.cm_finals_hours).toBe(120)
		expect(at("2026-11-05T22:00:00Z")).toBeNull()
	})
})
