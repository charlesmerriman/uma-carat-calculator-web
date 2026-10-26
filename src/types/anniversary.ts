/**
 * Anniversary campaign types — the Selectors page's domain.
 *
 * A campaign is a dated period that sells discounted carat packs and grants
 * selector tickets. It owns no dates of its own: the backend resolves its range
 * from the banner "Parts" it spans, so `start_date`/`end_date` follow exactly
 * the same confirmed-or-predicted rules as every other dated thing in the app.
 */

/** Which flavour of campaign this is. Drives the timeline strip's styling. */
export type AnniversaryEventType = "anniversary" | "new_year" | "campaign"

/**
 * One purchasable line on a campaign.
 *
 * TYPESCRIPT CONCEPT: Tagged unions on the wire
 * Packs and selectors share one backend model and one shape, separated by
 * `product_type`. Narrow on that tag — never on which fields happen to be set.
 * `isSelectorProduct` below is the helper to use.
 */
export interface AnniversaryEventProduct {
	id: number
	product_type: "carat_pack" | "uma_selector" | "support_selector"
	name: string
	/** JSON number, not a string — the backend opts out of DRF's Decimal-as-string. */
	usd_cost: number
	/** Paid carats granted per unit, BEFORE any webstore bonus. */
	paid_carat_amount: number
	/** Multiplier applied to the carats when the webstore toggle is on. 1 = none. */
	webstore_multiplier: number
	max_quantity: number
	/**
	 * The cutoff already resolved against the campaign's own — a selector may
	 * only take cards released on JP on or before this date (inclusive).
	 * Null means unrestricted.
	 */
	jp_cutoff_date: string | null
	/** The product's own override, null when the cutoff came from the campaign. */
	jp_cutoff_date_override: string | null
	order: number
}

/** Which banner timeline is which part of a campaign. */
export interface AnniversaryEventPart {
	banner_timeline: number
	part_number: number
}

export interface AnniversaryEvent {
	id: number
	name: string
	event_type: AnniversaryEventType
	jp_cutoff_date: string | null
	image: string | null
	accent_label: string
	/**
	 * Resolved from the campaign's banner parts. Null when it has no linked
	 * parts (or none with resolved dates) — such a campaign cannot be projected
	 * and the planner shows it as undated rather than guessing.
	 */
	start_date: string | null
	end_date: string | null
	/**
	 * When the event this campaign is NAMED AFTER actually begins — as opposed
	 * to `start_date`, which is when the campaign opens.
	 *
	 * They differ for anniversaries, which run a Part 1 of login rewards
	 * announcing the anniversary before the anniversary proper starts at Part 2
	 * (JP 02-24 / 08-24, the game's launch date). About ten days apart.
	 *
	 * Prefer this over `start_date` for anything that PLACES the campaign on a
	 * calendar — the planner's section bands, the timeline's campaign card — and
	 * for the instant a purchase's paid carats are credited. `start_date` and
	 * `end_date` remain the campaign's whole window, which is what a range
	 * describing the campaign should say.
	 *
	 * Always inside that window, and never null when `start_date` isn't. Older
	 * campaign kinds resolve it to the same instant as `start_date`, so a
	 * `?? start_date` fallback is safe for a payload predating the field.
	 */
	main_start_date: string | null
	is_predicted: boolean
	applied_offset_days: number
	products: AnniversaryEventProduct[]
	banner_parts: AnniversaryEventPart[]
}

/** The compact campaign summary attached to a banner on the timeline. */
export interface AttachedAnniversaryEvent {
	id: number
	name: string
	event_type: AnniversaryEventType
	accent_label: string
	image: string | null
	part_number: number
}

/**
 * A purchase the user plans to make.
 *
 * Same saved/local split as UserPlannedBanner — see the long explanation in
 * ./user.ts. `product` is an id rather than a nested object because the client
 * already holds every campaign and its products.
 */
interface BasePlannedPurchase {
	product: number
	quantity: number
	target_uma?: number | null
	target_support?: number | null
}

export interface SavedPlannedPurchase extends BasePlannedPurchase {
	id: number
	tempId?: undefined
	user: number
}

export interface LocalPlannedPurchase extends BasePlannedPurchase {
	id?: undefined
	tempId: number
	user?: undefined
}

export type UserPlannedPurchase = SavedPlannedPurchase | LocalPlannedPurchase

