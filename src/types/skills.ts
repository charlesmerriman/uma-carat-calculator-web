/**
 * GET /skills and GET /skills/<game_id>: every skill a player may read about
 * (any skill with an English name, JP-only ones included), for the Skills
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
