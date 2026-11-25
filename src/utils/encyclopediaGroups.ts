/**
 * The headings down a long Encyclopedia list and the thumb index beside it
 * (components/encyclopedia/groups.tsx), for every sort a list has.
 *
 * Sorted by name, a list files under letters, as a printed encyclopedia does
 * (notes/encyclopedia-redesign-plan.md). Every other sort gets the same
 * treatment with its own unit, each picked from the live data (2026-11-25,
 * 283 umas and 589 cards) so a heading usually sits over a row or more:
 *
 * | Sort         | Heading                  | Index      | Typical group      |
 * |--------------|--------------------------|------------|--------------------|
 * | Name         | the first letter         | the letter | about 11           |
 * | Release date | the quarter, "Q3 2025"   | the year   | about 15 (months: 5, too thin) |
 * | Game ID      | uma: a thousand ids; card: its rarity | the same | about 25 / 100 to 300 |
 * | Aptitude     | the grade letter         | the letter | 10 or more         |
 * | Effect       | the value, "35%"         | the value  | most 10 or more; a one-card value is merged into a range |
 *
 * Plain helpers, kept out of the component file so it exports components only.
 */

import { formatQuarterName } from "./dateFormat"
import { RARITY_WORDS, effectValue, gradeLetter, type ReleaseDates } from "./encyclopedia"

/** What one row of a list files under. Neighbouring rows with the same `key` share a heading. */
export interface GroupKey {
	/** The group's id within its list (also its heading's element id, so letters, digits and dashes only). */
	key: string
	/** The heading's big words: "A", "Q3 2025", "35%". */
	label: string
	/** Small words after the count: "Jul to Sep". */
	note?: string
	/**
	 * The thumb index's button for this group. Neighbouring groups with the same
	 * index share one button, on the first (each quarter of 2026 is one "2026").
	 * Null for a tail group, which has no button.
	 */
	index: string | null
	/** A tail group (no date, no grade, not owned): it always sits last, so its label is set small. */
	tail?: boolean
	/** A colour for the label: a grade letter ("A") or a rarity ("ssr"). */
	tone?: string
	/** A word any one row can add to its group's note, once: "estimated" when some dates in it are the site's estimate. */
	mark?: string
	/** The number the rows read, for merging a group too small to stand alone (`mergeSmallGroups`). */
	value?: number
}

export interface ListGroup<T> extends GroupKey {
	items: T[]
}

/**
 * The list cut into runs of one key, in the order given (so a list turned
 * round runs Z to A, newest to oldest, and so on). However the list is
 * filtered and however short: the owner wants the headings kept whenever a
 * filter is on (2026-11-25; they used to show on the full list only, and a
 * 12-tile floor would still have dropped them for 14 of the 45 two-aptitude
 * filters, Dirt + Front among them). Null only for an empty list.
 */
export function groupsFor<T>(items: T[], keyOf: (item: T) => GroupKey): ListGroup<T>[] | null {
	if (items.length === 0) return null
	const groups: ListGroup<T>[] = []
	const seen = new Map<string, number>()
	for (const item of items) {
		const key = keyOf(item)
		const last = groups[groups.length - 1]
		if (last && last.key.split("~")[0] === key.key) {
			last.items.push(item)
			if (key.mark && !last.mark) last.mark = key.mark
			continue
		}
		// A key that comes back after another run (data out of step with the
		// sort) gets its own heading, with a suffix so the element ids stay unique.
		const count = seen.get(key.key) ?? 0
		seen.set(key.key, count + 1)
		groups.push({ ...key, key: count ? `${key.key}~${count}` : key.key, items: [item] })
	}
	return groups
}

/**
 * Folds a group with fewer than `min` rows into its neighbour, so a value only
 * one or two cards reach (a unique effect's 44% Friendship Bonus) shares a
 * heading instead of getting one of its own. Merged headings name the range,
 * low to high whichever way the list runs: "38% to 40%". Only groups with a
 * `value` merge; tail groups never do.
 */
export function mergeSmallGroups<T>(
	groups: ListGroup<T>[] | null,
	min: number,
	rangeLabel: (low: number, high: number) => string,
): ListGroup<T>[] | null {
	if (!groups) return null
	const merged: ListGroup<T>[] = []
	// Each merged group's lowest and highest value, side by side with `merged`.
	const ranges: { low: number; high: number }[] = []
	for (const group of groups) {
		const at = merged.length - 1
		const last = merged[at]
		const value = group.value
		const mergeable = last !== undefined && last.value !== undefined && value !== undefined && !last.tail && !group.tail
		if (mergeable && (last.items.length < min || group.items.length < min)) {
			const range = { low: Math.min(ranges[at].low, value), high: Math.max(ranges[at].high, value) }
			ranges[at] = range
			// The first group's index button stays: it is where the merged run starts.
			last.key = `${last.key.split("-to-")[0]}-to-${value}`
			last.label = rangeLabel(range.low, range.high)
			last.items.push(...group.items)
		} else {
			merged.push({ ...group, items: [...group.items] })
			ranges.push({ low: value ?? 0, high: value ?? 0 })
		}
	}
	return merged
}

/** The thumb index's buttons: one per change of `index`, each jumping to the first group that has it. */
export function indexEntries(groups: GroupKey[]): { label: string; key: string }[] {
	const entries: { label: string; key: string }[] = []
	let previous: string | null = null
	for (const group of groups) {
		if (group.index !== null && group.index !== previous) entries.push({ label: group.index, key: group.key })
		previous = group.index
	}
	return entries
}

/** The element id a group's heading carries, per list, so two lists never clash. */
export const groupId = (scope: string, key: string) => `enc-${scope}-group-${key.replace(/[^A-Za-z0-9-]/g, "_")}`

// ── One key per sort ─────────────────────────────────────────────────────────

/** Name: its first letter, or "#" for a name that doesn't start with one. */
export function letterKey(name: string): GroupKey {
	const first = name.trim().charAt(0).toUpperCase()
	const letter = /[A-Z]/.test(first) ? first : "#"
	return { key: letter === "#" ? "other" : letter, label: letter, index: letter }
}

/**
 * Release date: the quarter of the date the tile prints (sortFact). Both go
 * through dateFormat from the same ISO string, so a tile never sits under a
 * quarter its own date contradicts. The three buckets sortList keeps apart
 * stay apart here too: a JP only quarter is labelled "JP" and indexed "JP",
 * and an undated row files under "No date".
 */
export function releaseKey(date: ReleaseDates | undefined): GroupKey {
	const jpOnly = date?.global == null
	const time = date?.global ?? date?.jp ?? null
	const quarter = time === null ? null : formatQuarterName(new Date(time).toISOString())
	if (quarter === null) return { key: "undated", label: "No date", index: null, tail: true }
	return {
		key: `${jpOnly ? "jp" : "global"}-${quarter.label.replace(" ", "-")}`,
		label: `${jpOnly ? "JP " : ""}${quarter.label}`,
		note: quarter.months,
		index: jpOnly ? "JP" : String(quarter.year),
		mark: !jpOnly && date?.predicted ? "estimated" : undefined,
	}
}

/**
 * An uma's game ID: a thousand ids a group, "100xxx". The game numbers an
 * outfit 1CCCOO (character, then outfit), so a group is ten characters,
 * about 25 outfits.
 */
export function umaIdKey(gameId: number | null | undefined): GroupKey {
	if (gameId == null) return { key: "no-id", label: "No ID", index: null, tail: true }
	const block = Math.floor(gameId / 1000)
	return { key: `id-${block}`, label: `${block}xxx`, index: String(block) }
}

/**
 * A card's game ID: its rarity. The game's card ids start with it (1xxxx R,
 * 2xxxx SR, 3xxxx SSR), so in id order the rarities come as three runs.
 */
export function cardIdKey(card: { rarity?: number | null; game_id?: number | null }): GroupKey {
	const word = RARITY_WORDS[card.rarity ?? 0]
	if (card.game_id == null || !word) return { key: "no-id", label: "No ID", index: null, tail: true }
	return { key: `rarity-${card.rarity}`, label: word, index: word, tone: word.toLowerCase() }
}

/** An aptitude: the grade letter, in the game's colour for it. An outfit not imported yet has none. */
export function gradeKey(grade: number | null | undefined): GroupKey {
	if (grade == null) return { key: "ungraded", label: "No grades yet", index: null, tail: true }
	const letter = gradeLetter(grade)
	return { key: `grade-${grade}`, label: letter, index: letter, tone: letter }
}

/**
 * An effect: what the card gives for it, "35%". `read` is false for a card
 * the sort can't read (the player's own limit break on a card they don't
 * own); `value` null for a card without the effect. Both sit last, as
 * sortByEffect puts them.
 */
export function effectKey(value: number | null, read: boolean, format: string): GroupKey {
	if (!read) return { key: "unread", label: "Not owned", index: null, tail: true }
	if (value === null) return { key: "without", label: "Doesn't give it", index: null, tail: true }
	return { key: `value-${value}`, label: effectValue(value, format), index: String(value), value }
}
