/**
 * The shared screen header (components/ScreenHeader.tsx): the masthead at
 * rest, the slim pinned bar once the masthead has scrolled up under it, one
 * <h1> a page, and the two kinds of tab (links, and Rankings' buttons).
 *
 * jsdom lays nothing out, so the scrolled state is faked by giving the
 * masthead and the bar's anchor the boxes a real scroll would give them.
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
			<ScreenHeader kind="links" title="Timeline" icon={CalendarDays} description="One line." label="Timeline" column="max-w-[96rem]" tabs={LINKS} />
		</MemoryRouter>
	)
}

/** A box with only what the header reads. */
const rect = (top: number, height: number) => ({ top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect

/** Places the masthead `mastTop` px down the window, under a bar anchored at 66px. */
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
	it("is the masthead at rest: the title as the page's heading, the line, one row of tabs", () => {
		renderLinks("/app/timeline")
		expect(screen.getByRole("heading", { level: 1, name: "Timeline" })).toBeInTheDocument()
		expect(screen.getByText("One line.")).toBeInTheDocument()
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

	it("draws a page's views as tabs that report the one picked, its badge as the lead", () => {
		const onSelect = vi.fn()
		render(
			<MemoryRouter>
				<ScreenHeader
					kind="buttons"
					title="Rankings"
					icon={ListOrdered}
					description="One line."
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
