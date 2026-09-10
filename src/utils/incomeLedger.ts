/**
 * Queries over the income ledger — the flat dated timeline `/calculator-data`
 * serves (see `backend/calculatorapi/ledger.py`).
 *
 * Every function here is a cumulative total from the projection anchor to an
 * arbitrary end date, matching the closed forms in ./cumulativeIncome. The
 * ledger carries no "as of today" gate of its own — it is a set of dated facts,
 * past rows included — so each query applies the lower bound itself. That is
 * deliberate: one anchor governs every income source rather than the server and
 * the client each holding their own.
 *
 * The sheet's equivalents are `Carat Calculator` cells AL42 (event lumps), AL43
 * (throughout carats) and AS42/AT42 (race events). Each bound below names the
 * one it reproduces, because they are NOT all the same and the differences are
 * load-bearing.
 */

import type { CalculationConstants } from "../types/constants"
import type { IncomeLedgerRow, LedgerRowKind, ParsedLedgerRow } from "../types/ledger"
import { addUtcDays, ceilToTen, startOfUtcDay, utcDaysBetween } from "./utcDates"

/**
 * Parse each row's dates once.
 *
 * The engine scans the whole ledger for every planned banner, so parsing ~235
 * date strings inside those passes is work that only needs doing a single time.
 */
export function parseLedger(rows: IncomeLedgerRow[]): ParsedLedgerRow[] {
	return rows.map((row) => ({
		...row,
		parsedDate: new Date(row.date),
		parsedThroughoutEnd: row.throughout_end ? new Date(row.throughout_end) : null,
	}))
}

export interface LedgerRewards {
	carats: number
	umaTickets: number
	supportTickets: number
	ssrShards: number
	ssrCrystals: number
	srShards: number
	srCrystals: number
}

const NO_REWARDS: LedgerRewards = {
	carats: 0,
	umaTickets: 0,
	supportTickets: 0,
	ssrShards: 0,
	ssrCrystals: 0,
	srShards: 0,
	srCrystals: 0,
}

/**
 * Everything game events pay as a LUMP on their start date, totalled over
 * `now <= date <= end` — sheet `AL42`:
 *   `SUM(FILTER(Timeline!$AT, $AG$2 <= Timeline!$AU, AH43 >= Timeline!$AU, ...))`
 *
 * Note the lower bound is `$AG$2` (NOW), not `$AG$3` (TODAY). An event that
 * opened earlier today has already paid out, so its carats are in the balance
 * the user typed in — counting them again would double them. This is the one
 * place the live instant is used rather than midnight.
 *
 * `carats_throughout` is deliberately excluded: it is a pool, not a lump, and is
 * handled by cumulativeThroughoutCarats below.
 */
export function cumulativeEventRewards(
	ledger: ParsedLedgerRow[],
	now: Date,
	end: Date
): LedgerRewards {
	const total = { ...NO_REWARDS }

	for (const row of ledger) {
		if (row.kind !== "event") continue
		if (row.parsedDate < now || row.parsedDate > end) continue
		total.carats += row.carats
		total.umaTickets += row.uma_tickets
		total.supportTickets += row.support_tickets
		total.ssrShards += row.ssr_shards
		total.ssrCrystals += row.ssr_crystals
		total.srShards += row.sr_shards
		total.srCrystals += row.sr_crystals
	}

	return total
}

/**
 * Which Champions Meetings / League of Heroes events pay out by `end` —
 * sheet `AS42`/`AT42`:
 *   `SUM(FILTER(Timeline!$BL, Timeline!$BE < AH43 + 1))`
 *
 * Two bounds worth reading carefully:
 *
 * - The sheet has NO lower bound here, because its `CM Check`/`LoH Check`
 *   columns are themselves populated only from today onward (verified against
 *   live values: zero flagged rows predate today). Our ledger carries past rows,
 *   so the gate lives here instead — `date >= today`, midnight, matching where
 *   the sheet's own column starts.
 * - The upper bound is `< end + 1 day`, NOT `<= end`. Race rows are dated at
 *   midnight while banners end at 21:59:59, so this credits an event finishing
 *   the day after a banner closes. That is the sheet's behaviour and it is
 *   ported deliberately; the parity harness is what confirms it.
 *
 * The lead time a Champions Meeting settles ahead of its listed end is already
 * baked into `row.date` by the backend, so there is nothing to subtract here —
 * these bounds are about the banner window, not about when the event pays.
 *
 * The rows are indicators and carry no amounts; cumulativeRaceRewards below
 * values them at the user's rank.
 */
export function raceEventsInWindow(
	ledger: ParsedLedgerRow[],
	kind: LedgerRowKind,
	today: Date,
	end: Date
): ParsedLedgerRow[] {
	const from = startOfUtcDay(today)
	const to = addUtcDays(end, 1)
	return ledger.filter(
		(row) => row.kind === kind && row.parsedDate >= from && row.parsedDate < to
	)
}

/**
 * The part of a rank row a race placement pays out. Champions Meeting and
 * League of Heroes ranks share this shape exactly (types/ranks.ts), which is
 * what lets one function value both kinds.
 */
export interface RaceRank {
	name: string
	income_amount: number
	uma_ticket_amount: number
	support_ticket_amount: number
	ssr_shard_amount: number
	sr_shard_amount: number
}

export interface RaceRewards {
	carats: number
	umaTickets: number
	supportTickets: number
	ssrShards: number
	srShards: number
}

/**
 * Race events whose rank ladder stopped short of today's top tiers, as
 * `kind -> event number -> the highest rank that event offered`.
 *
 * League of Heroes #1 (January 2027) only ran up to Platinum 1. Platinum 2-4 did
 * not exist yet, so a player ranked above that could only have earned Platinum
 * 1's rewards from it. Confirmed by the sheet's maintainer, and it reproduces the
 * sheet's LoH column (`AT42`) exactly: 1800 for #1, then 2800 for every later
 * event, for a Platinum 3 player.
 *
 * WHY THIS LIVES IN CODE AND NOT THE ADMIN: it is a historical fact about one
 * event that can never change, and it stops mattering entirely once LoH #1 falls
 * behind `today`, because the projection never counts a past event. A model field
 * and a migration would outlive the rule by years. If another capped event turns
 * up, add it here; if they start turning up routinely, that is the point to
 * promote this to a field on the event instead.
 *
 * Keyed by rank NAME, not id: ids are database keys that differ between
 * environments, while the names are the stable identity, and what the sheet shows.
 */
const RACE_RANK_CAPS: Partial<Record<LedgerRowKind, Readonly<Record<number, string>>>> = {
	league_of_heroes: { 1: "Platinum 1" },
}

/**
 * The rank a race event actually pays at: the user's own rank, lowered to the
 * event's ceiling when it had one. Lowered, never raised. A player ranked below
 * the ceiling still earns their own, smaller, rewards.
 *
 * Ranks are compared by `income_amount`, the same order CalculatorProvider sorts
 * the rank tables into. When the ceiling rank cannot be found (renamed in the
 * admin) or the row has no `event_number` (an API older than the field), this
 * returns the user's rank: the pre-cap behaviour, rather than a silent zero.
 */
export function effectiveRaceRank<R extends RaceRank>(
	row: ParsedLedgerRow,
	userRank: R | undefined,
	rankTable: readonly R[]
): R | undefined {
	if (!userRank || row.event_number == null) return userRank
	const capName = RACE_RANK_CAPS[row.kind]?.[row.event_number]
	if (!capName) return userRank
	const cap = rankTable.find((rank) => rank.name === capName)
	if (!cap) return userRank
	return userRank.income_amount > cap.income_amount ? cap : userRank
}

/**
 * Everything one kind of race event pays out by `end`, valued at the user's
 * rank: sheet `AS42`/`AT42`, and its ticket columns `BE42`/`BF42`.
 *
 * Summed PER EVENT rather than `count x rank amount`, because an event can pay
 * below the user's rank (RACE_RANK_CAPS). The window is raceEventsInWindow's, so
 * the bounds documented there are the only bounds.
 */
export function cumulativeRaceRewards<R extends RaceRank>(
	ledger: ParsedLedgerRow[],
	kind: LedgerRowKind,
	today: Date,
	end: Date,
	userRank: R | undefined,
	rankTable: readonly R[]
): RaceRewards {
	const total: RaceRewards = {
		carats: 0,
		umaTickets: 0,
		supportTickets: 0,
		ssrShards: 0,
		srShards: 0,
	}
	for (const row of raceEventsInWindow(ledger, kind, today, end)) {
		const rank = effectiveRaceRank(row, userRank, rankTable)
		if (!rank) continue
		total.carats += rank.income_amount
		total.umaTickets += rank.uma_ticket_amount
		total.supportTickets += rank.support_ticket_amount
		total.ssrShards += rank.ssr_shard_amount
		total.srShards += rank.sr_shard_amount
	}
	return total
}

/**
 * How much of one event's `carats_throughout` pool is still collectable as of
 * `now` — a single figure per event, independent of any banner window.
 *
 * That independence is the point. An earlier model spread each pool across every
 * banner window it overlapped, so a banner's estimate depended on how the user
 * had sliced their plan. The sheet evaluates the curve once, from today, and
 * credits the result whole.
 *
 * The curve blends a fast exponential early decay with a slower linear tail,
 * taking whichever leg has MORE left at a given moment: the exponential
 * dominates just after the banner opens (front-loading the reward) and the
 * linear leg takes over for the rest. It self-clamps outside the span — before
 * the banner starts both legs exceed 1 so MIN caps at 1 (nothing collected yet),
 * after it both go negative so MAX floors at 0 (pool exhausted).
 *
 * The curve runs over the BANNER's span shortened by `throughout_end_offset_days`.
 * `throughout_end` already arrives as the banner's end rather than the event's
 * padded one — the backend strips that buffer, so there is no constant to keep
 * in sync here any more.
 */
function remainingThroughoutForRow(
	row: ParsedLedgerRow,
	now: Date,
	k: CalculationConstants
): number {
	if (!row.carats_throughout || !row.parsedThroughoutEnd) return 0

	const bannerStart = row.parsedDate
	const curveEnd = addUtcDays(row.parsedThroughoutEnd, -k.throughout_end_offset_days)

	const span = utcDaysBetween(bannerStart, curveEnd)
	// A banner shorter than the trim has no curve to walk; treat it as spent
	// rather than dividing by zero or a negative.
	if (span <= 0) return 0

	const fraction = Math.min(Math.max(utcDaysBetween(bannerStart, now) / span, 0), 1)
	const eNegK = Math.exp(-k.throughout_decay_k)
	const exponential =
		(Math.exp(-k.throughout_decay_k * fraction) - eNegK) / (1 - eNegK)
	const linear = 1 - fraction

	const share = Math.max(
		0,
		Math.min(1, exponential),
		Math.min(1, linear * k.throughout_decay_linear_slope)
	)

	return ceilToTen(share * row.carats_throughout)
}

/**
 * Total throughout carats collectable by `end`, counting from `now` — sheet
 * `AL43`:
 *   `SUM(FILTER(Timeline!$AZ, $AG$2 <= Timeline!$BA, AH43 >= Timeline!$BA - $AQ$32))`
 *
 * An event qualifies when both hold:
 *   - its banner has not already finished (`bannerEnd >= now`) — carats from a
 *     closed banner are gone, not bankable;
 *   - its banner ends within `throughout_filter_grace_days` after `end`.
 *
 * There is deliberately no exclusion for banners already running: any number can
 * be in flight at once and all of them count, each contributing only what it has
 * left.
 */
export function cumulativeThroughoutCarats(
	ledger: ParsedLedgerRow[],
	now: Date,
	end: Date,
	k: CalculationConstants
): number {
	let total = 0
	for (const row of ledger) {
		const bannerEnd = row.parsedThroughoutEnd
		if (!row.carats_throughout || !bannerEnd) continue
		if (bannerEnd < now) continue
		if (addUtcDays(bannerEnd, -k.throughout_filter_grace_days) > end) continue
		total += remainingThroughoutForRow(row, now, k)
	}
	return total
}
