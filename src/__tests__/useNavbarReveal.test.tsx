/**
 * On a phone the navbar's wordmark row scrolls away and comes back when the
 * reader scrolls UP (hooks/useNavbarReveal.ts): `--navbar-reveal` on <html>
 * is what the navbar and everything pinned under it read.
 */

import { renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NAVBAR_REVEAL_EVENT, navbarRevealPx, useNavbarReveal } from "../hooks/useNavbarReveal"

let phone = true
const reveal = () => document.documentElement.style.getPropertyValue("--navbar-reveal")

function scrollTo(y: number) {
	Object.defineProperty(window, "scrollY", { configurable: true, value: y })
	window.dispatchEvent(new Event("scroll"))
}

beforeEach(() => {
	phone = true
	scrollTo(0)
	vi.spyOn(window, "matchMedia").mockImplementation(
		(query: string) =>
			({
				get matches() {
					return phone
				},
				media: query,
				addEventListener: () => {},
				removeEventListener: () => {},
			}) as unknown as MediaQueryList,
	)
})

afterEach(() => {
	vi.restoreAllMocks()
})

describe("useNavbarReveal", () => {
	it("brings the row back on the way up, and tucks it away on the way down", () => {
		const { unmount } = renderHook(() => useNavbarReveal())
		const events = vi.fn()
		window.addEventListener(NAVBAR_REVEAL_EVENT, events)

		scrollTo(900)
		expect(navbarRevealPx()).toBe(0)

		scrollTo(860)
		expect(reveal()).toBe("3.5rem")
		expect(navbarRevealPx()).toBe(56)

		scrollTo(1000)
		expect(reveal()).toBe("0px")
		expect(navbarRevealPx()).toBe(0)
		// One event per change, so a pinned row measured in pixels re-measures.
		expect(events).toHaveBeenCalledTimes(2)

		window.removeEventListener(NAVBAR_REVEAL_EVENT, events)
		unmount()
	})

	it("ignores a small move, and lets small moves add up", () => {
		const { unmount } = renderHook(() => useNavbarReveal())
		scrollTo(900)
		scrollTo(895)
		expect(navbarRevealPx()).toBe(0)
		scrollTo(890)
		expect(navbarRevealPx()).toBe(56)
		unmount()
	})

	it("stays out of the way near the top, where the row is on screen anyway", () => {
		const { unmount } = renderHook(() => useNavbarReveal())
		scrollTo(900)
		scrollTo(800)
		expect(navbarRevealPx()).toBe(56)
		scrollTo(40)
		expect(navbarRevealPx()).toBe(0)
		unmount()
	})

	it("does nothing on the desktop layout, which has no such row", () => {
		phone = false
		const { unmount } = renderHook(() => useNavbarReveal())
		scrollTo(900)
		scrollTo(700)
		expect(navbarRevealPx()).toBe(0)
		unmount()
	})

	it("forgets the row on unmount", () => {
		const { unmount } = renderHook(() => useNavbarReveal())
		scrollTo(900)
		scrollTo(800)
		unmount()
		expect(navbarRevealPx()).toBe(0)
		expect(reveal()).toBe("")
	})
})
