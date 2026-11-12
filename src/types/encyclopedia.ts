/**
 * GET /encyclopedia/umas/<game_id> and GET /encyclopedia/cards/<game_id>: one
 * outfit's or one support card's page (backend views/encyclopedia.py and
 * docs/api-reference.md). Early access only. No dates and no banners: the page
 * reads those from /calculator-data, where the predicted dates already are.
 */

import type { AptitudeKey } from "./pvpTeam"
import type { SkillListRow } from "./skills"

export type StatKey = "speed" | "stamina" | "power" | "guts" | "wit"

/** One star level's stats. */
export type StarStats = { star: number } & Record<StatKey, number>

/** A skill on a page: the Skills list row, plus where this uma or card gets it. */
export interface PageSkill extends Omit<SkillListRow, "other_names"> {
	/** unique / innate / awakening / evolved on an uma; hint / event on a card. */
	source: string
	/** The awakening rank, or the star a unique applies from. */
	level: number | null
	/** An evolution's base, by game id. */
	evolves_from: number | null
}

/** Another outfit, on an uma or card page. */
export interface PageOutfit {
	id: number
	game_id: number
	name: string
	title: string
	portrait: string | null
	rarity: number | null
	on_global: boolean
}

/** Another support card, on an uma or card page. */
export interface PageCard {
	id: number
	game_id: number
	name: string
	title: string
	image: string | null
	card_type: string
	rarity: number | null
	on_global: boolean
}

export interface UmaPageData {
	/** The row's pk: how /calculator-data's banners and the Collection name it. */
	id: number
	game_id: number
	name: string
	title: string
	jp_name: string
	jp_title: string
	portrait: string | null
	image: string | null
	rarity: number | null
	running_style: number | null
	on_global: boolean
	purpose: string
	apt: Record<AptitudeKey, number | null>
	base: Record<StatKey, number | null>
	growth: Record<StatKey, number | null>
	star_stats: StarStats[]
	skills: PageSkill[]
	outfits: PageOutfit[]
	cards: PageCard[]
}

export interface CardPageData {
	id: number
	game_id: number
	name: string
	title: string
	jp_name: string
	jp_title: string
	image: string | null
	image_borderless: string | null
	card_type: string
	rarity: number | null
	character_id: number | null
	on_global: boolean
	/** When it came out on Global; null if it isn't out. */
	released_at: string | null
	group_members: string[]
	purpose: string
	skills: PageSkill[]
	outfits: PageOutfit[]
	cards: PageCard[]
}
