/**
 * The shared screen header (components/ScreenHeader.tsx): the header at rest,
 * the compact pinned bar once the masthead has scrolled up under it (and never
 * while the header is itself the bar, the phone's shape), one <h1> a page, and
 * the two kinds of tab (links, and Rankings' buttons).
 *
 * jsdom lays nothing out and reads no stylesheet, so the scrolled state is
 * faked by giving the header and the bar's anchor the boxes a real scroll
 * would give them, and the phone's shape by the computed `position` the
 * stylesheet gives the header there.
 */

import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"
import { CalendarDays, ListOrdered, Trophy, Users } from "lucide-react"
import { ScreenHeader } from "../components/ScreenHeader"

const LINKS = [
	{ to: "/app/timeline", label: "Timeline", icon: CalendarDays },
	{ to: "/app/legend-races", label: "Legend Races", icon: Trophy, ownHeading: true },
]

function renderLinks(path: string) {
	return render(
		<MemoryRouter initialEntries={[path]}>
			<ScreenHeader kind="links" title="Timeline" icon={CalendarDays} label="Timeline" column="max-w-[96rem]" tabs={LINKS} />
		</MemoryRouter>
	)
}

/** A box with only what the header reads. */
const rect = (top: number, height: number) => ({ top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect

/** Places the header `mastTop` px down the window, under a bar anchored at 66px. */
function scrollTo(mastTop: number) {
	vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
		if (this.hasAttribute("data-screen-head")) return rect(mastTop, 120)
		if (this.firstElementChild?.getAttribute("aria-hidden") === "true") return rect(66, 0) // the anchor
		return rect(0, 0)
	})
	act(() => {
		window.dispatchEvent(new Event("scroll"))
	})
}

afterEach(() => {
	vi.restoreAllMocks()
})

describe("ScreenHeader", () => {
	it("is the header alone at rest: the title as the page's heading, one row of tabs", () => {
		renderLinks("/app/timeline")
		expect(screen.getByRole("heading", { level: 1, name: "Timeline" })).toBeInTheDocument()
		// The pinned bar's tabs aren't mounted yet: one set of links, not two.
		expect(screen.getAllByRole("navigation", { name: "Timeline" })).toHaveLength(1)
		expect(document.querySelector("[data-screen-tabs]")?.childElementCount).toBe(0)
	})

	it("drops the heading on a page that draws its own", () => {
		renderLinks("/app/legend-races")
		expect(screen.queryByRole("heading", { level: 1 })).toBeNull()
		expect(screen.getByText("Timeline", { selector: "p" })).toBeInTheDocument()
	})

	it("pins the slim bar once the masthead has gone up under it, and drops it on the way back", () => {
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			callback(0)
			return 0
		})
		renderLinks("/app/legend-races")
		// Still in sight below the bar: the masthead is what shows.
		scrollTo(80)
		expect(screen.getAllByRole("navigation", { name: "Timeline" })).toHaveLength(1)
		// Its bottom (−60 + 120 = 60) is above the bar's line at 66.
		scrollTo(-60)
		expect(document.querySelector("[data-screen-tabs]")?.childElementCount).toBe(1)
		const [, pinned] = screen.getAllByRole("navigation", { name: "Timeline" })
		expect(within(pinned).getByRole("link", { name: "Legend Races" })).toHaveAttribute("aria-current", "page")
		scrollTo(0)
		expect(screen.getAllByRole("navigation", { name: "Timeline" })).toHaveLength(1)
	})

	it("never pins a second row while the header is itself the bar", () => {
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			callback(0)
			return 0
		})
		// The phone's shape: the stylesheet makes the header sticky.
		const real = window.getComputedStyle.bind(window)
		vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
			const style = real(element, pseudo)
			return element.hasAttribute("data-screen-head") ? ({ ...style, position: "sticky" } as CSSStyleDeclaration) : style
		})
		renderLinks("/app/timeline")
		// Stuck at the bar's line (66px), 44px tall: its bottom is on the line the
		// compact bar would show at, which is exactly when it must not.
		scrollTo(66)
		expect(screen.getAllByRole("navigation", { name: "Timeline" })).toHaveLength(1)
		expect(document.querySelector("[data-screen-tabs]")?.childElementCount).toBe(0)
		// The hover cards keep below it while it is the bar.
		expect(document.querySelector("[data-screen-head]")).toHaveAttribute("data-popup-top-bar")
	})

	it("is not a top bar for the hover cards while it is the masthead", () => {
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			callback(0)
			return 0
		})
		renderLinks("/app/timeline")
		scrollTo(80)
		expect(document.querySelector("[data-screen-head]")).not.toHaveAttribute("data-popup-top-bar")
	})

	it("has a plain marker at the top for Back to top, ahead of the header", () => {
		renderLinks("/app/timeline")
		const top = document.querySelector("[data-screen-top]")
		const head = document.querySelector("[data-screen-head]")
		expect(top).not.toBeNull()
		expect(top!.compareDocumentPosition(head!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
	})

	it("draws a page's views as tabs that report the one picked, its badge as a chip after the name", () => {
		const onSelect = vi.fn()
		render(
			<MemoryRouter>
				<ScreenHeader
					kind="buttons"
					title="Rankings"
					icon={ListOrdered}
					label="Rankings"
					column="max-w-[76rem]"
					tabs={[
						{ id: "guides", label: "Guides", icon: ListOrdered, badge: "51" },
						{ id: "players", label: "Players", icon: Users },
					]}
					active="guides"
					onSelect={onSelect}
				/>
			</MemoryRouter>
		)
		// The badge is decoration: the tab's name is its label alone.
		expect(screen.getByRole("tab", { name: "Guides", selected: true })).toHaveTextContent("51")
		fireEvent.click(screen.getByRole("tab", { name: "Players" }))
		expect(onSelect).toHaveBeenCalledWith("players")
	})
})
