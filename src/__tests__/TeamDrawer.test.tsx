/**
 * The team drawer and its navbar button. Which team it shows is unit-tested
 * in pvpTeams.test.ts (drawerTeam); here: the button's three states, the
 * drawer's team / empty state / pin, and Escape.
 */

import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TeamDrawerButton } from "../components/navbar/TeamDrawerButton"
import { TeamDrawerProvider } from "../services/TeamDrawerProvider"
import { PvpTeamsContext, type PvpTeamsContextType } from "../services/PvpTeamsContext"
import type { RaceEvent } from "../types"
import type { PvpTeam } from "../types/pvpTeam"

// Running from last year to next year, so "now" never matters.
const LIBRA = {
	id: 19, event_type: "champions_meeting", name: "Libra Cup", start_date: "2020-01-01T00:00:00Z",
	end_date: "2099-01-01T00:00:00Z", is_predicted: false, surface_type: "Turf", distance: "Mile", length: "",
} as unknown as RaceEvent

vi.mock("../services/CalculatorContext", () => ({
	useCalculatorData: () => ({ championsMeetingData: [LIBRA], leagueOfHeroesData: [] }),
}))
vi.mock("../hooks/usePvpCatalogue", () => ({
	usePvpCatalogue: () => ({
		status: "ready",
		catalogue: { umas: [], support_cards: [], skills: [] },
		umasById: new Map(),
		cardsById: new Map(),
		skillsById: new Map(),
	}),
}))
vi.mock("../hooks/usePvpGuide", () => ({ usePvpGuide: () => ({ status: "none" }) }))

const { TeamDrawer } = await import("../components/pvp/TeamDrawer")

const team = (key: string, extra: Partial<PvpTeam> = {}): PvpTeam => ({
	key, id: null, kind: "cm", event: 19, name: "", isFocus: false, notes: [], members: [], updatedAt: 0, ...extra,
})

function teamsValue(teams: PvpTeam[], extra: Partial<PvpTeamsContextType> = {}): PvpTeamsContextType {
	return {
		status: "ready", mode: "guest", teams, saveState: "idle",
		ensureLoaded: vi.fn(), createTeam: vi.fn(), editTeam: vi.fn(), renameTeam: vi.fn(), pinTeam: vi.fn(), deleteTeam: vi.fn(),
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
	it("shows the team for the running event, with a way to the builder", () => {
		renderDrawer(teamsValue([team("a", { name: "Main" })]))
		expect(screen.getByText("Libra Cup")).toBeInTheDocument()
		expect(screen.getByLabelText("Your team")).toBeInTheDocument()
		expect(screen.getByRole("link", { name: /Open in PvP/ })).toHaveAttribute("href", "/app/pvp?event=cm-19&view=team")
		expect(screen.getByText("Saved on this device.")).toBeInTheDocument()
	})

	it("offers to build one when the event has no team", () => {
		renderDrawer(teamsValue([]))
		expect(screen.getByText("No team for Libra Cup yet.")).toBeInTheDocument()
		expect(screen.getByRole("link", { name: "Build one" })).toHaveAttribute("href", "/app/pvp?event=cm-19&view=team")
	})

	it("pins a team from the select, and auto unpins", () => {
		const pinTeam = vi.fn()
		renderDrawer(teamsValue([team("a"), team("b", { name: "Alt" })], { pinTeam }))
		const select = screen.getByRole("combobox", { name: "Show in this panel" })
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
})
