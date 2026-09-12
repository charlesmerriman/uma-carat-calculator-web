import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { AppRouteIntro } from "../views/AppRouteIntro"

function renderAt(path: string) {
	return render(
		<MemoryRouter initialEntries={[path]}>
			<AppRouteIntro />
		</MemoryRouter>,
	)
}

// The intro sits OUTSIDE ApplicationViews' loading gate, so it — not the routed
// page — owns each /app route's document title. These pin the mapping.
describe("AppRouteIntro", () => {
	it.each([
		["/app", "How to read the calculator", "Calculator | Uma Musume Carat Calculator"],
		["/app/timeline", "How to read the timeline", "Banner Timeline | Uma Musume Carat Calculator"],
		["/app/selectors", "How to read the selector planner", "Selector Tickets | Uma Musume Carat Calculator"],
	])("at %s shows its heading and sets the title", (path, heading, title) => {
		renderAt(path)
		expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(heading)
		expect(document.title).toBe(title)
	})

	it("tolerates a trailing slash", () => {
		renderAt("/app/timeline/")
		expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("How to read the timeline")
	})

	it("links to the guide and the FAQ", () => {
		renderAt("/app")
		expect(screen.getByRole("link", { name: /carat income guide/i })).toHaveAttribute("href", "/guides/carat-income")
		expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "/faq")
	})
})
