/**
 * GET /rankings/pvp/<kind>/<id> and GET /rankings/players (backend
 * views/rankings.py), the Rankings page's PvP and Players tabs, hourly.
 */

import type { PvpStyle } from "./pvpGuide"

/**
 * A set of teams the server counted (views/rankings.count_teams): umas by
 * teams with her (with the strategies they run her on), cards by member
 * decks (the borrowed card included and counted apart), and the exact
 * three-uma teams built most. Shared by the PvP tab (every saved team) and
 * the PvP page's Rankings view (gallery posts).
 */
export interface TeamCountsData {
	/** Teams counted: an uma's share is out of this. */
	teams: number
	/** Members' decks counted: a card's share is out of this. */
	decks: number
	umas: Array<{ uma: number; teams: number; styles: Partial<Record<string, number>> }>
	cards: Array<{ card: number; decks: number; borrows: number }>
	/** Sorted uma id triples, most built first, the top ten. Optional: a payload from before api #192 has none. */
	trios?: Array<{ umas: number[]; teams: number }>
}

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
	/** `default_on`: whether a new account starts with it on (api #192; absent before). */
	income: Array<{ key: string; label: string; people: number; default_on?: boolean }>
	/**
	 * Per Team Trials class, highest first: people, and the MEDIAN carats held
	 * and pulls planned (null when nobody in it plans). A class of one is never
	 * sent. Absent before api #192.
	 */
	budget?: Array<{ name: string; people: number; carats: number | null; pulls: number | null }>
	selectors: Array<{
		campaign: string
		label: string
		buyers: number
		picked: number
		top: Array<{ uma?: number; card?: number; people: number }>
		/** From the campaign's derived dates (api #192; absent before). */
		status?: "on_sale" | "upcoming" | "past"
		end_date?: string | null
	}>
}
