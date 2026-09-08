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
 * Patreon entitlement.
 *
 * `is_supporter` is the ONLY key the API sends today, and it is always false —
 * nothing can be a supporter until the backend can match a site account to a
 * patron (Phase 2 of patreon-accounts-plan.md).
 *
 * The tier fields below are optional because they are genuinely absent rather
 * than null: the API omits them entirely when there is no entitlement, so that
 * a client cannot read an empty tier as a tier. Declaring them now means Phase 2
 * changes no types and TypeScript already forces callers to handle the absence.
 */
export interface SupporterStatus {
	is_supporter: boolean
	tier_name?: string
	tier_order?: number
	since?: string
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
