import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TestQueryProvider } from "../test/TestQueryProvider"
import type { CatalogueSkill, CatalogueUma } from "../types/pvpTeam"
import type { TrainedUma } from "../types/trainedUma"

/**
 * The Collection page's Veterans: who sees what, adding one by hand through
 * the uma picker, the checks before Save, a game veteran's label-only edit,
 * and delete. The form's rules have unit tests (trainedUmas.test.ts); the
 * routes are the API's tests.
 */

const APT = { turf: 8, dirt: 1, short: 3, mile: 7, medium: 7, long: 6, front: 2, pace: 7, late: 7, end: 4 }
const uma = (id: number, name: string): CatalogueUma => ({
	id, name, image: null, portrait: null, rarity: 3, running_style: 2, character_id: id, is_variant: false, apt: APT, skills: [],
})
const UMAS = [uma(41, "Oguri Cap"), uma(42, "Maruzensky")]
const SKILLS = [
	{ id: 9, name: "Corner Adept ○", rarity: 1 },
	{ id: 10, name: "Triumphant Pulse", rarity: 5 },
] as CatalogueSkill[]

const STATS = { speed: 1200, stamina: 800, power: 1000, guts: 400, wit: 900 }
const veteran = (id: number, extra: Partial<TrainedUma> = {}): TrainedUma => ({
	id, uma: 41, label: "", ...STATS, apt: APT, skills: [], rank_score: null, source: "manual", import_key: null,
	missing_from_import: false, created_at: "2026-10-26T00:00:00Z", updated_at: "2026-10-26T00:00:00Z", ...extra,
})

const session = vi.hoisted(() => ({ signedIn: true }))
vi.mock("../services/AuthContext", async () => ({
	...(await vi.importActual<typeof import("../services/AuthContext")>("../services/AuthContext")),
	useAccount: () => ({ isLoggedIn: session.signedIn, status: session.signedIn ? "ready" : "anonymous", account: null }),
}))
vi.mock("../hooks/usePvpCatalogue", () => ({
	usePvpCatalogue: () => ({
		status: "ready",
		catalogue: { umas: UMAS, support_cards: [], skills: SKILLS },
		umasById: new Map(UMAS.map((each) => [each.id, each])),
		cardsById: new Map(),
		skillsById: new Map(SKILLS.map((each) => [each.id, each])),
	}),
}))

const { CollectionPage } = await import("../components/collection/CollectionPage")

const fetchMock = vi.fn()
let stored: TrainedUma[] = []

/** The calls made with `method`, their path and parsed body. */
function calls(method: string) {
	return fetchMock.mock.calls
		.filter(([, init]) => ((init as RequestInit | undefined)?.method ?? "GET") === method)
		.map(([url, init]) => ({
			path: new URL(String(url), "http://api").pathname,
			body: (init as RequestInit).body ? JSON.parse(String((init as RequestInit).body)) : null,
		}))
}

function show() {
	return render(
		<MemoryRouter>
			<TestQueryProvider>
				<CollectionPage />
			</TestQueryProvider>
		</MemoryRouter>
	)
}

beforeEach(() => {
	session.signedIn = true
	stored = []
	fetchMock.mockImplementation((url: string, init?: RequestInit) => {
		const method = init?.method ?? "GET"
		if (method === "GET") return Promise.resolve(new Response(JSON.stringify(stored), { status: 200 }))
		if (method === "DELETE") return Promise.resolve(new Response(null, { status: 204 }))
		const body = JSON.parse(String(init?.body)) as Partial<TrainedUma>
		const saved = method === "POST" ? veteran(99, body) : { ...stored[0], ...body }
		return Promise.resolve(new Response(JSON.stringify(saved), { status: method === "POST" ? 201 : 200 }))
	})
	vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
	vi.unstubAllGlobals()
	fetchMock.mockReset()
})

describe("who sees what", () => {
	it("asks a guest to sign in and fetches nothing", () => {
		session.signedIn = false
		show()
		expect(screen.getByText("Sign in to keep your veterans on your account.")).toBeInTheDocument()
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it("lists each veteran with her stats, where she came from, and a kept one's flag", async () => {
		stored = [veteran(1, { label: "Main Oguri", source: "import", import_key: 12, missing_from_import: true }), veteran(2, { uma: 42 })]
		show()
		const rows = await screen.findAllByRole("listitem")
		expect(within(rows[0]).getByText("Main Oguri")).toBeInTheDocument()
		expect(within(rows[0]).getByText("From the game")).toBeInTheDocument()
		expect(within(rows[0]).getByText("Not in your latest import")).toBeInTheDocument()
		expect(within(rows[0]).getByText("Spd 1200 · Sta 800 · Pow 1000 · Gut 400 · Wit 900")).toBeInTheDocument()
		expect(within(rows[1]).getByText("Maruzensky")).toBeInTheDocument()
		expect(within(rows[1]).getByText("By hand")).toBeInTheDocument()
		expect(screen.getByText("2 of 200")).toBeInTheDocument()
	})
})

describe("adding by hand", () => {
	it("picks the uma, fills her aptitudes, takes stats and skills, and saves", async () => {
		show()
		fireEvent.click(await screen.findByRole("button", { name: /Add a veteran/ }))
		const form = within(screen.getByRole("region", { name: "Add a veteran" }))
		fireEvent.click(form.getByRole("button", { name: "Pick the uma" }))
		fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Oguri Cap/ }))
		// Her own letters, ready to change.
		expect(form.getByLabelText("Turf")).toHaveValue("8")

		for (const [label, value] of Object.entries({ Speed: "1150", Stamina: "700", Power: "950", Guts: "420", Wit: "880" })) {
			fireEvent.change(form.getByLabelText(label), { target: { value } })
		}
		fireEvent.change(form.getByLabelText("Mile"), { target: { value: "8" } })
		fireEvent.change(form.getByPlaceholderText("Search a skill to add it"), { target: { value: "pulse" } })
		fireEvent.click(form.getByRole("button", { name: "+ Triumphant Pulse" }))
		fireEvent.change(form.getByLabelText("Triumphant Pulse level"), { target: { value: "4" } })
		fireEvent.click(form.getByRole("button", { name: "Save" }))

		await waitFor(() => expect(calls("POST")).toHaveLength(1))
		expect(calls("POST")[0]).toEqual({
			path: "/trained-umas",
			body: {
				uma: 41, label: "", speed: 1150, stamina: 700, power: 950, guts: 420, wit: 880,
				apt: { ...APT, mile: 8 }, skills: [{ skill: 10, level: 4 }],
			},
		})
		// The form closes and she is on the list.
		await waitFor(() => expect(screen.queryByRole("region", { name: "Add a veteran" })).not.toBeInTheDocument())
		expect(screen.getByText("Oguri Cap")).toBeInTheDocument()
	})

	it("says what is missing and sends nothing", async () => {
		show()
		fireEvent.click(await screen.findByRole("button", { name: /Add a veteran/ }))
		fireEvent.click(screen.getByRole("button", { name: "Save" }))
		expect(screen.getByText("Pick the uma first.")).toBeInTheDocument()
		expect(screen.getAllByText("Required.")).toHaveLength(5)
		expect(calls("POST")).toHaveLength(0)
	})
})

describe("editing and deleting", () => {
	it("lets a game veteran change its label only", async () => {
		stored = [veteran(1, { source: "import", import_key: 12 })]
		show()
		fireEvent.click(await screen.findByRole("button", { name: "Edit Oguri Cap" }))
		const form = within(screen.getByRole("region", { name: "Edit Oguri Cap" }))
		expect(form.getByLabelText("Speed")).toBeDisabled()
		fireEvent.change(form.getByLabelText("Label (optional)"), { target: { value: "Ace" } })
		fireEvent.click(form.getByRole("button", { name: "Save" }))
		await waitFor(() => expect(calls("PATCH")).toHaveLength(1))
		expect(calls("PATCH")[0]).toEqual({ path: "/trained-umas/1", body: { label: "Ace" } })
	})

	it("asks once, then deletes", async () => {
		stored = [veteran(1)]
		show()
		fireEvent.click(await screen.findByRole("button", { name: "Delete Oguri Cap" }))
		fireEvent.click(screen.getByRole("button", { name: "Delete her?" }))
		await waitFor(() => expect(calls("DELETE")).toEqual([{ path: "/trained-umas/1", body: null }]))
		await waitFor(() => expect(screen.queryByRole("listitem")).not.toBeInTheDocument())
	})
})
