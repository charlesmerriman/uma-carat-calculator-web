import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AuthContext, type AuthContextType } from "../services/AuthContext"
import { SkillsPage } from "../components/skills/SkillsPage"
import { clearAuthToken, setAuthToken } from "../services/authToken"
import { resetSkillListForTests } from "../services/skillsFetchCalls"
import type { SkillListRow } from "../types/skills"
import { filterSkills, parseSkillParam, skillHref, skillKind } from "../utils/skillSearch"

/** The Skills list (/app/skills): search and filters; a row opens the skill's own page. */

const row = (id: number, name: string, overrides: Partial<SkillListRow> = {}): SkillListRow => ({
	id, game_id: 200000 + id, name, image: null, rarity: 1, tier: 1, group_id: id, version: "○ white",
	is_evolved: false, availability: "global", uses_translation: false, other_names: [], ...overrides,
})

const ROWS = [
	row(1, "Corner Adept ○", { other_names: ["コーナー巧者○"] }),
	row(2, "Gourmand", { rarity: 2, version: "◎ gold", cost: 180 }),
	row(3, "Gluttonous Ruler", { game_id: 100101111, rarity: 6, is_evolved: true, version: "evolved", availability: "announced" }),
	row(4, "Fan Skill", { availability: "jp", uses_translation: true }),
]

/** The skills work shows to early access only (useSkillsPreview): supporters and staff first. */
function asReader(node: ReactNode, earlyAccess = true) {
	const value = { isLoggedIn: true, status: "ready", account: { early_access: earlyAccess, oshi_uma_ids: [] } } as unknown as AuthContextType
	return <AuthContext.Provider value={value}>{node}</AuthContext.Provider>
}

const fetchMock = vi.fn()

function renderPage(url = "/app/skills", earlyAccess = true) {
	return render(
		asReader(
			<MemoryRouter initialEntries={[url]}>
				<Routes>
					<Route path="/app/skills" element={<SkillsPage />} />
					<Route path="/app/skills/:gameId" element={<p>The skill's own page</p>} />
				</Routes>
			</MemoryRouter>,
			earlyAccess
		)
	)
}

beforeEach(() => {
	resetSkillListForTests()
	fetchMock.mockReset()
	vi.stubGlobal("fetch", fetchMock)
	fetchMock.mockImplementation((url: string) =>
		Promise.resolve(url.endsWith("/skills") ? new Response(JSON.stringify(ROWS), { status: 200 }) : new Response("{}", { status: 404 }))
	)
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

	it("gives inherited copies their own filter, out of White", () => {
		const rows = [...ROWS, row(5, "Shooting Star", { game_id: 900011, owners: ["Special Week"] })]
		expect(filterSkills(rows, "", "inherited", "all").map((r) => r.name)).toEqual(["Shooting Star"])
		expect(filterSkills(rows, "", "white", "all").map((r) => r.name)).not.toContain("Shooting Star")
	})

	it("filters by type, and finds a unique by its uma's name", () => {
		const rows = [
			row(6, "Shooting Star", { game_id: 100011, rarity: 5, type: "unique", owners: ["Special Week"] }),
			row(7, "Swinging Maestro", { type: "recovery" }),
		]
		expect(filterSkills(rows, "", "all", "all", "recovery").map((r) => r.name)).toEqual(["Swinging Maestro"])
		expect(filterSkills(rows, "special week", "all", "all").map((r) => r.name)).toEqual(["Shooting Star"])
	})

	it("labels a unique's inherited copy, which shares its name", () => {
		expect(skillKind({ game_id: 900661, rarity: 1, is_evolved: false })).toBe("inherited")
		expect(skillKind({ game_id: 200012, rarity: 1, is_evolved: false })).toBe("white")
		expect(skillKind({ game_id: 100661, rarity: 5, is_evolved: false })).toBe("unique")
	})

	it("reads only a game id from an old link, and links to the skill's own page", () => {
		expect(parseSkillParam("100101111")).toBe(100101111)
		expect(parseSkillParam("abc")).toBeNull()
		expect(parseSkillParam(null)).toBeNull()
		expect(skillHref(100101111)).toBe("/app/skills/100101111")
	})
})

describe("SkillsPage", () => {
	it("lists the skills, tagged, and narrows on search", async () => {
		renderPage()
		expect(await screen.findByText("4 skills")).toBeInTheDocument()
		expect(screen.getByRole("link", { name: /Fan Skill/ })).toHaveTextContent("JP only")
		expect(screen.getByRole("link", { name: /Gourmand/ })).toHaveAttribute("href", "/app/skills/200002")
		expect(screen.getByRole("link", { name: /Gourmand/ })).toHaveTextContent("180 SP")
		// The Encyclopedia's tab strip, Skills open.
		expect(screen.getByRole("link", { name: "Skills" })).toHaveAttribute("aria-current", "page")
		fireEvent.change(screen.getByRole("searchbox", { name: "Search skills" }), { target: { value: "gour" } })
		expect(screen.getByText("1 skill")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "Evolved" }))
		expect(screen.getByText("No skill matches that.")).toBeInTheDocument()
	})

	it("sends an old ?skill= link to the skill's own page", async () => {
		renderPage("/app/skills?skill=100101111")
		expect(await screen.findByText("The skill's own page")).toBeInTheDocument()
	})

	it("says so when the list doesn't load", async () => {
		fetchMock.mockImplementation(() => Promise.resolve(new Response("{}", { status: 500 })))
		vi.spyOn(console, "error").mockImplementation(() => {})
		renderPage()
		await waitFor(() => expect(screen.getByText(/The skill list didn't load/)).toBeInTheDocument())
	})

	it("tells anyone without early access it's for supporters first", () => {
		renderPage("/app/skills", false)
		expect(screen.getByText(/The Encyclopedia is for our Patreon supporters for now/)).toBeInTheDocument()
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it("sends the token: the API answers early access only", async () => {
		setAuthToken("reader-token")
		try {
			renderPage()
			expect(await screen.findByText("4 skills")).toBeInTheDocument()
			const sent = fetchMock.mock.calls.map(([url, init]) => [String(url).replace(/^.*(\/skills.*)$/, "$1"), init?.headers])
			expect(sent).toContainEqual(["/skills", { Authorization: "Token reader-token" }])
		} finally {
			clearAuthToken()
		}
	})
})
