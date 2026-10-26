import { describe, expect, it } from "vitest"
import { pvpReadiness } from "../utils/pvpReadiness"
import type { RaceEvent } from "../types"
import type { PvpGuide, PvpSkillRef } from "../types/pvpGuide"
import type { CatalogueUma, PvpTeamMember } from "../types/pvpTeam"

/**
 * The readiness strip's counts. The aptitude letters and the skill ticks
 * reuse the grid's and the Skills panel's own helpers, so these pin that the
 * strip counts what those draw.
 */

// A turf mile: each member is asked for Turf, Mile and her style.
const COURSE = { surface_type: "Turf", distance: "Mile", length: "" } as Pick<RaceEvent, "surface_type" | "distance" | "length">

const apt = (overrides: Partial<CatalogueUma["apt"]>): CatalogueUma["apt"] => ({
	turf: 7, dirt: 1, short: 7, mile: 7, medium: 7, long: 7, front: 7, pace: 7, late: 7, end: 7, ...overrides,
})
const UMAS = new Map<number, Pick<CatalogueUma, "apt">>([
	[1, { apt: apt({}) }],
	// Mile D (4), and Pace unknown: unknown is not a gap.
	[2, { apt: apt({ mile: 4, pace: null }) }],
	// Turf S, Late C (5).
	[3, { apt: apt({ turf: 8, late: 5 }) }],
])

const member = (position: number, uma: number, style: PvpTeamMember["style"], cards = 0): PvpTeamMember => ({
	position, uma, style, cards: Array.from({ length: cards }, (_, index) => ({ slot: index + 1, support_card: 100 + index })),
})

const skill = (id: number, extra: Partial<PvpSkillRef> = {}): PvpSkillRef => ({
	id, name: `Skill ${id}`, description: "", image: null, rarity: 1, unique_of: null, version: "○ white", tier: 1,
	is_evolved: false, versions: [], ...extra,
})
const guideWith = (skills: PvpSkillRef[]) =>
	({
		skill_recommendations: skills.map((each, order) => ({ style: "everyone", category: "green", tier: null, order, note: "", skill: each })),
	}) as unknown as PvpGuide

describe("pvpReadiness", () => {
	it("counts umas and cards against a full team", () => {
		const readiness = pvpReadiness([member(0, 1, "front", 6), member(1, 2, "pace", 2)], COURSE, null, UMAS, new Map())
		expect(readiness.umas).toEqual({ have: 2, of: 3 })
		expect(readiness.cards).toEqual({ have: 8, of: 18 })
	})

	it("lists each letter below A the race asks for, spot by spot, and skips unknown letters", () => {
		const readiness = pvpReadiness(
			[member(2, 3, "late"), member(0, 1, "front"), member(1, 2, "pace")],
			COURSE, null, UMAS, new Map()
		)
		expect(readiness.aptitudes).toEqual([
			{ position: 1, label: "Mile", letter: "D" },
			{ position: 2, label: "Late", letter: "C" },
		])
	})

	it("has no skills count without a guide, or with a guide that picks none", () => {
		expect(pvpReadiness([], COURSE, null, UMAS, new Map()).skills).toBeNull()
		expect(pvpReadiness([], COURSE, guideWith([]), UMAS, new Map()).skills).toBeNull()
	})

	it("counts a recommended skill the way the Skills panel ticks it, other versions included", () => {
		// 10 is taught directly; 20's ◎ is met by its ○ (21); 30 is not on the team.
		const picks = [
			skill(10),
			skill(20, { version: "◎ white", tier: 2, versions: [{ id: 21, version: "○ white", rarity: 1, tier: 1, is_evolved: false }] as PvpSkillRef["versions"] }),
			skill(30),
		]
		const sources = new Map([[10, ["Oguri Cap (unique)"]], [21, ["Kitasan Black (hint)"]]])
		expect(pvpReadiness([], COURSE, guideWith(picks), UMAS, sources).skills).toEqual({ have: 2, of: 3 })
	})
})
