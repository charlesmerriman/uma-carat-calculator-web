/**
 * Whether an uma or support card is out on global in time for a PvP event.
 *
 * THE RULE (owner, 2026-10-13). Teams are not registered: a player can change
 * theirs at any point of the event. So a card counts if it reaches global by
 * the event's last day:
 *
 *   available  released before the event starts
 *   during     released after the start but by the end: pickable, and the
 *              picker and the team say so, with the date
 *   after      released after the event ends: not pickable
 *
 * A card's release is the start of its FIRST global banner (the earliest
 * effective start among the banners featuring it, so a rerun never makes an
 * old card look new), the same reading as "New since" (newCardsBetween). A
 * card on no banner at all is the launch roster or a starter or event-reward
 * card, and counts as available: the site has no date for it.
 *
 * Dates are the banners' effective dates, which may be predicted; the tag
 * shows the date so a player can judge.
 */

import type { BannerSupport, BannerUma, RaceEvent } from "../types"
import { formatDate, parseApiDate } from "./dateFormat"

export type ReleaseStatus =
	| { kind: "available" }
	| { kind: "during"; date: string }
	| { kind: "after"; date: string }

/** First global banner start per card, in ms. */
export interface CardReleases {
	umas: Map<number, number>
	supports: Map<number, number>
}

function firstStarts<T extends { id: number }>(entries: Array<{ start: string; cards: T[] }>): Map<number, number> {
	const first = new Map<number, number>()
	for (const { start, cards } of entries) {
		const time = parseApiDate(start)?.getTime()
		if (time === undefined || Number.isNaN(time)) continue
		for (const card of cards) {
			const seen = first.get(card.id)
			if (seen === undefined || time < seen) first.set(card.id, time)
		}
	}
	return first
}

export function cardReleases(umaBanners: BannerUma[], supportBanners: BannerSupport[]): CardReleases {
	return {
		umas: firstStarts(umaBanners.map((banner) => ({ start: banner.banner_timeline.start_date, cards: banner.umas }))),
		supports: firstStarts(
			supportBanners.map((banner) => ({ start: banner.banner_timeline.start_date, cards: banner.support_cards }))
		),
	}
}

/** Where a release (ms, or undefined for "no banner") falls against the event. */
export function releaseStatus(released: number | undefined, event: Pick<RaceEvent, "start_date" | "end_date">): ReleaseStatus {
	if (released === undefined) return { kind: "available" }
	const start = parseApiDate(event.start_date)?.getTime()
	const end = parseApiDate(event.end_date)?.getTime()
	if (start === undefined || end === undefined) return { kind: "available" }
	if (released <= start) return { kind: "available" }
	const date = formatDate(new Date(released).toISOString())
	return released <= end ? { kind: "during", date } : { kind: "after", date }
}

/** Why a card can't be picked for the event, or null. */
export function releaseBlockReason(status: ReleaseStatus): string | null {
	return status.kind === "after" ? `Out ${status.date}, after this event` : null
}

/** The note on a card that arrives mid-event, or null. */
export function releaseNote(status: ReleaseStatus): string | null {
	return status.kind === "during" ? `Out ${status.date}, during this event` : null
}
