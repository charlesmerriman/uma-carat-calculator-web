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
// AND the id to the inline script in index.html (a test fails until you do).
export const THEMES: ThemeConfig[] = [
	{ id: "gold",     label: "Default",  swatch: "#E6D28A" },
	{ id: "gilded",   label: "Gilded",   swatch: "#f1cf75" },
	{ id: "midnight", label: "Midnight", swatch: "#F6C84F" },
	{ id: "race-day", label: "Pace",     swatch: "#7cc8ff" },
	{ id: "violet",   label: "Violet",   swatch: "#C4B5FD" },
	{ id: "teal",     label: "Teal",     swatch: "#5EEAD4" },
	{ id: "light",    label: "Light",    swatch: "#fbf2ed" },
]

export function isThemeId(id: string | null): id is string {
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

/** The two attributes index.css keys its palettes off. */
export function applyThemeAttributes(theme: string, colorblindMode: boolean): void {
	document.documentElement.setAttribute("data-theme", theme)
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
