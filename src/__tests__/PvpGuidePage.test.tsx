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
	under_construction: false,
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
vi.mock("../components/pvp/TeamBuilder", async () => {
	const { useLocation } = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
	return {
		// The router state it was opened with, for "Use this deck".
		TeamBuilder: ({ event: shown }: { event: RaceEvent }) => (
			<div data-testid="team-builder" data-state={JSON.stringify(useLocation().state)}>{`cm-${shown.id}`}</div>
		),
	}
})
// The runs view has its own tests (RunsView.test.tsx); here only which view shows.
vi.mock("../components/pvp/RunsView", () => ({
	RunsView: ({ event: shown }: { event: RaceEvent }) => <div data-testid="runs-view">{`cm-${shown.id}`}</div>,
}))
// The page as everyone will have it, unless a test closes it: the early-access
// rule itself is tested in usePvpAccess.test.tsx.
const access = vi.hoisted(() => ({ value: "open" as "open" | "pending" | "locked" }))
vi.mock("../hooks/usePvpAccess", async () => ({
	...(await vi.importActual<typeof import("../hooks/usePvpAccess")>("../hooks/usePvpAccess")),
	usePvpAccess: () => access.value,
}))
// Nobody signed in unless a test says so (the Edit guide tab is for editors).
const session = vi.hoisted(() => ({ account: null as null | { guide_editor?: boolean; early_access?: boolean } }))
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
// Rankings has its own tests (PvpGalleryRankings.test.tsx); here only who gets it.
vi.mock("../components/pvp/PvpGalleryRankings", () => ({
	PvpGalleryRankings: ({ event }: { event: { id: number } }) => <div data-testid="rankings-view">{`cm-${event.id}`}</div>,
}))
// The gallery has its own tests (PvpGallery.test.tsx); here only which view shows.
vi.mock("../components/pvp/gallery/GalleryView", () => ({
	GalleryView: ({ event }: { event: { id: number } }) => <div data-testid="gallery-view">{`cm-${event.id}`}</div>,
}))

const { PvpGuidePage } = await import("../components/pvp/PvpGuidePage")
const { PVP_OPEN_CM_NUMBER } = await import("../hooks/usePvpAccess")
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

	it("opens all of the open CM to everyone, guide, My team and Gallery", async () => {
		access.value = "locked"
		events = [OLD, NEXT, LATER, event(PVP_OPEN_CM_NUMBER ?? 0, "Capricorn Cup", "2100-06-01T00:00:00Z")]
		respond(200, GUIDE)
		renderPage(`/app/pvp?event=cm-${PVP_OPEN_CM_NUMBER}&view=team`)
		expect(screen.getByTestId("team-builder")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("tab", { name: "Gallery" }))
		expect(await screen.findByTestId("gallery-view")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("tab", { name: "Recommendations" }))
		await screen.findByText("Recommended stats")
		expect(screen.queryByRole("heading", { name: "This part is in early access" })).not.toBeInTheDocument()
	})

	it("lists only the free guide's event and the open CM while locked, with no past toggle", () => {
		access.value = "locked"
		events = [OLD, NEXT, LATER, event(PVP_OPEN_CM_NUMBER ?? 0, "Capricorn Cup", "2100-06-01T00:00:00Z")]
		respond(200, GUIDE)
		renderPage()
		const options = within(screen.getByRole("combobox", { name: "Event" })).getAllByRole("option")
		expect(options.map((option) => option.textContent)).toEqual([
			expect.stringContaining("Aquarius Cup"),
			expect.stringContaining("Capricorn Cup"),
		])
		expect(screen.queryByRole("button", { name: "Show past events" })).not.toBeInTheDocument()
	})

	it("still lists a locked event a link opened, so the list shows what is on screen", () => {
		access.value = "locked"
		renderPage("/app/pvp?event=cm-11")
		expect(screen.getByRole("combobox", { name: "Event" })).toHaveDisplayValue(/Pisces Cup/)
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
		// A note-only "or any speed" alternative is one line with the stat icon.
		expect(screen.getByText(/Speed card/).textContent).toBe("or any  Speed card")
		expect(screen.getByText("Any Wit")).toBeInTheDocument()
		expect(screen.getAllByText("Borrow").length).toBe(1)
		// Sections the guide leaves empty step aside.
		expect(screen.queryByText("Meta analysis")).not.toBeInTheDocument()
	})

	it("says when the guide is still being updated", async () => {
		respond(200, { ...GUIDE, under_construction: true })
		renderPage()
		await screen.findByText("Recommended stats")
		expect(screen.getByText("Under construction.").closest("[role=status]")).toHaveTextContent(/This guide is still being updated/)
	})

	it("shows no construction banner on a finished guide", async () => {
		respond(200, GUIDE)
		renderPage()
		await screen.findByText("Recommended stats")
		expect(screen.queryByText(/Under construction/)).not.toBeInTheDocument()
	})

	it("switches style panes with the tabs", async () => {
		respond(200, GUIDE)
		renderPage()
		await screen.findByText("Recommended stats")
		const tabs = within(screen.getAllByRole("tablist", { name: "Running style" })[0])
		// Each ranked style shows its place in "Front >> End"; the name stays the style's.
		expect(tabs.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["All", "Front#1", "End#2"])
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
		// An editor is staff, so early access too: Rankings as well.
		session.account = { guide_editor: true, early_access: true }
		try {
			const { unmount } = renderPage("/app/pvp?event=cm-10")
			const views = within(screen.getByRole("tablist", { name: "View" }))
			expect(views.getAllByRole("tab")).toHaveLength(6)
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

	it("draws Rankings for early access only; anyone else never sees the tab", () => {
		respond(200, GUIDE)
		const { unmount } = renderPage("/app/pvp?event=cm-10&view=rankings")
		expect(screen.queryByRole("tab", { name: "Rankings" })).not.toBeInTheDocument()
		// The link alone lands on the guide, with no lock card about Rankings.
		expect(screen.getAllByRole("tab", { name: "Recommendations" })[0]).toHaveAttribute("aria-selected", "true")
		expect(screen.queryByTestId("rankings-view")).not.toBeInTheDocument()
		unmount()
		session.account = { early_access: true }
		try {
			renderPage("/app/pvp?event=cm-10&view=rankings")
			expect(screen.getByRole("tab", { name: "Rankings" })).toHaveAttribute("aria-selected", "true")
			expect(screen.getByTestId("rankings-view")).toHaveTextContent("cm-10")
		} finally {
			session.account = null
		}
	})

	it("keeps the cards new since the last event collapsed until asked", async () => {
		respond(404)
		renderPage("/app/pvp?event=cm-10")
		expect(screen.queryByText("New since")).not.toBeInTheDocument()
	})

	it("offers My team, CM Runs and the Gallery, kept in the URL", async () => {
		respond(200, GUIDE)
		renderPage("/app/pvp?event=cm-10")
		const views = within(screen.getByRole("tablist", { name: "View" }))
		// By accessible name: on a phone the first tab shows "Guide", but its
		// name stays "Recommendations" (the short label is aria-hidden).
		expect(views.getAllByRole("tab")).toEqual([
			views.getByRole("tab", { name: "Recommendations" }),
			views.getByRole("tab", { name: "My team" }),
			views.getByRole("tab", { name: "CM Runs" }),
			views.getByRole("tab", { name: "Gallery" }),
		])
		fireEvent.click(views.getByRole("tab", { name: /My team/ }))
		expect(screen.getByTestId("location").textContent).toBe("/app/pvp?event=cm-10&view=team")
		expect(screen.getByTestId("team-builder").textContent).toBe("cm-10")
		fireEvent.click(views.getByRole("tab", { name: /CM Runs/ }))
		expect(screen.getByTestId("location").textContent).toBe("/app/pvp?event=cm-10&view=runs")
		expect(screen.getByTestId("runs-view").textContent).toBe("cm-10")
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

	it("shows the course as four pairs, the band under the metres", () => {
		respond(404)
		renderPage("/app/pvp?event=cm-10")
		const header = within(screen.getByRole("region", { name: "Aquarius Cup" }))
		expect(header.getByText("Racecourse").nextSibling?.textContent).toBe("Tokyo")
		const distance = header.getByText("Distance").nextSibling
		expect(distance?.textContent).toBe("1,600m")
		expect(distance?.nextSibling?.textContent).toBe("Mile")
		// A pair whose halves are both the sentinel "TBD" stays out.
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
		// Each step shows a time under its date, and the zone is named once, above.
		for (const step of steps) expect(step.textContent).toMatch(/\d:\d\d/)
		expect(screen.getAllByText(/^· times in \S/)).toHaveLength(1)
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

describe("PvpGuidePage band", () => {
	it("draws the ranking as a ladder whose steps open their style", async () => {
		respond(200, GUIDE)
		renderPage("/app/pvp?event=cm-10")
		await screen.findByText("Recommended stats")
		const ladder = within(screen.getByRole("list", { name: "Style ranking" }))
		expect(ladder.getByRole("button", { name: "Front, rank 1" })).toHaveAttribute("aria-pressed", "true")
		// ">>" reads as words to a screen reader.
		expect(ladder.getByText("A clear gap, then")).toBeInTheDocument()
		fireEvent.click(ladder.getByRole("button", { name: "End, rank 2" }))
		expect(screen.getByTestId("location").textContent).toBe("/app/pvp?event=cm-10&style=end")
		expect(within(screen.getAllByRole("tablist", { name: "Running style" })[0]).getByRole("tab", { name: "End" })).toHaveAttribute("aria-selected", "true")
	})

	it("puts the team-wide parts in the band, with the scenario, and no Overview box", async () => {
		respond(200, GUIDE)
		renderPage()
		await screen.findByText("Recommended stats")
		expect(screen.queryByRole("region", { name: "Overview" })).not.toBeInTheDocument()
		const team = within(screen.getByRole("region", { name: "For the whole team" }))
		expect(team.getByText("Recommended stats")).toBeInTheDocument()
		expect(team.getByText("Trackblazer")).toBeInTheDocument()
		expect(team.getByText("2 Front + 1 Late")).toBeInTheDocument()
	})

	it("draws one plain stats row as five tiles, and more rows as the table", async () => {
		const plain = { style: "everyone" as const, label: "", speed: "1600", stamina: "350", power: "1200+", guts: "700+", wit: "1100+", footnote: "" }
		respond(200, { ...GUIDE, stat_configs: [plain] })
		const first = renderPage()
		await screen.findByText("Recommended stats")
		expect(screen.getByTitle("Power: 1200+").querySelector("sup")?.textContent).toBe("+")
		expect(screen.queryByRole("table")).not.toBeInTheDocument()
		first.unmount()

		clearPvpGuideCache()
		respond(200, { ...GUIDE, stat_configs: [plain, { ...plain, label: "Monster", footnote: "For Monster Trainer." }] })
		renderPage()
		await screen.findByText("Recommended stats")
		expect(screen.getByRole("table")).toBeInTheDocument()
		expect(screen.getByText("Monster")).toBeInTheDocument()
		expect(screen.getByText("For Monster Trainer.")).toBeInTheDocument()
	})
})

describe("PvpGuidePage All tab", () => {
	const front = (id: number, name: string, stars: number) => ({ style: "front" as const, stars, role: "", note: "", uma: { id, name, image: null } })
	const slots = (cards: Array<[number, string]>) =>
		cards.map(([cardId, name], index) => ({ slot: index + 1, order: 0, is_borrow: index === 5, note: "", support_card: card(cardId, name) }))
	const PREVIEW: PvpGuide = {
		...GUIDE,
		// End ranks first here, so the boxes run End, Front.
		style_ranking: "End > Front",
		uma_recommendations: [
			front(41, "Maruzensky", 5),
			...[51, 52, 53, 54, 55].map((id) => front(id, `Uma ${id}`, 3)),
			front(56, "Seventh Uma", 1),
			GUIDE.uma_recommendations[1],
		],
		decks: [
			{ id: 1, style: "front", label: "Beginner", note: "", is_highlighted: false, slots: slots([[1, "Agnes Tachyon"], [2, "Mejiro Ardan"]]) },
			{ id: 2, style: "front", label: "Whale", note: "", is_highlighted: false, slots: slots([[1, "Agnes Tachyon"], [5, "Sweep Tosho"]]) },
			{
				id: 3, style: "front", label: "Honorable Mentions", note: "", is_highlighted: true,
				slots: slots([[11, "Card 11"], [12, "Card 12"], [13, "Card 13"], [14, "Card 14"], [15, "Card 15"], [16, "Card 16"], [17, "Card 17"], [18, "Card 18"]]),
			},
		],
	}
	const openAll = async () => {
		renderPage()
		await screen.findByText("Recommended stats")
		fireEvent.click(within(screen.getAllByRole("tablist", { name: "Running style" })[0]).getByRole("tab", { name: "All" }))
		return within(screen.getByRole("tabpanel", { name: "All" }))
	}

	beforeEach(() => respond(200, PREVIEW))

	it("puts a box per style in the guide's ranking order", async () => {
		const panel = await openAll()
		expect(panel.getAllByRole("region").map((region) => region.getAttribute("aria-label"))).toEqual(["End", "Front"])
	})

	it("shows six faces, most stars first, and a +N that opens the style", async () => {
		const box = within((await openAll()).getByRole("region", { name: "Front" }))
		// Each face is a group named for her, her details in its hover.
		const line = within(box.getByText("Umas").nextElementSibling as HTMLElement)
		expect(line.getAllByRole("group").map((face) => face.getAttribute("aria-label"))).toEqual(["Maruzensky", "Uma 51", "Uma 52", "Uma 53", "Uma 54", "Uma 55"])
		fireEvent.click(box.getByRole("button", { name: "1 more, open Front" }))
		expect(screen.getByTestId("location").textContent).toContain("style=front")
	})

	it("draws every deck on its own labelled line, the swap-ins capped at six, and no budget control", async () => {
		const panel = await openAll()
		const box = within(panel.getByRole("region", { name: "Front" }))
		expect(box.getAllByRole("term").map((term) => term.textContent)).toEqual(["Umas", "Skills", "Beginner", "Whale", "Honorable Mentions"])
		const swapIns = within(box.getByText("Honorable Mentions").nextElementSibling as HTMLElement)
		expect(swapIns.getAllByRole("group")).toHaveLength(6)
		expect(swapIns.getByRole("button", { name: "2 more, open Front" })).toBeInTheDocument()
		expect(panel.queryByRole("group", { name: "Deck budget" })).not.toBeInTheDocument()
		expect(panel.queryByText(/Compared with/)).not.toBeInTheDocument()
	})

	it("shows the style's top skills, and opens the style from its header", async () => {
		const box = within((await openAll()).getByRole("region", { name: "Front" }))
		expect(box.getByRole("group", { name: "Angling and Scheming" })).toBeInTheDocument()
		fireEvent.click(box.getByRole("button", { name: "Open Front, 0 comments" }))
		expect(screen.getByTestId("location").textContent).toContain("style=front")
	})
})

describe("PvpGuidePage decks", () => {
	const deck = (id: number, label: string, cards: Array<[number, string, string?]>, extra: Partial<PvpGuide["decks"][number]> = {}) => ({
		id,
		style: "front" as const,
		label,
		note: "",
		is_highlighted: false,
		slots: cards.map(([cardId, name, note = ""], index) => ({
			slot: index + 1, order: 0, is_borrow: index === 5, note, support_card: card(cardId, name),
		})),
		...extra,
	})
	const LADDER = [
		deck(1, "Beginner", [[1, "Agnes Tachyon", "==2SP & Scenario Link=="], [2, "Mejiro Ardan"], [3, "Light Hello", "==[[Groundwork]] & Hints=="]]),
		deck(2, "Standard", [[1, "Agnes Tachyon"], [4, "Kitasan Black"], [3, "Light Hello"]]),
		deck(3, "Whale", [[1, "Agnes Tachyon"], [5, "Sweep Tosho"], [3, "Light Hello"]]),
		deck(4, "Honorable Mentions", [[6, "Sakura Bakushin O", "[[Turbo Sprint]]"], [7, "Mr. C.B.", "Stats"]], {
			is_highlighted: true, note: "Replacement cards that you can slot into the deck instead.",
		}),
	]

	beforeEach(() => localStorage.removeItem("uma-planner-pvp-deck-budget"))

	it("shows one deck at a time, picked by budget, with what every deck shares", async () => {
		respond(200, { ...GUIDE, decks: LADDER })
		renderPage()
		await screen.findByText("Recommended stats")
		const budget = within(screen.getByRole("group", { name: "Deck budget" }))
		expect(budget.getAllByRole("button").map((button) => button.textContent)).toEqual(["Beginner", "Standard", "Whale", "All"])
		expect(budget.getByRole("button", { name: "Beginner" })).toHaveAttribute("aria-pressed", "true")
		expect(screen.getByText("In every Front deck:").parentElement?.textContent).toBe("In every Front deck: Agnes Tachyon and Light Hello.")
		expect(screen.getByText("Mejiro Ardan")).toBeInTheDocument()
		expect(screen.queryByText("Kitasan Black")).not.toBeInTheDocument()

		fireEvent.click(budget.getByRole("button", { name: "Standard" }))
		expect(await screen.findByText("Kitasan Black")).toBeInTheDocument()
		await waitFor(() => expect(screen.queryByText("Mejiro Ardan")).not.toBeInTheDocument())
		expect(screen.getByText("Compared with Beginner: swaps in Kitasan Black for Mejiro Ardan.")).toBeInTheDocument()
	})

	it("trades only the changed cards when the budget changes, keeping the ones both decks hold", async () => {
		respond(200, { ...GUIDE, decks: LADDER })
		renderPage()
		await screen.findByText("Recommended stats")
		// The same element before and after: neither the deck's box nor the
		// card's cell is remounted, which is what lets it stay or glide.
		const kept = screen.getByText("Agnes Tachyon")
		fireEvent.click(within(screen.getByRole("group", { name: "Deck budget" })).getByRole("button", { name: "Standard" }))
		expect(await screen.findByText("Kitasan Black")).toBeInTheDocument()
		expect(screen.getByText("Agnes Tachyon")).toBe(kept)
		await waitFor(() => expect(screen.queryByText("Mejiro Ardan")).not.toBeInTheDocument())
	})

	it("hands a deck to My team with Use this deck, through the router state", async () => {
		respond(200, { ...GUIDE, decks: LADDER })
		renderPage()
		await screen.findByText("Recommended stats")
		fireEvent.click(screen.getByRole("button", { name: "Use this deck (Beginner)" }))
		expect(screen.getByTestId("location").textContent).toContain("view=team")
		expect(screen.getByTestId("location").textContent).not.toContain("deck")
		expect(screen.getByTestId("team-builder")).toHaveAttribute("data-state", JSON.stringify({ useDeck: { deckId: 1 } }))
	})

	it("offers Use this deck on a style's tab only, and not where My team is locked", async () => {
		respond(200, { ...GUIDE, decks: LADDER })
		const first = renderPage()
		await screen.findByText("Recommended stats")
		fireEvent.click(within(screen.getAllByRole("tablist", { name: "Running style" })[0]).getByRole("tab", { name: "All" }))
		expect(screen.queryByRole("button", { name: /Use this deck/ })).not.toBeInTheDocument()
		first.unmount()

		// Locked, this reader still has the free guide, but not My team.
		access.value = "locked"
		try {
			renderPage()
			await screen.findByText("Recommended stats")
			expect(screen.getByText("Mejiro Ardan")).toBeInTheDocument()
			expect(screen.queryByRole("button", { name: /Use this deck/ })).not.toBeInTheDocument()
		} finally {
			access.value = "open"
		}
	})

	it("opens every deck on All, and remembers the pick for the next guide", async () => {
		respond(200, { ...GUIDE, decks: LADDER })
		const first = renderPage()
		await screen.findByText("Recommended stats")
		fireEvent.click(within(screen.getByRole("group", { name: "Deck budget" })).getByRole("button", { name: "All" }))
		expect(await screen.findByText("Kitasan Black")).toBeInTheDocument()
		expect(screen.getByText("Sweep Tosho")).toBeInTheDocument()
		expect(screen.getByText("Mejiro Ardan")).toBeInTheDocument()
		expect(localStorage.getItem("uma-planner-pvp-deck-budget")).toBe("All")
		first.unmount()

		renderPage()
		await screen.findByText("Recommended stats")
		expect(within(screen.getByRole("group", { name: "Deck budget" })).getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true")
	})

	it("draws a swap-in deck as its own row, with no borrow tab", async () => {
		respond(200, { ...GUIDE, decks: LADDER })
		renderPage()
		await screen.findByText("Recommended stats")
		const row = within(screen.getByRole("region", { name: "Honorable Mentions" }))
		expect(row.getByText("Sakura Bakushin O")).toBeInTheDocument()
		expect(row.getByText("Stats")).toBeInTheDocument()
		expect(row.queryByText("Borrow")).not.toBeInTheDocument()
		// Not a budget: the control names only the ladder.
		expect(within(screen.getByRole("group", { name: "Deck budget" })).queryByRole("button", { name: "Honorable Mentions" })).not.toBeInTheDocument()
	})

	it("marks a linked card with the scenario's name, and draws no red on a card", async () => {
		respond(200, { ...GUIDE, decks: LADDER })
		renderPage()
		await screen.findByText("Recommended stats")
		expect(screen.getByLabelText("Linked to Trackblazer")).toBeInTheDocument()
		// "==2SP & Scenario Link==" is a tag and the badge; "==[[Groundwork]] & Hints==" a skill and a tag.
		expect(screen.getByText("2SP")).toBeInTheDocument()
		expect(screen.getByText("Hints")).toBeInTheDocument()
		expect(screen.getByText("Groundwork")).toBeInTheDocument()
		expect(screen.getByRole("tabpanel", { name: "Front" }).querySelector("mark")).toBeNull()
	})
})

describe("PvpGuidePage umas", () => {
	it("prints each uma's aptitude letters for the course, and drops a role that only restates them", async () => {
		const apt = { turf: 7, dirt: 1, short: 3, mile: 4, medium: 7, long: 6, front: 8, pace: 7, late: 2, end: 1 }
		respond(200, {
			...GUIDE,
			uma_recommendations: [
				{ style: "front", stars: 3, role: "Mile D", note: "", uma: { id: 41, name: "Maruzensky", image: null, apt } },
				{ style: "front", stars: 2, role: "Normal Front", note: "", uma: { id: 45, name: "Silence Suzuka", image: null, apt } },
			],
		})
		renderPage("/app/pvp?event=cm-10&style=front")
		await screen.findByText("Recommended stats")
		const pane = within(screen.getByRole("tabpanel", { name: "Front" }))
		// The event is a turf mile: the mile and the style, no turf (it is an A).
		expect(pane.getAllByTitle("Mile D, Front S")).toHaveLength(2)
		expect(pane.queryByText("Mile D")).not.toBeInTheDocument()
		expect(pane.getByText("Normal Front")).toBeInTheDocument()
	})

	it("keeps the roles as written when the guide's umas carry no aptitudes", async () => {
		respond(200, GUIDE)
		renderPage("/app/pvp?event=cm-10&style=front")
		await screen.findByText("Recommended stats")
		expect(within(screen.getByRole("tabpanel", { name: "Front" })).getByText("RA")).toBeInTheDocument()
	})

	it("groups a style's umas under their stars, most first, with no stars on the tiles", async () => {
		respond(200, {
			...GUIDE,
			uma_recommendations: [
				{ style: "front", stars: 2, role: "", note: "", uma: { id: 43, name: "Seiun Sky (Reeling)", image: null } },
				{ style: "front", stars: 3, role: "", note: "", uma: { id: 41, name: "Maruzensky", image: null } },
				{ style: "front", stars: 3, role: "", note: "", uma: { id: 44, name: "Mihono Bourbon", image: null } },
			],
		})
		renderPage()
		await screen.findByText("Recommended stats")
		const pane = within(screen.getByRole("tabpanel", { name: "Front" }))
		// One stars header per group, and none on a tile.
		expect(pane.getAllByLabelText("3 of 5 stars")).toHaveLength(1)
		expect(pane.getAllByLabelText("2 of 5 stars")).toHaveLength(1)
		// The outfit gets a line of its own under the name.
		expect(pane.getByText("Seiun Sky")).toBeInTheDocument()
		expect(pane.getByText("Reeling")).toBeInTheDocument()
	})
})

describe("PvpGuidePage recommended skills", () => {
	it("folds the general skills on a narrow screen, with their count", async () => {
		const original = window.matchMedia
		window.matchMedia = ((query: string) => ({ ...original(query), matches: query.includes("max-width") })) as typeof window.matchMedia
		try {
			respond(200, GUIDE)
			renderPage()
			await screen.findByText("Recommended stats")
			const details = screen.getByRole("region", { name: "General skills" }).querySelector("details")
			expect(details).not.toHaveAttribute("open")
			expect(within(details as HTMLElement).getByText(/^1 skill ·/)).toBeInTheDocument()
		} finally {
			window.matchMedia = original
		}
	})

	it("shows the general skills once, beside the style, and each position's tab only its own", async () => {
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
		// Players keep to one style: Next stays on it.
		expect(location()).toBe("/app/pvp?event=cm-11&style=end")
		await screen.findByText("Recommended stats")
		expect(styleTabs().getByRole("tab", { name: "End" })).toHaveAttribute("aria-selected", "true")
	})

	it("opens on the first style even when the guide ranks another first, and still shows the ranks", async () => {
		respond(200, { ...GUIDE, style_ranking: "End>>Front" })
		renderPage("/app/pvp?event=cm-10")
		await screen.findByText("Recommended stats")
		expect(styleTabs().getByRole("tab", { name: "Front" })).toHaveAttribute("aria-selected", "true")
		expect(styleTabs().getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["All", "Front#2", "End#1"])
	})

	it("opens on the first style when the guide ranks none it has", async () => {
		respond(200, { ...GUIDE, style_ranking: "" })
		renderPage("/app/pvp?event=cm-10")
		await screen.findByText("Recommended stats")
		expect(styleTabs().getByRole("tab", { name: "Front" })).toHaveAttribute("aria-selected", "true")
		expect(styleTabs().getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["All", "Front", "End"])
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

	it("goes where a link to an event says, on the last style shown, for any event", async () => {
		respond(200, GUIDE)
		const first = renderPage("/app/pvp?event=cm-10&style=end")
		await screen.findByText("Recommended stats")
		first.unmount()
		// A Timeline card's link to the same event: the event only.
		const second = renderPage("/app/pvp?event=cm-10")
		await screen.findByText("Recommended stats")
		expect(location()).toBe("/app/pvp?event=cm-10")
		expect(styleTabs().getByRole("tab", { name: "End" })).toHaveAttribute("aria-selected", "true")
		second.unmount()
		// Another event's link: still the reader's style.
		renderPage("/app/pvp?event=cm-11")
		await screen.findByText("Recommended stats")
		expect(styleTabs().getByRole("tab", { name: "End" })).toHaveAttribute("aria-selected", "true")
	})

	it("copies the guide's preview link with the style on screen, the gallery's address, and never My team", async () => {
		const writeText = vi.fn(() => Promise.resolve())
		Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
		respond(200, GUIDE)
		// No ?event=: the link still names it, since the default moves with the calendar.
		renderPage("/app/pvp")
		await screen.findByText("Recommended stats")
		fireEvent.click(styleTabs().getByRole("tab", { name: "End" }))
		const copy = () => fireEvent.click(screen.getByRole("button", { name: "Copy link" }))
		copy()
		await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(`${window.location.origin}/guide/cm-10?style=end`))

		const views = within(screen.getByRole("tablist", { name: "View" }))
		fireEvent.click(views.getByRole("tab", { name: /Gallery/ }))
		copy()
		await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(`${window.location.origin}/app/pvp?event=cm-10&view=gallery`))

		fireEvent.click(views.getByRole("tab", { name: /My team/ }))
		copy()
		await waitFor(() => expect(writeText).toHaveBeenLastCalledWith(`${window.location.origin}/guide/cm-10`))
	})
})

describe("PvpGuidePage comments", () => {
	const THREAD = {
		count: 1, page: 1, has_more: false,
		results: [{
			id: 5, state: "visible", body: "Why Seiun first?", created_at: "2026-10-11T00:00:00Z", edited: false,
			earlier_version: false, is_author: false, is_mine: false, score: 2, my_vote: null, replies: [],
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
		const toggle = await screen.findByRole("button", { name: "Comments on Front (1)" })
		expect(toggle).toHaveAttribute("aria-expanded", "false")
		expect(fetchMock.mock.calls.some(([url]) => String(url).includes("/comments"))).toBe(false)
		fireEvent.click(toggle)
		expect(await screen.findByText("Why Seiun first?")).toBeInTheDocument()
		const asked = fetchMock.mock.calls.map(([url]) => String(url)).find((url) => url.includes("/comments"))
		expect(asked).toContain(`/pvp-guides/cm/${NEXT.id}/comments?section=front`)
		// The score shows; a guest has nothing to press.
		expect(screen.getByLabelText("Score 2")).toBeInTheDocument()
	})

	it("keeps a thread for the whole guide in the side column", async () => {
		renderPage()
		expect(await screen.findByRole("button", { name: "Comments on the whole guide (3)" })).toBeInTheDocument()
	})

	it("shows each style's count on the All tab, and goes to that tab", async () => {
		renderPage()
		await screen.findByText("Recommended stats")
		fireEvent.click(within(screen.getAllByRole("tablist", { name: "Running style" })[0]).getByRole("tab", { name: "All" }))
		fireEvent.click(screen.getByRole("button", { name: "Open Front, 1 comment" }))
		expect(screen.getByTestId("location").textContent).toContain("style=front")
	})
})
