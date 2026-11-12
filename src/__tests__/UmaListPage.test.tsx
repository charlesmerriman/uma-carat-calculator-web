import { fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AuthContext, type AuthContextType } from "../services/AuthContext"
import { UmaListPage } from "../components/encyclopedia/UmaListPage"
import { useOwned } from "../hooks/useOwned"
import { TestQueryProvider } from "../test/TestQueryProvider"
import type { PvpCatalogue } from "../types/pvpTeam"
import type { Roster } from "../types/roster"
import { filterUmas, limitBreakWords, ownedStars } from "../utils/encyclopedia"

/** The uma list (/app/umas), and "You own this" read from the Collection (useOwned). */

const CATALOGUE = {
	umas: [
		{ id: 7, game_id: 100101, name: "Special Week", portrait: null, image: null, rarity: 3, on_global: true },
		{ id: 8, game_id: 100201, name: "Silence Suzuka", portrait: null, image: null, rarity: 3, on_global: true },
		{ id: 9, game_id: 103001, name: "Rice Shower", portrait: null, image: null, rarity: null, on_global: false },
		{ id: 10, game_id: 100301, name: "Tokai Teio", portrait: null, image: null, rarity: 1, on_global: true },
	],
	support_cards: [],
	skills: [],
} as unknown as PvpCatalogue

vi.mock("../services/pvpTeamFetchCalls", () => ({ loadPvpCatalogue: () => Promise.resolve(CATALOGUE) }))

const ROSTER: Roster = {
	umas: [{ uma: 8, stars: 4, talent_level: null, source: "manual", obtained_at: null }],
	support_cards: [{ support_card: 30, limit_break: 4, spare_copies: 0, source: "manual", obtained_at: null }],
}

const fetchMock = vi.fn()

function providers(signedIn: boolean) {
	const auth = { isLoggedIn: signedIn, status: "ready", account: { early_access: true, oshi_uma_ids: [] } } as unknown as AuthContextType
	return function Providers({ children }: { children: ReactNode }) {
		return (
			<AuthContext.Provider value={auth}>
				<TestQueryProvider>
					<MemoryRouter>{children}</MemoryRouter>
				</TestQueryProvider>
			</AuthContext.Provider>
		)
	}
}

beforeEach(() => {
	vi.stubGlobal("fetch", fetchMock)
	fetchMock.mockImplementation((url: string) =>
		Promise.resolve(url.endsWith("/roster") ? new Response(JSON.stringify(ROSTER), { status: 200 }) : new Response("{}", { status: 404 }))
	)
})
afterEach(() => {
	vi.unstubAllGlobals()
	fetchMock.mockReset()
})

describe("useOwned", () => {
	it("maps the Collection by row id: stars for umas, limit break for cards", async () => {
		const { result } = renderHook(() => useOwned(), { wrapper: providers(true) })
		await waitFor(() => expect(result.current.empty).toBe(false))
		expect(result.current.umas.get(8)).toBe(4)
		expect(result.current.cards.get(30)).toBe(4)
	})

	it("asks nothing for a guest, and has nothing to show", () => {
		const { result } = renderHook(() => useOwned(), { wrapper: providers(false) })
		expect(result.current).toMatchObject({ signedIn: false, empty: true })
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it("words what the player owns", () => {
		expect(ownedStars(4)).toBe("★★★★")
		expect(ownedStars(null)).toBe("")
		expect(limitBreakWords(2)).toBe("Limit break 2")
		expect(limitBreakWords(4)).toBe("Max limit break")
	})
})

describe("UmaListPage", () => {
	it("filters by name, where it is out and stars, a blank rarity counting as ★3", () => {
		expect(filterUmas(CATALOGUE.umas, "silence", "all", "all").map((uma) => uma.name)).toEqual(["Silence Suzuka"])
		expect(filterUmas(CATALOGUE.umas, "", "jp", "all").map((uma) => uma.name)).toEqual(["Rice Shower"])
		expect(filterUmas(CATALOGUE.umas, "", "all", "3")).toHaveLength(3)
	})

	it("marks what the player owns and filters to it", async () => {
		const Providers = providers(true)
		render(<Providers><UmaListPage /></Providers>)
		expect(await screen.findByText("4 umas")).toBeInTheDocument()
		await waitFor(() => expect(screen.getByRole("link", { name: /Silence Suzuka/ })).toHaveTextContent("Owned"))
		fireEvent.click(screen.getByRole("button", { name: "Owned" }))
		expect(screen.getByText("1 uma")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "Not owned" }))
		expect(screen.getByText("3 umas")).toBeInTheDocument()
	})

	it("shows a guest no Collection filter and no marks", async () => {
		const Providers = providers(false)
		render(<Providers><UmaListPage /></Providers>)
		expect(await screen.findByText("4 umas")).toBeInTheDocument()
		expect(screen.queryByRole("group", { name: "Collection" })).not.toBeInTheDocument()
		expect(screen.getByRole("link", { name: /Silence Suzuka/ })).not.toHaveTextContent("Owned")
	})
})
