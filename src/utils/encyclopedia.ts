/**
 * The Encyclopedia's plain helpers: the shared layout classes, the words for
 * rarity and running style, and the uma and card lists' filters. Kept out of
 * the component files so those export components only (fast refresh), and so
 * the filters are testable on their own.
 */

import type { AptitudeKey, CatalogueSupportCard, CatalogueUma } from "../types/pvpTeam"
import type { CardEffectsData, CardEffectsRow } from "../types/encyclopedia"
import type { Status } from "../components/rankings/kit/StatusPill"
import { CARD_TYPE_LABELS } from "./cardTypes"
import { formatDate, parseApiDate } from "./dateFormat"

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

/**
 * Where and Collection are SETTINGS every list shares, not one list's filters
 * (Daptrius, board "Encyclopedia Filter Changes", 2026-11-17: "set once or
 * twice per session"). Set on one list, they hold on the others. They sit
 * outside each list's scope ("cards:..."), so a list's Reset leaves them.
 */
export const SHARED_WHERE_KEY = "shared:where"
export const SHARED_OWNED_KEY = "shared:owned"

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
/** The shared Where: the Skills list adds "Coming to global" (utils/skillSearch.ts WHERE_FILTERS). */
export type SharedWhere = WhereFilter | "announced"
export const SHARED_WHERE_VALUES: SharedWhere[] = ["all", "global", "announced", "jp"]

export const WHERE_OPTIONS: { value: WhereFilter; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "global", label: "On global" },
	{ value: "jp", label: "JP only" },
]

/**
 * The shared Where as an uma or card list reads it. Only skills know
 * "Coming to global"; an outfit or card announced for global isn't on it
 * yet, so that pick reads as JP only here (and its chip shows pressed).
 */
export function listWhere(where: SharedWhere): WhereFilter {
	return where === "announced" ? "jp" : where
}

/** Does an entry's "on global" pass the Where filter? */
function whereMatches(where: WhereFilter, onGlobal: boolean | undefined): boolean {
	if (where === "all") return true
	return (where === "global") === Boolean(onGlobal)
}

/** Lowercase letters and digits only, so "T.M. Opera O" finds "TM Opera O". */
function searchKey(text: string): string {
	return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "")
}

/**
 * Does an entry match the search box? A query of digits only is an id
 * (Daptrius, board "Add Searchable Aliases", 2026-11-17): it matches the start
 * of any of `ids`, so "1068" finds every outfit and card of that character and
 * "30" every card id starting 30. Anything else matches the name text.
 */
export function searchMatches(query: string, text: string, ids: Array<number | null | undefined>): boolean {
	const trimmed = query.trim()
	if (/^\d+$/.test(trimmed)) return ids.some((id) => id != null && String(id).startsWith(trimmed))
	const key = searchKey(query)
	return !key || searchKey(text).includes(key)
}

/** A multi-pick filter: nothing picked passes everything, else any pick does. */
function picked<T>(picks: readonly T[], value: T): boolean {
	return picks.length === 0 || picks.includes(value)
}

/** The list's count line: "1 uma", "112 umas". */
export function countLine(count: number, one: string, many: string): string {
	return count === 1 ? `1 ${one}` : `${count.toLocaleString("en-US")} ${many}`
}

export type StarFilter = "1" | "2" | "3"

/** The Stars chips; nothing picked is "All" (the chip row draws that one). */
export const STAR_OPTIONS: { value: StarFilter; label: string }[] = [
	{ value: "3", label: "★3" },
	{ value: "2", label: "★2" },
	{ value: "1", label: "★1" },
]

/**
 * The outfits the list shows: those with a game id (the page's address),
 * filtered and by name. The search box also takes an outfit id (100101) or its
 * character's (1001), which the outfit id starts with.
 */
export function filterUmas(umas: CatalogueUma[], query: string, where: WhereFilter, stars: readonly StarFilter[]): CatalogueUma[] {
	return umas
		.filter((uma) => uma.game_id != null)
		.filter((uma) => searchMatches(query, `${uma.name} ${uma.title ?? ""}`, [uma.game_id, uma.character_id]))
		.filter((uma) => whereMatches(where, uma.on_global))
		// A blank rarity counts as ★3, the rule Uma.is_three_star follows.
		.filter((uma) => picked(stars, String(uma.rarity ?? 3) as StarFilter))
		.sort((a, b) => a.name.localeCompare(b.name))
}

export type TypeFilter = keyof typeof CARD_TYPE_LABELS
export type RarityFilter = "3" | "2" | "1"

/** The Type chips, one per card type (the chips draw each as its icon, utils/cardTypeIcons.ts). */
export const TYPE_OPTIONS: { value: TypeFilter; label: string }[] = Object.entries(CARD_TYPE_LABELS).map(
	([value, label]) => ({ value, label })
)

/** The Rarity chips; a picked one lights up in its metal, like the tag on a tile (RARITY_TAG_CLASS). */
export const RARITY_OPTIONS: { value: RarityFilter; label: string }[] = [
	{ value: "3", label: "SSR" },
	{ value: "2", label: "SR" },
	{ value: "1", label: "R" },
]

/**
 * The cards the list shows: game cards with an id, never a placeholder ("your
 * best SSR Speed" is a stand-in with no page), filtered; by name, then rarity
 * high to low, so one character's cards sit together. The search box also
 * takes a card id (30265) or its character's (1068).
 */
export function filterCards(
	cards: CatalogueSupportCard[],
	query: string,
	types: readonly TypeFilter[],
	rarities: readonly RarityFilter[],
	where: WhereFilter,
): CatalogueSupportCard[] {
	return cards
		.filter((card) => card.game_id != null && !card.placeholder)
		.filter((card) => searchMatches(query, `${card.name} ${card.title}`, [card.game_id, card.character_id]))
		.filter((card) => picked(types, card.card_type ?? ""))
		.filter((card) => picked(rarities, String(card.rarity) as RarityFilter))
		.filter((card) => whereMatches(where, card.on_global))
		.sort((a, b) => a.name.localeCompare(b.name) || (b.rarity ?? 0) - (a.rarity ?? 0))
}

// ── Sorting the lists (Daptrius, board "Encyclopedia Filter Sorts", 2026-11-13) ──
//
// One sort is picked from a menu and a button turns it round (board "Make Sort
// into a Dropdown with reversable directions", 2026-11-17). Each sort has the
// direction a player wants first: names A to Z, ids low to high, dates newest
// first, effects and aptitudes best first. The button flips the comparison
// only: an entry the sort can't place (JP only, no date, no effect, no
// aptitude, a unique's missing cost) stays at the end both ways round.

export type SortOrder = "name" | "release" | "game_id"

export const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
	{ value: "name", label: "Name" },
	{ value: "release", label: "Release date" },
	{ value: "game_id", label: "Game ID" },
]

/** Sorts that read best (or newest) first by default; every other sort runs low to high. */
const HIGH_FIRST = /^(release|effect|apt_)/

/** Does `order` run high to low, after the reverse button? */
export function sortsHighFirst(order: string, reversed: boolean): boolean {
	return HIGH_FIRST.test(order) !== reversed
}

/** The reverse button's words: the direction the list runs in now. */
export function directionWords(order: string, reversed: boolean): string {
	const high = sortsHighFirst(order, reversed)
	if (order === "name") return reversed ? "Z to A" : "A to Z"
	if (order === "release") return high ? "Newest first" : "Oldest first"
	if (order.startsWith("apt_")) return high ? "Best first" : "Worst first"
	return high ? "Highest first" : "Lowest first"
}

/** The remembered reverse button: "1" when turned round, the default not stored. */
export const REVERSED_VALUES = ["0", "1"] as const

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
	/** The Global date is the site's estimate (its first banner's `is_predicted`), as the card page badges it. */
	predicted?: boolean
}

/** Every outfit's or card's release dates, by pk, in one pass over the banners. */
export function releaseDates<
	B extends { banner_timeline: { start_date: string; is_predicted?: boolean } },
	C extends { id: number; first_jp_date: string | null },
>(
	banners: B[],
	cardsOf: (banner: B) => C[],
): Map<number, ReleaseDates> {
	const dates = new Map<number, ReleaseDates>()
	for (const banner of banners) {
		const start = parseApiDate(banner.banner_timeline.start_date)?.getTime() ?? null
		for (const entry of cardsOf(banner)) {
			const known = dates.get(entry.id) ?? { global: null, jp: null }
			if (start !== null && (known.global === null || start < known.global)) {
				known.global = start
				known.predicted = Boolean(banner.banner_timeline.is_predicted)
			}
			const jp = entry.first_jp_date ? parseApiDate(entry.first_jp_date)?.getTime() ?? null : null
			if (jp !== null && (known.jp === null || jp < known.jp)) known.jp = jp
			dates.set(entry.id, known)
		}
	}
	return dates
}

/**
 * The card list's dates: the banners' first, else the game's own date
 * (`released_at`), which is how a welfare SSR, an SR or an R gets one (Daptrius,
 * board "Update Support Banners", 2026-11-17: they sorted as undated). The
 * same reading as the Collection's sort (cardRelease.collectionCardRelease).
 * Selectors and the PvP picker never read this: they stay banners only.
 */
export function withGameDates(
	dates: Map<number, ReleaseDates>,
	cards: readonly Pick<CatalogueSupportCard, "id" | "released_at">[],
): Map<number, ReleaseDates> {
	const merged = new Map(dates)
	for (const card of cards) {
		const known = merged.get(card.id)
		if (known?.global != null || !card.released_at) continue
		const game = parseApiDate(card.released_at)?.getTime() ?? null
		// The game's date has passed (the API sends only those), so it is never an estimate.
		if (game !== null) merged.set(card.id, { global: game, jp: known?.jp ?? null, predicted: false })
	}
	return merged
}

/**
 * `items` in the chosen order, as a new array. Name is A to Z. Game ID is the
 * game's own numbering. Release date goes by the Global date, newest first;
 * one with no Global date yet (JP only) comes after every Global one, by its
 * JP date in the same direction, and one with no date at all comes last, by
 * name. Mixing the two calendars in one run would file a JP card from 2021
 * among Global's 2021. `reversed` turns the order round, buckets kept.
 */
export function sortList<T extends { id: number; name: string; game_id?: number | null }>(
	items: T[],
	order: SortOrder,
	dates: Map<number, ReleaseDates> = new Map(),
	reversed = false,
): T[] {
	const byName = (a: T, b: T) => a.name.localeCompare(b.name)
	if (order === "name") return [...items].sort((a, b) => (reversed ? -1 : 1) * byName(a, b))
	if (order === "game_id") return sortByValue(items, (item) => item.game_id ?? null, reversed)
	const direction = sortsHighFirst(order, reversed) ? -1 : 1
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

/**
 * `items` by a number, low to high (`highFirst` turns it round), ties by
 * name. An item with no number (null) comes last either way: a unique has no
 * skill point cost, an unimported aptitude no grade.
 */
export function sortByValue<T extends { name: string }>(items: T[], valueOf: (item: T) => number | null, highFirst: boolean): T[] {
	const direction = highFirst ? -1 : 1
	return [...items].sort((a, b) => {
		const valueA = valueOf(a)
		const valueB = valueOf(b)
		if (valueA === null || valueB === null) return (valueA === null ? 1 : 0) - (valueB === null ? 1 : 0) || a.name.localeCompare(b.name)
		return direction * (valueA - valueB) || a.name.localeCompare(b.name)
	})
}

/**
 * What a tile says under its name while the list is sorted by id or date
 * (Daptrius, board "Show what is being Sorted by on each card", 2026-11-17),
 * as the effect sort already shows the effect: "ID 30265", the Global date
 * ("Est. 2029/7/1" when it is the site's estimate from the JP schedule, which
 * the card page badges "Estimated"), or "JP 2024/3/1" for one with no Global
 * date at all. Null for any other sort, or when there is nothing to say.
 */
export function sortFact(order: string, item: { id: number; game_id?: number | null }, dates: Map<number, ReleaseDates>): string | null {
	if (order === "game_id") return item.game_id != null ? `ID ${item.game_id}` : null
	if (order !== "release") return null
	const date = dates.get(item.id)
	if (date?.global != null) return `${date.predicted ? "Est. " : ""}${formatDate(new Date(date.global).toISOString())}`
	if (date?.jp != null) return `JP ${formatDate(new Date(date.jp).toISOString())}`
	return null
}

// ── The Umas list's aptitude filter and sort (same post) ────────────────────

export type AptitudeGroupId = "surface" | "distance" | "style"

/**
 * Three rows, one per kind of aptitude. Several columns may be picked in a
 * row, each with its own lowest grade, and an outfit must pass every pick
 * (board "Allow Encyclopedia Filtering to select multiple items", 2026-11-17:
 * "Turf A and Dirt C"); 1..8 = G..S, as the API sends them. `short` is the
 * chip's word on a narrow screen (Daptrius: "Med.", "Dist.").
 */
export const APTITUDE_GROUPS: {
	id: AptitudeGroupId
	label: string
	short?: string
	keys: { value: AptitudeKey; label: string; short?: string }[]
}[] = [
	{ id: "surface", label: "Surface", keys: [{ value: "turf", label: "Turf" }, { value: "dirt", label: "Dirt" }] },
	{ id: "distance", label: "Distance", short: "Dist.", keys: [
		{ value: "short", label: "Sprint" }, { value: "mile", label: "Mile" },
		{ value: "medium", label: "Medium", short: "Med." }, { value: "long", label: "Long" },
	] },
	{ id: "style", label: "Style", keys: [
		{ value: "front", label: "Front" }, { value: "pace", label: "Pace" },
		{ value: "late", label: "Late" }, { value: "end", label: "End" },
	] },
]

/** Every aptitude column, in the order the groups list them. */
export const APTITUDE_KEYS: AptitudeKey[] = APTITUDE_GROUPS.flatMap((group) => group.keys.map((key) => key.value))

/** A column's word: "Mile". */
export function aptitudeLabel(key: AptitudeKey): string {
	return APTITUDE_GROUPS.flatMap((group) => group.keys).find((entry) => entry.value === key)?.label ?? key
}

/** The "at least" grades, best first; the value is the API's number as text (it is remembered as text). */
export const GRADE_OPTIONS: { value: string; label: string }[] = ["S", "A", "B", "C", "D", "E", "F", "G"].map((letter, index) => ({
	value: String(8 - index), label: letter,
}))

/** A grade's letter: 8 -> "S", 1 -> "G". */
export function gradeLetter(value: number): string {
	return "GFEDCBAS"[value - 1] ?? "?"
}

/** Does an outfit pass one picked column? An unimported (null) aptitude never passes. */
export function aptitudeMatches(apt: Record<AptitudeKey, number | null>, key: AptitudeKey, min: string): boolean {
	return (apt[key] ?? 0) >= Number(min)
}

/** The Umas list's sorts: the shared three, then one per aptitude column, best first (Daptrius, 2026-11-17). */
export type UmaSortOrder = SortOrder | `apt_${AptitudeKey}`

export const UMA_SORT_OPTIONS: { value: UmaSortOrder; label: string; group?: string }[] = [
	...SORT_OPTIONS,
	...APTITUDE_KEYS.map((key) => ({ value: `apt_${key}` as UmaSortOrder, label: aptitudeLabel(key), group: "Aptitude" })),
]

/** The aptitude an uma sort reads, or null for the shared sorts. */
export function sortAptitude(order: UmaSortOrder): AptitudeKey | null {
	return order.startsWith("apt_") ? (order.slice(4) as AptitudeKey) : null
}

// ── Sorting the card list by an effect (notes/card-effect-sort-plan.md) ──────

/** The card list's sorts: the shared three, and "By effect". */
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
	reversed = false,
): T[] {
	const direction = reversed ? 1 : -1
	const keyOf = (card: T): [number, number] => {
		const row = data.cards[String(card.id)]
		const limitBreak = limitBreakOf(card)
		if (limitBreak === null) return [1, 0]
		const reading = row ? effectReading(row, type, limitBreak) : null
		return reading ? [0, reading.value] : [2, 0]
	}
	// Reversed, lowest first; the unread and the cards without it stay last.
	return [...cards].sort((a, b) => {
		const [bucketA, valueA] = keyOf(a)
		const [bucketB, valueB] = keyOf(b)
		return bucketA - bucketB || direction * (valueA - valueB) || a.name.localeCompare(b.name)
	})
}
