/**
 * Does the client tree hydrate the build-time markup without React throwing it away?
 *
 * A prerendered page is only worth having if React can attach to it. When the client
 * renders something different from the server — a component reading localStorage in
 * an initialiser, a date computed at render — React 19 recovers by discarding the
 * server markup and re-rendering from scratch, and reports it through
 * `onRecoverableError`. This test renders every public route the way the build does,
 * hydrates it the way main.tsx does, and fails on any such report — including with a
 * saved theme and a stored token, the two per-user values the markup must not depend
 * on.
 *
 * The site content follows the same path as in production: the build renders with the
 * whole response, the document embeds the subset that page read, and the client
 * hydrates from that subset. Hydrating from `rendered.content` rather than the whole
 * snapshot is what proves the subset is enough.
 */
import { act } from "@testing-library/react"
import { hydrateRoot } from "react-dom/client"
import type { Root } from "react-dom/client"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import App from "../App"
import { PRERENDER_ROUTES, render } from "../entry-server"
import { SiteContentProvider } from "../services/SiteContentProvider"
import SNAPSHOT from "../content/snapshot.json"
import ENCYCLOPEDIA_SAMPLE from "../content/encyclopedia-sample.json"
import type { SiteContent } from "../types/siteContent"
import type { QueryClient } from "@tanstack/react-query"
import { PrimedQueryClientContext, makeQueryClient } from "../services/queryClient"
import { primeEncyclopediaPage } from "../services/encyclopediaQueries"
import { encyclopediaPageOf } from "../utils/encyclopediaRoutes"

const CONTENT = SNAPSHOT as SiteContent
// One live page of each kind (npm run content:pull).
const DETAIL_PAGES = [
	{ route: `/app/umas/${ENCYCLOPEDIA_SAMPLE.uma.game_id}`, data: ENCYCLOPEDIA_SAMPLE.uma },
	{ route: `/app/cards/${ENCYCLOPEDIA_SAMPLE.card.game_id}`, data: ENCYCLOPEDIA_SAMPLE.card },
	{ route: `/app/skills/${ENCYCLOPEDIA_SAMPLE.skill.game_id}`, data: ENCYCLOPEDIA_SAMPLE.skill },
]

let roots: Root[] = []
let container: HTMLDivElement

beforeEach(() => {
	localStorage.clear()
	// Mounting fires the pages' data fetches. Never resolving keeps every route in the
	// state the server rendered it in, which is also the state hydration must match.
	vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})))
	container = document.createElement("div")
	document.body.appendChild(container)
})

afterEach(() => {
	act(() => roots.forEach((root) => root.unmount()))
	roots = []
	container.remove()
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
})

/**
 * @param pageData An Encyclopedia detail page's payload: the build renders with
 *   it, and the client primes its cache with the same copy before hydrating
 *   (stale, as main.tsx will, so it refetches after), the way a built document
 *   will carry it (notes/encyclopedia-open-plan.md, PR 4).
 */
function hydrate(route: string, pageData?: unknown): { recoverable: ReturnType<typeof vi.fn>; errors: string[] } {
	const { html, content } = render(route, CONTENT, pageData)
	container.innerHTML = html

	const page = encyclopediaPageOf(route)
	let primed: QueryClient | null = null
	if (page?.gameId != null && pageData !== undefined) {
		primed = makeQueryClient()
		primeEncyclopediaPage(primed, { kind: page.kind, gameId: page.gameId }, pageData, { updatedAt: 0 })
	}

	const errors: string[] = []
	vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
		errors.push(args.map(String).join(" "))
	})
	const recoverable = vi.fn()

	act(() => {
		roots.push(
			hydrateRoot(
				container,
				<SiteContentProvider initial={content}>
					<PrimedQueryClientContext.Provider value={primed}>
						<MemoryRouter initialEntries={[route]}>
							<App />
						</MemoryRouter>
					</PrimedQueryClientContext.Provider>
				</SiteContentProvider>,
				{ onRecoverableError: recoverable },
			),
		)
	})
	return { recoverable, errors: errors.filter((line) => /hydrat|did not match|server/i.test(line)) }
}

describe("hydrating the prerendered markup", () => {
	it.each(PRERENDER_ROUTES)("%s hydrates cleanly as a guest with the default theme", (route) => {
		const { recoverable, errors } = hydrate(route)
		expect(recoverable).not.toHaveBeenCalled()
		expect(errors).toEqual([])
	})

	it.each(DETAIL_PAGES)("$route hydrates cleanly from its payload", ({ route, data }) => {
		const { recoverable, errors } = hydrate(route, data)
		expect(recoverable).not.toHaveBeenCalled()
		expect(errors).toEqual([])
		expect(container.querySelector("h1")).not.toBeNull()
	})

	it.each(DETAIL_PAGES)("$route hydrates cleanly with a saved theme and a stored token", async ({ route, data }) => {
		// Signed in, the page adds what you own once the Collection loads, after hydration.
		localStorage.setItem("uma-planner-theme", "light")
		localStorage.setItem("authToken", "a-real-token")
		const { recoverable, errors } = hydrate(route, data)
		expect(recoverable).not.toHaveBeenCalled()
		expect(errors).toEqual([])
		// The query cache tells React about a change on a timer, so let it run.
		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 20))
		})
		// Still the page after hydration: the token is read after the first
		// render, and a sign-in change resets the query cache, which would
		// throw the primed page away and leave its skeleton (fetch never answers here).
		expect(container.querySelector("h1")?.textContent).toBe(data.name)
	})

	it.each([
		{ route: "/", theme: "light" },
		{ route: "/about", theme: "light" },
		{ route: "/app", theme: "light" },
		{ route: "/app", theme: "light-green" },
	])("$route hydrates cleanly with saved $theme and a stored token", ({ route, theme }) => {
		localStorage.setItem("uma-planner-theme", theme)
		localStorage.setItem("uma-planner-colorblind-mode", "true")
		localStorage.setItem("authToken", "a-real-token")

		const { recoverable, errors } = hydrate(route)
		expect(recoverable).not.toHaveBeenCalled()
		expect(errors).toEqual([])
		// The store-driven mount sync applied the saved values without a mismatch.
		expect(document.documentElement.getAttribute("data-theme")).toBe(theme)
		expect(document.documentElement.getAttribute("data-theme-mode")).toBe("light")
		expect(document.documentElement.getAttribute("data-colorblind-mode")).toBe("true")
	})
})
