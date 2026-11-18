/**
 * The uma and support card cards' plain helpers (components/hovercards,
 * notes/uma-card-hover-plan.md). "Hover" is their old name: they opened on
 * hover until 2026-11-18 and open on a click now.
 *
 * A tile opts in with data attributes, and HoverCardLayer (one per app, in
 * AppShell) reads them when the tile is clicked. Put them on plain art, or on
 * the LINK to that uma's or card's Encyclopedia page (the click then opens
 * the card, whose "Open its page" goes on to the page). Never on a button or
 * a link with another job: the layer leaves those clicks alone, so the
 * attribute would do nothing there. Building the attributes here, never by
 * hand at a call site, keeps their spelling in one place:
 *
 *   <Link to={page} {...hoverCardProps("uma", member.uma, { ring })} title={CARD_LINK_TITLE}>
 *
 *   data-hover-card        "uma:198" or "card:4": what to show (the site's row id)
 *   data-hover-card-ring   "turf,long,late": the aptitudes this race asks for,
 *                          ringed on an uma's card (absent: none ringed)
 */

import type { RaceEvent } from "../types"
import type { CardEffect, StarStats } from "../types/encyclopedia"
import type { AptitudeKey, MemberStyle } from "../types/pvpTeam"
import { aptitudeKeysForEvent } from "./courseAptitude"
import { effectValue } from "./encyclopedia"

/**
 * How long a page fetched for a card counts as fresh: opening the same uma's
 * card again later in the session reuses it (the pages keep the client's
 * shorter default).
 */
export const CARD_PAGE_STALE_MS = 30 * 60 * 1000

export type HoverCardKind = "uma" | "card"

export interface HoverCardTarget {
	kind: HoverCardKind
	/** The site's row id: Uma.id or SupportCard.id. */
	id: number
}

const APTITUDE_KEYS = new Set<AptitudeKey>(["turf", "dirt", "short", "mile", "medium", "long", "front", "pace", "late", "end"])

/** The attributes a tile spreads to opt in. Undefined ids give none, so a tile with no row stays plain. */
export function hoverCardProps(
	kind: HoverCardKind,
	id: number | null | undefined,
	{ ring = [] }: { ring?: readonly AptitudeKey[] } = {}
): Record<string, string> {
	if (id == null) return {}
	return {
		"data-hover-card": `${kind}:${id}`,
		...(ring.length > 0 ? { "data-hover-card-ring": ring.join(",") } : {}),
	}
}

/**
 * The tooltip of a link whose click opens the card (it carries the
 * attributes above). The link's accessible name still says it opens the
 * Encyclopedia: from the keyboard or a screen reader it does.
 */
export const CARD_LINK_TITLE = "Show details"

/** "uma:198" back into a target; null for anything else. */
export function parseHoverCard(value: string | null | undefined): HoverCardTarget | null {
	const match = /^(uma|card):(\d+)$/.exec(value ?? "")
	return match ? { kind: match[1] as HoverCardKind, id: Number(match[2]) } : null
}

/** "turf,long,late" back into aptitude keys, dropping anything that isn't one. */
export function parseRing(value: string | null | undefined): AptitudeKey[] {
	return (value ?? "")
		.split(",")
		.map((part) => part.trim())
		.filter((part): part is AptitudeKey => APTITUDE_KEYS.has(part as AptitudeKey))
}

/**
 * The aptitudes a race asks of an uma: its surface, its distance, and the
 * style she runs (when the tile knows it). The same keys TeamGrid prints as
 * letters under each uma's name (utils/courseAptitude.ts).
 */
export function ringFor(
	course: Pick<RaceEvent, "surface_type" | "distance" | "length"> | null | undefined,
	style: MemberStyle | null = null
): AptitudeKey[] {
	return course ? aptitudeKeysForEvent(course, style).map((aptitude) => aptitude.key) : []
}

/**
 * A support card's effect columns: 0LB and max limit break, and the player's
 * own limit break as a third column when it is neither (owner, 2026-11-17).
 * When it is 0 or 4, that column is marked theirs instead of repeated.
 * `caps` is the level cap at each limit break (CardPageData.caps).
 */
export interface EffectColumn {
	label: string
	level: number
	yours: boolean
}

export function effectColumns(caps: readonly number[], ownedLimitBreak: number | null | undefined): EffectColumn[] {
	if (caps.length === 0) return []
	const last = caps.length - 1
	const owned = ownedLimitBreak != null && ownedLimitBreak >= 0 && ownedLimitBreak <= last ? ownedLimitBreak : null
	const columns: EffectColumn[] = [
		{ label: "0LB", level: caps[0], yours: owned === 0 },
		{ label: "MLB", level: caps[last], yours: owned === last },
	]
	if (owned !== null && owned !== 0 && owned !== last) {
		columns.push({ label: `Yours, ${owned}LB`, level: caps[owned], yours: true })
	}
	return columns
}

/** An effect's value at a level, as the game writes it; an en dash before it unlocks. */
export function effectAt(effect: CardEffect, level: number): string {
	const value = level >= 1 ? effect.values[level - 1] : null
	return value == null ? "–" : effectValue(value, effect.format)
}

/**
 * The stats row an uma's card shows: at the stars the player owns her at,
 * else her starting stars, else the first row the API sent.
 */
export function statRow(rows: readonly StarStats[], ownedStars: number | null | undefined, rarity: number | null): StarStats | null {
	return (
		rows.find((row) => ownedStars != null && row.star === ownedStars) ??
		rows.find((row) => row.star === rarity) ??
		rows[0] ??
		null
	)
}
