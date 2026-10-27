import { render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PvpGalleryRankings } from "../components/pvp/PvpGalleryRankings"
import type { RaceEvent } from "../types"
import type { GalleryRankingsPayload } from "../hooks/useGalleryRankings"

/**
 * The PvP page's Rankings view: one event's gallery posts, counted by the
 * server (GET /rankings/gallery/<kind>/<id>) and drawn with shares. Who gets
 * the view is PvpGuidePage.test.tsx.
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
const serve = (payload: GalleryRankingsPayload) =>
	fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(payload), { status: 200 })))

const renderView = () =>
	render(
		<MemoryRouter>
			<PvpGalleryRankings event={CM21} />
		</MemoryRouter>
	)

beforeEach(() => {
	fetchMock.mockReset()
	vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
	vi.unstubAllGlobals()
})

describe("PvpGalleryRankings", () => {
	it("counts the event's posted teams with shares, borrows apart", async () => {
		serve({
			generated_at: "2026-10-27T20:00:00Z",
			posts: 143,
			decks: 429,
			// 99 is no longer in the catalogue, so it is left off.
			umas: [{ uma: 41, teams: 120, styles: { pace: 70, end: 50 } }, { uma: 99, teams: 3, styles: { front: 3 } }],
			cards: [{ card: 1, decks: 401, borrows: 20 }],
		})
		renderView()
		expect(await screen.findByText(/Counting the 143 teams posted to the gallery/)).toBeInTheDocument()
		expect(fetchMock.mock.calls[0][0]).toMatch(/\/rankings\/gallery\/cm\/21$/)
		const umas = within(screen.getByRole("region", { name: "Umas" }))
		expect(umas.getAllByRole("listitem")).toHaveLength(1)
		expect(umas.getByText("120 teams · 84%")).toBeInTheDocument()
		expect(within(screen.getByRole("region", { name: "Support cards" })).getByText("401 decks · 93% · 20 borrowed")).toBeInTheDocument()
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
