/**
 * Story events on the Timeline: the row under a banner with the event's free
 * card(s). Display only, never income. notes/story-events-plan.md.
 */

import type { StoryEvent } from "../types"
import { nameMatches } from "./searchText"

/** What the row calls an event no one has named in English yet. */
export const UNNAMED_STORY_EVENT = "Story event"

/** Every free card comes in this many copies (3 roulette, 1 points, 1 story; Daptrius). */
export const FREE_CARD_COPIES = 5

/** Story events by the banner they run with, in the API's (date) order. */
export function storyEventsByBanner(events: StoryEvent[]): Map<number, StoryEvent[]> {
	const byBanner = new Map<number, StoryEvent[]>()
	for (const event of events) {
		byBanner.set(event.banner_timeline, [...(byBanner.get(event.banner_timeline) ?? []), event])
	}
	return byBanner
}

/** The name a player reads: the API's, else "Story event". Never the Japanese title. */
export function storyEventName(event: StoryEvent): string {
	return event.name.trim() || UNNAMED_STORY_EVENT
}

const count = (amount: number, one: string, many: string) =>
	`${amount.toLocaleString("en-US")} ${amount === 1 ? one : many}`

/** The event's rewards as chip labels, the non-zero ones only, carats first. */
export function storyEventRewards(event: StoryEvent): string[] {
	return [
		[event.carat_amount, "carat", "carats"],
		[event.uma_ticket_amount, "uma ticket", "uma tickets"],
		[event.support_ticket_amount, "support ticket", "support tickets"],
		[event.ssr_shard_amount, "SSR shard", "SSR shards"],
		[event.sr_shard_amount, "SR shard", "SR shards"],
	]
		.filter(([amount]) => (amount as number) > 0)
		.map(([amount, one, many]) => count(amount as number, one as string, many as string))
}

/** "SSR", "SR" or "R" from a card's rarity; SSR when the game gave none. */
export function rarityLabel(rarity: number | null): string {
	return rarity === 1 ? "R" : rarity === 2 ? "SR" : "SSR"
}

/** Does a Timeline search match this event, by its name or a free card's? */
export function storyEventMatchesSearch(event: StoryEvent, query: string): boolean {
	return nameMatches(query, storyEventName(event)) || event.cards.some((card) => nameMatches(query, card.name))
}
