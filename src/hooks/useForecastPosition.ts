import { useEffect, useState } from "react"

/** localStorage: where the chart sits, "top" or "bottom". Absent means bottom. */
const POSITION_STORAGE_KEY = "uma-planner-forecast-position"

/** Above the planner rows, or below them (the default). */
export type ForecastPosition = "top" | "bottom"

/**
 * Where the chart sits, remembered per device, and the switch that moves it.
 *
 * Lives in the calculator page, not in the chart: the chart renders in one of
 * two slots there (above the rows or below them), so the page is what has to
 * know. Bottom by default (owner, 2026-10-19): the rows are what a visitor
 * came to edit, and the chart summarises them.
 *
 * `justMoved` is true only after the viewer pressed the button in this visit.
 * Moving remounts the chart in its other slot, which can be a long way down
 * the sheet, so the chart scrolls itself into view then and only then.
 */
export function useForecastPosition() {
	const [position, setPosition] = useState<ForecastPosition>("bottom")
	const [justMoved, setJustMoved] = useState(false)
	// Read in an effect, never in the initialiser: /app is prerendered.
	useEffect(() => {
		try {
			// eslint-disable-next-line react-hooks/set-state-in-effect -- storage only exists after mount, as in TeamDrawerProvider
			if (localStorage.getItem(POSITION_STORAGE_KEY) === "top") setPosition("top")
		} catch {
			// Storage blocked: the default slot.
		}
	}, [])
	const move = () => {
		setPosition((was) => {
			const next: ForecastPosition = was === "top" ? "bottom" : "top"
			try {
				localStorage.setItem(POSITION_STORAGE_KEY, next)
			} catch {
				// Not remembered this time; the move itself still happens.
			}
			return next
		})
		setJustMoved(true)
	}
	return { position, justMoved, move }
}
