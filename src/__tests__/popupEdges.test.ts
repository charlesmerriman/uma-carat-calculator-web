import { afterEach, describe, expect, it } from "vitest"
import { popupEdges } from "../components/pvp/hoverPopup"

/** Where the popups stop at the top: below the bars pinned there (board "Skills Pop-Up Clipping into the Top Menus"). */

function bar(attribute: string, top: number, bottom: number): HTMLElement {
	const element = document.createElement("div")
	element.setAttribute(attribute, "")
	element.getBoundingClientRect = () => ({ top, bottom, height: bottom - top, left: 0, right: 390, width: 390, x: 0, y: top, toJSON: () => ({}) })
	document.body.append(element)
	return element
}

afterEach(() => {
	document.body.innerHTML = ""
})

describe("popupEdges", () => {
	it("keeps 8px from the window's top with no bars", () => {
		expect(popupEdges().top).toBe(8)
	})

	it("stops below the navbar and a screen bar stacked under it", () => {
		bar("data-sticky-navbar", 0, 65)
		bar("data-screen-tabs", 65, 103)
		expect(popupEdges().top).toBe(111)
	})

	it("starts the stack at the navbar even with the phone's wordmark row shown above it", () => {
		// The wordmark row (0 to 56) isn't marked; the places row under it is.
		bar("data-sticky-navbar", 56, 122)
		bar("data-screen-tabs", 122, 160)
		expect(popupEdges().top).toBe(168)
	})

	it("ignores a bar further down the page that hasn't pinned yet", () => {
		bar("data-sticky-navbar", 0, 65)
		bar("data-popup-top-bar", 300, 360)
		expect(popupEdges().top).toBe(73)
	})
})
