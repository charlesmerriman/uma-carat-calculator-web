/**
 * The Rankings page's "What wins" table (CM Runs, totalled by the server per
 * uma and strategy): win rates, best first, only where there are enough
 * races to mean something. Pure.
 */

import type { RunResultRow } from "../types/rankingsTabs"

export interface WinRateRow extends RunResultRow {
	/** wins / races, 0 to 1. */
	rate: number
}

/** Rows with at least `minRaces` races, best rate first, more races breaking a tie. */
export function winRates(rows: RunResultRow[], minRaces: number): WinRateRow[] {
	return rows
		.filter((row) => row.races >= minRaces && row.races > 0)
		.map((row) => ({ ...row, rate: row.wins / row.races }))
		.sort((a, b) => b.rate - a.rate || b.races - a.races)
}
