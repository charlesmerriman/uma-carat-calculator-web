import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom"
import { beforeAll, describe, expect, it, vi } from "vitest"
import SearchPalette from "../components/search/SearchPalette"
import { SiteSearchDialog } from "../components/search/SiteSearch"
import { useSiteSearch } from "../hooks/useSiteSearch"

/**
 * The palette's own part: it loads on opening, the keyboard reaches a result,
 * and a skill opens in place. The matching is siteSearch.test.ts.
 */

const CALCULATOR = {
	banner_uma_data: [{ id: 1, name: "B", banner_timeline: { id: 90, end_date: "2099-01-01T00:00:00Z" }, umas: [{ id: 41, name: "Kitasan Black", image: "/k.png" }] }],
	banner_support_data: [],
	banner_step_up_data: [],
	champions_meeting_data: [],
	league_of_heroes_event_data: [],
	scenario_data: [],
	anniversary_event_data: [],
}
const CATALOGUE = {
	umas: [{ id: 41, name: "Kitasan Black", skills: [{ skill: 7 }] }],
	support_cards: [],
	skills: [{ id: 7, name: "Groundwork", description: "Speed up early on.", image: null }],
}

vi.mock("../services/AuthContext", () => ({ useAccount: () => ({ account: null }) }))
vi.mock("../services/CalculatorContext", () => ({ useCalculatorDataSafe: () => null }))
vi.mock("../hooks/useOshiIds", () => ({ useOshiIds: () => new Set() }))
vi.mock("../services/calculatorFetchCalls", () => ({ readCalculatorCatalogue: () => Promise.resolve(CALCULATOR) }))
vi.mock("../services/pvpTeamFetchCalls", () => ({ loadPvpCatalogue: () => Promise.resolve(CATALOGUE) }))

beforeAll(() => {
	// jsdom has no layout, and cmdk measures its list.
	vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
})

function Where() {
	const location = useLocation()
	return <p>at {location.pathname + location.search}</p>
}

const show = (onClose = vi.fn()) => {
	render(
		<MemoryRouter initialEntries={["/"]}>
			<SearchPalette onClose={onClose} />
			<Routes>
				<Route path="*" element={<Where />} />
			</Routes>
		</MemoryRouter>
	)
	return onClose
}

const box = () => screen.getByPlaceholderText("Umas, cards, skills, events, pages")

describe("SearchPalette", () => {
	it("lists the pages before anything is typed", () => {
		show()
		expect(screen.getByText("Calculator")).toBeTruthy()
		expect(screen.getByText("FAQ")).toBeTruthy()
	})

	it("goes to a result with Enter", async () => {
		const onClose = show()
		fireEvent.change(box(), { target: { value: "kitsan" } })
		expect(await screen.findByText("Kitasan Black")).toBeTruthy()
		fireEvent.keyDown(box(), { key: "Enter" })
		expect(await screen.findByText("at /app/timeline?focus=banner-90")).toBeTruthy()
		expect(onClose).toHaveBeenCalled()
	})

	it("opens a skill in place, with who teaches it", async () => {
		const onClose = show()
		fireEvent.change(box(), { target: { value: "groundwork" } })
		fireEvent.click(await screen.findByText("Groundwork"))
		expect(await screen.findByText("Speed up early on.")).toBeTruthy()
		expect(screen.getByText("Kitasan Black")).toBeTruthy()
		expect(onClose).not.toHaveBeenCalled()
	})
})

describe("Ctrl+K", () => {
	function Harness() {
		const { open, setOpen } = useSiteSearch()
		return (
			<MemoryRouter>
				<SiteSearchDialog open={open} onClose={() => setOpen(false)} />
			</MemoryRouter>
		)
	}

	it("opens the palette from anywhere, and only with the modifier", async () => {
		render(<Harness />)
		fireEvent.keyDown(document, { key: "k" })
		expect(screen.queryByPlaceholderText("Umas, cards, skills, events, pages")).toBeNull()
		fireEvent.keyDown(document, { key: "k", ctrlKey: true })
		expect(await screen.findByPlaceholderText("Umas, cards, skills, events, pages")).toBeTruthy()
	})
})
