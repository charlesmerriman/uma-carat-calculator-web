import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AuthContext, type AuthContextType } from "../services/AuthContext"
import { RankingsDock } from "../components/rankings/RankingsDock"
import type { WindowList } from "../components/rankings/WindowSources"
import { chooseRankings, markRankingsSeen, pinRankings, resetRankingsPinForTests } from "../services/rankingsPinStore"
import { movedCount } from "../utils/rankingsWindow"

/**
 * The pinned Rankings window (RankingsDock + services/rankingsPinStore.ts,
 * notes/rankings-redesign-plan.md step 3): who sees it, where, its icon
 * tabs, its three states, the edge tab's count, and that its choices are
 * the page's. jsdom applies no media queries, so the window and the edge
 * tab both render whenever their state says so; the `desktop-nav:` classes
 * pick on a real screen.
 */

// Twelve rows named after the section, "Row 1" leading; a Guides list with one setting.
const NAMES = ["Oguri Cap", "Maruzensky", "Light Hello", "Kitasan Black", "Fine Motion", "Haru Urara", "Sweep Tosho", "El Condor Pasa", "Mr. C.B.", "Marvelous Sunday", "Gold Ship", "Agnes Tachyon"]
const list = (section: string): WindowList => ({
	status: "ready",
	context: `${section} context`,
	tabName: section === "pvp" ? "PvP · CM 21" : section,
	search: section === "players" ? undefined : "Find a card or uma",
	rows: NAMES.map((name, index) => ({ id: `id-${index}`, name, art: null, fill: 1 - index / 12, count: String(100 - index), share: "1%" })),
	settings:
		section === "guides"
			? [{ label: "List", options: [{ id: "overall", label: "Overall" }, { id: "umas", label: "Umas" }], value: "overall", onChange: (value) => chooseRankings("guides", { lens: value as "umas" }) }]
			: [],
})
vi.mock("../components/rankings/WindowSources", () => ({
	WindowSource: ({ section, children }: { section: string; children: (value: WindowList) => unknown }) => children(list(section)),
}))

function renderDock({ earlyAccess = true, editor = false, path = "/app" } = {}) {
	const value = { isLoggedIn: true, status: "ready", account: { early_access: earlyAccess, guide_editor: editor } } as unknown as AuthContextType
	return render(
		<AuthContext.Provider value={value}>
			<MemoryRouter initialEntries={[path]}>
				<RankingsDock />
			</MemoryRouter>
		</AuthContext.Provider>
	)
}

beforeEach(() => {
	localStorage.clear()
	resetRankingsPinForTests()
})

afterEach(() => {
	localStorage.clear()
	resetRankingsPinForTests()
})

describe("RankingsDock", () => {
	it("draws nothing until a tab is pinned", () => {
		const { container } = renderDock()
		expect(container).toBeEmptyDOMElement()
	})

	it("shows the pinned list's top ten, its context and the full page link", () => {
		act(() => pinRankings("players"))
		renderDock()
		const window = screen.getByRole("complementary", { name: "Rankings: Players" })
		expect(window).toHaveTextContent("players context")
		expect(screen.getAllByRole("listitem")).toHaveLength(10)
		expect(window).toHaveTextContent("Top 10 of 12")
		expect(screen.getByRole("link", { name: "Full page" })).toHaveAttribute("href", "/app/rankings?view=players")
	})

	it("switches section from its icon tabs, never drawing one the reader can't open", () => {
		act(() => pinRankings("guides"))
		renderDock()
		expect(screen.queryByRole("button", { name: "Pull plans" })).not.toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "PvP" }))
		expect(screen.getByRole("complementary", { name: "Rankings: PvP" })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "PvP", pressed: true })).toBeInTheDocument()
		expect(localStorage.getItem("rankings-pin")).toBe("pvp")
	})

	it("searches the whole list, keeping each row's place", () => {
		act(() => pinRankings("guides"))
		renderDock()
		fireEvent.change(screen.getByRole("searchbox", { name: "Find a card or uma" }), { target: { value: "agnes" } })
		const rows = screen.getAllByRole("listitem")
		expect(rows).toHaveLength(1)
		expect(rows[0]).toHaveTextContent("12Agnes Tachyon")
	})

	it("changes the list with the page's remembered choice", () => {
		act(() => pinRankings("guides"))
		renderDock()
		fireEvent.click(screen.getByRole("button", { name: "Change" }))
		fireEvent.click(screen.getByRole("tab", { name: "Umas" }))
		expect(JSON.parse(localStorage.getItem("rankings-choices") ?? "{}")).toEqual({ guides: { lens: "umas" } })
	})

	it("retracts to the corner tab and opens again from it", async () => {
		act(() => pinRankings("guides"))
		renderDock()
		fireEvent.click(screen.getByRole("button", { name: "Hide rankings" }))
		// It slides out before it unmounts.
		await waitFor(() => expect(screen.queryByRole("complementary")).not.toBeInTheDocument())
		expect(localStorage.getItem("rankings-pin-docked")).toBe("retracted")
		const tab = screen.getByRole("button", { name: /^Open the pinned rankings/ })
		expect(tab).toHaveClass("bottom-[calc(1rem+env(safe-area-inset-bottom))]", "left-0")
		fireEvent.click(tab)
		expect(screen.getByRole("complementary", { name: "Rankings: Guides" })).toBeInTheDocument()
		expect(localStorage.getItem("rankings-pin-docked")).toBeNull()
	})

	it("counts on the corner tab how many of the top ten moved since the window last showed them", () => {
		act(() => {
			pinRankings("pvp")
			// The last ten seen: id-1 and id-0 swapped, id-10 where id-9 is now.
			markRankingsSeen("pvp", ["id-1", "id-0", "id-2", "id-3", "id-4", "id-5", "id-6", "id-7", "id-8", "id-10"])
		})
		localStorage.setItem("rankings-pin-docked", "retracted")
		resetRankingsPinForTests()
		renderDock()
		expect(screen.getByRole("button", { name: "Open the pinned rankings: PvP · CM 21, 3 moved" })).toHaveTextContent("3")
	})

	it("retracts on Escape from inside the window", async () => {
		act(() => pinRankings("pvp"))
		renderDock()
		fireEvent.keyDown(screen.getByRole("button", { name: "Unpin" }), { key: "Escape" })
		await waitFor(() => expect(screen.queryByRole("complementary")).not.toBeInTheDocument())
	})

	it("floats over the page: fixed, 23rem, no backdrop, not a dialog", () => {
		act(() => pinRankings("guides"))
		renderDock()
		expect(screen.getByRole("complementary")).toHaveClass("fixed", "desktop-nav:w-[23rem]")
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
	})

	it("unpins", () => {
		act(() => pinRankings("guides"))
		renderDock()
		fireEvent.click(screen.getByRole("button", { name: "Unpin" }))
		expect(screen.queryByRole("complementary")).not.toBeInTheDocument()
		expect(localStorage.getItem("rankings-pin")).toBeNull()
	})

	it("stays off the Rankings page and away from anyone without early access", () => {
		act(() => pinRankings("guides"))
		const { container, unmount } = renderDock({ path: "/app/rankings" })
		expect(container).toBeEmptyDOMElement()
		unmount()
		expect(renderDock({ earlyAccess: false }).container).toBeEmptyDOMElement()
	})

	it("shows the first tab for a pin on a tab this reader can't open", () => {
		act(() => pinRankings("pull-plans"))
		renderDock({ editor: false })
		expect(screen.getByRole("complementary", { name: "Rankings: Guides" })).toBeInTheDocument()
	})
})

describe("movedCount", () => {
	it("counts entries not where they were, new ones included, and nothing on a first pin", () => {
		expect(movedCount(["a", "b", "c"], ["b", "a", "c"])).toBe(2)
		expect(movedCount(["a", "b", "c"], ["a", "b", "d"])).toBe(1)
		expect(movedCount(null, ["a", "b"])).toBe(0)
	})
})
