import { describe, expect, it } from "vitest"
import {
	guidePicks,
	guideSkillsByCategory,
	skillPositions,
	defaultPvpEvent,
	groupSkillsByTier,
	milestones,
	newCardsBetween,
	previousPvpEvent,
	raceEventsInOrder,
	skillsForPosition,
	stylesWithContent,
	familySources,
	skillFamilyIds,
	skillColour,
	parsePvpStyle,
	parseStyleRanking,
	parseTeamComp,
	guideUmaAptitudes,
	isAptitudeOnlyRole,
	pickStyle,
	styleColor,
	styleForWord,
	styleRanks,
	styleTabs,
	stylesByRank,
	tierLabel,
	packStarRows,
	layoutStarRows,
	topTierSkills,
	topUmas,
	umasByStars,
} from "../utils/pvpGuide"
import { plainNoteText, splitHighlights, splitNoteText } from "../utils/remarkHighlight"
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
			decks: [{ style: "runaway" }],
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
	const flagged = (note: string) =>
		splitNoteText(note).flatMap((piece) => (piece.kind === "highlight" ? piece.pieces : [piece]))
			.filter((piece) => piece.kind === "skill" && piece.scenarioLink)
			.map((piece) => (piece.kind === "skill" ? piece.name : ""))

	it("flags a skill followed by '& Scenario Link', in each way the guides write it", () => {
		expect(flagged("==[[See Ya Later!]] & Scenario Link==")).toEqual(["See Ya Later!"])
		expect(flagged("[[See Ya Later!]] ==& Scenario Link==")).toEqual(["See Ya Later!"])
		expect(flagged("==[[Unstoppable]] & 2SP & Scenario Link==")).toEqual(["Unstoppable"])
	})

	it("leaves other '&' notes and other skills alone", () => {
		expect(flagged("[[Sharp Streak]] ==& 1SP==")).toEqual([])
		expect(flagged("==Scenario Link==")).toEqual([])
		expect(flagged("[[Groundwork]] then [[See Ya Later!]] & Scenario Link")).toEqual(["See Ya Later!"])
	})
})

describe("skillsForPosition", () => {
	const row = (style: string, tier: number | null, order: number, id: number) =>
		({ style, tier, order, category: "other", note: "", skill: { id } }) as unknown as PvpSkillRecommendation

	it("keeps one style's own rows, by tier then order; the general ones only for 'everyone'", () => {
		const rows = [
			row("everyone", 0, 0, 1),
			row("front", 1, 0, 2),
			row("front", 0, 1, 3),
			row("pace", 0, 0, 4),
			row("everyone", null, 0, 5),
			row("front", null, 0, 6),
		]
		expect(skillsForPosition(rows, "front").map((r) => r.skill.id)).toEqual([3, 2, 6])
		expect(skillsForPosition(rows, "pace").map((r) => r.skill.id)).toEqual([4])
		expect(skillsForPosition(rows, "everyone").map((r) => r.skill.id)).toEqual([1, 5])
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
	} as unknown as PvpGuide

	it("lists each uma once, with her best stars and every style, best first", () => {
		const { umas } = guidePicks(guide)
		expect(umas.map((pick) => [pick.ref.id, pick.stars, pick.styles, pick.notes])).toEqual([
			[41, 5, ["front", "pace"], ["Use as runaway"]],
			[42, 3, ["end"], []],
		])
	})

	it("lists each deck card once, with every style it is filed under", () => {
		const { cards } = guidePicks(guide)
		expect(cards.map((pick) => [pick.ref.id, pick.styles, pick.notes])).toEqual([
			[302, ["front", "late"], ["Gold + Link"]],
			[303, ["late"], []],
		])
	})
})

describe("skill versions", () => {
	const gold = { id: 12, name: "Corner Adept ◎", description: "", image: null, rarity: 2, tier: 2, version: "◎ gold", is_evolved: false }
	const evolved = { id: 13, name: "Corner Virtuoso", description: "", image: null, rarity: 6, tier: 1, version: "evolved", is_evolved: true }
	const white = { id: 11, name: "Corner Adept ○", description: "", image: null, rarity: 1, unique_of: null, version: "○ white", tier: 1, is_evolved: false, versions: [gold, evolved] }
	const whiteVersion = { id: 11, name: "Corner Adept ○", description: "", image: null, rarity: 1, tier: 1, version: "○ white", is_evolved: false }
	const goldPick = { id: 12, name: "Corner Adept ◎", description: "", image: null, rarity: 2, unique_of: null, version: "◎ gold", tier: 2, is_evolved: false, versions: [whiteVersion, evolved] }
	const evolvedPick = { id: 13, name: "Corner Virtuoso", description: "", image: null, rarity: 6, unique_of: null, version: "evolved", tier: 1, is_evolved: true, versions: [whiteVersion, gold] }
	const lone = { id: 20, name: "Groundwork", description: "", image: null, rarity: 2, unique_of: null, version: "◎ gold", tier: 2, is_evolved: false, versions: [] }

	it("answers to its own id and its versions'", () => {
		expect(skillFamilyIds(white)).toEqual([11, 12, 13])
		expect(skillFamilyIds(lone)).toEqual([20])
	})

	it("a gold on the team covers a white pick, and says so", () => {
		const sources = new Map([[12, ["Kitasan Black (hint)"]]])
		expect(familySources(sources, white)).toEqual(["Kitasan Black (hint), as ◎ gold"])
		expect(familySources(new Map([[11, ["Special Week (own)"]]]), white)).toEqual(["Special Week (own)"])
		expect(familySources(new Map(), white)).toBeNull()
	})

	it("a white on the team does not cover a gold pick", () => {
		expect(familySources(new Map([[11, ["Special Week (own)"]]]), goldPick)).toBeNull()
		expect(familySources(new Map([[12, ["Kitasan Black (hint)"]]]), goldPick)).toEqual(["Kitasan Black (hint)"])
	})

	it("an evolved pick is covered by a base version, to evolve; no card teaches the evolved form", () => {
		expect(familySources(new Map([[11, ["Special Week (own)"]]]), evolvedPick)).toEqual(["Special Week (own), as ○ white (evolve it)"])
		expect(familySources(new Map([[13, ["Oguri Cap (evolution)"]]]), white)).toBeNull()
	})

	// A green skill's family: ○ and ◎ are both white (tiers 1 and 2), and the
	// gold above them is tier 3. Nothing teaches the ◎, and guides pick it.
	const single = { id: 31, name: "Right-Handed ○", description: "", image: null, rarity: 1, tier: 1, version: "○ white", is_evolved: false }
	const double = { id: 32, name: "Right-Handed ◎", description: "", image: null, rarity: 1, tier: 2, version: "◎ white", is_evolved: false }
	const demon = { id: 33, name: "Right-Handed Demon", description: "", image: null, rarity: 2, tier: 3, version: "◎ gold", is_evolved: false }
	const pickOf = (version: typeof single, others: (typeof single)[]) => ({ ...version, unique_of: null, versions: others })

	it("the ○ and ◎ of a white cover each other", () => {
		expect(familySources(new Map([[31, ["Kitasan Black (hint)"]]]), pickOf(double, [single, demon]))).toEqual(["Kitasan Black (hint), as ○ white"])
		expect(familySources(new Map([[32, ["Kitasan Black (hint)"]]]), pickOf(single, [double, demon]))).toEqual(["Kitasan Black (hint), as ◎ white"])
	})

	it("the gold above a ○/◎ pair covers both, and neither white covers it", () => {
		expect(familySources(new Map([[33, ["Oguri Cap (awakening)"]]]), pickOf(double, [single, demon]))).toEqual(["Oguri Cap (awakening), as ◎ gold"])
		expect(familySources(new Map([[31, ["Kitasan Black (hint)"]], [32, ["Fine Motion (hint)"]]]), pickOf(demon, [single, double]))).toBeNull()
	})
})

describe("guideSkillsByCategory", () => {
	const skill = (id: number) => ({ id, name: `Skill ${id}`, description: "", image: null, rarity: 1, unique_of: null, version: "○ white", tier: 1, is_evolved: false, versions: [] })
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

	it("narrows to one position plus the general skills, with that position's tier", () => {
		const groups = guideSkillsByCategory(guide, "front")
		expect(groups.map((group) => group.category)).toEqual(["acceleration"])
		expect(groups[0].skills.map((pick) => [pick.skill.id, pick.tier, pick.styles])).toEqual([[1, 1, ["everyone", "front"]]])
		const late = guideSkillsByCategory(guide, "late")
		expect(late.map((group) => [group.category, group.skills.map((pick) => pick.skill.id)])).toEqual([
			["acceleration", [1]],
			["debuff", [4]],
		])
	})

	it("lists the positions with skills, without everyone", () => {
		expect(skillPositions(guide)).toEqual(["front", "pace", "late", "end"])
	})
})

describe("skillColour", () => {
	it("names the colour from rarity, never from the circles in the label", () => {
		expect(skillColour({ rarity: 1, is_evolved: false })).toBe("white")
		expect(skillColour({ rarity: 2, is_evolved: false })).toBe("gold")
		expect(skillColour({ rarity: 5, is_evolved: false })).toBe("unique")
		expect(skillColour({ rarity: 2, is_evolved: true })).toBe("evolved")
	})
})

describe("the All style tab", () => {
	it("reads ?style=all, and still refuses everyone and junk", () => {
		expect(parsePvpStyle("all")).toBe("all")
		expect(parsePvpStyle("pace")).toBe("pace")
		expect(parsePvpStyle("everyone")).toBeNull()
		expect(parsePvpStyle("nope")).toBeNull()
	})

	it("is offered only beside two or more styles", () => {
		expect(styleTabs(["front", "end"])).toEqual(["all", "front", "end"])
		expect(styleTabs(["pace"])).toEqual(["pace"])
	})

	it("keeps All where it is offered, and falls back to the first style where it isn't", () => {
		expect(pickStyle(["front", "end"], "all")).toBe("all")
		expect(pickStyle(["pace"], "all")).toBe("pace")
	})
})

describe("the style ranking", () => {
	it("reads Henry's ranking as steps, with the gap before each", () => {
		expect(parseStyleRanking("Pace>>End>Late>Front")).toEqual([
			{ style: "pace", label: "Pace", gap: null },
			{ style: "end", label: "End", gap: ">>" },
			{ style: "late", label: "Late", gap: ">" },
			{ style: "front", label: "Front", gap: ">" },
		])
	})

	it("keeps a word that names no style, and reads spaces, = and >=", () => {
		expect(parseStyleRanking("Front >> Blaze >= End = Late")).toEqual([
			{ style: "front", label: "Front", gap: null },
			{ style: null, label: "Blaze", gap: ">>" },
			{ style: "end", label: "End", gap: ">=" },
			{ style: "late", label: "Late", gap: "=" },
		])
	})

	it("reads the game's full names too, and nothing from an empty ranking", () => {
		expect(parseStyleRanking("Pace Chaser > End Closer").map((step) => step.style)).toEqual(["pace", "end"])
		expect(parseStyleRanking("")).toEqual([])
		expect(parseStyleRanking("  ")).toEqual([])
	})

	it("ranks each style by its place, a non-style word ahead of it included", () => {
		const ranks = styleRanks(parseStyleRanking("Front>>Blaze>=End>Late>Pace"))
		expect(ranks.get("front")).toBe(1)
		expect(ranks.get("end")).toBe(3)
		expect(ranks.get("pace")).toBe(5)
		expect(ranks.has("runaway")).toBe(false)
	})

	it("opens on the top-ranked style the guide has, unless one is asked for", () => {
		const ranking = parseStyleRanking("Runaway>Pace>>End>Front")
		// The guide has no Runaway pane, so its best style with one is Pace.
		expect(pickStyle(["front", "pace", "end"], null, ranking)).toBe("pace")
		expect(pickStyle(["front", "pace", "end"], "end", ranking)).toBe("end")
		// Asked for a style the guide lacks: the ranking still decides.
		expect(pickStyle(["front", "pace", "end"], "late", ranking)).toBe("pace")
		// No ranking, or none of its styles: the first style, as before.
		expect(pickStyle(["front", "end"], null, [])).toBe("front")
		expect(pickStyle(["front", "end"], null, parseStyleRanking("Blaze"))).toBe("front")
	})
})

describe("uma star groups", () => {
	it("groups by stars, most first, keeping the guide's order inside a group", () => {
		const row = (id: number, stars: number) => ({ style: "pace" as const, stars, role: "", note: "", uma: { id, name: `Uma ${id}`, image: null } })
		const groups = umasByStars([row(1, 2), row(2, 3), row(3, 2), row(4, 3)])
		expect(groups.map((group) => [group.stars, group.rows.map((r) => r.uma.id)])).toEqual([
			[3, [2, 4]],
			[2, [1, 3]],
		])
	})
})

describe("packStarRows", () => {
	// Tiles 100px with 8px between, a 24px least gap between groups; a row
	// `columns` tiles wide. [group, from, count] per part, a list per row.
	const rows = (sizes: number[], columns: number) =>
		packStarRows(sizes, { width: columns * 100 + (columns - 1) * 8, tile: 100, gap: 8, groupGap: 24 }).map((row) =>
			row.map((part) => [part.group, part.from, part.count])
		)

	it("puts groups on one row while each fits whole, gap included", () => {
		// One 3-star, one 2-star and one 1-star share a row.
		expect(rows([1, 1, 1], 8)).toEqual([[[0, 0, 1], [1, 0, 1], [2, 0, 1]]])
	})

	it("starts a group on a new row when only part of it would fit", () => {
		// Five 2-stars after five 3-stars start their own row, though some would fit.
		expect(rows([5, 5], 8)).toEqual([[[0, 0, 5]], [[1, 0, 5]]])
		expect(rows([1, 3, 2], 3)).toEqual([[[0, 0, 1]], [[1, 0, 3]], [[2, 0, 2]]])
	})

	it("counts the gap between groups: three tiles in three columns split 1 + 2 no longer fit", () => {
		expect(rows([1, 2], 3)).toEqual([[[0, 0, 1]], [[1, 0, 2]]])
		expect(rows([1, 2], 4)).toEqual([[[0, 0, 1], [1, 0, 2]]])
	})

	it("wraps a group longer than a row, and lets the next one join its last row if it fits", () => {
		expect(rows([5, 2], 4)).toEqual([[[0, 0, 4]], [[0, 4, 1], [1, 0, 2]]])
		expect(rows([5, 4], 4)).toEqual([[[0, 0, 4]], [[0, 4, 1]], [[1, 0, 4]]])
		// CM 21's Pace on a phone: three 3-stars, then four 2-stars.
		expect(rows([3, 4], 3)).toEqual([[[0, 0, 3]], [[1, 0, 3]], [[1, 3, 1]]])
	})

	it("skips empty groups and always holds a tile a row", () => {
		expect(packStarRows([0, 2], { width: 0, tile: 100, gap: 8, groupGap: 24 }).length).toBe(2)
		expect(rows([], 5)).toEqual([])
	})
})

describe("layoutStarRows", () => {
	const measures = (columns: number) => ({ width: columns * 100 + (columns - 1) * 8, tile: 100, gap: 8, groupGap: 24 })
	const layout = (sizes: number[], columns: number) => {
		const { rows, inset } = layoutStarRows(sizes, measures(columns))
		return { inset, rows: rows.map((row) => row.map((part) => [part.group, part.from, part.count])) }
	}

	it("shares the first row's room evenly, as much at each edge as in each gap", () => {
		// 856px; three single tiles and two 24px gaps use 348; 508 over, a quarter each.
		expect(layout([1, 1, 1], 8)).toEqual({ inset: 127, rows: [[[0, 0, 1], [1, 0, 1], [2, 0, 1]]] })
	})

	it("keeps the first row's edges for the rows after it", () => {
		// Two and two share the first row (440px of 856, 416 over, a third each);
		// the five on the second row fit between those edges.
		expect(layout([2, 2, 5], 8)).toEqual({ inset: 138, rows: [[[0, 0, 2], [1, 0, 2]], [[2, 0, 5]]] })
		expect(layout([5, 5], 8)).toEqual({ inset: 162, rows: [[[0, 0, 5]], [[1, 0, 5]]] })
	})

	it("moves the edges out only as far as a wider later row needs", () => {
		// Four alone would centre at 216; the five below need 532px, so 162.
		expect(layout([4, 5], 8)).toEqual({ inset: 162, rows: [[[0, 0, 4]], [[1, 0, 5]]] })
		// A lone 3-star on a phone, then three 2-stars filling a row: edge to edge.
		expect(layout([1, 3, 2], 3).inset).toBe(0)
	})

	it("is edge to edge when the first row is full, or nothing is measured", () => {
		expect(layout([3, 4], 3)).toEqual({ inset: 0, rows: [[[0, 0, 3]], [[1, 0, 3]], [[1, 3, 1]]] })
		expect(layoutStarRows([2], { width: 0, tile: 100, gap: 8, groupGap: 24 }).inset).toBe(0)
	})
})

describe("the All tab's lines", () => {
	const row = (id: number, stars: number) => ({ style: "pace" as const, stars, role: "", note: "", uma: { id, name: `Uma ${id}`, image: null } })
	const skill = (id: number, style: string, tier: number | null, order = 0): PvpSkillRecommendation =>
		({ style, tier, category: "other", order, note: "", skill: { id } }) as unknown as PvpSkillRecommendation

	it("takes the top umas by stars, then the guide's order, and counts the rest", () => {
		const { shown, more } = topUmas([row(1, 2), row(2, 3), row(3, 2), row(4, 3), row(5, 1)], 3)
		expect(shown.map((r) => r.uma.id)).toEqual([2, 4, 1])
		expect(more).toBe(2)
		expect(topUmas([row(1, 2)], 6).more).toBe(0)
	})

	it("takes a position's best tier, and every skill of a guide with no tiers", () => {
		const rows = [skill(1, "pace", 1), skill(2, "pace", 0, 1), skill(3, "front", 0), skill(4, "pace", 0, 0), skill(5, "everyone", 0)]
		const top = topTierSkills(rows, "pace")
		expect(top.tier).toBe(0)
		expect(top.skills.map((r) => r.skill.id)).toEqual([4, 2])
		expect(topTierSkills([skill(6, "pace", null), skill(7, "pace", null)], "pace")).toMatchObject({ tier: null })
		expect(topTierSkills([skill(6, "pace", null), skill(7, "pace", null)], "pace").skills).toHaveLength(2)
		expect(topTierSkills(rows, "end")).toEqual({ tier: null, skills: [] })
	})

	it("orders styles by the ranking, unranked ones after in their own order", () => {
		expect(stylesByRank(["front", "pace", "late", "end"], parseStyleRanking("Pace >> End > Late"))).toEqual(["pace", "end", "late", "front"])
		expect(stylesByRank(["front", "end"], [])).toEqual(["front", "end"])
	})
})

describe("tier labels and plain notes", () => {
	it("labels tiers from one list, past it by number", () => {
		expect(tierLabel(0)).toBe("T0")
		expect(tierLabel(4)).toBe("T4")
		expect(tierLabel(7)).toBe("T7")
	})

	it("reads a note as plain words for a one-line caption", () => {
		expect(plainNoteText("with [[564 Escapades]]")).toBe("with 564 Escapades")
		expect(plainNoteText("==[[Top Runner]] & Hints==")).toBe("Top Runner & Hints")
		expect(plainNoteText("Cope")).toBe("Cope")
	})
})


describe("team comps and style colours", () => {
	it("reads a comp as its places, a shared place as both styles", () => {
		expect(parseTeamComp("3 Pace")).toEqual([["pace"], ["pace"], ["pace"]])
		expect(parseTeamComp("2 Pace + 1 End/Late")).toEqual([["pace"], ["pace"], ["end", "late"]])
		expect(parseTeamComp("1 Front Runner + 2 Pace Chaser")).toEqual([["front"], ["pace"], ["pace"]])
	})

	it("leaves a comp it cannot count as words alone", () => {
		expect(parseTeamComp("Henry's Team")).toBeNull()
		expect(parseTeamComp("2 Front + 2 Pace")).toBeNull()
		expect(parseTeamComp("1 Blaze + 2 Pace")).toBeNull()
		expect(parseTeamComp("")).toBeNull()
	})

	it("names a style from a word, and colours it from its token", () => {
		expect(styleForWord(" Late Surger ")).toBe("late")
		expect(styleForWord("Blaze")).toBeNull()
		expect(styleColor("pace")).toBe("var(--color-style-pace)")
	})
})

describe("aptitude letters on a guide's umas", () => {
	const sprintTurf = { surface_type: "Turf", distance: "Sprint", length: "1200" }
	const apt = { turf: 7, dirt: 1, short: 2, mile: 7, medium: 7, long: 6, front: 3, pace: 7, late: 7, end: 5 }

	it("gives the course's distance and the row's style, the surface only when it is below A", () => {
		expect(guideUmaAptitudes(apt, sprintTurf, "front")).toEqual([
			{ label: "Sprint", letter: "F", value: 2 },
			{ label: "Front", letter: "E", value: 3 },
		])
		expect(guideUmaAptitudes(apt, { ...sprintTurf, surface_type: "Dirt" }, "pace")).toEqual([
			{ label: "Dirt", letter: "G", value: 1 },
			{ label: "Sprint", letter: "F", value: 2 },
			{ label: "Pace", letter: "A", value: 7 },
		])
	})

	it("reads a runaway as a front runner, and gives nothing it cannot know", () => {
		expect(guideUmaAptitudes(apt, sprintTurf, "runaway")?.map((a) => a.label)).toEqual(["Sprint", "Front"])
		expect(guideUmaAptitudes(null, sprintTurf, "pace")).toBeNull()
		expect(guideUmaAptitudes(apt, null, "pace")).toBeNull()
		expect(guideUmaAptitudes({ short: null, pace: null }, sprintTurf, "pace")).toEqual([])
	})

	it("knows a role that only restates aptitudes", () => {
		expect(isAptitudeOnlyRole("Sprint F Front E")).toBe(true)
		expect(isAptitudeOnlyRole("Sprint E End D")).toBe(true)
		expect(isAptitudeOnlyRole("sprint f")).toBe(true)
		expect(isAptitudeOnlyRole("Normal Front")).toBe(false)
		expect(isAptitudeOnlyRole("RA")).toBe(false)
		expect(isAptitudeOnlyRole("")).toBe(false)
	})
})
