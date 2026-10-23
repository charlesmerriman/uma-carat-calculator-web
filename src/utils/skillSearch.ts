/**
 * The Skills page's search and filters, pure so they can be tested apart
 * from the page.
 */

import type { SkillAvailability } from "../types/pvpGuide"
import type { SkillListRow } from "../types/skills"
import { WHITE_SKILL_RARITY, skillColour } from "./pvpGuide"

export type ColourFilter = "all" | "white" | "gold" | "unique" | "evolved"
export type WhereFilter = "all" | SkillAvailability

export const COLOUR_FILTERS: { value: ColourFilter; label: string }[] = [
	{ value: "all", label: "All" },
	{ value: "white", label: "White" },
	{ value: "gold", label: "Gold" },
	{ value: "unique", label: "Unique" },
	{ value: "evolved", label: "Evolved" },
]

export const WHERE_FILTERS: { value: WhereFilter; label: string }[] = [
	{ value: "all", label: "Anywhere" },
	{ value: "global", label: "On global" },
	{ value: "announced", label: "Coming to global" },
	{ value: "jp", label: "JP only" },
]

/**
 * The rows that match: every word of the query in the name or any other name
 * (the translation, old names, the Japanese one), ignoring case, then the
 * two filters. Rows keep the API's order (by name).
 */
export function filterSkills(
	rows: SkillListRow[],
	query: string,
	colour: ColourFilter,
	where: WhereFilter
): SkillListRow[] {
	const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
	return rows.filter((row) => {
		if (colour !== "all" && skillColour(row) !== colour) return false
		if (where !== "all" && row.availability !== where) return false
		if (words.length === 0) return true
		const haystack = [row.name, ...row.other_names].join(" ").toLowerCase()
		return words.every((word) => haystack.includes(word))
	})
}

/** `?skill=<game id>` -> the id, or null for anything that isn't one. */
export function parseSkillParam(value: string | null): number | null {
	if (value === null || !/^\d{4,9}$/.test(value)) return null
	return Number(value)
}

/** The query parameter that names the open skill on the Skills page. */
export const SKILL_PARAM = "skill"

/** The link that opens one skill on the Skills page. */
export function skillHref(gameId: number): string {
	return `/app/skills?${SKILL_PARAM}=${gameId}`
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
