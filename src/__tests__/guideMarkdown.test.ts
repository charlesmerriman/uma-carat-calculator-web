// @vitest-environment node
import { createElement } from "react"
import { describe, expect, it } from "vitest"
import { childrenToText, extractH2s, firstParagraph, slugify, splitLeadingSubtitle } from "../utils/guideMarkdown"
import SNAPSHOT from "../content/snapshot.json"
import type { SiteContent } from "../types/siteContent"

// The helpers are pure strings-in, strings-out, so they run in the node
// environment — which is also the environment a build-time render uses.

const guide = (SNAPSHOT as SiteContent).pages!.find((page) => page.slug === "carat-income-guide")!.body

describe("splitLeadingSubtitle", () => {
	it("separates a lone italic first line from the body", () => {
		expect(splitLeadingSubtitle("\n*A subtitle.*\n\n## First section\n\nBody.\n")).toEqual({
			subtitle: "A subtitle.",
			body: "## First section\n\nBody.\n",
		})
	})

	it("leaves a body that starts with prose or a heading alone", () => {
		expect(splitLeadingSubtitle("Body starts here.\n")).toEqual({ subtitle: null, body: "Body starts here.\n" })
		expect(splitLeadingSubtitle("\n\n## Heading\n")).toEqual({ subtitle: null, body: "## Heading\n" })
	})

	it("parses the real guide", () => {
		const header = splitLeadingSubtitle(guide)
		expect(header.subtitle).toMatch(/plain-English guide/)
		expect(header.body.startsWith("## The one-sentence version")).toBe(true)
	})
})

describe("firstParagraph", () => {
	it("returns everything up to the first blank line", () => {
		expect(firstParagraph("One **bold**\nstill one.\n\nTwo.\n")).toBe("One **bold**\nstill one.")
		expect(firstParagraph("\n\nOnly.\n")).toBe("Only.")
		expect(firstParagraph("")).toBe("")
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
		const sections = extractH2s(splitLeadingSubtitle(guide).body)
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
