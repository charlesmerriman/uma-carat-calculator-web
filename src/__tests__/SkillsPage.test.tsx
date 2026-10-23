import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SkillsPage } from "../components/skills/SkillsPage"
import { resetSkillListForTests } from "../services/skillsFetchCalls"
import type { SkillDetailData, SkillListRow } from "../types/skills"
import { filterSkills, parseSkillParam } from "../utils/skillSearch"

/** The Skills page (/app/skills): the list, search and filters, and one skill opened in full. */

const row = (id: number, name: string, overrides: Partial<SkillListRow> = {}): SkillListRow => ({
	id, game_id: 200000 + id, name, image: null, rarity: 1, tier: 1, group_id: id, version: "○ white",
	is_evolved: false, availability: "global", uses_translation: false, other_names: [], ...overrides,
})

const ROWS = [
	row(1, "Corner Adept ○", { other_names: ["コーナー巧者○"] }),
	row(2, "Gourmand", { rarity: 2, version: "◎ gold" }),
	row(3, "Gluttonous Ruler", { game_id: 100101111, rarity: 6, is_evolved: true, version: "evolved", availability: "announced" }),
	row(4, "Fan Skill", { availability: "jp", uses_translation: true }),
]

const DETAIL: SkillDetailData = {
	...ROWS[2],
	description: "Recover endurance mid-race.",
	readable: {
		wit_check: true, complete: true,
		slots: [{ after: { all: [], any: [] }, when: { all: [{ text: "At a random moment mid-race", raw: false }], any: [] },
			effects: [{ text: "Recovers 5.5% endurance", raw: false }], duration: null, cooldown: "Once per race" }],
	},
	sources: {
		umas: [{ id: 7, name: "Special Week", game_id: 100101, image: null, source: "evolved", level: 3, on_global: true }],
		cards: [],
	},
	evolution: {
		from: { ...ROWS[1] },
		into: [],
		conditions: [
			{ text: "Attain at least 600 Stamina", uses_translation: false, is_japanese: false },
			{ text: "スキルを3個", uses_translation: false, is_japanese: true },
		],
		scenario: null,
	},
	versions: [],
}

const fetchMock = vi.fn()

function serve() {
	fetchMock.mockImplementation((url: string) => {
		const body = url.endsWith("/skills") ? ROWS : url.endsWith("/skills/100101111") ? DETAIL : null
		return Promise.resolve(new Response(JSON.stringify(body ?? {}), { status: body ? 200 : 404 }))
	})
}

function renderPage(url = "/app/skills") {
	return render(
		<MemoryRouter initialEntries={[url]}>
			<SkillsPage />
		</MemoryRouter>
	)
}

beforeEach(() => {
	resetSkillListForTests()
	fetchMock.mockReset()
	vi.stubGlobal("fetch", fetchMock)
	serve()
})

afterEach(() => {
	vi.unstubAllGlobals()
})

describe("filterSkills", () => {
	it("matches every word in any name, then the filters", () => {
		expect(filterSkills(ROWS, "corner", "all", "all").map((r) => r.name)).toEqual(["Corner Adept ○"])
		expect(filterSkills(ROWS, "コーナー", "all", "all")).toHaveLength(1)
		expect(filterSkills(ROWS, "", "gold", "all").map((r) => r.name)).toEqual(["Gourmand"])
		expect(filterSkills(ROWS, "", "evolved", "all").map((r) => r.name)).toEqual(["Gluttonous Ruler"])
		expect(filterSkills(ROWS, "", "all", "jp").map((r) => r.name)).toEqual(["Fan Skill"])
	})

	it("reads only a game id from the link", () => {
		expect(parseSkillParam("100101111")).toBe(100101111)
		expect(parseSkillParam("abc")).toBeNull()
		expect(parseSkillParam(null)).toBeNull()
	})
})

describe("SkillsPage", () => {
	it("lists the skills, tagged, and narrows on search", async () => {
		renderPage()
		expect(await screen.findByText("4 skills")).toBeInTheDocument()
		expect(screen.getByRole("link", { name: /Fan Skill/ })).toHaveTextContent("JP only")
		fireEvent.change(screen.getByRole("searchbox", { name: "Search skills" }), { target: { value: "gour" } })
		expect(screen.getByText("1 skill")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "Evolved" }))
		expect(screen.getByText("No skill matches that.")).toBeInTheDocument()
	})

	it("opens the skill a link names, in full", async () => {
		const { container } = renderPage("/app/skills?skill=100101111")
		expect(await screen.findByRole("heading", { name: /Gluttonous Ruler/ })).toBeInTheDocument()
		expect(container).toHaveTextContent("When: At a random moment mid-race")
		expect(container).toHaveTextContent("Does: Recovers 5.5% endurance once per race")
		expect(container).toHaveTextContent("Coming to global")
		expect(screen.getByText("Special Week")).toBeInTheDocument()
		expect(screen.getByText("Evolution, level 3")).toBeInTheDocument()
		// Its base links to the base's own page (the list has a Gourmand link too).
		const card = screen.getByRole("article")
		expect(within(card).getByRole("link", { name: /Gourmand/ })).toHaveAttribute("href", "/app/skills?skill=200002")
		expect(container).toHaveTextContent("スキルを3個 (in Japanese, no translation yet)")
	})

	it("says so when a link names no skill", async () => {
		renderPage("/app/skills?skill=999999")
		expect(await screen.findByText("There's no skill with that link.")).toBeInTheDocument()
	})

	it("says so when the list doesn't load", async () => {
		fetchMock.mockImplementation(() => Promise.resolve(new Response("{}", { status: 500 })))
		vi.spyOn(console, "error").mockImplementation(() => {})
		renderPage()
		await waitFor(() => expect(screen.getByText(/The skill list didn't load/)).toBeInTheDocument())
	})
})
