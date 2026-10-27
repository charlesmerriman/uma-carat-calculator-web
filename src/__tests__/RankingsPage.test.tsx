import { fireEvent, render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AuthContext, type AuthContextType } from "../services/AuthContext"
import { RankingsPage } from "../components/rankings/RankingsPage"
import type { RaceEvent } from "../types"
import type { GuideRankingsPayload } from "../types/guideRankings"

/**
 * The Rankings page (/app/rankings): who sees it, and the Guide rankings
 * tab drawing utils/guideRankings.ts's counts with the sheet's tick boxes.
 * The counting rules themselves are guideRankings.test.ts.
 */

const CM21 = {
	id: 21, event_type: "champions_meeting", name: "Champions Meeting 21 Libra Cup", cm_number: 21,
	start_date: "2026-10-28T00:00:00Z", end_date: "2026-11-03T00:00:00Z",
} as unknown as RaceEvent

vi.mock("../services/CalculatorContext", () => ({
	useCalculatorData: () => ({ championsMeetingData: [CM21], leagueOfHeroesData: [] }),
}))
vi.mock("../hooks/useOshiIds", () => ({ useOshiIds: () => new Set<number>() }))
vi.mock("../hooks/usePvpCatalogue", () => ({
	usePvpCatalogue: () => ({
		status: "ready",
		umas: [],
		cards: [],
		umasById: new Map([[41, { id: 41, name: "Maruzensky", portrait: null, image: null }]]),
		cardsById: new Map([
			[1, { id: 1, name: "Kitasan Black", card_type: "speed", image: null }],
			[2, { id: 2, name: "Fine Motion", card_type: "wit", image: null }],
		]),
	}),
}))

const PAYLOAD: GuideRankingsPayload = {
	generated_at: "2026-10-27T20:00:00Z",
	scenarios: [{ id: 12, name: "Trackblazer" }],
	guides: [{
		kind: "cm",
		event: 21,
		scenario: 12,
		cards: [
			{ card: 1, deck: 1, style: "front", tier: "beginner", role: "main" },
			{ card: 1, deck: 2, style: "front", tier: "whale", role: "main" },
			{ card: 2, deck: 2, style: "front", tier: "whale", role: "borrow" },
		],
		umas: [{ uma: 41, style: "front", stars: 3 }],
	}],
}

const fetchMock = vi.fn()

function renderPage(earlyAccess: boolean) {
	const value = { isLoggedIn: true, status: "ready", account: { early_access: earlyAccess } } as unknown as AuthContextType
	return render(
		<AuthContext.Provider value={value}>
			<MemoryRouter initialEntries={["/app/rankings"]}>
				<RankingsPage />
			</MemoryRouter>
		</AuthContext.Provider>
	)
}

beforeEach(() => {
	fetchMock.mockReset()
	fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(PAYLOAD), { status: 200 })))
	vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
	vi.unstubAllGlobals()
})

describe("RankingsPage", () => {
	it("is a note for anyone without early access, and fetches nothing", () => {
		renderPage(false)
		expect(screen.getByText(/Rankings are for our Patreon supporters for now/)).toBeInTheDocument()
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it("ranks the guides' cards with counts and shares", async () => {
		renderPage(true)
		const overall = await screen.findByRole("region", { name: "Overall" })
		const rows = within(overall).getAllByRole("listitem")
		expect(rows[0]).toHaveTextContent("Kitasan Black")
		expect(rows[0]).toHaveTextContent("2 decks · 100%")
		expect(rows[1]).toHaveTextContent("Fine Motion")
		expect(rows[1]).toHaveTextContent("1 borrowed")
		expect(within(screen.getByRole("region", { name: "Umas" })).getByText("Recommended 1 time · 100%")).toBeInTheDocument()
		expect(fetchMock.mock.calls[0][0]).toMatch(/\/rankings\/guides$/)
	})

	it("recounts when a tick box goes off", async () => {
		renderPage(true)
		const overall = await screen.findByRole("region", { name: "Overall" })
		fireEvent.click(screen.getByRole("button", { name: "Whale", pressed: true }))
		const rows = within(overall).getAllByRole("listitem")
		expect(rows).toHaveLength(1)
		expect(rows[0]).toHaveTextContent("1 deck · 100%")
	})

	it("finds one card's count with the card search", async () => {
		renderPage(true)
		fireEvent.change(await screen.findByRole("searchbox", { name: "Search for a card" }), { target: { value: "fine" } })
		expect(within(screen.getByRole("region", { name: "Card search" })).getByText("#2 · 1 deck · 50%")).toBeInTheDocument()
	})
})
