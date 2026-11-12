import { describe, expect, it } from "vitest"
import type { PvpCatalogueIndex } from "../hooks/usePvpCatalogue"
import type { GuideDocument } from "../types/guideDocument"
import type { CatalogueSkill, PvpCatalogue } from "../types/pvpTeam"
import type { SkillListRow } from "../types/skills"
import { hydrateGuide, validateDocument } from "../utils/guideDocument"
import { nameLang, skillMatches, skillNames, skillSearchWords, withShownSkills } from "../utils/skillList"

/**
 * The guide editor's widened catalogue: the builder's skills (global) plus
 * GET /skills, so a writer can pick and [[mention]] a JP-only skill by any
 * of its names.
 */

const catalogueSkill = (id: number, name: string): CatalogueSkill => ({
	id, name, description: `${name} does a thing.`, image: null, rarity: 1, tier: 1, group_id: id, cost: 100, version: "○ white",
})
const row = (id: number, name: string, overrides: Partial<SkillListRow> = {}): SkillListRow => ({
	id, game_id: 200000 + id, name, image: null, rarity: 1, tier: 1, group_id: id, version: "○ white",
	is_evolved: false, availability: "global", uses_translation: false, other_names: [], ...overrides,
})

const CATALOGUE: PvpCatalogue = { umas: [], support_cards: [], skills: [catalogueSkill(1, "Groundwork")] }
const INDEX: PvpCatalogueIndex = {
	catalogue: CATALOGUE,
	umasById: new Map(),
	cardsById: new Map(),
	skillsById: new Map(CATALOGUE.skills.map((skill) => [skill.id, skill])),
}
const ROWS = [
	row(1, "Groundwork", { other_names: ["Old Groundwork"] }),
	row(9, "Fan Skill", { availability: "jp", uses_translation: true, other_names: ["日本語"] }),
]

function document(text: string): GuideDocument {
	return {
		id: 7, version: 1, event_type: "champions_meeting", event: 10, visibility: "private", tools_public: false, updated_at: "2099-01-01T00:00:00Z",
		scenario: null, style_ranking: "", short_description: text, meta_analysis: "", admin_comments: "",
		stat_configs: [], team_comps: [], uma_recommendations: [],
		skill_recommendations: [{ style: "front", category: "speed", tier: null, skill: 9, note: "" }],
		style_notes: [], decks: [],
	} as unknown as GuideDocument
}

describe("withShownSkills", () => {
	it("keeps the catalogue's own rows and adds the skills it lacks", () => {
		const widened = withShownSkills(INDEX, ROWS)
		expect(widened.catalogue.skills.map((skill) => skill.name)).toEqual(["Groundwork", "Fan Skill"])
		// The catalogue row keeps its description and gains the other names.
		expect(widened.skillsById.get(1)).toMatchObject({ description: "Groundwork does a thing.", other_names: ["Old Groundwork"] })
		expect(widened.skillsById.get(9)).toMatchObject({ availability: "jp", description: "" })
	})

	it("is the same index when the list is empty (still loading, or failed)", () => {
		expect(withShownSkills(INDEX, [])).toBe(INDEX)
	})

	it("leaves the builder's catalogue alone", () => {
		withShownSkills(INDEX, ROWS)
		expect(CATALOGUE.skills).toHaveLength(1)
	})

	it("lists every name a skill answers to", () => {
		expect(skillNames(withShownSkills(INDEX, ROWS).skillsById.get(9)!)).toEqual(["fan skill", "日本語"])
	})
})

describe("the editor with JP skills", () => {
	const widened = withShownSkills(INDEX, ROWS)

	it("accepts a mention by any of a skill's names", () => {
		const errors = validateDocument(document("[[Fan Skill]], [[old groundwork]] and [[日本語]]"), widened)
		expect(errors.filter((error) => error.path === "short_description")).toEqual([])
		const unknown = validateDocument(document("[[Nobody]]"), widened)
		expect(unknown).toContainEqual({ path: "short_description", message: "No skill has this name: [[Nobody]]" })
	})

	it("draws a picked JP skill tagged", () => {
		const hydrated = hydrateGuide(document(""), widened, [], null)
		expect(hydrated.skill_recommendations[0].skill).toMatchObject({ name: "Fan Skill", availability: "jp" })
		const mentioned = hydrateGuide(document("[[old groundwork]]"), widened, [], null)
		expect(mentioned.skill_mentions?.["old groundwork"]).toMatchObject({ id: 1, name: "Groundwork" })
	})
})

describe("skill search (skillMatches)", () => {
	// Certain Victory, which players know by GameTora's "It's Going to Be Me".
	const victory = { name: "Certain Victory", game_id: 110031, other_names: ["It's Going to Be Me", "絶対は、ボクだ"] }
	const matches = (query: string) => skillMatches(victory, skillSearchWords(query))

	it("matches every word across the shown name and the hidden ones", () => {
		expect(matches("certain")).toBe(true)
		expect(matches("going me")).toBe(true)
		expect(matches("ボクだ")).toBe(true)
		expect(matches("certain loss")).toBe(false)
	})

	it("ignores case, accents and the ○ ◎ marks", () => {
		expect(matches("CERTAÍN ◎")).toBe(true)
	})

	it("finds the skill by its whole id and never by part of one", () => {
		expect(matches("110031")).toBe(true)
		expect(matches("1100")).toBe(false)
		expect(skillMatches({ name: "No Id" }, ["110031"])).toBe(false)
	})

	it("matches everything when nothing is typed", () => {
		expect(matches("  ")).toBe(true)
	})
})

describe("a Japanese name's lang (nameLang)", () => {
	it("is ja for kana or kanji, and off for an English name", () => {
		expect(nameLang("右回り○")).toBe("ja")
		expect(nameLang("スピードスター")).toBe("ja")
		expect(nameLang("Hot Blooded ☆ Amigo")).toBeUndefined()
		expect(nameLang("introduction：My body")).toBeUndefined()
	})
})
