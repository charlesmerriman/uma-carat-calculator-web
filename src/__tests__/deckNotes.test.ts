import { describe, expect, it } from "vitest"
import { noteOnlyType, parseSlotNote, rarityLabel } from "../utils/deckNotes"

/**
 * The deck slot note reader (utils/deckNotes.ts). CM21_NOTES is every distinct
 * slot note in the live CM 21 guide (2026-10-23), the first guide written in
 * the editor; the "nothing lost" test runs them all.
 */
const CM21_NOTES = [
	"==2SP & Scenario Link==",
	"==Scenario Link==",
	"==[[Ambitious Breeze]] & 2SP==",
	"==[[Daring Strike]] & 1SP==",
	"==[[Groundwork]] [[In High Spirits]] & Hints==",
	"==[[Lightning Surge]]==",
	"==[[On Your Left!]]==",
	"==[[Razor-Sharp Steps]]==",
	"==[[See Ya Later!]] & Scenario Link==",
	"==[[Taking the Lead]] [[Concentration]]==",
	"==[[Top Runner]] & Hints==",
	"==[[Unstoppable]] & 2SP & Scenario Link==",
	"Initial Friendship",
	"Initial Friendships",
	"Stats",
	"[[Concentration]]",
	"[[Daring Strike]]",
	"[[Fast & Furious]][[Winter Runner ○]]",
	"[[Firm Course Menace]]",
	"[[Givin' It 1000%]]",
	"[[In High Spirits]][[Groundwork]]",
	"[[Left-Handed ○]]",
	"[[Lightning Surge]]",
	"[[Neck and Neck]]",
	"[[Nothing Ventured]]",
	"[[Professor of Curvature]]",
	"[[Sharp Streak]] & 1SP",
	"[[Speed Star]] & Stats",
	"[[Turbo Sprint]]",
	"[[Unrestrained]] & 1SP",
	"if you think it's over accel",
	"or any Spd",
	"or any Wit",
]

describe("parseSlotNote", () => {
	it("reads a skill, a tag and the scenario link, with the red marks dropped", () => {
		expect(parseSlotNote("==[[Unstoppable]] & 2SP & Scenario Link==")).toEqual({
			skills: ["Unstoppable"],
			scenarioLink: true,
			tags: ["2SP"],
			anyType: null,
			rest: "",
		})
	})

	it("reads a link with no skill, and skills with no joiner between them", () => {
		expect(parseSlotNote("==2SP & Scenario Link==")).toMatchObject({ skills: [], tags: ["2SP"], scenarioLink: true })
		expect(parseSlotNote("==[[Taking the Lead]] [[Concentration]]==").skills).toEqual(["Taking the Lead", "Concentration"])
		expect(parseSlotNote("[[In High Spirits]][[Groundwork]]").skills).toEqual(["In High Spirits", "Groundwork"])
	})

	it("never splits a skill's own name on its & or and", () => {
		expect(parseSlotNote("[[Fast & Furious]][[Winter Runner ○]]").skills).toEqual(["Fast & Furious", "Winter Runner ○"])
		expect(parseSlotNote("[[Neck and Neck]]").skills).toEqual(["Neck and Neck"])
	})

	it("keeps the guide's words for the tags, each once", () => {
		expect(parseSlotNote("Initial Friendships").tags).toEqual(["Initial Friendship"])
		expect(parseSlotNote("[[Speed Star]] & Stats").tags).toEqual(["Stats"])
		expect(parseSlotNote("[[Top Runner]] & Hints & hints").tags).toEqual(["Hints"])
		expect(parseSlotNote("1 SP").tags).toEqual(["1SP"])
	})

	it("reads the sheet-era guides' bare 'Link' as the scenario link", () => {
		expect(parseSlotNote("Gold + Link")).toEqual({ skills: [], scenarioLink: true, tags: [], anyType: null, rest: "Gold" })
	})

	it("reads 'or any' as a card type", () => {
		expect(parseSlotNote("or any Spd").anyType).toBe("speed")
		expect(parseSlotNote("or any Wit").anyType).toBe("wit")
		expect(parseSlotNote("or any speed").anyType).toBe("speed")
		// Without "or" it is the slot's own advice, kept as written.
		expect(parseSlotNote("Any Wit")).toMatchObject({ anyType: null, rest: "Any Wit" })
	})

	it("keeps a note it cannot read whole, joiners and all", () => {
		expect(parseSlotNote("if you think it's over accel").rest).toBe("if you think it's over accel")
		expect(parseSlotNote("Gold or better")).toEqual({ skills: [], scenarioLink: false, tags: [], anyType: null, rest: "Gold or better" })
		expect(parseSlotNote("")).toMatchObject({ skills: [], rest: "" })
	})

	it("keeps the unread part of a note it half reads, with its own mention", () => {
		expect(parseSlotNote("[[Sharp Streak]] & 1SP & only if [[Concentration]] is gold")).toEqual({
			skills: ["Sharp Streak"],
			scenarioLink: false,
			tags: ["1SP"],
			anyType: null,
			rest: "only if [[Concentration]] is gold",
		})
	})

	it("loses nothing from any CM 21 note", () => {
		for (const note of CM21_NOTES) {
			const parsed = parseSlotNote(note)
			const shown = [
				...parsed.skills,
				...parsed.tags,
				parsed.scenarioLink ? "Scenario Link" : "",
				parsed.anyType ? `or any ${parsed.anyType}` : "",
				parsed.rest,
			].join(" ").toLowerCase()
			// Every word the author typed shows somewhere ("Spd" as speed, "Friendships" as Friendship).
			const words = note.replace(/==|\[\[|\]\]|&/g, " ").split(/\s+/).filter(Boolean)
			for (const word of words) {
				const expected = word.toLowerCase().replace(/^spd$/, "speed").replace(/^friendships$/, "friendship")
				expect(shown, `${note}: ${word}`).toContain(expected)
			}
			// And nothing red is left.
			expect(parsed.rest).not.toContain("==")
		}
	})
})

describe("noteOnlyType", () => {
	it("reads a note that only names a card type, with or without the or", () => {
		expect(noteOnlyType("Any Wit")).toBe("wit")
		expect(noteOnlyType("or any Spd")).toBe("speed")
		expect(noteOnlyType("==Any Power==")).toBe("power")
		expect(noteOnlyType("Any Wit if you have it")).toBeNull()
		expect(noteOnlyType("Any friend")).toBeNull()
		expect(noteOnlyType("")).toBeNull()
	})
})

describe("rarityLabel", () => {
	it("names R and SR, and nothing for an SSR", () => {
		expect(rarityLabel(1)).toBe("R")
		expect(rarityLabel(2)).toBe("SR")
		expect(rarityLabel(3)).toBe("")
		expect(rarityLabel(null)).toBe("")
	})
})
