/**
 * The Rankings page's "What wins" list (CM Runs, rated by the server per uma
 * and strategy, backend rankings_shares.run_shares): win rates with how much
 * to trust them. Pure.
 *
 * Two floors (owner, 2026-10-28, notes/rankings-redesign-plan.md decision 5),
 * both kept on the server, which never sends a race count:
 *   - SHOWN from 20 races: fewer and a rate is noise, so the row isn't sent.
 *   - RANKED from 100: a 30% from 44 races shouldn't outrank a 26% from 310.
 *     Rows from 20 to 99 races sit under the ranked ones, muted, with no
 *     place number.
 * Each row carries confidence marks: one bar from 20 races, two from 100,
 * three from 300.
 */

import type { WinRateRow } from "../types/rankingsTabs"

export interface WinRates {
	/** 100 races or more, best rate first: the server's order. */
	ranked: WinRateRow[]
	/** From the floor to under 100 races, most races first. */
	unranked: WinRateRow[]
}

export function winRates(rows: WinRateRow[]): WinRates {
	return { ranked: rows.filter((row) => row.ranked), unranked: rows.filter((row) => !row.ranked) }
}
