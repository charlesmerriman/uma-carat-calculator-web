/**
 * Cumulative income from the projection anchor (today) to an arbitrary date.
 *
 * THE MODEL
 * ---------
 * Every function here answers one question: "how much of source X has accrued
 * between today and date E?" — as a closed form over the whole span, never as a
 * sum of per-banner windows.
 *
 * That is the whole point of the rewrite. The previous engine chained half-open
 * `(prevEnd, thisEnd]` windows, so every source needed an occurrence counter and
 * every counter had to *tile* — `(a,b] + (b,c] === (a,c]` — or totals drifted
 * with how many banners the user happened to plan. Tiling is a property you have
 * to prove for each counter and can silently lose; a closed form from a fixed
 * anchor has nothing to lose. It is also what the source spreadsheet does, one
 * column per source (`Carat Calculator` cols AN..AV), which is what makes the two
 * comparable at all.
 *
 * Each function names the sheet cell it reproduces. Where we knowingly differ,
 * the comment says so — those are the items the parity harness settles.
 *
 * All arithmetic is UTC (see ./utcDates). `today` is midnight UTC; `now` is the
 * live instant, and the two are NOT interchangeable — the sheet uses `$AG$3`
 * (TODAY) for span measures and `$AG$2` (NOW) for the event filters.
 *
 * Every function takes the constants as its last argument rather than importing
 * them: they are admin-editable and arrive with the API response, so a module
 * import would freeze them at build time.
 */

import type { CalculationConstants } from "../types/constants"
import {
	addUtcDays,
	ceilToTen,
	startOfUtcDay,
	startOfUtcMonth,
	startOfUtcWeek,
	utcDaysBetween,
	utcMonthsBetween,
	utcYearsBetween,
} from "./utcDates"

/**
 * Carats earned per day from daily quests plus the weekly login bonus, as a
 * single BLENDED rate — the sheet's `75 + 150/7` (cell AN42, Global branch).
 *
 * The old engine walked each day and added the bonus on the specific weekdays it
 * fell on, phased off `today`. Same long-run rate (the bonuses total 150 a week
 * either way), but a different figure for any given banner, and it made every
 * estimate depend on which weekday the user happened to open the page. The sheet
 * smears it, so we smear it.
 */
function blendedDailyRate(k: CalculationConstants): number {
	return k.daily_base_carats + k.weekly_bonus_carats / 7
}

/**
 * The configured Training Pass launch date as a UTC midnight instant.
 *
 * The API sends a plain `YYYY-MM-DD` calendar day. Parsing that with `new Date()`
 * would be UTC midnight anyway, but going through Date.UTC explicitly keeps this
 * correct if the field ever gains a time component.
 */
function trainingPassLaunch(k: CalculationConstants): Date {
	const [year, month, day] = k.training_pass_start_date.split("-").map(Number)
	return new Date(Date.UTC(year, month - 1, day))
}

/**
 * Daily quests + weekly login — sheet `AN42`:
 *   `CEILING(DATEDIF(today, E, "D") * (75 + 150/7), 10)`
 *
 * The CEILING is applied to the CUMULATIVE total, not per day, so it can only
 * ever add up to 9 carats to the whole projection rather than compounding.
 */
export function cumulativeDailyCarats(
	today: Date,
	end: Date,
	k: CalculationConstants
): number {
	const days = utcDaysBetween(today, end)
	if (days <= 0) return 0
	return ceilToTen(days * blendedDailyRate(k))
}

/**
 * Team Trials — sheet `AO42`:
 *   `INT((E - (today - WEEKDAY(today, 2) + 1)) / 7) * rate`
 *
 * Complete weeks since the Monday of the CURRENT week, so a payout is credited
 * once the week containing it has fully elapsed. Measured from that Monday
 * rather than from today, which is why a banner a few days out can already
 * carry a payout.
 *
 * The rate comes from the user's rank row, not the constants — it is per-user.
 */
export function cumulativeTeamTrialsCarats(
	today: Date,
	end: Date,
	incomePerWeek: number
): number {
	const weeks = Math.floor(utcDaysBetween(startOfUtcWeek(today), end) / 7)
	return weeks > 0 ? weeks * incomePerWeek : 0
}

/**
 * Club Rank — sheet `AP42`:
 *   `DATEDIF(EOMONTH(today, -1) + 1, E, "M") * rate`
 *
 * Complete months since the 1st of the current month. Note this is NOT the old
 * "1st-of-month boundaries crossed" count: DATEDIF only completes a month when
 * the day-of-month comes round again, so measuring from the 1st is what makes
 * the two agree.
 */
export function cumulativeClubRankCarats(
	today: Date,
	end: Date,
	incomePerMonth: number
): number {
	const months = utcMonthsBetween(startOfUtcMonth(today), end)
	return months > 0 ? months * incomePerMonth : 0
}

/**
 * Misc earnings — sheet `AV42`:
 *   `DATEDIF(today + 30, E, "D") * INT(Timeline!$AW$1 / 30)`
 *
 * A flat daily approximation of gifts / career rewards, gated behind the user's
 * toggle, and only after a ramp-in counted from today. The ramp-in start is an
 * ABSOLUTE instant, which is what stops a densely-planned timeline from
 * restarting it at every banner.
 *
 * Note the daily figure is derived from a MONTHLY constant, floored — matching
 * the sheet, which stores the monthly total and divides.
 *
 * `custom` is the player's own monthly figure (custom_misc_earnings_monthly).
 * Optional, and absent or null means the site's estimate, the same shape as the
 * shop ticket counts. It replaces only the amount: the ramp-in still applies,
 * because the player's typed balance already holds what they earned lately.
 */
export function cumulativeMiscEarningsCarats(
	today: Date,
	end: Date,
	k: CalculationConstants,
	custom?: number | null
): number {
	const days = utcDaysBetween(addUtcDays(today, k.misc_earnings_delay_days), end)
	if (days <= 0) return 0
	return days * Math.floor(miscEarningsMonthly(custom, k) / 30)
}

/**
 * The monthly misc earnings figure the projection uses: the player's own when
 * they set one, otherwise the admin-editable estimate. Everything that shows or
 * spends this number reads it here, so the settings blurb and the projection
 * can't disagree. Floored at 0 for a negative that slipped past the server.
 */
export function miscEarningsMonthly(
	custom: number | null | undefined,
	k: CalculationConstants
): number {
	return custom === null || custom === undefined
		? k.misc_earnings_monthly
		: Math.max(0, custom)
}

/**
 * 50-day login campaign plus the two annual gifts — sheet `AU42`:
 *   `INT(DATEDIF(today, E, "D") / 50) * 150
 *    + (DATEDIF(date_v, E, "Y") + 1) * 500
 *    + (DATEDIF(date_w, E, "Y") + 1) * 500`
 *
 * where `date_v` / `date_w` are this year's February 14 and March 14, rolled
 * forward a year if already past. The `+ 1` is what credits the upcoming
 * occurrence: DATEDIF gives 0 complete years until the *following* one, so a
 * banner ending after the next Valentine's still counts it once.
 *
 * The gifts are universal (no toggle), as is the login campaign.
 */
export function cumulativeLoginAndGiftCarats(
	today: Date,
	end: Date,
	k: CalculationConstants
): number {
	const days = utcDaysBetween(today, end)
	if (days <= 0) return 0

	const cycles = Math.floor(days / k.fifty_day_login_cycle_days)
	let total = cycles * k.fifty_day_login_carats

	// The constants are 1-indexed months, as a human editing the admin page
	// expects; Date.UTC wants 0-indexed.
	for (const [month, day, amount] of [
		[k.valentines_month - 1, k.valentines_day, k.valentines_carats],
		[k.white_day_month - 1, k.white_day_day, k.white_day_carats],
	] as const) {
		let occurrence = new Date(Date.UTC(today.getUTCFullYear(), month, day))
		if (occurrence < startOfUtcDay(today)) {
			occurrence = new Date(Date.UTC(today.getUTCFullYear() + 1, month, day))
		}
		if (end < occurrence) continue
		total += (utcYearsBetween(occurrence, end) + 1) * amount
	}

	return total
}

export interface DailyCaratPackIncome {
	/** The daily drip — ordinary earned currency. */
	freeCarats: number
	/** The repurchase bonus — bought, so it can fund discounted pulls. */
	paidCarats: number
}

/**
 * Daily Carat Pack — sheet `AR42` (drip) and `AZ42` (repurchase bonus):
 *   `DATEDIF(MAX(today, packStart), E, "D") * 50`
 *   `INT(DATEDIF(packStart, E, "D") / 30) * 500`
 *
 * The sheet takes `packStart` from a user-entered cell (`$AL$356`). We anchor to
 * today instead, which is what that cell reduces to when left blank — its
 * default. Day 0 never pays the bonus: the pack the user holds right now is
 * assumed already counted in the paid balance they entered.
 */
export function cumulativeDailyCaratPack(
	today: Date,
	end: Date,
	k: CalculationConstants
): DailyCaratPackIncome {
	const days = utcDaysBetween(today, end)
	if (days <= 0) return { freeCarats: 0, paidCarats: 0 }
	return {
		freeCarats: days * k.daily_carat_pack_per_day,
		paidCarats:
			Math.floor(days / k.daily_carat_pack_cycle_days) *
			k.daily_carat_pack_paid_carats,
	}
}

export interface MonthlyShopTickets {
	umaTickets: number
	supportTickets: number
}

/**
 * How many of each ticket the player buys from the shop each month
 * (UserStats.shop_*_tickets_bought). null / undefined means "the default".
 */
export interface ShopTicketsBought {
	uma?: number | null
	support?: number | null
}

/**
 * One month's purchase of one ticket kind.
 *
 * Two different numbers bound it, and they are not interchangeable:
 *   - `defaultCount` is what an untouched account is assumed to buy (4, the
 *     sheet's figure). It is the answer when `bought` is null.
 *   - `max` is the most the shop sells (9). It only caps a count the player
 *     set themselves.
 *
 * The clamp lives HERE, at the read, because the server stores the count
 * unchecked against the cap on purpose (see GameStats on the backend): if an
 * editor lowers the cap, a stored 9 has to start reading as the new cap, not
 * keep paying out tickets the shop no longer sells.
 */
export function shopTicketsPerMonth(
	bought: number | null | undefined,
	defaultCount: number,
	max: number
): number {
	const wanted = bought === null || bought === undefined ? defaultCount : bought
	return Math.min(Math.max(0, wanted), max)
}

/**
 * Monthly shop bundle — sheet `BG42`:
 *   `DATEDIF(EOMONTH(today, -1) + 2, E, "M") * quantity`
 *
 * Bought with an untracked currency, so it costs no carats. Measured from the
 * restock day of the current month rather than the 1st — a banner ending on the
 * 1st would otherwise be credited a bundle the player can't buy yet. Off by
 * default.
 *
 * `bought` replaces the default purchase with what the player actually buys
 * each month. Optional, and absent means the default, so the sheet's figure is
 * what comes back unless someone has set their own count.
 */
export function cumulativeMonthlyShopTickets(
	today: Date,
	end: Date,
	k: CalculationConstants,
	bought: ShopTicketsBought = {}
): MonthlyShopTickets {
	const restockDay = addUtcDays(
		startOfUtcMonth(today),
		k.monthly_shop_restock_day - 1
	)
	const months = utcMonthsBetween(restockDay, end)
	if (months <= 0) return { umaTickets: 0, supportTickets: 0 }
	return {
		umaTickets:
			months *
			shopTicketsPerMonth(
				bought.uma,
				k.monthly_shop_uma_tickets,
				k.monthly_shop_uma_tickets_max
			),
		supportTickets:
			months *
			shopTicketsPerMonth(
				bought.support,
				k.monthly_shop_support_tickets,
				k.monthly_shop_support_tickets_max
			),
	}
}

export interface TrainingPassIncome {
	freeCarats: number
	paidCarats: number
	umaTickets: number
	supportTickets: number
	/** SSR uncap shards. Paid tier only — see the note on the carats/tickets split. */
	ssrShards: number
}

/**
 * Training Pass — sheet `AQ42` (free carats), `BA42` (paid carats), `BH42`
 * (tickets):
 *   `INT(DATEDIF(MAX(today, launch), E, "M")) * IF(paid, 1350 + 500, 500)`
 *   `INT(DATEDIF(MAX(today, launch), E, "M")) * IF(paid, 350, 0)`
 *   `INT(DATEDIF(MAX(today, launch), E, "M") * IF(paid, 4, 2))`
 *
 * The feature does not exist before its launch date, so the span is clamped
 * there and a banner ending sooner earns nothing.
 *
 * All three use ONE month count. The old engine used two different clocks — the
 * 24th for the paid tier's carats and tickets, the 1st for the free tier's
 * carats — so a free-tier account drew carats and tickets on different days.
 * The sheet does not make that distinction, and full parity follows the sheet.
 *
 * Carats are either/or (the paid reward replaces the free tier's) while tickets
 * are base + bonus (the paid pass stacks). The paid tier's total is split across
 * both balances because part of it is purchased currency.
 *
 * SSR shards are a third shape again: paid tier ONLY, with no free-tier amount
 * to stack on. They ride the same month count as everything else here, so the
 * pass never pays a shard on a different clock from its carats. The sheet does
 * not model pass shards at all, so that one has no cell reference above and a
 * parity audit will show it as ours alone rather than as a discrepancy.
 */
export function cumulativeTrainingPassIncome(
	today: Date,
	end: Date,
	hasPaidPass: boolean,
	k: CalculationConstants
): TrainingPassIncome {
	const empty = {
		freeCarats: 0,
		paidCarats: 0,
		umaTickets: 0,
		supportTickets: 0,
		ssrShards: 0,
	}
	const launch = trainingPassLaunch(k)
	if (end <= launch) return empty

	const start = today > launch ? today : launch
	const months = utcMonthsBetween(start, end)
	if (months <= 0) return empty

	return {
		freeCarats:
			months *
			(hasPaidPass
				? k.training_pass_monthly_free_carats
				: k.monthly_base_reward),
		paidCarats: hasPaidPass ? months * k.training_pass_monthly_paid_carats : 0,
		umaTickets:
			months *
			(k.training_pass_free_uma_tickets +
				(hasPaidPass ? k.training_pass_paid_bonus_uma_tickets : 0)),
		supportTickets:
			months *
			(k.training_pass_free_support_tickets +
				(hasPaidPass ? k.training_pass_paid_bonus_support_tickets : 0)),
		ssrShards: hasPaidPass ? months * k.training_pass_paid_ssr_shards : 0,
	}
}
