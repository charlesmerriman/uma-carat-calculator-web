/**
 * The Encyclopedia's plain helpers: the shared layout classes, the words for
 * rarity and running style, and the uma and card lists' filters. Kept out of
 * the component files so those export components only (fast refresh), and so
 * the filters are testable on their own.
 */

import type { AptitudeKey, CatalogueSupportCard, CatalogueUma } from "../types/pvpTeam"
import type { CardEffectsData, CardEffectsRow } from "../types/encyclopedia"
import type { Status } from "../components/rankings/kit/StatusPill"
import { CARD_TYPE_COLORS, CARD_TYPE_LABELS } from "./cardTypes"
import { parseApiDate } from "./dateFormat"

export const PAGE_CONTAINER = "mx-auto my-3 flex w-[calc(100%-1rem)] max-w-6xl flex-col gap-4 sm:w-[calc(100%-2rem)]"

/** A filter's chip values, the `allowed` list a remembered filter is checked against. */
export function values<T extends string>(options: readonly { value: T }[]): T[] {
	return options.map((option) => option.value)
}

export const RARITY_WORDS: Record<number, string> = { 1: "R", 2: "SR", 3: "SSR" }
/** A rarity's pill, in the game's metals (encyclopedia.css, ".enc-tag--ssr"). */
export const RARITY_TAG_CLASS: Record<number, string> = { 1: "enc-tag--r", 2: "enc-tag--sr", 3: "enc-tag--ssr" }
export const RUNNING_STYLE_WORDS: Record<number, string> = {
	1: "Front Runner", 2: "Pace Chaser", 3: "Late Surger", 4: "End Closer",
}
/** A running style's dot: Hakuraku's colours (index.css, --color-style-*), always beside the word. */
export const RUNNING_STYLE_COLORS: Record<number, string> = {
	1: "var(--color-style-front)", 2: "var(--color-style-pace)", 3: "var(--color-style-late)", 4: "var(--color-style-end)",
}

/**
 * A banner's status from the dates the site already gave it: running between
 * its two dates, ended after, upcoming before. `now` is the caller's clock,
 * read once per page (useState), never at render time.
 */
export function bannerStatus(start: string, end: string, now: Date): Status {
	const from = parseApiDate(start)?.getTime() ?? 0
	const to = parseApiDate(end)?.getTime() ?? 0
	if (now.getTime() > to) return "ended"
	return now.getTime() >= from ? "running" : "upcoming"
}

/**
 * A support card effect's value as the game writes it: "16%", "Lv 2", "21".
 * The format is the API's, and only a confirmed one adds a unit (backend
 * support_effects.py): an unconfirmed type is the bare number the files hold.
 */
export function effectValue(value: number, format: string): string {
	if (format === "percent") return `${value}%`
	if (format === "level") return `Lv ${value}`
	return String(value)
}

/** An aptitude a player wouldn't race her on: D or worse (the game's 1 to 4 of 8). */
export function isWeakAptitude(value: number | null): boolean {
	return value != null && value <= 4
}

// ── What the player owns (hooks/useOwned.ts) ────────────────────────────────

/** "★★★★" for an owned outfit; "" when the player hasn't set its stars. */
export function ownedStars(stars: number | null | undefined): string {
	return stars ? "★".repeat(stars) : ""
}

/** "Limit break 3", or "Max limit break" at 4. */
export function limitBreakWords(limitBreak: number): string {
	return limitBreak >= 4 ? "Max limit break" : `Limit break ${limitBreak}`
}

export type OwnedFilter = "all" | "owned" | "missing"

export const OWNED_OPTIONS: { value: OwnedFilter; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "owned", label: "Owned" },
	{ value: "missing", label: "Not owned" },
]

/** Does a row with this pk pass the Owned filter? */
export function ownedMatches(filter: OwnedFilter, owned: { has: (id: number) => boolean }, id: number): boolean {
	if (filter === "all") return true
	return owned.has(id) === (filter === "owned")
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
	{ value: "all", label: "Any" },
	{ value: "3", label: "★3" },
	{ value: "2", label: "★2" },
	{ value: "1", label: "★1" },
]

/** The outfits the list shows: those with a game id (the page's address), filtered and by name. */
export function filterUmas(umas: CatalogueUma[], query: string, where: WhereFilter, stars: StarFilter): CatalogueUma[] {
	const key = searchKey(query)
	return umas
		.filter((uma) => uma.game_id != null)
		.filter((uma) => !key || searchKey(`${uma.name} ${uma.title ?? ""}`).includes(key))
		.filter((uma) => whereMatches(where, uma.on_global))
		// A blank rarity counts as ★3, the rule Uma.is_three_star follows.
		.filter((uma) => stars === "all" || String(uma.rarity ?? 3) === stars)
		.sort((a, b) => a.name.localeCompare(b.name))
}

export type TypeFilter = "all" | keyof typeof CARD_TYPE_LABELS
export type RarityFilter = "all" | "3" | "2" | "1"

export const TYPE_OPTIONS: { value: TypeFilter; label: string; dot?: string }[] = [
	{ value: "all", label: "Any" },
	// Each type's own hue as a dot on its chip (CARD_TYPE_COLORS), beside its word.
	...Object.entries(CARD_TYPE_LABELS).map(([value, label]) => ({ value, label, dot: CARD_TYPE_COLORS[value] })),
]

export const RARITY_OPTIONS: { value: RarityFilter; label: string }[] = [
	{ value: "all", label: "Any" },
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

// ── Sorting the lists (Daptrius, board "Encyclopedia Filter Sorts", 2026-11-13) ──

export type SortOrder = "name" | "newest" | "oldest" | "game_id"

export const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
	{ value: "name", label: "Name" },
	{ value: "newest", label: "Newest" },
	{ value: "oldest", label: "Oldest" },
	{ value: "game_id", label: "Game ID" },
]

/** The Skills list's sorts: a skill has no release date of its own. */
export const SKILL_SORT_OPTIONS = SORT_OPTIONS.filter((option) => option.value === "name" || option.value === "game_id")

/**
 * When an outfit or card came out, as epoch ms: its first Global banner (the
 * site's predicted date for one still to come) and its first JP banner.
 * Read from the banners /calculator-data already holds, the same place the
 * pages' release dates come from (encyclopediaBanners.ts), so a list and a
 * page never disagree.
 */
export interface ReleaseDates {
	global: number | null
	jp: number | null
}

/** Every outfit's or card's release dates, by pk, in one pass over the banners. */
export function releaseDates<B extends { banner_timeline: { start_date: string } }, C extends { id: number; first_jp_date: string | null }>(
	banners: B[],
	cardsOf: (banner: B) => C[],
): Map<number, ReleaseDates> {
	const dates = new Map<number, ReleaseDates>()
	for (const banner of banners) {
		const start = parseApiDate(banner.banner_timeline.start_date)?.getTime() ?? null
		for (const entry of cardsOf(banner)) {
			const known = dates.get(entry.id) ?? { global: null, jp: null }
			if (start !== null && (known.global === null || start < known.global)) known.global = start
			const jp = entry.first_jp_date ? parseApiDate(entry.first_jp_date)?.getTime() ?? null : null
			if (jp !== null && (known.jp === null || jp < known.jp)) known.jp = jp
			dates.set(entry.id, known)
		}
	}
	return dates
}

/**
 * `items` in the chosen order, as a new array. Name is A to Z. Game ID is the
 * game's own numbering. Newest and Oldest go by the Global date; one with no
 * Global date yet (JP only) comes after every Global one, by its JP date in the
 * same direction, and one with no date at all comes last, by name. Mixing the
 * two calendars in one run would file a JP card from 2021 among Global's 2021.
 */
export function sortList<T extends { id: number; name: string; game_id?: number | null }>(
	items: T[],
	order: SortOrder,
	dates: Map<number, ReleaseDates> = new Map(),
): T[] {
	const byName = (a: T, b: T) => a.name.localeCompare(b.name)
	if (order === "name") return [...items].sort(byName)
	if (order === "game_id") return [...items].sort((a, b) => (a.game_id ?? 0) - (b.game_id ?? 0) || byName(a, b))
	const direction = order === "newest" ? -1 : 1
	// 0 = has a Global date, 1 = JP only, 2 = no date: the bucket orders first.
	const keyOf = (item: T): [number, number] => {
		const date = dates.get(item.id)
		if (date?.global != null) return [0, date.global]
		if (date?.jp != null) return [1, date.jp]
		return [2, 0]
	}
	return [...items].sort((a, b) => {
		const [bucketA, timeA] = keyOf(a)
		const [bucketB, timeB] = keyOf(b)
		return bucketA - bucketB || direction * (timeA - timeB) || byName(a, b)
	})
}

// ── The Umas list's aptitude filter (same post) ─────────────────────────────

/**
 * Three rows, one per kind of aptitude, so "Mile C, Dirt D and Front A or
 * better" is one pick in each. A row is a column (or "any") and the lowest
 * grade that passes; 1..8 = G..S, as the API sends them.
 */
export const APTITUDE_GROUPS: { id: "surface" | "distance" | "style"; label: string; keys: { value: "any" | AptitudeKey; label: string }[] }[] = [
	{ id: "surface", label: "Surface", keys: [
		{ value: "any", label: "Any" }, { value: "turf", label: "Turf" }, { value: "dirt", label: "Dirt" },
	] },
	{ id: "distance", label: "Distance", keys: [
		{ value: "any", label: "Any" }, { value: "short", label: "Sprint" }, { value: "mile", label: "Mile" },
		{ value: "medium", label: "Medium" }, { value: "long", label: "Long" },
	] },
	{ id: "style", label: "Style", keys: [
		{ value: "any", label: "Any" }, { value: "front", label: "Front" }, { value: "pace", label: "Pace" },
		{ value: "late", label: "Late" }, { value: "end", label: "End" },
	] },
]

/** The "at least" grades, best first; the value is the API's number as text (it is remembered as text). */
export const GRADE_OPTIONS: { value: string; label: string }[] = ["S", "A", "B", "C", "D", "E", "F", "G"].map((letter, index) => ({
	value: String(8 - index), label: letter,
}))

/** Does an outfit pass one aptitude row? An unimported (null) aptitude never passes a picked column. */
export function aptitudeMatches(apt: Record<AptitudeKey, number | null>, key: "any" | AptitudeKey, min: string): boolean {
	if (key === "any") return true
	return (apt[key] ?? 0) >= Number(min)
}

// ── Sorting the card list by an effect (notes/card-effect-sort-plan.md) ──────

/** The card list's sorts: the shared four, and "By effect". */
export type CardSortOrder = SortOrder | "effect"

export const CARD_SORT_OPTIONS: { value: CardSortOrder; label: string }[] = [
	...SORT_OPTIONS,
	{ value: "effect", label: "By effect" },
]

/** Which limit break the effect sort reads: max, or the player's own copy. */
export type EffectAt = "max" | "mine"

export const EFFECT_AT_OPTIONS: { value: EffectAt; label: string }[] = [
	{ value: "max", label: "Max limit break" },
	{ value: "mine", label: "My limit break" },
]

/** Friendship Bonus and Specialty Priority: a unique's value multiplies with the card's own (backend support_effects.MULTIPLIED_TYPES). */
const MULTIPLIED_TYPES = new Set([1, 19])

/** What a card gives for one effect type at one limit break, for the sort and the tile. */
export interface EffectReading {
	value: number
	/** True when the unique effect is unlocked here and has a part nobody has decoded: the value may be higher. */
	unsure: boolean
}

/**
 * What `row` gives for effect `type` at limit break `limitBreak` (0 to 4),
 * unique effect included once it is unlocked at that limit break's cap.
 * A unique Friendship Bonus or Specialty Priority multiplies with the card's
 * own: (100 + own) x (1 + unique / 100) - 100, so own 35 and unique 40 give
 * 89, not 75 (Daptrius, 2026-11-13). Every other unique value adds. Null when
 * the card has neither the effect nor a unique value for it.
 */
export function effectReading(row: CardEffectsRow, type: number, limitBreak: number): EffectReading | null {
	const own = row.effects[String(type)]?.[limitBreak] ?? null
	const unique = row.unique && row.unique.level <= (row.caps[limitBreak] ?? 0) ? row.unique : null
	const extra = unique?.values[String(type)]
	const unsure = Boolean(unique?.conditional)
	if (extra === undefined) return own === null ? null : { value: own, unsure }
	if (own !== null && MULTIPLIED_TYPES.has(type)) {
		return { value: Math.floor((100 + own) * (1 + extra / 100) - 100), unsure }
	}
	return { value: (own ?? 0) + extra, unsure }
}

/**
 * `cards` by what each gives for `type`, highest first. `limitBreakOf`
 * answers which limit break to read a card at, or null for a card it can't
 * (a card the player doesn't own, sorting by their own copies): those come
 * after every card read, and a card without the effect after those, by name.
 */
export function sortByEffect<T extends { id: number; name: string }>(
	cards: T[],
	type: number,
	limitBreakOf: (card: T) => number | null,
	data: CardEffectsData,
): T[] {
	const keyOf = (card: T): [number, number] => {
		const row = data.cards[String(card.id)]
		const limitBreak = limitBreakOf(card)
		if (limitBreak === null) return [1, 0]
		const reading = row ? effectReading(row, type, limitBreak) : null
		return reading ? [0, reading.value] : [2, 0]
	}
	return [...cards].sort((a, b) => {
		const [bucketA, valueA] = keyOf(a)
		const [bucketB, valueB] = keyOf(b)
		return bucketA - bucketB || valueB - valueA || a.name.localeCompare(b.name)
	})
}
