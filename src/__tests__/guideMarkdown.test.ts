// @vitest-environment node
import { createElement } from "react"
import { describe, expect, it } from "vitest"
import { childrenToText, extractH2s, slugify, splitGuideHeader } from "../utils/guideMarkdown"
import guide from "../../docs/carat-income-explained.md?raw"

// The helpers are pure strings-in, strings-out, so they run in the node
// environment — which is also the environment a build-time render uses.

describe("splitGuideHeader", () => {
	it("separates the H1, subtitle and last-updated line from the body", () => {
		const header = splitGuideHeader(
			"# A Title\n\n*A subtitle.*\n\n*Last updated: March 1, 2026*\n\n---\n\n## First section\n\nBody.\n",
		)
		expect(header.title).toBe("A Title")
		expect(header.subtitle).toBe("A subtitle.")
		expect(header.lastUpdated).toBe("March 1, 2026")
		expect(header.body).toBe("## First section\n\nBody.\n")
	})

	it("tolerates a missing subtitle, a missing date and no closing rule", () => {
		const header = splitGuideHeader("# Only a title\n\nBody starts here.\n")
		expect(header).toEqual({
			title: "Only a title",
			subtitle: null,
			lastUpdated: null,
			body: "Body starts here.\n",
		})
	})

	it("throws when the document does not start with an H1", () => {
		expect(() => splitGuideHeader("Just prose.\n")).toThrow(/level-one heading/)
	})

	it("parses the real guide", () => {
		const header = splitGuideHeader(guide)
		expect(header.title).toBe("How the Calculator Works Out Your Carats")
		expect(header.subtitle).toMatch(/plain-English guide/)
		expect(header.lastUpdated).toMatch(/\d{4}$/)
		expect(header.body.startsWith("## The one-sentence version")).toBe(true)
	})
})

describe("slugify", () => {
	it("drops leading numbering and collapses punctuation", () => {
		expect(slugify("3. Where the carats come from")).toBe("where-the-carats-come-from")
		expect(slugify('6. The "average monthly income" figure')).toBe("the-average-monthly-income-figure")
		expect(slugify("Champions Meeting & League of Heroes — on the event's end date")).toBe(
			"champions-meeting-league-of-heroes-on-the-event-s-end-date",
		)
	})
})

describe("extractH2s", () => {
	it("lists level-two headings in order and ignores fenced code", () => {
		const body = "## One\n\ntext\n\n```\n## not a heading\n```\n\n### Three\n\n## Two *emphasised*\n"
		expect(extractH2s(body)).toEqual([
			{ id: "one", text: "One" },
			{ id: "two-emphasised", text: "Two emphasised" },
		])
	})

	it("finds every numbered section of the real guide", () => {
		const sections = extractH2s(splitGuideHeader(guide).body)
		expect(sections.map((s) => s.id)).toEqual([
			"the-one-sentence-version",
			"it-s-a-running-balance-not-a-formula",
			"there-are-two-kinds-of-carats",
			"where-the-carats-come-from",
			"worked-example",
			"how-the-carats-get-spent",
			"the-average-monthly-income-figure",
			"rules-that-keep-the-numbers-honest",
			"why-your-number-might-differ-from-the-game",
		])
	})
})

describe("childrenToText", () => {
	it("flattens strings, numbers and nested elements", () => {
		// The shape react-markdown hands a heading override: a string then an <em> element.
		expect(childrenToText(["Misc Earnings — ", createElement("em", null, "your ", createElement("b", null, 2))])).toBe(
			"Misc Earnings — your 2",
		)
	})
})
