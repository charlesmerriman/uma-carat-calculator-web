import { useEffect, useSyncExternalStore } from "react"
import type { ReactNode } from "react"
import { ThemeContext } from "./ThemeContext"
import {
	THEMES,
	applyThemeAttributes,
	getServerColorblindMode,
	getServerTheme,
	readColorblindMode,
	readTheme,
	subscribeToTheme,
	writeColorblindMode,
	writeTheme,
} from "./themeStore"

/**
 * Exposes the theme settings to React. The settings themselves live in themeStore.ts
 * — see the note there on why they are an external store rather than useState.
 *
 * The visible theme is NOT set here on first load. The inline script in index.html
 * sets the <html> attributes before first paint, from the same storage keys, so a
 * prerendered page never flashes the default palette while the bundle loads. What
 * this component's state drives is the picker's pressed swatch and the toast theme,
 * which are free to catch up a frame later.
 */
export const ThemeProvider = ({ children }: { children: ReactNode }) => {
	const activeTheme = useSyncExternalStore(subscribeToTheme, readTheme, getServerTheme)
	const colorblindMode = useSyncExternalStore(
		subscribeToTheme,
		readColorblindMode,
		getServerColorblindMode,
	)

	// Mount-only sync of the <html> attributes, reading the STORE rather than the
	// React state above. During hydration the state still holds the server
	// snapshot (the default), and writing that would undo the inline script's
	// work for anyone with a saved theme. Reading the store is idempotent with
	// the script, and it is what puts the attributes in place under test, where
	// index.html's script never ran.
	useEffect(() => {
		applyThemeAttributes(readTheme(), readColorblindMode())
	}, [])

	return (
		<ThemeContext.Provider
			value={{
				activeTheme,
				themes: THEMES,
				setTheme: writeTheme,
				colorblindMode,
				setColorblindMode: writeColorblindMode,
			}}
		>
			{children}
		</ThemeContext.Provider>
	)
}
