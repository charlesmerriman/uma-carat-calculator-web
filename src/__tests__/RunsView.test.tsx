import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONSTANTS } from "../constants/gameConstants"
import { TestQueryProvider } from "../test/TestQueryProvider"
import type { RaceEvent } from "../types"
import type { CatalogueUma, PvpTeam } from "../types/pvpTeam"

/**
 * The CM Runs view: who may use it, starting a ticket's lineup, logging races
 * with the race buttons, notes, skips, the finals, and what a refused save
 * looks like. The counting rules have
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
// The account's veterans, as GET /trained-umas answers.
const veterans = vi.hoisted(() => ({ list: [] as unknown[] }))
// The event's logged runs, as GET /pvp-runs answers.
const runs = vi.hoisted(() => ({ list: [] as unknown[] }))
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

/** Every DELETE sent so far, by path. */
function deletes(): string[] {
	return fetchMock.mock.calls
		.filter(([, init]) => (init as RequestInit | undefined)?.method === "DELETE")
		.map(([url]) => new URL(String(url), "http://api").pathname)
}

/** One logged day ticket, as GET /pvp-runs answers. */
const logged = (ticket: number, races: Array<{ race: number; winner: number | null }>, extra: Record<string, unknown> = {}) => ({
	kind: "cm", event: 10, stage: "day", day: 1, ticket, races,
	runners: TEAM.members.map(({ position, uma, style }) => ({ position, uma, style, trained_uma: null })),
	finals_group: "", placement: null, note: "", skipped: false, updated_at: "", ...extra,
})

/** Five races, all logged. */
const RACES_DONE = [1, 2, 3, 4, 5].map((race) => ({ race, winner: race % 2 ? 0 : null }))

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
	veterans.list = []
	runs.list = []
	fetchMock.mockImplementation((url: string, init?: RequestInit) => {
		if (init?.method && init.method !== "GET") return Promise.resolve(new Response("{}", { status: 200 }))
		const body = JSON.stringify(String(url).includes("/trained-umas") ? veterans.list : String(url).includes("/pvp-runs") ? runs.list : [])
		return Promise.resolve(new Response(body, { status: 200 }))
	})
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
		expect(await screen.findByText("Who's running this CM?")).toBeTruthy()
		expect(screen.getAllByRole("button", { name: "Open My team" })).toHaveLength(1)
		expect(screen.queryByRole("region", { name: "Ticket 1" })).toBeNull()
	})
})

describe("logging a ticket", () => {
	it("copies a team in, then saves each race as it is tapped", async () => {
		show()
		const ticket = await screen.findByRole("region", { name: "Ticket 1" })
		fireEvent.click(within(ticket).getByRole("button", { name: "Use Team 1" }))

		await waitFor(() => expect(puts()).toHaveLength(1))
		expect(puts()[0].path).toBe("/pvp-runs/cm/10/day/1/ticket/1")
		expect(puts()[0].body.runners).toEqual([
			{ position: 0, uma: 41, style: "pace", trained_uma: null },
			{ position: 1, uma: 42, style: "front", trained_uma: null },
			{ position: 2, uma: 43, style: "end", trained_uma: null },
		])

		// The ticket just started is the open one: one button per uma and Loss, per race.
		fireEvent.click(await within(ticket).findByRole("button", { name: "Ticket 1, race 1: Oguri Cap won" }))
		fireEvent.click(within(ticket).getByRole("button", { name: "Ticket 1, race 2: Loss" }))
		await waitFor(() => expect(puts()).toHaveLength(3))
		expect(puts()[2].body.races).toEqual([{ race: 1, winner: 0 }, { race: 2, winner: null }])
		expect(within(ticket).getByRole("button", { name: "Ticket 1, race 1: Oguri Cap won" })).toHaveAttribute("aria-pressed", "true")

		const summary = screen.getByRole("complementary", { name: "Your win rates" })
		expect(within(summary).getByText("1 of 2 races")).toBeTruthy()
		expect(within(summary).getByText("1 ticket used")).toBeTruthy()
	})

	it("clears a race with a second tap", async () => {
		runs.list = [logged(1, [{ race: 1, winner: 0 }, { race: 2, winner: 1 }])]
		show()
		const ticket = await screen.findByRole("region", { name: "Ticket 1" })
		fireEvent.click(within(ticket).getByRole("button", { name: "Ticket 1, race 2: Maruzensky won" }))
		await waitFor(() => expect(puts()).toHaveLength(1))
		expect(puts()[0].body.races).toEqual([{ race: 1, winner: 0 }])
	})

	it("offers the last ticket's umas for the next one, named by where they came from", async () => {
		show()
		const first = await screen.findByRole("region", { name: "Ticket 1" })
		fireEvent.click(within(first).getByRole("button", { name: "Use Team 1" }))
		const second = screen.getByRole("region", { name: "Ticket 2" })
		await waitFor(() => expect(within(second).getByRole("button", { name: "Same three as Ticket 1" })).toBeTruthy())
		// The team is the same three, so the list doesn't offer it twice.
		fireEvent.click(within(second).getByRole("button", { name: "Pick a team" }))
		// The one-tap button and the list's card.
		expect(within(second).getAllByRole("button", { name: /^Same three as Ticket 1/ })).toHaveLength(2)
		expect(within(second).queryByRole("button", { name: /^Team 1/ })).toBeNull()
	})

	it("opens the ticket in progress and folds the rest", async () => {
		runs.list = [logged(1, RACES_DONE), logged(2, [{ race: 1, winner: 2 }])]
		show()
		const done = await screen.findByRole("region", { name: "Ticket 1" })
		expect(within(done).getByRole("button", { name: /^Ticket 1, All 5 raced/ })).toHaveAttribute("aria-expanded", "false")
		const current = screen.getByRole("region", { name: "Ticket 2" })
		expect(within(current).getByRole("button", { name: /^Ticket 2, 4 to go/ })).toHaveAttribute("aria-expanded", "true")
		expect(within(current).getByRole("button", { name: "Ticket 2, race 1: Gold Ship won" })).toBeTruthy()
		expect(within(done).queryByRole("button", { name: /race 1:/ })).toBeNull()
	})

	it("saves a note when the field is left", async () => {
		runs.list = [logged(1, [{ race: 1, winner: 0 }])]
		show()
		const ticket = await screen.findByRole("region", { name: "Ticket 1" })
		const note = within(ticket).getByRole("textbox", { name: "Note for Ticket 1" })
		fireEvent.change(note, { target: { value: "  Rainy, Oguri blocked " } })
		fireEvent.blur(note)
		await waitFor(() => expect(puts()).toHaveLength(1))
		expect(puts()[0].body).toMatchObject({ note: "Rainy, Oguri blocked" })
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
		fireEvent.click(within(ticket).getByRole("button", { name: "Use Team 1" }))
		await waitFor(() => expect(toastError).toHaveBeenCalledWith("A ticket is 5 races."))
		expect(await screen.findByText("Not saved")).toBeTruthy()
	})
})

describe("skipping", () => {
	it("skips an unplayed ticket and takes it back", async () => {
		show()
		const ticket = await screen.findByRole("region", { name: "Ticket 1" })
		fireEvent.click(within(ticket).getByRole("button", { name: "Skip" }))
		await waitFor(() => expect(puts()).toHaveLength(1))
		expect(puts()[0].body).toMatchObject({ runners: [], races: [], skipped: true })

		const skipped = screen.getByRole("region", { name: "Ticket 1" })
		expect(within(skipped).getByText("Skipped")).toBeTruthy()
		// Nothing else was logged there, so taking it back clears the slot.
		fireEvent.click(within(skipped).getByRole("button", { name: "Undo" }))
		await waitFor(() => expect(deletes()).toEqual(["/pvp-runs/cm/10/day/1/ticket/1"]))
		expect(within(screen.getByRole("region", { name: "Ticket 1" })).getByRole("button", { name: "Use Team 1" })).toBeTruthy()
	})

	it("stops a ticket early, and logging another race reopens it", async () => {
		runs.list = [logged(1, [{ race: 1, winner: 0 }, { race: 2, winner: null }])]
		show()
		const ticket = await screen.findByRole("region", { name: "Ticket 1" })
		fireEvent.click(within(ticket).getByRole("button", { name: "Skip the rest" }))
		await waitFor(() => expect(puts()).toHaveLength(1))
		expect(puts()[0].body).toMatchObject({ skipped: true })
		// Still open after the write: the stop doesn't fold the ticket away.
		expect(within(ticket).getByText("Stopped after 2 races")).toBeTruthy()
		// Races 3 to 5 read as skipped, not as still to run.
		expect(within(ticket).getAllByText("Skipped")).toHaveLength(3)

		// Slow typing, not a stop: race 3 ran after all.
		fireEvent.click(within(ticket).getByRole("button", { name: "Ticket 1, race 3: Maruzensky won" }))
		await waitFor(() => expect(puts()).toHaveLength(2))
		expect(puts()[1].body).toMatchObject({ skipped: false })
		expect(within(ticket).queryByText(/Stopped after/)).toBeNull()
		expect(within(ticket).queryByText("Skipped")).toBeNull()
	})

	it("offers a day that is over to mark its unlogged tickets skipped", async () => {
		// Started 30 hours ago: today is Day 2, so Day 1 is over.
		const started = { ...CM, start_date: new Date(Date.now() - 30 * 3_600_000).toISOString() } as RaceEvent
		runs.list = [logged(1, [{ race: 1, winner: 0 }])]
		show(started)
		fireEvent.click(await screen.findByRole("tab", { name: /Day 1/ }))
		expect(screen.getByText("Day 1 is over. Nothing is logged for Tickets 2, 3 and 4.")).toBeTruthy()
		fireEvent.click(screen.getByRole("button", { name: "Mark the rest skipped" }))

		await waitFor(() => expect(puts()).toHaveLength(3))
		expect(puts().map(({ path }) => path)).toEqual([2, 3, 4].map((ticket) => `/pvp-runs/cm/10/day/1/ticket/${ticket}`))
		expect(puts().every(({ body }) => body.skipped === true)).toBe(true)
		expect(screen.queryByRole("button", { name: "Mark the rest skipped" })).toBeNull()
		const summary = screen.getByRole("complementary", { name: "Your win rates" })
		expect(within(summary).getByText("1 ticket used, 3 skipped")).toBeTruthy()
	})

	it("never offers it on the day that is on now", async () => {
		show()
		await screen.findByRole("region", { name: "Ticket 1" })
		expect(screen.queryByRole("button", { name: "Mark the rest skipped" })).toBeNull()
	})
})

describe("the finals", () => {
	it("records the group and fills 1st place when one of yours won", async () => {
		show()
		fireEvent.click(await screen.findByRole("tab", { name: /Finals/ }))
		const finals = screen.getByRole("region", { name: "Finals" })
		fireEvent.click(within(finals).getByRole("button", { name: "Use Team 1" }))
		fireEvent.click(await within(finals).findByRole("button", { name: "The Finals race: Maruzensky won" }))
		fireEvent.click(within(finals).getByRole("radio", { name: "Group A" }))

		await waitFor(() => expect(puts()).toHaveLength(3))
		expect(puts()[2].path).toBe("/pvp-runs/cm/10/final")
		expect(puts()[2].body).toMatchObject({ races: [{ race: 1, winner: 1 }], placement: 1, finals_group: "A" })
		expect(within(finals).getByRole("radio", { name: "1st" })).toHaveAttribute("aria-checked", "true")
	})

	it("starts the Finals from the event's last ticket", async () => {
		runs.list = [logged(3, [{ race: 1, winner: 0 }], { day: 4 })]
		show()
		fireEvent.click(await screen.findByRole("tab", { name: /Finals/ }))
		const finals = screen.getByRole("region", { name: "Finals" })
		expect(within(finals).getByRole("button", { name: "Same three as Day 4, Ticket 3" })).toBeTruthy()
	})
})

describe("veterans", () => {
	const VETERAN = {
		id: 5, uma: 41, label: "Main Oguri", speed: 1200, stamina: 800, power: 1000, guts: 400, wit: 900,
		apt: {}, skills: [], rank_score: null, source: "manual", import_key: null, missing_from_import: false,
		created_at: "", updated_at: "",
	}

	it("brings the team's veteran onto a copied ticket, and can unlink her", async () => {
		veterans.list = [VETERAN]
		teams.list = [{ ...TEAM, members: TEAM.members.map((member) => (member.position === 0 ? { ...member, trained_uma: 5 } : member)) }]
		show()
		const ticket = await screen.findByRole("region", { name: "Ticket 1" })
		fireEvent.click(within(ticket).getByRole("button", { name: "Use Team 1" }))
		await waitFor(() => expect(puts()).toHaveLength(1))
		expect((puts()[0].body.runners as Array<{ trained_uma: number | null }>).map((runner) => runner.trained_uma)).toEqual([5, null, null])

		// Only Oguri has a veteran, so only her runner gets the pick; it names hers.
		const pick = await within(ticket).findByRole("button", { name: "Veteran for Oguri Cap: Main Oguri" })
		expect(within(ticket).queryByRole("button", { name: /Veteran for Maruzensky/ })).toBeNull()
		fireEvent.click(pick)
		const picker = within(screen.getByRole("dialog", { name: "Which Oguri Cap is she?" }))
		expect(picker.getByRole("button", { name: /Main Oguri/ })).toHaveAttribute("aria-pressed", "true")
		fireEvent.click(picker.getByRole("button", { name: "No veteran" }))
		await waitFor(() => expect(puts()).toHaveLength(2))
		expect((puts()[1].body.runners as Array<{ trained_uma: number | null }>)[0].trained_uma).toBeNull()
		expect(screen.queryByRole("dialog")).toBeNull()
	})

	it("splits the win rates by veteran, each linked to the Collection", async () => {
		// The second has no label: she is named by the game's grade and score.
		veterans.list = [VETERAN, { ...VETERAN, id: 6, label: "", rank_score: 15120, rank_grade: 15 }]
		const lineup = (veteran: number) => [{ position: 0, uma: 41, style: "pace", trained_uma: veteran }]
		runs.list = [
			{ kind: "cm", event: 10, stage: "day", day: 1, ticket: 1, runners: lineup(5), races: [{ race: 1, winner: 0 }],
				finals_group: "", placement: null, note: "", updated_at: "" },
			{ kind: "cm", event: 10, stage: "day", day: 1, ticket: 2, runners: lineup(6), races: [{ race: 1, winner: null }],
				finals_group: "", placement: null, note: "", updated_at: "" },
		]
		show()
		const summary = await screen.findByRole("complementary", { name: "Your win rates" })
		const first = within(summary).getByRole("link", { name: "Main Oguri" })
		expect(first).toHaveAttribute("href", "/app/collection?veteran=5")
		expect(within(summary).getByRole("link", { name: "S 15,120" })).toHaveAttribute("href", "/app/collection?veteran=6")
		expect(within(summary).getByText("1 of 1 won")).toBeInTheDocument()
		expect(within(summary).getByText("0 of 1 won")).toBeInTheDocument()
	})
})
