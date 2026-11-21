/**
 * Free card events on the Timeline: the rows under a banner with each event's
 * free cards and umas. Four kinds (story events, main story chapters,
 * anniversary missions, special events), display only, never income.
 * notes/story-events-plan.md, notes/story-events-plan-2.md.
 */

import type { StoryEvent, StoryEventKind, StoryEventUma } from "../types"
import { formatDate, parseApiDate } from "./dateFormat"
import { nameMatches } from "./searchText"

/**
 * The one place each kind's words live: the pill on the row, and the order the
 * rows stack in under one banner (story event first, as it was the only kind
 * before 2026-11-20). An unnamed event reads as its label.
 */
export const STORY_EVENT_KINDS: Record<StoryEventKind, { label: string; order: number }> = {
	story: { label: "Story event", order: 0 },
	main_story: { label: "Main story", order: 1 },
	anniversary: { label: "Anniversary missions", order: 2 },
	special: { label: "Special event", order: 3 },
}

/** Every free card comes in this many copies (3 roulette, 1 points, 1 story; Daptrius). */
export const FREE_CARD_COPIES = 5

/**
 * An event's kind. An API older than the kinds (api #302) sent story events
 * only and no `kind`, so a missing one is a story event; an unknown one (a
 * kind added to the API before this client learns it) reads as one too, so
 * the row still draws.
 */
export function storyEventKind(event: Pick<StoryEvent, "kind">): StoryEventKind {
	return event.kind && event.kind in STORY_EVENT_KINDS ? event.kind : "story"
}

/** The pill's words for an event's kind. */
export function storyEventLabel(event: Pick<StoryEvent, "kind">): string {
	return STORY_EVENT_KINDS[storyEventKind(event)].label
}

/** The umas an event gives; [] from an API older than the kinds. */
export function storyEventUmas(event: Pick<StoryEvent, "umas">): StoryEventUma[] {
	return event.umas ?? []
}

/**
 * Events by the banner they run with. Under one banner the kinds stack in
 * STORY_EVENT_KINDS order; within a kind, the API's (date) order stays
 * (Array.prototype.sort is stable).
 */
export function storyEventsByBanner(events: StoryEvent[]): Map<number, StoryEvent[]> {
	const byBanner = new Map<number, StoryEvent[]>()
	for (const event of events) {
		byBanner.set(event.banner_timeline, [...(byBanner.get(event.banner_timeline) ?? []), event])
	}
	for (const list of byBanner.values()) {
		list.sort((a, b) => STORY_EVENT_KINDS[storyEventKind(a)].order - STORY_EVENT_KINDS[storyEventKind(b)].order)
	}
	return byBanner
}

/** The name a player reads: the API's, else the kind's label. Never the Japanese title. */
export function storyEventName(event: Pick<StoryEvent, "name" | "kind">): string {
	return event.name.trim() || storyEventLabel(event)
}

/**
 * The line under the name. A story event runs with its banner, so it gives no
 * dates (Daptrius, 2026-11-18: a claim date read as the start). A main story
 * chapter never closes. Anniversary missions and a special event end on their
 * own day, shown as a day: they end at 14:59:59 UTC, one second before the
 * daily reset (Daptrius, 2026-11-20). Null when there is nothing to say (a
 * special event with no end date yet).
 */
export function storyEventLine(event: Pick<StoryEvent, "kind" | "end_date">): string | null {
	const ends = event.end_date ? `Ends ${formatDate(event.end_date)}.` : null
	switch (storyEventKind(event)) {
		case "main_story":
			return "Added with this banner. Read it any time."
		case "anniversary":
			return ends ? `Missions and login bonus. ${ends}` : "Missions and login bonus."
		case "special":
			return ends
		default:
			return "Runs with this banner."
	}
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

/** "3★" from an uma's rarity; 3★ when the game gave none, as for a card. */
export function starLabel(rarity: number | null): string {
	return `${rarity && rarity >= 1 && rarity <= 3 ? rarity : 3}★`
}

/** Does a Timeline search match this event, by its name, a free card's or a free uma's? */
export function storyEventMatchesSearch(event: StoryEvent, query: string): boolean {
	return (
		nameMatches(query, storyEventName(event)) ||
		event.cards.some((card) => nameMatches(query, card.name)) ||
		storyEventUmas(event).some((uma) => nameMatches(query, uma.name))
	)
}

/**
 * The earliest dated event that gives this uma, or undefined. How an uma on no
 * banner gets a release date: Special Week (Commander) and Rhein Kraft (Alt
 * Version) come from main story chapters (Daptrius, 2026-11-20: the
 * Encyclopedia's date sort showed neither a date).
 */
export function firstEventGivingUma<E extends Pick<StoryEvent, "start_date" | "umas">>(
	events: readonly E[],
	umaId: number
): E | undefined {
	let first: E | undefined
	let firstTime = Infinity
	for (const event of events) {
		if (!storyEventUmas(event).some((uma) => uma.id === umaId)) continue
		const time = event.start_date ? parseApiDate(event.start_date)?.getTime() : undefined
		if (time !== undefined && !Number.isNaN(time) && time < firstTime) {
			first = event
			firstTime = time
		}
	}
	return first
}
