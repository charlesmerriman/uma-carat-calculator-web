import { describe, expect, it } from "vitest"
import { buildSearchEntries, createSearcher, pageEntries, skillTeachers, type SearchSources } from "../utils/siteSearch"
import type { BannerSupport, BannerUma, RaceEvent, Scenario } from "../types"
import type { CatalogueSkill, CatalogueSupportCard, CatalogueUma, PvpCatalogue } from "../types/pvpTeam"

const NOW = new Date("2026-10-30T12:00:00Z")

const window_ = (id: number, end: string) => ({ id, end_date: end })
const umaBanner = (id: number, end: string, ...umas: Array<[number, string]>) =>
	({ id, name: `Banner ${id}`, banner_timeline: window_(id * 10, end), umas: umas.map(([uma, name]) => ({ id: uma, name, image: "/uma.png" })) }) as unknown as BannerUma
const supportBanner = (id: number, end: string, card: number, name: string) =>
	({ id, name: `Support ${id}`, banner_timeline: window_(id * 10, end), support_cards: [{ id: card, name, image: "/card.png" }] }) as unknown as BannerSupport

const SOURCES: SearchSources = {
	umaBanners: [
		umaBanner(1, "2026-09-01T00:00:00Z", [41, "Kitasan Black"]),
		umaBanner(2, "2026-11-20T12:00:00Z", [41, "Kitasan Black"], [42, "Satono Diamond"]),
		umaBanner(3, "2027-02-01T00:00:00Z", [41, "Kitasan Black"]),
		umaBanner(4, "2026-01-01T00:00:00Z", [43, "Gold Ship"]),
		umaBanner(5, "2026-03-01T00:00:00Z", [43, "Gold Ship"]),
	],
	supportBanners: [supportBanner(6, "2026-11-01T00:00:00Z", 301, "Super Creek")],
	stepUps: [],
	events: [
		{ id: 21, event_type: "champions_meeting", cm_number: 21, name: "Champions Meeting 21 Capricorn Cup", start_date: "2026-10-31T22:00:00Z" },
	] as unknown as RaceEvent[],
	scenarios: [{ id: 3, name: "Trackblazer" }] as Scenario[],
	campaigns: [],
	skills: [
		{ id: 7, name: "Groundwork", description: "Speed up early on.", game_id: 200011, other_names: ["Preparations"] },
	] as CatalogueSkill[],
}

// The PvP catalogue's outfits and cards: early access's Encyclopedia entries.
const CATALOGUE_UMAS = [
	{ id: 41, name: "Kitasan Black", game_id: 106801, portrait: "/kita.png", image: null, on_global: true },
	{ id: 44, name: "Rice Shower", game_id: 103001, portrait: null, image: null, on_global: false, title: "[Rose Dreams]" },
	{ id: 45, name: "No Game Id", game_id: null, portrait: null, image: null, on_global: true },
] as unknown as CatalogueUma[]
const CATALOGUE_CARDS = [
	{ id: 301, name: "Super Creek", title: "[Breakfast]", game_id: 30045, image: null, rarity: 3, card_type: "stamina", on_global: true },
	{ id: 302, name: "Best SSR Speed", title: "", game_id: 31000, image: null, rarity: 3, card_type: "speed", placeholder: true },
] as unknown as CatalogueSupportCard[]

const entries = buildSearchEntries(SOURCES, NOW, false)
const search = createSearcher(entries)
const titles = (query: string) => search(query).map((entry) => entry.title)

describe("the site search", () => {
	it("finds a name typed from memory", () => {
		expect(titles("kitsan blk")[0]).toBe("Kitasan Black")
		expect(titles("satono")[0]).toBe("Satono Diamond")
		expect(titles("groundwrk")[0]).toBe("Groundwork")
	})

	it("lists a card once, opening the next banner still to end", () => {
		const found = search("kitasan").filter((entry) => entry.title === "Kitasan Black")
		expect(found).toHaveLength(1)
		expect(found[0].href).toBe("/app/timeline?focus=banner-20")
		expect(found[0].detail).toBe("Uma banner · ends 2026/11/20")
	})

	it("opens the latest banner when all of them have ended", () => {
		expect(entries.find((entry) => entry.id === "uma-43")?.href).toBe("/app/timeline?focus=banner-50")
	})

	it("finds an event by its short name and opens its guide", () => {
		const [event] = search("cm 21")
		expect(event.title).toBe("Champions Meeting 21 Capricorn Cup")
		expect(event.href).toBe("/app/pvp?event=cm-21")
	})

	it("finds a page by a word that isn't in its name", () => {
		expect(titles("patch notes")[0]).toBe("Changelog")
	})

	it("finds a skill by a name it never shows, and by its id alone", () => {
		expect(titles("preparations")[0]).toBe("Groundwork")
		expect(titles("200011")).toEqual(["Groundwork"])
		expect(titles("200012")).toEqual([])
	})

	it("sends a skill nowhere for anyone without early access: it opens in the palette", () => {
		expect(entries.find((entry) => entry.kind === "skill")?.href).toBeUndefined()
	})

	it("lists only umas and cards on a banner for anyone without early access", () => {
		const withCatalogue = buildSearchEntries({ ...SOURCES, umas: CATALOGUE_UMAS, cards: CATALOGUE_CARDS }, NOW, false)
		expect(withCatalogue.some((entry) => entry.title === "Rice Shower")).toBe(false)
	})

	it("offers Rankings to early access only", () => {
		expect(pageEntries(false).some((entry) => entry.title === "Rankings")).toBe(false)
		expect(pageEntries(true).some((entry) => entry.title === "Rankings")).toBe(true)
	})

	it("offers the Encyclopedia and the Skills page to early access only", () => {
		expect(pageEntries(false).some((entry) => entry.title === "Encyclopedia")).toBe(false)
		expect(pageEntries(true).find((entry) => entry.title === "Encyclopedia")?.href).toBe("/app/umas")
	})

	it("names who teaches a skill, each once", () => {
		const catalogue = {
			umas: [
				{ name: "Oguri Cap", skills: [{ skill: 7 }] },
				{ name: "Oguri Cap", skills: [{ skill: 7 }] },
				{ name: "Gold Ship", skills: [] },
			],
			support_cards: [{ name: "Super Creek", skills: [{ skill: 7 }] }],
		} as unknown as PvpCatalogue
		expect(skillTeachers(7, catalogue)).toEqual({ umas: ["Oguri Cap"], cards: ["Super Creek"] })
	})
})

describe("the site search with early access (the Encyclopedia)", () => {
	const early = buildSearchEntries({ ...SOURCES, umas: CATALOGUE_UMAS, cards: CATALOGUE_CARDS }, NOW, true)
	const find = (id: string) => early.find((entry) => entry.id === id)

	it("opens an uma's page, keeping her banner in the detail line", () => {
		expect(find("uma-41")).toMatchObject({ href: "/app/umas/106801", detail: "Uma banner · ends 2026/11/20" })
	})

	it("lists an uma with no banner, and says she is JP only", () => {
		expect(find("uma-44")).toMatchObject({ href: "/app/umas/103001", detail: "Uma · JP only" })
		expect(find("uma-45")).toBeUndefined()
	})

	it("opens a card's page, with its title and type, never a placeholder", () => {
		expect(find("card-301")?.href).toBe("/app/cards/30045")
		expect(find("card-301")?.detail).toMatch(/^\[Breakfast\] · SSR · Stamina · Support banner · ends/)
		expect(find("card-302")).toBeUndefined()
	})

	it("opens a skill's page", () => {
		expect(early.find((entry) => entry.kind === "skill")?.href).toBe("/app/skills/200011")
	})

	it("finds an uma by her outfit's title, Global's or UmaTL's", () => {
		const searchEarly = createSearcher(early)
		expect(searchEarly("rose dreams").map((entry) => entry.id)).toContain("uma-44")
	})
})
