/**
 * The guide editor's view of the catalogue: the team builder's catalogue
 * (skills on global) widened with every other skill GET /skills knows, so a
 * writer can pick and [[mention]] a JP-only skill. The builder keeps the
 * catalogue as it is: its skills stay global-only (skills-plan-3.md).
 */

import type { PvpCatalogueIndex } from "../hooks/usePvpCatalogue"
import type { CatalogueSkill } from "../types/pvpTeam"
import type { SkillListRow } from "../types/skills"

/** A GET /skills row in the catalogue's shape. The list carries no
 * description or cost: a preview chip shows the name, the server's answer
 * after the next autosave fills the rest. */
function catalogueRow(row: SkillListRow): CatalogueSkill {
	return {
		id: row.id,
		name: row.name,
		description: "",
		image: row.image,
		rarity: row.rarity,
		tier: row.tier,
		group_id: row.group_id,
		cost: null,
		game_id: row.game_id,
		version: row.version,
		availability: row.availability,
		other_names: row.other_names,
	}
}

/**
 * `index` with the list's skills added: a catalogue skill keeps its own row
 * (it has the description) and gains the list's other names; a skill the
 * catalogue lacks is added from the list. Same object back when there is
 * nothing to add, so a memo downstream stays put.
 */
export function withShownSkills(index: PvpCatalogueIndex, rows: SkillListRow[]): PvpCatalogueIndex {
	if (rows.length === 0) return index
	const byId = new Map(rows.map((row) => [row.id, row]))
	const skills: CatalogueSkill[] = index.catalogue.skills.map((skill) => {
		const row = byId.get(skill.id)
		return row ? { ...skill, availability: row.availability, other_names: row.other_names } : skill
	})
	const known = new Set(skills.map((skill) => skill.id))
	for (const row of rows) if (!known.has(row.id)) skills.push(catalogueRow(row))
	return {
		...index,
		catalogue: { ...index.catalogue, skills },
		skillsById: new Map(skills.map((skill) => [skill.id, skill])),
	}
}

/** Every lower-case name a catalogue skill answers to: its own and its other names. */
export function skillNames(skill: CatalogueSkill): string[] {
	return [skill.name, ...(skill.other_names ?? [])].filter(Boolean).map((name) => name.toLowerCase())
}

/**
 * SKILL SEARCH, one rule for every box that searches skills (Ctrl+K, the
 * veteran form, the course map's list, the guide editor's picker and its
 * `[[` suggestions, the Skills page), so the next box can't forget a name.
 *
 * A skill matches when every word typed is somewhere in its names: the shown
 * one and `other_names` (the API's Skill.search_names: UmaTL's, every alias
 * including GameTora's, and the Japanese name). Players know many skills by
 * GameTora's translation, which the site never shows (owner and Daptrius,
 * 2026-11-12), so the alias is what lets "It's Going to Be Me" find Certain
 * Victory. A query that is one number finds the skill with that game id, and
 * only that one: a part of an id would match dozens.
 */

// Hiragana, katakana and the CJK ideographs: a name with any of them is Japanese.
const JAPANESE_SCRIPT = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/

/**
 * `lang` for a skill's name: "ja" when it's the Japanese name (a skill with no
 * global or UmaTL name is shown in Japanese, owner and Daptrius 2026-11-12),
 * else undefined, which React leaves off. The browser then picks Japanese
 * glyphs and a screen reader the Japanese voice. Read from the text, so every
 * route that sends a name is covered without a flag of its own.
 */
export function nameLang(name: string): "ja" | undefined {
	return JAPANESE_SCRIPT.test(name) ? "ja" : undefined
}

/** Something a skill search can match: a catalogue skill or a GET /skills row. */
export interface SearchableSkill {
	name: string
	other_names?: string[]
	game_id?: number | null
}

/** Lower case, accents dropped ("condor" finds "Cóndor"). */
export function foldText(text: string): string {
	return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

/** A query as the words a skill search matches: folded, the ○/◎ marks dropped. */
export function skillSearchWords(query: string): string[] {
	return foldText(query).replace(/[○◎]/g, " ").split(/\s+/).filter(Boolean)
}

/** Does `skill` match the words (from skillSearchWords)? No words match everything. */
export function skillMatches(skill: SearchableSkill, words: string[]): boolean {
	if (words.length === 0) return true
	if (words.length === 1 && /^\d+$/.test(words[0])) return String(skill.game_id ?? "") === words[0]
	// One string for all the names, so the words may come from different ones,
	// the way the Skills page always matched.
	const haystack = foldText([skill.name, ...(skill.other_names ?? [])].join(" "))
	return words.every((word) => haystack.includes(word))
}
