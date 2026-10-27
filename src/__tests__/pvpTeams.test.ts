import { describe, expect, it } from "vitest"
import {
	cardBlockReason,
	placeholderName,
	placeholderOrder,
	clearMember,
	deckRequestId,
	deckToMemberCards,
	drawerTeam,
	firstOpenCardSlot,
	memberStyleFrom,
	recommendedIds,
	setCard,
	setMemberUma,
	setMemberVeteran,
	teamSkillSources,
	umaBlockReason,
	whiteSkillPairs,
} from "../utils/pvpTeams"
import type { PvpDeck, PvpGuide } from "../types/pvpGuide"
import type { PvpTeam, PvpTeamMember } from "../types/pvpTeam"
import type { RaceEvent } from "../types"

const OGURI = { id: 1, name: "Oguri Cap", character_id: 1006, running_style: 3 }
const OGURI_XMAS = { id: 2, name: "Oguri Cap (Christmas)", character_id: 1006, running_style: 3 }
const MARU = { id: 3, name: "Maruzensky", character_id: 1004, running_style: 1 }
const OPERA_O = { id: 4, name: "T.M. Opera O (New Year)", character_id: 1015, running_style: 1 }
const RICE = { id: 5, name: "Rice Shower (Halloween)", character_id: 1030, running_style: 3 }
const UMAS = new Map([OGURI, OGURI_XMAS, MARU, OPERA_O, RICE].map((uma) => [uma.id, uma]))

// The game's six Team Sirius umas. It files the card under Special Week only.
const SIRIUS = ["Mejiro McQueen", "Rice Shower", "Winning Ticket", "Narita Brian", "Silence Suzuka", "Special Week"]

// Two Agnes Tachyon cards with different titles, a third uma, two Team
// Sirius group cards, cards spelled unlike their umas ("TM Opera O" for
// "T.M. Opera O"), and a group card with no members listed (not on global
// yet, or an older API), named like an uma to show the name never counts.
const CARDS = new Map<number, { id: number; name: string; card_type: string; group_members?: string[]; placeholder?: boolean }>(
	[
		{ id: 302, name: "Agnes Tachyon", card_type: "wit" },
		{ id: 303, name: "Agnes Tachyon", card_type: "speed" },
		{ id: 304, name: "Kitasan Black", card_type: "speed" },
		{ id: 305, name: "Special Week", card_type: "guts" },
		{ id: 306, name: "Team Sirius", card_type: "group", group_members: SIRIUS },
		{ id: 307, name: "Team Sirius", card_type: "group", group_members: SIRIUS },
		{ id: 308, name: "Oguri Cap", card_type: "power" },
		{ id: 309, name: "TM Opera O", card_type: "stamina" },
		{ id: 310, name: "Maruzensky", card_type: "group" },
		// A placeholder whose name happens to be an uma's: still no clash.
		{ id: 311, name: "Your best SSR Speed card", card_type: "speed", placeholder: true },
		{ id: 312, name: "Maruzensky", card_type: "speed", placeholder: true },
	].map((card) => [card.id, card])
)
const LOOKUPS = { umasById: UMAS, cardsById: CARDS }

describe("pvpTeams", () => {
	it("starts a new member on the uma's own style and keeps the deck on a swap", () => {
		let members: PvpTeamMember[] = setMemberUma([], 1, OGURI)
		expect(members).toEqual([{ position: 1, uma: 1, style: "late", cards: [] }])
		members = setCard(members, 1, 6, 302)
		members = setMemberUma(members, 1, MARU)
		// The deck stays; a veteran would not (none was linked here).
		expect(members).toEqual([{ position: 1, uma: 3, style: "late", cards: [{ slot: 6, support_card: 302 }], trained_uma: null }])
		expect(clearMember(members, 1)).toEqual([])
	})

	it("drops the veteran when the uma changes, and keeps it when she stays", () => {
		let members = setMemberVeteran(setMemberUma([], 0, OGURI), 0, 7)
		expect(members[0].trained_uma).toBe(7)
		members = setMemberUma(members, 0, OGURI, "pace")
		expect(members[0].trained_uma).toBe(7)
		members = setMemberUma(members, 0, MARU)
		expect(members[0].trained_uma).toBeNull()
		expect(setMemberVeteran(members, 0, null)[0].trained_uma).toBeNull()
	})

	it("keeps members and cards sorted", () => {
		let members = setMemberUma(setMemberUma([], 2, OGURI), 0, MARU)
		expect(members.map((member) => member.position)).toEqual([0, 2])
		members = setCard(setCard(members, 0, 4, 10), 0, 1, 11)
		expect(members[0].cards.map((card) => card.slot)).toEqual([1, 4])
	})

	it("blocks the same uma and a second outfit, but not the place being replaced", () => {
		const members = setMemberUma([], 0, OGURI)
		expect(umaBlockReason(members, 1, OGURI, LOOKUPS)).toBe("Already on this team")
		expect(umaBlockReason(members, 1, OGURI_XMAS, LOOKUPS)).toBe("Oguri Cap is already on this team")
		expect(umaBlockReason(members, 0, OGURI_XMAS, LOOKUPS)).toBeNull()
		expect(umaBlockReason(members, 1, MARU, LOOKUPS)).toBeNull()
	})

	it("blocks swapping in an uma whose own card is in that spot's deck", () => {
		const members = setCard(setMemberUma([], 0, MARU), 0, 1, 308)
		expect(umaBlockReason(members, 0, OGURI_XMAS, LOOKUPS)).toBe("Oguri Cap's card is in this deck")
		// Only that spot's deck counts.
		expect(umaBlockReason(members, 1, OGURI_XMAS, LOOKUPS)).toBeNull()
	})

	it("blocks swapping in an uma whose group card is in that spot's deck", () => {
		const members = setCard(setMemberUma([], 0, MARU), 0, 1, 306)
		expect(umaBlockReason(members, 0, RICE, LOOKUPS)).toBe("Rice Shower is in Team Sirius")
		expect(umaBlockReason(members, 1, RICE, LOOKUPS)).toBeNull()
	})

	it("blocks a card already in the deck, borrow slot included", () => {
		const [member] = setCard(setMemberUma([], 0, MARU), 0, 1, 302)
		expect(cardBlockReason(member, 6, 302, LOOKUPS)).toBe("Already in this deck")
		expect(cardBlockReason(member, null, 302, LOOKUPS)).toBe("Already in this deck")
		expect(cardBlockReason(member, 1, 302, LOOKUPS)).toBeNull()
		expect(cardBlockReason(undefined, 1, 302, LOOKUPS)).toBeNull()
	})

	it("lets a placeholder stand in twice and never clash with an uma", () => {
		const [member] = setCard(setMemberUma([], 0, MARU), 0, 1, 311)
		expect(cardBlockReason(member, 2, 311, LOOKUPS)).toBeNull()
		expect(cardBlockReason(member, 6, 311, LOOKUPS)).toBeNull()
		// Named like the trainee and like a card in the deck: neither counts.
		expect(cardBlockReason(member, 2, 312, LOOKUPS)).toBeNull()
		const [withAgnes] = setCard([member], 0, 2, 302)
		expect(cardBlockReason(withAgnes, 3, 303, LOOKUPS)).toBe("Agnes Tachyon already has a card in this deck")
	})

	it("names a placeholder for what it stands in for, SSR first in order", () => {
		expect(placeholderName({ card_type: "speed", rarity: 3 })).toBe("Your best SSR Speed card")
		expect(placeholderName({ card_type: "friend", rarity: 1 })).toBe("Your best R Friend card")
		expect(placeholderName({ card_type: null, rarity: null })).toBe("Your best SSR card")
		const order = [
			{ card_type: "speed", rarity: 1 },
			{ card_type: "wit", rarity: 3 },
			{ card_type: "speed", rarity: 3 },
			{ card_type: "group", rarity: 2 },
		].sort((a, b) => placeholderOrder(a) - placeholderOrder(b))
		expect(order.map(placeholderName)).toEqual([
			"Your best SSR Speed card",
			"Your best SSR Wit card",
			"Your best SR Group card",
			"Your best R Speed card",
		])
	})

	it("blocks a second card of the same uma, borrow slot included, but not the card it replaces", () => {
		const [member] = setCard(setMemberUma([], 0, MARU), 0, 1, 302)
		expect(cardBlockReason(member, 2, 303, LOOKUPS)).toBe("Agnes Tachyon already has a card in this deck")
		expect(cardBlockReason(member, 6, 303, LOOKUPS)).toBe("Agnes Tachyon already has a card in this deck")
		expect(cardBlockReason(member, null, 303, LOOKUPS)).toBe("Agnes Tachyon already has a card in this deck")
		// Swapping one Agnes Tachyon card for the other in its own slot is fine.
		expect(cardBlockReason(member, 1, 303, LOOKUPS)).toBeNull()
		expect(cardBlockReason(member, 2, 304, LOOKUPS)).toBeNull()
	})

	it("counts a group card as a card of each of its umas", () => {
		const [withWeek] = setCard(setMemberUma([], 0, MARU), 0, 1, 305)
		// Team Sirius beside a Special Week card, the one the game files it under...
		expect(cardBlockReason(withWeek, 2, 306, LOOKUPS)).toBe("Special Week already has a card in this deck")
		// ...and a Special Week card beside Team Sirius, borrow slot included.
		const [withSirius] = setCard(setMemberUma([], 0, MARU), 0, 1, 306)
		expect(cardBlockReason(withSirius, 2, 305, LOOKUPS)).toBe("Special Week is in Team Sirius")
		expect(cardBlockReason(withSirius, 6, 305, LOOKUPS)).toBe("Special Week is in Team Sirius")
		// Two Team Sirius cards share all six umas.
		expect(cardBlockReason(withSirius, 2, 307, LOOKUPS)).toBe("Team Sirius already has a card in this deck")
		// The same group card twice is still the same card twice.
		expect(cardBlockReason(withSirius, 2, 306, LOOKUPS)).toBe("Already in this deck")
		// Swapping Team Sirius for the Special Week card in its own slot is fine.
		expect(cardBlockReason(withSirius, 1, 305, LOOKUPS)).toBeNull()
		expect(cardBlockReason(withSirius, 2, 304, LOOKUPS)).toBeNull()
	})

	it("lets a group card with no members listed block nothing but itself", () => {
		const [member] = setCard(setMemberUma([], 0, OGURI), 0, 1, 310)
		expect(cardBlockReason(member, 2, 306, LOOKUPS)).toBeNull()
		expect(cardBlockReason(member, 2, 310, LOOKUPS)).toBe("Already in this deck")
	})

	it("blocks a card of the uma training with the deck, in any outfit and spelling", () => {
		const [oguri] = setMemberUma([], 0, OGURI_XMAS)
		expect(cardBlockReason(oguri, 1, 308, LOOKUPS)).toBe("Oguri Cap can't support herself")
		expect(cardBlockReason(oguri, 6, 308, LOOKUPS)).toBe("Oguri Cap can't support herself")
		expect(cardBlockReason(oguri, 1, 304, LOOKUPS)).toBeNull()
		const [opera] = setMemberUma([], 0, OPERA_O)
		expect(cardBlockReason(opera, 1, 309, LOOKUPS)).toBe("TM Opera O can't support herself")
		// A group card can't support any of its umas, not just the one it is filed under.
		const [rice] = setMemberUma([], 0, RICE)
		expect(cardBlockReason(rice, 1, 306, LOOKUPS)).toBe("Rice Shower can't support herself")
		expect(cardBlockReason(rice, 6, 306, LOOKUPS)).toBe("Rice Shower can't support herself")
		// A group card's own name is not an uma: this one lists no members.
		const [maru] = setMemberUma([], 0, MARU)
		expect(cardBlockReason(maru, 1, 310, LOOKUPS)).toBeNull()
	})

	it("reads the guide's picks for a style, and front's for a runaway", () => {
		const card = (id: number) => ({ id, name: "", image: null, card_type: null, rarity: null })
		const guide = {
			uma_recommendations: [
				{ style: "front", stars: 5, role: "", note: "", uma: { id: 3, name: "", image: null } },
				{ style: "end", stars: 3, role: "", note: "", uma: { id: 1, name: "", image: null } },
			],
			decks: [
				{ id: 1, style: "front", label: "", note: "", slots: [{ slot: 1, order: 0, is_borrow: false, note: "", support_card: card(302) }] },
				{ id: 2, style: "end", label: "", note: "", slots: [{ slot: 1, order: 0, is_borrow: false, note: "", support_card: card(400) }] },
			],
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


describe("whiteSkillPairs", () => {
	const skill = (id: number, rarity: number, tier: number, group_id: number | null) => ({
		id, name: `Skill ${id}`, description: "", image: null, rarity, tier, group_id, cost: null,
	})

	it("pairs a group's ○ and ◎ whites, never its gold or its × penalty", () => {
		const pairs = whiteSkillPairs([
			skill(1, 1, 1, 20001), // Right-Handed ○
			skill(2, 1, 2, 20001), // Right-Handed ◎
			skill(3, 2, 3, 20001), // Right-Handed Demon (gold)
			skill(4, 1, -1, 20001), // Right-Handed ×
		])
		expect(pairs.get(1)).toEqual([1, 2])
		expect(pairs.get(2)).toEqual([1, 2])
		expect(pairs.has(3)).toBe(false)
		expect(pairs.has(4)).toBe(false)
	})

	it("leaves out a white with no second white: a ○ and its gold are two skills", () => {
		const pairs = whiteSkillPairs([
			skill(5, 1, 1, 20033), // Corner Adept ○
			skill(6, 2, 2, 20033), // Professor of Curvature (gold)
			skill(7, 1, 1, null),
		])
		expect(pairs.size).toBe(0)
	})
})

describe("deckToMemberCards", () => {
	const ref = (id: number, name: string) => ({ id, name, image: null, card_type: "speed", rarity: 3 })
	const deck = (rows: Array<{ slot: number; order?: number; borrow?: boolean; card?: [number, string]; note?: string }>): PvpDeck => ({
		id: 1,
		style: "pace",
		label: "Standard",
		note: "",
		is_highlighted: false,
		slots: rows.map((row) => ({
			slot: row.slot,
			order: row.order ?? 0,
			is_borrow: row.borrow ?? false,
			note: row.note ?? "",
			support_card: row.card ? ref(...row.card) : null,
		})),
	})
	const maru: PvpTeamMember = { position: 0, uma: MARU.id, style: "front", cards: [] }
	const out = () => ({ kind: "available" as const })

	it("puts the borrow card in slot 6 and the rest in 1 to 5, alternatives left out", () => {
		const fill = deckToMemberCards(
			deck([
				{ slot: 1, card: [304, "Kitasan Black"] },
				{ slot: 1, order: 1, card: [305, "Special Week"] },
				{ slot: 2, borrow: true, card: [302, "Agnes Tachyon"] },
				{ slot: 3, card: [309, "TM Opera O"] },
			]),
			maru,
			LOOKUPS,
			out
		)
		expect(fill.cards).toEqual([
			{ slot: 1, support_card: 304 },
			{ slot: 2, support_card: 309 },
			{ slot: 6, support_card: 302 },
		])
		expect(fill.skipped).toEqual([])
	})

	it("borrows the guide's slot 6 when no card is marked, and leaves a words-only slot open", () => {
		const fill = deckToMemberCards(
			deck([
				{ slot: 1, card: [304, "Kitasan Black"] },
				{ slot: 2, note: "Any Wit" },
				{ slot: 6, card: [302, "Agnes Tachyon"] },
			]),
			maru,
			LOOKUPS,
			out
		)
		expect(fill.cards).toEqual([{ slot: 1, support_card: 304 }, { slot: 6, support_card: 302 }])
		expect(fill.open).toEqual([{ slot: 2, note: "Any Wit" }])
	})

	it("skips what the team rules or the release date keep out, and says why", () => {
		const oguri: PvpTeamMember = { position: 1, uma: OGURI.id, style: "late", cards: [] }
		const fill = deckToMemberCards(
			deck([
				{ slot: 1, card: [308, "Oguri Cap"] },
				{ slot: 2, card: [302, "Agnes Tachyon"] },
				{ slot: 3, card: [303, "Agnes Tachyon"] },
				{ slot: 4, card: [304, "Kitasan Black"] },
				{ slot: 5, card: [999, "Unknown Card"] },
			]),
			oguri,
			LOOKUPS,
			(_pool, id) => (id === 304 ? { kind: "after", date: "2099/1/1" } : { kind: "available" })
		)
		expect(fill.cards).toEqual([{ slot: 2, support_card: 302 }])
		expect(fill.skipped).toEqual([
			{ name: "Oguri Cap", reason: "Oguri Cap can't support herself" },
			{ name: "Agnes Tachyon", reason: "Agnes Tachyon already has a card in this deck" },
			{ name: "Kitasan Black", reason: "Out 2099/1/1, after this event" },
			{ name: "Unknown Card", reason: "Not in the card list" },
		])
	})

	it("reads the handed-over deck from router state, and nothing else", () => {
		expect(deckRequestId({ useDeck: { deckId: 7 } })).toBe(7)
		expect(deckRequestId(null)).toBeNull()
		expect(deckRequestId({ useDeck: { deckId: "7" } })).toBeNull()
		expect(deckRequestId("x")).toBeNull()
	})
})
