/**
 * The Encyclopedia's plain helpers: the shared layout classes, the words for
 * rarity and running style, and the uma and card lists' filters. Kept out of
 * the component files so those export components only (fast refresh), and so
 * the filters are testable on their own.
 */

import type { CatalogueSupportCard, CatalogueUma } from "../types/pvpTeam"
import { CARD_TYPE_LABELS } from "./cardTypes"

export const PAGE_CONTAINER = "mx-auto my-3 flex w-[calc(100%-1rem)] max-w-6xl flex-col gap-4 sm:w-[calc(100%-2rem)]"
export const LINK_CLASS = "text-brand transition hover:text-brand/75"

export const RARITY_WORDS: Record<number, string> = { 1: "R", 2: "SR", 3: "SSR" }
export const RUNNING_STYLE_WORDS: Record<number, string> = {
	1: "Front Runner", 2: "Pace Chaser", 3: "Late Surger", 4: "End Closer",
}

// ── A skill page's cards ────────────────────────────────────────────────────

export type HideFilter = "none" | "r" | "sr"

export const HIDE_OPTIONS: { value: HideFilter; label: string }[] = [
	{ value: "none", label: "Every card" },
	{ value: "r", label: "Hide R" },
	{ value: "sr", label: "Hide R and SR" },
]

/** The cards a reader keeps (Daptrius's list, item 3): R and SR cards teach
 * many golds nobody would deck them for. A card with no rarity stays. */
export function keepCard(card: { rarity?: number | null }, hide: HideFilter): boolean {
	if (hide === "r") return card.rarity !== 1
	if (hide === "sr") return card.rarity !== 1 && card.rarity !== 2
	return true
}

/** "SSR · Speed": a card's rarity and type, as one short line. */
export function cardLine(card: { rarity: number | null; card_type: string | null }): string {
	return [RARITY_WORDS[card.rarity ?? 0], CARD_TYPE_LABELS[card.card_type ?? ""]].filter(Boolean).join(" · ")
}

// ── The lists' filters ──────────────────────────────────────────────────────

export type WhereFilter = "all" | "global" | "jp"

export const WHERE_OPTIONS: { value: WhereFilter; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "global", label: "On global" },
	{ value: "jp", label: "JP only" },
]

/** Does an entry's "on global" pass the Where filter? */
function whereMatches(where: WhereFilter, onGlobal: boolean | undefined): boolean {
	if (where === "all") return true
	return (where === "global") === Boolean(onGlobal)
}

/** Lowercase letters and digits only, so "T.M. Opera O" finds "TM Opera O". */
function searchKey(text: string): string {
	return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")
}

/** The list's count line: "1 uma", "112 umas". */
export function countLine(count: number, one: string, many: string): string {
	return count === 1 ? `1 ${one}` : `${count.toLocaleString("en-US")} ${many}`
}

export type StarFilter = "all" | "1" | "2" | "3"

export const STAR_OPTIONS: { value: StarFilter; label: string }[] = [
	{ value: "all", label: "Any stars" },
	{ value: "3", label: "★3" },
	{ value: "2", label: "★2" },
	{ value: "1", label: "★1" },
]

/** The outfits the list shows: those with a game id (the page's address), filtered and by name. */
export function filterUmas(umas: CatalogueUma[], query: string, where: WhereFilter, stars: StarFilter): CatalogueUma[] {
	const key = searchKey(query)
	return umas
		.filter((uma) => uma.game_id != null)
		.filter((uma) => !key || searchKey(uma.name).includes(key))
		.filter((uma) => whereMatches(where, uma.on_global))
		// A blank rarity counts as ★3, the rule Uma.is_three_star follows.
		.filter((uma) => stars === "all" || String(uma.rarity ?? 3) === stars)
		.sort((a, b) => a.name.localeCompare(b.name))
}

export type TypeFilter = "all" | keyof typeof CARD_TYPE_LABELS
export type RarityFilter = "all" | "3" | "2" | "1"

export const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = [
	{ value: "all", label: "Any type" },
	...Object.entries(CARD_TYPE_LABELS).map(([value, label]) => ({ value, label })),
]

export const RARITY_OPTIONS: { value: RarityFilter; label: string }[] = [
	{ value: "all", label: "Any rarity" },
	{ value: "3", label: "SSR" },
	{ value: "2", label: "SR" },
	{ value: "1", label: "R" },
]

/**
 * The cards the list shows: game cards with an id, never a placeholder ("your
 * best SSR Speed" is a stand-in with no page), filtered; by name, then rarity
 * high to low, so one character's cards sit together.
 */
export function filterCards(
	cards: CatalogueSupportCard[], query: string, type: TypeFilter, rarity: RarityFilter, where: WhereFilter,
): CatalogueSupportCard[] {
	const key = searchKey(query)
	return cards
		.filter((card) => card.game_id != null && !card.placeholder)
		.filter((card) => !key || searchKey(`${card.name} ${card.title}`).includes(key))
		.filter((card) => type === "all" || card.card_type === type)
		.filter((card) => rarity === "all" || String(card.rarity) === rarity)
		.filter((card) => whereMatches(where, card.on_global))
		.sort((a, b) => a.name.localeCompare(b.name) || (b.rarity ?? 0) - (a.rarity ?? 0))
}
