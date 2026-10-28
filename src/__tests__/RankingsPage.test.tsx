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
 * The Rankings page (/app/rankings): who sees it, and the Guides tab
 * drawing utils/guideRankings.ts's counts with the sheet's tick boxes.
 * The counting rules themselves are guideRankings.test.ts.
 */

const CM21 = {
	id: 21, event_type: "champions_meeting", name: "Champions Meeting 21 Libra Cup", cm_number: 21,
	start_date: "2026-10-28T00:00:00Z", end_date: "2026-11-03T00:00:00Z",
} as unknown as RaceEvent

vi.mock("../services/CalculatorContext", () => ({
	useCalculatorData: () => ({ championsMeetingData: [CM21], leagueOfHeroesData: [] }),
}))
// The reader's own saved teams: one for CM 21 with Maruzensky on Pace.
vi.mock("../services/PvpTeamsContext", () => ({
	usePvpTeams: () => ({
		status: "ready",
		ensureLoaded: () => {},
		teams: [{ key: "t1", id: 1, kind: "cm", event: 21, isFocus: true, updatedAt: 0, name: "", notes: [], members: [{ position: 0, uma: 41, style: "pace", cards: [] }] }],
	}),
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

const PULL_PLANS: PullPlanRankingsPayload = {
	generated_at: "2026-10-27T20:00:00Z",
	planners: 16000,
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

const GALLERY = {
	generated_at: "2026-10-27T20:00:00Z", posts: 2, decks: 6,
	umas: [{ uma: 41, teams: 1, styles: { pace: 1 } }], cards: [],
}

const BODIES: Array<[RegExp, unknown]> = [
	[/\/rankings\/gallery\/cm\/21$/, GALLERY],
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

	it("ranks the guides' cards with counts and shares, the leader's bar full", async () => {
		renderPage(true)
		const overall = await screen.findByRole("region", { name: "Overall" })
		const rows = within(overall).getAllByRole("listitem")
		expect(rows[0]).toHaveTextContent("Kitasan Black")
		expect(within(rows[0]).getByText("2 decks")).toBeInTheDocument()
		expect(within(rows[0]).getByText("100%")).toBeInTheDocument()
		expect(rows[1]).toHaveTextContent("Fine Motion")
		expect(rows[1]).toHaveTextContent("1 borrowed")
		expect(fetchMock.mock.calls[0][0]).toMatch(/\/rankings\/guides$/)
		// The band says what is counted.
		expect(within(screen.getByRole("region", { name: "What the guides recommend" })).getByText("Guides counted")).toBeInTheDocument()
		expect((await screen.findByText(/^Updated /)).tagName).toBe("TIME")
	})

	it("switches the one list with the lens, and remembers the lens", async () => {
		renderPage(true)
		await screen.findByRole("region", { name: "Overall" })
		fireEvent.click(screen.getByRole("tab", { name: /^Umas/ }))
		const umas = screen.getByRole("region", { name: "Umas" })
		expect(within(umas).getByText("Maruzensky")).toBeInTheDocument()
		expect(within(umas).getByText("1 pick")).toBeInTheDocument()
		expect(JSON.parse(localStorage.getItem("rankings-choices") ?? "{}")).toEqual({ guides: { lens: "umas" } })
	})

	it("recounts when a tick box goes off, says so in a token, and resets", async () => {
		renderPage(true)
		const overall = await screen.findByRole("region", { name: "Overall" })
		fireEvent.click(screen.getByRole("button", { name: /^Include/ }))
		fireEvent.click(screen.getByRole("checkbox", { name: /Whale/ }))
		const rows = within(overall).getAllByRole("listitem")
		expect(rows).toHaveLength(1)
		expect(within(rows[0]).getByText("1 deck")).toBeInTheDocument()
		expect(screen.getByRole("button", { name: /^Include/ })).toHaveTextContent("Include 6 of 7")
		expect(screen.getByText(/Showing 1 guide and 1 deck for/)).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "Reset" }))
		expect(within(overall).getAllByRole("listitem")).toHaveLength(2)
		expect(screen.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument()
	})

	it("puts the filters in a sheet on a phone, the same filters as the pills", async () => {
		renderPage(true)
		const overall = await screen.findByRole("region", { name: "Overall" })
		fireEvent.click(screen.getByRole("button", { name: "Filters" }))
		const sheet = screen.getByRole("dialog", { name: "Filters", hidden: true })
		fireEvent.click(within(sheet).getByRole("button", { name: "Whale", pressed: true, hidden: true }))
		expect(within(overall).getAllByRole("listitem")).toHaveLength(1)
		// The pill says so too, and the button counts the changed filter.
		expect(screen.getByRole("button", { name: /^Include/ })).toHaveTextContent("Include 6 of 7")
		expect(screen.getByRole("button", { name: "Filters · 1" })).toBeInTheDocument()
		fireEvent.click(within(sheet).getByRole("button", { name: "Show 1 deck", hidden: true }))
		expect(screen.queryByRole("dialog", { hidden: true })).not.toBeInTheDocument()
	})

	it("finds one card's place with the search", async () => {
		renderPage(true)
		fireEvent.change(await screen.findByRole("searchbox", { name: "Find a card or uma" }), { target: { value: "fine" } })
		expect(within(screen.getByRole("region", { name: "Search" })).getByText("#2 overall · 1 deck · 50%")).toBeInTheDocument()
	})

	it("keeps Pull plans to the Raptive gate (guide editors)", () => {
		const { unmount } = renderPage(true, { url: "/app/rankings?view=pull-plans" })
		expect(screen.queryByRole("tab", { name: "Pull plans" })).not.toBeInTheDocument()
		// The address alone doesn't open it: the first tab shows.
		expect(screen.getByRole("tab", { name: "Guides", selected: true })).toBeInTheDocument()
		unmount()
		renderPage(true, { editor: true, url: "/app/rankings?view=pull-plans" })
		expect(screen.getByRole("tab", { name: "Pull plans", selected: true })).toBeInTheDocument()
	})

	it("draws the planned banners with their share of everyone planning, and a typical figure", async () => {
		renderPage(true, { editor: true, url: "/app/rankings?view=pull-plans" })
		const list = await screen.findByRole("region", { name: "Banners players plan" })
		const row = within(list).getByText("Gentildonna").closest("li")!
		expect(row).toHaveTextContent("5,807")
		expect(row).toHaveTextContent("36% of planners")
		expect(row).toHaveTextContent("typical · avg 165")
		expect(row).toHaveTextContent("Predicted")
		expect(within(screen.getByRole("region", { name: "What players plan to pull on" })).getByText("16,000")).toBeInTheDocument()
		expect(screen.getByRole("region", { name: "When the pulls fall due" })).toBeInTheDocument()
	})

	it("remembers the Pull plans order on the device", async () => {
		renderPage(true, { editor: true, url: "/app/rankings?view=pull-plans" })
		await screen.findByRole("region", { name: "Banners players plan" })
		fireEvent.click(screen.getByRole("tab", { name: "By planners" }))
		expect(JSON.parse(localStorage.getItem("rankings-choices") ?? "{}")).toEqual({ "pull-plans": { sort: "planners" } })
	})

	it("shows what players build, what wins and where your team sits on the PvP tab", async () => {
		renderPage(true, { url: "/app/rankings?view=pvp&event=cm-21" })
		const umas = await screen.findByRole("region", { name: "Umas players build" })
		expect(within(umas).getByText("3 teams")).toBeInTheDocument()
		expect(within(umas).getByText("75%")).toBeInTheDocument()
		const cards = screen.getByRole("region", { name: "Cards in their decks" })
		expect(within(cards).getByText("6 decks")).toBeInTheDocument()
		expect(within(cards).getByText("2 borrowed")).toBeInTheDocument()
		// 30 races: shown (over the floor of 20) but not ranked (under 100), so no place.
		const wins = screen.getByRole("region", { name: "What wins" })
		expect(within(wins).getByText("40%")).toBeInTheDocument()
		expect(within(wins).queryByLabelText("Place 1")).not.toBeInTheDocument()
		expect(within(screen.getByRole("region", { name: "Your team" })).getByText("#1")).toBeInTheDocument()
		// The opened row reads the gallery and CM Runs beside the build count.
		fireEvent.click(within(umas).getByRole("button", { expanded: false }))
		expect((await within(umas).findByText("Posted to the gallery")).parentElement).toHaveTextContent("In 50% of the 2 posted teams")
		expect(within(umas).getByText("In CM Runs").parentElement).toHaveTextContent("Wins 40% of 30 races")
	})

	it("shows the players' ranks, favourites, income options and selectors", async () => {
		renderPage(true, { url: "/app/rankings?view=players" })
		const favourites = await screen.findByRole("region", { name: "Favourite umas" })
		expect(within(favourites).getByText("50 players")).toBeInTheDocument()
		expect(within(screen.getByRole("region", { name: "Ranks" })).getByRole("img", { name: "Team Trials: Class 6 38%" })).toBeInTheDocument()
		expect(within(screen.getByRole("region", { name: "Income options" })).getByText("42%")).toBeInTheDocument()
		const selectors = screen.getByRole("region", { name: "Campaign selectors" })
		expect(within(selectors).getByText("Fine Motion")).toBeInTheDocument()
		expect(within(selectors).getByText("9 picked")).toBeInTheDocument()
	})

	it("pins the tab on screen to the side, and unpins it", () => {
		renderPage(true, { url: "/app/rankings?view=players" })
		fireEvent.click(screen.getByRole("button", { name: "Pin to the side" }))
		expect(localStorage.getItem("rankings-pin")).toBe("players")
		fireEvent.click(screen.getByRole("button", { name: "Unpin", pressed: true }))
		expect(localStorage.getItem("rankings-pin")).toBeNull()
	})
})
