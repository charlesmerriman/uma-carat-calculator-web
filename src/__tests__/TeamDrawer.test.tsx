/**
 * The team drawer and its navbar button. Which team it shows is unit-tested
 * in pvpTeams.test.ts (drawerTeam); here: the button's three states, the
 * drawer's team / empty state / pin, and Escape.
 */

import { fireEvent, render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TeamDrawerButton } from "../components/navbar/TeamDrawerButton"
import { TeamDrawerProvider } from "../services/TeamDrawerProvider"
import { PvpTeamsContext, type PvpTeamsContextType } from "../services/PvpTeamsContext"
import { AuthContext, type AuthContextType } from "../services/AuthContext"
import type { RaceEvent } from "../types"
import type { PvpTeam } from "../types/pvpTeam"

// Running from last year to next year, so "now" never matters.
const LIBRA = {
	id: 19, event_type: "champions_meeting", cm_number: 19, name: "Libra Cup", start_date: "2020-01-01T00:00:00Z",
	end_date: "2099-01-01T00:00:00Z", is_predicted: false, surface_type: "Turf", distance: "Mile", length: "",
} as unknown as RaceEvent

// Card 302's first banner lands in the middle of Libra Cup.
const SUPPORT_BANNERS = [{ banner_timeline: { start_date: "2050-01-01T12:00:00Z" }, support_cards: [{ id: 302 }] }]

vi.mock("../services/CalculatorContext", () => ({
	useCalculatorData: () => ({
		championsMeetingData: [LIBRA],
		leagueOfHeroesData: [],
		umaBannerData: [],
		supportBannerData: SUPPORT_BANNERS,
	}),
}))
vi.mock("../hooks/usePvpCatalogue", () => ({
	usePvpCatalogue: () => ({
		status: "ready",
		catalogue: { umas: [], support_cards: [], skills: [] },
		umasById: new Map([[41, { id: 41, name: "Maruzensky", image: null, portrait: null, character_id: 1004 }]]),
		cardsById: new Map(),
		skillsById: new Map(),
	}),
}))
vi.mock("../hooks/usePvpGuide", () => ({ usePvpGuide: () => ({ status: "none" }) }))
// The drawer as everyone will have it; the early-access gate has its own
// tests (usePvpAccess.test.tsx, PvpGuidePage.test.tsx).
vi.mock("../hooks/usePvpAccess", () => ({ usePvpAccess: () => "open" }))

const { TeamDrawer } = await import("../components/pvp/TeamDrawer")

const team = (key: string, extra: Partial<PvpTeam> = {}): PvpTeam => ({
	key, id: null, kind: "cm", event: 19, name: "", isFocus: false, notes: [], members: [], updatedAt: 0, ...extra,
})

function teamsValue(teams: PvpTeam[], extra: Partial<PvpTeamsContextType> = {}): PvpTeamsContextType {
	return {
		status: "ready", mode: "guest", teams, saveState: "idle",
		ensureLoaded: vi.fn(), createTeam: vi.fn(), editTeam: vi.fn(), renameTeam: vi.fn(), pinTeam: vi.fn(), deleteTeam: vi.fn(), setTeamPost: vi.fn(),
		...extra,
	}
}

function renderDrawer(value: PvpTeamsContextType, onClose = vi.fn()) {
	render(
		<MemoryRouter>
			<PvpTeamsContext.Provider value={value}>
				<TeamDrawer onClose={onClose} />
			</PvpTeamsContext.Provider>
		</MemoryRouter>
	)
	return onClose
}

beforeEach(() => localStorage.clear())
afterEach(() => localStorage.clear())

describe("TeamDrawerButton", () => {
	it("renders nothing outside /app", () => {
		const { container } = render(<TeamDrawerButton />)
		expect(container).toBeEmptyDOMElement()
	})

	it("toggles the drawer and remembers it", () => {
		render(
			<MemoryRouter initialEntries={["/app/timeline"]}>
				<TeamDrawerProvider>
					<TeamDrawerButton />
				</TeamDrawerProvider>
			</MemoryRouter>
		)
		const button = screen.getByRole("button", { name: "Show your PvP team" })
		expect(button).toHaveAttribute("aria-expanded", "false")
		fireEvent.click(button)
		expect(screen.getByRole("button", { name: "Hide your PvP team" })).toHaveAttribute("aria-expanded", "true")
		expect(localStorage.getItem("uma-planner-team-drawer")).toBe("open")
	})

	it("stands aside on the PvP page's My team view", () => {
		const { container } = render(
			<MemoryRouter initialEntries={["/app/pvp?event=cm-19&view=team"]}>
				<TeamDrawerProvider>
					<TeamDrawerButton />
				</TeamDrawerProvider>
			</MemoryRouter>
		)
		expect(container).toBeEmptyDOMElement()
	})
})

describe("TeamDrawer", () => {
	it("shows the team for the running event, editable, with a way to the PvP page", () => {
		const editTeam = vi.fn()
		const members = [{ position: 0, uma: 41, style: "front" as const, cards: [{ slot: 6, support_card: 302 }] }]
		renderDrawer(teamsValue([team("a", { name: "Main", members })], { editTeam }))
		expect(screen.getByRole("combobox", { name: "Which event and team to show" })).toHaveDisplayValue("Next event (auto): CM 19")
		// Three spots on top (one filled), then that uma's six card places.
		expect(screen.getAllByRole("button", { name: /^Add uma/ })).toHaveLength(2)
		expect(screen.getByRole("button", { name: "Add card 1 for Maruzensky" })).toBeInTheDocument()
		// An edit goes to the shown team.
		fireEvent.change(screen.getByRole("combobox", { name: "Running style for Maruzensky" }), { target: { value: "pace" } })
		expect(editTeam).toHaveBeenCalledWith("a", { members: [{ ...members[0], style: "pace" }] })
		expect(screen.getByRole("link", { name: /Go to PvP/ })).toHaveAttribute("href", "/app/pvp?event=cm-19")
		expect(within(screen.getByRole("banner")).getByRole("status")).toHaveTextContent("On this device")
	})

	it("offers to start a team when the event has none", () => {
		renderDrawer(teamsValue([]))
		expect(screen.getByText("No team for Libra Cup yet. Pick an uma to start one.")).toBeInTheDocument()
		expect(screen.getAllByRole("button", { name: /^Add uma/ })).toHaveLength(3)
	})

	it("pins a team from the select, and auto unpins", () => {
		const pinTeam = vi.fn()
		renderDrawer(teamsValue([team("a"), team("b", { name: "Alt" })], { pinTeam }))
		const select = screen.getByRole("combobox", { name: "Which event and team to show" })
		expect(select).toHaveValue("auto")
		fireEvent.change(select, { target: { value: "b" } })
		expect(pinTeam).toHaveBeenCalledWith("b")
		fireEvent.change(select, { target: { value: "auto" } })
		expect(pinTeam).toHaveBeenLastCalledWith(null)
	})

	it("closes on Escape from inside, and loads the teams when it opens", () => {
		const value = teamsValue([team("a")])
		const onClose = renderDrawer(value)
		expect(value.ensureLoaded).toHaveBeenCalled()
		expect(screen.getByRole("heading", { name: "Your PvP team" })).toHaveFocus()
		fireEvent.keyDown(screen.getByRole("heading", { name: "Your PvP team" }), { key: "Escape" })
		expect(onClose).toHaveBeenCalled()
	})

	it("flags a card on the team that comes out during the event", () => {
		const members = [{ position: 0, uma: 41, style: "front" as const, cards: [{ slot: 6, support_card: 302 }] }]
		renderDrawer(teamsValue([team("a", { members })]))
		expect(screen.getByText("During")).toBeInTheDocument()
		expect(screen.getByText("Out 2050/1/1, during this event")).toBeInTheDocument()
	})

	it("frames a favourite uma on the team", () => {
		const members = [{ position: 0, uma: 41, style: "front" as const, cards: [] }]
		const auth = { account: { oshis: [{ position: 0, id: 41, name: "Maruzensky", image: "" }], oshi_slots: 1 } } as unknown as AuthContextType
		render(
			<MemoryRouter>
				<AuthContext.Provider value={auth}>
					<PvpTeamsContext.Provider value={teamsValue([team("a", { members })])}>
						<TeamDrawer onClose={vi.fn()} />
					</PvpTeamsContext.Provider>
				</AuthContext.Provider>
			</MemoryRouter>
		)
		expect(screen.getByLabelText("Your favourite uma")).toBeInTheDocument()
		// The rainbow frame: FramedUma marks a favourite with data-oshi.
		expect(screen.getByRole("button", { name: "Change uma 1: Maruzensky" }).querySelector(".uma-frame[data-oshi]")).not.toBeNull()
	})

	it("leaves the frame off for a guest", () => {
		const members = [{ position: 0, uma: 41, style: "front" as const, cards: [] }]
		renderDrawer(teamsValue([team("a", { members })]))
		expect(screen.queryByLabelText("Your favourite uma")).not.toBeInTheDocument()
		// Still framed, in the silver frame every uma wears.
		const tile = screen.getByRole("button", { name: "Change uma 1: Maruzensky" })
		expect(tile.querySelector(".uma-frame")).not.toBeNull()
		expect(tile.querySelector(".uma-frame[data-oshi]")).toBeNull()
	})
})
