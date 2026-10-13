/**
 * The PvP teams context and its hook, split from the provider (the
 * AuthContext / AuthProvider shape: fast refresh keeps state only when a
 * module exports components alone).
 */

import { createContext, useContext } from "react"
import type { PvpNote, PvpTeam, PvpTeamContent, PvpTeamMember } from "../types/pvpTeam"
import type { PvpEventRef } from "../utils/pvpEvent"

/**
 * Where the teams are in their life:
 *   idle     nothing has asked for them yet (nothing is fetched on /app load)
 *   loading  the first read is out (an account's GET, plus the device import)
 *   ready    `teams` is the truth
 *   error    an account's teams didn't load; the builder says so
 */
export type PvpTeamsStatus = "idle" | "loading" | "ready" | "error"

/**
 * The save line under the grid. A guest's teams save as they change, so a
 * guest only ever sees "saved" (or "error" when the browser refused).
 */
export type PvpTeamsSaveState = "idle" | "pending" | "saving" | "saved" | "error"

export interface PvpTeamsContextType {
	status: PvpTeamsStatus
	/** Latched at the first load: "guest" saves to the device, "account" to the server. */
	mode: "guest" | "account" | null
	/** Every team, every event, oldest first. */
	teams: PvpTeam[]
	saveState: PvpTeamsSaveState
	/** Load the teams if nothing has yet. Cheap to call on every render path. */
	ensureLoaded: () => void
	/**
	 * A new team for an event, on screen at once. Returns its key, or null at
	 * the per-event cap. An account's team is created on the server in the
	 * background; edits made before that returns are saved once it does.
	 */
	createTeam: (ref: PvpEventRef, content?: Partial<PvpTeamContent>) => string | null
	/** Change a team's members and/or notes. Saved after a short pause. */
	editTeam: (key: string, changes: { members?: PvpTeamMember[]; notes?: PvpNote[] }) => void
	renameTeam: (key: string, name: string) => void
	/** Pin a team as the focus, or `null` to unpin whichever is pinned. */
	pinTeam: (key: string | null) => void
	deleteTeam: (key: string) => void
}

export const PvpTeamsContext = createContext<PvpTeamsContextType | undefined>(undefined)

export const usePvpTeams = (): PvpTeamsContextType => {
	const context = useContext(PvpTeamsContext)
	if (context === undefined) throw new Error("usePvpTeams must be used within a PvpTeamsProvider")
	return context
}
