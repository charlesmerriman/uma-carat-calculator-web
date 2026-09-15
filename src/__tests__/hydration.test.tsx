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
import type { SiteContent } from "../types/siteContent"

const CONTENT = SNAPSHOT as SiteContent

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

function hydrate(route: string): { recoverable: ReturnType<typeof vi.fn>; errors: string[] } {
	const { html, content } = render(route, CONTENT)
	container.innerHTML = html

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
					<MemoryRouter initialEntries={[route]}>
						<App />
					</MemoryRouter>
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

	it.each(["/", "/about", "/app"])("%s hydrates cleanly with a saved theme and a stored token", (route) => {
		localStorage.setItem("uma-planner-theme", "light")
		localStorage.setItem("uma-planner-colorblind-mode", "true")
		localStorage.setItem("authToken", "a-real-token")

		const { recoverable, errors } = hydrate(route)
		expect(recoverable).not.toHaveBeenCalled()
		expect(errors).toEqual([])
		// The store-driven mount sync applied the saved values without a mismatch.
		expect(document.documentElement.getAttribute("data-theme")).toBe("light")
		expect(document.documentElement.getAttribute("data-colorblind-mode")).toBe("true")
	})
})
