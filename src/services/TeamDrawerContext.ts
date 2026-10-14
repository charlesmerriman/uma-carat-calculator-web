/**
 * The team drawer's open state, shared by the navbar's Team button and the
 * drawer AppShell mounts. Split from its provider, like AuthContext.
 *
 * Outside /app there is no provider, and the button renders nothing: the
 * drawer belongs to the planner pages, the way SettingsMenu does.
 */

import { createContext, useContext } from "react"

export interface TeamDrawerContextType {
	open: boolean
	setOpen: (open: boolean) => void
	/**
	 * False on the PvP page's My team view, where the full builder already
	 * shows the team: the button hides and the drawer stays shut there.
	 */
	available: boolean
}

export const TeamDrawerContext = createContext<TeamDrawerContextType | undefined>(undefined)

/** The drawer state, or undefined outside /app. */
export const useTeamDrawer = (): TeamDrawerContextType | undefined => useContext(TeamDrawerContext)

/** The My team view of the PvP page, where the drawer stands aside. */
export function isMyTeamView(pathname: string, search: string): boolean {
	return pathname.replace(/\/+$/, "") === "/app/pvp" && new URLSearchParams(search).get("view") === "team"
}

/** Hand focus back to the navbar's Team button (whichever copy is on screen). */
export function focusTeamDrawerButton(): void {
	const buttons = document.querySelectorAll<HTMLButtonElement>("[data-team-drawer-button]")
	// The navbar renders its controls twice (mobile and desktop rows), one
	// hidden by CSS; a hidden one has no offsetParent.
	for (const button of buttons) {
		if (button.offsetParent !== null) {
			button.focus()
			return
		}
	}
}
