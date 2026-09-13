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
	/**
	 * The picture this provider holds for the person: an https URL on the
	 * provider's own CDN, or "" when they have none there. The server refreshes
	 * it on every sign-in or link through this provider, so it follows the
	 * picture they currently have rather than the first one we saw.
	 */
	avatar_url: string
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
	/**
	 * The name they chose on the account page, or "" when they have not. Never
	 * null: "" is the stored value, and the UI shows the handle in its place.
	 * Shown to the owner alone; the server never puts it on a public route.
	 */
	display_name: string
	/**
	 * The picture for the navbar, chosen by the server: the uma they picked if
	 * any, else the one from the provider most recently signed in with. `null`
	 * when neither exists — null rather than "" so a component branches to its
	 * fallback instead of trying to load an empty `src`.
	 */
	avatar_url: string | null
	/**
	 * The id of the uma they picked as their picture, or null when the provider
	 * picture is in use. The page needs it to show the current pick and to
	 * offer the provider picture as the way back.
	 */
	avatar_uma: number | null
	linked_providers: LinkedProvider[]
	supporter: SupporterStatus
}

/**
 * The body of PATCH /account. Partial: send only what changed. The server
 * writes these two fields and ignores anything else in the body.
 */
export interface AccountPreferencesPatch {
	display_name?: string
	avatar_uma?: number | null
}

/**
 * One row of GET /umas: what the avatar picker needs to draw a tile. The route
 * lists only umas that have an image, so `image` is never "".
 */
export interface AvatarUmaOption {
	id: number
	name: string
	image: string
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
