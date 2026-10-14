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
		{ style: "everyone", category: "green", tier: 1, order: 0, note: "", skill: { id: 1, name: "Left-Handed ○", description: "Better on left turns.", image: null, rarity: 1, unique_of: null, version: "○ white", tier: 1, is_evolved: false, versions: [] } },
		{ style: "front", category: "acceleration", tier: null, order: 0, note: "order 1", skill: { id: 2, name: "Angling and Scheming", description: "Accelerates.", image: null, rarity: 5, unique_of: "Seiun Sky", version: "○ white", tier: 1, is_evolved: false, versions: [] } },
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

// The builder has its own tests (usePvpTeams, PvpCardPicker); here it only
// has to be the thing the My team view shows, for the selected event.
vi.mock("../components/pvp/TeamBuilder", () => ({
	TeamBuilder: ({ event: shown }: { event: RaceEvent }) => <div data-testid="team-builder">{`cm-${shown.id}`}</div>,
}))
// The gallery has its own tests (PvpGallery.test.tsx); here only which view shows.
vi.mock("../components/pvp/gallery/GalleryView", () => ({
	GalleryView: ({ event }: { event: { id: number } }) => <div data-testid="gallery-view">{`cm-${event.id}`}</div>,
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
		// The number reads large and the sheet's marker stays beside it.
		expect(screen.getByTitle("Stamina: 578*").textContent).toBe("578*")
		expect(screen.getByTitle("Guts: 400+").textContent).toBe("400+")
		// "+1 Gold" keeps its plus: a "+" before a digit is text, not a mark.
		expect(screen.getByTitle("Speed: 1200*").querySelector("sup")?.textContent).toBe("*")
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

describe("PvpGuidePage views and layout", () => {
	it("lists each recommended uma and card once (no second compare pane)", async () => {
		respond(200, GUIDE)
		renderPage()
		await screen.findByText("Recommended stats")
		expect(screen.getAllByText("Maruzensky")).toHaveLength(1)
		expect(screen.getAllByText("Kitasan Black")).toHaveLength(1)
		expect(screen.getAllByRole("tablist", { name: "Running style" })).toHaveLength(1)
	})

	it("keeps the cards new since the last event collapsed until asked", async () => {
		respond(404)
		renderPage("/app/pvp?event=cm-10")
		expect(screen.queryByText("New since")).not.toBeInTheDocument()
	})

	it("offers My team and the Gallery, kept in the URL", async () => {
		respond(200, GUIDE)
		renderPage("/app/pvp?event=cm-10")
		const views = within(screen.getByRole("tablist", { name: "View" }))
		expect(views.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
			"Recommendations",
			"My team",
			"Gallery",
		])
		fireEvent.click(views.getByRole("tab", { name: /My team/ }))
		expect(screen.getByTestId("location").textContent).toBe("/app/pvp?event=cm-10&view=team")
		expect(screen.getByTestId("team-builder").textContent).toBe("cm-10")
		fireEvent.click(views.getByRole("tab", { name: /Gallery/ }))
		expect(screen.getByTestId("location").textContent).toBe("/app/pvp?event=cm-10&view=gallery")
		expect(screen.getByTestId("gallery-view").textContent).toBe("cm-10")
		fireEvent.click(views.getByRole("tab", { name: "Recommendations" }))
		expect(screen.getByTestId("location").textContent).toBe("/app/pvp?event=cm-10")
	})

	it("does not fetch the guide on the gallery view", () => {
		respond(200, GUIDE)
		renderPage("/app/pvp?event=cm-10&view=gallery")
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it("shows the course as labelled values, with length and distance folded together", () => {
		respond(404)
		renderPage("/app/pvp?event=cm-10")
		const header = within(screen.getByRole("region", { name: "Aquarius Cup" }))
		expect(header.getByText("Racecourse").nextSibling?.textContent).toBe("Tokyo")
		expect(header.getByText("Distance").nextSibling?.textContent).toBe("1600m · Mile")
		// The sentinel "TBD" slots stay out.
		expect(header.queryByText("Weather")).not.toBeInTheDocument()
	})

	it("draws the key dates as steps and marks the next one", () => {
		respond(404)
		renderPage("/app/pvp?event=cm-10")
		const steps = within(screen.getByRole("list", { name: "Key dates" })).getAllByRole("listitem")
		expect(steps).toHaveLength(5)
		// The whole event is in 2099, so registration is the next step.
		expect(steps[0]).toHaveAttribute("aria-current", "step")
		expect(steps[1]).not.toHaveAttribute("aria-current")
	})

	it("splits a meeting's number from its cup name", () => {
		events = [event(20, "Champions Meeting 20 Sagittarius Cup", "2099-10-10T00:00:00Z")]
		respond(404)
		renderPage()
		expect(screen.getByRole("heading", { name: "Sagittarius Cup" })).toBeInTheDocument()
		expect(screen.getByText("Champions Meeting 20")).toBeInTheDocument()
	})
})

describe("PvpGuidePage skill mentions", () => {
	it("renders [[Skill]] in a style note and in a deck note as the skill, with its description", async () => {
		const groundwork = {
			id: 9, name: "Groundwork", description: "Front runners speed up early.", image: null, rarity: 1, unique_of: null,
			version: "○ white", tier: 1, is_evolved: false,
			versions: [{ id: 10, name: "Groundwork ◎", description: "Even earlier.", image: null, rarity: 2, tier: 2, version: "◎ gold", is_evolved: false }],
		}
		respond(200, {
			...GUIDE,
			style_notes: [{ style: "front", body: "Take [[groundwork]] first." }],
			decks: [{ ...GUIDE.decks[0], note: "Builds [[Groundwork]]" }],
			skill_mentions: { groundwork },
		})
		renderPage()
		await screen.findByText("Recommended stats")
		const chips = screen.getAllByRole("group", { name: "Groundwork" })
		expect(chips).toHaveLength(2)
		expect(within(chips[0]).getByRole("tooltip").textContent).toContain("Front runners speed up early.")
		// The other version rides along in the hover detail.
		expect(within(chips[0]).getByRole("tooltip").textContent).toContain("Groundwork ◎ ◎ gold")
	})

	it("shows an unresolved mention as its plain name", async () => {
		respond(200, { ...GUIDE, style_notes: [{ style: "front", body: "Take [[Gone Skill]]." }], skill_mentions: {} })
		renderPage()
		await screen.findByText("Recommended stats")
		expect(screen.getByText(/Take Gone Skill\./)).toBeInTheDocument()
		expect(screen.queryByRole("group", { name: "Gone Skill" })).not.toBeInTheDocument()
	})
})

describe("PvpGuidePage recommended skills", () => {
	it("merges the general skills into each position's Recommended skills", async () => {
		respond(200, GUIDE)
		renderPage()
		await screen.findByText("Recommended stats")
		const section = within(screen.getByRole("region", { name: "Recommended skills" }))
		// Front's own acceleration pick and the general green skill, side by side.
		expect(section.getByText("Acceleration")).toBeInTheDocument()
		expect(section.getByText("Green skills")).toBeInTheDocument()
		const general = section.getByRole("group", { name: "Left-Handed ○" })
		expect(within(general).getByRole("tooltip").textContent).toContain("Recommended for every position.")
		const own = section.getByRole("group", { name: "Angling and Scheming" })
		expect(within(own).getByRole("tooltip").textContent).not.toContain("every position")
		// No separate block for the general skills any more.
		expect(screen.queryByText("Skills for every style")).not.toBeInTheDocument()
	})

	it("shows the general skills in every position's tab", async () => {
		respond(200, GUIDE)
		renderPage()
		await screen.findByText("Recommended stats")
		fireEvent.click(within(screen.getByRole("tablist", { name: "Running style" })).getByRole("tab", { name: "End" }))
		const section = within(screen.getByRole("region", { name: "Recommended skills" }))
		expect(section.getByRole("group", { name: "Left-Handed ○" })).toBeInTheDocument()
		expect(section.queryByRole("group", { name: "Angling and Scheming" })).not.toBeInTheDocument()
	})
})

describe("PvpGuidePage stat values", () => {
	it("keeps the + of '+1 Gold' with its words, and the * as a mark", async () => {
		respond(200, {
			...GUIDE,
			stat_configs: [{ ...GUIDE.stat_configs[0], stamina: "901*+1 Gold", speed: "1500++" }],
		})
		renderPage()
		await screen.findByText("Recommended stats")
		const stamina = screen.getByTitle("Stamina: 901*+1 Gold")
		expect(stamina.querySelector("sup")?.textContent).toBe("*")
		expect(within(stamina).getByText("+1 Gold")).toBeInTheDocument()
		expect(screen.getByTitle("Speed: 1500++").querySelector("sup")?.textContent).toBe("++")
	})
})

describe("PvpGuidePage timeline link", () => {
	it("links back to the event's card on the Timeline", () => {
		respond(404)
		renderPage("/app/pvp?event=cm-10")
		expect(screen.getByRole("link", { name: "View on Timeline" })).toHaveAttribute("href", "/app/timeline?focus=cm-10")
	})
})
