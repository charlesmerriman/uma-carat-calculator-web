/**
 * The Collection grid's pure helpers: what a change does to the cached roster,
 * and how a limit break reads. No React (src/__tests__/roster.test.ts).
 */

import type { OwnedCardRow, OwnedUmaRow, Roster, RosterChanges } from "../types/roster"

export const STAR_LEVELS = [1, 2, 3, 4, 5]
export const LIMIT_BREAKS = [0, 1, 2, 3, 4]

/** "LB2", or "MLB" at 4: how the game's players say it. */
export function limitBreakLabel(limitBreak: number): string {
	return limitBreak >= 4 ? "MLB" : `LB${limitBreak}`
}

/**
 * The roster with `changes` applied, as the server will apply them: a change
 * with `owned: false` removes the row, any other adds or updates it and makes
 * it "manual" (hand edits win). Columns a change leaves out keep their value.
 */
export function applyRosterChanges(roster: Roster, changes: RosterChanges): Roster {
	let umas = roster.umas
	for (const change of changes.umas ?? []) {
		const current = umas.find((row) => row.uma === change.uma)
		umas = umas.filter((row) => row.uma !== change.uma)
		if (!change.owned) continue
		const next: OwnedUmaRow = {
			uma: change.uma,
			stars: change.stars !== undefined ? change.stars : (current?.stars ?? null),
			talent_level: change.talent_level !== undefined ? change.talent_level : (current?.talent_level ?? null),
			source: "manual",
			obtained_at: current?.obtained_at ?? null,
		}
		umas = [...umas, next]
	}
	let cards = roster.support_cards
	for (const change of changes.support_cards ?? []) {
		const current = cards.find((row) => row.support_card === change.support_card)
		cards = cards.filter((row) => row.support_card !== change.support_card)
		if (!change.owned) continue
		const next: OwnedCardRow = {
			support_card: change.support_card,
			limit_break: change.limit_break ?? current?.limit_break ?? 0,
			spare_copies: change.spare_copies ?? current?.spare_copies ?? 0,
			source: "manual",
			obtained_at: current?.obtained_at ?? null,
		}
		cards = [...cards, next]
	}
	return { umas, support_cards: cards }
}

/** What My team's picker needs to know about ownership, for one pool. */
export interface OwnedForPicker {
	ids: ReadonlySet<number>
	/** A card's limit break, for the tile's chip; empty for umas. */
	limitBreaks: ReadonlyMap<number, number>
}

/** The roster as the picker reads it, per pool; null with no roster (a guest). */
export function ownedForPicker(roster: Roster | undefined, pool: "uma" | "support"): OwnedForPicker | null {
	if (!roster) return null
	if (pool === "uma") return { ids: new Set(roster.umas.map((row) => row.uma)), limitBreaks: new Map() }
	return {
		ids: new Set(roster.support_cards.map((row) => row.support_card)),
		limitBreaks: new Map(roster.support_cards.map((row) => [row.support_card, row.limit_break])),
	}
}


/** "All", "Owned" or "Missing": which tiles a Collection grid shows. */
export type RosterView = "all" | "owned" | "missing"

/** The Umas tab's summary: owned umas by stars, and how many reached potential 5. */
export function umaSummary(owned: Pick<OwnedUmaRow, "stars" | "talent_level">[]) {
	return {
		five: owned.filter((row) => row.stars === 5).length,
		four: owned.filter((row) => row.stars === 4).length,
		// Three or fewer, and the ones with no stars set (a hand add the player never changed).
		threeOrFewer: owned.filter((row) => row.stars === null || row.stars <= 3).length,
		potentialFive: owned.filter((row) => row.talent_level === 5).length,
	}
}

/**
 * The Support cards tab's summary: how many owned cards are MLB, and per card
 * type how many of the offered ones are owned. `offered` is the Global
 * catalogue; `types` the order to list them in.
 */
export function cardSummary(
	offered: Array<{ id: number; card_type: string | null }>,
	owned: Pick<OwnedCardRow, "support_card" | "limit_break">[],
	types: readonly string[]
) {
	const ownedIds = new Set(owned.map((row) => row.support_card))
	return {
		owned: offered.filter((card) => ownedIds.has(card.id)).length,
		mlb: owned.filter((row) => row.limit_break >= 4 && offered.some((card) => card.id === row.support_card)).length,
		byType: types.map((type) => {
			const ofType = offered.filter((card) => card.card_type === type)
			return { type, owned: ofType.filter((card) => ownedIds.has(card.id)).length, total: ofType.length }
		}),
	}
}
