import { act, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SiteContentProvider } from "../services/SiteContentProvider"
import { useSiteContent } from "../services/SiteContentContext"
import type { SiteContent } from "../types/siteContent"

const ABOUT = { slug: "about" as const, title: "About", meta_description: "d", body: "Baked words", updated_at: "2026-09-15T00:00:00Z" }
const FULL: SiteContent = {
	pages: [ABOUT],
	faq: [{ slug: "c", title: "C", items: [{ slug: "q", question: "Q?", answer: "A", show_on_homepage: true }] }],
}

/** Shows what the provider currently holds, so the assertions can watch it change. */
function Probe() {
	const content = useSiteContent()
	const page = content.page("about")
	const faq = content.faq()
	return (
		<div>
			<span data-testid="about">{page ? page.body : "no page"}</span>
			<span data-testid="faq">{faq ? faq.length : "no faq"}</span>
		</div>
	)
}

let resolveFetch: (value: Response) => void
function jsonResponse(body: unknown, ok = true): Response {
	return { ok, json: async () => body } as Response
}

beforeEach(() => {
	vi.stubGlobal(
		"fetch",
		vi.fn(
			() =>
				new Promise<Response>((resolve) => {
					resolveFetch = resolve
				}),
		),
	)
})

afterEach(() => {
	vi.unstubAllGlobals()
})

describe("SiteContentProvider", () => {
	it("renders the embedded rows first and fills in the rest from the fetch", async () => {
		render(
			<SiteContentProvider initial={{ pages: [ABOUT] }}>
				<Probe />
			</SiteContentProvider>,
		)
		// The first render is the embedded subset, untouched: what hydration needs.
		expect(screen.getByTestId("about")).toHaveTextContent("Baked words")
		expect(screen.getByTestId("faq")).toHaveTextContent("no faq")

		await act(async () => {
			resolveFetch(jsonResponse(FULL))
		})
		expect(screen.getByTestId("faq")).toHaveTextContent("1")
	})

	it("swaps in an edit made since the build", async () => {
		render(
			<SiteContentProvider initial={{ pages: [ABOUT] }}>
				<Probe />
			</SiteContentProvider>,
		)
		await act(async () => {
			resolveFetch(jsonResponse({ ...FULL, pages: [{ ...ABOUT, body: "Edited in the admin" }] }))
		})
		expect(screen.getByTestId("about")).toHaveTextContent("Edited in the admin")
	})

	it("starts empty on the shell and keeps the loading state if the fetch fails", async () => {
		render(
			<SiteContentProvider initial={null}>
				<Probe />
			</SiteContentProvider>,
		)
		expect(screen.getByTestId("about")).toHaveTextContent("no page")
		await act(async () => {
			resolveFetch(jsonResponse({ detail: "down" }, false))
		})
		expect(screen.getByTestId("about")).toHaveTextContent("no page")
	})
})
