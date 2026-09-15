// @vitest-environment node
//
// The pure half of site content: what a page reads, what a build-time render records,
// and what a document embeds. Node environment because entry-server.ts uses these.
import { describe, expect, it } from "vitest"
import { buildSiteContentValue, homepageFaqItems, sameContent, selectEmbedded } from "../services/siteContent"
import type { ContentKey } from "../services/siteContent"
import type { SiteContent } from "../types/siteContent"

const CONTENT: SiteContent = {
	pages: [
		{ slug: "about", title: "About", meta_description: "d", body: "About body", updated_at: "2026-09-15T10:00:00Z" },
		{ slug: "carat-income-guide", title: "Guide", meta_description: "d", body: "Guide body", updated_at: "2026-09-15T10:00:00Z" },
	],
	faq: [
		{
			slug: "one",
			title: "One",
			items: [
				{ slug: "a", question: "A?", answer: "a", show_on_homepage: false },
				{ slug: "b", question: "B?", answer: "b", show_on_homepage: true },
			],
		},
		{ slug: "two", title: "Two", items: [{ slug: "c", question: "C?", answer: "c", show_on_homepage: true }] },
	],
}

describe("buildSiteContentValue", () => {
	it("finds a page by slug and the FAQ, and reports each key it was asked for", () => {
		const read: ContentKey[] = []
		const value = buildSiteContentValue(CONTENT, { onRead: (key) => read.push(key) })
		expect(value.page("about")?.body).toBe("About body")
		expect(value.faq()?.length).toBe(2)
		expect(read).toEqual(["page:about", "faq"])
	})

	it("returns null for what is not loaded here, which is the browser's loading state", () => {
		const value = buildSiteContentValue({ pages: [CONTENT.pages![0]] })
		expect(value.page("carat-income-guide")).toBeNull()
		expect(value.faq()).toBeNull()
		expect(buildSiteContentValue(null).page("about")).toBeNull()
	})

	it("throws instead when strict, so a build cannot bake a loading state", () => {
		const value = buildSiteContentValue({ pages: [CONTENT.pages![0]] }, { strict: true })
		expect(value.page("about")?.title).toBe("About")
		expect(() => value.page("carat-income-guide")).toThrow(/no page "carat-income-guide"/)
		expect(() => value.faq()).toThrow(/no FAQ/)
	})
})

describe("selectEmbedded", () => {
	it("keeps only the rows that were read, and leaves unread keys out entirely", () => {
		expect(selectEmbedded(CONTENT, ["page:about"])).toEqual({ pages: [CONTENT.pages![0]] })
		expect(selectEmbedded(CONTENT, ["faq"])).toEqual({ faq: CONTENT.faq })
		expect(selectEmbedded(CONTENT, [])).toEqual({})
	})

	it("does not invent a row the content lacks", () => {
		expect(selectEmbedded({ pages: [] }, ["page:about", "faq"])).toEqual({})
	})
})

describe("homepageFaqItems", () => {
	it("is the ticked questions across every category, in FAQ order", () => {
		expect(homepageFaqItems(CONTENT.faq!).map((item) => item.slug)).toEqual(["b", "c"])
	})
})

describe("sameContent", () => {
	it("compares by value, so a revalidation fetch that changed nothing is a no-op", () => {
		expect(sameContent(CONTENT, JSON.parse(JSON.stringify(CONTENT)))).toBe(true)
		expect(sameContent(CONTENT, { ...CONTENT, faq: [] })).toBe(false)
		expect(sameContent(null, {})).toBe(false)
	})
})
