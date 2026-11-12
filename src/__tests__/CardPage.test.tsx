import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AuthContext, type AuthContextType } from "../services/AuthContext"
import { CardPage } from "../components/encyclopedia/CardPage"
import { TestQueryProvider } from "../test/TestQueryProvider"
import type { CardPageData, PageSkill } from "../types/encyclopedia"

/** One support card's Encyclopedia page (/app/cards/<game id>). */

const skill = (gameId: number, name: string, source: string): PageSkill => ({
	id: gameId, game_id: gameId, name, image: null, rarity: 1, tier: 1, group_id: gameId, version: "○ white",
	is_evolved: false, availability: "global", uses_translation: false, cost: 120, type: "velocity",
	source, level: null, evolves_from: null,
})

const CARD: CardPageData = {
	id: 9, game_id: 30001, name: "Special Week", title: "[The Brightest Star]", jp_name: "スペシャルウィーク",
	jp_title: "[日本一のスター]", image: null, image_borderless: null, card_type: "guts", rarity: 3, character_id: 1001,
	on_global: true, released_at: "2025-06-26T22:00:00Z", group_members: [], purpose: "",
	skills: [skill(200011, "Corner Adept", "hint"), skill(200021, "Groundwork", "event")],
	outfits: [{ id: 7, game_id: 100101, name: "Special Week", title: "[Special Dreamer]", portrait: null, rarity: 3, on_global: true }],
	cards: [],
}

const fetchMock = vi.fn()

function renderAt(path: string) {
	const auth = { isLoggedIn: true, status: "ready", account: { early_access: true, oshi_uma_ids: [] } } as unknown as AuthContextType
	return render(
		<AuthContext.Provider value={auth}>
			<TestQueryProvider>
				<MemoryRouter initialEntries={[path]}>
					<Routes>
						<Route path="/app/cards/:gameId" element={<CardPage />} />
					</Routes>
				</MemoryRouter>
			</TestQueryProvider>
		</AuthContext.Provider>
	)
}

describe("CardPage", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", fetchMock)
		fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(CARD), { status: 200 })))
	})
	afterEach(() => {
		vi.unstubAllGlobals()
		fetchMock.mockReset()
	})

	it("shows the card, its hints and event skills, and its trainee", async () => {
		renderAt("/app/cards/30001")
		expect(await screen.findByRole("heading", { level: 1, name: "Special Week" })).toBeInTheDocument()
		expect(screen.getByText("SSR · Guts")).toBeInTheDocument()
		expect(screen.getByRole("heading", { name: "Skill hints" })).toBeInTheDocument()
		expect(screen.getByRole("link", { name: /Corner Adept/ })).toBeInTheDocument()
		expect(screen.getByRole("heading", { name: "Skills from events" })).toBeInTheDocument()
		expect(screen.getByRole("link", { name: /Special Week.*Special Dreamer/ })).toHaveAttribute("href", "/app/umas/100101")
	})

	it("dates a card on no banner by the game's own Global date", async () => {
		renderAt("/app/cards/30001")
		expect(await screen.findByText(/^Global /)).toBeInTheDocument()
	})

	it("leaves out a section with nothing in it", async () => {
		renderAt("/app/cards/30001")
		await screen.findByRole("heading", { level: 1, name: "Special Week" })
		expect(screen.queryByRole("heading", { name: /other cards/ })).not.toBeInTheDocument()
		expect(screen.queryByRole("heading", { name: "Banners" })).not.toBeInTheDocument()
	})
})
