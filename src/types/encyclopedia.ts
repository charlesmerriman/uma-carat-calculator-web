/**
 * GET /encyclopedia/umas/<game_id> and GET /encyclopedia/cards/<game_id>: one
 * outfit's or one support card's page (backend views/encyclopedia.py and
 * docs/api-reference.md). Early access only. No dates and no banners: the page
 * reads those from /calculator-data, where the predicted dates already are.
 */

import type { AptitudeKey } from "./pvpTeam"
import type { SkillListRow, UnlockCondition } from "./skills"

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
	/**
	 * An evolution's unlock conditions, empty on any other row. Optional only
	 * because a page fetched before the field shipped may still be in the
	 * browser's cache; read it as `conditions ?? []`.
	 */
	conditions?: UnlockCondition[]
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
	/** The frameless texture FramedCard draws; null until uploaded, absent from an older API. */
	image_borderless?: string | null
	card_type: string
	rarity: number | null
	on_global: boolean
}

/** One career goal, worded by the API (backend career.py). */
export interface CareerGoal {
	turn: number
	/** "Classic Year, Early Feb" */
	when: string
	/** A race to run, a fan count to reach, or placings to collect. Absent from an older API (all races). */
	kind?: "race" | "fans" | "placings"
	/** The race's name; for a "fans" or "placings" goal, its whole sentence ("Get 3,000 fans"). */
	race: string
	/** "G1" to "G3" or "OP"; null for a debut and for a goal that isn't one race. */
	grade: string | null
	/** "Win", "Top 5" or "Run it"; "" for a goal that isn't one race. */
	need: string
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
	/** Race goals in order; absent from an API older than Phase 3. */
	objectives?: CareerGoal[]
	/** Goals of kinds not decoded yet, left out. */
	objectives_hidden?: number
	skills: PageSkill[]
	outfits: PageOutfit[]
	cards: PageCard[]
}

/** One training effect of a support card, worded and worked out by the API (backend support_effects.py). */
export interface CardEffect {
	/** The game's effect type id. */
	type: number
	/** "Friendship Bonus", the game's own English. */
	name: string
	/** "Increases the effectiveness of Friendship Training" */
	help: string
	/** How its value is written. Only confirmed formats carry a unit; the rest are "number". */
	format: "percent" | "number" | "level"
	/** The first level the card has the effect. */
	unlock: number
	/** One per level, index 0 = level 1, up to the card's top cap; null before `unlock`. */
	values: (number | null)[]
}

/** A card's unique effect: the level that unlocks it and the game's sentence for it. */
export interface CardUniqueEffect {
	level: number
	text: string
	/**
	 * The card's own effects this one multiplies with instead of adding to
	 * ("Friendship Bonus", "Specialty Priority"); empty for most cards.
	 */
	multiplies?: string[]
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
	/** Its training effects, in the order it gains them. Absent from an API older than Phase 2. */
	effects?: CardEffect[]
	/** Its level cap at each limit break, 0 to 4; [] when it has no effects on file. */
	caps?: number[]
	unique_effect?: CardUniqueEffect | null
	skills: PageSkill[]
	outfits: PageOutfit[]
	cards: PageCard[]
}
