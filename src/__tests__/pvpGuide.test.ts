import { describe, expect, it } from "vitest"
import {
	guidePicks,
	guideSkillsByCategory,
	defaultPvpEvent,
	groupSkillsByTier,
	milestones,
	newCardsBetween,
	previousPvpEvent,
	raceEventsInOrder,
	skillsForPosition,
	stylesWithContent,
} from "../utils/pvpGuide"
import { splitHighlights, splitNoteText } from "../utils/remarkHighlight"
import { DEFAULT_CONSTANTS } from "../constants/gameConstants"
import type { BannerSupport, BannerUma, RaceEvent } from "../types"
import type { PvpGuide, PvpSkillRecommendation } from "../types/pvpGuide"

const cm = (id: number, start: string, end: string): RaceEvent =>
	({ id, name: `CM ${id}`, event_type: "champions_meeting", start_date: start, end_date: end }) as RaceEvent
const loh = (id: number, start: string, end: string): RaceEvent =>
	({ id, name: `LoH ${id}`, event_type: "league_of_heroes", start_date: start, end_date: end }) as RaceEvent

// A calendar: Libra (CM 19) runs Nov 1 to 8, LoH 4 from Nov 20, Virgo ended Oct 20.
const VIRGO = cm(17, "2026-10-12T00:00:00Z", "2026-10-20T00:00:00Z")
const LIBRA = cm(19, "2026-11-01T00:00:00Z", "2026-11-08T00:00:00Z")
const LOH4 = loh(4, "2026-11-20T00:00:00Z", "2026-11-27T00:00:00Z")
const EVENTS = raceEventsInOrder([LIBRA, VIRGO], [LOH4])

describe("raceEventsInOrder / defaultPvpEvent / previousPvpEvent", () => {
	it("merges both kinds by start date", () => {
		expect(EVENTS.map((event) => event.name)).toEqual(["CM 17", "CM 19", "LoH 4"])
	})

	it("opens on the running event", () => {
		expect(defaultPvpEvent(EVENTS, new Date("2026-11-02T00:00:00Z"))).toBe(LIBRA)
	})

	it("else on the next to start", () => {
		expect(defaultPvpEvent(EVENTS, new Date("2026-11-10T00:00:00Z"))).toBe(LOH4)
	})

	it("else on the most recent once everything is over", () => {
		expect(defaultPvpEvent(EVENTS, new Date("2027-01-01T00:00:00Z"))).toBe(LOH4)
		expect(defaultPvpEvent([], new Date())).toBeNull()
	})

	it("finds the previous event across kinds", () => {
		expect(previousPvpEvent(EVENTS, LOH4)).toBe(LIBRA)
		expect(previousPvpEvent(EVENTS, VIRGO)).toBeNull()
	})
})

describe("newCardsBetween", () => {
	const banner = (start: string, ids: number[]) =>
		({
			banner_timeline: { start_date: start },
			umas: ids.map((id) => ({ id, name: `Uma ${id}` })),
			support_cards: ids.map((id) => ({ id, name: `Card ${id}` })),
		}) as unknown as BannerUma & BannerSupport

	it("counts a card by its FIRST banner, from the previous start up to this one", () => {
		const banners = [
			banner("2026-10-01T00:00:00Z", [1]), // before Virgo: old
			banner("2026-10-12T00:00:00Z", [2]), // on Virgo's start: new (inclusive)
			banner("2026-10-25T00:00:00Z", [3, 1]), // 1 is a rerun: still old
			banner("2026-11-01T00:00:00Z", [4]), // on Libra's start: next window
		]
		const cards = newCardsBetween(VIRGO.start_date, LIBRA.start_date, banners, banners)
		expect(cards.umas.map((uma) => uma.id)).toEqual([2, 3])
		expect(cards.supports.map((card) => card.id)).toEqual([2, 3])
	})
})

describe("milestones", () => {
	it("adds the CM hour offsets to the start date", () => {
		const dates = milestones(LIBRA, DEFAULT_CONSTANTS)
		expect(dates.map((m) => m.label)).toEqual([
			"Registration opens",
			"Round 1",
			"Round 2",
			"Finals registration closes",
			"Finals",
		])
		expect(dates[0].date).toBe("2026-10-29T00:00:00.000Z") // -72h
		expect(dates[3].date).toBe("2026-11-05T12:00:00.000Z") // +108h
	})

	it("shows only round 1 for a League of Heroes with no schedule yet", () => {
		expect(milestones(LOH4, DEFAULT_CONSTANTS).map((m) => m.label)).toEqual(["Round 1"])
		const known = { ...DEFAULT_CONSTANTS, loh_finals_hours: 96 }
		expect(milestones(LOH4, known).map((m) => m.label)).toEqual(["Round 1", "Finals"])
	})
})

describe("guide grouping", () => {
	const skill = (style: string, tier: number | null): PvpSkillRecommendation =>
		({ style, tier, category: "other", order: 0, note: "", skill: { id: Math.random() } }) as unknown as PvpSkillRecommendation

	it("groups consecutive rows by tier", () => {
		const groups = groupSkillsByTier([skill("front", 0), skill("front", 0), skill("front", 2), skill("front", null)])
		expect(groups.map((group) => [group.tier, group.skills.length])).toEqual([[0, 2], [2, 1], [null, 1]])
	})

	it("lists the styles a guide covers, never 'everyone', in display order", () => {
		const guide = {
			uma_recommendations: [{ style: "end" }],
			style_notes: [{ style: "front" }],
			decks: [],
			honorable_mentions: [{ style: "runaway" }],
			skill_recommendations: [skill("everyone", 1)],
		} as unknown as PvpGuide
		expect(stylesWithContent(guide)).toEqual(["runaway", "front", "end"])
	})
})

describe("splitHighlights", () => {
	it("splits ==words== out of a note", () => {
		expect(splitHighlights("Stats + ==FCM==!")).toEqual([
			{ text: "Stats + ", highlighted: false },
			{ text: "FCM", highlighted: true },
			{ text: "!", highlighted: false },
		])
		expect(splitHighlights("a = b == c")).toEqual([{ text: "a = b == c", highlighted: false }])
	})
})

describe("splitNoteText", () => {
	it("finds mentions on their own and inside a highlight", () => {
		expect(splitNoteText("Take [[Groundwork]], ==then [[Final Push]]==")).toEqual([
			{ kind: "text", text: "Take " },
			{ kind: "skill", name: "Groundwork" },
			{ kind: "text", text: ", " },
			{ kind: "highlight", pieces: [{ kind: "text", text: "then " }, { kind: "skill", name: "Final Push" }] },
		])
	})
})

describe("skillsForPosition", () => {
	const row = (style: string, tier: number | null, order: number, id: number) =>
		({ style, tier, order, category: "other", note: "", skill: { id } }) as unknown as PvpSkillRecommendation

	it("merges the position's picks with the general ones: by tier, own picks first", () => {
		const rows = [
			row("everyone", 0, 0, 1),
			row("front", 1, 0, 2),
			row("front", 0, 1, 3),
			row("pace", 0, 0, 4),
			row("everyone", null, 0, 5),
			row("front", null, 0, 6),
		]
		expect(skillsForPosition(rows, "front").map((r) => r.skill.id)).toEqual([3, 1, 2, 6, 5])
		expect(skillsForPosition(rows, "pace").map((r) => r.skill.id)).toEqual([4, 1, 5])
	})
})

describe("guidePicks", () => {
	const card = (id: number) => ({ id, name: `Card ${id}`, image: null, card_type: "speed", rarity: 3 })
	const uma = (id: number) => ({ id, name: `Uma ${id}`, image: null })
	const slot = (id: number | null, note = "") => ({ slot: 1, order: 0, is_borrow: false, note, support_card: id ? card(id) : null })
	const guide = {
		uma_recommendations: [
			{ style: "pace", stars: 2, role: "", note: "", uma: uma(41) },
			{ style: "end", stars: 3, role: "", note: "", uma: uma(42) },
			{ style: "front", stars: 5, role: "", note: "Use as runaway", uma: uma(41) },
		],
		decks: [
			{ id: 1, style: "front", label: "Beginner", note: "", slots: [slot(302), slot(null, "Any Wit")] },
			{ id: 2, style: "late", label: "Standard", note: "", slots: [slot(302, "Gold + Link"), slot(303)] },
		],
		honorable_mentions: [
			{ style: "front", note: "Stats", support_card: card(303) },
			{ style: "late", note: "", support_card: card(304) },
		],
	} as unknown as PvpGuide

	it("lists each uma once, with her best stars and every style, best first", () => {
		const { umas } = guidePicks(guide)
		expect(umas.map((pick) => [pick.ref.id, pick.stars, pick.styles, pick.notes])).toEqual([
			[41, 5, ["front", "pace"], ["Use as runaway"]],
			[42, 3, ["end"], []],
		])
	})

	it("lists each card once, deck cards before mentions", () => {
		const { cards } = guidePicks(guide)
		expect(cards.map((pick) => [pick.ref.id, pick.inDeck, pick.styles, pick.notes])).toEqual([
			[302, true, ["front", "late"], ["Gold + Link"]],
			[303, true, ["front", "late"], ["Stats"]],
			[304, false, ["late"], []],
		])
	})
})

describe("guideSkillsByCategory", () => {
	const skill = (id: number) => ({ id, name: `Skill ${id}`, description: "", image: null, rarity: 1, unique_of: null })
	const row = (id: number, style: string, category: string, tier: number | null, note = "") =>
		({ style, category, tier, order: 0, note, skill: skill(id) })
	const guide = {
		skill_recommendations: [
			row(1, "front", "speed", 2),
			row(2, "end", "acceleration", null),
			row(1, "everyone", "acceleration", 1, "Take early"),
			row(3, "pace", "acceleration", 0),
			row(4, "late", "debuff", null),
		],
	} as unknown as PvpGuide

	it("lists each skill once, in its first category, best tier first", () => {
		const groups = guideSkillsByCategory(guide)
		expect(groups.map((group) => group.category)).toEqual(["acceleration", "debuff"])
		expect(groups[0].skills.map((pick) => [pick.skill.id, pick.tier, pick.styles, pick.notes])).toEqual([
			[3, 0, ["pace"], []],
			[1, 1, ["everyone", "front"], ["Take early"]],
			[2, null, ["end"], []],
		])
	})
})
