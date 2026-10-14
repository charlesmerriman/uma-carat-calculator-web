/**
 * Game event types.
 *
 * Reward amounts used to live on a separate EventReward model (one-to-many
 * with GameEvent). In practice every event had at most one immediate reward
 * and one throughout-the-event reward, so the two were folded directly onto
 * GameEvent as fields — carat_amount is earned once the event's own resolved
 * start_date passes, while carats_throughout is a pool the banner pays out
 * gradually over its run. What survives of that pool is evaluated ONCE against
 * today via a front-loaded decay curve, then credited whole to a single banner
 * (see getRemainingThroughoutCarats / sumRemainingThroughoutCarats in
 * utils/incomeCalculationUtils.ts). Only carats are ever distributed this way —
 * tickets/shards/crystals are always earned as a lump on start_date.
 */

/**
 * `start_date`/`end_date` are derived entirely from the linked BannerTimeline
 * (resolved global dates, confirmed when available otherwise predicted from
 * the JP schedule; `end_date` trails the banner's own end date by 4 days) —
 * `banner_timeline` is null for events with no linked banner (e.g. Champions
 * Meeting tie-ins), in which case dates are null too.
 */
export interface GameEvent {
	id: number
	name: string
	image: string | null
	start_date: string | null
	end_date: string | null
	is_predicted: boolean
	// Inherited from the linked banner — a GameEvent has no offset of its own.
	applied_offset_days: number
	banner_timeline: number | null
	carat_amount: number
	carats_throughout: number
	support_ticket_amount: number
	uma_ticket_amount: number
	sr_shard_amount: number
	sr_crystal_amount: number
	ssr_shard_amount: number
	ssr_crystal_amount: number
}

/**
 * `start_date`/`end_date` are the RESOLVED global dates (confirmed when
 * available, otherwise predicted from the JP schedule by the backend);
 * `is_predicted` is true when they're an estimate. The raw jp/global fields are
 * exposed for reference (global dates are null until the meeting is confirmed).
 *
 * `event_type` is a constant tag emitted by the backend (EventTypeMixin in
 * calculatorapi/views/mixins.py). It's what narrows the merged timeline array —
 * ChampionsMeeting and LeagueOfHeroes are otherwise field-identical bar the
 * number, so nothing structural can tell them apart.
 */
export interface ChampionsMeeting {
	id: number
	name: string
	event_type: "champions_meeting"
	cm_number: number
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
	// Null when no art is uploaded yet; DRF serializes an empty ImageField as null.
	image: string | null
	track: string
	surface_type: string
	distance: string
	length: string
	track_condition: string
	season: string
	weather: string
	direction: string
	/**
	 * Whether the event has a PUBLISHED PvP guide (GET /pvp-guides/<kind>/<id>).
	 * Drives the Timeline card's "PvP guide" link and the PvP page's star.
	 * Optional: an older API omits it, which reads as "no guide".
	 */
	has_guide?: boolean
}

/**
 * `start_date`/`end_date` are the RESOLVED global dates (confirmed when
 * available, otherwise predicted from the JP schedule by the backend);
 * `is_predicted` is true when they're an estimate. The raw jp/global fields are
 * exposed for reference (global dates are null until the event is confirmed).
 *
 * Field-for-field identical to ChampionsMeeting apart from `event_type` and the
 * number's name — the two carry the same data and share one timeline card
 * (components/timeline/RaceEventCard.tsx). Keep them in step: a field added to
 * one almost always belongs on the other.
 */
export interface LeagueOfHeroes {
	id: number
	name: string
	event_type: "league_of_heroes"
	loh_number: number
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
	// Null when no art is uploaded yet; DRF serializes an empty ImageField as null.
	image: string | null
	track: string
	surface_type: string
	distance: string
	length: string
	track_condition: string
	season: string
	weather: string
	direction: string
	/**
	 * Whether the event has a PUBLISHED PvP guide (GET /pvp-guides/<kind>/<id>).
	 * Drives the Timeline card's "PvP guide" link and the PvP page's star.
	 * Optional: an older API omits it, which reads as "no guide".
	 */
	has_guide?: boolean
}

/**
 * The two race-event types the timeline renders through one shared card.
 *
 * `event_type` makes this a genuine discriminated union: narrowing on it gives
 * TypeScript the exact member back, with no structural sniffing and no casts.
 */
export type RaceEvent = ChampionsMeeting | LeagueOfHeroes