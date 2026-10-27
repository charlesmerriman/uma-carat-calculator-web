import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	clearGuestPvpTeams,
	readGuestPvpTeams,
	writeGuestPvpTeams,
	type GuestPvpTeam,
} from "../services/guestPvpTeamStore"

/**
 * The guest's teams on the device: what goes in comes back, a damaged entry
 * costs only the damaged part, and a refusing browser is reported.
 */

const KEY = "guestPvpTeams.v1"

const team = (extra: Partial<GuestPvpTeam> = {}): GuestPvpTeam => ({
	kind: "cm",
	event: 10,
	name: "Aquarius",
	focus: false,
	notes: [{ text: "Pull Kitasan", color: "yellow" }],
	members: [{ position: 0, uma: 41, style: "front", cards: [{ slot: 1, support_card: 302 }] }],
	updatedAt: 1700000000000,
	...extra,
})

const store = (teams: unknown[]): void =>
	localStorage.setItem(KEY, JSON.stringify({ version: 1, savedAt: 1, teams }))

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe("guestPvpTeamStore", () => {
	it("round-trips teams", () => {
		expect(writeGuestPvpTeams([team(), team({ kind: "loh", event: 3, name: "" })])).toBe(true)
		const read = readGuestPvpTeams()
		expect(read).toHaveLength(2)
		expect(read[0]).toEqual(team())
		expect(read[1].kind).toBe("loh")
	})

	it("removes the key when there are no teams", () => {
		writeGuestPvpTeams([team()])
		writeGuestPvpTeams([])
		expect(localStorage.getItem(KEY)).toBeNull()
	})

	it("drops a damaged team, member, card or note and keeps the rest", () => {
		store([
			team(),
			{ kind: "tt", event: 10, members: [] },
			{
				...team(),
				event: 11,
				members: [
					{ position: 0, uma: 41, style: "front", cards: [{ slot: 9, support_card: 1 }, { slot: 2, support_card: 5 }] },
					{ position: 1, uma: 42, style: "everyone", cards: [] },
					{ position: 0, uma: 43, style: "pace", cards: [] },
				],
				notes: [{ text: "x".repeat(1001), color: "yellow" }, { text: "ok", color: "purple" }, { text: "fine", color: "blue" }],
			},
		])
		const read = readGuestPvpTeams()
		expect(read.map((row) => row.event)).toEqual([10, 11])
		expect(read[1].members).toEqual([{ position: 0, uma: 41, style: "front", cards: [{ slot: 2, support_card: 5 }] }])
		expect(read[1].notes).toEqual([{ text: "fine", color: "blue" }])
	})

	it("keeps one card per slot, and the same card in two slots (a placeholder may stand in twice)", () => {
		store([
			{
				...team(),
				members: [
					{ position: 0, uma: 41, style: "front", cards: [{ slot: 1, support_card: 579 }, { slot: 1, support_card: 5 }, { slot: 2, support_card: 579 }] },
				],
			},
		])
		expect(readGuestPvpTeams()[0].members[0].cards).toEqual([
			{ slot: 1, support_card: 579 },
			{ slot: 2, support_card: 579 },
		])
	})

	it("keeps only extra fields it knows", () => {
		store([{ ...team(), id: 99, secret: "x" }])
		expect(Object.keys(readGuestPvpTeams()[0]).sort()).toEqual(["event", "focus", "kind", "members", "name", "notes", "updatedAt"])
	})

	it("keeps one pin and at most ten notes", () => {
		store([
			team({ focus: true, notes: Array.from({ length: 12 }, () => ({ text: "n", color: "pink" as const })) }),
			team({ event: 11, focus: true }),
		])
		const read = readGuestPvpTeams()
		expect(read.map((row) => row.focus)).toEqual([true, false])
		expect(read[0].notes).toHaveLength(10)
	})

	it("reads an unknown version or junk as no teams", () => {
		localStorage.setItem(KEY, JSON.stringify({ version: 2, teams: [team()] }))
		expect(readGuestPvpTeams()).toEqual([])
		localStorage.setItem(KEY, "{not json")
		expect(readGuestPvpTeams()).toEqual([])
	})

	it("reports a write the browser refuses", () => {
		vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new Error("QuotaExceededError")
		})
		expect(writeGuestPvpTeams([team()])).toBe(false)
	})

	it("clears", () => {
		writeGuestPvpTeams([team()])
		clearGuestPvpTeams()
		expect(readGuestPvpTeams()).toEqual([])
	})
})
