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
 * One of a supporter's oshis: a uma they picked, in the order they picked
 * them. The first is their picture. The server lists EVERY stored row, covered
 * by the current tier or not, so the page can grey out the ones a downgrade
 * stopped covering rather than pretend they are gone; `oshi_slots` on the
 * account says how many are covered.
 */
export interface Oshi {
	/** 0-based rank in the list. 0 is the picture. */
	position: number
	id: number
	name: string
	/** The storage URL of the uma's art, or "" if an editor has since cleared it. */
	image: string
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
	 * The picture for the navbar, chosen by the server: the first oshi's art
	 * while the account's tier covers at least one slot, else `null`. Free
	 * accounts always get null — the picture IS the supporter perk. Null rather
	 * than "" so a component branches to its default instead of trying to load
	 * an empty `src`. No provider picture is ever held or served.
	 */
	avatar_url: string | null
	/** Every oshi they hold, first to last. Empty for a free account. */
	oshis: Oshi[]
	/**
	 * How many oshis the current tier covers: 5, 3 or 1 by tier, 0 for a free
	 * account. A count the server has already resolved from its ladder, not a
	 * tier order — draw this many tiles and do no arithmetic. Top-level rather
	 * than inside `supporter` because 0 is a real answer the page needs even
	 * when there is no entitlement block to put it in.
	 */
	oshi_slots: number
	linked_providers: LinkedProvider[]
	supporter: SupporterStatus
}

/**
 * The body of PATCH /account. Partial: send only what changed. The server
 * writes these two fields and ignores anything else in the body.
 *
 * `oshis` is the WHOLE ordered list of uma ids, replacing what is stored; the
 * first becomes the picture and `[]` clears them. The server refuses a list
 * that adds past `oshi_slots` (a subset of what is already held may always be
 * reordered or trimmed) and answers with the reason in DRF's per-field shape.
 */
export interface AccountPreferencesPatch {
	display_name?: string
	oshis?: number[]
}

/**
 * One row of GET /umas: what the oshi picker needs to draw a tile. The route
 * lists only umas that have an image, so `image` is never "".
 */
export interface OshiOption {
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
