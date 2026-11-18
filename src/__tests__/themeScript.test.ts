// @vitest-environment node
//
// index.html carries an inline script that sets the theme attributes before first
// paint, and it necessarily duplicates the theme ids and storage keys from
// themeStore.ts (it runs before any module does). This is the drift guard: add a
// theme, or rename a key, and this fails until the script agrees.
import { describe, expect, it } from "vitest"
import html from "../../index.html?raw"
import {
	COLORBLIND_MODE_STORAGE_KEY,
	DEFAULT_DARK_THEME,
	DEFAULT_LIGHT_THEME,
	getThemeMode,
	THEMES,
	THEME_STORAGE_KEY,
} from "../services/themeStore"

const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? ""

describe("the inline theme script in index.html", () => {
	it("exists and runs before anything else in <head>", () => {
		expect(script).toContain("data-theme")
		expect(html.indexOf("<script>")).toBeLessThan(html.indexOf("<title>"))
	})

	it("knows every theme id and the default", () => {
		const listed = script.match(/var themes = \[([^\]]*)\]/)?.[1] ?? ""
		const ids = [...listed.matchAll(/"([^"]+)"/g)].map((match) => match[1])
		expect(ids.sort()).toEqual(THEMES.map((theme) => theme.id).sort())
		expect(script).toContain(`"${DEFAULT_DARK_THEME}"`)
		expect(script).toContain(`"${DEFAULT_LIGHT_THEME}"`)
	})

	it("reads the same storage keys the store writes", () => {
		expect(script).toContain(`"${THEME_STORAGE_KEY}"`)
		expect(script).toContain(`"${COLORBLIND_MODE_STORAGE_KEY}"`)
	})

	/**
	 * Run the repo's inline script with only its three browser dependencies.
	 * `stored` is what localStorage holds for the theme key; `prefersLight` is the
	 * device's colour-scheme answer. Returns the attributes set and what was saved.
	 */
	function runScript(stored: string | null, prefersLight = false) {
		const attributes: Record<string, string> = {}
		const saved: Record<string, string> = {}
		const run = new Function("localStorage", "document", "window", script)
		run(
			{
				getItem: (key: string) => key === THEME_STORAGE_KEY ? stored : "true",
				setItem: (key: string, value: string) => { saved[key] = value },
			},
			{
				documentElement: {
					setAttribute: (name: string, value: string) => { attributes[name] = value },
				},
			},
			{ matchMedia: (query: string) => ({ matches: query.includes("light") && prefersLight }) },
		)
		return { attributes, saved }
	}

	it.each(THEMES)("restores $id and its mode before first paint", (theme) => {
		// A stored choice wins whatever the device prefers, and is never rewritten.
		const { attributes, saved } = runScript(theme.id, theme.mode === "dark")
		expect(attributes).toEqual({
			"data-theme": theme.id,
			"data-theme-mode": theme.mode,
			"data-colorblind-mode": "true",
		})
		expect(saved).toEqual({})
		expect(getThemeMode(theme.id)).toBe(theme.mode)
	})

	it.each([
		{ device: "light", prefersLight: true, expected: DEFAULT_LIGHT_THEME },
		{ device: "dark", prefersLight: false, expected: DEFAULT_DARK_THEME },
	])("gives a first visit on a $device device $expected, and saves it", ({ prefersLight, expected }) => {
		const { attributes, saved } = runScript(null, prefersLight)
		expect(attributes["data-theme"]).toBe(expected)
		expect(attributes["data-theme-mode"]).toBe(getThemeMode(expected))
		expect(saved).toEqual({ [THEME_STORAGE_KEY]: expected })
	})

	it("shows the device default for an id it doesn't know, but keeps it stored", () => {
		// An older cached page may not know a theme someone picked on a newer one.
		const { attributes, saved } = runScript("a-newer-theme", true)
		expect(attributes["data-theme"]).toBe(DEFAULT_LIGHT_THEME)
		expect(saved).toEqual({})
	})
})
