import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { Link, MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useScrollReset } from "../hooks/useScrollReset"

/** The window, as far as this hook sees it: a scroll offset, capped by how tall the page is. */
const page = vi.hoisted(() => ({ tallest: 100000 }))

function scrollDocumentTo(top: number) {
	Object.defineProperty(window, "scrollY", { value: Math.min(top, page.tallest), configurable: true })
}

function App() {
	useScrollReset()
	const navigate = useNavigate()
	const { pathname, search } = useLocation()
	return (
		<>
			<p>at {pathname + search}</p>
			<Link to="/timeline">Timeline</Link>
			<Link to="/calculator">Calculator</Link>
			<Link to="/pvp?event=cm-22">CM 22</Link>
			<Link to="/pvp?event=cm-21">CM 21</Link>
			<Link to="/pvp">PvP</Link>
			<Link to="/faq#tickets">FAQ answer</Link>
			<Link to="/timeline?focus=banner-1">A banner</Link>
			<button onClick={() => navigate(-1)}>Back</button>
		</>
	)
}

function show() {
	render(
		<MemoryRouter initialEntries={["/calculator"]}>
			<Routes>
				<Route path="*" element={<App />} />
			</Routes>
		</MemoryRouter>
	)
}

/** The reader scrolling to `top`, as the hook hears it. */
function scrollTo(top: number) {
	act(() => {
		scrollDocumentTo(top)
		window.dispatchEvent(new Event("scroll"))
	})
}

const go = (name: string) => fireEvent.click(screen.getByRole("link", { name }))

beforeEach(() => {
	page.tallest = 100000
	scrollDocumentTo(0)
	vi.stubGlobal("scrollTo", (_x: number, top: number) => scrollDocumentTo(top))
})

// Each test gets its own pages: the hook's memory outlives a render, like a tab.
describe("coming back to a page", () => {
	it("keeps your place through a link back", () => {
		show()
		scrollTo(800)
		go("Timeline")
		expect(window.scrollY).toBe(0)
		scrollTo(300)
		go("Calculator")
		expect(window.scrollY).toBe(800)
		go("Timeline")
		expect(window.scrollY).toBe(300)
	})

	it("waits for a page that lays out late, then stops", async () => {
		show()
		scrollTo(900)
		go("Timeline")
		page.tallest = 200
		go("Calculator")
		expect(window.scrollY).toBe(200)
		page.tallest = 100000
		await waitFor(() => expect(window.scrollY).toBe(900))
	})

	it("never pulls back a reader who moved", async () => {
		show()
		scrollTo(700)
		go("Timeline")
		page.tallest = 200
		go("Calculator")
		fireEvent.wheel(window)
		page.tallest = 100000
		await new Promise((resolve) => setTimeout(resolve, 80))
		expect(window.scrollY).toBe(200)
	})

	it("starts another event's page at the top", () => {
		show()
		go("CM 21")
		scrollTo(500)
		go("Timeline")
		go("CM 22")
		expect(window.scrollY).toBe(0)
	})

	it("keeps the place for the same query, or a plain link to the page", () => {
		show()
		go("CM 21")
		scrollTo(500)
		go("Timeline")
		go("CM 21")
		expect(window.scrollY).toBe(500)
		go("Timeline")
		go("PvP")
		expect(window.scrollY).toBe(500)
	})

	it("leaves a deep link to land itself", () => {
		show()
		go("Timeline")
		scrollTo(600)
		go("Calculator")
		const scrollSpy = vi.fn()
		vi.stubGlobal("scrollTo", scrollSpy)
		go("A banner")
		expect(scrollSpy).not.toHaveBeenCalled()
		go("FAQ answer")
		expect(scrollSpy).not.toHaveBeenCalled()
	})

	it("still goes back to where a history entry was left", () => {
		show()
		scrollTo(400)
		go("Timeline")
		scrollTo(0)
		fireEvent.click(screen.getByRole("button", { name: "Back" }))
		expect(window.scrollY).toBe(400)
	})
})
