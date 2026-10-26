/**
 * A player's logged results for one CM / LoH event (the PvP page's CM Runs view).
 *
 * Mirrors backend/calculatorapi/views/pvp_run.py; shapes and refusals in
 * backend/docs/api-reference.md ("/pvp-runs"). Account only: a guest has no
 * device copy, so there is no local form of a run.
 */

import type { MemberStyle } from "./pvpTeam"
import type { PvpEventKind } from "../utils/pvpEvent"

/** One of the three umas that ran a ticket, copied from a team when logged. */
export interface PvpRunRunner {
	/** 0..2. */
	position: number
	uma: number
	style: MemberStyle
	/** The veteran that ran (the Collection page), or null/absent. */
	trained_uma?: number | null
}

/**
 * One race and who won it. `winner` is the spot (a runner's position) of the
 * player's uma that finished first, or null for a loss. A race that is not in
 * a run's list has not been run yet, which is not the same as a loss.
 */
export interface PvpRunRace {
	/** 1..5 on a day's ticket, 1 in the final. */
	race: number
	winner: number | null
}

export type PvpFinalsGroup = "" | "A" | "B"

/** What a PUT sends: the whole ticket as it should be. */
export interface PvpRunContent {
	runners: PvpRunRunner[]
	races: PvpRunRace[]
	/** The final only. */
	finals_group: PvpFinalsGroup
	/** The final only: 1..3, or null when not entered. */
	placement: number | null
	note: string
}

/** One run as the server sends it. */
export interface PvpRun extends PvpRunContent {
	kind: PvpEventKind
	event: number
	stage: "day" | "final"
	/** Set for a day's ticket, null for the final. */
	day: number | null
	ticket: number | null
	updated_at: string
}

/** Where a run lives in its event: a day's ticket, or the final. */
export type PvpRunSlot = { stage: "day"; day: number; ticket: number } | { stage: "final" }
