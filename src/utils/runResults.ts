/**
 * The Rankings page's "What wins" list (CM Runs, totalled by the server per
 * uma and strategy): win rates with how much to trust them. Pure.
 *
 * Two floors (owner, 2026-10-28, notes/rankings-redesign-plan.md decision 5):
 *   - SHOWN from the server's `min_races` (20): fewer races and a rate is
 *     noise, so the row isn't sent to the screen at all.
 *   - RANKED from RANKED_RACES (100): a 30% from 44 races shouldn't outrank
 *     a 26% from 310. Rows from 20 to 99 races sit under the ranked ones,
 *     muted, ordered by races, with no place number.
 * Each row carries confidence marks: one bar from 20 races, two from 100,
 * three from 300.
 */

import type { RunResultRow } from "../types/rankingsTabs"

/** Races before a win rate takes a place in the ranking. */
export const RANKED_RACES = 100
/** Races for three confidence marks. */
const SOLID_RACES = 300

export interface WinRateRow extends RunResultRow {
	/** wins / races, 0 to 1. */
	rate: number
	/** How much to trust the rate: 1 (20+ races), 2 (100+), 3 (300+). */
	marks: 1 | 2 | 3
}

export interface WinRates {
	/** RANKED_RACES or more, best rate first, more races breaking a tie. */
	ranked: WinRateRow[]
	/** From `minRaces` to under RANKED_RACES, most races first. */
	unranked: WinRateRow[]
}

export function winRates(rows: RunResultRow[], minRaces: number, rankedRaces: number = RANKED_RACES): WinRates {
	const shown = rows
		.filter((row) => row.races >= minRaces && row.races > 0)
		.map((row): WinRateRow => ({
			...row,
			rate: row.wins / row.races,
			marks: row.races >= SOLID_RACES ? 3 : row.races >= rankedRaces ? 2 : 1,
		}))
	return {
		ranked: shown.filter((row) => row.races >= rankedRaces).sort((a, b) => b.rate - a.rate || b.races - a.races),
		unranked: shown.filter((row) => row.races < rankedRaces).sort((a, b) => b.races - a.races || b.rate - a.rate),
	}
}
