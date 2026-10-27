import { describe, expect, it } from "vitest"
import type { RaceEvent } from "../types"
import type { PvpRankingsPayload } from "../types/pvpRankings"
import { DEFAULT_TIERS, breakdown, rankCards, rankingEvents, rankUmas } from "../utils/pvpRankings"

/**
 * The Rankings view's counting rules (utils/pvpRankings.ts): which events,
 * what a card's count is, borrows in and alternatives out, the tiers, and an
 * uma's stars.
 */

const event = (kind: "cm" | "loh", id: number, start: string): RaceEvent =>
	({
		id,
		event_type: kind === "cm" ? "champions_meeting" : "league_of_heroes",
		name: `${kind} ${id}`,
		cm_number: id,
		loh_number: id,
		start_date: start,
		end_date: start,
	}) as unknown as RaceEvent

const CM20 = event("cm", 20, "2026-10-01T00:00:00Z")
const CM21 = event("cm", 21, "2026-10-28T00:00:00Z")
const LOH2 = event("loh", 2, "2026-11-10T00:00:00Z")
const CM22 = event("cm", 22, "2026-11-23T00:00:00Z")
const CM23 = event("cm", 23, "2026-12-20T00:00:00Z")
const EVENTS = [CM20, CM21, LOH2, CM22, CM23]

const KITASAN = 1
const FINE = 2
const LIGHT = 3
const MARU = 41
const SUZUKA = 42

const PAYLOAD: PvpRankingsPayload = {
	guides: [
		{ kind: "cm", event: 20, cards: [{ card: LIGHT, style: "front", deck: "Whale", tier: "whale", role: "main" }], umas: [] },
		{
			kind: "cm",
			event: 21,
			cards: [
				{ card: KITASAN, style: "front", deck: "Beginner", tier: "beginner", role: "main" },
				{ card: KITASAN, style: "front", deck: "Whale", tier: "whale", role: "main" },
				{ card: FINE, style: "front", deck: "Whale", tier: "whale", role: "borrow" },
				{ card: LIGHT, style: "front", deck: "Whale", tier: "whale", role: "alt" },
				{ card: FINE, style: "pace", deck: "Honorable mention", tier: "other", role: "main" },
			],
			umas: [
				{ uma: MARU, style: "front", stars: 3 },
				{ uma: SUZUKA, style: "front", stars: 1 },
			],
		},
		{
			kind: "loh",
			event: 2,
			cards: [{ card: FINE, style: "end", deck: "Standard", tier: "standard", role: "main" }],
			umas: [{ uma: SUZUKA, style: "end", stars: 2 }],
		},
		{
			kind: "cm",
			event: 23,
			cards: [{ card: KITASAN, style: "pace", deck: "Standard", tier: "standard", role: "main" }],
			umas: [{ uma: MARU, style: "pace", stars: 1 }],
		},
	],
}

const ALL = { kind: null, eventCount: null }
const filters = { style: null, tiers: DEFAULT_TIERS }

describe("rankingEvents", () => {
	it("counts from the event on screen, only events with a guide, up to the count", () => {
		expect(rankingEvents(EVENTS, CM21, PAYLOAD, ALL)).toEqual([CM21, LOH2, CM23])
		expect(rankingEvents(EVENTS, CM21, PAYLOAD, { kind: null, eventCount: 2 })).toEqual([CM21, LOH2])
		expect(rankingEvents(EVENTS, CM21, PAYLOAD, { kind: "cm", eventCount: null })).toEqual([CM21, CM23])
		// From a past event, the past counts too.
		expect(rankingEvents(EVENTS, CM20, PAYLOAD, { kind: null, eventCount: 1 })).toEqual([CM20])
	})
})

describe("rankCards", () => {
	const events = rankingEvents(EVENTS, CM21, PAYLOAD, ALL)

	it("counts decks, borrows included and alternatives not, most first", () => {
		const ranks = rankCards(PAYLOAD, events, filters)
		expect(ranks.map((rank) => [rank.card, rank.decks, rank.borrows, rank.alternatives, rank.events.length])).toEqual([
			[KITASAN, 3, 0, 0, 2],
			[FINE, 2, 1, 0, 2],
		])
		// Light Hello is only an alternative here: listed nowhere.
		expect(ranks.find((rank) => rank.card === LIGHT)).toBeUndefined()
	})

	it("keeps an alternative on the card it names when that card counts", () => {
		const withLight: PvpRankingsPayload = {
			guides: [...PAYLOAD.guides, { kind: "cm", event: 22, cards: [{ card: LIGHT, style: "late", deck: "Beginner", tier: "beginner", role: "main" }], umas: [] }],
		}
		const light = rankCards(withLight, rankingEvents(EVENTS, CM21, withLight, ALL), filters).find((rank) => rank.card === LIGHT)
		expect([light?.decks, light?.alternatives]).toEqual([1, 1])
	})

	it("leaves other decks out until asked, and filters by style and by the catalogue", () => {
		const withOther = rankCards(PAYLOAD, events, { style: null, tiers: new Set([...DEFAULT_TIERS, "other"]) })
		expect(withOther.find((rank) => rank.card === FINE)?.decks).toBe(3)
		expect(rankCards(PAYLOAD, events, { style: "pace", tiers: DEFAULT_TIERS }).map((rank) => rank.card)).toEqual([KITASAN])
		expect(rankCards(PAYLOAD, events, filters, (card) => card !== KITASAN).map((rank) => rank.card)).toEqual([FINE])
	})
})

describe("rankUmas", () => {
	it("adds the stars up over the events, with the best and the event count", () => {
		const ranks = rankUmas(PAYLOAD, rankingEvents(EVENTS, CM21, PAYLOAD, ALL), { style: null })
		expect(ranks.map((rank) => [rank.uma, rank.stars, rank.best, rank.events.length])).toEqual([
			[MARU, 4, 3, 2],
			[SUZUKA, 3, 2, 2],
		])
		expect(rankUmas(PAYLOAD, [CM21], { style: "front" }, (uma) => uma !== MARU).map((rank) => rank.uma)).toEqual([SUZUKA])
	})
})

describe("breakdown", () => {
	it("splits a card's decks by event and tier, alternatives left out, and an uma's stars by style", () => {
		const events = rankingEvents(EVENTS, CM21, PAYLOAD, ALL)
		const withLight: PvpRankingsPayload = {
			guides: [...PAYLOAD.guides, { kind: "cm", event: 22, cards: [{ card: LIGHT, style: "late", deck: "Beginner", tier: "beginner", role: "main" }], umas: [] }],
		}
		const kitasan = rankCards(PAYLOAD, events, filters).find((rank) => rank.card === KITASAN)!
		expect(breakdown(kitasan.appearances, (row) => row.event)).toEqual([[CM21, 2], [CM23, 1]])
		expect(breakdown(kitasan.appearances, (row) => row.tier)).toEqual([["beginner", 1], ["whale", 1], ["standard", 1]])
		const light = rankCards(withLight, rankingEvents(EVENTS, CM21, withLight, ALL), filters).find((rank) => rank.card === LIGHT)!
		expect(breakdown(light.appearances, (row) => row.event)).toEqual([[CM22, 1]])
		const maru = rankUmas(PAYLOAD, events, { style: null }).find((rank) => rank.uma === MARU)!
		expect(breakdown(maru.appearances, (row) => row.style)).toEqual([["front", 3], ["pace", 1]])
	})
})
