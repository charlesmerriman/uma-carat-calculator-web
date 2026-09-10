/**
 * The income ledger — the flat, date-sorted timeline the projection queries.
 *
 * Mirrors `IncomeLedgerRowSerializer` in `backend/calculatorapi/views/ledger.py`;
 * see `backend/docs/api-reference.md` for the field-by-field contract.
 */

/**
 * Which model a row came from. A real discriminated-union tag owned by the
 * backend, not a structural guess — `champions_meeting` and `league_of_heroes`
 * rows are field-identical, so nothing distinguishes them but this.
 */
export type LedgerRowKind = "event" | "champions_meeting" | "league_of_heroes"

export interface IncomeLedgerRow {
	/**
	 * ISO instant the reward lands: an event's start; for a race event, its end
	 * MINUS that kind's lead time. A Champions Meeting settles its placements
	 * 24h before its window closes, so this deliberately sits a day ahead of the
	 * end date the Timeline card shows. The backend owns that offset
	 * (`RACE_REWARD_LEAD_TIME`); never re-apply it here.
	 */
	date: string
	kind: LedgerRowKind
	/** Primary key within `kind` — NOT unique across the ledger. */
	source_id: number
	name: string
	is_predicted: boolean
	/**
	 * End of the curve a `carats_throughout` pool decays over: the linked
	 * BANNER's end, with the game-event buffer already removed by the backend.
	 * Null on rows carrying no throughout pool.
	 */
	throughout_end: string | null
	/**
	 * Which race event this is (its `cm_number` / `loh_number`), and null on
	 * `event` rows. The engine needs it to recognise the few events that pay
	 * below the user's rank (`RACE_RANK_CAPS` in utils/incomeLedger). Absent on a
	 * response from an API older than the field, so read it with `== null`,
	 * which covers both.
	 */
	event_number: number | null

	/** Lump carats on `date`. */
	carats: number
	/** Pool spread across the event's life by the decay curve; not a lump. */
	carats_throughout: number
	uma_tickets: number
	support_tickets: number
	ssr_shards: number
	ssr_crystals: number
	sr_shards: number
	sr_crystals: number
}

/**
 * A ledger row with its dates parsed once.
 *
 * The engine scans the ledger once per planned banner, so re-parsing ~235 date
 * strings on every pass is work the caller can do a single time up front.
 */
export interface ParsedLedgerRow extends IncomeLedgerRow {
	parsedDate: Date
	parsedThroughoutEnd: Date | null
}
