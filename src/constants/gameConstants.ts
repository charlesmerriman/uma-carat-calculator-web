/**
 * Game constants for Uma Musume gacha resource calculations.
 *
 * All carat values are in-game carats (the main gacha currency).
 * These values come from the game's income schedule — see
 * backend/docs/income-calculation.md for the full breakdown.
 *
 * NOTE: the individual `export const`s below feed the LEGACY engine
 * (`useBannerResources`) and go away with it. The ledger engine reads its
 * numbers from the admin-editable `CalculationConstants` served by
 * `/calculator-data`, falling back to `DEFAULT_CONSTANTS` at the bottom of this
 * file — which is assembled from these same literals so the two cannot drift
 * while both engines ship.
 */

import type { CalculationConstants } from "../types/constants"

// ── Daily income ──────────────────────────────────────────────────────────────

/** Base carats awarded every day just for logging in. */
const DAILY_BASE_CARATS = 75

/**
 * Extra carats awarded on certain weekday offsets from the reference date.
 * Applies on days where (daysSinceReference % 7) is 0, 3, or 5.
 */
const WEEKDAY_BONUS_CARATS = 25

/**
 * Additional bonus on the "weekend" offset day (daysSinceReference % 7 === 6).
 * Stacks with DAILY_BASE_CARATS for a total of 150 on that day.
 */
const WEEKEND_BONUS_CARATS = 75

/** Daily carats from the paid Daily Carat Pack, awarded per day when active. */
export const DAILY_CARAT_PACK_PER_DAY = 50

/**
 * PAID carats granted by each Daily Carat Pack purchase, on top of the per-day
 * carats above. The two halves land in different balances: the daily drip is
 * ordinary (free) carats, while this lump is purchased currency and therefore
 * the only recurring source of paid carats — the balance that funds discounted
 * pulls (see applyPullStrategy).
 */
export const DAILY_CARAT_PACK_PAID_CARATS = 500

/**
 * Length of one Daily Carat Pack purchase cycle, in days. Like the 50-day login
 * bonus (and unlike the month-boundary incomes), this is a rolling cycle
 * anchored to today: the pack the user holds right now is assumed already
 * reflected in their current paid-carat balance, so the first *modeled* payout
 * is the repurchase 30 days out, then one every 30 days after.
 */
const DAILY_CARAT_PACK_CYCLE_DAYS = 30

// ── Monthly approximations ────────────────────────────────────────────────────

/**
 * Flat carat approximation for miscellaneous earnings (gifts, team trials,
 * career mode) — mirrors the source sheet's "Misc Earnings" figure. Gated
 * behind the user's `misc_earnings` toggle (on by default).
 *
 * A DAILY DRIP, not a periodic lump: once the ramp-in below has elapsed, this
 * amount is credited every single day. 60/day is the same long-run rate as the
 * 1,800-per-30-days lump this replaced, and matches how the source sheet
 * models it. The drip is what stops a banner's estimate from jumping by 1,800
 * the moment its end date crosses a cycle boundary — a plan tuned one day
 * either side of a boundary used to read very differently for no real reason.
 */
export const MISC_EARNINGS_PER_DAY = 60

/**
 * Days of play before misc earnings start accruing at all, counted from today.
 * Days 1..30 of the projection earn nothing and the first 60 lands on day 31 —
 * the same "you have to play a full cycle first" assumption the lump model
 * made, kept so a short banner still can't collect misc income the user
 * hasn't plausibly earned.
 *
 * Anchored to today rather than to each banner's window, so the instant the
 * drip starts is absolute and the per-window day counts tile (see
 * countDaysAfterDelay).
 */
export const MISC_EARNINGS_DELAY_DAYS = 30

/**
 * Carats granted by each completion of the game's recurring 50-day login
 * campaign. Universal income (like the base daily carats), so it is always
 * applied — there is no toggle.
 *
 * Like the Daily Carat Pack (and UNLIKE the month-boundary incomes), this is a
 * rolling cycle anchored to today: the campaign the user is
 * partway through right now is assumed already reflected in the balance they
 * entered, so the first modeled payout is the one FIFTY_DAY_LOGIN_CYCLE_DAYS
 * out, then one every cycle after.
 */
export const FIFTY_DAY_LOGIN_PER_CYCLE = 150

/** Length of one 50-day login campaign, in days. */
const FIFTY_DAY_LOGIN_CYCLE_DAYS = 50

// ── Annual events ─────────────────────────────────────────────────────────────

/**
 * Carats gifted on Valentine's Day, once per year. Universal income with no
 * toggle, credited in full on the day itself.
 *
 * Month is 0-indexed to match JavaScript's Date.getMonth(), which is what
 * calculateAnnualDateOccurrences compares against — 1 is February, not January.
 */
export const VALENTINES_CARATS = 500
const VALENTINES_MONTH = 1
const VALENTINES_DAY = 14

/**
 * Carats gifted on White Day (March 14) — the reciprocal gift the game pairs
 * with Valentine's a month later. Universal income with no toggle, same
 * treatment as Valentine's above.
 *
 * The 500 amount is derived from the source sheet rather than read off a
 * settings cell: the sheet buckets both gifts into its "50 Day Login Bonus"
 * column, which reads 150 over a 62-day window (one 50-day payout, no gift
 * dates in range) and 2,050 over a 366-day window (seven 50-day payouts = 1,050,
 * plus Valentine's 500 and White Day 500). Its changelog entry 4.44 confirms the
 * two gifts are modelled as a pair. If a primary source ever gives a different
 * figure, this is the one number to change.
 *
 * Month is 0-indexed like VALENTINES_MONTH above — 2 is March.
 */
export const WHITE_DAY_CARATS = 500
const WHITE_DAY_MONTH = 2
const WHITE_DAY_DAY = 14

// ── Game event "throughout" carats ────────────────────────────────────────────
//
// A GameEvent's `carats_throughout` is a pool the event pays out gradually over
// its banner's run rather than as a lump. All three offsets below exist to
// reconstruct the BANNER's window from the event row the API hands us, because
// the source sheet's decay curve runs over the banner, not the event.

/**
 * Days an event's `end_date` trails its banner's own end date.
 *
 * LEGACY ENGINE ONLY. It used this to strip the API's padding back off and
 * recover the banner window the throughout curve runs over. The ledger engine
 * doesn't need it: `income_ledger` serves `throughout_end` with the buffer
 * already removed, and the live value is admin-editable
 * (`CalculationConstants.game_event_end_buffer_days`) rather than duplicated
 * across two repositories.
 *
 * Delete this with `useBannerResources`.
 */
const GAME_EVENT_END_DATE_BUFFER_DAYS = 4

/**
 * Extra days trimmed off the banner's end before the decay curve is measured,
 * so the pool reaches zero slightly BEFORE the banner closes rather than
 * exactly on its last second.
 *
 * Mirrors the source sheet's `end_date - ('Carat Calculator'!$G$25 + 1)`, where
 * G25 is its "Filter End Date / Days" setting (3, so the offset is 4).
 */
const THROUGHOUT_END_OFFSET_DAYS = 4

/**
 * Grace period on the crediting filter: a banner's throughout carats count
 * toward a projection checkpoint if the banner ends no more than this many days
 * AFTER it. Mirrors the sheet's `>= rowEnd - $AQ$32`, described there as
 * letting the filter "get data from other banners with similar end dates".
 *
 * Fitted to 4 by matching the sheet's published per-banner figures; its own
 * settings cell reads 3, so one of the offsets above may be absorbing a day.
 * Confirm before treating this as authoritative.
 */
export const THROUGHOUT_FILTER_GRACE_DAYS = 4

// ── Pull costs ────────────────────────────────────────────────────────────────

/**
 * Shards needed to build one uncap crystal. Applies to both SR and SSR.
 * Shared by the Uncap Crystals panel and the per-banner projection.
 */
export const SHARDS_PER_CRYSTAL = 20

/** Carat cost of a single standard pull (after free pulls are consumed). */
export const PULL_COST_CARATS = 150

/**
 * Carat cost of a single "discounted paid pull" — a once-per-day option that
 * spends PAID carats only. Modeled as one discounted pull per day of the
 * banner's window, counted from the banner's start regardless of how much of
 * the window has already elapsed (see useBannerResources / applyPullStrategy).
 */
export const DISCOUNTED_PULL_COST_CARATS = 50

// ── Monthly shop tickets ──────────────────────────────────────────────────────

/**
 * Gacha tickets buyable from the in-game monthly shop with a currency not
 * tracked in this calculator. When the `monthly_shop_tickets` toggle is on,
 * these are credited each month at no carat cost.
 */
export const MONTHLY_SHOP_UMA_TICKETS = 4
const MONTHLY_SHOP_SUPPORT_TICKETS = 4

/**
 * The most the shop sells in a month. The two above are what the projection
 * ASSUMES a player buys (the sheet's figure); these only cap a count the
 * player sets themselves.
 */
const MONTHLY_SHOP_UMA_TICKETS_MAX = 9
const MONTHLY_SHOP_SUPPORT_TICKETS_MAX = 9

/**
 * Day of the month the shop stocks the bundle. Deliberately NOT the 1st: these
 * used to be counted with the same month-boundary helper as Club Rank income,
 * which credited them a day early and could hand a banner ending on the 1st a
 * bundle it can't actually buy yet.
 */
const MONTHLY_SHOP_TICKET_DAY = 2

// ── Training Pass monthly reward ──────────────────────────────────────────────

/**
 * The Training Pass feature (both paid and free tiers) does not exist until
 * this date. No training pass income should be calculated before it.
 */
const TRAINING_PASS_START_DATE = new Date(2027, 7, 15) // August 15, 2027

/**
 * The paid Training Pass's monthly carats, split across the two balances the
 * projection tracks. Like the Daily Carat Pack above, part of the reward is
 * purchased currency: 350 of the 2,200 arrive as PAID carats (the only kind
 * that can buy discounted pulls), the other 1,850 as ordinary free carats.
 */
export const TRAINING_PASS_MONTHLY_PAID_CARATS = 350
export const TRAINING_PASS_MONTHLY_FREE_CARATS = 1850

/**
 * Monthly carat reward for the free tier of the Training Pass.
 * Awarded once per calendar month, but only after TRAINING_PASS_START_DATE.
 * Free carats only — the paid split above is a paid-tier perk.
 */
export const MONTHLY_BASE_REWARD = 500

/**
 * Gacha tickets from the Training Pass, delivered on the 24th of the month.
 *
 * Unlike the carat reward (paid tier REPLACES the free tier's 500), the tickets
 * are additive: every account gets the FREE amount once the feature launches,
 * and an active paid pass adds the PAID_BONUS on top — 2 + 2 = 4 of each type
 * per month. Kept as separate free/bonus constants rather than one "paid total"
 * so a future balance change to either tier is a single-number edit.
 */
const TRAINING_PASS_FREE_UMA_TICKETS = 2
const TRAINING_PASS_FREE_SUPPORT_TICKETS = 2
const TRAINING_PASS_PAID_BONUS_UMA_TICKETS = 2
const TRAINING_PASS_PAID_BONUS_SUPPORT_TICKETS = 2

/**
 * SSR uncap shards from an ACTIVE paid Training Pass, on the same monthly clock
 * as its carats and tickets.
 *
 * Deliberately NOT a free/bonus pair like the tickets above: the free tier
 * earns no shards at all, so there is nothing to add this to. If that ever
 * changes it wants a `TRAINING_PASS_FREE_SSR_SHARDS` beside it rather than a
 * conditional here.
 */
export const TRAINING_PASS_PAID_SSR_SHARDS = 1

/**
 * ── Defaults for the admin-editable constants ────────────────────────────────
 *
 * `/calculator-data` serves the live values from the `CalculationConstants`
 * singleton; this object is what the app falls back to when that key is absent —
 * a fresh database, an older API, or a deploy where the two sides are briefly
 * out of step. The provider overlays the server's values on top of these.
 *
 * Every entry is built from the literals above rather than restated, so the
 * defaults cannot drift from what the legacy engine uses while both still ship.
 * The backend model's own field defaults are the third copy of these numbers;
 * `CalculationConstantsTests.test_defaults_match_the_current_calibration` pins
 * the two that matter most.
 */
export const DEFAULT_CONSTANTS: CalculationConstants = {
	daily_base_carats: DAILY_BASE_CARATS,
	// The blended weekly total: three weekday bonuses plus one weekend bonus.
	weekly_bonus_carats: WEEKDAY_BONUS_CARATS * 3 + WEEKEND_BONUS_CARATS,

	daily_carat_pack_per_day: DAILY_CARAT_PACK_PER_DAY,
	daily_carat_pack_paid_carats: DAILY_CARAT_PACK_PAID_CARATS,
	daily_carat_pack_cycle_days: DAILY_CARAT_PACK_CYCLE_DAYS,
	// Rebuilt from the local-midnight Date above as a plain ISO calendar day,
	// which is what the API sends and what the UTC engine wants.
	training_pass_start_date: [
		TRAINING_PASS_START_DATE.getFullYear(),
		String(TRAINING_PASS_START_DATE.getMonth() + 1).padStart(2, "0"),
		String(TRAINING_PASS_START_DATE.getDate()).padStart(2, "0"),
	].join("-"),
	training_pass_monthly_free_carats: TRAINING_PASS_MONTHLY_FREE_CARATS,
	training_pass_monthly_paid_carats: TRAINING_PASS_MONTHLY_PAID_CARATS,
	monthly_base_reward: MONTHLY_BASE_REWARD,
	training_pass_free_uma_tickets: TRAINING_PASS_FREE_UMA_TICKETS,
	training_pass_free_support_tickets: TRAINING_PASS_FREE_SUPPORT_TICKETS,
	training_pass_paid_bonus_uma_tickets: TRAINING_PASS_PAID_BONUS_UMA_TICKETS,
	training_pass_paid_bonus_support_tickets: TRAINING_PASS_PAID_BONUS_SUPPORT_TICKETS,
	training_pass_paid_ssr_shards: TRAINING_PASS_PAID_SSR_SHARDS,

	// The sheet models this as a MONTHLY figure and drips it as monthly/30;
	// MISC_EARNINGS_PER_DAY is the legacy engine's per-day equivalent.
	misc_earnings_monthly: MISC_EARNINGS_PER_DAY * 30,
	misc_earnings_delay_days: MISC_EARNINGS_DELAY_DAYS,
	fifty_day_login_carats: FIFTY_DAY_LOGIN_PER_CYCLE,
	fifty_day_login_cycle_days: FIFTY_DAY_LOGIN_CYCLE_DAYS,
	valentines_carats: VALENTINES_CARATS,
	// The legacy constants are 0-indexed to match Date.getMonth(); the API is
	// 1-indexed, as a human editing the admin page would expect.
	valentines_month: VALENTINES_MONTH + 1,
	valentines_day: VALENTINES_DAY,
	white_day_carats: WHITE_DAY_CARATS,
	white_day_month: WHITE_DAY_MONTH + 1,
	white_day_day: WHITE_DAY_DAY,
	monthly_shop_uma_tickets: MONTHLY_SHOP_UMA_TICKETS,
	monthly_shop_support_tickets: MONTHLY_SHOP_SUPPORT_TICKETS,
	monthly_shop_uma_tickets_max: MONTHLY_SHOP_UMA_TICKETS_MAX,
	monthly_shop_support_tickets_max: MONTHLY_SHOP_SUPPORT_TICKETS_MAX,
	monthly_shop_restock_day: MONTHLY_SHOP_TICKET_DAY,

	pull_cost_carats: PULL_COST_CARATS,
	discounted_pull_cost_carats: DISCOUNTED_PULL_COST_CARATS,
	shards_per_crystal: SHARDS_PER_CRYSTAL,

	// The ladder repeats every five steps, so these five are the whole thing.
	step_up_cost_step_1: 500,
	step_up_cost_step_2: 700,
	step_up_cost_step_3: 1000,
	step_up_cost_step_4: 1300,
	step_up_cost_step_5: 1500,
	step_up_pulls_per_step: 10,
	// 3% total ★3/SSR rate spread across the 10 selected cards.
	step_up_target_rate: 0.003,
	step_up_max_rounds: 7,

	// From the global client's own gacha table: each rate-up card gets its
	// rarity's rate, unless the rate-ups would share more than the pool.
	rate_up_rate_3: 0.0075,
	rate_up_pool_3: 0.03,
	rate_up_rate_2: 0.0225,
	rate_up_pool_2: 0.03,
	rate_up_rate_1: 0.0375,
	rate_up_pool_1: 0.05,

	throughout_end_offset_days: THROUGHOUT_END_OFFSET_DAYS,
	throughout_filter_grace_days: THROUGHOUT_FILTER_GRACE_DAYS,
	throughout_decay_k: 2,
	throughout_decay_linear_slope: 0.8,

	prediction_factor: 0.664,
	game_event_end_buffer_days: GAME_EVENT_END_DATE_BUFFER_DAYS,

	cm_registration_opens_hours: -72,
	cm_round_two_hours: 48,
	cm_finals_registration_closes_hours: 108,
	cm_finals_hours: 120,
	loh_registration_opens_hours: null,
	loh_round_two_hours: null,
	loh_finals_registration_closes_hours: null,
	loh_finals_hours: null,
}
