import { describe, expect, it } from "vitest"
import {
	cardBlockReason,
	clearMember,
	drawerTeam,
	favouriteCheck,
	firstOpenCardSlot,
	memberStyleFrom,
	recommendedIds,
	setCard,
	setMemberUma,
	teamSkillSources,
	umaBlockReason,
} from "../utils/pvpTeams"
import type { PvpGuide } from "../types/pvpGuide"
import type { PvpTeam, PvpTeamMember } from "../types/pvpTeam"
import type { RaceEvent } from "../types"

const OGURI = { id: 1, name: "Oguri Cap", character_id: 1006, running_style: 3 }
const OGURI_XMAS = { id: 2, name: "Oguri Cap (Christmas)", character_id: 1006, running_style: 3 }
const MARU = { id: 3, name: "Maruzensky", character_id: 1004, running_style: 1 }
const UMAS = new Map([OGURI, OGURI_XMAS, MARU].map((uma) => [uma.id, uma]))

describe("pvpTeams", () => {
	it("starts a new member on the uma's own style and keeps the deck on a swap", () => {
		let members: PvpTeamMember[] = setMemberUma([], 1, OGURI)
		expect(members).toEqual([{ position: 1, uma: 1, style: "late", cards: [] }])
		members = setCard(members, 1, 6, 302)
		members = setMemberUma(members, 1, MARU)
		expect(members).toEqual([{ position: 1, uma: 3, style: "late", cards: [{ slot: 6, support_card: 302 }] }])
		expect(clearMember(members, 1)).toEqual([])
	})

	it("keeps members and cards sorted", () => {
		let members = setMemberUma(setMemberUma([], 2, OGURI), 0, MARU)
		expect(members.map((member) => member.position)).toEqual([0, 2])
		members = setCard(setCard(members, 0, 4, 10), 0, 1, 11)
		expect(members[0].cards.map((card) => card.slot)).toEqual([1, 4])
	})

	it("blocks the same uma and a second outfit, but not the place being replaced", () => {
		const members = setMemberUma([], 0, OGURI)
		expect(umaBlockReason(members, 1, OGURI, UMAS)).toBe("Already on this team")
		expect(umaBlockReason(members, 1, OGURI_XMAS, UMAS)).toBe("Oguri Cap is already on this team")
		expect(umaBlockReason(members, 0, OGURI_XMAS, UMAS)).toBeNull()
		expect(umaBlockReason(members, 1, MARU, UMAS)).toBeNull()
	})

	it("blocks a card already in the deck, borrow slot included", () => {
		const [member] = setCard(setMemberUma([], 0, MARU), 0, 1, 302)
		expect(cardBlockReason(member, 6, 302)).toBe("Already in this deck")
		expect(cardBlockReason(member, 1, 302)).toBeNull()
		expect(cardBlockReason(undefined, 1, 302)).toBeNull()
	})

	it("reads the guide's picks for a style, and front's for a runaway", () => {
		const card = (id: number) => ({ id, name: "", image: null, card_type: null, rarity: null })
		const guide = {
			uma_recommendations: [
				{ style: "front", stars: 5, role: "", note: "", uma: { id: 3, name: "", image: null } },
				{ style: "end", stars: 3, role: "", note: "", uma: { id: 1, name: "", image: null } },
			],
			decks: [{ id: 1, style: "front", label: "", note: "", slots: [{ slot: 1, order: 0, is_borrow: false, note: "", support_card: card(302) }] }],
			honorable_mentions: [{ style: "end", note: "", support_card: card(400) }],
		} as unknown as PvpGuide
		expect([...recommendedIds(guide, "runaway").umas]).toEqual([3])
		expect([...recommendedIds(guide, "front").cards]).toEqual([302])
		expect([...recommendedIds(guide, "end").cards]).toEqual([400])
		expect(recommendedIds(null, "end").umas.size).toBe(0)
	})

	it("finds the first open owned slot, never the borrow slot", () => {
		let members: PvpTeamMember[] = setCard(setCard(setMemberUma([], 0, MARU), 0, 1, 10), 0, 3, 11)
		expect(firstOpenCardSlot(members[0])).toBe(2)
		for (const slot of [2, 4, 5]) members = setCard(members, 0, slot, 20 + slot)
		members = setCard(members, 0, 6, 30)
		expect(firstOpenCardSlot(members[0])).toBeNull()
	})

	it("picks a style a member can run from a guide pick's styles", () => {
		expect(memberStyleFrom(["everyone", "pace", "front"])).toBe("front")
		expect(memberStyleFrom(["everyone"])).toBeUndefined()
	})

	it("lists every skill the team can get, and where from", () => {
		const umas = new Map([[3, { name: "Maruzensky", skills: [{ skill: 1, source: "unique" }] }]])
		const cards = new Map([
			[302, { name: "Kitasan Black", skills: [{ skill: 2, source: "hint" }, { skill: 1, source: "event" }] }],
		])
		const members = setCard(setCard(setMemberUma([], 0, MARU), 0, 1, 302), 0, 6, 302)
		const sources = teamSkillSources(members, umas, cards)
		expect(sources.get(1)).toEqual(["Maruzensky (unique)", "Kitasan Black (event)"])
		expect(sources.get(2)).toEqual(["Kitasan Black (hint)"])
		expect(sources.has(3)).toBe(false)
	})
})

/**
 * The plan's worked example (R2b "Which team it shows"): today 2026-11-02,
 * Libra Cup (CM) running Nov 1 to Nov 8, LoH #4 from Nov 20, Virgo Cup
 * ended Oct 20.
 */
describe("drawerTeam", () => {
	const race = (id: number, event_type: string, name: string, start: string, end: string) =>
		({ id, event_type, name, start_date: start, end_date: end }) as unknown as RaceEvent
	const VIRGO = race(5, "champions_meeting", "Virgo Cup", "2026-10-13T00:00:00Z", "2026-10-20T00:00:00Z")
	const LIBRA = race(19, "champions_meeting", "Libra Cup", "2026-11-01T00:00:00Z", "2026-11-08T00:00:00Z")
	const LOH4 = race(4, "league_of_heroes", "League of Heroes 4", "2026-11-20T00:00:00Z", "2026-11-27T00:00:00Z")
	const EVENTS = [VIRGO, LIBRA, LOH4]
	const NOW = new Date("2026-11-02T12:00:00Z")
	const team = (key: string, kind: "cm" | "loh", event: number, extra: Partial<PvpTeam> = {}): PvpTeam => ({
		key, id: null, kind, event, name: key, isFocus: false, notes: [], members: [], updatedAt: 0, ...extra,
	})
	const libra1 = team("Libra Team 1", "cm", 19, { updatedAt: Date.parse("2026-10-30T00:00:00Z") })
	const lohDraft = team("LoH Draft", "loh", 4)

	it("prefers the running event over an upcoming one", () => {
		const choice = drawerTeam([libra1, lohDraft], EVENTS, NOW)
		expect(choice).toMatchObject({ kind: "team", team: { key: "Libra Team 1" }, event: LIBRA, pinned: false })
	})

	it("shows the pin first", () => {
		const choice = drawerTeam([libra1, { ...lohDraft, isFocus: true }], EVENTS, NOW)
		expect(choice).toMatchObject({ kind: "team", team: { key: "LoH Draft" }, event: LOH4, pinned: true })
	})

	it("ignores a pin on an event that has ended", () => {
		const choice = drawerTeam([team("Virgo Team 1", "cm", 5, { isFocus: true })], EVENTS, NOW)
		expect(choice).toEqual({ kind: "none", event: LIBRA })
	})

	it("takes the newer edit of two teams for one event", () => {
		const libra2 = team("Libra Team 2", "cm", 19, { updatedAt: Date.parse("2026-11-01T00:00:00Z") })
		expect(drawerTeam([libra1, libra2], EVENTS, NOW)).toMatchObject({ team: { key: "Libra Team 2" } })
	})

	it("says so when nothing is running or coming up", () => {
		expect(drawerTeam([libra1], [VIRGO], NOW)).toEqual({ kind: "no-events" })
		expect(drawerTeam([], [], NOW)).toEqual({ kind: "no-events" })
	})
})

describe("favouriteCheck", () => {
	it("frames every outfit of a favourite's character, and only those", () => {
		const isFavourite = favouriteCheck([OGURI.id], UMAS)
		expect(isFavourite(OGURI.id)).toBe(true)
		expect(isFavourite(OGURI_XMAS.id)).toBe(true)
		expect(isFavourite(MARU.id)).toBe(false)
		expect(favouriteCheck([], UMAS)(OGURI.id)).toBe(false)
	})

	it("works from a costume too: a favourite outfit frames the original and every other outfit", () => {
		const isFavourite = favouriteCheck([OGURI_XMAS.id], UMAS)
		expect(isFavourite(OGURI.id)).toBe(true)
		expect(isFavourite(OGURI_XMAS.id)).toBe(true)
		expect(isFavourite(MARU.id)).toBe(false)
	})

	it("matches by id when the catalogue has no character for an uma", () => {
		expect(favouriteCheck([99], new Map())(99)).toBe(true)
	})
})
