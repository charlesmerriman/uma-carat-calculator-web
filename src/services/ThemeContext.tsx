import { createContext, useContext } from "react"

export interface ThemeConfig {
	id: string
	label: string
	mode: "dark" | "light"
	// Static hex — NOT a CSS var. All swatches render simultaneously, so each must
	// show its own color regardless of which theme is currently active on documentElement.
	swatch: string
	/** The theme's main surface, drawn behind the swatch dot. Static hex, same reason. */
	canvas: string
	/**
	 * Set on a theme that uses several colours with meanings of their own (its
	 * kind colours, its accent) where the others keep to one. The picker lists
	 * these in a group of their own and draws one dot per colour, since a single
	 * accent dot would hide what makes them different. Static hexes, same reason.
	 */
	palette?: string[]
}

export interface ThemeContextType {
	activeTheme: string
	themes: ThemeConfig[]
	setTheme: (id: string) => void
	colorblindMode: boolean
	setColorblindMode: (enabled: boolean) => void
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const useTheme = (): ThemeContextType => {
	const context = useContext(ThemeContext)
	if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider")
	return context
}
