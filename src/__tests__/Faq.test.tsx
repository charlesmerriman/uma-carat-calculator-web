import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it, vi } from "vitest"
import { Faq } from "../components/info/Faq"
import { SiteContentContext } from "../services/SiteContentContext"
import { buildSiteContentValue } from "../services/siteContent"
import SNAPSHOT from "../content/snapshot.json"
import type { SiteContent } from "../types/siteContent"

vi.mock("../components/navbar/Navbar", () => ({ Navbar: () => null }))
vi.mock("../components/footer/Footer", () => ({ Footer: () => null }))
// `toast` is called as a function (the fallback) AND has `.success`.
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn() }) }))

function renderPage(content: SiteContent | null) {
	return render(
		<SiteContentContext.Provider value={buildSiteContentValue(content)}>
			<MemoryRouter initialEntries={["/faq"]}>
				<Faq />
			</MemoryRouter>
		</SiteContentContext.Provider>,
	)
}

describe("Faq page", () => {
	it("renders every category as a section with its questions, anchored by slug", () => {
		const { container } = renderPage(SNAPSHOT as SiteContent)
		const faq = (SNAPSHOT as SiteContent).faq!
		for (const category of faq) {
			const section = container.querySelector(`section#${category.slug}`)
			expect(section, category.slug).not.toBeNull()
			for (const item of category.items) {
				expect(container.querySelector(`article#${item.slug}`), item.slug).not.toBeNull()
			}
		}
		expect(screen.getAllByRole("heading", { level: 3 }).length).toBe(faq.flatMap((c) => c.items).length)
	})

	it("renders an answer's markdown, links included", () => {
		renderPage(SNAPSHOT as SiteContent)
		expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy-policy")
	})

	it("copies a question's /help/<slug> link, which unfurls as that question", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined)
		Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
		renderPage(SNAPSHOT as SiteContent)
		const item = (SNAPSHOT as SiteContent).faq![0].items[0]

		await userEvent.click(screen.getByRole("button", { name: `Copy link to ${item.question}` }))

		// The API answers it (backend views/faq_share.py), then sends people on to /faq#<slug>.
		expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/help/${item.slug}`)
		expect(toast.success).toHaveBeenCalledWith("Link copied.")
	})

	it("shows a loading state until the content arrives", () => {
		renderPage(null)
		expect(screen.getByRole("status")).toHaveTextContent(/loading the questions/i)
		expect(screen.queryByRole("navigation", { name: /faq sections/i })).toBeNull()
	})
})
