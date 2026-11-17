/**
 * Story event types: the row under a banner on the Timeline.
 *
 * A story event is the game's limited-time event that runs with a banner and
 * gives away a free ("welfare") support card. Display only: nothing here
 * touches the projection (GameEvent carries the income), and the cards never
 * reach selector eligibility, which reads banner cards only. Mirrors the API's
 * StoryEventSerializer (views/story_event.py). notes/story-events-plan.md.
 */

/** One free card the event gives. Every event gives five copies of each. */
export interface StoryEventCard {
	/** The SupportCard row id. */
	id: number
	name: string
	/** Global's title only ("[Fondente Smile]"), "" for a card Global hasn't titled. */
	title: string
	/** The bordered card art; the Timeline keeps it, as on a banner's tiles. */
	image: string | null
	/** 1 R, 2 SR, 3 SSR. Null for a card with no game id. */
	rarity: number | null
	/** The card's public one-liner, "" when none is written. */
	purpose: string
	/** The key of its Encyclopedia page; null for a placeholder. */
	game_id: number | null
	/** The editors' one mark: a card worth going out of your way for. Rare. */
	must_get: boolean
	/** Optional editors' note, 80 characters at most. */
	note: string
}

export interface StoryEvent {
	id: number
	/** The game's story event id, e.g. 1022. */
	game_id: number
	/** Global's name, else the editors' working name, else "" (shown as "Story event"). */
	name: string
	/** The event's logo. Null until an editor uploads one; the row draws without it. */
	image: string | null
	/** The banner it runs with, as a bare id. Always set: the API sends no other. */
	banner_timeline: number
	start_date: string | null
	end_date: string | null
	/** The last moment to claim the event's rewards, a few days after it ends. */
	claim_end_date: string | null
	/** True while the dates are the banner's prediction from the JP schedule. */
	is_predicted: boolean
	applied_offset_days: number
	carat_amount: number
	uma_ticket_amount: number
	support_ticket_amount: number
	ssr_shard_amount: number
	sr_shard_amount: number
	cards: StoryEventCard[]
}
