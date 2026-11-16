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
export type ColourFilter = "all" | "white" | "gold" | "unique" | "inherited" | "evolved"
export type WhereFilter = "all" | SkillAvailability

export const COLOUR_FILTERS: { value: ColourFilter; label: string }[] = [
	{ value: "all", label: "All" },
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

export const WHERE_FILTERS: { value: WhereFilter; label: string }[] = [
	{ value: "all", label: "Anywhere" },
	{ value: "global", label: "On global" },
	{ value: "announced", label: "Coming to global" },
	{ value: "jp", label: "JP only" },
]

/**
 * The rows that match the query by any name, the id, or the uma a unique or
 * an evolution belongs to (`owners`, Daptrius's item 11: "Special Week" finds
 * Shooting Star), then the filters. Rows keep the API's order (by name).
 */
export function filterSkills(
	rows: SkillListRow[],
	query: string,
	colour: ColourFilter,
	where: WhereFilter,
	type: TypeFilter = "all"
): SkillListRow[] {
	const words = skillSearchWords(query)
	return rows.filter((row) => {
		if (colour !== "all" && skillKind(row) !== colour) return false
		if (where !== "all" && row.availability !== where) return false
		if (!typeMatches(row.type, type)) return false
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
