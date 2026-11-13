import { describe, expect, it } from "vitest"
import type { SkillSlot } from "../types/pvpGuide"
import type { SkillDetailData } from "../types/skills"
import { bannerStatus, isWeakAptitude } from "../utils/encyclopedia"
import { detailToCardSkill, rowToCardSkill } from "../utils/skillCard"
import { cooldownWords, durationWords } from "../utils/skillWords"

/** The plain helpers behind the Encyclopedia's look: the hover card's data, a banner's status, the timing words. */

const ROW = {
	id: 2, game_id: 200002, name: "Gourmand", image: null, rarity: 2, tier: 2, group_id: 20000, version: "◎ gold",
	is_evolved: false, availability: "global" as const, uses_translation: false, cost: 180, type: "recovery", owners: [],
}

const source = (name: string, on_global = true) => ({ id: 1, name, game_id: 1, image: null, source: "awakening", level: 3, on_global })

const DETAIL: SkillDetailData = {
	...ROW,
	other_names: [],
	pair: null,
	description: "Recover endurance mid-race.",
	readable: { wit_check: true, complete: true, slots: [] },
	sources: {
		umas: ["Oguri Cap", "Oguri Cap (Christmas)", "Special Week", "Super Creek"].map((name) => source(name)),
		cards: [{ id: 9, name: "Special Week", game_id: 30001, image: null, source: "event", on_global: true }],
	},
	evolution: { from: null, into: [], conditions: [], scenario: null },
	versions: [{ ...ROW, id: 3, game_id: 200003, name: "Hydrate", rarity: 1, version: "○ white" }],
}

describe("the skill card's data", () => {
	it("starts from what a row knows, with nothing to read yet", () => {
		const card = rowToCardSkill(ROW)
		expect(card).toMatchObject({ name: "Gourmand", description: "", versions: [], unique_of: null, is_inherited: false })
		expect(card.readable).toBeUndefined()
	})

	it("names a unique's owner and marks an inherited copy", () => {
		expect(rowToCardSkill({ ...ROW, rarity: 5, game_id: 100011, owners: ["Special Week"] }).unique_of).toBe("Special Week")
		expect(rowToCardSkill({ ...ROW, rarity: 1, game_id: 900011 }).is_inherited).toBe(true)
	})

	it("names three sources and counts the rest", () => {
		const card = detailToCardSkill(DETAIL)
		expect(card.sources?.umas.map((row) => row.name)).toEqual(["Oguri Cap", "Oguri Cap (Christmas)", "Special Week"])
		expect(card.sources?.uma_count).toBe(4)
		expect(card.sources?.card_count).toBe(1)
		expect(card.versions.map((version) => version.name)).toEqual(["Hydrate"])
	})

	it("lists a unique's inherited copy first among its versions", () => {
		const pair = { ...ROW, id: 5, game_id: 900011, name: "Shooting Star", rarity: 1 }
		expect(detailToCardSkill({ ...DETAIL, pair }).versions.map((version) => version.id)).toEqual([5, 3])
	})
})

describe("timing words", () => {
	const slot = (duration: string | null, cooldown: string | null) => ({ duration, cooldown }) as SkillSlot

	it("words a duration and a cooldown, and says nothing for neither", () => {
		expect(durationWords(slot("2.4 s per 1,000 m", null))).toBe("Lasts 2.4 s per 1,000 m")
		expect(durationWords(slot("Whole race", null))).toBe("For the whole race")
		expect(durationWords(slot(null, null))).toBeNull()
		expect(cooldownWords(slot(null, "Once per race"))).toBe("Once per race")
		expect(cooldownWords(slot(null, "30 s per 1,000 m"))).toBe("Again after 30 s per 1,000 m")
		expect(cooldownWords(slot(null, null))).toBeNull()
	})
})

describe("a banner's status", () => {
	const now = new Date("2026-11-12T12:00:00Z")

	it("is ended after its last day, running between its dates and upcoming before", () => {
		expect(bannerStatus("2025-06-26T22:00:00Z", "2025-07-02T21:59:59Z", now)).toBe("ended")
		expect(bannerStatus("2026-11-10T22:00:00Z", "2026-11-20T21:59:59Z", now)).toBe("running")
		expect(bannerStatus("2027-01-14T22:00:00Z", "2027-01-25T21:59:59Z", now)).toBe("upcoming")
	})
})

describe("a weak aptitude", () => {
	it("is D or worse, and never a blank", () => {
		expect([1, 4, 5, 8].map(isWeakAptitude)).toEqual([true, true, false, false])
		expect(isWeakAptitude(null)).toBe(false)
	})
})
