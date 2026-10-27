/**
 * GET /rankings/pvp/<kind>/<id> and GET /rankings/players (backend
 * views/rankings.py), the Rankings page's PvP and Players tabs, hourly.
 */

import type { PvpStyle } from "./pvpGuide"
import type { TeamCountsData } from "../components/rankings/TeamCounts"

export interface RunResultRow {
	uma: number
	style: PvpStyle
	/** Races she ran (every race of her ticket with a result). */
	races: number
	wins: number
}

export interface PvpRankingsPayload {
	generated_at: string
	/** Every saved team for the event, counted. */
	built: TeamCountsData
	runs: {
		/** People with a logged result. */
		players: number
		races: number
		/** Under this many races a win rate is noise and isn't shown. */
		min_races: number
		rows: RunResultRow[]
	}
}

export interface PlayersRankingsPayload {
	generated_at: string
	/** Accounts that use the calculator: the income panel's denominator. */
	engaged: number
	favourites: Array<{ uma: number; people: number }>
	ranks: Array<{ label: string; people: number; rows: Array<{ name: string; people: number }> }>
	income: Array<{ key: string; label: string; people: number }>
	selectors: Array<{
		campaign: string
		label: string
		buyers: number
		picked: number
		top: Array<{ uma?: number; card?: number; people: number }>
	}>
}
