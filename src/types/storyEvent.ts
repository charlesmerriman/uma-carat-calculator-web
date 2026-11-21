/**
 * Free card events: the rows under a banner on the Timeline.
 *
 * Four kinds share one shape (`kind`): the game's limited-time story event that
 * runs with a banner, a main story chapter, an anniversary's missions and a
 * special (fan) event. Each gives away free ("welfare") support cards, and a
 * main story chapter sometimes an uma outfit too. Display only: nothing here
 * touches the projection (GameEvent carries the income), and the cards never
 * reach selector eligibility, which reads banner cards only. Mirrors the API's
 * StoryEventSerializer (views/story_event.py). notes/story-events-plan.md and
 * notes/story-events-plan-2.md (the other kinds).
 */

import type { PortraitLayers } from "./portraitLayers"

/** The four kinds, as the API's StoryEventKind sends them. */
export type StoryEventKind = "story" | "main_story" | "anniversary" | "special"

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

/**
 * One free uma outfit (Special Week (Commander), from a main story chapter).
 * Its own list, never mixed into `cards`, so every reader of `cards` keeps
 * reading support cards only. Drawn as FramedUma from `portrait`.
 */
export interface StoryEventUma {
	/** The Uma row id. */
	id: number
	name: string
	/** Global's title only, "" for an outfit Global hasn't titled. */
	title: string
	/** The bordered art, FramedUma's fallback when there is no `portrait`. */
	image: string | null
	portrait: string | null
	portrait_layers: PortraitLayers | null
	/** Its stars, 1 to 3. */
	rarity: number | null
	purpose: string
	/** The key of its Encyclopedia page. */
	game_id: number
	must_get: boolean
	note: string
}

export interface StoryEvent {
	id: number
	/**
	 * Which of the four it is. Absent from an API older than the event kinds
	 * (api #302), which sent story events only: read it through
	 * `storyEventKind()`, never directly.
	 */
	kind?: StoryEventKind
	/** The game's id for the event, unique within its kind; null for one an editor made by hand. */
	game_id: number | null
	/** Global's name, else the editors' working name, else "" (shown as the kind's label). */
	name: string
	/** The event's logo. Null until an editor uploads one; the row draws without it. */
	image: string | null
	/** The banner it runs with, as a bare id. Always set: the API sends no other. */
	banner_timeline: number
	start_date: string | null
	/** Null for a main story chapter, which never closes. */
	end_date: string | null
	/** The last moment to claim the event's rewards, a few days after it ends. Story events only. */
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
	/** The uma outfits it gives. Absent from an API older than the event kinds: read it as `?? []`. */
	umas?: StoryEventUma[]
}
