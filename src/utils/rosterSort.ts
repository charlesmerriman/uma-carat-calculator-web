/**
 * The Collection grids' sorting (owner, 2026-10-26): several sorts combined in
 * the order the player adds them, newest released first to start. Pure
 * (src/__tests__/rosterSort.test.ts).
 *
 * THE RULES
 * ---------
 * - Steps apply in order: the second only breaks ties of the first.
 * - Each key starts in its useful direction (newest, rarest, most stars, A to
 *   Z) and can be flipped.
 * - A missing value (no release date, not owned so no stars) sorts LAST in
 *   either direction: "newest first" never opens on a wall of unknowns.
 * - The last tie-breakers are the name, then the id, so the order never
 *   jumps between renders.
 */

export type UmaSortKey = "released" | "acquired" | "rarity" | "name" | "stars" | "potential"
export type CardSortKey = "released" | "acquired" | "rarity" | "name" | "limit_break" | "type"

export interface SortStep<Key extends string> {
	key: Key
	desc: boolean
}

/** Label and starting direction per key, in the order the "Add a sort" list offers them. */
export const UMA_SORTS: Array<{ key: UmaSortKey; label: string; desc: boolean }> = [
	{ key: "released", label: "Release date", desc: true },
	{ key: "acquired", label: "Date acquired", desc: true },
	{ key: "rarity", label: "Rarity", desc: true },
	{ key: "stars", label: "Stars", desc: true },
	{ key: "potential", label: "Potential", desc: true },
	{ key: "name", label: "Name", desc: false },
]

export const CARD_SORTS: Array<{ key: CardSortKey; label: string; desc: boolean }> = [
	{ key: "released", label: "Release date", desc: true },
	{ key: "acquired", label: "Date acquired", desc: true },
	{ key: "rarity", label: "Rarity", desc: true },
	{ key: "limit_break", label: "Limit break", desc: true },
	{ key: "type", label: "Type", desc: false },
	{ key: "name", label: "Name", desc: false },
]

/** Where every grid starts: the most recently released first. */
export const DEFAULT_SORT = [{ key: "released", desc: true }] as const

/** The game's card-type order, for sorting by type. */
const TYPE_ORDER = ["speed", "stamina", "power", "guts", "wit", "friend", "group"]
export function typeRank(cardType: string | null): number | null {
	const rank = cardType ? TYPE_ORDER.indexOf(cardType) : -1
	return rank === -1 ? null : rank
}

type Value = number | string | null | undefined

function compareValues(a: Value, b: Value, desc: boolean): number {
	const missingA = a === null || a === undefined
	const missingB = b === null || b === undefined
	if (missingA || missingB) return Number(missingA) - Number(missingB)
	const order = typeof a === "string" && typeof b === "string" ? a.localeCompare(b) : (a as number) - (b as number)
	return desc ? -order : order
}

/**
 * `items` sorted by `steps` in order, then by name and id. `valueOf(key,
 * item)` reads one key's value; return null when the item has none.
 */
export function sortBySteps<Item extends { id: number; name: string }, Key extends string>(
	items: Item[],
	steps: ReadonlyArray<SortStep<Key>>,
	valueOf: (key: Key, item: Item) => Value
): Item[] {
	return [...items].sort((a, b) => {
		for (const step of steps) {
			const order = compareValues(valueOf(step.key, a), valueOf(step.key, b), step.desc)
			if (order !== 0) return order
		}
		return a.name.localeCompare(b.name) || a.id - b.id
	})
}

/** The steps with `key` added at the end in its starting direction (no-op if present). */
export function addStep<Key extends string>(
	steps: ReadonlyArray<SortStep<Key>>,
	key: Key,
	options: Array<{ key: Key; desc: boolean }>
): Array<SortStep<Key>> {
	if (steps.some((step) => step.key === key)) return [...steps]
	return [...steps, { key, desc: options.find((option) => option.key === key)?.desc ?? false }]
}

/** How a step reads on its chip: "newest first", "highest first", "A to Z". */
export function directionLabel(key: string, desc: boolean): string {
	if (key === "released" || key === "acquired") return desc ? "newest first" : "oldest first"
	if (key === "name") return desc ? "Z to A" : "A to Z"
	if (key === "type") return desc ? "Group to Speed" : "Speed to Group"
	return desc ? "highest first" : "lowest first"
}

