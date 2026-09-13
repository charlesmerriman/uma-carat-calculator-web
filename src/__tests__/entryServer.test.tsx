// @vitest-environment node
//
// The build-time render, exercised the way scripts/prerender.mjs exercises it — and in
// the NODE environment on purpose. There is no window, document or localStorage here,
// so this file is the proof that no render path on a public route touches one: a
// future page that reads storage in a useState initialiser fails this test, not the
// deploy.
import { describe, expect, it } from "vitest"
import { PRERENDER_ROUTES, SITE_NAME, SITE_ORIGIN, render } from "../entry-server"

/** Per route: the title the page must report and a phrase its markup must contain. */
const EXPECTED: Record<(typeof PRERENDER_ROUTES)[number], { title: string; phrase: string }> = {
	"/": { title: SITE_NAME, phrase: 'href="/app"' },
	"/about": { title: `About | ${SITE_NAME}`, phrase: "What it does" },
	"/faq": { title: `FAQ | ${SITE_NAME}`, phrase: "Frequently Asked Questions" },
	"/terms": { title: `Terms of Service | ${SITE_NAME}`, phrase: "Terms of Service" },
	"/privacy-policy": { title: `Privacy Policy | ${SITE_NAME}`, phrase: "Privacy Policy" },
	"/changelog": { title: `Changelog | ${SITE_NAME}`, phrase: "Changelog" },
	"/feedback": { title: `Feedback | ${SITE_NAME}`, phrase: "<form" },
	"/guides/carat-income": { title: `Carat Income Guide | ${SITE_NAME}`, phrase: "running balance" },
	// The tool itself renders behind the data gate, so a build-time render of these
	// three is the app shell: navbar, the loading state, footer. The route identity
	// is in the head tags (asserted below), not in the body.
	"/app": { title: `Calculator | ${SITE_NAME}`, phrase: "Loading your plan" },
	"/app/timeline": { title: `Banner Timeline | ${SITE_NAME}`, phrase: "Loading your plan" },
	"/app/selectors": { title: `Selector Tickets | ${SITE_NAME}`, phrase: "Loading your plan" },
}

describe("entry-server render()", () => {
	it("covers every prerendered route in this table", () => {
		expect(Object.keys(EXPECTED).sort()).toEqual([...PRERENDER_ROUTES].sort())
	})

	it.each(PRERENDER_ROUTES)("renders %s with its own head values and real content", (route) => {
		const { html, meta } = render(route)
		const expected = EXPECTED[route]

		expect(meta.title).toBe(expected.title)
		expect(meta.description.length).toBeGreaterThan(40)
		expect(meta.canonical).toBe(`${SITE_ORIGIN}${route}`)
		expect(meta.noindex).toBe(false)

		expect(html).toContain(expected.phrase)
		// Navbar and footer are the frame every public page renders inside.
		expect(html).toContain("<nav")
		expect(html).toContain("</footer>")
	})

	it("renders the guide with its tables, not as escaped text", () => {
		const { html } = render("/guides/carat-income")
		expect((html.match(/<table/g) ?? []).length).toBe(4)
	})

	it("reports noindex for the sign-in page, which is why it is not prerendered", () => {
		expect(render("/login").meta.noindex).toBe(true)
	})

	it("reports noindex for the account page, and renders it as a guest card", () => {
		// Not prerendered for the same reason as /login: a build-time render is
		// a guest, so the static document would never be the page itself.
		const { html, meta } = render("/account")
		expect(meta.noindex).toBe(true)
		expect(html).toContain("not signed in")
	})

	it("renders the 404 page for an unknown path and marks it noindex", () => {
		const { html, meta } = render("/definitely-not-a-page")
		expect(meta.title).toBe(`Page not found | ${SITE_NAME}`)
		expect(meta.noindex).toBe(true)
		expect(html).toContain("Page not found")
	})
})
