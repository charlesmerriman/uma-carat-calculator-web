/**
 * The navbar's places (navbar/navPlaces.ts) and the Timeline screen's bar
 * (timeline/TimelineTabs.tsx): who gets which place, which place a page lights,
 * and that Legend Races lives under Timeline instead of holding a tab of its own.
 */

import { render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { NAV_PLACES, navPlacesFor } from "../components/navbar/navPlaces"
import { TimelineTabs } from "../components/timeline/TimelineTabs"
import { isTimelineScreen } from "../components/timeline/timelineTabs"

/** The place a path lights, by id; null when it is none of them. */
const placeFor = (pathname: string) => NAV_PLACES.find((place) => place.isOpen(pathname))?.id ?? null

describe("navPlaces", () => {
	it("gives everyone four places, and early access Rankings as the fifth", () => {
		expect(navPlacesFor({ earlyAccess: false }).map((place) => place.label)).toEqual(["Calculator", "Timeline", "PvP", "Encyclopedia"])
		expect(navPlacesFor({ earlyAccess: true }).map((place) => place.label)).toEqual(["Calculator", "Timeline", "PvP", "Encyclopedia", "Rankings"])
	})

	it("keeps a place lit on every page inside it", () => {
		// The Calculator screen's three pages, and the Timeline screen's two.
		for (const path of ["/app", "/app/selectors", "/app/plans"]) expect(placeFor(path), path).toBe("calculator")
		for (const path of ["/app/timeline", "/app/legend-races"]) expect(placeFor(path), path).toBe("timeline")
		expect(placeFor("/app/pvp")).toBe("pvp")
		for (const path of ["/app/umas", "/app/cards/30001", "/app/skills"]) expect(placeFor(path), path).toBe("encyclopedia")
		expect(placeFor("/app/rankings")).toBe("rankings")
	})

	it("lights nothing outside the places, and never two at once", () => {
		for (const path of ["/", "/faq", "/account", "/app/collection", "/app/Ab3dE6gH"]) expect(placeFor(path), path).toBeNull()
		for (const path of ["/app", "/app/selectors", "/app/timeline", "/app/legend-races", "/app/pvp", "/app/umas", "/app/rankings"]) {
			expect(NAV_PLACES.filter((place) => place.isOpen(path)), path).toHaveLength(1)
		}
	})

	it("sends each place to a page that lights it", () => {
		for (const place of NAV_PLACES) expect(place.isOpen(place.to), place.id).toBe(true)
	})
})

describe("TimelineTabs", () => {
	function renderTabs(path: string) {
		render(
			<MemoryRouter initialEntries={[path]}>
				<TimelineTabs />
			</MemoryRouter>
		)
		return within(screen.getByRole("navigation", { name: "Timeline" }))
	}

	it("offers the Timeline and Legend Races, and lights the open one only", () => {
		const bar = renderTabs("/app/legend-races")
		expect(bar.getByRole("link", { name: "Timeline" })).toHaveAttribute("href", "/app/timeline")
		expect(bar.getByRole("link", { name: "Legend Races" })).toHaveAttribute("href", "/app/legend-races")
		expect(bar.getByRole("link", { name: "Legend Races" })).toHaveAttribute("aria-current", "page")
		expect(bar.getByRole("link", { name: "Timeline" })).not.toHaveAttribute("aria-current")
	})

	it("carries the hook the scroll padding keys off at rest, so a deep link lands below the bar", () => {
		// index.css: html:has([data-screen-tabs]) and [data-app-scroller]:has([data-screen-tabs]).
		renderTabs("/app/timeline")
		expect(document.querySelector("[data-screen-tabs]")).not.toBeNull()
	})

	it("gives the Timeline the masthead's heading, and leaves Legend Races its own", () => {
		renderTabs("/app/timeline")
		expect(screen.getByRole("heading", { level: 1, name: "Timeline" })).toBeInTheDocument()
	})
})

describe("isTimelineScreen", () => {
	it("is the Timeline and Legend Races, with or without a trailing slash", () => {
		for (const path of ["/app/timeline", "/app/timeline/", "/app/legend-races", "/app/legend-races/"]) {
			expect(isTimelineScreen(path), path).toBe(true)
		}
		for (const path of ["/app", "/app/selectors", "/app/pvp", "/", "/app/timeline/extra"]) {
			expect(isTimelineScreen(path), path).toBe(false)
		}
	})
})
