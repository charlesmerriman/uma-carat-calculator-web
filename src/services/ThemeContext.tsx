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
