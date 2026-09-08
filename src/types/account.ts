/**
 * Types for GET /account — the signed-in user's identity and entitlement.
 *
 * Kept separate from types/user.ts on purpose. That file describes the PLAN a
 * user is building (stats, planned banners, tickets); this one describes the
 * ACCOUNT itself. They change for entirely different reasons.
 */

/** One identity the account can sign in with. */
export interface LinkedProvider {
	/**
	 * The raw stored value — "google", "discord", later "patreon". Not a display
	 * label: how to spell it for a human is the UI's decision, and matching on a
	 * label would break the moment one is reworded.
	 */
	provider: string
	/** ISO date (not a timestamp) — the API deliberately emits day precision. */
	linked_at: string
}

/**
 * Patreon entitlement, derived by the server on every request.
 *
 * `tier` and `benefits` are optional because they are genuinely ABSENT rather
 * than null: when there is no entitlement the API sends `is_supporter` and
 * nothing else, so a client cannot read an empty tier as a tier or an empty
 * benefits list as "checked, and they have none". TypeScript makes you handle
 * the absence.
 *
 * There is no tier ORDER here on purpose. Ordering tiers is internal
 * arithmetic, and the server has already done it to produce `benefits` — a
 * client comparing numbers would be a second implementation of the paywall,
 * free to disagree with the real one.
 */
export interface SupporterStatus {
	is_supporter: boolean
	/** The tier's display name, for a badge. Absent unless `is_supporter`. */
	tier?: string
	/**
	 * Keys of the capabilities this account has, e.g. "ad_free". Gate on a key
	 * being present, never on the tier name — renaming a tier on Patreon is the
	 * page owner's business and must not turn a feature off.
	 */
	benefits?: string[]
}

export interface Account {
	/** The generated handle ("user_a3f9c1"). Never a real name — see the API. */
	username: string
	linked_providers: LinkedProvider[]
	supporter: SupporterStatus
}

/**
 * How far the account lookup has got.
 *
 * This exists as its own axis because "we don't know yet" and "not a supporter"
 * must never collapse into the same value. The ad loader in Phase 3 has to FAIL
 * OPEN — show ads unless we positively know the viewer is a supporter — and it
 * can only express that if it can tell `loading` and `error` apart from `ready`.
 *
 *   anonymous — no token; no request was made (most traffic, costs nothing)
 *   loading   — token present, /account in flight
 *   ready     — `account` is populated and current
 *   error     — the request failed or the server errored; `account` stays null
 */
export type AccountStatus = "anonymous" | "loading" | "ready" | "error"
