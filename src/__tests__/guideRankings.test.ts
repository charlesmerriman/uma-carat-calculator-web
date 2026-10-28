import { describe, expect, it } from "vitest"
import type { RaceEvent } from "../types"
import type { PvpStyle } from "../types/pvpGuide"
import type { GuideRankingsPayload } from "../types/guideRankings"
import {
	NO_SCENARIO,
	allFilters,
	breakdown,
	countedGuides,
	eventsWithGuide,
	formatShare,
	hasUnsetScenario,
	rankCards,
	rankUmas,
	usageByEvent,
	type GuideFilters,
} from "../utils/guideRankings"

/**
 * Guide rankings' counting rules (utils/guideRankings.ts): the event window
 * and the sheet's tick boxes, a card's count (borrows in, alternatives out),
 * an uma's count (times recommended, not stars), and the shares.
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
const TRACKBLAZER = 12
const GRAND_LIVE = 2

const TYPES: Record<number, string> = { [KITASAN]: "speed", [FINE]: "wit", [LIGHT]: "friend" }
const typeOf = (card: number) => TYPES[card]
const STYLES: PvpStyle[] = ["runaway", "front", "pace", "late", "end"]
const CARD_TYPES = ["speed", "stamina", "power", "guts", "wit", "friend", "group"]

const PAYLOAD: GuideRankingsPayload = {
	generated_at: "2026-10-27T20:00:00Z",
	scenarios: [
		{ id: GRAND_LIVE, name: "Grand Live" },
		{ id: TRACKBLAZER, name: "Trackblazer" },
	],
	guides: [
		{
			kind: "cm",
			event: 20,
			scenario: GRAND_LIVE,
			cards: [{ card: LIGHT, deck: 200, style: "front", tier: "whale", role: "main" }],
			umas: [],
		},
		{
			kind: "cm",
			event: 21,
			scenario: TRACKBLAZER,
			cards: [
				{ card: KITASAN, deck: 210, style: "front", tier: "beginner", role: "main" },
				{ card: KITASAN, deck: 211, style: "front", tier: "whale", role: "main" },
				{ card: FINE, deck: 211, style: "front", tier: "whale", role: "borrow" },
				{ card: LIGHT, deck: 211, style: "front", tier: "whale", role: "alt" },
				{ card: FINE, deck: 212, style: "pace", tier: "honorable", role: "main" },
			],
			umas: [
				{ uma: MARU, style: "front", stars: 3 },
				{ uma: SUZUKA, style: "front", stars: 1 },
			],
		},
		{
			kind: "loh",
			event: 2,
			scenario: NO_SCENARIO,
			cards: [{ card: FINE, deck: 20, style: "end", tier: "other", role: "main" }],
			umas: [{ uma: SUZUKA, style: "end", stars: 2 }],
		},
		{
			kind: "cm",
			event: 22,
			scenario: TRACKBLAZER,
			cards: [{ card: KITASAN, deck: 220, style: "pace", tier: "standard", role: "main" }],
			umas: [{ uma: SUZUKA, style: "pace", stars: 1 }],
		},
	],
}

const ALL = allFilters(PAYLOAD, STYLES, CARD_TYPES)
const with_ = (changes: Partial<GuideFilters>): GuideFilters => ({ ...ALL, ...changes })

describe("allFilters", () => {
	it("ticks every box, Not set included", () => {
		expect([...ALL.scenarios]).toEqual([GRAND_LIVE, TRACKBLAZER, NO_SCENARIO])
		expect([...ALL.tiers]).toEqual(["beginner", "standard", "whale", "honorable", "other"])
		expect([...ALL.kinds]).toEqual(["cm", "loh"])
	})

	it("knows when a guide has no scenario", () => {
		expect(hasUnsetScenario(PAYLOAD)).toBe(true)
		expect(hasUnsetScenario({ ...PAYLOAD, guides: PAYLOAD.guides.slice(0, 2) })).toBe(false)
	})
})

describe("countedGuides", () => {
	const events = (guides: ReturnType<typeof countedGuides>) => guides.map((entry) => entry.event)

	it("counts every guide by default, in event order", () => {
		expect(events(countedGuides(EVENTS, PAYLOAD, ALL, { size: null }))).toEqual([CM20, CM21, LOH2, CM22])
	})

	it("takes the next N events with a guide from the picked one", () => {
		expect(events(countedGuides(EVENTS, PAYLOAD, ALL, { size: 2, from: CM21 }))).toEqual([CM21, LOH2])
	})

	it("windows over the events that pass the boxes", () => {
		const cmOnly = with_({ kinds: new Set(["cm"]) })
		expect(events(countedGuides(EVENTS, PAYLOAD, cmOnly, { size: 2, from: CM21 }))).toEqual([CM21, CM22])
	})

	it("filters by scenario, Not set being its own box", () => {
		expect(events(countedGuides(EVENTS, PAYLOAD, with_({ scenarios: new Set([NO_SCENARIO]) }), { size: null }))).toEqual([LOH2])
		expect(events(countedGuides(EVENTS, PAYLOAD, with_({ scenarios: new Set([TRACKBLAZER]) }), { size: null }))).toEqual([CM21, CM22])
	})

	it("is empty for an event the calendar doesn't list", () => {
		const unknown = event("cm", 99, "2027-01-01T00:00:00Z")
		expect(countedGuides(EVENTS, PAYLOAD, ALL, { size: 3, from: unknown })).toEqual([])
	})

	it("offers only the events with a guide in the picker", () => {
		expect(eventsWithGuide(EVENTS, PAYLOAD)).toEqual([CM20, CM21, LOH2, CM22])
	})
})

describe("rankCards", () => {
	const guides = countedGuides(EVENTS, PAYLOAD, ALL, { size: null })

	it("counts a deck once, borrows in, alternatives out", () => {
		const ranks = rankCards(guides, ALL, typeOf)
		expect(ranks.map((rank) => [rank.card, rank.decks])).toEqual([[KITASAN, 3], [FINE, 3], [LIGHT, 1]])
		const fine = ranks.find((rank) => rank.card === FINE)!
		expect(fine.borrows).toBe(1)
		const light = ranks.find((rank) => rank.card === LIGHT)!
		expect(light.alternatives).toBe(1)
	})

	it("breaks a tie on more events", () => {
		// Kitasan: 3 decks over CM21 and CM22; Fine: 3 decks over CM21 and LoH2. Same, so first seen stays first.
		const ranks = rankCards(guides, ALL, typeOf)
		expect(ranks[0].events).toEqual([CM21, CM22])
	})

	it("shares over every deck counted, whatever the card type", () => {
		// Six decks: 200, 210, 211, 212, 20, 220.
		const ranks = rankCards(guides, with_({ cardTypes: new Set(["speed"]) }), typeOf)
		expect(ranks.map((rank) => rank.card)).toEqual([KITASAN])
		expect(ranks[0].share).toBeCloseTo(3 / 6)
	})

	it("filters by tier and style", () => {
		const whales = rankCards(guides, with_({ tiers: new Set(["whale"]) }), typeOf)
		expect(whales.map((rank) => [rank.card, rank.decks])).toEqual([[LIGHT, 1], [KITASAN, 1], [FINE, 1]])
		const pace = rankCards(guides, with_({ styles: new Set(["pace"]) }), typeOf)
		expect(pace.map((rank) => [rank.card, rank.decks])).toEqual([[FINE, 1], [KITASAN, 1]])
	})

	it("drops a card the catalogue doesn't list, and an alternative alone", () => {
		expect(rankCards(guides, ALL, (card) => (card === LIGHT ? undefined : TYPES[card])).map((rank) => rank.card)).toEqual([KITASAN, FINE])
		const cm21 = countedGuides(EVENTS, PAYLOAD, ALL, { size: 1, from: CM21 })
		expect(rankCards(cm21, ALL, typeOf).map((rank) => rank.card)).not.toContain(LIGHT)
	})
})

describe("rankUmas", () => {
	const guides = countedGuides(EVENTS, PAYLOAD, ALL, { size: null })

	it("counts times recommended, never stars", () => {
		const ranks = rankUmas(guides, ALL)
		expect(ranks.map((rank) => [rank.uma, rank.picks])).toEqual([[SUZUKA, 3], [MARU, 1]])
	})

	it("shares over every guide and style counted", () => {
		// Sections: CM21 front, LoH2 end, CM22 pace.
		const [suzuka, maru] = rankUmas(guides, ALL)
		expect(suzuka.share).toBeCloseTo(1)
		expect(maru.share).toBeCloseTo(1 / 3)
	})

	it("filters by style", () => {
		expect(rankUmas(guides, with_({ styles: new Set(["end"]) })).map((rank) => rank.uma)).toEqual([SUZUKA])
	})
})

describe("breakdown", () => {
	it("splits a card's count by event, leaving alternatives out", () => {
		const guides = countedGuides(EVENTS, PAYLOAD, ALL, { size: null })
		const light = rankCards(guides, ALL, typeOf).find((rank) => rank.card === LIGHT)!
		expect(breakdown(light.appearances, (appearance) => appearance.event)).toEqual([[CM20, 1]])
	})
})

describe("usageByEvent", () => {
	it("reads every counted event in order, zeros where unused, alternatives out", () => {
		const appearances = [
			{ event: CM20, style: "pace" as const, tier: "standard" as const, role: "main" as const },
			{ event: CM20, style: "pace" as const, tier: "whale" as const, role: "borrow" as const },
			{ event: CM22, style: "end" as const, tier: "whale" as const, role: "main" as const },
			{ event: CM22, style: "end" as const, tier: "beginner" as const, role: "alt" as const },
		]
		expect(usageByEvent(appearances, [CM20, CM21, CM22])).toEqual([2, 0, 1])
		// The window decides the span.
		expect(usageByEvent(appearances, [CM21, CM22])).toEqual([0, 1])
	})
})

describe("formatShare", () => {
	it("rounds to a whole percent and never shows a used card as 0%", () => {
		expect(formatShare(0.294)).toBe("29%")
		expect(formatShare(0.001)).toBe("<1%")
		expect(formatShare(0)).toBe("0%")
	})
})
