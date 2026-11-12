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
 * The Type filter (Daptrius's list, item 1): the API's `type`, read off the
 * skill's icon family (backend skill_types.py, where the grouping and its
 * evidence are). The names are Daptrius's to confirm before the release.
 */
export type TypeFilter = "all" | "unique" | "stat" | "velocity" | "acceleration" | "recovery" | "navigation"
	| "start" | "vision" | "debuff" | "scenario" | "other"

export const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
	{ value: "all", label: "Any type" },
	{ value: "velocity", label: "Speed" },
	{ value: "acceleration", label: "Acceleration" },
	{ value: "recovery", label: "Recovery" },
	{ value: "stat", label: "Stat boost" },
	{ value: "navigation", label: "Lane movement" },
	{ value: "start", label: "Start" },
	{ value: "vision", label: "Vision" },
	{ value: "debuff", label: "Debuff" },
	{ value: "unique", label: "Unique" },
	{ value: "scenario", label: "Scenario" },
	{ value: "other", label: "Other" },
]

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
		if (type !== "all" && (row.type ?? "other") !== type) return false
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
