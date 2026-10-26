import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONSTANTS } from "../constants/gameConstants"
import { TestQueryProvider } from "../test/TestQueryProvider"
import type { RaceEvent } from "../types"
import type { CatalogueUma, PvpTeam } from "../types/pvpTeam"

/**
 * The CM Runs view: who may use it, picking a ticket's lineup, logging races,
 * the finals, and what a refused save looks like. The counting rules have
 * unit tests (pvpRuns.test.ts); the routes are the API's tests.
 *
 * The event starts in 2099, so the view opens on Day 1.
 */

const CM = {
	id: 10,
	name: "Aquarius Cup",
	event_type: "champions_meeting",
	cm_number: 10,
	start_date: "2099-03-06T00:00:00Z",
	end_date: "2099-03-12T00:00:00Z",
} as RaceEvent
const LOH = { ...CM, event_type: "league_of_heroes", loh_number: 1 } as unknown as RaceEvent

const uma = (id: number, name: string) => ({ id, name, portrait: null, image: null }) as unknown as CatalogueUma
const UMAS = [uma(41, "Oguri Cap"), uma(42, "Maruzensky"), uma(43, "Gold Ship")]

const TEAM: PvpTeam = {
	key: "t1",
	id: 1,
	kind: "cm",
	event: 10,
	name: "",
	notes: [],
	isFocus: false,
	updatedAt: 0,
	members: [
		{ position: 0, uma: 41, style: "pace", cards: [] },
		{ position: 1, uma: 42, style: "front", cards: [] },
		{ position: 2, uma: 43, style: "end", cards: [] },
	],
}

const session = vi.hoisted(() => ({ signedIn: true }))
const teams = vi.hoisted(() => ({ list: [] as PvpTeam[] }))
const toastError = vi.hoisted(() => vi.fn())

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: toastError }) }))
vi.mock("../services/CalculatorContext", () => ({
	useCalculatorData: () => ({ calculationConstants: DEFAULT_CONSTANTS }),
}))
vi.mock("../services/AuthContext", async () => ({
	...(await vi.importActual<typeof import("../services/AuthContext")>("../services/AuthContext")),
	useAccount: () => ({ isLoggedIn: session.signedIn, status: session.signedIn ? "ready" : "anonymous", account: null }),
}))
vi.mock("../services/PvpTeamsContext", () => ({
	usePvpTeams: () => ({ teams: teams.list, ensureLoaded: () => {} }),
}))
vi.mock("../hooks/usePvpCatalogue", () => ({
	usePvpCatalogue: () => ({ status: "ready", umasById: new Map(UMAS.map((entry) => [entry.id, entry])) }),
}))

const { RunsView } = await import("../components/pvp/RunsView")

const fetchMock = vi.fn()

/** Every PUT body sent so far, by path. */
function puts(): Array<{ path: string; body: Record<string, unknown> }> {
	return fetchMock.mock.calls
		.filter(([, init]) => (init as RequestInit | undefined)?.method === "PUT")
		.map(([url, init]) => ({
			path: new URL(String(url), "http://api").pathname,
			body: JSON.parse(String((init as RequestInit).body)) as Record<string, unknown>,
		}))
}

function show(event: RaceEvent = CM) {
	return render(
		<MemoryRouter>
			<TestQueryProvider>
				<RunsView event={event} onOpenMyTeam={() => {}} />
			</TestQueryProvider>
		</MemoryRouter>
	)
}

beforeEach(() => {
	session.signedIn = true
	teams.list = [TEAM]
	fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
		Promise.resolve(new Response(init?.method === "GET" || !init?.method ? "[]" : "{}", { status: 200 }))
	)
	vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
	vi.unstubAllGlobals()
	fetchMock.mockReset()
	toastError.mockReset()
})

describe("who can log runs", () => {
	it("asks a guest to sign in and fetches nothing", () => {
		session.signedIn = false
		show()
		expect(screen.getByText(/Sign in to log your tickets/)).toBeTruthy()
		expect(screen.getByRole("link", { name: "Sign in" })).toBeTruthy()
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it("says League of Heroes is not here yet", () => {
		show(LOH)
		expect(screen.getByText(/League of Heroes is coming later/)).toBeTruthy()
	})

	it("sends a player with no team to My team", async () => {
		teams.list = []
		show()
		expect((await screen.findAllByRole("button", { name: "My team" })).length).toBe(4)
	})
})

describe("logging a ticket", () => {
	it("copies a team in, then saves each race as it is picked", async () => {
		show()
		const ticket = await screen.findByRole("region", { name: "Ticket 1" })
		fireEvent.click(within(ticket).getByRole("button", { name: "Team 1" }))

		await waitFor(() => expect(puts()).toHaveLength(1))
		expect(puts()[0].path).toBe("/pvp-runs/cm/10/day/1/ticket/1")
		expect(puts()[0].body.runners).toEqual([
			{ position: 0, uma: 41, style: "pace" },
			{ position: 1, uma: 42, style: "front" },
			{ position: 2, uma: 43, style: "end" },
		])

		fireEvent.change(await within(ticket).findByLabelText("Ticket 1, race 1"), { target: { value: "0" } })
		fireEvent.change(within(ticket).getByLabelText("Ticket 1, race 2"), { target: { value: "loss" } })
		await waitFor(() => expect(puts()).toHaveLength(3))
		expect(puts()[2].body.races).toEqual([{ race: 1, winner: 0 }, { race: 2, winner: null }])

		expect(within(ticket).getByText("1 of 2 won (50%)")).toBeTruthy()
		const summary = screen.getByRole("region", { name: "Your win rates" })
		expect(within(summary).getByText("1 of 2 races")).toBeTruthy()
	})

	it("offers the last ticket's umas for the next one", async () => {
		show()
		const first = await screen.findByRole("region", { name: "Ticket 1" })
		fireEvent.click(within(first).getByRole("button", { name: "Team 1" }))
		const second = screen.getByRole("region", { name: "Ticket 2" })
		await waitFor(() => expect(within(second).getByRole("button", { name: "Same as last ticket" })).toBeTruthy())
		// The team is the same three, so it is not offered twice.
		expect(within(second).queryByRole("button", { name: "Team 1" })).toBeNull()
	})

	it("says when a save is refused", async () => {
		show()
		const ticket = await screen.findByRole("region", { name: "Ticket 1" })
		fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
			Promise.resolve(
				init?.method === "PUT"
					? new Response(JSON.stringify({ error: "A ticket is 5 races." }), { status: 400 })
					: new Response("[]", { status: 200 })
			)
		)
		fireEvent.click(within(ticket).getByRole("button", { name: "Team 1" }))
		await waitFor(() => expect(toastError).toHaveBeenCalledWith("A ticket is 5 races."))
		expect(await screen.findByText("Not saved")).toBeTruthy()
	})
})

describe("the finals", () => {
	it("records the group and fills 1st place when one of yours won", async () => {
		show()
		fireEvent.click(await screen.findByRole("tab", { name: /Finals/ }))
		const finals = screen.getByRole("region", { name: "Finals" })
		fireEvent.click(within(finals).getByRole("button", { name: "Team 1" }))
		fireEvent.change(await within(finals).findByLabelText("Finals race"), { target: { value: "1" } })
		fireEvent.change(within(finals).getByLabelText("Finals group"), { target: { value: "A" } })

		await waitFor(() => expect(puts()).toHaveLength(3))
		expect(puts()[2].path).toBe("/pvp-runs/cm/10/final")
		expect(puts()[2].body).toMatchObject({ races: [{ race: 1, winner: 1 }], placement: 1, finals_group: "A" })
	})
})
