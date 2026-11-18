import { useEffect, useId, useRef, useState } from "react"
import { Moon, Palette, Sun } from "lucide-react"
import { useTheme } from "../../services/ThemeContext"
import type { ThemeConfig } from "../../services/ThemeContext"
import { DEFAULT_DARK_THEME, DEFAULT_LIGHT_THEME } from "../../services/themeStore"
import { NAV_ICON_BUTTON, NAV_POPOVER } from "./navStyles"

type Theme = ThemeConfig

// The two columns, dark on the left and light on the right, each led by the
// theme a first visit gets on a device in that mode (themeStore.ts).
const COLUMNS = [
	{ mode: "dark", label: "Dark", Icon: Moon, defaultId: DEFAULT_DARK_THEME },
	{ mode: "light", label: "Light", Icon: Sun, defaultId: DEFAULT_LIGHT_THEME },
] as const

/**
 * One theme's swatch: the theme's surface as a disc with its accent as a dot,
 * so Dark, Gilded and Midnight (all gold accents) can still be told apart.
 * A palette theme splits the dot between its colours (the accent first, then
 * its kinds), which is what marks it as a different kind of theme while
 * keeping every swatch the same shape. Static hexes, not var(--color-brand):
 * every swatch is on screen at once, each showing its own theme.
 */
const Swatch = ({ theme, large = false }: { theme: Theme; large?: boolean }) => {
	const dot = theme.palette
		? `conic-gradient(${theme.palette
			.map((color, i, all) => `${color} ${(i * 360) / all.length}deg ${((i + 1) * 360) / all.length}deg`)
			.join(", ")})`
		: theme.swatch
	return (
		<span
			aria-hidden="true"
			className={`flex shrink-0 items-center justify-center rounded-full border border-gray-500 ${large ? "h-5 w-5" : "h-4 w-4"}`}
			style={{ backgroundColor: theme.canvas }}
		>
			<span className={`rounded-full ${large ? "h-2.5 w-2.5" : "h-2 w-2"}`} style={{ background: dot }} />
		</span>
	)
}

/**
 * The theme list and the colorblind switch: the palette button's panel, on
 * desktop and phones alike (the gear menu carried it on phones until
 * 2026-11-18). `onPicked` closes the panel after a theme is chosen.
 *
 * Laid out as two columns so the split is obvious at a glance: every dark
 * theme on the left, every light one on the right. The two defaults sit on
 * top as larger buttons, and "More themes" lists the rest of each mode, the
 * palette themes first. Every theme is a named row with the same swatch, which
 * replaced four groups that each looked different (owner, 2026-11-18).
 */
const ThemeOptions = ({ onPicked }: { onPicked?: () => void }) => {
	const { activeTheme, themes, setTheme, colorblindMode, setColorblindMode } = useTheme()

	// The rest of a mode's themes, palette themes first, otherwise in THEMES order.
	const moreThemes = (mode: Theme["mode"], defaultId: string) => {
		const rest = themes.filter((theme) => theme.mode === mode && theme.id !== defaultId)
		return [...rest.filter((theme) => theme.palette), ...rest.filter((theme) => !theme.palette)]
	}

	const renderThemeButton = (theme: Theme, large = false) => (
		<button
			key={theme.id}
			type="button"
			onClick={() => { setTheme(theme.id); onPicked?.() }}
			aria-label={`Switch to ${theme.label} theme`}
			aria-pressed={activeTheme === theme.id}
			title={theme.label}
			className={`flex w-full items-center gap-2 rounded-md text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
				large ? "px-2 py-2 text-sm font-medium" : "px-2 py-1.5 text-xs"
			} ${
				activeTheme === theme.id
					? "bg-gray-700 text-gray-100 ring-1 ring-gray-400"
					: "text-gray-300 hover:bg-gray-700 hover:text-gray-100"
			}`}
		>
			<Swatch theme={theme} large={large} />
			<span className="min-w-0 truncate">{theme.label}</span>
		</button>
	)

	// Each half of a row is one column's cell; the right one carries the rule
	// that divides dark from light (broken only by the "More themes" line).
	const cell = (index: number) => (index === 0 ? "pr-1" : "border-l border-gray-700 pl-1")
	const sectionLabel = "text-[10px] font-semibold uppercase tracking-wider text-gray-500"

	return (
		<>
		<div role="group" aria-label="Default themes" className="grid grid-cols-2">
			{COLUMNS.map(({ mode, label, Icon, defaultId }, index) => {
				const theme = themes.find((candidate) => candidate.id === defaultId)
				return (
					<div key={mode} className={`flex flex-col gap-1 ${cell(index)}`}>
						<p className={`flex items-center gap-1 px-2 pt-0.5 ${sectionLabel}`}>
							<Icon aria-hidden="true" className="h-3 w-3" />
							{label}
						</p>
						{theme && renderThemeButton(theme, true)}
					</div>
				)
			})}
		</div>
		<p className={`mt-1 border-t border-gray-700 px-2 pt-2 ${sectionLabel}`}>More themes</p>
		<div className="grid grid-cols-2">
			{COLUMNS.map(({ mode, label, defaultId }, index) => (
				<div key={mode} role="group" aria-label={`More ${label.toLowerCase()} themes`} className={`flex flex-col gap-0.5 ${cell(index)}`}>
					{moreThemes(mode, defaultId).map((theme) => renderThemeButton(theme))}
				</div>
			))}
		</div>
		<div className="mt-1 border-t border-gray-700 pt-1">
			<button
				type="button"
				role="switch"
				aria-checked={colorblindMode}
				onClick={() => setColorblindMode(!colorblindMode)}
				className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-xs text-gray-300 transition hover:bg-gray-700 hover:text-gray-100"
			>
				<span className="font-medium">Colorblind mode</span>
				<span aria-hidden="true" className={`relative h-5 w-9 rounded-full transition ${colorblindMode ? "bg-brand" : "bg-gray-600"}`}>
					<span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${colorblindMode ? "translate-x-4" : "translate-x-0.5"}`} />
				</span>
			</button>
		</div>
		</>
	)
}

export const ThemePicker = () => {
	const [open, setOpen] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)
	const panelId = useId()
	// Close dropdown when clicking outside
	useEffect(() => {
		if (!open) return
		const handlePointerDown = (e: PointerEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setOpen(false)
			}
		}
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setOpen(false)
				containerRef.current?.querySelector<HTMLButtonElement>("button")?.focus()
			}
		}
		document.addEventListener("pointerdown", handlePointerDown)
		document.addEventListener("keydown", handleKeyDown)
		return () => {
			document.removeEventListener("pointerdown", handlePointerDown)
			document.removeEventListener("keydown", handleKeyDown)
		}
	}, [open])

	return (
		<div ref={containerRef} className="relative">
			<button
				type="button"
				onClick={() => setOpen((prev) => !prev)}
				aria-label="Change color theme"
				aria-expanded={open}
				aria-controls={open ? panelId : undefined}
				title="Change color theme"
				className={NAV_ICON_BUTTON}
			>
				<Palette className="h-4 w-4" />
			</button>

			{open && (
				<div id={panelId} className={`${NAV_POPOVER} fixed left-1/2 top-16 z-50 flex max-h-[calc(100dvh-5rem)] w-72 max-w-[calc(100vw-1.5rem)] -translate-x-1/2 flex-col gap-1 overflow-y-auto p-2 desktop-nav:absolute desktop-nav:left-auto desktop-nav:top-full desktop-nav:right-0 desktop-nav:mt-1.5 desktop-nav:translate-x-0`}>
					<ThemeOptions onPicked={() => setOpen(false)} />
				</div>
			)}
		</div>
	)
}
