import { describe, expect, it } from "vitest"
import { DEFAULT_CONSTANTS } from "../constants/gameConstants"
import {
	CM_NOT_STARTED,
	bestTicketWins,
	CM_SHAPE,
	dayLabel,
	openingTab,
	ticketNumber,
	ordinal,
	registeredLineups,
	runDayAt,
	runShape,
	cmDayAt,
	emptyContent,
	beatenBy,
	fullyPlaced,
	lossReasonLabel,
	lossReasons,
	nextRaceToPlace,
	placeTallies,
	setLostTo,
	setPlace,
	eventHistory,
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
	clearLineup,
	unracedSlots,
	ticketState,
	unloggedTickets,
	veteranRecords,
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
	team: null,
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

describe("one team for many tickets", () => {
	const days = (from: number) =>
		Array.from({ length: 4 - from + 1 }, (_, index) => from + index).flatMap((day) =>
			[1, 2, 3, 4].map((number) => ({ stage: "day", day, ticket: number }))
		)

	it("takes all sixteen tickets and the Finals before the CM starts", () => {
		expect(unracedSlots([], CM_NOT_STARTED)).toEqual([...days(1), { stage: "final" }])
	})

	it("replaces a lineup with no races, never a raced or skipped ticket, nor a past day", () => {
		const skipped = { ...ticket(3, 2, [], []), skipped: true }
		const lineupOnly = ticket(3, 1, [])
		const slots = unracedSlots([lineupOnly, skipped, ticket(3, 3, races(0)), ticket(2, 1, [])], 3)
		expect(slots).toEqual([
			{ stage: "day", day: 3, ticket: 1 },
			{ stage: "day", day: 3, ticket: 4 },
			...days(4),
			{ stage: "final" },
		])
	})

	it("takes one day whole when it's picked, past or not, and never the Finals", () => {
		const slots = unracedSlots([ticket(1, 2, races(0))], 3, undefined, 1)
		expect(slots).toEqual([1, 3, 4].map((number) => ({ stage: "day", day: 1, ticket: number })))
	})

	it("is the Finals alone once Round 2 has ended", () => {
		expect(unracedSlots([], null)).toEqual([{ stage: "final" }])
	})

	it("clears a lineup, keeping a ticket only for its note", () => {
		expect(clearLineup(emptyContent(LINEUP))).toBeNull()
		expect(clearLineup({ ...emptyContent(LINEUP), note: "rerolled" })).toMatchObject({ runners: [], note: "rerolled" })
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

	it("counts 24-hour days from the start", () => {
		expect(at("2026-10-31T22:00:00Z")).toBe(1)
		expect(at("2026-11-01T21:59:00Z")).toBe(1)
		expect(at("2026-11-01T22:00:00Z")).toBe(2)
		expect(at("2026-11-02T22:00:00Z")).toBe(3)
		expect(at("2026-11-04T21:59:00Z")).toBe(4)
	})

	it("is no day once Round 2 has ended: finals registration, then the final", () => {
		// Round 2 starts 48 hours in and runs two days, so it ends 96 hours in.
		expect(DEFAULT_CONSTANTS.cm_round_two_hours).toBe(48)
		expect(at("2026-11-04T22:00:00Z")).toBeNull()
		expect(at("2026-11-05T09:59:00Z")).toBeNull()
		expect(at("2026-11-05T22:00:00Z")).toBeNull()
		expect(isPastDay(4, null)).toBe(true)
	})
})

describe("the CM history", () => {
	const cm = (id: number, start: string) =>
		({ id, event_type: "champions_meeting", name: `Champions Meeting ${id} Cup`, start_date: start, end_date: start }) as RaceEvent
	const events = [cm(20, "2026-10-01T22:00:00Z"), cm(21, "2026-10-31T22:00:00Z")]
	const VETERAN_A: PvpRunRunner[] = [{ position: 0, uma: OGURI, style: "pace", trained_uma: 7 }, ...LINEUP.slice(1)]
	const VETERAN_B: PvpRunRunner[] = [{ position: 0, uma: OGURI, style: "pace", trained_uma: 8 }, ...LINEUP.slice(1)]
	const inEvent = (event: number, run: PvpRun): PvpRun => ({ ...run, event })

	it("groups by event, newest first, with CM Runs' own numbers", () => {
		const runs = [
			inEvent(20, ticket(1, 1, races(0, null, 1))),
			inEvent(21, ticket(1, 1, races(0, 0, 0, 0, null))),
			inEvent(21, ticket(3, 2, races(1, 1))),
			{ ...inEvent(21, ticket(1, 1, races(0))), stage: "final" as const, day: null, ticket: null, placement: 2, finals_group: "A" as const },
		]
		const [newest, older] = eventHistory(runs, events)
		expect(newest.event.id).toBe(21)
		// Days only: 6 wins of 7 races, the Finals race apart.
		expect(newest.total).toEqual({ wins: 6, raced: 7 })
		expect(bestTicketWins(newest.runs, 1)).toBe(4)
		expect(newest.final?.placement).toBe(2)
		expect(older.total).toEqual({ wins: 2, raced: 3 })
	})

	it("leaves out an event that isn't in the list, and an uma that never raced", () => {
		const runs = [inEvent(99, ticket(1, 1, races(0))), inEvent(20, ticket(1, 1, []))]
		const history = eventHistory(runs, events)
		expect(history.map((row) => row.event.id)).toEqual([20])
		expect(history[0].umas).toEqual([])
	})

	it("adds each veteran up across events, best rate first", () => {
		const runs = [
			inEvent(20, ticket(1, 1, races(0, 0, null), VETERAN_A)),
			inEvent(21, ticket(1, 1, races(0, null), VETERAN_A)),
			inEvent(21, ticket(2, 1, races(0, 0), VETERAN_B)),
		]
		expect(veteranRecords(runs)).toEqual([
			{ uma: OGURI, trained_uma: 8, wins: 2, raced: 2, events: 1 },
			{ uma: OGURI, trained_uma: 7, wins: 3, raced: 5, events: 2 },
		])
	})
})

describe("a League of Heroes", () => {
	const loh = { event_type: "league_of_heroes", start_date: "2027-01-25T22:00:00Z" } as unknown as RaceEvent
	const shape = runShape(loh)
	const at = (iso: string) => runDayAt(loh, DEFAULT_CONSTANTS, new Date(iso), shape)

	it("is thirty tickets in fives, with no rounds", () => {
		expect(shape).toEqual({ days: 6, tickets: 5, rounds: false })
	})

	it("only says whether it's on: a saved ticket can run on any later day", () => {
		expect(at("2027-01-25T21:59:00Z")).toBe(0)
		expect(at("2027-01-25T22:00:00Z")).toBe(1)
		expect(at("2027-01-30T12:00:00Z")).toBe(1)
		expect(at("2027-01-31T21:59:00Z")).toBe(1)
		expect(at("2027-01-31T22:00:00Z")).toBeNull()
		// So nothing is called over until the whole event is.
		expect(isPastDay(1, at("2027-01-30T12:00:00Z"))).toBe(false)
		expect(isPastDay(1, at("2027-01-31T22:00:00Z"))).toBe(true)
	})

	it("numbers tickets straight through and names tabs by them", () => {
		expect([ticketNumber(1, 5, shape), ticketNumber(2, 1, shape), ticketNumber(6, 5, shape)]).toEqual([5, 6, 30])
		expect(dayLabel(2, shape)).toBe("Tickets 6-10")
		expect(dayLabel(2, CM_SHAPE)).toBe("Day 2")
		expect(ticketNumber(2, 1, CM_SHAPE)).toBe(1)
	})

	it("opens on the first tickets with something left to log", () => {
		const firstFive = [1, 2, 3, 4, 5].map((number) => ticket(1, number, races(0, 0, 0, 0, 0)))
		expect(openingTab([], 1, shape)).toBe(1)
		expect(openingTab(firstFive, 1, shape)).toBe(2)
		expect(openingTab(firstFive, null, shape)).toBe("final")
	})

	it("fills every ticket left and leaves the Top 96 out", () => {
		const slots = unracedSlots([], 1, shape)
		expect(slots).toHaveLength(30)
		expect(slots.some((slot) => slot.stage === "final")).toBe(false)
	})

	it("reads each different lineup logged, latest first", () => {
		const others: PvpRunRunner[] = [{ ...LINEUP[0], uma: 99 }, LINEUP[1], LINEUP[2]]
		const runs = [ticket(1, 1, []), ticket(1, 2, [], others), ticket(2, 1, []), ticket(2, 2, [], [])]
		expect(registeredLineups(runs).map((run) => [run.day, run.ticket])).toEqual([[2, 1], [1, 2]])
	})

	it("reads placements past 3rd", () => {
		expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 42, 93, 96].map(ordinal)).toEqual(
			["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "42nd", "93rd", "96th"]
		)
	})

	it("groups the thousands of a LoH placement", () => {
		expect([1111, 12_345, 1_000_000].map(ordinal)).toEqual(["1,111th", "12,345th", "1,000,000th"])
	})
})


describe("places and Won by (notes/cm-runs-plan-2.md)", () => {
	const runners = [
		{ position: 0, uma: 11, style: "front" as const },
		{ position: 1, uma: 12, style: "pace" as const },
		{ position: 2, uma: 13, style: "end" as const },
	]
	const start = () => emptyContent(runners)

	it("makes 1st the winner, and a place on an unlogged race a loss until someone is 1st", () => {
		let ticket = setPlace(start(), 1, 1, 4)
		expect(ticket.races).toEqual([{ race: 1, winner: null, places: [{ position: 1, place: 4, loss_reason: "" }] }])
		ticket = setPlace(ticket, 1, 0, 1)
		expect(ticket.races[0].winner).toBe(0)
		// A place another of yours held moves; taking 1st away makes it a loss again.
		ticket = setPlace(ticket, 1, 2, 4)
		expect(ticket.races[0].places?.map((place) => [place.position, place.place])).toEqual([[0, 1], [2, 4]])
		ticket = setPlace(ticket, 1, 0, 3)
		expect(ticket.races[0].winner).toBeNull()
	})

	it("keeps a race coherent when its winner is tapped, and a Won by only on a loss", () => {
		let ticket = setPlace(start(), 1, 0, 2)
		ticket = setLostTo(ticket, 1, 99)
		expect(ticket.races[0].lost_to).toBe(99)
		ticket = logRace(ticket, 1, 0)
		expect(ticket.races[0]).toEqual({ race: 1, winner: 0, places: [], lost_to: null })
		// A race that never had places sends none, so the server keeps what it has.
		expect(logRace(start(), 2, 1).races).toEqual([{ race: 2, winner: 1 }])
	})

	it("averages places and counts who beat you", () => {
		const run = {
			runners,
			stage: "day" as const,
			day: 1,
			ticket: 1,
			races: [
				{ race: 1, winner: 0, places: [{ position: 0, place: 1 }, { position: 2, place: 9 }] },
				{ race: 2, winner: null, places: [{ position: 0, place: 2 }, { position: 2, place: 8 }], lost_to: 99 },
				{ race: 3, winner: null, lost_to: 99 },
				{ race: 4, winner: null },
			],
		}
		const places = placeTallies([run])
		expect(places.get("11:")).toMatchObject({ placed: 2, total: 3, top3: 2 })
		expect(places.get("13:")).toMatchObject({ placed: 2, total: 17, top3: 0 })
		expect(beatenBy([run])).toEqual({ umas: [{ uma: 99, losses: 2 }], named: 2 })
	})

	it("counts each uma's loss reasons, leaving out Win, Lose and blank", () => {
		const placed = (position: number, place: number, loss_reason: string) => ({ position, place, loss_reason })
		const run = {
			runners,
			races: [
				{ race: 1, winner: null, places: [placed(0, 8, "ProperGround"), placed(1, 2, "Lose"), placed(2, 9, "")] },
				{ race: 2, winner: 1, places: [placed(0, 7, "ProperGround"), placed(1, 1, "Win"), placed(2, 6, "Stamina")] },
			],
		}
		const reasons = lossReasons([run])
		expect(reasons.get("11:")).toEqual([{ code: "ProperGround", count: 2 }])
		expect(reasons.get("12:")).toBeUndefined()
		expect(reasons.get("13:")).toEqual([{ code: "Stamina", count: 1 }])
		// Confirmed codes read as words; the rest as the game's own.
		expect(["ProperGround", "Stamina"].map(lossReasonLabel)).toEqual(["Ground aptitude", "Stamina"])
	})

	it("puts the most recent loss first on a tie, by day, ticket and race", () => {
		const loss = (race: number, lost_to: number) => ({ race, winner: null, lost_to })
		const runs = [
			{ stage: "day" as const, day: 2, ticket: 1, races: [loss(1, 70), loss(4, 80)] },
			{ stage: "day" as const, day: 1, ticket: 4, races: [loss(5, 90)] },
			// The Finals come after every day.
			{ stage: "final" as const, day: null, ticket: null, races: [loss(1, 60)] },
		]
		expect(beatenBy(runs).umas.map((entry) => entry.uma)).toEqual([60, 80, 70, 90])
	})

	it("opens the strips on the first race part-placed or not logged, never a winner-only one", () => {
		const placed = (position: number, place: number) => ({ position, place, loss_reason: "" })
		// Logged before places existed: races 1-2 have winners only, so race 3 opens.
		expect(nextRaceToPlace({ runners, skipped: false, races: [{ race: 1, winner: 0 }, { race: 2, winner: null }] })).toBe(3)
		// Race 1 has one place of three: it stays open.
		expect(nextRaceToPlace({ runners, skipped: false, races: [{ race: 1, winner: 0, places: [placed(0, 1)] }] })).toBe(1)
		// Fully placed races, and a stopped ticket's unlisted races, are done.
		const full = { race: 1, winner: 0, places: [placed(0, 1), placed(1, 4), placed(2, 9)] }
		expect(fullyPlaced(full, runners)).toBe(true)
		expect(nextRaceToPlace({ runners, skipped: true, races: [full] })).toBeNull()
	})
})
