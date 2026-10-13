// @vitest-environment node
import { createElement } from "react"
import { describe, expect, it } from "vitest"
import { childrenToText, firstParagraph, slugify } from "../utils/guideMarkdown"

// The helpers are pure strings-in, strings-out, so they run in the node
// environment — which is also the environment a build-time render uses.

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

describe("childrenToText", () => {
	it("flattens strings, numbers and nested elements", () => {
		// The shape react-markdown hands a heading override: a string then an <em> element.
		expect(childrenToText(["Misc Earnings — ", createElement("em", null, "your ", createElement("b", null, 2))])).toBe(
			"Misc Earnings — your 2",
		)
	})
})
