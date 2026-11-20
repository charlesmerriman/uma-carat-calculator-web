import { describe, expect, it } from "vitest"
import ENCYCLOPEDIA_SAMPLE from "../content/encyclopedia-sample.json"
import type { CardPageData, UmaPageData } from "../types/encyclopedia"
import type { SkillDetailData } from "../types/skills"
import { cardPageMeta, skillPageMeta, umaPageMeta } from "../utils/encyclopediaMeta"

/** An Encyclopedia page's search title and description (utils/encyclopediaMeta.ts). */

const SAMPLE = ENCYCLOPEDIA_SAMPLE as unknown as { uma: UmaPageData; card: CardPageData; skill: SkillDetailData }

describe("encyclopediaMeta", () => {
	it("describes an uma by what her page holds", () => {
		const { title, description } = umaPageMeta(SAMPLE.uma)
		expect(title).toBe("Ines Fujin")
		expect(description).toBe(
			"Ines Fujin [Always Electrifying] is a 3★ Front Runner in Uma Musume. " +
				"Her page has her aptitudes, stats at every star, skills, career objectives, other outfits and support cards.",
		)
	})

	it("describes a card by its rarity, type and what its page holds", () => {
		const { title, description } = cardPageMeta(SAMPLE.card)
		expect(title).toBe("Ines Fujin [Watch My Star Fly!]")
		expect(description).toMatch(/^Ines Fujin \[Watch My Star Fly!\] is an SSR Guts support card in Uma Musume\. Its page has its effects at every level/)
	})

	it("titles a card with no title by its type and number, never as its uma", () => {
		const { title, description } = cardPageMeta({ ...SAMPLE.card, title: "" })
		expect(title).toBe("Ines Fujin SSR Guts Support Card (No. 30011)")
		expect(title).not.toBe(umaPageMeta(SAMPLE.uma).title)
		expect(description).toMatch(/^Ines Fujin \(No\. 30011\) is an SSR Guts support card/)
	})

	it("leads a skill with the game's own sentence", () => {
		const { title, description } = skillPageMeta(SAMPLE.skill)
		expect(title).toBe("Right-Handed × (Skill)")
		expect(description.startsWith(`${SAMPLE.skill.description} Right-Handed × is a white skill in Uma Musume.`)).toBe(true)
	})

	it("says a unique, not an unique", () => {
		const unique = { ...SAMPLE.skill, game_id: 100031, rarity: 5, version: "unique" }
		expect(skillPageMeta(unique).description).toContain("is a unique skill in Uma Musume")
	})

	it("titles a unique and its inherited copy apart, though they share a name", () => {
		const unique = { ...SAMPLE.skill, name: "Shooting Star", game_id: 100011, rarity: 5 }
		const inherited = { ...SAMPLE.skill, name: "Shooting Star", game_id: 900011, rarity: 1 }
		expect(skillPageMeta(unique).title).toBe("Shooting Star (Unique Skill)")
		expect(skillPageMeta(inherited).title).toBe("Shooting Star (Inherited Skill)")
	})

	it("says when the page is about something not on global yet", () => {
		expect(umaPageMeta({ ...SAMPLE.uma, on_global: false }).description).toContain("in Uma Musume (JP only so far).")
		expect(skillPageMeta({ ...SAMPLE.skill, availability: "announced" }).description).toContain("(JP only so far)")
	})

	describe("keeps UmaTL's text out of a description, which can't carry the credit", () => {
		it("leaves out a skill's sentence when the skill uses UmaTL's text", () => {
			const description = skillPageMeta({ ...SAMPLE.skill, uses_translation: true }).description
			expect(description).not.toContain(SAMPLE.skill.description)
			expect(description).toMatch(/^Right-Handed × is a white skill/)
		})

		it("names an uma or card without its title, which may be UmaTL's", () => {
			expect(umaPageMeta({ ...SAMPLE.uma, uses_translation: true }).description).toMatch(/^Ines Fujin is a 3★/)
			const card = cardPageMeta({ ...SAMPLE.card, uses_translation: true })
			// The game's number keeps one character's cards from sharing a description.
			expect(card.description).toMatch(/^Ines Fujin \(No\. 30011\) is an SSR Guts/)
			// The tab title keeps it: the page under it carries the credit.
			expect(card.title).toBe("Ines Fujin [Watch My Star Fly!]")
		})
	})

	it("lists only the sections a page has", () => {
		const bare = { ...SAMPLE.uma, objectives: [], outfits: [], cards: [] }
		expect(umaPageMeta(bare).description).toMatch(/Her page has her aptitudes, stats at every star and skills\.$/)
	})
})
