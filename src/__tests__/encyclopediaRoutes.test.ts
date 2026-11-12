import { describe, expect, it } from "vitest"
import { cardHref, isEncyclopediaPath, parseGameId, umaHref } from "../utils/encyclopediaRoutes"
import { cardReleases, umaReleases } from "../utils/encyclopediaBanners"
import type { BannerSupport, BannerUma } from "../types"

/** The Encyclopedia's addresses, and how a page finds its banners. */

describe("encyclopedia routes", () => {
	it("builds a page's address from the game's id", () => {
		expect(umaHref(100101)).toBe("/app/umas/100101")
		expect(cardHref(30001)).toBe("/app/cards/30001")
	})

	it("reads the id, and only the leading digits, so a readable suffix still works", () => {
		expect(parseGameId("100101")).toBe(100101)
		expect(parseGameId("100101-special-week")).toBe(100101)
		expect(parseGameId("special-week")).toBeNull()
		expect(parseGameId("0")).toBeNull()
		expect(parseGameId(undefined)).toBeNull()
	})

	it("knows the Encyclopedia's paths, the skills included", () => {
		for (const path of ["/app/umas", "/app/umas/100101", "/app/cards/30001", "/app/skills", "/app/skills/200011"]) {
			expect(isEncyclopediaPath(path), path).toBe(true)
		}
		expect(isEncyclopediaPath("/app/umasx")).toBe(false)
		expect(isEncyclopediaPath("/app/timeline")).toBe(false)
	})
})

const timeline = (id: number, start: string, predicted: boolean) => ({
	id, name: `Window ${id}`, banner_category: "standard", start_date: start, end_date: start, is_predicted: predicted,
	jp_start_date: null, jp_end_date: null, global_start_date: null, global_end_date: null,
})

describe("a page's banners", () => {
	it("lists every banner with her on it, oldest first, dated as the site dates them", () => {
		const banners = [
			{ id: 2, name: "Rerun", banner_timeline: timeline(20, "2026-12-01T00:00:00Z", true), umas: [{ id: 7, first_jp_date: "2021-02-24" }] },
			{ id: 1, name: "Launch", banner_timeline: timeline(10, "2025-06-26T00:00:00Z", false), umas: [{ id: 7, first_jp_date: "2021-02-24" }] },
			{ id: 3, name: "Someone else", banner_timeline: timeline(30, "2025-07-01T00:00:00Z", false), umas: [{ id: 8, first_jp_date: null }] },
		] as unknown as BannerUma[]
		const found = umaReleases(banners, 7)
		expect(found.banners.map((banner) => banner.name)).toEqual(["Launch", "Rerun"])
		expect(found.banners[0].href).toContain("/app/timeline?")
		expect(found).toMatchObject({ jpDate: "2021-02-24", globalDate: "2025-06-26T00:00:00Z", predicted: false })
	})

	it("knows nothing about a card on no banner", () => {
		expect(cardReleases([] as BannerSupport[], 1)).toEqual({ banners: [], jpDate: null, globalDate: null, predicted: false })
	})
})
