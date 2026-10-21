import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PvpCatalogueIndex } from "../hooks/usePvpCatalogue"
import type { GuideDocument } from "../types/guideDocument"
import type { PvpGuide } from "../types/pvpGuide"
import type { CatalogueSkill, CatalogueSupportCard, CatalogueUma, PvpCatalogue } from "../types/pvpTeam"
import type { RaceEvent } from "../types"

/**
 * The guide editor (components/pvp/editor): loads the event's document,
 * saves it whole after a pause, shows the server's refusals by field, handles
 * a save that collided, adds rows through the pickers, publishes, and primes
 * the reader's cache. The pure rules have their own tests
 * (guideDocument.test.ts); the API's shapes are backend/docs/api-reference.md.
 */

const apt = { turf: 8, dirt: 1, short: 6, mile: 8, medium: 7, long: 4, front: 8, pace: 5, late: 2, end: 1 }
const uma = (id: number, name: string): CatalogueUma => ({
	id, name, image: null, portrait: null, rarity: 3, running_style: 1, character_id: id, is_variant: false, on_global: true, apt, skills: [],
})
const card = (id: number, name: string): CatalogueSupportCard => ({ id, name, image: null, card_type: "speed", rarity: 3, title: "", on_global: true, skills: [] })
const skill = (id: number, name: string): CatalogueSkill => ({ id, name, description: `${name} does a thing.`, image: null, rarity: 1, tier: 1, group_id: id, cost: 100, version: "○ white" })
const CATALOGUE: PvpCatalogue = {
	umas: [uma(41, "Maruzensky"), uma(42, "Gold Ship"), uma(43, "Seiun Sky")],
	support_cards: [card(302, "Kitasan Black"), card(303, "Super Creek"), card(304, "Fine Motion")],
	skills: [skill(1, "Groundwork"), skill(3, "Left-Handed ○")],
}
const INDEX: PvpCatalogueIndex = {
	catalogue: CATALOGUE,
	umasById: new Map(CATALOGUE.umas.map((row) => [row.id, row])),
	cardsById: new Map(CATALOGUE.support_cards.map((row) => [row.id, row])),
	skillsById: new Map(CATALOGUE.skills.map((row) => [row.id, row])),
}

const EVENT = {
	id: 10, name: "Aquarius Cup", event_type: "champions_meeting", cm_number: 10,
	start_date: "2099-03-06T00:00:00Z", end_date: "2099-03-10T00:00:00Z", is_predicted: false,
	track: "Tokyo", surface_type: "Turf", distance: "Mile", length: "1600m",
	track_condition: "Good", season: "Spring", weather: "Sunny", direction: "Right", has_guide: false,
} as unknown as RaceEvent

function document(): GuideDocument {
	return {
		id: 7, version: 3, event_type: "champions_meeting", event: 10, is_published: false, updated_at: "2099-01-01T00:00:00Z",
		scenario: null, style_ranking: "Front >> End", short_description: "Mile on turf.", meta_analysis: "", admin_comments: "",
		stat_configs: [{ style: "everyone", label: "", speed: "1100+", stamina: "", power: "", guts: "", wit: "", footnote: "" }],
		team_comps: [],
		uma_recommendations: [{ style: "front", uma: 41, stars: 5, role: "RA", note: "" }],
		skill_recommendations: [{ style: "front", category: "acceleration", tier: 0, skill: 1, note: "" }],
		style_notes: [{ style: "front", body: "Go early." }],
		decks: [{ id: 90, style: "front", label: "Standard", note: "", slots: [{ slot: 6, order: 0, is_borrow: true, support_card: 303, note: "" }] }],
	}
}
const READER: PvpGuide = {
	event_type: "champions_meeting", event: 10, is_published: false, updated_at: "2099-01-01T00:00:00Z", scenario: null,
	style_ranking: "Front >> End", short_description: "Mile on turf.", meta_analysis: "", team_comps: [], stat_configs: [],
	uma_recommendations: [], skill_recommendations: [], style_notes: [], decks: [], skill_mentions: {},
}
const EDITABLE = { guides: [{ id: 7, kind: "cm", event: 10, name: "Aquarius Cup", is_published: false, version: 3, updated_at: "x", filled: ["front"] }], events: [] }

vi.mock("../services/CalculatorContext", () => ({
	useCalculatorData: () => ({ scenarioData: [{ id: 1, name: "Grand Live", image: null }], umaBannerData: [], supportBannerData: [] }),
}))
vi.mock("../hooks/usePvpCatalogue", () => ({ usePvpCatalogue: () => ({ status: "ready", ...INDEX }) }))

const { GuideEditor } = await import("../components/pvp/editor/GuideEditor")
const { usePvpGuide, clearPvpGuideCache } = await import("../hooks/usePvpGuide")

type Call = { method: string; path: string; body: unknown }
const calls: Call[] = []
/** Answers by "METHOD path"; a PUT's answer may be a function of its body. */
let answers: Record<string, (body: unknown) => { status: number; body: unknown }> = {}

function respond(status: number, body: unknown) {
	return () => ({ status, body })
}

beforeEach(() => {
	calls.length = 0
	clearPvpGuideCache()
	answers = {
		"GET /pvp-guides/editable": respond(200, EDITABLE),
		"GET /pvp-guides/7/document": respond(200, document()),
		"PUT /pvp-guides/7/document": (body) => ({
			status: 200,
			body: { document: { ...(body as GuideDocument), id: 7, event_type: "champions_meeting", event: 10, is_published: false, updated_at: "x", version: 4 }, guide: READER },
		}),
	}
	vi.stubGlobal(
		"fetch",
		vi.fn((url: string, init?: RequestInit) => {
			const method = init?.method ?? "GET"
			const path = url.replace(/^.*?\/pvp-guides/, "/pvp-guides")
			const body = init?.body ? JSON.parse(String(init.body)) : undefined
			calls.push({ method, path, body })
			const answer = answers[`${method} ${path}`]?.(body) ?? { status: 404, body: { error: "Guide not found" } }
			return Promise.resolve(new Response(JSON.stringify(answer.body), { status: answer.status }))
		})
	)
})

afterEach(() => {
	vi.unstubAllGlobals()
})

function ReaderProbe() {
	const state = usePvpGuide({ kind: "cm", id: 10 })
	return <output data-testid="reader">{state.status}</output>
}

function renderEditor() {
	const onViewAsVisitor = vi.fn()
	render(
		<MemoryRouter>
			<GuideEditor event={EVENT} onViewAsVisitor={onViewAsVisitor} autosaveMs={10} />
			<ReaderProbe />
		</MemoryRouter>
	)
	return { onViewAsVisitor }
}

const puts = () => calls.filter((call) => call.method === "PUT")

describe("GuideEditor", () => {
	it("loads the event's document and shows the tabs with their counts", async () => {
		renderEditor()
		expect(await screen.findByRole("tab", { name: /Front/ })).toBeInTheDocument()
		const tabs = within(screen.getByRole("tablist", { name: "Guide section" }))
		expect(tabs.getByRole("tab", { name: /Front/ }).textContent).toBe("Front4")
		expect(tabs.getByRole("tab", { name: /^Guide/ }).textContent).toBe("Guide1")
		expect(screen.getByLabelText("Style ranking")).toHaveValue("Front >> End")
		expect(screen.getByText("Draft")).toBeInTheDocument()
		expect(screen.getByText("Saved")).toBeInTheDocument()
		expect(screen.getByText("Nothing yet for Runaway, Pace, Late, End.")).toBeInTheDocument()
	})

	it("saves the whole document once after a pause, with the version, and primes the reader", async () => {
		renderEditor()
		const ranking = await screen.findByLabelText("Style ranking")
		expect(screen.getByTestId("reader").textContent).not.toBe("ready")
		fireEvent.change(ranking, { target: { value: "End >> Front" } })
		fireEvent.change(ranking, { target: { value: "End >> Front >> Pace" } })
		expect(screen.getByText("Saving soon…")).toBeInTheDocument()
		await waitFor(() => expect(puts()).toHaveLength(1))
		const body = puts()[0].body as GuideDocument
		expect(body.version).toBe(3)
		expect(body.style_ranking).toBe("End >> Front >> Pace")
		expect(Object.keys(body)).not.toContain("id")
		expect(await screen.findByText("Saved")).toBeInTheDocument()
		expect(screen.getByTestId("reader").textContent).toBe("ready")
		// The next save carries the version the server answered with.
		fireEvent.change(ranking, { target: { value: "Front" } })
		await waitFor(() => expect(puts()).toHaveLength(2))
		expect((puts()[1].body as GuideDocument).version).toBe(4)
	})

	it("shows a refused save beside its field and on its tab", async () => {
		answers["PUT /pvp-guides/7/document"] = respond(400, {
			error: "No skill on global has this name: [[Nope]]",
			errors: [{ path: "style_notes[0].body", message: "No skill on global has this name: [[Nope]]" }],
		})
		renderEditor()
		fireEvent.change(await screen.findByLabelText("Style ranking"), { target: { value: "x" } })
		expect(await screen.findByText("Not saved: 1 problem to fix")).toBeInTheDocument()
		const tabs = within(screen.getByRole("tablist", { name: "Guide section" }))
		expect(tabs.getByRole("tab", { name: /Front/ })).toHaveTextContent("1")
		fireEvent.click(tabs.getByRole("tab", { name: /Front/ }))
		expect(screen.getByRole("alert")).toHaveTextContent("No skill on global has this name: [[Nope]]")
	})

	it("offers the other editor's document when a save collides", async () => {
		answers["PUT /pvp-guides/7/document"] = respond(409, {
			error: "Someone saved this guide since you opened it.",
			current: { ...document(), version: 9, style_ranking: "Theirs" },
		})
		renderEditor()
		fireEvent.change(await screen.findByLabelText("Style ranking"), { target: { value: "Mine" } })
		expect(await screen.findByRole("heading", { name: "Someone saved this guide since you opened it" })).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "Load theirs" }))
		expect(screen.getByLabelText("Style ranking")).toHaveValue("Theirs")
		expect(screen.getByText("Saved")).toBeInTheDocument()
	})

	it("adds an uma through the picker and a card through a deck slot", async () => {
		renderEditor()
		fireEvent.click(await screen.findByRole("tab", { name: /Front/ }))
		fireEvent.click(screen.getByRole("button", { name: "Add uma" }))
		const picker = within(screen.getByRole("dialog", { name: "Add an uma to Front" }))
		// The uma already in Front stays visible, blocked.
		expect(picker.getByRole("button", { name: /Maruzensky/ })).toBeDisabled()
		fireEvent.click(picker.getByRole("button", { name: /Seiun Sky/ }))
		expect(screen.getByText("Seiun Sky")).toBeInTheDocument()

		fireEvent.click(screen.getByRole("button", { name: "Slot 2" }))
		const cards = within(screen.getByRole("dialog", { name: "Card 2 of Standard" }))
		expect(cards.getByRole("button", { name: /Super Creek/ })).toBeDisabled()
		fireEvent.click(cards.getByRole("button", { name: /Fine Motion/ }))
		expect(screen.getByText("Fine Motion")).toBeInTheDocument()

		await waitFor(() => expect(puts().length).toBeGreaterThan(0))
		const body = puts()[puts().length - 1].body as GuideDocument
		expect(body.uma_recommendations.map((row) => row.uma)).toEqual([41, 43])
		expect(body.decks[0].slots.map((slot) => [slot.slot, slot.support_card])).toEqual([[6, 303], [2, 304]])
	})

	it("publishes from the dialog", async () => {
		answers["PATCH /pvp-guides/7"] = (body) => ({ status: 200, body: { ...document(), is_published: (body as { is_published: boolean }).is_published, version: 5 } })
		renderEditor()
		fireEvent.click(await screen.findByRole("button", { name: "Publish" }))
		const dialog = within(screen.getByRole("dialog", { name: "Publish this guide?" }))
		fireEvent.click(dialog.getByRole("button", { name: "Publish" }))
		expect(await screen.findByText("Published")).toBeInTheDocument()
		expect(calls.find((call) => call.method === "PATCH")?.body).toEqual({ is_published: true })
		expect(screen.getByRole("button", { name: "Unpublish" })).toBeInTheDocument()
	})

	it("starts a guide for an event that has none", async () => {
		answers["GET /pvp-guides/editable"] = respond(200, { guides: [], events: [{ kind: "cm", event: 10, name: "Aquarius Cup" }] })
		answers["POST /pvp-guides"] = (body) => ({ status: 201, body: { ...document(), version: 1, scenario: (body as { scenario: number | null }).scenario } })
		renderEditor()
		expect(await screen.findByRole("heading", { name: "No guide for Aquarius Cup yet" })).toBeInTheDocument()
		fireEvent.change(screen.getByRole("combobox", { name: "Scenario" }), { target: { value: "1" } })
		fireEvent.click(screen.getByRole("button", { name: "Start empty" }))
		expect(await screen.findByRole("tab", { name: /Front/ })).toBeInTheDocument()
		expect(calls.find((call) => call.method === "POST")?.body).toEqual({ kind: "cm", event: 10, scenario: 1, copy_from: null })
	})

	it("tells an account that may not edit", async () => {
		answers["GET /pvp-guides/editable"] = respond(403, { error: "Only guide editors can do that." })
		renderEditor()
		expect(await screen.findByText("This account can't edit guides.")).toBeInTheDocument()
	})
})
