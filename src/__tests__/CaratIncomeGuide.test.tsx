import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { vi } from "vitest"
import { CaratIncomeGuide } from "../components/info/CaratIncomeGuide"
import { SiteContentContext } from "../services/SiteContentContext"
import { buildSiteContentValue } from "../services/siteContent"
import SNAPSHOT from "../content/snapshot.json"
import type { SiteContent } from "../types/siteContent"

// Navbar/Footer pull in theme + auth contexts the guide does not need; stub them
// so the test focuses on the rendered document.
vi.mock("../components/navbar/Navbar", () => ({ Navbar: () => null }))
vi.mock("../components/footer/Footer", () => ({ Footer: () => null }))

function renderPage(path = "/guides/carat-income", content: SiteContent | null = SNAPSHOT as SiteContent) {
	return render(
		<SiteContentContext.Provider value={buildSiteContentValue(content)}>
			<MemoryRouter initialEntries={[path]}>
				<CaratIncomeGuide />
			</MemoryRouter>
		</SiteContentContext.Provider>,
	)
}

describe("CaratIncomeGuide page", () => {
	it("renders the row's title as the page heading and sets the tab title", () => {
		renderPage()
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
			"How the Calculator Works Out Your Carats",
		)
		expect(document.title).toBe("Carat Income Guide | Uma Musume Carat Calculator")
	})

	it("shows the subtitle under the heading and the row's date as last updated", () => {
		renderPage()
		expect(screen.getByText(/plain-English guide/)).toBeInTheDocument()
		expect(screen.getByText(/^Last updated: \d{4}\/\d{1,2}\/\d{1,2}$/)).toBeInTheDocument()
	})

	it("shows a loading state, not an empty page, until the content arrives", () => {
		renderPage("/guides/carat-income", null)
		expect(screen.getByRole("status")).toHaveTextContent(/loading the guide/i)
		expect(screen.queryByRole("navigation", { name: /guide sections/i })).toBeNull()
	})

	it("renders the markdown body with its tables and corrected figures", () => {
		const { container } = renderPage()
		// Four GFM tables in the source; without remark-gfm they would render as text.
		expect(container.querySelectorAll("table").length).toBe(4)
		expect(screen.getAllByText(/90 carats a day/).length).toBeGreaterThan(0)
		expect(screen.getAllByText(/White Day/).length).toBeGreaterThan(0)
	})

	it("gives every jump-list pill a heading to land on", () => {
		const { container } = renderPage()
		const pills = screen.getByRole("navigation", { name: /guide sections/i }).querySelectorAll("a")
		expect(pills.length).toBeGreaterThanOrEqual(9)
		for (const pill of pills) {
			const id = pill.getAttribute("href")!.slice(1)
			const target = container.querySelector(`[id="${id}"]`)
			expect(target?.tagName).toBe("H2")
		}
	})
})
