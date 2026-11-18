/**
 * The Skills page's search and filters, pure so they can be tested apart
 * from the page.
 */

import type { SkillAvailability } from "../types/pvpGuide"
import type { SkillListRow } from "../types/skills"
import { WHITE_SKILL_RARITY, skillColour } from "./pvpGuide"
import { skillMatches, skillSearchWords } from "./skillList"

// "inherited" is a unique's copy a parent passes on: white by colour, but its
// own filter and out of White (Daptrius's list, item 10).
export type ColourFilter = "white" | "gold" | "unique" | "inherited" | "evolved"
export type WhereFilter = "all" | SkillAvailability

/** The Color chips; several may be picked, and nothing picked is "All" (the chip row draws that one). */
export const COLOUR_FILTERS: { value: ColourFilter; label: string }[] = [
	{ value: "white", label: "White" },
	{ value: "gold", label: "Gold" },
	{ value: "unique", label: "Unique" },
	{ value: "inherited", label: "Inherited" },
	{ value: "evolved", label: "Evolved" },
]

/**
 * The Type filter (Daptrius's list, item 1): the API's `type` (backend
 * skill_types.py, where the grouping and its evidence are). A type is an icon
 * family; two of them have SUB-TYPES, because Daptrius asked for the greens
 * and the debuffs split up (board, 2026-11-12: "each family has common
 * effects, some of which are desired, others not"). A sub-type's key is its
 * parent's plus a suffix ("stat_speed"), so picking the parent keeps every
 * one of them. "Current speed" is a type of its own, split out of Speed at
 * his suggestion. The names are his to confirm before the release.
 *
 * A filter value is "all", a type's key or a sub-type's key.
 */
export type TypeFilter = string

export interface TypeOption {
	value: TypeFilter
	label: string
	/** Its sub-types, each a narrower filter the page offers once the type is picked. */
	subs?: { value: TypeFilter; label: string }[]
}

export const TYPE_FILTERS: TypeOption[] = [
	{ value: "all", label: "Any type" },
	{ value: "velocity", label: "Speed" },
	{ value: "current_speed", label: "Current speed" },
	{ value: "acceleration", label: "Acceleration" },
	{ value: "recovery", label: "Recovery" },
	{
		value: "stat",
		label: "Stat boost",
		subs: [
			{ value: "stat_speed", label: "Speed" },
			{ value: "stat_stamina", label: "Stamina" },
			{ value: "stat_power", label: "Power" },
			{ value: "stat_guts", label: "Guts" },
			{ value: "stat_wit", label: "Wit" },
			{ value: "stat_several", label: "Several stats" },
		],
	},
	{ value: "navigation", label: "Lane movement" },
	{ value: "start", label: "Start" },
	{ value: "vision", label: "Vision" },
	{
		value: "debuff",
		label: "Debuff",
		subs: [
			{ value: "debuff_speed", label: "Speed" },
			{ value: "debuff_acceleration", label: "Acceleration" },
			{ value: "debuff_rushing", label: "Rushing" },
			{ value: "debuff_stamina", label: "Stamina drain" },
			{ value: "debuff_vision", label: "Vision" },
		],
	},
	{ value: "unique", label: "Unique" },
	{ value: "scenario", label: "Scenario" },
	{ value: "other", label: "Other" },
]

/** The type a filter value belongs to: itself, or the parent of a sub-type. */
export function typeParent(value: TypeFilter): TypeOption {
	return TYPE_FILTERS.find((option) => option.value === value || option.subs?.some((sub) => sub.value === value)) ?? TYPE_FILTERS[0]
}

/** Does a row of this type pass the filter? A parent keeps all of its sub-types. */
export function typeMatches(rowType: string | undefined, filter: TypeFilter): boolean {
	if (filter === "all") return true
	const type = rowType ?? "other"
	return type === filter || type.startsWith(`${filter}_`)
}

// ── Several types at once (board "Allow Encyclopedia Filtering to select
//    multiple items", 2026-11-17: "speed and wit skills, but not guts") ──────
//
// The picks are a list of type keys and sub-type keys. A type picked whole is
// its own key ("stat"); narrowed, it is its sub-types' keys instead
// ("stat_speed", "stat_wit"), never both. A row passes when any pick matches.
// Each picked type with sub-types gets a sub-row of its own under the Type
// chips, so two of them (Stat boost and Debuff) can each be narrowed.

/** Does a row pass the Type picks? Nothing picked passes everything. */
export function typePicksMatch(rowType: string | undefined, picks: readonly TypeFilter[]): boolean {
	return picks.length === 0 || picks.some((pick) => typeMatches(rowType, pick))
}

/** The picks that belong to `parent`: itself, or its sub-types. */
function picksOf(picks: readonly TypeFilter[], parent: TypeFilter): TypeFilter[] {
	return picks.filter((pick) => typeParent(pick).value === parent)
}

/** The parent types picked, whole or narrowed, in the chips' order. */
export function pickedParents(picks: readonly TypeFilter[]): TypeOption[] {
	return TYPE_FILTERS.filter((option) => option.value !== "all" && picksOf(picks, option.value).length > 0)
}

/** A Type chip: picking a type adds it whole; picking it again drops it, sub-types and all. */
export function toggleTypePick(picks: readonly TypeFilter[], parent: TypeFilter): TypeFilter[] {
	const mine = picksOf(picks, parent)
	return mine.length > 0 ? picks.filter((pick) => !mine.includes(pick)) : [...picks, parent]
}

/**
 * A sub-type chip under `parent`. Its "All" (`sub === parent`) takes the type
 * whole again. A sub-type turns on and off; the last one off leaves the type
 * whole, so the type's chip never turns off from down here.
 */
export function toggleSubTypePick(picks: readonly TypeFilter[], parent: TypeFilter, sub: TypeFilter): TypeFilter[] {
	const others = picks.filter((pick) => typeParent(pick).value !== parent)
	if (sub === parent) return [...others, parent]
	const subs = picksOf(picks, parent).filter((pick) => pick !== parent)
	const next = subs.includes(sub) ? subs.filter((pick) => pick !== sub) : [...subs, sub]
	return [...others, ...(next.length > 0 ? next : [parent])]
}

/** The sub-types picked under `parent`; none means it is picked whole. */
export function subTypePicks(picks: readonly TypeFilter[], parent: TypeFilter): TypeFilter[] {
	return picksOf(picks, parent).filter((pick) => pick !== parent)
}

/**
 * A type's word by its key, for a row's second line and the skill card:
 * "velocity" -> "Speed", and a sub-type with its parent's word in front,
 * "stat_speed" -> "Stat boost: Speed", so it can't be read as the Speed type.
 */
export const SKILL_TYPE_WORDS: Record<string, string> = Object.fromEntries(
	TYPE_FILTERS.filter((option) => option.value !== "all").flatMap((option) => [
		[option.value, option.label],
		...(option.subs ?? []).map((sub) => [sub.value, `${option.label}: ${sub.label}`]),
	]),
)

/** Where, the setting every list shares (utils/encyclopedia.ts SHARED_WHERE_KEY); only skills have "Coming to global". */
export const WHERE_FILTERS: { value: WhereFilter; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "global", label: "On global" },
	{ value: "announced", label: "Coming to global" },
	{ value: "jp", label: "JP only" },
]

/**
 * The rows that match the query by any name, the id, or the uma a unique or
 * an evolution belongs to (`owners`, Daptrius's item 11: "Special Week" finds
 * Shooting Star), then the filters. Rows keep the API's order (by name).
 */
/**
 * The condition and effect filters (Daptrius's list, item 2): the chips, by
 * the API's tag keys (backend skill_tags.py, which reads them off the game's
 * code). A strategy, distance or surface chip finds skills that ASK for it.
 */
export type SkillTag = string
export const WHEN_TAGS: { value: SkillTag; label: string }[] = [
	{ value: "early", label: "Early-race" },
	{ value: "mid", label: "Mid-race" },
	{ value: "late", label: "Late-race" },
	{ value: "spurt", label: "Last spurt" },
	{ value: "corner", label: "Corner" },
	{ value: "final-corner", label: "Final corner" },
	{ value: "straight", label: "Straight" },
	{ value: "final-straight", label: "Final straight" },
	{ value: "uphill", label: "Uphill" },
	{ value: "downhill", label: "Downhill" },
]
export const RACE_TAGS: { value: SkillTag; label: string }[] = [
	{ value: "sprint", label: "Sprint" },
	{ value: "mile", label: "Mile" },
	{ value: "medium", label: "Medium" },
	{ value: "long", label: "Long" },
	{ value: "turf", label: "Turf" },
	{ value: "dirt", label: "Dirt" },
]
export const STYLE_TAGS: { value: SkillTag; label: string }[] = [
	{ value: "front-runner", label: "Front Runner" },
	{ value: "pace-chaser", label: "Pace Chaser" },
	{ value: "late-surger", label: "Late Surger" },
	{ value: "end-closer", label: "End Closer" },
]
export const DOES_TAGS: { value: SkillTag; label: string }[] = [
	{ value: "speed", label: "Speed" },
	{ value: "current-speed", label: "Current speed" },
	{ value: "accel", label: "Acceleration" },
	{ value: "recovery", label: "Recovery" },
	{ value: "stats", label: "Stats" },
	{ value: "vision", label: "Vision" },
	{ value: "navigation", label: "Navigation" },
	{ value: "debuff", label: "Debuff" },
]

/** Whether a skill must carry every picked tag, or one of them is enough. */
export type TagMatch = "all" | "any"

/** True when `rowTags` satisfies the picks: no picks always does. A row from an older API has no tags. */
export function tagsMatch(rowTags: readonly SkillTag[] | undefined, picks: readonly SkillTag[], match: TagMatch): boolean {
	if (picks.length === 0) return true
	const tags = new Set(rowTags ?? [])
	return match === "all" ? picks.every((pick) => tags.has(pick)) : picks.some((pick) => tags.has(pick))
}

export function filterSkills(
	rows: SkillListRow[],
	query: string,
	colours: readonly ColourFilter[],
	where: WhereFilter,
	types: readonly TypeFilter[] = [],
	tags: { picks: readonly SkillTag[]; match: TagMatch } = { picks: [], match: "all" }
): SkillListRow[] {
	const words = skillSearchWords(query)
	return rows.filter((row) => {
		if (colours.length > 0 && !colours.includes(skillKind(row) as ColourFilter)) return false
		if (where !== "all" && row.availability !== where) return false
		if (!typePicksMatch(row.type, types)) return false
		if (!tagsMatch(row.tags, tags.picks, tags.match)) return false
		return skillMatches({ ...row, other_names: [...row.other_names, ...(row.owners ?? [])] }, words)
	})
}

/** An OLD link's `?skill=<game id>` -> the id, or null for anything that isn't one. The
 * Skills page redirects such a link to the skill's own page (encyclopedia PR 5). */
export function parseSkillParam(value: string | null): number | null {
	if (value === null || !/^\d{4,9}$/.test(value)) return null
	return Number(value)
}

/** The query parameter old links named a skill by, before skills had pages. */
export const SKILL_PARAM = "skill"

/** One skill's page in the Encyclopedia: the only builder of the link. */
export function skillHref(gameId: number): string {
	return `/app/skills/${gameId}`
}

/** UmaTL's translation, credited wherever its text shows. */
export const UMATL_URL = "https://github.com/UmaTL/hachimi-tl-en"

/**
 * A skill's kind as the Skills page labels it: skillColour's word, except a
 * unique's inherited copy, which reads "inherited". It shares the unique's
 * name, so "white" beside it looked like a second skill of that name. The
 * game marks one by its id: 9 then five digits (true of every global skill,
 * import_game_data.guessed_structure).
 */
export function skillKind(skill: { game_id: number; rarity: number; is_evolved: boolean }): string {
	if (skill.rarity === WHITE_SKILL_RARITY && /^9\d{5}$/.test(String(skill.game_id))) return "inherited"
	return skillColour(skill)
}
