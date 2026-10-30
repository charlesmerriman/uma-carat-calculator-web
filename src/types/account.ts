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
 * One of the person's favorite umas ("oshi" on the wire and in the code;
 * "your favorite uma musume" on screen), in the order they picked them. The
 * first is their picture. The server lists EVERY stored row, covered by the
 * current tier or not, so the page can grey out the ones a lapse or downgrade
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
	 * Whether their Patreon tier and its look show beside their gallery posts
	 * and comments. Their own switch; the pledge is unaffected.
	 */
	show_supporter_badge: boolean
	/**
	 * Whether their shared plans are listed on their profile card. Their own
	 * switch, off until they turn it on. Absent from an older API.
	 */
	show_shared_plans_on_card?: boolean
	/**
	 * The picture for the navbar, chosen by the server: the first oshi's art,
	 * or `null` until they have picked one. Null rather than "" so a component
	 * branches to its default instead of trying to load an empty `src`. No
	 * provider picture is ever held or served.
	 */
	avatar_url: string | null
	/** Every favorite they hold, first to last. Empty until they pick one. */
	oshis: Oshi[]
	/**
	 * How many favorites the account covers: 1 for everyone, more by Patreon
	 * tier (the free slot plus 2, 4 or 6). A count the server has already
	 * resolved from its ladder, not a tier order — draw this many tiles and do
	 * no arithmetic. Top-level rather than inside `supporter` because a free
	 * account has a count too.
	 */
	oshi_slots: number
	/**
	 * Every uma the rainbow favorite frame goes on: each covered pick and every
	 * other outfit of its character, resolved by the server. Read it through
	 * useOshiIds. Optional only because a frontend deployed ahead of the API
	 * can briefly get an account without it.
	 */
	oshi_uma_ids?: number[]
	/**
	 * Whether a costume variant ("Special Week (Summer)") may be ADDED as a
	 * favorite: supporters and staff. Resolved by the server like
	 * `oshi_slots`, so the picker only locks tiles; the rule lives in the
	 * serializer. A variant already held is never taken away.
	 */
	oshi_variants: boolean
	/**
	 * Whether features still in early access are open to this account:
	 * supporters, staff, and accounts the owner granted it in the admin
	 * (backend benefits.early_access_for). It says who;
	 * which features are early is the client's (hooks/usePvpAccess.ts).
	 */
	early_access: boolean
	/**
	 * Whether the PvP page offers this account the guide editor: staff
	 * accounts only (backend pvp_guide_editing.can_edit). Draws the tab only;
	 * every write is checked again server side. Optional because an API older
	 * than the field sends nothing.
	 */
	guide_editor?: boolean
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
	show_supporter_badge?: boolean
	show_shared_plans_on_card?: boolean
}

/**
 * One row of GET /umas: what the favorites picker needs to draw a tile. The
 * route lists only umas that have an image, minus the "(All)" placeholder, so
 * `image` is never "". The same list for everyone: `is_variant` marks the
 * costume variants, which the picker locks unless `account.oshi_variants`.
 */
export interface OshiOption {
	id: number
	name: string
	image: string
	is_variant: boolean
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
