import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PosterLine } from "../components/pvp/gallery/GalleryBits"
import { ProfileCard } from "../components/pvp/gallery/ProfileCard"
import { TestQueryProvider } from "../test/TestQueryProvider"
import type { GalleryPoster, ProfileCardData } from "../types/gallery"

/**
 * The card a name opens. What the API may send is its own tests
 * (test_profile_cards.py); these cover what the card draws from it.
 */

vi.mock("../hooks/useOshiIds", () => ({ useOshiIds: () => new Set([41]) }))

const FULL: ProfileCardData = {
	favorites: [
		{ uma: 41, label: "Oguri Cap", image: "/o.png" },
		{ uma: 42, label: "Gold Ship", image: "/g.png" },
	],
	posts: [
		{ public_id: "aB3dE5gH", caption: "Pace core", score: 12, event: { kind: "cm", id: 21, label: "Capricorn Cup" } },
		{ public_id: "cD4eF6hI", caption: "", score: 0, event: { kind: "loh", id: 3, label: "League 3" } },
	],
	plans: [{ public_id: "eF6gH8jK", row_count: 5, pull_count: 1600, step_count: 4 }],
}

const fetchMock = vi.fn()
const answer = (body: unknown, status = 200) =>
	fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(body), { status })))

beforeEach(() => vi.stubGlobal("fetch", fetchMock))
afterEach(() => {
	fetchMock.mockReset()
	vi.unstubAllGlobals()
})

const show = (onClose = vi.fn()) => {
	render(
		<TestQueryProvider>
			<MemoryRouter>
				<ProfileCard target={{ kind: "post", id: "aB3dE5gH" }} name="Moonlit Trainer" tier={null} onClose={onClose} />
			</MemoryRouter>
		</TestQueryProvider>
	)
	return onClose
}

describe("ProfileCard", () => {
	it("asks through what the person posted", async () => {
		answer(FULL)
		show()
		await screen.findByText("Pace core")
		expect(new URL(String(fetchMock.mock.calls[0][0]), "http://api").pathname).toMatch(/\/profile-cards\/post\/aB3dE5gH$/)
	})

	it("draws their favorites, teams and shared plans", async () => {
		answer(FULL)
		show()
		expect(await screen.findByRole("heading", { name: "Favorites" })).toBeTruthy()
		expect(screen.getByAltText("Gold Ship")).toBeTruthy()
		expect(screen.getByRole("link", { name: /Pace core/ })).toHaveAttribute("href", "/app/pvp?event=cm-21&view=gallery&post=aB3dE5gH")
		expect(screen.getByRole("link", { name: /5 banners · 1,600 pulls, 4 steps/ })).toHaveAttribute("href", "/app/eF6gH8jK")
	})

	it("marks the viewer's own favorite with the rainbow frame only", async () => {
		answer(FULL)
		show()
		const yours = (await screen.findByAltText("Oguri Cap")).closest(".uma-frame")
		expect(yours).toHaveAttribute("data-oshi")
		expect(screen.getByAltText("Gold Ship").closest(".uma-frame")).not.toHaveAttribute("data-oshi")
	})

	it("names the event when a team has no caption", async () => {
		answer(FULL)
		show()
		expect(await screen.findByRole("link", { name: /League 3/ })).toHaveAttribute("href", "/app/pvp?event=loh-3&view=gallery&post=cD4eF6hI")
	})

	it("says so when there are no teams, and hides plans it wasn't given", async () => {
		answer({ favorites: [FULL.favorites[0]], posts: [], plans: [] })
		show()
		expect(await screen.findByText("No gallery teams yet.")).toBeTruthy()
		expect(screen.getByRole("heading", { name: "Favorite" })).toBeTruthy()
		expect(screen.queryByText("Shared plans")).toBeNull()
	})

	it("says so when the card is gone", async () => {
		answer({ error: "This card isn't available." }, 404)
		show()
		expect(await screen.findByText("This card isn't available.")).toBeTruthy()
	})

	it("closes when a link is followed", async () => {
		answer(FULL)
		const onClose = show()
		fireEvent.click(await screen.findByRole("link", { name: /Pace core/ }))
		expect(onClose).toHaveBeenCalled()
	})
})

describe("PosterLine", () => {
	const POSTER: GalleryPoster = { display_name: "Moonlit Trainer", portrait: null, tier_name: null, gallery_style: null }

	it("opens the card from the name when it has a target", async () => {
		answer(FULL)
		render(
			<TestQueryProvider>
				<MemoryRouter>
					<PosterLine poster={POSTER} card={{ kind: "comment", id: 7 }} />
				</MemoryRouter>
			</TestQueryProvider>
		)
		fireEvent.click(screen.getByRole("button", { name: /Moonlit Trainer/ }))
		expect(await screen.findByText("Pace core")).toBeTruthy()
		expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/profile-cards\/comment\/7$/)
	})

	it("is plain text in the feed, whose row is already a link", () => {
		render(<PosterLine poster={POSTER} />)
		expect(screen.queryByRole("button")).toBeNull()
		expect(screen.getByText("Moonlit Trainer")).toBeTruthy()
	})
})
