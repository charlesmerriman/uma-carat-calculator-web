import { render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PvpGalleryRankings } from "../components/pvp/PvpGalleryRankings"
import type { RaceEvent } from "../types"
import type { GalleryRankingsPayload } from "../hooks/useGalleryRankings"
import type { PvpGuideState } from "../hooks/usePvpGuide"
import type { PvpGuide } from "../types/pvpGuide"

/**
 * The PvP page's Rankings view: one event's gallery posts, counted by the
 * server (GET /rankings/gallery/<kind>/<id>) and drawn with shares, what the
 * event's guide does with each pick, and the most copied posts. Who gets the
 * view is PvpGuidePage.test.tsx.
 */

const CM21 = {
	id: 21, event_type: "champions_meeting", name: "Champions Meeting 21 Libra Cup", cm_number: 21,
	start_date: "2026-10-28T00:00:00Z", end_date: "2026-11-03T00:00:00Z",
} as unknown as RaceEvent

vi.mock("../hooks/useOshiIds", () => ({ useOshiIds: () => new Set<number>() }))
vi.mock("../hooks/usePvpCatalogue", () => ({
	usePvpCatalogue: () => ({
		status: "ready",
		umasById: new Map([[41, { id: 41, name: "Oguri Cap", portrait: null, image: null }]]),
		cardsById: new Map([[1, { id: 1, name: "Light Hello", card_type: "friend", image: null }]]),
	}),
}))

const fetchMock = vi.fn()
const serve = (payload: GalleryRankingsPayload, savedTeams = 1300) =>
	fetchMock.mockImplementation((url: string) =>
		Promise.resolve(
			new Response(
				JSON.stringify(/\/rankings\/pvp\//.test(url) ? { generated_at: payload.generated_at, built: { teams: savedTeams, decks: 0, umas: [], cards: [] }, runs: {} } : payload),
				{ status: 200 }
			)
		)
	)

// The event's guide: recommends Oguri Cap, and two decks, one holding Light Hello (and an "or" Light Hello in the other).
const GUIDE: PvpGuideState = {
	status: "ready",
	guide: {
		uma_recommendations: [{ style: "pace", stars: 3, role: "", note: "", uma: { id: 41, name: "Oguri Cap", image: null } }],
		decks: [
			{ id: 1, style: "pace", label: "Standard", note: "", is_highlighted: false, slots: [{ slot: 1, order: 0, is_borrow: false, note: "", support_card: { id: 1, name: "Light Hello", image: null, card_type: "friend", rarity: 3 } }] },
			{ id: 2, style: "pace", label: "Whale", note: "", is_highlighted: false, slots: [{ slot: 1, order: 1, is_borrow: false, note: "", support_card: { id: 1, name: "Light Hello", image: null, card_type: "friend", rarity: 3 } }] },
		],
	} as unknown as PvpGuide,
}

const renderView = (guide: PvpGuideState = GUIDE) =>
	render(
		<MemoryRouter>
			<PvpGalleryRankings event={CM21} guide={guide} />
		</MemoryRouter>
	)

beforeEach(() => {
	fetchMock.mockReset()
	vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
	vi.unstubAllGlobals()
})

const PAYLOAD: GalleryRankingsPayload = {
	generated_at: "2026-10-27T20:00:00Z",
	posts: 143,
	decks: 429,
	// 99 is no longer in the catalogue, so it is left off.
	umas: [{ uma: 41, teams: 120, styles: { pace: 70, end: 50 } }, { uma: 99, teams: 3, styles: { front: 3 } }],
	cards: [{ card: 1, decks: 401, borrows: 20 }],
	copied: [{ public_id: "abc123", caption: "Pace core", copies: 12, umas: [41] }],
}

describe("PvpGalleryRankings", () => {
	it("ranks the event's posted teams by share, borrows apart", async () => {
		serve(PAYLOAD)
		renderView()
		const umas = within(await screen.findByRole("region", { name: "Umas" }))
		expect(fetchMock.mock.calls[0][0]).toMatch(/\/rankings\/gallery\/cm\/21$/)
		expect(umas.getAllByRole("listitem")).toHaveLength(1)
		expect(umas.getByText("84%")).toBeInTheDocument()
		const cards = within(screen.getByRole("region", { name: "Support cards" }))
		expect(cards.getByText("93%")).toBeInTheDocument()
		expect(cards.getByText("5% borrowed")).toBeInTheDocument()
	})

	it("says what the guide does with each pick, alternatives not counted", async () => {
		serve(PAYLOAD)
		renderView()
		expect(within(await screen.findByRole("region", { name: "Umas" })).getByText("Guide recommends her")).toBeInTheDocument()
		expect(within(screen.getByRole("region", { name: "Support cards" })).getByText("Guide 1 of 2")).toBeInTheDocument()
	})

	it("never gives the gallery's share of every saved team, which would give that total away, and links there", async () => {
		serve(PAYLOAD)
		renderView()
		const band = within(await screen.findByRole("region", { name: "What the gallery is running for Libra Cup" }))
		expect(band.queryByText("Of all saved teams")).not.toBeInTheDocument()
		expect(band.getByRole("link", { name: "Rankings page" })).toHaveAttribute("href", "/app/rankings?view=pvp&event=cm-21")
	})

	it("links each most copied post", async () => {
		serve(PAYLOAD)
		renderView()
		const copied = within(await screen.findByRole("region", { name: "Most copied posts" }))
		expect(copied.getByRole("link", { name: /Pace core/ })).toHaveAttribute("href", "/app/pvp?event=cm-21&view=gallery&post=abc123")
		expect(copied.getByText("copied 12 times")).toBeInTheDocument()
	})

	it("says so when nobody has posted", async () => {
		serve({ generated_at: "2026-10-27T20:00:00Z", posts: 0, decks: 0, umas: [], cards: [] })
		renderView()
		expect(await screen.findByText(/Nobody has posted a team for this event yet/)).toBeInTheDocument()
		expect(screen.queryByRole("region", { name: "Umas" })).not.toBeInTheDocument()
	})

	it("is a note when the server refuses", async () => {
		fetchMock.mockImplementation(() => Promise.resolve(new Response("{}", { status: 403 })))
		renderView()
		expect(await screen.findByText("Rankings are open to supporters first.")).toBeInTheDocument()
	})
})
