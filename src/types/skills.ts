/**
 * GET /skills and GET /skills/<game_id>: every skill a player may read about
 * (any skill with a name, JP-only ones included, the Japanese name when it has
 * no English one), for the Skills
 * page and the guide editor's picker. See backend/docs/api-reference.md.
 */

import type { SkillAvailability, SkillReadable } from "./pvpGuide"

/** One row of GET /skills. */
export interface SkillListRow {
	id: number
	game_id: number
	name: string
	image: string | null
	rarity: number
	tier: number
	group_id: number
	/** "○ white", "◎ white", "◎ gold" or "evolved". */
	version: string
	is_evolved: boolean
	availability: SkillAvailability
	/** The name shown is UmaTL's translation. */
	uses_translation: boolean
	/** Every other name it answers to (translation, old names, Japanese), for search. */
	other_names: string[]
	/** Skill points; null for a unique. Absent from an API older than the Encyclopedia. */
	cost?: number | null
	/** The Type filter's key, from the skill's icon family (backend skill_types.py). */
	type?: string
	/** The outfits a unique, its inherited copy or an evolution belongs to. */
	owners?: string[]
	/** A unique's inherited copy, or the copy's unique, by game id. */
	pair?: number | null
}

export interface SkillSourceUma {
	id: number
	name: string
	game_id: number | null
	/** The borderless art, drawn as FramedUma. */
	image: string | null
	/** unique / innate / awakening / evolved */
	source: string
	level: number | null
	on_global: boolean
}

export interface SkillSourceCard {
	id: number
	name: string
	game_id: number | null
	image: string | null
	/** hint / event */
	source: string
	on_global: boolean
}

/** GET /skills/<game_id>: one skill in full. */
export interface SkillDetailData extends SkillListRow {
	description: string
	readable: SkillReadable
	sources: { umas: SkillSourceUma[]; cards: SkillSourceCard[] }
	evolution: {
		from: Omit<SkillListRow, "other_names"> | null
		into: Omit<SkillListRow, "other_names">[]
		conditions: { text: string; uses_translation: boolean; is_japanese: boolean }[]
		scenario: number | null
	}
	versions: Omit<SkillListRow, "other_names">[]
}
