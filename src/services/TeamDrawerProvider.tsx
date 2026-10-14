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
 * back on the next page. It is also false for anyone the PvP page is still
 * closed to (early access, hooks/usePvpAccess.ts): no Team button, no drawer.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { useLocation } from "react-router-dom"
import { TeamDrawerContext, isMyTeamView, type TeamDrawerContextType } from "./TeamDrawerContext"
import { usePvpAccess } from "../hooks/usePvpAccess"

const STORAGE_KEY = "uma-planner-team-drawer"

export function TeamDrawerProvider({ children }: { children: ReactNode }) {
	const location = useLocation()
	const access = usePvpAccess()
	const [open, setOpenState] = useState(false)

	useEffect(() => {
		try {
			// eslint-disable-next-line react-hooks/set-state-in-effect -- storage only exists after mount; see the header
			if (localStorage.getItem(STORAGE_KEY) === "open") setOpenState(true)
		} catch {
			// Storage blocked: the drawer starts shut.
		}
	}, [])

	const value = useMemo<TeamDrawerContextType>(
		() => ({
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
			available: access === "open" && !isMyTeamView(location.pathname, location.search),
		}),
		[open, access, location.pathname, location.search]
	)

	return <TeamDrawerContext.Provider value={value}>{children}</TeamDrawerContext.Provider>
}
