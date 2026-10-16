/**
 * Guest defaults, and the LAST RELEASE'S sign-in handoff.
 *
 * A guest's plan is kept on the device now: see guestPlanStore.ts for the
 * store and guestPlanImport.ts for what happens to it at sign-in. Three things
 * here are still live: DEFAULT_GUEST_STATS, statsAreDirty and
 * mergeStepUpSelections.
 *
 * TRANSITIONAL, one release: the sessionStorage stash below. Until 2026-10 a
 * guest's plan lived in memory only, and "Sign in to save" snapshotted it here
 * to survive the trip to /login and back. Nothing writes a stash any more, but
 * someone who pressed that button on the old bundle and returned from the
 * provider's consent screen onto the new one has their plan here and nowhere
 * else, so guestPlanImport still READS it. Once that release has shipped,
 * delete stashGuestPlan, readGuestPlanStash and clearGuestPlanStash, and their
 * tests.
 */

import type { UserStats } from "../types"
import type {
	PlannedBannerPayload,
	PlannedPurchasePayload,
	StepUpSelectionPayload
} from "./calculatorFetchCalls"

/**
 * The stats a guest session starts with. Also the baseline for
 * statsAreDirty(): stats that still equal these defaults are never
 * migrated, so they can't clobber real stats on an existing account.
 */
export const DEFAULT_GUEST_STATS: UserStats = {
	current_carat: 0,
	current_paid_carat: 0,
	uma_ticket: 0,
	support_ticket: 0,
	uma_selector_ticket: 0,
	support_selector_ticket: 0,
	daily_carat: false,
	training_pass: false,
	// On by default to mirror the source sheet (and the backend model default),
	// so guest estimates match the sheet out of the box.
	misc_earnings: true,
	// All four projection toggles ship on, matching the backend model defaults.
	monthly_shop_tickets: true,
	// null = the default purchase, the same as the backend's NULL default.
	shop_uma_tickets_bought: null,
	shop_support_tickets_bought: null,
	spend_tickets_on_banners: true,
	discounted_paid_pulls: true,
	full_price_paid_pulls: true,
	// Off so planned purchases stay budgeting-only until explicitly opted into,
	// and estimates never move on their own.
	include_purchases_in_projection: false,
	webstore_bonus: false,
	club_rank: null,
	team_trials_rank: null,
	champions_meeting_rank: null,
	league_of_heroes_rank: null,
	ssr_crystals: 0,
	sr_crystals: 0,
	ssr_shards: 0,
	sr_shards: 0,
	// Taking part in every race event, the same as the backend's {} default.
	skipped_race_events: {}
}

const STASH_KEY = "guestPlanMigration.v1"

// A stash left behind by an abandoned login attempt shouldn't resurface
// days later and overwrite account data the user has since changed.
const STASH_MAX_AGE_MS = 60 * 60 * 1000 // 1 hour

export interface GuestPlanStash {
	version: 1
	createdAt: number
	/** null = guest never touched their stats, so don't migrate them */
	stats: UserStats | null
	/** Already in PATCH shape (FK ids, no id/tempId) — directly mergeable */
	banners: PlannedBannerPayload[]
	/**
	 * Optional so a stash written before this field existed still validates —
	 * the version stays 1 because an absent key degrades to "no purchases",
	 * which is exactly right rather than a reason to discard the whole plan.
	 */
	purchases?: PlannedPurchasePayload[]
	/** Optional for the same reason as `purchases`; absent means "picked none". */
	stepUpSelections?: StepUpSelectionPayload[]
}

/**
 * True if the guest actually changed anything from the defaults.
 * Every field is a flat scalar except `skipped_race_events`, which is an object
 * and so can't be compared with `!==` (a fresh `{}` never equals the default's):
 * it counts as changed when it skips anything.
 */
export function statsAreDirty(stats: UserStats | null): boolean {
	if (!stats) return false
	return (Object.keys(DEFAULT_GUEST_STATS) as (keyof UserStats)[]).some((key) =>
		key === "skipped_race_events"
			? Object.values(stats.skipped_race_events ?? {}).some((ids) => ids.length > 0)
			: stats[key] !== DEFAULT_GUEST_STATS[key]
	)
}

/**
 * Snapshots the guest's plan before navigating to /login.
 * Writes nothing (and clears any stale stash) when there's nothing worth
 * migrating. sessionStorage can throw (e.g. some private-browsing modes) —
 * in that case the user just logs in without a migration, which beats crashing.
 */
export function stashGuestPlan(
	stats: UserStats | null,
	banners: PlannedBannerPayload[],
	purchases: PlannedPurchasePayload[] = [],
	stepUpSelections: StepUpSelectionPayload[] = []
): void {
	try {
		const dirtyStats = statsAreDirty(stats) ? stats : null
		if (
			!dirtyStats &&
			banners.length === 0 &&
			purchases.length === 0 &&
			stepUpSelections.length === 0
		) {
			sessionStorage.removeItem(STASH_KEY)
			return
		}
		const stash: GuestPlanStash = {
			version: 1,
			createdAt: Date.now(),
			stats: dirtyStats,
			banners,
			purchases,
			stepUpSelections
		}
		sessionStorage.setItem(STASH_KEY, JSON.stringify(stash))
	} catch {
		// Storage unavailable — skip the handoff rather than break navigation.
	}
}

/**
 * Reads and validates the stash. Malformed or expired entries are
 * removed and treated as absent.
 */
export function readGuestPlanStash(): GuestPlanStash | null {
	try {
		const raw = sessionStorage.getItem(STASH_KEY)
		if (!raw) return null

		const parsed: unknown = JSON.parse(raw)
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			(parsed as GuestPlanStash).version !== 1 ||
			!Array.isArray((parsed as GuestPlanStash).banners) ||
			typeof (parsed as GuestPlanStash).createdAt !== "number"
		) {
			sessionStorage.removeItem(STASH_KEY)
			return null
		}

		const stash = parsed as GuestPlanStash
		if (Date.now() - stash.createdAt > STASH_MAX_AGE_MS) {
			sessionStorage.removeItem(STASH_KEY)
			return null
		}
		return stash
	} catch {
		return null
	}
}

export function clearGuestPlanStash(): void {
	try {
		sessionStorage.removeItem(STASH_KEY)
	} catch {
		// Nothing to do — worst case the stale-age guard cleans it up later.
	}
}
/**
 * Merge the guest's step-up selections into the account's for the migration PATCH.
 *
 * Per STEP-UP, not per row: the guest's picks for a banner are kept only when
 * the account has none for that banner. Same conflict rule as banners — keep
 * what is saved, add what the guest built — but applied at the banner level
 * because rows here are not independent.
 *
 * That granularity is load-bearing rather than tidy. UserStepUpSelection carries
 * a unique (user, banner_step_up, slot) index, so concatenating two partial
 * selections for the same step-up would collide on slot 1 and the server would
 * reject the WHOLE PATCH — stats, banners and purchases with it — and the user
 * would land on their account with the migration silently failed. Interleaving
 * the two into free slots would be worse still: it would invent a ten-card
 * selection that neither side chose.
 */
export function mergeStepUpSelections(
	account: StepUpSelectionPayload[],
	guest: StepUpSelectionPayload[]
): StepUpSelectionPayload[] {
	const claimed = new Set(account.map((selection) => selection.banner_step_up))
	return [
		...account,
		...guest.filter((selection) => !claimed.has(selection.banner_step_up))
	]
}
