import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter, useLocation } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SiteContentContext } from "../services/SiteContentContext"
import { buildSiteContentValue } from "../services/siteContent"
import { DEFAULT_CONSTANTS } from "../constants/gameConstants"
import type { RaceEvent } from "../types"
import type { PvpGuide } from "../types/pvpGuide"

/**
 * The PvP tab. Pins which event it opens on, what the band's controls write
 * to the URL, which guide sections render or step aside, and the states with
 * no guide. The date and grouping rules have unit tests (pvpGuide.test.ts).
 *
 * Events sit in 2099 and 2100 so "now" never matters, except the one in 2020.
 */

const event = (id: number, name: string, start: string, extra: Partial<RaceEvent> = {}): RaceEvent =>
	({
		id,
		name,
		event_type: "champions_meeting",
		cm_number: id,
		start_date: start,
		end_date: start.replace(/T.*/, "T23:00:00Z"),
		is_predicted: false,
		track: "Tokyo",
		surface_type: "Turf",
		distance: "Mile",
		length: "1600m",
		track_condition: "TBD",
		season: "TBD",
		weather: "TBD",
		direction: "TBD",
		has_guide: false,
		...extra,
	}) as RaceEvent

const OLD = event(5, "Virgo Cup", "2020-01-01T00:00:00Z")
const NEXT = event(10, "Aquarius Cup", "2099-03-06T00:00:00Z", { has_guide: true })
const LATER = event(11, "Pisces Cup", "2100-03-30T00:00:00Z")

const card = (id: number, name: string) => ({ id, name, image: null, card_type: "speed", rarity: 3 })

const GUIDE: PvpGuide = {
	event_type: "champions_meeting",
	event: 10,
	is_published: true,
	updated_at: "2099-01-01T00:00:00Z",
	scenario: { id: 1, name: "Trackblazer", image: null },
	style_ranking: "Front >> End",
	short_description: "Mile on dirt. ==Stamina 578 is enough==.",
	meta_analysis: "",
	team_comps: [{ text: "2 Front + 1 Late", note: "Henry's Team" }],
	stat_configs: [
		{ style: "everyone", label: "Minimum", speed: "1200*", stamina: "578*", power: "", guts: "400+", wit: "1000", footnote: "*Bonus Speed every 300 Power." },
	],
	uma_recommendations: [
		{ style: "front", stars: 5, role: "RA", note: "Use as runaway", uma: { id: 41, name: "Maruzensky", image: null } },
		{ style: "end", stars: 3, role: "", note: "", uma: { id: 42, name: "Gold Ship", image: null } },
	],
	skill_recommendations: [
		{ style: "everyone", category: "green", tier: 1, order: 0, note: "", skill: { id: 1, name: "Left-Handed ○", description: "Better on left turns.", image: null, rarity: 1, unique_of: null } },
		{ style: "front", category: "acceleration", tier: null, order: 0, note: "order 1", skill: { id: 2, name: "Angling and Scheming", description: "Accelerates.", image: null, rarity: 5, unique_of: "Seiun Sky" } },
	],
	style_notes: [{ style: "front", body: "**Acceleration:** Seiun first." }],
	decks: [
		{
			id: 7,
			style: "front",
			label: "Standard",
			note: "",
			slots: [
				{ slot: 1, order: 0, is_borrow: false, note: "Gold + Link", support_card: card(302, "Kitasan Black") },
				{ slot: 1, order: 1, is_borrow: false, note: "or any speed", support_card: null },
				{ slot: 4, order: 0, is_borrow: false, note: "Any Wit", support_card: null },
				{ slot: 6, order: 0, is_borrow: true, note: "", support_card: card(303, "Super Creek") },
			],
		},
	],
	honorable_mentions: [{ style: "front", note: "Stats + 2SP", support_card: card(304, "Fine Motion") }],
}

let events: RaceEvent[] = []
const fetchMock = vi.fn()

vi.mock("../services/CalculatorContext", () => ({
	useCalculatorData: () => ({
		championsMeetingData: events,
		leagueOfHeroesData: [],
		umaBannerData: [],
		supportBannerData: [],
		calculationConstants: DEFAULT_CONSTANTS,
	}),
}))

const { PvpGuidePage } = await import("../components/pvp/PvpGuidePage")
const { clearPvpGuideCache } = await import("../hooks/usePvpGuide")

function LocationProbe() {
	const location = useLocation()
	return <output data-testid="location">{location.pathname + location.search}</output>
}

function renderPage(url = "/app/pvp") {
	return render(
		<SiteContentContext.Provider value={buildSiteContentValue({ pages: [] })}>
			<MemoryRouter initialEntries={[url]}>
				<PvpGuidePage />
				<LocationProbe />
			</MemoryRouter>
		</SiteContentContext.Provider>
	)
}

function respond(status: number, body: unknown = {}) {
	// A fresh Response per call: a body can be read only once.
	fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(body), { status })))
}

beforeEach(() => {
	events = [OLD, NEXT, LATER]
	clearPvpGuideCache()
	fetchMock.mockReset()
	vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
	vi.unstubAllGlobals()
})

describe("PvpGuidePage", () => {
	it("opens on the next event and fetches its guide", async () => {
		respond(200, GUIDE)
		renderPage()
		expect(screen.getByRole("heading", { name: "Aquarius Cup" })).toBeInTheDocument()
		await screen.findByText("Recommended stats")
		expect(fetchMock.mock.calls[0][0]).toMatch(/\/pvp-guides\/cm\/10$/)
	})

	it("renders the sections the guide has, with highlights, alternates and the borrow ribbon", async () => {
		respond(200, GUIDE)
		renderPage()
		await screen.findByText("Recommended stats")
		expect(screen.getByText("Stamina 578 is enough").tagName).toBe("MARK")
		expect(screen.getByText("578*")).toBeInTheDocument()
		// The empty power cell is a dash, not a blank.
		expect(screen.getAllByText("–").length).toBeGreaterThan(0)
		expect(screen.getByText("*Bonus Speed every 300 Power.")).toBeInTheDocument()
		expect(screen.getByText("2 Front + 1 Late")).toBeInTheDocument()
		// Twice: the chip, and its hover detail.
		expect(screen.getAllByText("Left-Handed ○").length).toBe(2)
		// The front pane is first: uma, deck, alternate, note-only slot, borrow, mention.
		expect(screen.getByText("Maruzensky")).toBeInTheDocument()
		expect(screen.getByText("Kitasan Black")).toBeInTheDocument()
		expect(screen.getByText("or any speed")).toBeInTheDocument()
		expect(screen.getByText("Any Wit")).toBeInTheDocument()
		expect(screen.getAllByText("Borrow").length).toBe(1)
		expect(screen.getByText("Fine Motion")).toBeInTheDocument()
		// Sections the guide leaves empty step aside.
		expect(screen.queryByText("Meta analysis")).not.toBeInTheDocument()
	})

	it("switches style panes with the tabs", async () => {
		respond(200, GUIDE)
		renderPage()
		await screen.findByText("Recommended stats")
		const tabs = within(screen.getAllByRole("tablist", { name: "Running style" })[0])
		expect(tabs.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Front", "End"])
		fireEvent.click(tabs.getByRole("tab", { name: "End" }))
		expect(screen.getAllByText("Gold Ship").length).toBeGreaterThan(0)
	})

	it("shows the key dates from the constants", async () => {
		respond(200, GUIDE)
		renderPage()
		expect(screen.getByText("Registration opens")).toBeInTheDocument()
		expect(screen.getByText("Finals registration closes")).toBeInTheDocument()
	})

	it("says so when the event has no guide", async () => {
		respond(404, { error: "Guide not found" })
		renderPage("/app/pvp?event=cm-11")
		expect(await screen.findByText("No guide for this event yet.")).toBeInTheDocument()
		expect(screen.getByRole("heading", { name: "Pisces Cup" })).toBeInTheDocument()
	})

	it("flags a draft for staff", async () => {
		respond(200, { ...GUIDE, is_published: false })
		renderPage()
		expect(await screen.findByText("Draft, visible to staff only.")).toBeInTheDocument()
	})

	it("Previous and Next write ?event=", async () => {
		respond(404)
		renderPage("/app/pvp?event=cm-10")
		fireEvent.click(screen.getByRole("button", { name: /Next/ }))
		expect(screen.getByTestId("location").textContent).toBe("/app/pvp?event=cm-11")
		// Past events are hidden until asked for, so Aquarius is first and
		// Previous goes nowhere from it.
		fireEvent.click(screen.getByRole("button", { name: /Previous/ }))
		expect(screen.getByTestId("location").textContent).toBe("/app/pvp?event=cm-10")
		expect(screen.getByRole("button", { name: /Previous/ })).toBeDisabled()
		fireEvent.click(screen.getByRole("button", { name: "Show past events" }))
		fireEvent.click(screen.getByRole("button", { name: /Previous/ }))
		expect(screen.getByTestId("location").textContent).toBe("/app/pvp?event=cm-5")
	})

	it("stars events with a guide in the dropdown", () => {
		respond(404)
		renderPage()
		const select = screen.getByRole("combobox", { name: "Event" })
		const labels = within(select).getAllByRole("option").map((option) => option.textContent)
		expect(labels.some((label) => label?.startsWith("★ Aquarius Cup"))).toBe(true)
		expect(labels.some((label) => label?.startsWith("Pisces Cup"))).toBe(true)
	})

	it("retries after an error instead of caching it", async () => {
		fetchMock.mockRejectedValueOnce(new Error("offline"))
		vi.spyOn(console, "error").mockImplementation(() => {})
		renderPage()
		expect(await screen.findByText(/The guide didn't load/)).toBeInTheDocument()
		respond(200, GUIDE)
		fireEvent.click(screen.getByRole("button", { name: /Next/ }))
		fireEvent.click(screen.getByRole("button", { name: /Previous/ }))
		await waitFor(() => expect(screen.getByText("Recommended stats")).toBeInTheDocument())
	})
})
