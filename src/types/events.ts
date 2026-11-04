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
/**
 * The course an event runs on, from the game's own files (the API's RaceCourse,
 * views/race_course.py; notes/course-map-plan.md). Every number is metres from
 * the gate, and a stretch in none of the lists is a gap the game leaves, drawn
 * as one. Read it through utils/courseGeometry.ts, the one place a metre
 * becomes a position.
 */
export interface RaceCourse {
	id: number
	region: "jp" | "global"
	/** The game's course set id, e.g. 10701 for Chukyo turf 1200 m. */
	game_id: number
	racecourse: string
	surface: "turf" | "dirt"
	distance: number
	variant: "" | "inner" | "outer" | "outer_inner"
	direction: "right" | "left" | "straight"
	/** The game's number: counted back from the finish in fours (the final corner is 4); -1 is a normal corner. */
	corners: { start: number; length: number; number: number }[]
	/** `front` is the game's straight type. */
	straights: { start: number; length: number; front: number }[]
	/** `slope` is percent times 10,000: 20000 is a 2% climb, negative is downhill. */
	slopes: { start: number; length: number; slope: number }[]
	/** Where the ground changes, e.g. a dirt course that starts on turf. */
	surface_changes: { start: number; surface: "turf" | "dirt" }[]
	/** How a course over one lap draws its later laps (the track view). */
	later_laps: "inside" | "outside"
}

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
	 * Whether the event has a PvP guide out of draft, Supporters or Public
	 * (GET /pvp-guides/<kind>/<id>). Drives the Timeline card's "PvP guide"
	 * link and the PvP page's star. Optional: an older API omits it, which
	 * reads as "no guide".
	 */
	has_guide?: boolean
	/**
	 * Who may read that guide: "supporters", "public", or null for no guide or
	 * a Private one. With `guide_tools_public`, what the PvP page opens to a
	 * reader without early access (hooks/usePvpAccess.ts). Optional, as above.
	 */
	guide_visibility?: "supporters" | "public" | null
	/** Whether My team and the Gallery open to everyone with it (Public only). */
	guide_tools_public?: boolean
	/**
	 * The course the map draws, or null when the event has none yet (or an
	 * editor hid its map). Optional: an older API and older fixtures omit it,
	 * which reads as "no course".
	 */
	course?: RaceCourse | null
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
	 * Whether the event has a PvP guide out of draft, Supporters or Public
	 * (GET /pvp-guides/<kind>/<id>). Drives the Timeline card's "PvP guide"
	 * link and the PvP page's star. Optional: an older API omits it, which
	 * reads as "no guide".
	 */
	has_guide?: boolean
	/**
	 * Who may read that guide: "supporters", "public", or null for no guide or
	 * a Private one. With `guide_tools_public`, what the PvP page opens to a
	 * reader without early access (hooks/usePvpAccess.ts). Optional, as above.
	 */
	guide_visibility?: "supporters" | "public" | null
	/** Whether My team and the Gallery open to everyone with it (Public only). */
	guide_tools_public?: boolean
	/**
	 * The course the map draws, or null when the event has none yet (or an
	 * editor hid its map). Optional: an older API and older fixtures omit it,
	 * which reads as "no course".
	 */
	course?: RaceCourse | null
}

/**
 * The two race-event types the timeline renders through one shared card.
 *
 * `event_type` makes this a genuine discriminated union: narrowing on it gives
 * TypeScript the exact member back, with no structural sniffing and no casts.
 */
export type RaceEvent = ChampionsMeeting | LeagueOfHeroes