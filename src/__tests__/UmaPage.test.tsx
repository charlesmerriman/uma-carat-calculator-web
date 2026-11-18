import { render, screen, within } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AuthContext, type AuthContextType } from "../services/AuthContext"
import { UmaPage } from "../components/encyclopedia/UmaPage"
import { TestQueryProvider } from "../test/TestQueryProvider"
import type { PageSkill, UmaPageData } from "../types/encyclopedia"

/** One outfit's Encyclopedia page (/app/umas/<game id>). */

const skill = (gameId: number, name: string, source: string, overrides: Partial<PageSkill> = {}): PageSkill => ({
	id: gameId, game_id: gameId, name, image: null, rarity: 1, tier: 1, group_id: gameId, version: "○ white",
	is_evolved: false, availability: "global", uses_translation: false, cost: 120, type: "velocity",
	source, level: null, evolves_from: null, ...overrides,
})

const SPECIAL_WEEK: UmaPageData = {
	id: 7, game_id: 100101, name: "Special Week", title: "[Special Dreamer]", jp_name: "スペシャルウィーク",
	jp_title: "[スペシャルドリーマー]", portrait: null, image: null, rarity: 3, running_style: 3, on_global: true,
	purpose: "Great late surger.",
	apt: { turf: 7, dirt: 1, short: 2, mile: 5, medium: 7, long: 7, front: 1, pace: 7, late: 7, end: 5 },
	base: { speed: 83, stamina: 88, power: 98, guts: 90, wit: 91 },
	growth: { speed: 0, stamina: 20, power: 0, guts: 0, wit: 10 },
	star_stats: [
		{ star: 3, speed: 83, stamina: 88, power: 98, guts: 90, wit: 91 },
		{ star: 5, speed: 102, stamina: 108, power: 120, guts: 110, wit: 110 },
	],
	skills: [
		skill(100011, "Shooting Star", "unique", { rarity: 5, cost: null }),
		skill(200011, "Gourmand", "awakening", { rarity: 2, level: 3, cost: 180 }),
		skill(100101111, "Gluttonous Ruler", "evolved", {
			rarity: 6, is_evolved: true, evolves_from: 200011,
			conditions: [
				{ text: "Reach 600 Stamina.", uses_translation: true, is_japanese: false },
				{ text: "スキルを3個", uses_translation: false, is_japanese: true },
			],
		}),
	],
	outfits: [{ id: 8, game_id: 100102, name: "Special Week (Summer)", title: "[Ocean Line Blue]", portrait: null, rarity: 3, on_global: false }],
	cards: [{ id: 9, game_id: 30001, name: "Special Week", title: "[The Brightest Star]", image: null, card_type: "guts", rarity: 3, on_global: true }],
}

const fetchMock = vi.fn()

function renderAt(path: string, earlyAccess = true) {
	const auth = { isLoggedIn: true, status: "ready", account: { early_access: earlyAccess, oshi_uma_ids: [] } } as unknown as AuthContextType
	return render(
		<AuthContext.Provider value={auth}>
			<TestQueryProvider>
				<MemoryRouter initialEntries={[path]}>
					<Routes>
						<Route path="/app/umas/:gameId" element={<UmaPage />} />
					</Routes>
				</MemoryRouter>
			</TestQueryProvider>
		</AuthContext.Provider>
	)
}

describe("UmaPage", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", fetchMock)
		fetchMock.mockImplementation((url: string) =>
			Promise.resolve(url.endsWith("/encyclopedia/umas/100101")
				? new Response(JSON.stringify(SPECIAL_WEEK), { status: 200 })
				: new Response("{}", { status: 404 }))
		)
	})
	afterEach(() => {
		vi.unstubAllGlobals()
		fetchMock.mockReset()
	})

	it("shows who she is, her aptitudes and stats, and every skill as a link", async () => {
		renderAt("/app/umas/100101")
		expect(await screen.findByRole("heading", { level: 1, name: "Special Week" })).toBeInTheDocument()
		expect(screen.getByText("[スペシャルドリーマー] スペシャルウィーク")).toBeInTheDocument()
		expect(screen.getByText("Late Surger")).toBeInTheDocument()
		expect(screen.getByText("Great late surger.")).toBeInTheDocument()
		// Grouped the way the game teaches them, each linking to its page.
		const unique = screen.getByRole("heading", { name: "Unique skill" }).parentElement as HTMLElement
		expect(within(unique).getByRole("link", { name: /Shooting Star/ })).toHaveAttribute("href", expect.stringContaining("100011"))
		expect(screen.getByRole("link", { name: /Gourmand.*level 3.*180 SP/ })).toBeInTheDocument()
		// An evolution names the gold it grows from.
		expect(screen.getByRole("link", { name: /Gluttonous Ruler.*from Gourmand/ })).toBeInTheDocument()
	})

	it("lists each evolution's unlock conditions under it", async () => {
		renderAt("/app/umas/100101")
		const evolution = (await screen.findByRole("link", { name: /Gluttonous Ruler/ })).closest("li") as HTMLElement
		expect(within(evolution).getByText("Reach 600 Stamina.")).toBeInTheDocument()
		expect(evolution).toHaveTextContent("スキルを3個 (in Japanese, no translation yet)")
		// Only an evolution has any. It hangs off the gold skill it comes from, so
		// the list sits inside the evolution's own row, never straight under the gold's.
		const gold = screen.getByRole("link", { name: /^Gourmand/ }).closest("li") as HTMLElement
		expect(gold.querySelector(":scope > .enc-unlock")).toBeNull()
		expect(gold).toContainElement(evolution)
	})

	it("shows both unique skills of an outfit that starts below three stars, each with what it does", async () => {
		const twoStar: UmaPageData = {
			...SPECIAL_WEEK,
			skills: [
				skill(10011, "Warning Shot!", "unique", { rarity: 3, cost: null, level: 2, description: "Slightly increase velocity." }),
				skill(100011, "Anchors Aweigh!", "unique", { rarity: 5, cost: null, level: 3, description: "Moderately increase velocity." }),
				// An evolution whose base isn't an awakening skill here is listed, never dropped.
				skill(100101121, "Stray Star", "evolved", { rarity: 6, is_evolved: true, evolves_from: 999999 }),
			],
		}
		fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(twoStar), { status: 200 })))
		renderAt("/app/umas/100101")
		const uniques = (await screen.findByRole("heading", { name: "Unique skills" })).parentElement as HTMLElement
		expect(within(uniques).getByRole("link", { name: /Warning Shot!.*Slightly increase velocity\..*From ★2/ })).toBeInTheDocument()
		expect(within(uniques).getByRole("link", { name: /Anchors Aweigh!.*From ★3/ })).toBeInTheDocument()
		const loose = screen.getByRole("heading", { name: "Evolutions" }).parentElement as HTMLElement
		expect(within(loose).getByRole("link", { name: /Stray Star/ })).toBeInTheDocument()
	})

	it("puts the awakening levels JP added later, 6 and 7, on a row of their own", async () => {
		// The owner, 2026-11-17: never squeezed onto the end of 2 to 5.
		const raised: UmaPageData = {
			...SPECIAL_WEEK,
			skills: [2, 3, 4, 5, 6, 7].map((level) =>
				skill(200000 + level, `Level ${level} Skill`, "awakening", { level, availability: level > 5 ? "jp" : "global" })),
		}
		fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(raised), { status: 200 })))
		const { container } = renderAt("/app/umas/100101")
		await screen.findByText("Added later")
		const [first, later] = [...container.querySelectorAll("ol.enc-awake")]
		expect(within(first as HTMLElement).getAllByRole("link").map((link) => link.textContent)).toEqual(
			[2, 3, 4, 5].map((level) => expect.stringContaining(`Level ${level} Skill`)))
		expect(within(later as HTMLElement).getAllByRole("link").map((link) => link.textContent)).toEqual(
			[6, 7].map((level) => expect.stringContaining(`Level ${level} Skill`)))
	})

	it("switches the stats between star levels", async () => {
		renderAt("/app/umas/100101")
		await screen.findByRole("heading", { level: 1, name: "Special Week" })
		const stats = screen.getByRole("heading", { name: "Stats" }).closest("section") as HTMLElement
		expect(within(stats).getByText("83")).toBeInTheDocument()
		within(stats).getByRole("button", { name: "★5" }).click()
		expect(await within(stats).findByText("102")).toBeInTheDocument()
	})

	it("links her other outfits and her cards", async () => {
		renderAt("/app/umas/100101")
		expect(await screen.findByRole("link", { name: /Special Week \(Summer\)/ })).toHaveAttribute("href", "/app/umas/100102")
		expect(screen.getByRole("link", { name: /The Brightest Star/ })).toHaveAttribute("href", "/app/cards/30001")
	})

	it("says you own her, with your stars, when she's in your Collection", async () => {
		fetchMock.mockImplementation((url: string) =>
			Promise.resolve(url.endsWith("/roster")
				? new Response(JSON.stringify({ umas: [{ uma: 7, stars: 5 }], support_cards: [] }), { status: 200 })
				: new Response(JSON.stringify(SPECIAL_WEEK), { status: 200 }))
		)
		renderAt("/app/umas/100101")
		expect(await screen.findByText("You own this")).toBeInTheDocument()
		expect(screen.getByText("★★★★★")).toBeInTheDocument()
		expect(screen.getByRole("link", { name: "Open your Collection" })).toHaveAttribute("href", "/app/collection?tab=umas")
	})

	it("shows your hint levels on her own skills, from your imported Collection", async () => {
		fetchMock.mockImplementation((url: string) =>
			Promise.resolve(url.endsWith("/roster")
				// The evolution's id is in there too: only innate and awakening rows read it.
				? new Response(JSON.stringify({ umas: [{ uma: 7, stars: 5, hint_levels: { "200011": 3, "100101111": 2 } }], support_cards: [] }), { status: 200 })
				: new Response(JSON.stringify(SPECIAL_WEEK), { status: 200 }))
		)
		renderAt("/app/umas/100101")
		// Gourmand's 180 SP, 30% off at level 3 (Daptrius: 10% a level, off the base cost).
		expect(await screen.findByText("Hint Lv 3 (-30%)")).toBeInTheDocument()
		expect(screen.getByTitle("180 SP before your hint discount")).toHaveTextContent("126 SP")
		expect(screen.queryByText(/Hint Lv 2/)).not.toBeInTheDocument()
	})

	it("says so for an id with no page", async () => {
		renderAt("/app/umas/999999")
		expect(await screen.findByText(/There's no page for that/)).toBeInTheDocument()
	})

	it("is for supporters first, and asks the API nothing for anyone else", () => {
		renderAt("/app/umas/100101", false)
		expect(screen.getByText(/The Encyclopedia is for our Patreon supporters for now/)).toBeInTheDocument()
		expect(fetchMock).not.toHaveBeenCalled()
	})
})
