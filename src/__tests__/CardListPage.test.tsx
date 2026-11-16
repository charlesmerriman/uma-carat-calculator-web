import { fireEvent, render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AuthContext, type AuthContextType } from "../services/AuthContext"
import { CardListPage } from "../components/encyclopedia/CardListPage"
import { TestQueryProvider } from "../test/TestQueryProvider"
import type { PvpCatalogue } from "../types/pvpTeam"
import type { CardEffectsData } from "../types/encyclopedia"

/** The card list (/app/cards): its "By effect" sort (notes/card-effect-sort-plan.md). */

const card = (id: number, gameId: number, name: string) => ({
	id, game_id: gameId, name, title: "", image: null, image_borderless: null, card_type: "speed", rarity: 3, on_global: true,
})

const CATALOGUE = {
	umas: [],
	support_cards: [card(1, 30001, "Agnes Tachyon"), card(2, 30002, "Biko Pegasus"), card(3, 30003, "Curren Chan")],
	skills: [],
} as unknown as PvpCatalogue

vi.mock("../services/pvpTeamFetchCalls", () => ({ loadPvpCatalogue: () => Promise.resolve(CATALOGUE) }))

const caps = [30, 35, 40, 45, 50]
const EFFECTS: CardEffectsData = {
	types: [{ type: 15, name: "Race Bonus", format: "percent" }, { type: 30, name: "Skill Point Bonus", format: "number" }],
	cards: {
		"1": { caps, effects: { "15": [5, 5, 5, 5, 5] }, unique: null },
		"2": { caps, effects: { "15": [10, 10, 10, 10, 10] }, unique: { level: 30, values: {}, conditional: true } },
		"3": { caps, effects: { "30": [1, 1, 2, 2, 3] }, unique: null },
	},
}

const fetchMock = vi.fn()

function renderList() {
	const auth = { isLoggedIn: true, status: "ready", account: { early_access: true, oshi_uma_ids: [] } } as unknown as AuthContextType
	return render(
		<AuthContext.Provider value={auth}>
			<TestQueryProvider>
				<MemoryRouter>
					<CardListPage />
				</MemoryRouter>
			</TestQueryProvider>
		</AuthContext.Provider>
	)
}

const tileNames = () => screen.getAllByRole("listitem").map((item) => within(item).getByRole("link").textContent ?? "")

beforeEach(() => {
	vi.stubGlobal("fetch", fetchMock)
	fetchMock.mockImplementation((url: string) =>
		Promise.resolve(url.endsWith("/encyclopedia/card-effects")
			? new Response(JSON.stringify(EFFECTS), { status: 200 })
			: new Response("{}", { status: 404 }))
	)
})
afterEach(() => {
	vi.unstubAllGlobals()
	fetchMock.mockReset()
})

describe("CardListPage, by effect", () => {
	it("asks for the effects only once the sort is picked, then orders by the effect with its value on each tile", async () => {
		renderList()
		await screen.findByText("Agnes Tachyon")
		expect(fetchMock.mock.calls.some(([url]) => String(url).includes("card-effects"))).toBe(false)

		fireEvent.click(screen.getByRole("button", { name: "By effect" }))
		// Race Bonus is the first type: Biko (10%) before Agnes (5%); Curren has none and goes last.
		expect(await screen.findByText("Race Bonus 10%")).toBeInTheDocument()
		const order = tileNames()
		expect(order[0]).toContain("Biko Pegasus")
		expect(order[1]).toContain("Agnes Tachyon")
		expect(order[2]).toContain("Curren Chan")
		// Biko's unique has a part nobody decoded.
		expect(screen.getByTitle(/may give more/)).toHaveTextContent("+?")

		fireEvent.change(screen.getByRole("combobox", { name: "Effect" }), { target: { value: "30" } })
		expect(await screen.findByText("Skill Point Bonus 3")).toBeInTheDocument()
		expect(tileNames()[0]).toContain("Curren Chan")
	})
})
