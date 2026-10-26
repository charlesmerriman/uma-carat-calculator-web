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
const uma = (id: number, name: string, gameId: number): CatalogueUma => ({
	id, name, game_id: gameId, image: null, portrait: null, rarity: 3, running_style: 2, character_id: id, is_variant: false, apt: APT, skills: [],
})
const UMAS = [uma(41, "Oguri Cap", 100601), uma(42, "Maruzensky", 100401)]
const SKILLS = [
	{ id: 9, name: "Corner Adept ○", rarity: 1, game_id: 200331 },
	{ id: 10, name: "Triumphant Pulse", rarity: 5, game_id: 100061 },
] as CatalogueSkill[]

const STATS = { speed: 1200, stamina: 800, power: 1000, guts: 400, wit: 900 }
const veteran = (id: number, extra: Partial<TrainedUma> = {}): TrainedUma => ({
	id, uma: 41, label: "", ...STATS, apt: APT, skills: [], rank_score: null, source: "manual", import_key: null,
	missing_from_import: false, memo: "", is_borrowed: false, trained_at: null, has_game_data: false, created_at: "2026-10-26T00:00:00Z", updated_at: "2026-10-26T00:00:00Z", ...extra,
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

/** Every request as the mock received it, bodies parsed (and unzipped). */
let sent: Array<{ method: string; path: string; body: unknown }> = []

/** A request body as JSON, unzipped first when it was sent gzipped (the import is). */
async function readBody(init: RequestInit | undefined): Promise<unknown> {
	if (!init?.body) return null
	const gzipped = (init.headers as Record<string, string> | undefined)?.["Content-Encoding"] === "gzip"
	if (!gzipped) return JSON.parse(String(init.body))
	const unpacked = new Response(init.body).body?.pipeThrough(new DecompressionStream("gzip"))
	return JSON.parse(await new Response(unpacked).text())
}

/** A sent body, typed loosely enough for the assertions below. */
type SentBody = Record<string, unknown> & { items: Array<Record<string, unknown> & { game_data: Record<string, unknown> }> }

/** The calls made with `method`: their path and parsed body. */
function calls(method: string) {
	return sent.filter((call) => call.method === method).map(({ path, body }) => ({ path, body: body as SentBody }))
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
	sent = []
	fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
		const method = init?.method ?? "GET"
		const path = new URL(String(url), "http://api").pathname
		const body = await readBody(init)
		sent.push({ method, path, body })
		if (method === "GET") return new Response(JSON.stringify(stored), { status: 200 })
		if (method === "DELETE") return new Response(null, { status: 204 })
		if (path.endsWith("/trained-umas/import")) {
			const { items } = body as { items: Array<Partial<TrainedUma>> }
			const veterans = items.map((item, index) => veteran(100 + index, { ...item, source: "import" }))
			return new Response(JSON.stringify({ created: items.length, updated: 0, removed: 0, kept: 0, veterans }), { status: 200 })
		}
		const fields = body as Partial<TrainedUma>
		const saved = method === "POST" ? veteran(99, fields) : { ...stored[0], ...fields }
		return new Response(JSON.stringify(saved), { status: method === "POST" ? 201 : 200 })
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
		expect(screen.getByRole("heading", { name: /Veterans/ })).toHaveTextContent("Veterans 2")
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

describe("importing from the game", () => {
	// Two veterans in umadump's shape: the newer Maruzensky, the older Oguri.
	const FILE = [
		{ viewer_id: 311943848596, memo: "Ace", trained_chara_id: 12, card_id: 100601, speed: 1200, stamina: 800, power: 1000,
			guts: 400, wiz: 900, rank_score: 15000, proper_ground_turf: 8, skill_array: [{ skill_id: 100061, level: 3 }],
			succession_chara_array: [{ card_id: 100101, owner_viewer_id: 206074645533 }],
			create_time: "2025-01-01 00:00:00" },
		{ viewer_id: 311943848596, memo: "", trained_chara_id: 13, card_id: 100401, speed: 1100, stamina: 700, power: 900,
			guts: 500, wiz: 800, rank_score: 14000, skill_array: [], create_time: "2026-01-01 00:00:00" },
	]

	it("previews the file, saves the ticked veterans, and shows them", async () => {
		show()
		fireEvent.click(await screen.findByRole("button", { name: /Import from the game/ }))
		const panel = within(screen.getByRole("region", { name: "Import from the game" }))
		const file = new File([JSON.stringify(FILE)], "trained_chara_data.json", { type: "application/json" })
		fireEvent.change(panel.getByLabelText(/Choose the file/), { target: { files: [file] } })

		const rows = await panel.findAllByRole("checkbox")
		expect(rows).toHaveLength(2)
		expect(panel.getByText("2 veterans in the file.")).toBeInTheDocument()
		// Newest first: Maruzensky, then Oguri. Untick Maruzensky.
		fireEvent.click(rows[0])
		fireEvent.click(panel.getByRole("button", { name: /Save 1/ }))

		await waitFor(() => expect(calls("POST")).toHaveLength(1))
		const sent = calls("POST")[0]
		expect(sent.path).toBe("/trained-umas/import")
		expect(sent.body.items).toHaveLength(1)
		expect(sent.body.items[0]).toMatchObject({ import_key: 12, uma: 41, wit: 900, skills: [{ skill: 10, level: 3 }] })
		// Everything about her, your own id and memo included; never another player's id.
		expect(sent.body.items[0].game_data).toMatchObject({ viewer_id: 311943848596, memo: "Ace" })
		expect(JSON.stringify(sent.body)).not.toContain("206074645533")

		await waitFor(() => expect(screen.queryByRole("region", { name: "Import from the game" })).not.toBeInTheDocument())
		expect(screen.getByText("From the game")).toBeInTheDocument()
	})

	it("says so when the file is not a veteran list", async () => {
		show()
		fireEvent.click(await screen.findByRole("button", { name: /Import from the game/ }))
		const panel = within(screen.getByRole("region", { name: "Import from the game" }))
		const file = new File([JSON.stringify([{ support_card_id: 30001 }])], "support_card_data.json")
		fireEvent.change(panel.getByLabelText(/Choose the file/), { target: { files: [file] } })
		expect(await panel.findByRole("alert")).toHaveTextContent("isn't a veteran list")
	})
})

