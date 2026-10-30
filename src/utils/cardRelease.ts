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
 * old card look new), the same reading as "New since" (newCardsBetween).
 *
 * A card on no banner at all (the launch roster, starter and event-reward
 * cards) has no date. The catalogue's `on_global` decides it: in the global
 * game today means out ("available"); otherwise it is "unreleased", not
 * pickable, "Not on global yet". An event-reward card therefore turns
 * pickable when the global snapshot that lists it is imported.
 *
 * Dates are the banners' effective dates, which may be predicted; the tag
 * shows the date so a player can judge.
 */

import type { BannerSupport, BannerUma, RaceEvent } from "../types"
import type { CatalogueSupportCard } from "../types/pvpTeam"
import { formatDate, parseApiDate } from "./dateFormat"

export type ReleaseStatus =
	| { kind: "available" }
	/** On no banner and not in the global game: no date, not out. */
	| { kind: "unreleased" }
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

/**
 * A support card's date for the Collection's Release date sort: its first
 * banner, else the game's own date, which is how a welfare SSR, SR or R gets one.
 *
 * ONLY THE COLLECTION'S SORT. A selector judges cards on `first_jp_date`, and a
 * card on no banner being unknown there keeps it out of every selector
 * (.claude/rules/selectors.md). `cardReleases` above feeds the PvP picker's
 * release check, and stays banners only too (owner, 2026-10-30).
 */
export function collectionCardRelease(
	card: Pick<CatalogueSupportCard, "id" | "released_at">,
	releases: ReadonlyMap<number, number>
): number | undefined {
	return releases.get(card.id) ?? (card.released_at ? parseApiDate(card.released_at)?.getTime() : undefined)
}

/**
 * The first banner of all, Global's launch. The game gives umas no date, and the
 * Global umas on no banner are the launch roster (owner, 2026-10-30), so the
 * Collection's sort dates them here.
 */
export function earliestRelease(releases: ReadonlyMap<number, number>): number | undefined {
	return releases.size ? Math.min(...releases.values()) : undefined
}

/**
 * Where a release (ms, or undefined for "no banner") falls against the event.
 * `onGlobal` only matters with no banner; unknown counts as on global.
 */
export function releaseStatus(
	released: number | undefined,
	event: Pick<RaceEvent, "start_date" | "end_date">,
	onGlobal?: boolean
): ReleaseStatus {
	if (released === undefined) return onGlobal === false ? { kind: "unreleased" } : { kind: "available" }
	const start = parseApiDate(event.start_date)?.getTime()
	const end = parseApiDate(event.end_date)?.getTime()
	if (start === undefined || end === undefined) return { kind: "available" }
	if (released <= start) return { kind: "available" }
	const date = formatDate(new Date(released).toISOString())
	return released <= end ? { kind: "during", date } : { kind: "after", date }
}

/** Why a card can't be picked for the event, or null. */
export function releaseBlockReason(status: ReleaseStatus): string | null {
	if (status.kind === "after") return `Out ${status.date}, after this event`
	if (status.kind === "unreleased") return "Not on global yet"
	return null
}

/** The note on a card that arrives mid-event, or null. */
export function releaseNote(status: ReleaseStatus): string | null {
	return status.kind === "during" ? `Out ${status.date}, during this event` : null
}
