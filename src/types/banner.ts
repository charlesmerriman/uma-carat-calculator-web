/**
 * Banner-related type definitions.
 *
 * TYPESCRIPT CONCEPT: Interfaces vs Types
 * We use `interface` here because these represent object shapes coming from the API.
 * Interfaces are preferred for object shapes because they give better error messages
 * and can be extended later. Use `type` for unions, intersections, or aliases.
 */

import type { AttachedAnniversaryEvent } from "./anniversary"

/**
 * What kind of banner window a BannerTimeline is — the backend's
 * `BannerCategory` TextChoices, mirroring the source sheet's "Banner Type"
 * column so the two can be diffed.
 *
 * NOT to be confused with "banner type", which throughout the planner means
 * Uma-vs-Support (`initialBannerType`, `bannerKey`, `banner-type-tab--uma`).
 * Category is a different axis entirely and the two names must stay distinct.
 *
 * Drives presentation only: the timeline card's chrome and the category
 * filter. Never the pull maths.
 */
export type BannerCategory =
	| "standard"
	| "race_prep_support"
	| "golden_week_revival"
	| "rerun"

/** Represents a time window during which banners are available for pulling.
 *
 * `start_date`/`end_date` are the RESOLVED global dates: the confirmed global
 * dates when available, otherwise dates predicted from the JP schedule by the
 * backend. `is_predicted` is true when they're an estimate. The raw jp and
 * global date fields are exposed for reference (the global dates are null
 * until a banner is confirmed).
 */
export interface BannerTimeline {
	id: number
	name: string
	banner_category: BannerCategory
	start_date: string
	end_date: string
	is_predicted: boolean
	jp_start_date: string | null
	jp_end_date: string | null
	global_start_date: string | null
	global_end_date: string | null
	// Manual correction applied on top of the prediction, for when global slips
	// its schedule. `schedule_offset_days` is this row's own value (set in the
	// Django admin); `applied_offset_days` is the running total — its own plus
	// every offset earlier in the calendar — already baked into start_date and
	// end_date above. Both are 0 on confirmed rows. Diagnostic only: the dates
	// are complete without them.
	schedule_offset_days: number
	applied_offset_days: number
	image: string
}

/**
 * The card's earliest JP banner appearance, which is what selector eligibility
 * is judged on: a selector may only take cards whose first_jp_date is on or
 * before its cutoff. Derived server-side, never stored.
 *
 * Null means the card has never been featured on a banner in our data — treat
 * that as UNKNOWN, not "ancient". Eligibility refuses null under a real cutoff.
 */
interface JpDated {
	first_jp_date: string | null
}

/** An individual uma (horse girl character) that can appear on a banner */
export interface Uma extends JpDated {
	id: number
	name: string
	image: string
	admin_comments: string
	recommendation: string
	/**
	 * The card's public one-liner ("Great pace parent"), shown as an overlay on
	 * its Timeline tile on hover, keyboard focus or tap. Card-level, unlike
	 * `recommendation`, which is per banner. "" means none, and the tile then
	 * renders exactly as it would without the field.
	 */
	purpose: string
	/**
	 * The INTRINSIC selector gates, stored server-side rather than derived —
	 * both of these units sit on ordinary banners and are indistinguishable
	 * from a selectable one from the client's side.
	 *
	 * Unlike `first_jp_date` these are independent of any cutoff and bite even
	 * under an unrestricted (null) one. Never read them directly; go through
	 * `isCardSelectable` in utils/selectorTickets.
	 */
	is_time_limited: boolean
	is_three_star: boolean
}

/**
 * A support card that can appear on a banner.
 *
 * Deliberately has no `is_time_limited` / `is_three_star`: those gates are an
 * uma-side concept (★3 has no support equivalent — supports are SSR/SR), so a
 * support card is only ever gated on its cutoff date.
 */
export interface SupportCard extends JpDated {
	id: number
	name: string
	image: string
	admin_comments: string
	recommendation: string
	/** See Uma.purpose. */
	purpose: string
}

/** An uma gacha banner — contains one or more featured umas */
export interface BannerUma {
	id: number
	banner_timeline: BannerTimeline
	name: string
	admin_comments: string
	umas: Uma[]
	free_pulls: number
	/**
	 * The editorial "Recommended" flag: a gold star in the planner's dropdown,
	 * and the SSR treatment on this banner's Timeline panel. Presentation only;
	 * nothing in the projection reads it. Per banner — the uma and support
	 * banners sharing a window are flagged independently.
	 *
	 * Read it through `isRecommendedBanner`, which also answers for a step-up
	 * (never recommended; it has no such flag).
	 */
	is_recommended: boolean
}

/** A support card gacha banner — contains one or more featured support cards */
export interface BannerSupport {
	id: number
	banner_timeline: BannerTimeline
	name: string
	admin_comments: string
	support_cards: SupportCard[]
	free_pulls: number
	/** See BannerUma.is_recommended. */
	is_recommended: boolean
}

/**
 * A paid-carats-only Select Step-Up banner sold during a campaign.
 *
 * The third peer of BannerUma and BannerSupport, and deliberately shaped like
 * them: the same `banner_timeline` FK (pointed at the campaign's Part 2), so
 * every date, ordering and income path in the projection resolves it through
 * the same code as its siblings. Only the SPEND half of the engine branches.
 *
 * What it does NOT have is a card list. The player picks 10 cards themselves
 * from the back catalogue, bounded by the campaign's `jp_cutoff_date`, so there
 * are no featured cards to borrow art from — hence its own `image`.
 *
 * `banner_count` is how many banners of this card type the campaign sells (the
 * sheet's Selector Planner X/Y columns). It is the hard ceiling on steps:
 * `banner_count * 5`.
 *
 * NOTE: inert until the backend model lands. The exact serializer shape is
 * settled in Phase 2 of `step-up-banners-plan.md`; this is the minimum the
 * planner's narrowing needs.
 */
export interface BannerStepUp {
	id: number
	banner_timeline: BannerTimeline
	/** FK id — the campaign itself arrives in `anniversary_event_data`. */
	anniversary_event: number
	name: string
	/** Which pool this step-up draws from. Drives the odds labels. */
	card_type: "uma" | "support"
	banner_count: number
	/**
	 * banner_count x 5 — the real ceiling on a plan. Served rather than derived
	 * client-side so the count and the rule that turns it into steps stay
	 * together.
	 */
	max_steps: number
	/**
	 * The campaign's cutoff, already folded in by the backend the same way it is
	 * onto a selector product. A step-up's candidates are back-catalogue cards
	 * released on JP on or before this date; null means unrestricted.
	 *
	 * Read this rather than joining anniversary_event_data — one place resolves
	 * the cutoff, and it is the server.
	 */
	jp_cutoff_date: string | null
	image: string | null
	admin_comments: string
	order: number
}

/**
 * An enriched banner timeline used by the Timeline view.
 * Includes nested uma and support banner arrays so the timeline
 * can display what's available during each time window.
 */
export interface BannerTimelineForViewing {
	id: number
	name: string
	banner_category: BannerCategory
	// Constant tag from the backend; see ChampionsMeeting in types/events.ts for
	// why the merged timeline array narrows on this rather than on shape.
	event_type: "banner_timeline"
	start_date: string
	end_date: string
	is_predicted: boolean
	jp_start_date: string | null
	jp_end_date: string | null
	global_start_date: string | null
	global_end_date: string | null
	// See BannerTimeline for what these two mean.
	schedule_offset_days: number
	applied_offset_days: number
	// Null when a banner has no art uploaded yet (common for far-future,
	// still-predicted banners); the DRF ImageField serializes empty as null.
	image: string | null
	banner_umas: BannerUma[]
	banner_supports: BannerSupport[]
	/**
	 * The campaign this banner is a part of, or null. A summary rather than the
	 * whole campaign — the full record (with its products) arrives separately in
	 * anniversary_event_data, and nesting it here would repeat the catalogue on
	 * every part.
	 */
	anniversary_event: AttachedAnniversaryEvent | null
	/**
	 * Step-ups running in this window. A summary (name, pool, count) rather than
	 * the whole record — the full ones arrive in banner_step_up_data. Because a
	 * step-up attaches to the campaign PART it runs in, this is non-empty on
	 * exactly one banner per campaign.
	 */
	banner_step_ups: BannerStepUpSummary[]
}

/** Just enough of a step-up to caption it on the Timeline. */
export interface BannerStepUpSummary {
	id: number
	name: string
	card_type: "uma" | "support"
	banner_count: number
}