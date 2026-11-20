import { describe, expect, it } from "vitest"
import { nameMatches, searchKey } from "../utils/searchText"
import { createSearcher } from "../utils/siteSearch"
import type { SearchEntry } from "../utils/siteSearch"

/** The one rule every name search uses (Daptrius, board, 2026-11-19). */

describe("nameMatches", () => {
	it("ignores case, spaces and punctuation", () => {
		expect(nameMatches("mr cb", "Mr. C.B.")).toBe(true)
		expect(nameMatches("tm opera", "T.M. Opera O")).toBe(true)
		expect(nameMatches("MR. C.B.", "Mr. C.B.")).toBe(true)
	})

	it("ignores accents", () => {
		expect(nameMatches("condor", "El Cóndor Pasa")).toBe(true)
		expect(searchKey("Cóndor")).toBe("condor")
	})

	it("finds each word anywhere in the name, in any order", () => {
		expect(nameMatches("summer maruzensky", "Maruzensky (Summer)")).toBe(true)
		expect(nameMatches("summer oguri", "Maruzensky (Summer)")).toBe(false)
	})

	it("matches when any of several names does", () => {
		expect(nameMatches("tracen", "Louder!", "King Halo (Cheerleader)", "Tracen Cheer")).toBe(true)
		expect(nameMatches("tracen", null, undefined, "")).toBe(false)
	})

	it("finds everything for an empty query, or one of punctuation alone", () => {
		expect(nameMatches("", "Special Week")).toBe(true)
		expect(nameMatches("  .  ", "Special Week")).toBe(true)
	})
})

describe("the site search (Ctrl+K)", () => {
	it("finds a name typed without its punctuation", () => {
		const entries = [
			{ id: "uma-1", kind: "uma", title: "Mr. C.B." },
			{ id: "uma-2", kind: "uma", title: "Special Week" },
		] as unknown as SearchEntry[]
		const search = createSearcher(entries)
		expect(search("mr cb").map((entry) => entry.id)).toContain("uma-1")
		expect(search("mr cb").map((entry) => entry.id)).not.toContain("uma-2")
	})
})
