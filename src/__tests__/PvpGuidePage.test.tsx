import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter, useLocation } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SiteContentContext } from "../services/SiteContentContext"
import { buildSiteContentValue } from "../services/siteContent"
import { DEFAULT_CONSTANTS } from "../constants/gameConstants"
import type { RaceEvent } from "../types"
import type { PvpGuide } from "../types/pvpGuide"
import { TestQueryProvider } from "../test/TestQueryProvider"

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
			is_highlighted: false,
			slots: [
				{ slot: 1, order: 0, is_borrow: false, note: "Gold + Link", support_card: card(302, "Kitasan Black") },
				{ slot: 1, order: 1, is_borrow: false, note: "or any speed", support_card: null },
				{ slot: 4, order: 0, is_borrow: false, note: "Any Wit", support_card: null },
				{ slot: 6, order: 0, is_borrow: true, note: "", support_card: card(303, "Super Creek") },
			],
		},
	],
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
// The page as everyone will have it, unless a test closes it: the early-access
// rule itself is tested in usePvpAccess.test.tsx.
const access = vi.hoisted(() => ({ value: "open" as "open" | "pending" | "locked" }))
vi.mock("../hooks/usePvpAccess", () => ({ usePvpAccess: () => access.value }))
// Nobody signed in unless a test says so (the Edit guide tab is for editors).
const session = vi.hoisted(() => ({ account: null as null | { guide_editor: boolean } }))
vi.mock("../services/AuthContext", async () => ({
	...(await vi.importActual<typeof import("../services/AuthContext")>("../services/AuthContext")),
	useAccount: () => ({ isLoggedIn: session.account !== null, status: session.account ? "ready" : "anonymous", account: session.account }),
}))
// The editor has its own tests (GuideEditor.test.tsx); here only that the
// tab opens it, for the selected event.
vi.mock("../components/pvp/editor/loadGuideEditor", () => ({
	loadGuideEditor: () =>
		Promise.resolve({ default: ({ event: shown }: { event: RaceEvent }) => <div data-testid="guide-editor">{`cm-${shown.id}`}</div> }),
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
		<TestQueryProvider>
			<SiteContentContext.Provider value={buildSiteContentValue({ pages: [] })}>
				<MemoryRouter initialEntries={[url]}>
					<PvpGuidePage />
					<LocationProbe />
				</MemoryRouter>
			</SiteContentContext.Provider>
		</TestQueryProvider>
	)
}

function respond(status: number, body: unknown = {}) {
	// A fresh Response per call: a body can be read only once.
	fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(body), { status })))
}

beforeEach(() => {
	events = [OLD, NEXT, LATER]
	// The page remembers where the tab left it (services/pvpPageMemory.ts);
	// without this, one test's last address would open the next test's page.
	sessionStorage.clear()
	clearPvpGuideCache()
	fetchMock.mockReset()
	vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
	vi.unstubAllGlobals()
})

describe("PvpGuidePage", () => {
	afterEach(() => {
		access.value = "open"
	})

	it("gives anyone it is locked to the next event's guide, with no card", async () => {
		access.value = "locked"
		respond(200, GUIDE)
		renderPage()
		await screen.findByText("Recommended stats")
		expect(fetchMock.mock.calls[0][0]).toMatch(/\/pvp-guides\/cm\/10$/)
		expect(screen.queryByRole("heading", { name: "This part is in early access" })).not.toBeInTheDocument()
	})

	it("opens a bare address on the free guide while locked, not where the tab left the page", () => {
		access.value = "locked"
		sessionStorage.setItem("pvp-page", "?event=cm-11&view=gallery")
		respond(200, GUIDE)
		renderPage()
		expect(screen.getByTestId("location").textContent).toBe("/app/pvp")
		expect(screen.getByRole("heading", { name: "Aquarius Cup" })).toBeInTheDocument()
	})

	it("shows the card in place of any other guide, and fetches none", () => {
		access.value = "locked"
		renderPage("/app/pvp?event=cm-11")
		expect(screen.getByRole("heading", { name: "This part is in early access" })).toBeInTheDocument()
		expect(screen.getByRole("link", { name: "Read the Aquarius Cup guide" })).toHaveAttribute("href", "/app/pvp?event=cm-10")
		expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login")
		expect(screen.getByRole("link", { name: /Support us on Patreon/ })).toHaveAttribute("href", expect.stringContaining("patreon.com"))
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it("keeps My team and the Gallery closed while locked, even on the free event", () => {
		access.value = "locked"
		renderPage("/app/pvp?event=cm-10&view=team")
		expect(screen.getByRole("heading", { name: "This part is in early access" })).toBeInTheDocument()
		expect(screen.queryByTestId("team-builder")).not.toBeInTheDocument()
		fireEvent.click(screen.getByRole("tab", { name: "Gallery" }))
		expect(screen.getByRole("heading", { name: "This part is in early access" })).toBeInTheDocument()
		expect(screen.queryByTestId("gallery-view")).not.toBeInTheDocument()
	})

	it("waits for the account rather than flashing the card at a supporter", () => {
		access.value = "pending"
		renderPage()
		expect(screen.getByText("Checking your account…")).toBeInTheDocument()
		expect(screen.queryByRole("heading", { name: "This part is in early access" })).not.toBeInTheDocument()
	})

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
		// The front pane is first: uma, deck, alternate, note-only slot, borrow.
		expect(screen.getByText("Maruzensky")).toBeInTheDocument()
		expect(screen.getByText("Kitasan Black")).toBeInTheDocument()
		expect(screen.getByText("or any speed")).toBeInTheDocument()
		expect(screen.getByText("Any Wit")).toBeInTheDocument()
		expect(screen.getAllByText("Borrow").length).toBe(1)
		// Sections the guide leaves empty step aside.
		expect(screen.queryByText("Meta analysis")).not.toBeInTheDocument()
	})

	it("switches style panes with the tabs", async () => {
		respond(200, GUIDE)
		renderPage()
		await screen.findByText("Recommended stats")
		const tabs = within(screen.getAllByRole("tablist", { name: "Running style" })[0])
		expect(tabs.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["All", "Front", "End"])
		fireEvent.click(tabs.getByRole("tab", { name: "End" }))
		expect(screen.getAllByText("Gold Ship").length).toBeGreaterThan(0)
	})

	it("shows every style at once on the All tab, and puts it in the address", async () => {
		respond(200, GUIDE)
		renderPage()
		await screen.findByText("Recommended stats")
		expect(screen.queryByText("Gold Ship")).not.toBeInTheDocument()
		fireEvent.click(within(screen.getAllByRole("tablist", { name: "Running style" })[0]).getByRole("tab", { name: "All" }))
		const panel = screen.getByRole("tabpanel", { name: "All" })
		expect(within(panel).getByRole("region", { name: "Front" })).toBeInTheDocument()
		expect(within(panel).getByRole("region", { name: "End" })).toBeInTheDocument()
		expect(within(panel).getAllByText("Maruzensky").length).toBeGreaterThan(0)
		expect(within(panel).getAllByText("Gold Ship").length).toBeGreaterThan(0)
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

	it("gives an editor an Edit guide tab, and nobody else", async () => {
		respond(200, GUIDE)
		session.account = { guide_editor: true }
		try {
			const { unmount } = renderPage("/app/pvp?event=cm-10")
			const views = within(screen.getByRole("tablist", { name: "View" }))
			expect(views.getAllByRole("tab")).toHaveLength(4)
			fireEvent.click(views.getByRole("tab", { name: "Edit guide" }))
			expect(screen.getByTestId("location").textContent).toBe("/app/pvp?event=cm-10&view=editor")
			expect(await screen.findByTestId("guide-editor")).toHaveTextContent("cm-10")
			unmount()
		} finally {
			session.account = null
		}
		// A visitor with the same link lands on Recommendations.
		renderPage("/app/pvp?event=cm-10&view=editor")
		expect(screen.getAllByRole("tab", { name: "Recommendations" })[0]).toHaveAttribute("aria-selected", "true")
		expect(screen.queryByRole("tab", { name: "Edit guide" })).not.toBeInTheDocument()
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
		// By accessible name: on a phone the first tab shows "Guide", but its
		// name stays "Recommendations" (the short label is aria-hidden).
		expect(views.getAllByRole("tab")).toEqual([
			views.getByRole("tab", { name: "Recommendations" }),
			views.getByRole("tab", { name: "My team" }),
			views.getByRole("tab", { name: "Gallery" }),
		])
		fireEvent.click(views.getByRole("tab", { name: /My team/ }))
		expect(screen.getByTestId("location").textContent).toBe("/app/pvp?event=cm-10&view=team")
		expect(screen.getByTestId("team-builder").textContent).toBe("cm-10")
		fireEvent.click(views.getByRole("tab", { name: /Gallery/ }))
		expect(screen.getByTestId("location").textContent).toBe("/app/pvp?event=cm-10&view=gallery")
		// A chunk of its own now (gallery/loadGallery.ts), so it arrives a tick later.
		expect((await screen.findByTestId("gallery-view")).textContent).toBe("cm-10")
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
		// The other version rides along in the hover detail, its colour as a word.
		expect(within(chips[0]).getByRole("tooltip").textContent).toContain("Groundwork ◎ gold")
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
	it("shows the general skills once, under the Overview, and each position's tab only its own", async () => {
		respond(200, GUIDE)
		renderPage()
		await screen.findByText("Recommended stats")
		const general = () => within(screen.getByRole("region", { name: "General skills" }))
		const own = () => within(screen.getByRole("region", { name: "Recommended skills" }))
		expect(general().getByText("Green skills")).toBeInTheDocument()
		expect(general().getByRole("group", { name: "Left-Handed ○" })).toBeInTheDocument()
		expect(general().queryByRole("group", { name: "Angling and Scheming" })).not.toBeInTheDocument()
		// Front's tab: its acceleration pick, and no general green skill.
		expect(own().getByText("Acceleration")).toBeInTheDocument()
		expect(own().getByRole("group", { name: "Angling and Scheming" })).toBeInTheDocument()
		expect(own().queryByRole("group", { name: "Left-Handed ○" })).not.toBeInTheDocument()
		// End has no skills of its own, so no Recommended skills; the general
		// section stays where it is.
		fireEvent.click(within(screen.getByRole("tablist", { name: "Running style" })).getByRole("tab", { name: "End" }))
		expect(screen.queryByRole("region", { name: "Recommended skills" })).not.toBeInTheDocument()
		expect(general().getByRole("group", { name: "Left-Handed ○" })).toBeInTheDocument()
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

describe("PvpGuidePage style links and memory", () => {
	const styleTabs = () => within(screen.getAllByRole("tablist", { name: "Running style" })[0])
	const location = () => screen.getByTestId("location").textContent

	it("keeps the style in the URL, and keeps it when the event changes", async () => {
		respond(200, GUIDE)
		renderPage("/app/pvp?event=cm-10")
		await screen.findByText("Recommended stats")
		fireEvent.click(styleTabs().getByRole("tab", { name: "End" }))
		expect(location()).toBe("/app/pvp?event=cm-10&style=end")
		fireEvent.click(screen.getByRole("button", { name: /Next/ }))
		expect(location()).toBe("/app/pvp?event=cm-11&style=end")
		await screen.findByText("Recommended stats")
		expect(styleTabs().getByRole("tab", { name: "End" })).toHaveAttribute("aria-selected", "true")
	})

	it("opens on the style a link names", async () => {
		respond(200, GUIDE)
		renderPage("/app/pvp?event=cm-10&style=end")
		await screen.findByText("Recommended stats")
		expect(styleTabs().getByRole("tab", { name: "End" })).toHaveAttribute("aria-selected", "true")
		expect(screen.getAllByText("Gold Ship").length).toBeGreaterThan(0)
	})

	it("shows the first style when the guide lacks the one asked for, and keeps the ask", async () => {
		respond(200, GUIDE)
		renderPage("/app/pvp?event=cm-10&style=pace")
		await screen.findByText("Recommended stats")
		expect(styleTabs().getByRole("tab", { name: "Front" })).toHaveAttribute("aria-selected", "true")
		expect(location()).toBe("/app/pvp?event=cm-10&style=pace")
	})

	it("goes back to where the tab left the page when the bare page is opened", () => {
		respond(404)
		const first = renderPage("/app/pvp?event=cm-11&view=gallery")
		first.unmount()
		renderPage("/app/pvp")
		expect(location()).toBe("/app/pvp?event=cm-11&view=gallery")
		expect(screen.getByTestId("gallery-view").textContent).toBe("cm-11")
	})

	it("comes back to Recommendations from My team on the bare page", async () => {
		// The navbar link: no event in the address. Recommendations clears
		// `?view=`, and the address must still name the event, or the bare
		// page reads as a fresh arrival and sends the tab back to My team.
		respond(200, GUIDE)
		renderPage("/app/pvp")
		const views = within(screen.getByRole("tablist", { name: "View" }))
		fireEvent.click(views.getByRole("tab", { name: /My team/ }))
		expect(location()).toBe("/app/pvp?event=cm-10&view=team")
		fireEvent.click(views.getByRole("tab", { name: "Recommendations" }))
		expect(location()).toBe("/app/pvp?event=cm-10")
		expect(await screen.findByText("Recommended stats")).toBeInTheDocument()
	})

	it("goes where a link to an event says, on the last style shown", async () => {
		respond(200, GUIDE)
		const first = renderPage("/app/pvp?event=cm-11&style=end")
		await screen.findByText("Recommended stats")
		first.unmount()
		// A Timeline card's link: the event only.
		renderPage("/app/pvp?event=cm-10")
		await screen.findByText("Recommended stats")
		expect(location()).toBe("/app/pvp?event=cm-10")
		expect(styleTabs().getByRole("tab", { name: "End" })).toHaveAttribute("aria-selected", "true")
	})

	it("copies a link to the event and the style on screen, and never My team", async () => {
		const writeText = vi.fn(() => Promise.resolve())
		Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
		respond(200, GUIDE)
		// No ?event=: the link still names it, since the default moves with the calendar.
		renderPage("/app/pvp")
		await screen.findByText("Recommended stats")
		fireEvent.click(styleTabs().getByRole("tab", { name: "End" }))
		const copy = () => fireEvent.click(screen.getByRole("button", { name: "Copy link" }))
		copy()
		await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(`${window.location.origin}/app/pvp?event=cm-10&style=end`))

		const views = within(screen.getByRole("tablist", { name: "View" }))
		fireEvent.click(views.getByRole("tab", { name: /Gallery/ }))
		copy()
		await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(`${window.location.origin}/app/pvp?event=cm-10&view=gallery`))

		fireEvent.click(views.getByRole("tab", { name: /My team/ }))
		copy()
		await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(`${window.location.origin}/app/pvp?event=cm-10`))
	})
})

describe("PvpGuidePage comments", () => {
	const THREAD = {
		count: 1, page: 1, has_more: false,
		results: [{
			id: 5, state: "visible", body: "Why Seiun first?", created_at: "2026-10-11T00:00:00Z", edited: false,
			earlier_version: false, is_author: false, is_mine: false, upvotes: 2, my_vote: false, replies: [],
			poster: { display_name: "Trainer", portrait: null, tier_name: null, gallery_style: null },
		}],
	}

	beforeEach(() => {
		// The guide, and a section's thread: told apart by the address.
		fetchMock.mockImplementation((url: string) =>
			Promise.resolve(new Response(JSON.stringify(
				String(url).includes("/comments") ? THREAD : { ...GUIDE, comment_counts: { front: 1, "": 3 } }
			), { status: 200 }))
		)
	})

	it("folds each style's thread under its pane, with the count, and opens it on a click", async () => {
		renderPage()
		const toggle = await screen.findByRole("button", { name: "Comments (1)" })
		expect(toggle).toHaveAttribute("aria-expanded", "false")
		expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/comments"))).toBe(false)
		fireEvent.click(toggle)
		expect(await screen.findByText("Why Seiun first?")).toBeInTheDocument()
		const asked = fetchMock.mock.calls.map(([url]) => String(url)).find((url) => url.includes("/comments"))
		expect(asked).toContain(`/pvp-guides/cm/${NEXT.id}/comments?section=front`)
		// The thumbs-up count shows; a guest has nothing to press.
		expect(screen.getByLabelText("2 thumbs-up")).toBeInTheDocument()
	})

	it("keeps a thread for the whole guide in the side column", async () => {
		renderPage()
		expect(await screen.findByRole("button", { name: "Comments (3)" })).toBeInTheDocument()
	})

	it("shows each style's count on the All tab, and goes to that tab", async () => {
		renderPage()
		await screen.findByText("Recommended stats")
		fireEvent.click(within(screen.getAllByRole("tablist", { name: "Running style" })[0]).getByRole("tab", { name: "All" }))
		fireEvent.click(screen.getByRole("button", { name: "Comments (1) on the Front tab" }))
		expect(screen.getByTestId("location").textContent).toContain("style=front")
	})
})
