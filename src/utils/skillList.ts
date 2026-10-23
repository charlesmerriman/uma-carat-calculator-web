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
