import type { BannerUma, BannerSupport, BannerStepUp } from "./banner"

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
	monthly_shop_tickets: boolean
	discounted_paid_pulls: boolean
	full_price_paid_pulls: boolean
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
