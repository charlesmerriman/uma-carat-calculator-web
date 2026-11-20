import { fireEvent, render, screen, within } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AuthContext, type AuthContextType } from "../services/AuthContext"
import { SkillPage } from "../components/skills/SkillPage"
import { clearAuthToken, setAuthToken } from "../services/authToken"
import { TestQueryProvider } from "../test/TestQueryProvider"
import type { SkillDetailData } from "../types/skills"
import { keepCard } from "../utils/encyclopedia"

/** One skill's Encyclopedia page (/app/skills/<game id>). */

const base = {
	image: null, tier: 1, version: "○ white", is_evolved: false, availability: "global" as const, uses_translation: false,
}

const DETAIL: SkillDetailData = {
	...base, id: 3, game_id: 100101111, name: "Gluttonous Ruler", rarity: 6, group_id: 1001011, version: "evolved",
	is_evolved: true, availability: "announced", other_names: ["Big Eater"], cost: null, type: "recovery",
	owners: ["Special Week"],
	pair: null,
	description: "Recover endurance mid-race.",
	readable: {
		wit_check: true, complete: true,
		slots: [{ after: { all: [], any: [] }, when: { all: [{ text: "At a random moment mid-race", raw: false }], any: [] },
			effects: [{ text: "Recovers 5.5% endurance", raw: false }], duration: null, cooldown: "Once per race" }],
	},
	sources: {
		umas: [{ id: 7, name: "Special Week", game_id: 100101, image: null, source: "evolved", level: 3, on_global: true }],
		cards: [
			{ id: 9, name: "Kitasan Black", game_id: 30028, image: null, source: "hint", on_global: true, rarity: 3, card_type: "speed" },
			{ id: 10, name: "Nice Nature", game_id: 10021, image: null, source: "hint", on_global: true, rarity: 1, card_type: "wit" },
		],
	},
	evolution: {
		from: { ...base, id: 2, game_id: 200002, name: "Gourmand", rarity: 2, group_id: 2, version: "◎ gold", cost: 180 },
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

function renderAt(path: string) {
	const auth = { isLoggedIn: true, status: "ready", account: { early_access: true, oshi_uma_ids: [] } } as unknown as AuthContextType
	return render(
		<AuthContext.Provider value={auth}>
			<TestQueryProvider>
				<MemoryRouter initialEntries={[path]}>
					<Routes>
						<Route path="/app/skills/:gameId" element={<SkillPage />} />
					</Routes>
				</MemoryRouter>
			</TestQueryProvider>
		</AuthContext.Provider>
	)
}

describe("SkillPage", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", fetchMock)
		fetchMock.mockImplementation((url: string) =>
			Promise.resolve(url.endsWith("/skills/100101111")
				? new Response(JSON.stringify(DETAIL), { status: 200 })
				: new Response("{}", { status: 404 }))
		)
	})
	afterEach(() => {
		vi.unstubAllGlobals()
		fetchMock.mockReset()
	})

	it("reads the skill in full, with its uma named", async () => {
		const { container } = renderAt("/app/skills/100101111")
		expect(await screen.findByRole("heading", { level: 1, name: /Gluttonous Ruler/ })).toBeInTheDocument()
		// Its uma is in the hero's eyebrow, its kind a pill beside the name.
		expect(container).toHaveTextContent("Skill · Special Week")
		expect(within(screen.getByRole("banner")).getByText("evolved")).toBeInTheDocument()
		expect(container).toHaveTextContent("When: At a random moment mid-race")
		expect(container).toHaveTextContent("Does: Recovers 5.5% endurance")
		expect(container).toHaveTextContent("Cooldown: Once per race")
		expect(container).toHaveTextContent("Rolls Wit check.")
		expect(container).toHaveTextContent("Coming to global")
		expect(container).toHaveTextContent("スキルを3個 (in Japanese, no translation yet)")
	})

	it("shows the game's condition code under the clauses in the Detailed view", async () => {
		const coded = { ...DETAIL, raw_conditions: [{ after: "", when: "phase_random==1&order>=3@phase_random==1&order<=1" }] }
		fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(coded), { status: 200 })))
		renderAt("/app/skills/100101111")
		await screen.findByRole("heading", { level: 1, name: /Gluttonous Ruler/ })
		// Plain by default: no code until asked for.
		expect(screen.queryByLabelText("The game's condition code")).not.toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "Detailed" }))
		const code = screen.getByLabelText("The game's condition code")
		// Each `@` alternative on its own line, its clauses joined by " & ".
		expect(code).toHaveTextContent("phase_random==1 & order>=3or phase_random==1 & order<=1")
		// Back to Plain, so the remembered choice doesn't leak into the next test.
		fireEvent.click(screen.getByRole("button", { name: "Plain" }))
	})

	it("shows a scaled time with its per 1,000 m and no note explaining it again", async () => {
		const timed = { ...DETAIL, readable: { ...DETAIL.readable, slots: [{ ...DETAIL.readable.slots[0], duration: "2.4 s per 1,000 m" }] } }
		fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(timed), { status: 200 })))
		const { container } = renderAt("/app/skills/100101111")
		await screen.findByRole("heading", { level: 1, name: /Gluttonous Ruler/ })
		expect(container).toHaveTextContent("Lasts: 2.4 s per 1,000 m")
		expect(container).not.toHaveTextContent("Times are for every 1,000 m")
	})

	it("puts the bands behind a scaled effect and time in a table under each", async () => {
		const scaled = { ...DETAIL, readable: { ...DETAIL.readable, slots: [{
			...DETAIL.readable.slots[0],
			effects: [{ text: "Velocity +0.28 to +0.42, by fan count", raw: false, scaling: { heading: "Fans", rows: [
				{ when: "Under 20,000", value: "+0.28" }, { when: "160,000 or more", value: "+0.42" },
			] } }],
			duration: "5 to 20 s per 1,000 m, by HP left when it fires",
			duration_scaling: { heading: "HP left", rows: [{ when: "Under 2,000", value: "5 s" }, { when: "3,500 or more", value: "20 s" }] },
		}] } }
		fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(scaled), { status: 200 })))
		renderAt("/app/skills/100101111")
		await screen.findByRole("heading", { level: 1, name: /Gluttonous Ruler/ })
		const [effect, time] = screen.getAllByRole("table")
		expect(within(effect).getByRole("columnheader", { name: "Fans" })).toBeInTheDocument()
		expect(within(effect).getByRole("row", { name: "160,000 or more +0.42" })).toBeInTheDocument()
		expect(within(time).getByRole("columnheader", { name: "Lasts" })).toBeInTheDocument()
		expect(within(time).getByRole("row", { name: "3,500 or more 20 s" })).toBeInTheDocument()
	})

	it("links its base, its umas and its cards to their pages", async () => {
		renderAt("/app/skills/100101111")
		expect(await screen.findByRole("link", { name: /Gourmand/ })).toHaveAttribute("href", "/app/skills/200002")
		expect(screen.getByRole("link", { name: /Special Week.*Evolution, level 3/ })).toHaveAttribute("href", "/app/umas/100101")
		expect(screen.getByRole("link", { name: /Kitasan Black/ })).toHaveAttribute("href", "/app/cards/30028")
	})

	it("lists a unique's inherited copy among its other versions, as white and gold are", async () => {
		const unique: SkillDetailData = {
			...DETAIL, id: 30, game_id: 110331, name: "Lights of Vaudeville", rarity: 5, is_evolved: false,
			version: "○ white", availability: "global", owners: ["Fuji Kiseki"],
			pair: { ...base, id: 31, game_id: 910331, name: "Lights of Vaudeville", rarity: 1, group_id: 91033 },
			evolution: { from: null, into: [], conditions: [], scenario: null },
		}
		fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(unique), { status: 200 })))
		renderAt("/app/skills/110331")
		// The heading carries its count ("Other versions 1"); the links are in its section.
		const versions = (await screen.findByRole("heading", { name: /^Other versions/ })).closest("section") as HTMLElement
		expect(within(versions).getByRole("link", { name: /Lights of Vaudeville.*inherited/ })).toHaveAttribute("href", "/app/skills/910331")
	})

	it("hides R cards on request", async () => {
		renderAt("/app/skills/100101111")
		expect(await screen.findByRole("heading", { name: "Cards that teach it 2" })).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "Hide R" }))
		expect(screen.getByRole("heading", { name: "Cards that teach it 1" })).toBeInTheDocument()
		expect(screen.queryByRole("link", { name: /Nice Nature/ })).not.toBeInTheDocument()
	})

	it("never shows the names search alone may match", async () => {
		const { container } = renderAt("/app/skills/100101111")
		await screen.findByRole("heading", { level: 1, name: /Gluttonous Ruler/ })
		expect(container).not.toHaveTextContent("Big Eater")
	})

	it("says so for an id with no skill", async () => {
		renderAt("/app/skills/999999")
		expect(await screen.findByText(/There's no page for that/)).toBeInTheDocument()
	})

	it("sends the token", async () => {
		setAuthToken("reader-token")
		try {
			renderAt("/app/skills/100101111")
			await screen.findByRole("heading", { level: 1, name: /Gluttonous Ruler/ })
			expect(fetchMock.mock.calls[0][1]?.headers).toEqual({ Authorization: "Token reader-token" })
		} finally {
			clearAuthToken()
		}
	})
})

describe("keepCard", () => {
	it("drops R, or R and SR, and keeps a card with no rarity", () => {
		expect(keepCard({ rarity: 1 }, "r")).toBe(false)
		expect(keepCard({ rarity: 2 }, "r")).toBe(true)
		expect(keepCard({ rarity: 2 }, "sr")).toBe(false)
		expect(keepCard({ rarity: null }, "sr")).toBe(true)
	})
})
describe("SkillPage, Daptrius's batch of 2026-11-17", () => {
	const slot = (text: string) => ({
		after: { all: [], any: [] }, when: { all: [{ text, raw: false }], any: [] },
		effects: [{ text: "Velocity +0.15", raw: false }], duration: null, cooldown: null,
	})
	function serve(detail: SkillDetailData) {
		fetchMock.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(detail), { status: 200 })))
	}
	beforeEach(() => vi.stubGlobal("fetch", fetchMock))
	afterEach(() => {
		vi.unstubAllGlobals()
		fetchMock.mockReset()
	})

	it("calls two slots triggers, the first that holds firing, and parts only when chained", async () => {
		serve({ ...DETAIL, readable: { wit_check: null, complete: true, slots: [slot("Mid-race"), slot("Late-race")] } })
		const { unmount } = renderAt("/app/skills/100101111")
		expect(await screen.findByText("Trigger 1")).toBeInTheDocument()
		expect(screen.getByText("Trigger 2")).toBeInTheDocument()
		unmount()

		serve({ ...DETAIL, readable: { wit_check: null, complete: true, chained: true, slots: [slot("Mid-race"), slot("After Part 1 fires")] } })
		renderAt("/app/skills/100101111")
		expect(await screen.findByText("Part 2")).toBeInTheDocument()
		expect(screen.queryByText("Trigger 1")).not.toBeInTheDocument()
	})

	it("on a ◎, says which givers teach the ○", async () => {
		serve({
			...DETAIL,
			sources: {
				umas: [{ id: 7, name: "Special Week", game_id: 100101, image: null, source: "awakening", level: 2, on_global: true, via: "Mile Corners ○" }],
				cards: [{ id: 9, name: "Kitasan Black", game_id: 30028, image: null, source: "hint", on_global: true, rarity: 3, card_type: "speed", via: "Mile Corners ○" }],
			},
		})
		renderAt("/app/skills/100101111")
		expect(await screen.findByText("Awakening, level 2 · Mile Corners ○")).toBeInTheDocument()
		expect(screen.getByText(/Hint · Mile Corners ○$/)).toBeInTheDocument()
	})
})
