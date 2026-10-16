/**
 * The guest's plan, kept on this device.
 *
 * A guest's plan used to live in React state alone and a reload discarded it.
 * It now persists in localStorage under one key, and that is the WHOLE of guest
 * saving: nothing about a guest reaches the server. An account is what puts a
 * plan on every device; this is what keeps it on one.
 *
 * THREE RULES THIS FILE EXISTS TO HOLD
 *
 * 1. IDS, NEVER OBJECTS. A planned row in state carries the whole banner
 *    (name, image, predicted dates). Storing that would freeze the dates on the
 *    day of the save, and income is a function of a banner's end date, so a
 *    stale date is a wrong carat number. The store holds the PATCH shape
 *    (toBannerPayload and friends: FK ids only) and guestPlanToState() rebuilds
 *    the rows from the catalogue that was fetched a moment ago.
 *
 * 2. ONLY WHAT WAS TYPED WHILE SIGNED OUT. Account data is never written here,
 *    not on sign-out and not as a cache. Someone who signs out on a shared
 *    computer leaves nothing behind. CalculatorProvider enforces it by
 *    deciding guest-or-account once, at load (see `loadedAsRef` there).
 *
 * 3. LOCALSTORAGE IS NOT DURABLE, AND NOTHING HERE PRETENDS IT IS. Clearing
 *    site data deletes it, Safari deletes script-written storage after seven
 *    days without a visit, and a blocked store throws on every call. So every
 *    call is wrapped, a failed write is REPORTED (writeGuestPlan returns
 *    false) and a damaged entry degrades row by row instead of taking the plan
 *    with it.
 *
 * No expiry, unlike the sessionStorage stash this replaces (guestMigration.ts):
 * that was a one-hour handoff across a sign-in, this is the plan itself.
 */

import type {
	AnniversaryEvent,
	BannerStepUp,
	BannerSupport,
	BannerUma,
	LocalPlannedBanner,
	UserPlannedPurchase,
	UserStats,
	UserStepUpSelection
} from "../types"
import type {
	PlannedBannerPayload,
	PlannedPurchasePayload,
	StepUpSelectionPayload
} from "./calculatorFetchCalls"
import { DEFAULT_GUEST_STATS, statsAreDirty } from "./guestMigration"
import { isTargetCopies } from "../utils/probabilityCalculations"
import { readSkippedRaceEvents } from "../utils/raceParticipation"
import { isPaidCaratUse } from "../utils/rowOptions"

const STORAGE_KEY = "guestPlan.v1"

export interface GuestPlan {
	version: 1
	/** When it was last written. Informational; nothing expires on it. */
	savedAt: number
	/** null = the guest never moved a stat off its default. */
	stats: UserStats | null
	/** PATCH shape with no `id`: every row is a create when it is imported. */
	banners: PlannedBannerPayload[]
	purchases: PlannedPurchasePayload[]
	stepUpSelections: StepUpSelectionPayload[]
	/**
	 * Set when the server REFUSED this plan at sign-in (a 4xx). Retrying the
	 * same body would fail on every page load, and deleting the plan would lose
	 * work over what may be one bad row, so it stays on the device and the
	 * import is skipped while this is set. The next guest edit rewrites the
	 * entry without the flag, which is what earns another attempt.
	 */
	importBlocked?: true
}

const isIdOrNull = (value: unknown): value is number | null =>
	value === null || (typeof value === "number" && Number.isFinite(value))

const isCount = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value)

/**
 * Each validator REBUILDS the row from the fields it checked rather than
 * passing the parsed object through. Anything else that got into storage (an
 * `id` from a row that was once saved, a key a later bundle added) stays out of
 * a PATCH body that way.
 */
function readBanner(raw: unknown): PlannedBannerPayload | null {
	if (typeof raw !== "object" || raw === null) return null
	const row = raw as Record<string, unknown>
	if (!isCount(row.number_of_pulls) || !isCount(row.reserved_copies)) return null
	if (
		!isIdOrNull(row.banner_uma) ||
		!isIdOrNull(row.banner_support) ||
		!isIdOrNull(row.banner_step_up)
	) {
		return null
	}
	return {
		number_of_pulls: row.number_of_pulls,
		reserved_copies: row.reserved_copies,
		...(typeof row.note === "string" && row.note !== "" ? { note: row.note } : {}),
		// Kept only when they are real ids. A row stored before two-card odds
		// has neither, and must still load rather than be thrown away.
		...(isCount(row.primary_card) ? { primary_card: row.primary_card } : {}),
		...(isCount(row.second_card) ? { second_card: row.second_card } : {}),
		// And the first card's target only when it is one the strip can show.
		...(isTargetCopies(row.primary_target) ? { primary_target: row.primary_target } : {}),
		// The row options, each kept only when it is a value the option can
		// hold, so a damaged one degrades to its default on its own.
		...(isCount(row.tickets_to_use) ? { tickets_to_use: row.tickets_to_use } : {}),
		...(isPaidCaratUse(row.paid_carat_use) ? { paid_carat_use: row.paid_carat_use } : {}),
		...(isCount(row.pulls_already_made) && row.pulls_already_made > 0
			? { pulls_already_made: row.pulls_already_made }
			: {}),
		...(row.excluded_from_projection === true ? { excluded_from_projection: true } : {}),
		banner_uma: row.banner_uma,
		banner_support: row.banner_support,
		banner_step_up: row.banner_step_up
	}
}

function readPurchase(raw: unknown): PlannedPurchasePayload | null {
	if (typeof raw !== "object" || raw === null) return null
	const row = raw as Record<string, unknown>
	if (!isCount(row.product) || !isCount(row.quantity)) return null
	return {
		product: row.product,
		quantity: row.quantity,
		target_uma: isIdOrNull(row.target_uma) ? row.target_uma : null,
		target_support: isIdOrNull(row.target_support) ? row.target_support : null
	}
}

function readSelection(raw: unknown): StepUpSelectionPayload | null {
	if (typeof raw !== "object" || raw === null) return null
	const row = raw as Record<string, unknown>
	if (!isCount(row.banner_step_up) || !isCount(row.slot)) return null
	if (!isIdOrNull(row.uma) || !isIdOrNull(row.support)) return null
	return {
		banner_step_up: row.banner_step_up,
		uma: row.uma,
		support: row.support,
		slot: row.slot,
		is_target: row.is_target === true
	}
}

/** Keep the rows that validate; one bad row costs that row, not the plan. */
function readRows<T>(raw: unknown, readRow: (row: unknown) => T | null): T[] {
	if (!Array.isArray(raw)) return []
	return raw.map(readRow).filter((row): row is T => row !== null)
}

/**
 * Stored stats laid over the defaults, one KNOWN key at a time.
 *
 * Over the defaults so a stat added after the plan was saved gets its default
 * instead of arriving undefined and turning every total into NaN. Per key and
 * type-checked so a damaged value falls back to its default alone.
 */
function readStats(raw: unknown): UserStats | null {
	if (typeof raw !== "object" || raw === null) return null
	const stored = raw as Record<string, unknown>
	const stats: Record<string, unknown> = { ...DEFAULT_GUEST_STATS }
	for (const [key, fallback] of Object.entries(DEFAULT_GUEST_STATS)) {
		const value = stored[key]
		// The one non-scalar stat, read by its own reader. Any damage there
		// degrades to "skipping nothing" on its own, like a bad scalar does.
		if (key === "skipped_race_events") {
			stats[key] = readSkippedRaceEvents(value) ?? {}
			continue
		}
		const fits =
			typeof fallback === "boolean"
				? typeof value === "boolean"
				: typeof fallback === "number"
					? isCount(value)
					// A null default is a nullable id or count (the ranks, the
					// shop ticket counts).
					: isIdOrNull(value)
		if (fits) stats[key] = value
	}
	return stats as unknown as UserStats
}

/** The plan on this device, or null when there is none worth the name. */
export function readGuestPlan(): GuestPlan | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw) return null
		const parsed: unknown = JSON.parse(raw)
		// An unknown version is left in place, not removed: it may belong to a
		// newer bundle in another tab, and reading as "no plan" is harmless.
		if (
			typeof parsed !== "object" ||
			parsed === null ||
			(parsed as GuestPlan).version !== 1
		) {
			return null
		}
		const envelope = parsed as Record<string, unknown>
		return {
			version: 1,
			savedAt: isCount(envelope.savedAt) ? envelope.savedAt : 0,
			stats: readStats(envelope.stats),
			banners: readRows(envelope.banners, readBanner),
			purchases: readRows(envelope.purchases, readPurchase),
			stepUpSelections: readRows(envelope.stepUpSelections, readSelection),
			...(envelope.importBlocked === true ? { importBlocked: true as const } : {})
		}
	} catch {
		// Blocked storage or unparseable JSON: there is no plan to offer.
		return null
	}
}

/**
 * Write the guest's plan. Resolves to whether it LANDED, because the caller
 * has to tell the guest when this browser will not keep their work.
 *
 * A plan with nothing in it removes the key instead of storing an empty
 * envelope, so "is there a plan on this device" stays a plain null check.
 * Banner payloads are stripped of `id` on the way in: a guest row has none, and
 * one that slipped through would make the sign-in import an UPDATE of a row id
 * the account does not own.
 */
export function writeGuestPlan(
	stats: UserStats | null,
	banners: PlannedBannerPayload[],
	purchases: PlannedPurchasePayload[],
	stepUpSelections: StepUpSelectionPayload[]
): boolean {
	try {
		const dirtyStats = statsAreDirty(stats) ? stats : null
		if (
			!dirtyStats &&
			banners.length === 0 &&
			purchases.length === 0 &&
			stepUpSelections.length === 0
		) {
			localStorage.removeItem(STORAGE_KEY)
			return true
		}
		const plan: GuestPlan = {
			version: 1,
			savedAt: Date.now(),
			stats: dirtyStats,
			banners: banners.map(({ id: _id, ...row }) => row),
			purchases: purchases.map(({ id: _id, ...row }) => row),
			stepUpSelections
		}
		localStorage.setItem(STORAGE_KEY, JSON.stringify(plan))
		return true
	} catch {
		return false
	}
}

export function clearGuestPlan(): void {
	try {
		localStorage.removeItem(STORAGE_KEY)
	} catch {
		// Nothing to clear in a browser that would not store it.
	}
}

/** Stop offering this plan to the server until the guest changes it. See GuestPlan. */
export function blockGuestPlanImport(): void {
	try {
		const plan = readGuestPlan()
		if (!plan) return
		const blocked: GuestPlan = { ...plan, importBlocked: true }
		localStorage.setItem(STORAGE_KEY, JSON.stringify(blocked))
	} catch {
		// Unwritable storage: the import is simply offered again next load.
	}
}

/**
 * Watch for ANOTHER TAB changing the plan. Returns an unsubscribe function.
 *
 * The browser fires `storage` in every tab of the origin except the one that
 * wrote, which is exactly the set that is now out of date. Without this, a
 * guest tab opened yesterday would write its old plan over an hour of work
 * done in a newer one the next time anything in it changed.
 *
 * `key === null` is what the browser sends for localStorage.clear().
 */
export function subscribeToGuestPlan(listener: () => void): () => void {
	const handleStorage = (event: StorageEvent): void => {
		if (event.key === null || event.key === STORAGE_KEY) listener()
	}
	window.addEventListener("storage", handleStorage)
	return () => window.removeEventListener("storage", handleStorage)
}

/** The catalogue a stored plan is rebuilt against: today's /calculator-data. */
export interface GuestPlanCatalogue {
	banner_uma_data: BannerUma[]
	banner_support_data: BannerSupport[]
	banner_step_up_data?: BannerStepUp[]
	anniversary_event_data?: AnniversaryEvent[]
	club_rank_data: { id: number }[]
	team_trials_rank_data: { id: number }[]
	champions_meeting_rank_data: { id: number }[]
	league_of_heroes_rank_data: { id: number }[]
}

export interface GuestPlanState {
	stats: UserStats
	banners: LocalPlannedBanner[]
	purchases: UserPlannedPurchase[]
	stepUpSelections: UserStepUpSelection[]
}

/**
 * A stored plan (or none) as the rows the calculator renders: the inverse of
 * toBannerPayload / toPurchasePayload / toStepUpSelectionPayload.
 *
 * Everything is resolved against the catalogue passed in, and a row whose
 * banner, product or step-up has left it is DROPPED rather than kept as a
 * dangling id. That is not only tidiness: one id the server does not know
 * would 400 the whole sign-in import, taking every good row with it. A rank
 * that no longer exists reads as "no rank" for the same reason.
 *
 * tempIds are positions (1-based). They only have to be unique within the
 * list, and nextTempId() counts up from the highest one it finds.
 */
export function guestPlanToState(
	plan: GuestPlan | null,
	catalogue: GuestPlanCatalogue
): GuestPlanState {
	const stats: UserStats = { ...DEFAULT_GUEST_STATS, ...(plan?.stats ?? {}) }
	if (!plan) return { stats, banners: [], purchases: [], stepUpSelections: [] }

	const knownRank = (id: number | null, ranks: { id: number }[]): number | null =>
		id !== null && ranks.some((rank) => rank.id === id) ? id : null
	stats.club_rank = knownRank(stats.club_rank, catalogue.club_rank_data)
	stats.team_trials_rank = knownRank(stats.team_trials_rank, catalogue.team_trials_rank_data)
	stats.champions_meeting_rank = knownRank(
		stats.champions_meeting_rank,
		catalogue.champions_meeting_rank_data
	)
	stats.league_of_heroes_rank = knownRank(
		stats.league_of_heroes_rank,
		catalogue.league_of_heroes_rank_data
	)

	const stepUps = catalogue.banner_step_up_data ?? []
	const banners: LocalPlannedBanner[] = []
	for (const row of plan.banners) {
		// The first id that is set names the row's target, in the same order
		// plannedBannerTarget() reads them. A row with none was never stored
		// (toBannerPayload drops it), so "no match" always means "gone".
		const target =
			row.banner_uma !== null
				? { banner_uma: catalogue.banner_uma_data.find((b) => b.id === row.banner_uma) }
				: row.banner_support !== null
					? { banner_support: catalogue.banner_support_data.find((b) => b.id === row.banner_support) }
					: row.banner_step_up !== null
						? { banner_step_up: stepUps.find((b) => b.id === row.banner_step_up) }
						: {}
		if (!Object.values(target)[0]) continue
		banners.push({
			tempId: banners.length + 1,
			number_of_pulls: row.number_of_pulls,
			reserved_copies: row.reserved_copies,
			...(row.note ? { note: row.note } : {}),
			...(row.primary_card != null ? { primary_card: row.primary_card } : {}),
			...(row.second_card != null ? { second_card: row.second_card } : {}),
			...(row.primary_target != null ? { primary_target: row.primary_target } : {}),
			...(row.tickets_to_use != null ? { tickets_to_use: row.tickets_to_use } : {}),
			...(row.paid_carat_use != null ? { paid_carat_use: row.paid_carat_use } : {}),
			...(row.pulls_already_made ? { pulls_already_made: row.pulls_already_made } : {}),
			...(row.excluded_from_projection ? { excluded_from_projection: true } : {}),
			...target
		})
	}

	const productIds = new Set(
		(catalogue.anniversary_event_data ?? []).flatMap((event) =>
			event.products.map((product) => product.id)
		)
	)
	const purchases: UserPlannedPurchase[] = plan.purchases
		.filter((purchase) => productIds.has(purchase.product))
		.map((purchase, index) => ({
			tempId: index + 1,
			product: purchase.product,
			quantity: purchase.quantity,
			target_uma: purchase.target_uma,
			target_support: purchase.target_support
		}))

	const stepUpIds = new Set(stepUps.map((stepUp) => stepUp.id))
	const stepUpSelections: UserStepUpSelection[] = plan.stepUpSelections.filter(
		(selection) => stepUpIds.has(selection.banner_step_up)
	)

	return { stats, banners, purchases, stepUpSelections }
}
