import { render } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { AppRouteMeta } from "../views/AppRouteMeta"
import { SiteContentContext } from "../services/SiteContentContext"
import { buildSiteContentValue } from "../services/siteContent"
import type { SiteContent } from "../types/siteContent"
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query"
import { makeQueryClient } from "../services/queryClient"
import { primeEncyclopediaPage } from "../services/encyclopediaQueries"
import ENCYCLOPEDIA_SAMPLE from "../content/encyclopedia-sample.json"

function renderAt(path: string, content: SiteContent | null = null, strict = false, client: QueryClient = makeQueryClient()) {
	return render(
		<QueryClientProvider client={client}>
			<SiteContentContext.Provider value={buildSiteContentValue(content, { strict })}>
				<MemoryRouter initialEntries={[path]}>
					<AppRouteMeta />
				</MemoryRouter>
			</SiteContentContext.Provider>
		</QueryClientProvider>,
	)
}

/** A client already holding one detail page's answer, as the build primes it. */
function primedWith(kind: "uma" | "card" | "skill", gameId: number, data: unknown): QueryClient {
	const client = makeQueryClient()
	primeEncyclopediaPage(client, { kind, gameId }, data)
	return client
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

	it("titles an Encyclopedia page from its payload, the same cache entry the page reads", () => {
		const { uma, card, skill } = ENCYCLOPEDIA_SAMPLE
		renderAt(`/app/umas/${uma.game_id}`, null, false, primedWith("uma", uma.game_id, uma))
		expect(document.title).toBe("Ines Fujin | Uma Musume Carat Calculator")
		expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toMatch(/^Ines Fujin \[Always Electrifying\] is a 3★ Front Runner/)
		renderAt(`/app/cards/${card.game_id}`, null, false, primedWith("card", card.game_id, card))
		expect(document.title).toBe("Ines Fujin [Watch My Star Fly!] | Uma Musume Carat Calculator")
		renderAt(`/app/skills/${skill.game_id}`, null, false, primedWith("skill", skill.game_id, skill))
		expect(document.title).toBe("Right-Handed × (Skill) | Uma Musume Carat Calculator")
	})

	it("lets an Encyclopedia page into search, and one still loading (a page newer than the build)", () => {
		const { uma } = ENCYCLOPEDIA_SAMPLE
		renderAt(`/app/umas/${uma.game_id}`, null, false, primedWith("uma", uma.game_id, uma))
		expect(document.querySelector('meta[name="robots"]')).toBeNull()
		renderAt("/app/skills/123456")
		expect(document.querySelector('meta[name="robots"]')).toBeNull()
	})

	it("says there is no such page, out of search, for an id the API doesn't know", () => {
		renderAt("/app/cards/999999", null, false, primedWith("card", 999999, null))
		expect(document.title).toBe("No such page | Uma Musume Carat Calculator")
		expect(document.querySelector('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow")
	})

	it("renders nothing on the page", () => {
		const { container } = renderAt("/app")
		expect(container).toBeEmptyDOMElement()
	})
})
