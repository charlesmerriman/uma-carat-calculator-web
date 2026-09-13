import { render } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { AppRouteMeta } from "../views/AppRouteMeta"

function renderAt(path: string) {
	return render(
		<MemoryRouter initialEntries={[path]}>
			<AppRouteMeta />
		</MemoryRouter>,
	)
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

	it("renders nothing on the page", () => {
		const { container } = renderAt("/app")
		expect(container).toBeEmptyDOMElement()
	})
})
