/**
 * Every tunable number the projection uses, as served by `/calculator-data`.
 *
 * Mirrors `CalculationConstantsSerializer`
 * (`backend/calculatorapi/views/calculation_constants.py`), which is generated
 * from the `CalculationConstants` model — read that model for what each field
 * means and which sheet cell it corresponds to.
 *
 * Field names stay snake_case to match the wire format exactly. A camelCase
 * mapping layer would be 35 more lines whose only job is to be a place for a
 * typo to hide.
 *
 * The decimal-valued fields arrive as NUMBERS, not DRF's default decimal
 * strings — the serializer coerces them, because `"0.664" * 2` is a silent NaN
 * in JavaScript rather than an error.
 */
export interface CalculationConstants {
	// Daily income
	daily_base_carats: number
	/** TOTAL weekly login bonus, smeared across seven days rather than paid on specific ones. */
	weekly_bonus_carats: number

	// Packs & passes
	daily_carat_pack_per_day: number
	daily_carat_pack_paid_carats: number
	daily_carat_pack_cycle_days: number
	/** ISO date (YYYY-MM-DD) the Training Pass launches on Global. */
	training_pass_start_date: string
	training_pass_monthly_free_carats: number
	training_pass_monthly_paid_carats: number
	monthly_base_reward: number
	training_pass_free_uma_tickets: number
	training_pass_free_support_tickets: number
	training_pass_paid_bonus_uma_tickets: number
	training_pass_paid_bonus_support_tickets: number
	/** SSR uncap shards per month from an ACTIVE paid pass. The free tier gets none. */
	training_pass_paid_ssr_shards: number

	// Login campaigns & annual gifts
	misc_earnings_monthly: number
	misc_earnings_delay_days: number
	fifty_day_login_carats: number
	fifty_day_login_cycle_days: number
	valentines_carats: number
	/** 1-12, NOT the 0-indexed value Date.getUTCMonth() returns. */
	valentines_month: number
	valentines_day: number
	white_day_carats: number
	white_day_month: number
	white_day_day: number
	monthly_shop_uma_tickets: number
	monthly_shop_support_tickets: number
	/** The most the shop sells a month; the two above are the DEFAULT purchase. */
	monthly_shop_uma_tickets_max: number
	monthly_shop_support_tickets_max: number
	monthly_shop_restock_day: number

	// Pull costs & uncap
	pull_cost_carats: number
	discounted_pull_cost_carats: number
	shards_per_crystal: number

	// Step-up banners
	/**
	 * The five costs of one Select Step-Up ladder, in paid carats. They repeat
	 * every five steps, so these five describe a ladder of any length:
	 * cost(n) = floor(n / 5) * 5000 + the partial sum of the first n % 5.
	 */
	step_up_cost_step_1: number
	step_up_cost_step_2: number
	step_up_cost_step_3: number
	step_up_cost_step_4: number
	step_up_cost_step_5: number
	/** Pulls per step. Each step is a 10-pull. */
	step_up_pulls_per_step: number
	/**
	 * Per-pull chance of the ONE card being chased: the game's ~3% total rate
	 * spread across the 10 cards the player selected. Derived from the pool
	 * size, not an independent dial. Compare a typical banner's 0.75% rate-up.
	 */
	step_up_target_rate: number
	/**
	 * Safety bound on completed ladders, NOT the live constraint — real cost and
	 * odds clamp at a banner's own banner_count * 5, which is always lower.
	 */
	step_up_max_rounds: number

	// Rate-up rates
	/**
	 * One rate-up card's per-pull chance on an ordinary banner, by rarity
	 * (3 = ★3/SSR, 2 = ★2/SR, 1 = ★1/R), and the most that rarity's rate-ups can
	 * share between them. Decimals: 0.0075 is 0.75%. The rule that combines them
	 * is utils/rateUpRates.ts.
	 */
	rate_up_rate_3: number
	rate_up_pool_3: number
	rate_up_rate_2: number
	rate_up_pool_2: number
	rate_up_rate_1: number
	rate_up_pool_1: number

	// Throughout-carat decay curve
	throughout_end_offset_days: number
	throughout_filter_grace_days: number
	throughout_decay_k: number
	throughout_decay_linear_slope: number

	// Global date prediction (used server-side; served for reference)
	prediction_factor: number
	game_event_end_buffer_days: number

	// PvP milestones: hours after a Champions Meeting / League of Heroes start
	// date (negative = before it). Round 1 IS the start date. League of Heroes'
	// four are null until its schedule is known; the PvP page shows a date
	// only for the ones that are set (utils/pvpGuide.ts, `milestones`).
	cm_registration_opens_hours: number
	cm_round_two_hours: number
	cm_finals_registration_closes_hours: number
	cm_finals_hours: number
	loh_registration_opens_hours: number | null
	loh_round_two_hours: number | null
	loh_finals_registration_closes_hours: number | null
	loh_finals_hours: number | null
}
