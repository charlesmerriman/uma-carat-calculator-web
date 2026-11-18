/**
 * The Encyclopedia links outside the Encyclopedia (useEncyclopediaHrefs and
 * the pieces that draw them): early access gets a page for every uma and card
 * the catalogue numbers, a placeholder card gets none, and everyone else gets
 * the site as it was.
 */
import { render, screen, fireEvent, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, it, expect, vi } from "vitest"
import type { ReactNode } from "react"
import { AuthContext, type AuthContextType } from "../services/AuthContext"
import { useEncyclopediaHrefs } from "../hooks/useEncyclopediaHrefs"
import { RankRow } from "../components/rankings/kit/RankRow"
import { TeamGrid } from "../components/pvp/TeamGrid"
import { PvpCardPicker } from "../components/pvp/PvpCardPicker"
import { GuidePicksBody } from "../components/pvp/GuidePicksPanel"
import type { CatalogueSupportCard, CatalogueUma, PvpTeamMember } from "../types/pvpTeam"
import type { PvpGuide } from "../types/pvpGuide"

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

/**
 * My team (Daptrius, 2026-11-16: the PvP page that needed the Encyclopedia
 * most had no way into it). The grid's names, the picker's book buttons and
 * the guide picks' action row; the same catalogue as above.
 */
describe("My team's links", () => {
	const apt = { turf: 8, dirt: 1, short: 3, mile: 7, medium: 6, long: 4, front: 5, pace: 7, late: 7, end: 3 }
	const GOLD_SHIP: CatalogueUma = {
		id: 1, name: "Gold Ship", image: null, portrait: null, rarity: 3, running_style: 3, character_id: 1, is_variant: false, apt, skills: [],
	}
	const card = (id: number, name: string, placeholder = false): CatalogueSupportCard =>
		({ id, name, image: null, card_type: "speed", rarity: 3, title: "", skills: [], placeholder }) as CatalogueSupportCard
	const KITASAN = card(10, "Kitasan Black")
	const STAND_IN = card(11, "Your best SSR Speed card", true)
	const TEAM: PvpTeamMember[] = [{ position: 0, uma: 1, style: "late", cards: [{ slot: 1, support_card: 10 }, { slot: 2, support_card: 11 }] }]

	const grid = (
		<TeamGrid
			members={TEAM}
			umasById={new Map([[1, GOLD_SHIP]])}
			cardsById={new Map([[10, KITASAN], [11, STAND_IN]])}
			onPickUma={vi.fn()}
			onPickCard={vi.fn()}
			onStyleChange={vi.fn()}
			onClearUma={vi.fn()}
			onClearCard={vi.fn()}
		/>
	)

	it("links the uma's name and each card's caption, not a placeholder's", async () => {
		as(true, grid)

		expect(await screen.findByRole("link", { name: "Gold Ship" })).toHaveAttribute("href", "/app/umas/100701")
		expect(screen.getByRole("link", { name: "Kitasan Black" })).toHaveAttribute("href", "/app/cards/30028")
		expect(screen.queryByRole("link", { name: "Your best SSR Speed card" })).toBeNull()
		// The tile is still the button that opens the picker.
		expect(screen.getByRole("button", { name: "Change card 1 for Gold Ship: Kitasan Black" })).toBeInTheDocument()
	})

	it("puts the card on the names, since a click on a tile opens the picker", async () => {
		as(true, grid)

		// A mouse click on a name opens the uma's or the card's card (HoverCardLayer).
		const uma = await screen.findByRole("link", { name: "Gold Ship" })
		expect(uma).toHaveAttribute("data-hover-card", "uma:1")
		expect(uma).toHaveAttribute("title", "Gold Ship: show details")
		expect(screen.getByRole("link", { name: "Kitasan Black" })).toHaveAttribute("data-hover-card", "card:10")
		// The tiles themselves carry none: the layer would leave a button's click alone anyway.
		expect(screen.getByRole("button", { name: "Change card 1 for Gold Ship: Kitasan Black" })).not.toHaveAttribute("data-hover-card")
		expect(screen.getByRole("button", { name: /Change uma 1/ })).not.toHaveAttribute("data-hover-card")
	})

	it("draws the grid as before for everyone else", async () => {
		as(false, grid)

		await Promise.resolve()
		expect(screen.getByText("Gold Ship")).toBeInTheDocument()
		expect(screen.queryByRole("link")).toBeNull()
	})

	function picker(pageLinks: boolean, onClose = vi.fn()) {
		as(
			true,
			<PvpCardPicker
				pool="support"
				items={[KITASAN, STAND_IN]}
				title="Card 1 for Gold Ship"
				skillsById={new Map()}
				event={{ surface_type: "turf", distance: "medium", length: 2000 } as never}
				style="late"
				recommended={new Set()}
				blockReason={() => null}
				selectedId={null}
				onPick={vi.fn()}
				onClose={onClose}
				pageLinks={pageLinks}
			/>
		)
		return onClose
	}

	it("gives each picker tile a book button that closes the picker on the way out", async () => {
		const onClose = picker(true)
		// The placeholder shows only under its own switch, so one tile, one link.
		const link = await screen.findByRole("link", { name: "Open Kitasan Black in the Encyclopedia" })
		expect(link).toHaveAttribute("href", "/app/cards/30028")
		// With a mouse the book opens the card over the picker (HoverCardLayer)...
		expect(link).toHaveAttribute("data-hover-card", "card:10")
		expect(link).toHaveAttribute("title", "Show details")
		// ...and followed as a link, leaving the page closes the picker.
		fireEvent.click(link)
		expect(onClose).toHaveBeenCalledTimes(1)
	})

	it("leaves the picker's links off unless asked (the guide editor, the veteran form)", async () => {
		picker(false)

		await Promise.resolve()
		expect(screen.getByRole("button", { name: /Kitasan Black/ })).toBeInTheDocument()
		expect(screen.queryByRole("link")).toBeNull()
	})

	it("puts the page in a guide pick's action row", async () => {
		const guide = {
			uma_recommendations: [{ style: "front", stars: 5, role: "", note: "", uma: { id: 1, name: "Gold Ship", image: null } }],
			decks: [],
		} as unknown as PvpGuide
		as(
			true,
			<GuidePicksBody
				guideState={{ status: "ready", guide }}
				members={[]}
				actions={{ uma: () => [], card: () => [], emptyCardHint: null }}
			/>
		)

		fireEvent.click(screen.getByRole("button", { name: /Gold Ship/ }))
		// findBy: the link arrives once the catalogue has loaded.
		const row = within(screen.getByRole("listitem", { name: "Add Gold Ship" }))
		expect(await row.findByRole("link", { name: /Open its page/ })).toHaveAttribute("href", "/app/umas/100701")
	})
})
