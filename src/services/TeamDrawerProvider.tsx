/**
 * Owns the team drawer's open state for everything under /app.
 *
 * Remembered per device (localStorage `uma-planner-team-drawer`), read in an
 * effect, never during render: AppShell renders at build time for the
 * prerendered /app page, where there is no storage, and the first client
 * render has to match it. So the drawer starts shut and opens a frame later
 * for someone who left it open.
 *
 * `available` is false on the PvP page's My team view (?view=team), where the
 * builder already shows the team; the open state is kept, so the drawer comes
 * back on the next page. For anyone the PvP page is still locked to (early
 * access, hooks/usePvpAccess.ts) it is true only while the open CM, the one
 * event they can build a team for (lockedTeamEvents), has not ended; the
 * window then shows that event alone. Never while the account or the
 * calculator data is loading, which is also how the prerendered page has it,
 * so the clock is read only after load.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useLocation } from "react-router-dom"
import { TeamDrawerContext, isMyTeamView, type TeamDrawerContextType } from "./TeamDrawerContext"
import { lockedTeamEvents, usePvpAccess } from "../hooks/usePvpAccess"
import { useCalculatorData } from "./CalculatorContext"
import { hasEnded, raceEventsInOrder } from "../utils/pvpGuide"

const STORAGE_KEY = "uma-planner-team-drawer"

export function TeamDrawerProvider({ children }: { children: ReactNode }) {
	const location = useLocation()
	const access = usePvpAccess()
	const { championsMeetingData, leagueOfHeroesData, isLoading } = useCalculatorData()
	const [open, setOpenState] = useState(false)

	useEffect(() => {
		try {
			// eslint-disable-next-line react-hooks/set-state-in-effect -- storage only exists after mount; see the header
			if (localStorage.getItem(STORAGE_KEY) === "open") setOpenState(true)
		} catch {
			// Storage blocked: the drawer starts shut.
		}
	}, [])

	const value = useMemo<TeamDrawerContextType>(() => {
		const allowed =
			access === "open" ||
			(access === "locked" &&
				!isLoading &&
				lockedTeamEvents(raceEventsInOrder(championsMeetingData, leagueOfHeroesData)).some(
					(event) => !hasEnded(event, new Date())
				))
		return {
			open,
			setOpen: (next: boolean) => {
				setOpenState(next)
				try {
					if (next) localStorage.setItem(STORAGE_KEY, "open")
					else localStorage.removeItem(STORAGE_KEY)
				} catch {
					// A convenience only.
				}
			},
			available: allowed && !isMyTeamView(location.pathname, location.search),
		}
	}, [open, access, isLoading, championsMeetingData, leagueOfHeroesData, location.pathname, location.search])

	return <TeamDrawerContext.Provider value={value}>{children}</TeamDrawerContext.Provider>
}
