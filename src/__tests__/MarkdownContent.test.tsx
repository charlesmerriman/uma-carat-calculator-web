import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { MarkdownContent } from "../components/info/MarkdownContent"
import { UntrustedTextContext } from "../components/info/untrustedText"

function renderMarkdown(markdown: string) {
	return render(
		<MemoryRouter>
			<MarkdownContent markdown={markdown} />
		</MemoryRouter>,
	)
}

describe("MarkdownContent, a player's text", () => {
	const PLAYER_TEXT = "Read ![pixel](https://tracker.example/p.gif) this [guide](https://elsewhere.example) and [the FAQ](/faq)."

	it("draws no picture and no link, by prop", () => {
		const { container } = render(
			<MemoryRouter>
				<MarkdownContent markdown={PLAYER_TEXT} untrusted />
			</MemoryRouter>
		)
		expect(container.querySelector("img")).toBeNull()
		expect(screen.queryByRole("link")).not.toBeInTheDocument()
		expect(screen.getByText("guide")).toBeInTheDocument()
		expect(screen.getByText("the FAQ")).toBeInTheDocument()
	})

	it("draws no picture and no link inside UntrustedTextContext, and both outside it", () => {
		const { container, unmount } = render(
			<MemoryRouter>
				<UntrustedTextContext.Provider value={true}>
					<MarkdownContent markdown={PLAYER_TEXT} />
				</UntrustedTextContext.Provider>
			</MemoryRouter>
		)
		expect(container.querySelector("img")).toBeNull()
		expect(screen.queryByRole("link")).not.toBeInTheDocument()
		unmount()
		const site = render(
			<MemoryRouter>
				<MarkdownContent markdown={PLAYER_TEXT} />
			</MemoryRouter>
		)
		expect(site.container.querySelector("img")).not.toBeNull()
		expect(screen.getAllByRole("link")).toHaveLength(2)
	})
})

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

	it("turns ==words== into a red <mark>, and leaves a lone = alone", () => {
		const { container } = renderMarkdown("Take ==Stamina 500== first. a = b, and `==code==` stays.")
		const marks = container.querySelectorAll("mark")
		expect(marks).toHaveLength(1)
		expect(marks[0].textContent).toBe("Stamina 500")
		expect(container.textContent).toContain("a = b")
		expect(container.querySelector("code")?.textContent).toBe("==code==")
	})

	it("keeps raw HTML off inside a highlight too", () => {
		// The highlight is built from the syntax tree, so markup inside ==
		// stays text (or is dropped as raw HTML), and never becomes an element.
		const { container } = renderMarkdown("Before ==<script>alert(1)</script>== after")
		expect(container.querySelector("script")).toBeNull()
		expect(container.textContent).toContain("<script>")
	})

	it("hands a [[Skill]] mention to the caller's renderer", () => {
		const { container } = render(
			<MemoryRouter>
				<MarkdownContent
					markdown="Take [[Groundwork]] first."
					renderSkill={(name) => <b data-testid="skill">{name}!</b>}
				/>
			</MemoryRouter>,
		)
		expect(screen.getByTestId("skill").textContent).toBe("Groundwork!")
		expect(container.textContent).toBe("Take Groundwork! first.")
	})

	it("shows a mention's bare name with no renderer, and never turns [[x]](y) into a link", () => {
		const { container } = renderMarkdown("Use [[Updrafters]](FF) late.")
		expect(container.querySelector("a")).toBeNull()
		expect(container.textContent).toBe("Use Updrafters(FF) late.")
	})
})
