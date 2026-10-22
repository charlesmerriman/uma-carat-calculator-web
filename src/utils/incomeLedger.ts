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
import type { RaceRankReward } from "../types/ranks"
import { addUtcDays, ceilToTen, startOfUtcDay, utcDaysBetween } from "./utcDates"

/**
 * Parse each row's dates once.
 *
 * The engine scans the whole ledger for every planned banner, so parsing ~235
 * date strings inside those passes is work that only needs doing a single time.
 */
export function parseLedger(rows: IncomeLedgerRow[]): ParsedLedgerRow[] {
	return rows.map((row) => {
		const parsedDate = new Date(row.date)
		return {
			...row,
			parsedDate,
			parsedThroughoutEnd: row.throughout_end ? new Date(row.throughout_end) : null,
			parsedPayouts: row.payouts?.length ? row.payouts.map((instant) => new Date(instant)) : [parsedDate],
		}
	})
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
 * - The upper bound is `<= end`, the banner's closing instant, and NOT the
 *   sheet's `< end + 1 day`. The sheet dates a race row at its LISTED end and
 *   uses the extra day to stand in for the Champions Meeting lead time (the
 *   rewards drop at the daily reset a day before the listed end). Our backend
 *   already dates the row at that reset (`RACE_REWARD_LEAD_TIME`), so porting
 *   the sheet's `+ 1` on top of it shifted a CM twice and credited a CM ending
 *   the day after a banner to that banner — one minute before its rewards
 *   existed (reported by Daptrius, 2026-10-06). Compare instants, like
 *   cumulativeEventRewards does, and the double shift is gone.
 *
 * Worked example, banner closing on the 15th at 21:59:59: a CM listed as
 * ending the 15th is dated the 14th 22:00:00 and counts; one ending the 16th
 * is dated the 15th 22:00:00, a second after the banner, and does not.
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
	return ledger.filter(
		(row) => row.kind === kind && row.parsedDate >= from && row.parsedDate <= end
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
	day_amounts?: readonly number[]
	rewards?: readonly RaceRankReward[]
}

export interface RaceRewards {
	carats: number
	umaTickets: number
	supportTickets: number
	ssrShards: number
	srShards: number
}

/**
 * The carats one race event pays at a rank: the rank's `rewards` row with the
 * largest `from_event_number` at or below the event's number, else the rank's
 * own `income_amount` (backend `docs/income-calculation.md`, "Rewards that
 * change with the event number").
 *
 * The game has raised CM and LoH payouts at set event numbers (CM 30, LoH 6),
 * and LoH 1 paid Platinum 2-4 less than LoH 2. Those are rows an editor
 * enters on the rank, so the rule lives here and the numbers in the admin.
 * This replaced RACE_RANK_CAPS ("LoH 1 only ran to Platinum 1"), which the
 * source sheet itself retired by raising LoH 1 for the ranks above it.
 *
 * Doesn't assume the rows are sorted. An event with no number (a ledger
 * from an API older than `event_number`) pays the rank's own amount, the
 * behaviour from before the rows existed.
 */
export function raceRewardAmount(rank: RaceRank, eventNumber: number | null): number {
	return eraRow(rank, eventNumber)?.income_amount ?? rank.income_amount
}

/** The "from event #N" row an event pays from, or null for the rank's own amount. */
function eraRow(rank: RaceRank, eventNumber: number | null): RaceRankReward | null {
	if (eventNumber == null) return null
	let found: RaceRankReward | null = null
	for (const reward of rank.rewards ?? []) {
		if (reward.from_event_number <= eventNumber && reward.from_event_number > (found?.from_event_number ?? 0)) {
			found = reward
		}
	}
	return found
}

/**
 * How one race event's carats arrive, one amount per payout instant (the
 * ledger row's `payouts`; backend `race_payouts.py`), adding up to
 * `raceRewardAmount`. An LoH pays most of its reward by day 4 of 9 and a CM
 * about 20% before its finals (Daptrius, 2026-10-05), so crediting it all on
 * the last day left a banner ending mid-event short.
 *
 * Which split, in order:
 * 1. The era row's own `day_amounts`, or the rank's when no era row applies.
 * 2. An era row with none (CM #30+, which has no table of its own): the
 *    rank's split scaled to the era's total, each day rounded to tens and the
 *    remainder on the last day, so the total is exact.
 * 3. No split at all, or one whose length doesn't match the payouts (an API
 *    from before the field): everything on the last payout, which is how
 *    every race event paid before this existed.
 */
export function raceDayAmounts(rank: RaceRank, eventNumber: number | null, payoutCount: number): number[] {
	const era = eraRow(rank, eventNumber)
	const total = era?.income_amount ?? rank.income_amount
	const fits = (split: readonly number[] | undefined): split is readonly number[] =>
		!!split && split.length === payoutCount && payoutCount > 0
	const own = era ? era.day_amounts : rank.day_amounts
	if (fits(own)) return [...own]
	const base = rank.day_amounts
	const baseTotal = fits(base) ? base.reduce((sum, amount) => sum + amount, 0) : 0
	if (fits(base) && baseTotal > 0) {
		const early = base.slice(0, -1).map((amount) => Math.round((amount * total) / baseTotal / 10) * 10)
		const last = total - early.reduce((sum, amount) => sum + amount, 0)
		if (last >= 0) return [...early, last]
	}
	return [...Array(Math.max(payoutCount - 1, 0)).fill(0), total]
}

/**
 * The lowest and highest carats a rank pays across the race events of one
 * kind still ahead (from the start of today, like raceEventsInWindow), for
 * the rank picker's badge. Null when no such event is in the ledger, and the
 * caller shows the rank's own amount.
 *
 * Reads the projection's ledger, so a skipped event is not in the range.
 */
export function upcomingRaceRewardRange(
	ledger: IncomeLedgerRow[],
	kind: LedgerRowKind,
	rank: RaceRank,
	now: Date
): { min: number; max: number } | null {
	const from = startOfUtcDay(now).getTime()
	let range: { min: number; max: number } | null = null
	for (const row of ledger) {
		if (row.kind !== kind || new Date(row.date).getTime() < from) continue
		const amount = raceRewardAmount(rank, row.event_number ?? null)
		range = range
			? { min: Math.min(range.min, amount), max: Math.max(range.max, amount) }
			: { min: amount, max: amount }
	}
	return range
}

/**
 * Everything one kind of race event pays out by `end`, valued at the user's
 * rank: sheet `AS42`/`AT42`, and its ticket columns `BE42`/`BF42`.
 *
 * Summed PER EVENT rather than `count x rank amount`, because what a rank
 * pays depends on the event's number (raceRewardAmount), and per PAYOUT DAY
 * within each event (raceDayAmounts), so the carats land on the days the
 * game pays them. Each payout instant is held to raceEventsInWindow's bounds
 * (from the start of today to `end`). Tickets and shards are per rank only, as
 * in the sheet, and come with the event's last day, so they keep that window
 * as it is.
 */
export function cumulativeRaceRewards(
	ledger: ParsedLedgerRow[],
	kind: LedgerRowKind,
	today: Date,
	end: Date,
	userRank: RaceRank | undefined
): RaceRewards {
	const total: RaceRewards = {
		carats: 0,
		umaTickets: 0,
		supportTickets: 0,
		ssrShards: 0,
		srShards: 0,
	}
	if (!userRank) return total
	// Carats day by day: every payout instant inside the window, whether or
	// not the event's last day is, so a banner ending mid-event gets the days
	// already paid and the next banner the rest (raceDayAmounts).
	const from = startOfUtcDay(today).getTime()
	const until = end.getTime()
	for (const row of ledger) {
		if (row.kind !== kind) continue
		const days = raceDayAmounts(userRank, row.event_number, row.parsedPayouts.length)
		row.parsedPayouts.forEach((instant, day) => {
			const time = instant.getTime()
			if (time >= from && time <= until) total.carats += days[day]
		})
	}
	// Tickets and shards come with the last day, as before: one set per event
	// whose last day is in the window.
	const settled = raceEventsInWindow(ledger, kind, today, end).length
	total.umaTickets += settled * userRank.uma_ticket_amount
	total.supportTickets += settled * userRank.support_ticket_amount
	total.ssrShards += settled * userRank.ssr_shard_amount
	total.srShards += settled * userRank.sr_shard_amount
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
