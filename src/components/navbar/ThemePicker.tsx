import { useEffect, useRef, useState } from "react"
import { Palette } from "lucide-react"
import { useTheme } from "../../services/ThemeContext"
import { NAV_ICON_BUTTON, NAV_POPOVER } from "./navStyles"

const PRIMARY_THEME_IDS = new Set(["gold", "light"])

export const ThemePicker = () => {
	const { activeTheme, themes, setTheme, colorblindMode, setColorblindMode } = useTheme()
	const [open, setOpen] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)
	const primaryThemes = themes.filter((theme) => PRIMARY_THEME_IDS.has(theme.id))
	const alternateThemes = themes.filter((theme) => !PRIMARY_THEME_IDS.has(theme.id))

	const renderThemeButton = (theme: typeof themes[number]) => (
		<button
			key={theme.id}
			onClick={() => { setTheme(theme.id); setOpen(false) }}
			aria-label={`Switch to ${theme.label} theme`}
			aria-pressed={activeTheme === theme.id}
			className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition ${
				activeTheme === theme.id
					? "bg-gray-700 text-gray-100"
					: "text-gray-300 hover:bg-gray-700 hover:text-gray-100"
			}`}
		>
			{/* Static hex, not var(--color-brand) — all swatches visible at once */}
			<span
				className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/20"
				style={{ backgroundColor: theme.swatch }}
			/>
			{theme.label}
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
		document.addEventListener("pointerdown", handlePointerDown)
		return () => document.removeEventListener("pointerdown", handlePointerDown)
	}, [open])

	return (
		<div ref={containerRef} className="relative">
			<button
				onClick={() => setOpen((prev) => !prev)}
				aria-label="Change color theme"
				title="Change color theme"
				className={NAV_ICON_BUTTON}
			>
				<Palette className="h-4 w-4" />
			</button>

			{open && (
				<div className={`${NAV_POPOVER} absolute right-0 top-full z-50 mt-1.5 flex min-w-44 flex-col gap-1 p-2`}>
					<p className="px-2 pt-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">Primary themes</p>
					<div className="grid grid-cols-2 gap-1">
						{primaryThemes.map(renderThemeButton)}
					</div>
					<div className="mt-1 flex items-center justify-between border-t border-gray-700 px-2 pt-2">
						<p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">More themes</p>
						<div className="flex gap-1">
							{alternateThemes.map((theme) => (
								<button
									key={theme.id}
									onClick={() => { setTheme(theme.id); setOpen(false) }}
									aria-label={`Switch to ${theme.label} theme`}
									aria-pressed={activeTheme === theme.id}
									title={theme.label}
									className={`flex h-6 w-6 items-center justify-center rounded-md transition ${
										activeTheme === theme.id ? "bg-gray-700 ring-1 ring-gray-400" : "hover:bg-gray-700"
									}`}
								>
									<span className="h-3.5 w-3.5 rounded-full border border-white/20" style={{ backgroundColor: theme.swatch }} />
								</button>
							))}
						</div>
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
				</div>
			)}
		</div>
	)
}
