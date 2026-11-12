import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AuthContext, type AuthContextType } from "../services/AuthContext"
import { SkillPage } from "../components/skills/SkillPage"
import { clearAuthToken, setAuthToken } from "../services/authToken"
import { TestQueryProvider } from "../test/TestQueryProvider"
import type { SkillDetailData } from "../types/skills"
import { keepCard } from "../utils/encyclopedia"

/** One skill's Encyclopedia page (/app/skills/<game id>). */

const base = {
	image: null, tier: 1, version: "○ white", is_evolved: false, availability: "global" as const, uses_translation: false,
}

const DETAIL: SkillDetailData = {
	...base, id: 3, game_id: 100101111, name: "Gluttonous Ruler", rarity: 6, group_id: 1001011, version: "evolved",
	is_evolved: true, availability: "announced", other_names: ["Big Eater"], cost: null, type: "recovery",
	owners: ["Special Week"],
	pair: null,
	description: "Recover endurance mid-race.",
	readable: {
		wit_check: true, complete: true,
		slots: [{ after: { all: [], any: [] }, when: { all: [{ text: "At a random moment mid-race", raw: false }], any: [] },
			effects: [{ text: "Recovers 5.5% endurance", raw: false }], duration: null, cooldown: "Once per race" }],
	},
	sources: {
		umas: [{ id: 7, name: "Special Week", game_id: 100101, image: null, source: "evolved", level: 3, on_global: true }],
		cards: [
			{ id: 9, name: "Kitasan Black", game_id: 30028, image: null, source: "hint", on_global: true, rarity: 3, card_type: "speed" },
			{ id: 10, name: "Nice Nature", game_id: 10021, image: null, source: "hint", on_global: true, rarity: 1, card_type: "wit" },
		],
	},
	evolution: {
		from: { ...base, id: 2, game_id: 200002, name: "Gourmand", rarity: 2, group_id: 2, version: "◎ gold", cost: 180 },
		into: [],
		conditions: [
			{ text: "Attain at least 600 Stamina", uses_translation: false, is_japanese: false },
			{ text: "スキルを3個", uses_translation: false, is_japanese: true },
		],
		scenario: null,
	},
	versions: [],
}

const fetchMock = vi.fn()

function renderAt(path: string) {
	const auth = { isLoggedIn: true, status: "ready", account: { early_access: true, oshi_uma_ids: [] } } as unknown as AuthContextType
	return render(
		<AuthContext.Provider value={auth}>
			<TestQueryProvider>
				<MemoryRouter initialEntries={[path]}>
					<Routes>
						<Route path="/app/skills/:gameId" element={<SkillPage />} />
					</Routes>
				</MemoryRouter>
			</TestQueryProvider>
		</AuthContext.Provider>
	)
}

describe("SkillPage", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", fetchMock)
		fetchMock.mockImplementation((url: string) =>
			Promise.resolve(url.endsWith("/skills/100101111")
				? new Response(JSON.stringify(DETAIL), { status: 200 })
				: new Response("{}", { status: 404 }))
		)
	})
	afterEach(() => {
		vi.unstubAllGlobals()
		fetchMock.mockReset()
	})

	it("reads the skill in full, with its uma named", async () => {
		const { container } = renderAt("/app/skills/100101111")
		expect(await screen.findByRole("heading", { level: 1, name: /Gluttonous Ruler/ })).toBeInTheDocument()
		expect(container).toHaveTextContent("evolved · Special Week")
		expect(container).toHaveTextContent("When: At a random moment mid-race")
		expect(container).toHaveTextContent("Does: Recovers 5.5% endurance once per race")
		expect(container).toHaveTextContent("Rolls Wit check.")
		expect(container).toHaveTextContent("Coming to global")
		expect(container).toHaveTextContent("スキルを3個 (in Japanese, no translation yet)")
	})

	it("links its base, its umas and its cards to their pages", async () => {
		renderAt("/app/skills/100101111")
		expect(await screen.findByRole("link", { name: /Gourmand/ })).toHaveAttribute("href", "/app/skills/200002")
		expect(screen.getByRole("link", { name: /Special Week.*Evolution, level 3/ })).toHaveAttribute("href", "/app/umas/100101")
		expect(screen.getByRole("link", { name: /Kitasan Black/ })).toHaveAttribute("href", "/app/cards/30028")
	})

	it("hides R cards on request", async () => {
		renderAt("/app/skills/100101111")
		expect(await screen.findByRole("heading", { name: "Cards that teach it (2)" })).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "Hide R" }))
		expect(screen.getByRole("heading", { name: "Cards that teach it (1)" })).toBeInTheDocument()
		expect(screen.queryByRole("link", { name: /Nice Nature/ })).not.toBeInTheDocument()
	})

	it("never shows the names search alone may match", async () => {
		const { container } = renderAt("/app/skills/100101111")
		await screen.findByRole("heading", { level: 1, name: /Gluttonous Ruler/ })
		expect(container).not.toHaveTextContent("Big Eater")
	})

	it("says so for an id with no skill", async () => {
		renderAt("/app/skills/999999")
		expect(await screen.findByText(/There's no page for that/)).toBeInTheDocument()
	})

	it("sends the token", async () => {
		setAuthToken("reader-token")
		try {
			renderAt("/app/skills/100101111")
			await screen.findByRole("heading", { level: 1, name: /Gluttonous Ruler/ })
			expect(fetchMock.mock.calls[0][1]?.headers).toEqual({ Authorization: "Token reader-token" })
		} finally {
			clearAuthToken()
		}
	})
})

describe("keepCard", () => {
	it("drops R, or R and SR, and keeps a card with no rarity", () => {
		expect(keepCard({ rarity: 1 }, "r")).toBe(false)
		expect(keepCard({ rarity: 2 }, "r")).toBe(true)
		expect(keepCard({ rarity: 2 }, "sr")).toBe(false)
		expect(keepCard({ rarity: null }, "sr")).toBe(true)
	})
})
