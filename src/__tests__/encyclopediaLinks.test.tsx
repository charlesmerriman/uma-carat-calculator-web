/**
 * The Encyclopedia links outside the Encyclopedia (useEncyclopediaHrefs and
 * the pieces that draw them): early access gets a page for every uma and card
 * the catalogue numbers, a placeholder card gets none, and everyone else gets
 * the site as it was.
 */
import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, it, expect, vi } from "vitest"
import type { ReactNode } from "react"
import { AuthContext, type AuthContextType } from "../services/AuthContext"
import { useEncyclopediaHrefs } from "../hooks/useEncyclopediaHrefs"
import { RankRow } from "../components/rankings/kit/RankRow"

const CATALOGUE = {
	umas: [
		{ id: 1, name: "Gold Ship", game_id: 100701 },
		{ id: 2, name: "Not imported", game_id: null },
	],
	support_cards: [
		{ id: 10, name: "Kitasan Black", game_id: 30028 },
		{ id: 11, name: "Your best SSR Speed card", game_id: 31000, placeholder: true },
	],
	skills: [],
}

vi.mock("../services/pvpTeamFetchCalls", () => ({ loadPvpCatalogue: () => Promise.resolve(CATALOGUE) }))

function as(earlyAccess: boolean, node: ReactNode) {
	const value = { isLoggedIn: true, status: "ready", account: { early_access: earlyAccess, oshi_uma_ids: [] } } as unknown as AuthContextType
	return render(
		<AuthContext.Provider value={value}>
			<MemoryRouter>{node}</MemoryRouter>
		</AuthContext.Provider>
	)
}

function Probe() {
	const hrefs = useEncyclopediaHrefs()
	return (
		<ul>
			<li data-testid="uma">{hrefs.uma(1) ?? "none"}</li>
			<li data-testid="unimported">{hrefs.uma(2) ?? "none"}</li>
			<li data-testid="card">{hrefs.card(10) ?? "none"}</li>
			<li data-testid="placeholder">{hrefs.card(11) ?? "none"}</li>
			<li data-testid="unknown">{hrefs.card(999) ?? "none"}</li>
		</ul>
	)
}

describe("useEncyclopediaHrefs", () => {
	it("maps a row id to its page for early access, and nothing it can't open", async () => {
		as(true, <Probe />)

		expect(await screen.findByText("/app/umas/100701")).toBeInTheDocument()
		expect(screen.getByTestId("card")).toHaveTextContent("/app/cards/30028")
		expect(screen.getByTestId("unimported")).toHaveTextContent("none")
		expect(screen.getByTestId("placeholder")).toHaveTextContent("none")
		expect(screen.getByTestId("unknown")).toHaveTextContent("none")
	})

	it("gives everyone else no links", async () => {
		as(false, <Probe />)

		// Let the (shared, already loaded) catalogue settle before asserting nothing.
		await Promise.resolve()
		expect(screen.getByTestId("uma")).toHaveTextContent("none")
		expect(screen.getByTestId("card")).toHaveTextContent("none")
	})
})

describe("RankRow with a page", () => {
	const base = { place: 1, art: null, name: "Gold Ship", fill: 1, count: "12 picks" }

	it("is the link itself when it has no breakdown", () => {
		as(true, <RankRow {...base} href="/app/umas/100701" />)

		expect(screen.getByRole("link")).toHaveAttribute("href", "/app/umas/100701")
	})

	it("keeps its button when it opens, and puts the link in the breakdown", () => {
		as(true, <RankRow {...base} href="/app/umas/100701" detail={<p>By event</p>} />)

		expect(screen.queryByRole("link")).toBeNull()
		fireEvent.click(screen.getByRole("button"))
		expect(screen.getByRole("link", { name: /Open its page/ })).toHaveAttribute("href", "/app/umas/100701")
	})

	it("draws as before with no page", () => {
		as(true, <RankRow {...base} />)

		expect(screen.queryByRole("link")).toBeNull()
	})
})
