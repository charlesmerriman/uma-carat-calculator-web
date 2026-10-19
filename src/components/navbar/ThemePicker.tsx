import { useEffect, useId, useRef, useState } from "react"
import { Palette } from "lucide-react"
import { useTheme } from "../../services/ThemeContext"
import { NAV_ICON_BUTTON, NAV_POPOVER } from "./navStyles"

const PRIMARY_THEME_IDS = new Set(["gold", "light"])

export const ThemePicker = () => {
	const { activeTheme, themes, setTheme, colorblindMode, setColorblindMode } = useTheme()
	const [open, setOpen] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)
	const panelId = useId()
	const primaryThemes = themes.filter((theme) => PRIMARY_THEME_IDS.has(theme.id))
	const alternateThemes = themes.filter((theme) => !PRIMARY_THEME_IDS.has(theme.id))

	const renderThemeButton = (theme: typeof themes[number]) => (
		<button
			key={theme.id}
			type="button"
			onClick={() => { setTheme(theme.id); setOpen(false) }}
			aria-label={`Switch to ${theme.label} theme`}
			aria-pressed={activeTheme === theme.id}
			title={theme.label}
			className={`flex items-center rounded-md transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
				PRIMARY_THEME_IDS.has(theme.id) ? "gap-2 px-2 py-1.5 text-xs" : "h-6 w-6 justify-center"
			} ${
				activeTheme === theme.id
					? "bg-gray-700 text-gray-100 ring-1 ring-gray-400"
					: "text-gray-300 hover:bg-gray-700 hover:text-gray-100"
			}`}
		>
			{/* Static hex, not var(--color-brand): all swatches are visible at
			    once. Two-tone, the theme's surface with its accent as a dot, so
			    Dark, Gilded and Midnight (all gold accents) can be told apart. */}
			<span
				aria-hidden="true"
				className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-gray-500"
				style={{ backgroundColor: theme.canvas }}
			>
				<span className="h-2 w-2 rounded-full" style={{ backgroundColor: theme.swatch }} />
			</span>
			{PRIMARY_THEME_IDS.has(theme.id) && theme.label}
		</button>
	)

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
					<p className="px-2 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Primary themes</p>
					<div role="group" aria-label="Primary themes" className="grid grid-cols-2 gap-1">
						{primaryThemes.map(renderThemeButton)}
					</div>
					{(["dark", "light"] as const).map((mode) => (
						<div key={mode} role="group" aria-label={`${mode === "dark" ? "Dark" : "Light"} themes`} className="mt-1 flex items-center justify-between gap-2 border-t border-gray-700 px-2 pt-2">
							<p className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-gray-500">{mode === "dark" ? "Dark themes" : "Light themes"}</p>
							<div className="flex flex-wrap justify-end gap-1">
								{alternateThemes.filter((theme) => theme.mode === mode).map(renderThemeButton)}
							</div>
						</div>
					))}
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
				</div>
			)}
		</div>
	)
}
