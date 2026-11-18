// The store's half of the first-visit rule (index.html's script is the other
// half, tested in themeScript.test.ts): no saved theme follows the device and is
// saved on mount, and a saved theme is never replaced.
import { afterEach, describe, expect, it, vi } from "vitest"
import {
	DEFAULT_DARK_THEME,
	DEFAULT_LIGHT_THEME,
	THEME_STORAGE_KEY,
	readTheme,
	saveFirstVisitTheme,
} from "../services/themeStore"

/** Stand in for the device's colour-scheme setting (jsdom has no matchMedia). */
function preferLight(light: boolean) {
	vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("light") && light }))
}

afterEach(() => {
	vi.unstubAllGlobals()
	localStorage.clear()
})

describe("the first-visit theme", () => {
	it.each([
		{ light: true, expected: DEFAULT_LIGHT_THEME },
		{ light: false, expected: DEFAULT_DARK_THEME },
	])("follows the device (light: $light) and is saved", ({ light, expected }) => {
		preferLight(light)
		expect(readTheme()).toBe(expected)
		saveFirstVisitTheme()
		expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe(expected)
		// Saved, so a later change of device setting no longer moves it.
		preferLight(!light)
		expect(readTheme()).toBe(expected)
	})

	it("never replaces a theme someone already has", () => {
		localStorage.setItem(THEME_STORAGE_KEY, "light")
		preferLight(false)
		saveFirstVisitTheme()
		expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light")
		expect(readTheme()).toBe("light")
	})

	it("keeps an id this build doesn't know in storage", () => {
		localStorage.setItem(THEME_STORAGE_KEY, "a-newer-theme")
		preferLight(true)
		expect(readTheme()).toBe(DEFAULT_LIGHT_THEME)
		saveFirstVisitTheme()
		expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("a-newer-theme")
	})

	it("falls back to Dark with no matchMedia at all", () => {
		expect(readTheme()).toBe(DEFAULT_DARK_THEME)
	})
})
