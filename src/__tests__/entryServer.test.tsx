// @vitest-environment node
//
// The build-time render, exercised the way scripts/prerender.mjs exercises it — and in
// the NODE environment on purpose. There is no window, document or localStorage here,
// so this file is the proof that no render path on a public route touches one: a
// future page that reads storage in a useState initialiser fails this test, not the
// deploy.
import { describe, expect, it } from "vitest"
import { PRERENDER_ROUTES, SITE_NAME, SITE_ORIGIN, render } from "../entry-server"
import SNAPSHOT from "../content/snapshot.json"
import type { SiteContent } from "../types/siteContent"

// The committed copy of /site-content, which is what CI's build prerenders from too.
const CONTENT = SNAPSHOT as SiteContent

/** Per route: the title the page must report and a phrase its markup must contain. */
const EXPECTED: Record<(typeof PRERENDER_ROUTES)[number], { title: string; phrase: string }> = {
	"/": { title: SITE_NAME, phrase: 'href="/app"' },
	"/about": { title: `About | ${SITE_NAME}`, phrase: "What it does" },
	"/faq": { title: `FAQ | ${SITE_NAME}`, phrase: "Frequently Asked Questions" },
	"/terms": { title: `Terms of Service | ${SITE_NAME}`, phrase: "Terms of Service" },
	"/privacy-policy": { title: `Privacy Policy | ${SITE_NAME}`, phrase: "Privacy Policy" },
	"/changelog": { title: `Changelog | ${SITE_NAME}`, phrase: "Changelog" },
	"/feedback": { title: `Feedback | ${SITE_NAME}`, phrase: "Open our Discord" },
	// The tool itself renders behind the data gate, so a build-time render of these
	// four is the app shell: navbar, the loading state, footer. The route identity
	// is in the head tags (asserted below), not in the body.
	"/app": { title: `Calculator | ${SITE_NAME}`, phrase: "Loading your plan" },
	"/app/timeline": { title: `Banner Timeline | ${SITE_NAME}`, phrase: "Loading your plan" },
	"/app/selectors": { title: `Selector Tickets | ${SITE_NAME}`, phrase: "Loading your plan" },
	// The title is the admin page row's (snapshot.json carries the seed's).
	"/app/legend-races": { title: `Daily Legend Races | ${SITE_NAME}`, phrase: "Loading your plan" },
	"/app/pvp": { title: `PvP Guides | ${SITE_NAME}`, phrase: "Loading your plan" },
}

describe("entry-server render()", () => {
	it("covers every prerendered route in this table", () => {
		expect(Object.keys(EXPECTED).sort()).toEqual([...PRERENDER_ROUTES].sort())
	})

	it.each(PRERENDER_ROUTES)("renders %s with its own head values and real content", (route) => {
		const { html, meta } = render(route, CONTENT)
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

	it("reports noindex for the sign-in page, which is why it is not prerendered", () => {
		expect(render("/login", CONTENT).meta.noindex).toBe(true)
	})

	it("reports noindex for the account page, and renders it as a guest card", () => {
		// Not prerendered for the same reason as /login: a build-time render is
		// a guest, so the static document would never be the page itself.
		const { html, meta } = render("/account", CONTENT)
		expect(meta.noindex).toBe(true)
		expect(html).toContain("not signed in")
	})

	it("renders the 404 page for an unknown path and marks it noindex", () => {
		const { html, meta } = render("/definitely-not-a-page", CONTENT)
		expect(meta.title).toBe(`Page not found | ${SITE_NAME}`)
		expect(meta.noindex).toBe(true)
		expect(html).toContain("Page not found")
	})

	it("renders a shared plan's link in the app frame, noindex, never prerendered", () => {
		// The card itself sits behind the data gate like the tabs, so a render
		// here is the frame. The id is per plan, so no build can list it.
		const { html, meta } = render("/app/AbCd1234", CONTENT)
		expect(meta.title).toBe(`Shared plan | ${SITE_NAME}`)
		expect(meta.noindex).toBe(true)
		expect(html).toContain("Loading your plan")
		expect(PRERENDER_ROUTES).not.toContain("/app/AbCd1234")
	})

	it("renders the 404 page for an /app path that is not a share id", () => {
		const { html, meta } = render("/app/not-an-id", CONTENT)
		expect(meta.title).toBe(`Page not found | ${SITE_NAME}`)
		expect(html).toContain("Page not found")
	})

	describe("the content each document embeds", () => {
		it("is the About row alone for /about", () => {
			const { content } = render("/about", CONTENT)
			expect(content.pages?.map((page) => page.slug)).toEqual(["about"])
			expect(content.faq).toBeUndefined()
		})

		it("is the FAQ alone for /faq and for the homepage teaser", () => {
			for (const route of ["/faq", "/"]) {
				const { content } = render(route, CONTENT)
				expect(content.pages).toBeUndefined()
				expect(content.faq).toEqual(CONTENT.faq)
			}
		})

		it("is the legend races row alone for its tab, which reads it for its head tags", () => {
			const { content } = render("/app/legend-races", CONTENT)
			expect(content.pages?.map((page) => page.slug)).toEqual(["daily-legend-races"])
			expect(content.faq).toBeUndefined()
		})

		it("is nothing for a page that reads no content", () => {
			expect(render("/terms", CONTENT).content).toEqual({})
			expect(render("/app", CONTENT).content).toEqual({})
		})
	})

	it("fails the build rather than baking a loading state when a page's row is missing", () => {
		const withoutAbout: SiteContent = { ...CONTENT, pages: CONTENT.pages!.filter((page) => page.slug !== "about") }
		expect(() => render("/about", withoutAbout)).toThrow(/no page "about"/)
		expect(() => render("/faq", { pages: CONTENT.pages })).toThrow(/no FAQ/)
	})

	it("still builds the legend races tab from an API that lacks its row", () => {
		// The one optional read: the first build after the page ships fetches
		// /site-content from the API it is replacing. See AppRouteMeta.
		const withoutIt: SiteContent = {
			...CONTENT,
			pages: CONTENT.pages!.filter((page) => page.slug !== "daily-legend-races"),
		}
		const { meta, content } = render("/app/legend-races", withoutIt)
		expect(meta.title).toBe(`Daily Legend Races | ${SITE_NAME}`)
		expect(content).toEqual({})
	})

	it("bakes the admin's words, not a copy in the bundle", () => {
		const edited: SiteContent = {
			...CONTENT,
			pages: CONTENT.pages!.map((page) =>
				page.slug === "about" ? { ...page, body: "Words typed in the admin.\n" } : page,
			),
		}
		expect(render("/about", edited).html).toContain("Words typed in the admin.")
	})
})
