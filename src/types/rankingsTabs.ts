/**
 * GET /rankings/pvp/<kind>/<id> and GET /rankings/players (backend
 * views/rankings.py), the Rankings page's PvP and Players tabs, half-daily.
 *
 * SHARES, NEVER A COUNT OF PEOPLE (owner, 2026-10-28; backend
 * rankings_shares.py): every figure is a share from 0 to 1, rounded to the
 * whole percent, with 0.001 for a sliver under half a percent (the page's
 * "<1%"). The server keeps the counts.
 */

import type { PvpStyle } from "./pvpGuide"

/**
 * A set of teams, as shares (backend rankings_shares.team_shares): umas by
 * their share of the teams (and the share each strategy has), cards by their
 * share of member decks (with the share of those that borrowed it), and the
 * exact three-uma teams built most. Shared by the PvP tab (every saved team)
 * and the PvP page's Rankings view (gallery posts).
 */
export interface TeamSharesData {
	/** `styles`: each strategy's share of every team, so they add up to `share`. */
	umas: Array<{ uma: number; share: number; styles: Partial<Record<string, number>> }>
	/** `borrowed`: of the decks with the card, the share that borrowed it. */
	cards: Array<{ card: number; share: number; borrowed: number }>
	/** Sorted uma id triples, most built first, the top ten. */
	trios?: Array<{ umas: number[]; share: number }>
}

/**
 * One uma and strategy's CM Runs win rate. Only rows over the server's floor
 * (20 races) are sent, in order: the `ranked` ones (100 races and up) best
 * first, then the rest.
 */
export interface WinRateRow {
	uma: number
	style: PvpStyle
	/** Wins over races, 0 to 1. */
	rate: number
	/** How much to trust the rate: 1 (20+ races), 2 (100+), 3 (300+). */
	marks: 1 | 2 | 3
	ranked: boolean
}

export interface PvpRankingsPayload {
	generated_at: string
	/** Every saved team for the event. */
	built: TeamSharesData
	runs: WinRateRow[]
	/**
	 * The lists at the start of the week, ids in rank order, for rank movement
	 * (api #193): `runs` keys are "<uma>-<style>", ranked from 100 races.
	 */
	previous?: { generated_at: string; umas: number[]; cards: number[]; runs: string[] } | null
}

export interface PlayersRankingsPayload {
	generated_at: string
	/** Each of the players who use the calculator. */
	favourites: Array<{ uma: number; share: number }>
	/** Favourite umas in order at the start of the week, for rank movement (api #193). */
	previous?: { generated_at: string; favourites: number[] } | null
	/** `share`: of every player, those who set the rank; a row's, of those who set it. */
	ranks: Array<{ label: string; share: number; rows: Array<{ name: string; share: number }> }>
	/** `default_on`: whether a new account starts with it on. */
	income: Array<{ key: string; label: string; share: number; default_on?: boolean }>
	/**
	 * Per Team Trials class, highest first: the MEDIAN carats held and pulls
	 * planned (null when nobody in it plans). A class of one is never sent.
	 */
	budget?: Array<{ name: string; carats: number | null; pulls: number | null }>
	selectors: Array<{
		campaign: string
		label: string
		/** Of every player, those who plan to buy it. */
		buyers: number
		/** Of the buyers, those who have picked what to take. */
		picked: number
		/** `share`: of those who picked, the ones who picked this. */
		top: Array<{ uma?: number; card?: number; share: number }>
		/** From the campaign's derived dates. */
		status?: "on_sale" | "upcoming" | "past"
		end_date?: string | null
	}>
}
