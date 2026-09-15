import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { MarkdownContent } from "../components/info/MarkdownContent"

function renderMarkdown(markdown: string) {
	return render(
		<MemoryRouter>
			<MarkdownContent markdown={markdown} />
		</MemoryRouter>,
	)
}

describe("MarkdownContent", () => {
	it("renders a site-relative link as a router link, with its anchor intact", () => {
		renderMarkdown("See the [FAQ](/faq#do-i-need-an-account).")
		const link = screen.getByRole("link", { name: "FAQ" })
		expect(link).toHaveAttribute("href", "/faq#do-i-need-an-account")
		expect(link).not.toHaveAttribute("target")
	})

	it("opens an external link in a new tab, and leaves mailto alone", () => {
		renderMarkdown("[Sheet](https://example.test/x) or [mail](mailto:a@b.c)")
		expect(screen.getByRole("link", { name: "Sheet" })).toHaveAttribute("target", "_blank")
		expect(screen.getByRole("link", { name: "Sheet" })).toHaveAttribute("rel", "noopener noreferrer")
		expect(screen.getByRole("link", { name: "mail" })).toHaveAttribute("href", "mailto:a@b.c")
		expect(screen.getByRole("link", { name: "mail" })).not.toHaveAttribute("target")
	})

	it("gives a heading the id a jump list would compute for it", () => {
		const { container } = renderMarkdown("## 3. Where the carats come from\n\ntext")
		expect(container.querySelector("h2")).toHaveAttribute("id", "where-the-carats-come-from")
	})

	it("never renders raw HTML from the content", () => {
		const { container } = renderMarkdown('Hello <script>alert(1)</script> <b onclick="x">there</b>')
		expect(container.querySelector("script")).toBeNull()
		expect(container.querySelector("b")).toBeNull()
		expect(container.textContent).toContain("<script>")
	})

	it("renders paragraphs, bold and lists", () => {
		const { container } = renderMarkdown("One **bold**.\n\n- a\n- b")
		expect(container.querySelectorAll("p").length).toBe(1)
		expect(container.querySelector("strong")).toHaveTextContent("bold")
		expect(container.querySelectorAll("li").length).toBe(2)
	})
})
