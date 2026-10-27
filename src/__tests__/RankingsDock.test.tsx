import { act, fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AuthContext, type AuthContextType } from "../services/AuthContext"
import { RankingsDock } from "../components/rankings/RankingsDock"
import { pinRankings, resetRankingsPinForTests } from "../services/rankingsPinStore"

/**
 * The pinned Rankings panel (RankingsDock + services/rankingsPinStore.ts):
 * who sees it, where, its three states, and that they last on the device.
 * jsdom applies no media queries, so the docked column and the edge tab
 * both render whenever their state says so; the `xl:` classes pick on a
 * real screen.
 */

// The tabs fetch; here only which one the panel shows.
vi.mock("../components/rankings/RankingsSection", () => ({
	RankingsSection: ({ section }: { section: string }) => <div data-testid="section">{section}</div>,
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

	it("docks the pinned tab, remembered on the device", () => {
		act(() => pinRankings("players"))
		renderDock()
		expect(screen.getByRole("complementary", { name: "Rankings: Players" })).toBeInTheDocument()
		expect(screen.getByTestId("section")).toHaveTextContent("players")
		expect(localStorage.getItem("rankings-pin")).toBe("players")
	})

	it("retracts to the edge tab and docks again from it", () => {
		act(() => pinRankings("guides"))
		renderDock()
		fireEvent.click(screen.getByRole("button", { name: "Hide rankings" }))
		expect(screen.queryByRole("complementary")).not.toBeInTheDocument()
		expect(localStorage.getItem("rankings-pin-docked")).toBe("retracted")
		// Two edge tabs: the drawer's (below xl) and the re-dock (from xl).
		const tabs = screen.getAllByRole("button", { name: "Rankings" })
		fireEvent.click(tabs[1])
		expect(screen.getByRole("complementary", { name: "Rankings: Guide rankings" })).toBeInTheDocument()
	})

	it("opens the drawer from the edge tab, and Escape closes it", () => {
		act(() => pinRankings("pvp"))
		renderDock()
		fireEvent.click(screen.getAllByRole("button", { name: "Rankings" })[0])
		expect(screen.getByRole("dialog", { name: "Rankings" })).toBeInTheDocument()
		fireEvent.keyDown(window, { key: "Escape" })
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
	})

	it("switches section from its menu, and unpins", () => {
		act(() => pinRankings("guides"))
		renderDock()
		fireEvent.change(screen.getAllByRole("combobox", { name: "Rankings section" })[0], { target: { value: "pvp" } })
		expect(screen.getByTestId("section")).toHaveTextContent("pvp")
		expect(screen.getByRole("link", { name: "Full page" })).toHaveAttribute("href", "/app/rankings?view=pvp")
		fireEvent.click(screen.getAllByRole("button", { name: "Unpin" })[0])
		expect(screen.queryByTestId("section")).not.toBeInTheDocument()
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
		expect(screen.getByTestId("section")).toHaveTextContent("guides")
	})
})
