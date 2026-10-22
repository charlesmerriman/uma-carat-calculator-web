import type { BannerUma, BannerSupport, BannerStepUp } from "./banner"
import type { LedgerRowKind } from "./ledger"

/**
 * Race events the player is NOT taking part in, as event ids per ledger race
 * kind. Empty or absent = taking part in everything. Read and change it only
 * through utils/raceParticipation, which also owns where the skip is applied.
 */
export type SkippedRaceEvents = Partial<Record<Exclude<LedgerRowKind, "event">, number[]>>

/**
 * A row's paid-carat override (UserPlannedBanner.paid_carat_use): no paid
 * carats at all, the once-a-day 50-carat discount pull only, or both the
 * discount and full-price pulls.
 */
export type PaidCaratUse = "none" | "discount" | "all"

/**
 * Represents the user's current resources and income settings.
 * The rank fields store FK ids that reference rank objects. They are
 * nullable because the backend FKs are nullable — new accounts and
 * guests start with no ranks selected.
 */
export interface UserStats {
	current_carat: number
	current_paid_carat: number
	uma_ticket: number
	support_ticket: number
	/**
	 * Selector tickets — NOT gacha tickets. uma_ticket/support_ticket above are
	 * each worth one pull and get spent by the pull strategy; a selector takes a
	 * specific card outright and never funds a pull.
	 *
	 * These are current holdings, treated as unrestricted (no JP cutoff). Tickets
	 * projected from campaigns carry their campaign's cutoff instead — see
	 * SelectorTicketBucket in utils/selectorTickets.
	 */
	uma_selector_ticket: number
	support_selector_ticket: number
	daily_carat: boolean
	training_pass: boolean
	misc_earnings: boolean
	/**
	 * The player's own misc earnings per month. null (or absent, from an API
	 * older than the field) means the site's estimate. Read it through
	 * miscEarningsMonthly (utils/cumulativeIncome), never directly.
	 */
	custom_misc_earnings_monthly?: number | null
	monthly_shop_tickets: boolean
	/**
	 * How many of each the player buys from the shop each month. null (or
	 * absent, from an API older than the field) means the default purchase.
	 * Read them through shopTicketsPerMonth (utils/cumulativeIncome), which
	 * resolves the default and clamps to the shop's cap, never directly.
	 */
	shop_uma_tickets_bought?: number | null
	shop_support_tickets_bought?: number | null
	/** Off = tickets are kept as a reserve and never pay for a planned pull. */
	spend_tickets_on_banners: boolean
	discounted_paid_pulls: boolean
	full_price_paid_pulls: boolean
	/**
	 * Take the 50-paid-carat daily pull on every uma / support banner the plan
	 * has no counted row on, up to its farthest banner (utils/backgroundDailyPulls).
	 * Off by default. Optional because an API older than the fields doesn't
	 * send them, and that has to mean off.
	 */
	daily_pulls_other_uma_banners?: boolean
	daily_pulls_other_support_banners?: boolean
	/** Off by default — planned purchases are budgeting-only until switched on. */
	include_purchases_in_projection: boolean
	/** Apply each pack's webstore multiplier. The whole amount stays paid carats. */
	webstore_bonus: boolean
	club_rank: number | null
	team_trials_rank: number | null
	champions_meeting_rank: number | null
	league_of_heroes_rank: number | null
	ssr_crystals: number
	sr_crystals: number
	ssr_shards: number
	sr_shards: number
	/**
	 * Optional because an API older than the field doesn't send it, and that
	 * has to mean "skipping nothing", which is what every plan did before.
	 */
	skipped_race_events?: SkippedRaceEvents
}

/**
 * TYPESCRIPT CONCEPT: Discriminated Unions (done right)
 *
 * A UserPlannedBanner is either:
 *   - "saved" (has an `id` from the database, came from the server)
 *   - "local" (has a `tempId`, exists only in the browser until saved)
 *
 * The original code used a 4-way union with `never` types trying to also enforce
 * that only one of banner_uma/banner_support could be set. That made the type
 * nearly impossible to work with — every access required complex narrowing.
 *
 * The fix: separate the two concerns.
 *   - Saved vs local → enforced by the TYPE SYSTEM (discriminated union below)
 *   - Uma vs support exclusivity → enforced by RUNTIME VALIDATION (the backend
 *     already has a DB constraint for this, and the UI only lets you pick one)
 *
 * Not everything needs to be enforced at the type level. Types should make your
 * code easier to write, not harder.
 *
 * TYPESCRIPT CONCEPT: Why `tempId?: undefined` instead of omitting `tempId`?
 * If we just omitted tempId from SavedPlannedBanner, accessing `banner.tempId`
 * would be a type error — even though we know at runtime it's just undefined.
 * By explicitly including it as `undefined`, we can safely access it on any
 * UserPlannedBanner without narrowing first. Same idea for `id` on local banners.
 * This is a common pattern for "tagged unions" where you want easy property access.
 */

interface BasePlannedBanner {
	number_of_pulls: number
	/**
	 * Copies obtained WITHOUT pulling, using a selector ticket or an SSR crystal.
	 * Only the count is stored — which resource pays is derived per render from
	 * the projected balances and the banner's JP eligibility, so it can never go
	 * stale against them. See allocateReservedCopies in utils/bannerHelpers.
	 */
	reserved_copies: number
	/**
	 * The owner's free-text reminder about this row. Nothing in the projection
	 * reads it. Optional because "no note" is the normal state: the server sends
	 * "" and a locally created row simply has none, so read it as `note ?? ""`.
	 * Capped at NOTE_MAX_LENGTH (components/carat-calculator/BannerNote).
	 */
	note?: string
	/**
	 * Which featured card the odds strip is about, as a card id (an uma id on an
	 * uma row, a support card id on a support row). Null or absent: the banner's
	 * first card of its highest rarity. An id the banner does not feature is
	 * ignored, never an error. Read through `oddsCards()` in utils/rateUpRates.
	 */
	primary_card?: number | null
	/**
	 * A second featured card to show joint odds for ("MLB of the first, and how
	 * many of this one"). Null or absent: two-card odds are off.
	 */
	second_card?: number | null
	/**
	 * How many copies the two-card odds take the first card to before any free
	 * copy (a 200-pull exchange or a reserved copy) goes to the second: 1..5
	 * from the panel's toggle. Null or absent: the default for the banner type
	 * (1 on an uma row, MLB on a support row). Read through `oddsTarget()` in
	 * utils/oddsDisplay, which ignores a value outside 1..5.
	 */
	primary_target?: number | null
	/**
	 * Row options, from the panel under the row. Each is optional because its
	 * absence (an API older than the field, a row staged before it) has to
	 * mean exactly what every row did before it existed. Read them through the
	 * helpers in utils/rowOptions, never raw.
	 *
	 * tickets_to_use: at most this many matching gacha tickets pay for the
	 * row. Null/absent = automatic. A number wins over the global "spend
	 * tickets" switch; 0 holds them all back on this row.
	 */
	tickets_to_use?: number | null
	/** Which paid-carat pulls the row may buy. Null/absent = the global toggles. */
	paid_carat_use?: PaidCaratUse | null
	/**
	 * Pulls ALREADY made on this live banner. Free in the projection (those
	 * carats have left the typed-in balance); they only move the 200-pull
	 * exchange the odds and the pity colouring count. Absent = 0.
	 */
	pulls_already_made?: number
	/** The row stays in the plan but spends nothing. Absent = false. */
	excluded_from_projection?: boolean
	banner_uma?: BannerUma | null
	banner_support?: BannerSupport | null
	/**
	 * Third banner target. Exactly one of the three FKs is set on a row that has
	 * a banner selected — a DB check constraint enforces it server-side — but
	 * that exclusivity is NOT expressed in this type. See the note above on why
	 * uma-vs-support exclusivity is validated at runtime rather than in the type
	 * system; a third member only sharpens the point. Narrow with
	 * `plannedBannerTarget()` in utils/bannerHelpers, never by property sniffing.
	 */
	banner_step_up?: BannerStepUp | null
	/**
	 * What kind of banner this row is for, on a row that has not chosen one yet.
	 * Set when the row is staged; server-loaded rows carry an FK instead and
	 * don't need it. Read it through `plannedBannerRowType()`, which prefers the
	 * FK when there is one.
	 */
	initialBannerType?: "Uma" | "Support" | "StepUp"
}

export interface SavedPlannedBanner extends BasePlannedBanner {
	id: number
	tempId?: undefined
	user: number
	/**
	 * The plan this row belongs to. Read-only on the server: where a row is
	 * saved is decided by the PATCH's top-level `plan_id`, never by this.
	 * Optional because an API from before plans existed does not send it.
	 */
	plan?: number | null
}

export interface LocalPlannedBanner extends BasePlannedBanner {
	id?: undefined
	tempId: number
	user?: undefined
}

export type UserPlannedBanner = SavedPlannedBanner | LocalPlannedBanner

/**
 * TYPESCRIPT CONCEPT: Type Guards
 *
 * A type guard is a function that narrows a union type. The return type
 * `banner is SavedPlannedBanner` tells TypeScript: "if this function
 * returns true, treat the argument as SavedPlannedBanner from here on."
 *
 * Usage:
 *   if (isSavedBanner(banner)) {
 *     console.log(banner.id)    // TypeScript knows `id` is `number` here
 *     console.log(banner.user)  // TypeScript knows `user` is `number` here
 *   }
 */
export function isSavedBanner(
	banner: UserPlannedBanner
): banner is SavedPlannedBanner {
	return banner.id !== undefined
}

export function isLocalBanner(
	banner: UserPlannedBanner
): banner is LocalPlannedBanner {
	return banner.tempId !== undefined
}

/**
 * One of the ten cards the user intends to select at a Select Step-Up banner.
 *
 * Keyed to the BANNER, not to a planned row: "which ten would I pick here" is a
 * fact about the banner, so it needs no plan to exist and survives one being
 * deleted. That keying is also what keeps this a flat collection in the PATCH
 * body — see backend/docs/api-reference.md.
 *
 * `is_target` marks the STEP 5 pick, the copy the player chooses outright
 * rather than being handed at random. At most one per banner.
 *
 * Exactly one of `uma` / `support` is set, matching the step-up's `card_type`.
 * An empty slot is an ABSENT row, never a row with both nulls — the server's
 * exactly_one_selection_card constraint refuses the latter.
 *
 * NOTHING IN THE PROJECTION READS THIS. The step-up target rate is 3% / 10 and
 * holds whichever ten are chosen, so a partial or empty selection changes no
 * number. It is a planning record, exactly as on the source sheet, whose
 * Selection 1-10 columns feed no formula either. A selection is also NOT a
 * reserved copy: a reserved copy is one taken INSTEAD of pulling, funded by a
 * ticket or crystal; these are candidates for pulls already being paid for.
 */
export interface UserStepUpSelection {
	/** Present on rows from the server. Never sent back — see toStepUpSelectionPayload. */
	id?: number
	banner_step_up: number
	uma: number | null
	support: number | null
	/** 1-based, 1..STEP_UP_SELECTION_SLOTS. */
	slot: number
	is_target: boolean
}
