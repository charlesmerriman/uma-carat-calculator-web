/**
 * The theme and colour-blind settings as an external store.
 *
 * WHY A STORE AND NOT useState INITIALISERS
 *
 * ThemeProvider used to read localStorage inside its `useState` initialisers and set
 * the <html> attributes there too. That ran at render time, which was fine while every
 * render happened in a browser. Public routes are now prerendered in Node at build time
 * (src/entry-server.tsx), where there is no localStorage and no document, and a render
 * that touches either simply throws.
 *
 * `useSyncExternalStore` is React's answer: the provider reads `readTheme` in the
 * browser and `getServerTheme` during a server render or a hydration, so the markup
 * both sides produce is the same. What the user actually SEES before React loads is
 * handled by the inline script in index.html, which sets the same two attributes from
 * the same two keys before first paint. That script is the one deliberate duplicate
 * of the values below; themeScript.test.ts holds them together.
 *
 * Keeping the reads and writes here, outside React, also means the mount-time
 * attribute sync in the provider reads the STORE and never writes a default over a
 * stored choice.
 */
import type { ThemeConfig } from "./ThemeContext"

export const THEME_STORAGE_KEY = "uma-planner-theme"
export const COLORBLIND_MODE_STORAGE_KEY = "uma-planner-colorblind-mode"
export const DEFAULT_THEME = "gold"

// To add a new theme: add one entry here, a [data-theme="x"] block in index.css,
// AND the id/mode to the inline script in index.html (a test fails until you do).
//
// `swatch` is the theme's accent (its --color-brand) and `canvas` the surface it
// is mostly seen on: gray-800, the card colour, on a dark theme, where the
// near-black gray-900s are too alike to tell apart at 16px; gray-900, the page
// canvas, on a light one, where gray-800 is white on almost every palette. The
// picker draws the canvas as a disc with the accent as a dot in it, so themes
// that share an accent (Dark, Gilded and Midnight are all gold) still differ.
export const THEMES: ThemeConfig[] = [
	{ id: "gold",           label: "Dark",     mode: "dark",  swatch: "#E6D28A", canvas: "#1a1a22" },
	{ id: "gilded",         label: "Gilded",   mode: "dark",  swatch: "#f2b544", canvas: "#261b10" },
	{ id: "midnight",       label: "Midnight", mode: "dark",  swatch: "#F6C84F", canvas: "#101f33" },
	{ id: "race-day",       label: "Pace",     mode: "dark",  swatch: "#7cc8ff", canvas: "#101d2b" },
	{ id: "violet",         label: "Violet",   mode: "dark",  swatch: "#C4B5FD", canvas: "#17132d" },
	{ id: "teal",           label: "Teal",     mode: "dark",  swatch: "#5EEAD4", canvas: "#0d292a" },
	{ id: "light",          label: "Light",    mode: "light", swatch: "#9a5d12", canvas: "#fbf2ed" },
	{ id: "light-blue",     label: "Blue",     mode: "light", swatch: "#1d4ed8", canvas: "#f1f5f9" },
	{ id: "light-green",    label: "Green",    mode: "light", swatch: "#166534", canvas: "#f1f7f3" },
	{ id: "light-red",      label: "Red",      mode: "light", swatch: "#b91c1c", canvas: "#fcf4f5" },
	{ id: "light-lilac",    label: "Purple",   mode: "light", swatch: "#6d28d9", canvas: "#f7f4fc" },
	{ id: "light-pearl",    label: "Pearl",    mode: "light", swatch: "#292524", canvas: "#f8f7f5" },
]

export function getThemeMode(id: string): ThemeConfig["mode"] {
	return THEMES.find((theme) => theme.id === id)?.mode ?? "dark"
}

function isThemeId(id: string | null): id is string {
	return id !== null && THEMES.some((theme) => theme.id === id)
}

type Listener = () => void
const listeners = new Set<Listener>()

function notify(): void {
	for (const listener of listeners) listener()
}

/** Subscribe to either setting changing. Returns the unsubscribe function. */
export function subscribeToTheme(listener: Listener): () => void {
	listeners.add(listener)
	return () => {
		listeners.delete(listener)
	}
}

/** A storage read that cannot throw: a blocked or absent localStorage reads as unset. */
function readKey(key: string): string | null {
	try {
		return localStorage.getItem(key)
	} catch {
		return null
	}
}

/** The stored theme id, or the default when nothing valid is stored. */
export function readTheme(): string {
	const stored = readKey(THEME_STORAGE_KEY)
	return isThemeId(stored) ? stored : DEFAULT_THEME
}

export function readColorblindMode(): boolean {
	return readKey(COLORBLIND_MODE_STORAGE_KEY) === "true"
}

/** What a server render and a hydration render use, so both sides agree. */
export function getServerTheme(): string {
	return DEFAULT_THEME
}

export function getServerColorblindMode(): boolean {
	return false
}

/** The palette, shared light/dark treatment, and independent status-color mode. */
export function applyThemeAttributes(theme: string, colorblindMode: boolean): void {
	document.documentElement.setAttribute("data-theme", theme)
	document.documentElement.setAttribute("data-theme-mode", getThemeMode(theme))
	document.documentElement.setAttribute("data-colorblind-mode", String(colorblindMode))
}

export function writeTheme(id: string): void {
	if (!isThemeId(id)) return
	localStorage.setItem(THEME_STORAGE_KEY, id)
	applyThemeAttributes(id, readColorblindMode())
	notify()
}

export function writeColorblindMode(enabled: boolean): void {
	localStorage.setItem(COLORBLIND_MODE_STORAGE_KEY, String(enabled))
	applyThemeAttributes(readTheme(), enabled)
	notify()
}
