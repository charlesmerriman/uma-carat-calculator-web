import { render } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { AppRouteMeta } from "../views/AppRouteMeta"
import { SiteContentContext } from "../services/SiteContentContext"
import { buildSiteContentValue } from "../services/siteContent"
import type { SiteContent } from "../types/siteContent"

function renderAt(path: string, content: SiteContent | null = null, strict = false) {
	return render(
		<SiteContentContext.Provider value={buildSiteContentValue(content, { strict })}>
			<MemoryRouter initialEntries={[path]}>
				<AppRouteMeta />
			</MemoryRouter>
		</SiteContentContext.Provider>,
	)
}

const LEGEND_RACES_PAGE: SiteContent = {
	pages: [
		{
			slug: "daily-legend-races",
			title: "Legend Race Schedule",
			meta_description: "Written in the admin.",
			body: "Intro.",
			updated_at: "2026-10-05T00:00:00Z",
		},
	],
}

// It sits OUTSIDE ApplicationViews' loading gate, so it — not the routed page —
// owns each /app route's document title. These pin the mapping.
describe("AppRouteMeta", () => {
	it.each([
		["/app", "Calculator | Uma Musume Carat Calculator"],
		["/app/timeline", "Banner Timeline | Uma Musume Carat Calculator"],
		["/app/selectors", "Selector Tickets | Uma Musume Carat Calculator"],
	])("at %s sets the title", (path, title) => {
		renderAt(path)
		expect(document.title).toBe(title)
	})

	it("tolerates a trailing slash", () => {
		renderAt("/app/timeline/")
		expect(document.title).toBe("Banner Timeline | Uma Musume Carat Calculator")
	})

	it("takes the legend races title from the admin page row", () => {
		renderAt("/app/legend-races", LEGEND_RACES_PAGE)
		expect(document.title).toBe("Legend Race Schedule | Uma Musume Carat Calculator")
	})

	it("falls back to its own legend races title, even in a strict build", () => {
		// The first build after the page ships reads an API that lacks the row.
		renderAt("/app/legend-races", { pages: [] }, true)
		expect(document.title).toBe("Daily Legend Races | Uma Musume Carat Calculator")
	})

	it("gives a shared plan's link its own title, kept out of search", () => {
		renderAt("/app/AbCd1234")
		expect(document.title).toBe("Shared plan | Uma Musume Carat Calculator")
		expect(document.querySelector('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow")
	})

	it("never mistakes a tab for a share id", () => {
		// "timeline" is eight letters, the shape of an id.
		renderAt("/app/timeline")
		expect(document.title).toBe("Banner Timeline | Uma Musume Carat Calculator")
		expect(document.querySelector('meta[name="robots"]')).toBeNull()
	})

	it("renders nothing on the page", () => {
		const { container } = renderAt("/app")
		expect(container).toBeEmptyDOMElement()
	})
})
