/**
 * The row options: the per-row overrides in the panel under a planner row,
 * beside its note. Every read goes through here, the way `number_of_pulls`
 * goes through plannedPulls(), so "absent means the old behaviour" is decided
 * once instead of at every call site.
 *
 * Each option's unset value is exactly what every row did before it existed,
 * which is what let them ship without moving anyone's numbers.
 */

import type { PaidCaratUse, UserPlannedBanner, UserStats } from "../types/user"
import {
	MAX_COPIES,
	PULLS_PER_PITY_COPY,
	calculateSuccessProbability,
} from "./probabilityCalculations"

const PAID_CARAT_USES: readonly PaidCaratUse[] = ["none", "discount", "all"]

export function isPaidCaratUse(value: unknown): value is PaidCaratUse {
	return PAID_CARAT_USES.includes(value as PaidCaratUse)
}

/** What applyPullStrategy needs to know about one row's spending. */
export interface RowSpendSettings {
	spendTickets: boolean
	/** At most this many matching tickets; Infinity = as many as the pulls need. */
	ticketLimit: number
	discountedPaidPulls: boolean
	fullPricePaidPulls: boolean
}

/**
 * The global switches with this row's overrides laid on top.
 *
 * Tickets: a number on the row WINS over the global "spend tickets" switch
 * (owner's call, 2026-10-16). The switch is the default for rows left on
 * automatic; a number typed on one row is an explicit choice about that row.
 * So a row set to 5 spends up to 5 even with the switch off, and a row set to
 * 0 holds every ticket back with the switch on.
 *
 * Paid carats: the row's choice replaces BOTH paid toggles, so "discount only"
 * means discount on and full price off whatever the gear menu says.
 */
export function rowSpendSettings(
	row: Pick<UserPlannedBanner, "tickets_to_use" | "paid_carat_use">,
	stats: Pick<UserStats, "spend_tickets_on_banners" | "discounted_paid_pulls" | "full_price_paid_pulls">
): RowSpendSettings {
	const limit = rowTicketLimit(row)
	const paid = isPaidCaratUse(row.paid_carat_use) ? row.paid_carat_use : null
	return {
		// `!== false`: during a deploy the API may not send the switch yet, and
		// a missing switch has to mean "spend them", as it did before it existed.
		spendTickets: limit !== null ? true : stats.spend_tickets_on_banners !== false,
		ticketLimit: limit ?? Infinity,
		discountedPaidPulls: paid === null ? stats.discounted_paid_pulls : paid !== "none",
		fullPricePaidPulls: paid === null ? stats.full_price_paid_pulls : paid === "all",
	}
}

/** The row's ticket ceiling, or null for automatic. */
export function rowTicketLimit(row: Pick<UserPlannedBanner, "tickets_to_use">): number | null {
	const value = row.tickets_to_use
	return Number.isInteger(value) && (value as number) >= 0 ? (value as number) : null
}

/** Whether the row stays out of the spend. */
export function isExcludedFromProjection(
	row: Pick<UserPlannedBanner, "excluded_from_projection">
): boolean {
	return row.excluded_from_projection === true
}

/** Pulls already made on the banner, as a whole non-negative count. */
export function pullsAlreadyMade(row: Pick<UserPlannedBanner, "pulls_already_made">): number {
	const value = row.pulls_already_made
	return Number.isInteger(value) && (value as number) > 0 ? (value as number) : 0
}

/**
 * Whether any option is set, so the panel's button can look "inked in" and a
 * row with an override can be spotted down the sheet without opening it.
 */
export function hasRowOptions(row: UserPlannedBanner): boolean {
	return (
		rowTicketLimit(row) !== null ||
		isPaidCaratUse(row.paid_carat_use) ||
		pullsAlreadyMade(row) > 0 ||
		isExcludedFromProjection(row)
	)
}

/**
 * Planned pulls that take the banner's exchange counter to its NEXT 200,
 * counting the pulls already made: 120 made needs 80 more for the first
 * exchange; 0 made and 250 planned needs 400 for the next one after the
 * first. Always more than `planned` when `planned` is already on a threshold,
 * because the button that calls this means "one more exchange".
 */
export function pullsToNextExchange(alreadyMade: number, planned: number): number {
	const counter = alreadyMade + planned
	const next = (Math.floor(counter / PULLS_PER_PITY_COPY) + 1) * PULLS_PER_PITY_COPY
	return next - alreadyMade
}

/**
 * The fewest planned pulls that give at least `chance` (0..1) of finishing
 * with `copies` copies of one card at `rate` per pull: the "pull to 90%"
 * button. The same odds the strip shows, so the button can never suggest a
 * count whose strip disagrees with it.
 *
 * `guaranteed` covers the copies already certain without pulling (the row's
 * funded reserved copies). Never searches past the count where exchanges
 * alone guarantee the copies, because every pull past it is a certainty
 * already: a 0.15% card still reaches MLB at its fifth exchange.
 */
export function pullsForChance({
	copies,
	chance,
	rate,
	alreadyMade = 0,
	guaranteed = 0,
}: {
	copies: number
	chance: number
	rate: number
	alreadyMade?: number
	guaranteed?: number
}): number {
	const needed = Math.min(Math.max(1, Math.floor(copies)), MAX_COPIES) - Math.max(0, guaranteed)
	if (needed <= 0) return 0
	const target = Math.min(Math.max(chance, 0), 1) * 100
	const ceiling = pullsToExchanges(alreadyMade, needed)
	// Binary search: the chance only ever grows with pulls (more pulls, more
	// exchanges, more rolls), so the first count to reach the target is the
	// answer. ~10 evaluations instead of up to a thousand.
	let low = 0
	let high = ceiling
	while (low < high) {
		const mid = Math.floor((low + high) / 2)
		const reached =
			calculateSuccessProbability(mid, needed, rate, alreadyMade) >= target - 1e-9
		if (reached) high = mid
		else low = mid + 1
	}
	return low
}

/** Planned pulls after which the exchanges alone hand over `exchanges` copies. */
function pullsToExchanges(alreadyMade: number, exchanges: number): number {
	const counterNeeded =
		(Math.floor(alreadyMade / PULLS_PER_PITY_COPY) + exchanges) * PULLS_PER_PITY_COPY
	return counterNeeded - alreadyMade
}
