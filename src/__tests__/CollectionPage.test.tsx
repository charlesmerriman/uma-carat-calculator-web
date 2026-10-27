import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TestQueryProvider } from "../test/TestQueryProvider"
import type { CatalogueSkill, CatalogueSupportCard, CatalogueUma } from "../types/pvpTeam"
import type { Roster } from "../types/roster"
import type { TrainedUma, VeteranDetail } from "../types/trainedUma"

/**
 * The Collection page's Veterans: who sees what, the tiles and her card (her
 * sparks, lineage, deck and career, read from her game data), adding one by
 * hand through the uma picker, the checks before Save, a game veteran's
 * label-only edit, and delete. The form's rules and the game data's reading
 * have unit tests (trainedUmas.test.ts, veteranGameData.test.ts); the routes
 * are the API's tests.
 */

const APT = { turf: 8, dirt: 1, short: 3, mile: 7, medium: 7, long: 6, front: 2, pace: 7, late: 7, end: 4 }
const uma = (id: number, name: string, gameId: number): CatalogueUma => ({
	id, name, game_id: gameId, image: null, portrait: null, rarity: 3, running_style: 2, character_id: id, is_variant: false, apt: APT, skills: [],
})
const UMAS = [uma(41, "Oguri Cap", 100601), uma(42, "Maruzensky", 100401), { ...uma(43, "JP Only", 199901), on_global: false }]
const CARDS = [
	{ id: 9, name: "Kitasan Black", game_id: 30028, image: null, card_type: "speed", rarity: 3, title: "", skills: [], on_global: true },
	{ id: 10, name: "Agnes Tachyon", game_id: 30034, image: null, card_type: "wit", rarity: 3, title: "", skills: [], on_global: true },
] as CatalogueSupportCard[]
const SKILLS = [
	{ id: 9, name: "Corner Adept ○", rarity: 1, game_id: 200331 },
	{ id: 10, name: "Triumphant Pulse", rarity: 5, game_id: 100061 },
] as CatalogueSkill[]

const STATS = { speed: 1200, stamina: 800, power: 1000, guts: 400, wit: 900 }
const veteran = (id: number, extra: Partial<TrainedUma> = {}): TrainedUma => ({
	id, uma: 41, label: "", ...STATS, apt: APT, skills: [], rank_score: null, rank_grade: null, source: "manual", import_key: null,
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
		catalogue: { umas: UMAS, support_cards: CARDS, skills: SKILLS },
		umasById: new Map(UMAS.map((each) => [each.id, each])),
		cardsById: new Map(CARDS.map((each) => [each.id, each])),
		skillsById: new Map(SKILLS.map((each) => [each.id, each])),
	}),
}))

// Release dates come from the banners: Maruzensky's is newer than Oguri's.
vi.mock("../services/CalculatorContext", () => ({
	useCalculatorData: () => ({
		umaBannerData: [
			{ banner_timeline: { start_date: "2025-07-01T00:00:00Z" }, umas: [{ id: 41 }] },
			{ banner_timeline: { start_date: "2026-01-01T00:00:00Z" }, umas: [{ id: 42 }] },
		],
		supportBannerData: [],
	}),
}))

const { CollectionPage } = await import("../components/collection/CollectionPage")

const fetchMock = vi.fn()
let stored: TrainedUma[] = []
/** What GET /trained-umas/<id> adds to a stored veteran: her raw game data and spark names. */
let details: Record<number, Partial<Pick<VeteranDetail, "game_data" | "sparks">>> = {}
let roster: Roster = { umas: [], support_cards: [] }

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

function show(path = "/app/collection") {
	return render(
		<MemoryRouter initialEntries={[path]}>
			<TestQueryProvider>
				<CollectionPage />
			</TestQueryProvider>
		</MemoryRouter>
	)
}

beforeEach(() => {
	session.signedIn = true
	stored = []
	details = {}
	roster = { umas: [], support_cards: [] }
	sent = []
	fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
		const method = init?.method ?? "GET"
		const path = new URL(String(url), "http://api").pathname
		const body = await readBody(init)
		sent.push({ method, path, body })
		if (path === "/roster" && method === "GET") return new Response(JSON.stringify(roster), { status: 200 })
		if (path === "/roster" && method === "PATCH") return new Response(JSON.stringify(roster), { status: 200 })
		if (path.startsWith("/roster/") && method === "DELETE") {
			roster = path.endsWith("/umas") ? { ...roster, umas: [] } : { ...roster, support_cards: [] }
			return new Response(JSON.stringify(roster), { status: 200 })
		}
		if (path === "/roster/import") {
			const counts = { added: 1, updated: 0, removed: 0 }
			return new Response(JSON.stringify({ umas: counts, support_cards: counts, roster }), { status: 200 })
		}
		const one = /^\/trained-umas\/(\d+)$/.exec(path)
		if (one && method === "GET") {
			const id = Number(one[1])
			const found = stored.find((each) => each.id === id)
			return new Response(JSON.stringify({ ...found, game_data: null, sparks: {}, ...details[id] }), { status: found ? 200 : 404 })
		}
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

	it("shows each veteran as a tile with her stats and a kept one's flag, and the first one's card", async () => {
		stored = [veteran(1, { label: "Main Oguri", source: "import", import_key: 12, missing_from_import: true }), veteran(2, { uma: 42 })]
		show()
		const list = within(await screen.findByRole("region", { name: "Your veterans" }))
		const [first, second] = list.getAllByRole("button", { pressed: undefined }).filter((tile) => tile.id.startsWith("veteran-"))
		expect(within(first).getByText("Main Oguri")).toBeInTheDocument()
		expect(within(first).getByText("Oguri Cap")).toBeInTheDocument()
		expect(within(first).getByText("Not in your latest import")).toBeInTheDocument()
		expect(within(first).getByText("1200 / 800 / 1000 / 400 / 900")).toBeInTheDocument()
		expect(within(second).getByText("Maruzensky")).toBeInTheDocument()
		expect(within(second).getByText("By hand")).toBeInTheDocument()
		expect(screen.getByRole("tab", { name: /Veterans/ })).toHaveTextContent("2")
		// Wide screens open the first one without a link.
		const card = within(screen.getByRole("article"))
		expect(card.getByRole("heading", { name: "Oguri Cap" })).toBeInTheDocument()
		expect(card.getByText("From the game")).toBeInTheDocument()
		expect(card.getByText("Main Oguri")).toBeInTheDocument()
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
				apt: { ...APT, mile: 8 }, skills: [{ skill: 10, level: 4 }], rank_score: null,
			},
		})
		// The form closes and she is on the list, her card open.
		await waitFor(() => expect(screen.queryByRole("region", { name: "Add a veteran" })).not.toBeInTheDocument())
		expect(screen.getByRole("heading", { name: "Oguri Cap" })).toBeInTheDocument()
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
		fireEvent.click(await screen.findByRole("button", { name: "Edit label" }))
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
		fireEvent.click(await screen.findByRole("button", { name: "Delete" }))
		fireEvent.click(screen.getByRole("button", { name: "Delete her?" }))
		await waitFor(() => expect(calls("DELETE")).toEqual([{ path: "/trained-umas/1", body: null }]))
		expect(await screen.findByText(/No veterans yet/)).toBeInTheDocument()
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
		fireEvent.click(panel.getByRole("button", { name: "Save" }))

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
		expect(await panel.findByRole("alert")).toHaveTextContent("isn't one of the files this reads")
	})
})

describe("the Umas and Support cards tabs", () => {
	it("marks an uma owned with a tap, then sets her stars; JP-only umas are not offered", async () => {
		show("/app/collection?tab=umas")
		const grid = within(await screen.findByRole("region", { name: "Umas you own" }))
		expect(grid.queryByRole("button", { name: /JP Only/ })).toBeNull()
		fireEvent.click(grid.getByRole("button", { name: "Maruzensky" }))
		await waitFor(() => expect(calls("PATCH")).toHaveLength(1))
		expect(calls("PATCH")[0].body).toEqual({ umas: [{ uma: 42, owned: true }] })
		// On screen at once: she is owned and gets a stars pick.
		expect(grid.getByRole("button", { name: "Maruzensky, owned" })).toHaveAttribute("aria-pressed", "true")
		fireEvent.change(grid.getByLabelText("Stars for Maruzensky"), { target: { value: "4" } })
		await waitFor(() => expect(calls("PATCH")).toHaveLength(2))
		expect(calls("PATCH")[1].body).toEqual({ umas: [{ uma: 42, owned: true, stars: 4 }] })
	})

	it("unmarks an uma with Remove, and starts over after asking once", async () => {
		roster = {
			umas: [41, 42].map((uma) => ({ uma, stars: 3, talent_level: 5, source: "import" as const, obtained_at: null })),
			support_cards: [],
		}
		show("/app/collection?tab=umas")
		const grid = within(await screen.findByRole("region", { name: "Umas you own" }))
		fireEvent.click(grid.getByRole("button", { name: "Remove Oguri Cap" }))
		await waitFor(() => expect(calls("PATCH")).toHaveLength(1))
		expect(calls("PATCH")[0].body).toEqual({ umas: [{ uma: 41, owned: false }] })

		fireEvent.click(grid.getByRole("button", { name: "Start over" }))
		expect(grid.getByText(/Remove all 1 umas\? This can't be undone\./)).toBeInTheDocument()
		expect(calls("DELETE")).toHaveLength(0)
		fireEvent.click(grid.getByRole("button", { name: "Remove all" }))
		await waitFor(() => expect(calls("DELETE").map((call) => call.path)).toEqual(["/roster/umas"]))
		await waitFor(() => expect(grid.getByText("0 of 2 owned")).toBeInTheDocument())
	})

	it("has no button that marks everything owned", async () => {
		show("/app/collection?tab=umas")
		const grid = within(await screen.findByRole("region", { name: "Umas you own" }))
		expect(grid.queryByRole("button", { name: /Mark all/ })).toBeNull()
	})

	it("opens on the newest released, and combines sorts", async () => {
		roster = { umas: [{ uma: 41, stars: 5, talent_level: 5, source: "import", obtained_at: null }], support_cards: [] }
		show("/app/collection?tab=umas")
		const grid = within(await screen.findByRole("region", { name: "Umas you own" }))
		const order = () => grid.getAllByRole("button", { pressed: undefined }).filter((button) => button.hasAttribute("aria-pressed")).map((button) => button.getAttribute("aria-label"))
		expect(order()).toEqual(["Maruzensky", "Oguri Cap, owned"])
		// Flip to oldest first.
		fireEvent.click(grid.getByRole("button", { name: /Release date, newest first/ }))
		expect(order()).toEqual(["Oguri Cap, owned", "Maruzensky"])
		// Stars first, then release: the owned 5-star Oguri leads, the unowned (no stars) goes last.
		fireEvent.change(grid.getByLabelText("Add a sort"), { target: { value: "stars" } })
		fireEvent.click(grid.getByRole("button", { name: "Stop sorting by Release date" }))
		expect(order()).toEqual(["Oguri Cap, owned", "Maruzensky"])
	})

	it("sets an owned card's limit break", async () => {
		roster = { umas: [], support_cards: [{ support_card: 9, limit_break: 2, spare_copies: 0, source: "import", obtained_at: null }] }
		show("/app/collection?tab=cards")
		const grid = within(await screen.findByRole("region", { name: "Support cards you own" }))
		expect(grid.getByTestId("limit-break-badge")).toHaveTextContent("LB2")
		fireEvent.change(grid.getByLabelText("Limit break for Kitasan Black"), { target: { value: "4" } })
		await waitFor(() => expect(calls("PATCH")).toHaveLength(1))
		expect(calls("PATCH")[0].body).toEqual({ support_cards: [{ support_card: 9, owned: true, limit_break: 4 }] })
		expect(grid.getByTestId("limit-break-badge")).toHaveTextContent("MLB")
	})

	it("imports all three files at once: veterans, umas and cards", async () => {
		show()
		fireEvent.click(await screen.findByRole("button", { name: /Import from the game/ }))
		const panel = within(screen.getByRole("region", { name: "Import from the game" }))
		const file = (name: string, rows: unknown[]) => new File([JSON.stringify(rows)], name)
		fireEvent.change(panel.getByLabelText(/Choose the files/), {
			target: {
				files: [
					file("trained_chara_data.json", [{ viewer_id: 7, trained_chara_id: 12, card_id: 100601, speed: 1200, stamina: 800, power: 1000, guts: 400, wiz: 900, skill_array: [] }]),
					file("card_data.json", [{ card_id: 100401, rarity: 4, talent_level: 5, create_time: "2025-09-01 08:00:00" }]),
					file("support_card_data.json", [{ viewer_id: 7, support_card_id: 30028, limit_break_count: 4, stock: 1 }]),
				],
			},
		})
		expect(await panel.findByText("1 uma you own.")).toBeInTheDocument()
		expect(panel.getByText("1 support card you own, 1 at MLB.")).toBeInTheDocument()
		fireEvent.click(panel.getByRole("button", { name: "Save" }))
		await waitFor(() => expect(calls("POST").map((call) => call.path)).toEqual(["/trained-umas/import", "/roster/import"]))
		expect(calls("POST")[1].body).toMatchObject({
			umas: [{ uma: 42, stars: 4, talent_level: 5 }],
			support_cards: [{ support_card: 9, limit_break: 4, spare_copies: 1 }],
		})
	})
})

describe("a link to one veteran", () => {
	it("opens the veteran a CM Runs link names, and a tap opens another", async () => {
		stored = [veteran(1), veteran(2, { uma: 42 })]
		show("/app/collection?veteran=2")
		expect(await screen.findByRole("heading", { name: "Maruzensky" })).toBeInTheDocument()
		const tile = (id: number) => document.getElementById(`veteran-${id}`)
		expect(tile(2)).toHaveAttribute("aria-pressed", "true")
		expect(tile(1)).toHaveAttribute("aria-pressed", "false")
		fireEvent.click(tile(1)!)
		expect(screen.getByRole("heading", { name: "Oguri Cap" })).toBeInTheDocument()
	})
})

describe("her card", () => {
	const factors = (...ids: number[]) => ids.map((factor_id) => ({ factor_id, level: 0 }))
	const SPARKS = {
		"103": { name: "Speed", kind: "stat", stars: 3 },
		"102": { name: "Speed", kind: "stat", stars: 2 },
		"201": { name: "Stamina", kind: "stat", stars: 1 },
		"3401": { name: "Long", kind: "aptitude", stars: 1 },
		"1000401": { name: "Oka Sho", kind: "race", stars: 1 },
	} as const
	const GAME = {
		scenario_id: 2, running_style: 2, fans: 255610, win_saddle_id_array: [1, 10, 12],
		factor_info_array: factors(103, 1000401),
		succession_chara_array: [
			{ position_id: 10, card_id: 100401, rank: 17, factor_info_array: factors(102, 3401) },
			{ position_id: 11, card_id: 100601, rank: 15, factor_info_array: factors(201) },
			{ position_id: 20, card_id: 100601, rank: 18, factor_info_array: factors(201) },
		],
		support_card_list: [{ position: 1, support_card_id: 30028, limit_break_count: 4 }],
		race_result_list: [{ turn: 12, result_rank: 1 }, { turn: 30, result_rank: 2 }, { turn: 40, result_rank: 1 }],
	}

	it("lays out a game veteran: grade, skills, sparks and lineage, deck and career", async () => {
		stored = [veteran(1, {
			source: "import", import_key: 12, has_game_data: true, rank_score: 13815, rank_grade: 14, trained_at: "2026-07-14T03:00:00Z",
			skills: [{ skill: 9, level: 1 }, { skill: 10, level: 4 }],
		})]
		details = { 1: { game_data: GAME, sparks: SPARKS } }
		show()
		const card = within(await screen.findByRole("article"))
		expect(card.getByText("A+")).toBeInTheDocument()
		expect(card.getByText("13,815")).toBeInTheDocument()
		// Unique first.
		expect(card.getByText("2 skills: 1 unique, 0 gold, 1 white")).toBeInTheDocument()
		expect(card.getAllByRole("listitem").map((row) => row.textContent)).toEqual(["Triumphant PulseUnique · Lv 4", "Corner Adept ○"])
		expect(await card.findByText("Unity Cup")).toBeInTheDocument()
		// Her running style and scenario, on the line under her name.
		expect(card.getByText("Unity Cup").parentElement).toHaveTextContent("Pace")

		fireEvent.click(card.getByRole("tab", { name: /Sparks/ }))
		expect(card.getByText("Oka Sho")).toBeInTheDocument()
		// Hers and her parents': Speed 3 + 2, then the 1-star Stamina (blue) before Long (pink).
		const passes = within(card.getByText("As a parent she passes on").closest("section")!)
		expect(passes.getAllByText(/★$/).map((total) => total.parentElement?.textContent)).toEqual(["5★Speed", "1★Stamina", "1★Long"])
		expect(passes.getByText("0 unique sparks and 1 white spark across the three of them")).toBeInTheDocument()
		expect(card.getByText("Parent · SS")).toBeInTheDocument()
		expect(card.getByText("Parent · SS+")).toBeInTheDocument()

		fireEvent.click(card.getByRole("tab", { name: /Training/ }))
		expect(card.getByRole("img", { name: "Finishing places, in order: 1, 2, 1" })).toBeInTheDocument()
		expect(card.getByText("2 wins")).toBeInTheDocument()
		expect(card.getByText("255,610")).toBeInTheDocument()
		expect(card.getByText("Titles won").nextSibling).toHaveTextContent("3")
		expect(card.getByText("Kitasan Black")).toBeInTheDocument()
		expect(calls("GET").filter((call) => call.path === "/trained-umas/1")).toHaveLength(1)
	})

	it("says a hand entry's sparks come from the game, and fetches nothing more", async () => {
		stored = [veteran(1)]
		show()
		const card = within(await screen.findByRole("article"))
		fireEvent.click(card.getByRole("tab", { name: /Sparks/ }))
		expect(card.getByText(/Sparks and lineage come from the game's export/)).toBeInTheDocument()
		expect(card.getByRole("button", { name: /Import from the game/ })).toBeInTheDocument()
		expect(calls("GET").some((call) => call.path === "/trained-umas/1")).toBe(false)
	})

	it("narrows the list to an aptitude at A or better", async () => {
		stored = [veteran(1), veteran(2, { uma: 42, apt: { ...APT, long: 7 } })]
		show()
		const list = within(await screen.findByRole("region", { name: "Your veterans" }))
		fireEvent.click(list.getByRole("button", { name: "Long" }))
		expect(list.getByText("Showing 1 of 2")).toBeInTheDocument()
		expect(document.getElementById("veteran-1")).toBeNull()
		expect(document.getElementById("veteran-2")).not.toBeNull()
	})
})

describe("an import replaces only the lists it carries", () => {
	it("sends only the cards when only the cards file is dropped", async () => {
		show()
		fireEvent.click(await screen.findByRole("button", { name: /Import from the game/ }))
		const panel = within(screen.getByRole("region", { name: "Import from the game" }))
		const file = new File([JSON.stringify([{ viewer_id: 7, support_card_id: 30028, limit_break_count: 2, stock: 0 }])], "support_card_data.json")
		fireEvent.change(panel.getByLabelText(/Choose the files/), { target: { files: [file] } })
		expect(await panel.findByText(/Saving replaces your support cards list with/)).toBeInTheDocument()
		fireEvent.click(panel.getByRole("button", { name: "Save" }))
		await waitFor(() => expect(calls("POST")).toHaveLength(1))
		expect(Object.keys(calls("POST")[0].body)).toEqual(["support_cards"])
	})
})

