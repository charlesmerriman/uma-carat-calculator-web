import { fireEvent, render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AuthContext, type AuthContextType } from "../services/AuthContext"
import { RankingsPage } from "../components/rankings/RankingsPage"
import type { RaceEvent } from "../types"
import type { GuideRankingsPayload } from "../types/guideRankings"
import type { PullPlanRankingsPayload } from "../types/pullPlanRankings"
import type { PlayersRankingsPayload, PvpRankingsPayload } from "../types/rankingsTabs"
import { resetRankingsPinForTests } from "../services/rankingsPinStore"

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
// The chart is Recharts in its own chunk; here only that the tab draws it.
vi.mock("../components/rankings/DemandChart", () => ({ default: () => <div data-testid="demand-chart" /> }))
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

const PULL_PLANS: PullPlanRankingsPayload = {
	generated_at: "2026-10-27T20:00:00Z",
	banners: [{
		type: "uma", unit: "pulls", id: 88, name: "Gentildonna", start_date: "2026-11-05T00:00:00Z",
		end_date: "2026-11-15T00:00:00Z", predicted: true, status: "upcoming",
		planners: 5807, total: 958155, average: 165, median: 150,
	}],
	demand: [{ month: "2026-11", banners: 6, planners: 9000, total_pulls: 1200000, excluded: 0, step_up_planners: 40 }],
}

const PVP: PvpRankingsPayload = {
	generated_at: "2026-10-27T20:00:00Z",
	built: { teams: 4, decks: 12, umas: [{ uma: 41, teams: 3, styles: { pace: 3 } }], cards: [{ card: 1, decks: 6, borrows: 2 }] },
	runs: { players: 2, races: 30, min_races: 20, rows: [{ uma: 41, style: "pace", races: 30, wins: 12 }] },
}

const PLAYERS: PlayersRankingsPayload = {
	generated_at: "2026-10-27T20:00:00Z",
	engaged: 200,
	favourites: [{ uma: 41, people: 50 }],
	ranks: [{ label: "Team Trials", people: 100, rows: [{ name: "Class 6", people: 38 }] }],
	income: [{ key: "daily_carat", label: "Daily Carat Pack", people: 84 }],
	selectors: [{ campaign: "1st Anniversary", label: "SSR Support Selector", buyers: 30, picked: 20, top: [{ card: 2, people: 9 }] }],
}

const BODIES: Array<[RegExp, unknown]> = [
	[/\/pull-plans$/, PULL_PLANS],
	[/\/rankings\/pvp\/cm\/21$/, PVP],
	[/\/players$/, PLAYERS],
]

const fetchMock = vi.fn()

function renderPage(earlyAccess: boolean, { editor = false, url = "/app/rankings" } = {}) {
	const value = {
		isLoggedIn: true, status: "ready", account: { early_access: earlyAccess, guide_editor: editor },
	} as unknown as AuthContextType
	return render(
		<AuthContext.Provider value={value}>
			<MemoryRouter initialEntries={[url]}>
				<RankingsPage />
			</MemoryRouter>
		</AuthContext.Provider>
	)
}

beforeEach(() => {
	fetchMock.mockReset()
	fetchMock.mockImplementation((url: string) =>
		Promise.resolve(new Response(JSON.stringify(BODIES.find(([pattern]) => pattern.test(url))?.[1] ?? PAYLOAD), { status: 200 }))
	)
	vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
	vi.unstubAllGlobals()
	localStorage.clear()
	resetRankingsPinForTests()
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

	it("keeps Pull plans to the Raptive gate (guide editors)", () => {
		const { unmount } = renderPage(true, { url: "/app/rankings?view=pull-plans" })
		expect(screen.queryByRole("tab", { name: "Pull plans" })).not.toBeInTheDocument()
		// The address alone doesn't open it: the first tab shows.
		expect(screen.getByRole("tab", { name: "Guide rankings", selected: true })).toBeInTheDocument()
		unmount()
		renderPage(true, { editor: true, url: "/app/rankings?view=pull-plans" })
		expect(screen.getByRole("tab", { name: "Pull plans", selected: true })).toBeInTheDocument()
	})

	it("draws the planned banners with a typical figure, and the demand by month", async () => {
		renderPage(true, { editor: true, url: "/app/rankings?view=pull-plans" })
		const table = await screen.findByRole("region", { name: "Banners players plan" })
		const row = within(table).getByText("Gentildonna").closest("tr")!
		expect(row).toHaveTextContent("5,807")
		expect(row).toHaveTextContent("150")
		expect(row).toHaveTextContent("(predicted)")
		expect(await screen.findByTestId("demand-chart")).toBeInTheDocument()
		expect(within(screen.getByRole("region", { name: "Demand by month" })).getByText("2026/11")).toBeInTheDocument()
	})

	it("shows what players build and what wins on the PvP tab", async () => {
		renderPage(true, { url: "/app/rankings?view=pvp&event=cm-21" })
		expect(await screen.findByText(/posted or not: 4 teams/)).toBeInTheDocument()
		expect(within(screen.getByRole("region", { name: "Support cards" })).getByText("6 decks · 50% · 2 borrowed")).toBeInTheDocument()
		const wins = within(screen.getByRole("region", { name: "What wins" }))
		expect(wins.getByText("Maruzensky").closest("tr")).toHaveTextContent("40%")
	})

	it("shows the four players panels", async () => {
		renderPage(true, { url: "/app/rankings?view=players" })
		const favourites = await screen.findByRole("region", { name: "Favourite umas" })
		expect(within(favourites).getByText("50 players · 25%")).toBeInTheDocument()
		expect(within(screen.getByRole("region", { name: "Team Trials" })).getByText("38%")).toBeInTheDocument()
		expect(within(screen.getByRole("region", { name: "Income options" })).getByText("42%")).toBeInTheDocument()
		expect(within(screen.getByRole("region", { name: "Campaign selectors" })).getByText("Fine Motion 9")).toBeInTheDocument()
	})

	it("pins the tab on screen to the side, and unpins it", () => {
		renderPage(true, { url: "/app/rankings?view=players" })
		fireEvent.click(screen.getByRole("button", { name: "Pin to the side" }))
		expect(localStorage.getItem("rankings-pin")).toBe("players")
		fireEvent.click(screen.getByRole("button", { name: "Unpin", pressed: true }))
		expect(localStorage.getItem("rankings-pin")).toBeNull()
	})
})
