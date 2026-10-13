/**
 * One event's PvP guide, as GET /pvp-guides/<kind>/<event_id> returns it.
 *
 * Mirrors backend/calculatorapi/views/pvp_guide.py. Every section is optional
 * and may be an empty array; the page skips a section with nothing in it. Rows
 * arrive sorted (by style in the order everyone, runaway, front, pace, late,
 * end, then each section's own rule), so the client never re-sorts.
 *
 * Text fields may hold `==highlight==` spans, which render red
 * (utils/remarkHighlight.ts for markdown, splitHighlights for one-line notes).
 */

/** A running style as a guide uses it. "everyone" is the whole team. */
export type PvpStyle = "everyone" | "runaway" | "front" | "pace" | "late" | "end"

export type PvpSkillCategory = "acceleration" | "speed" | "green" | "recovery" | "debuff" | "other"

/** Small embedded catalogue objects. Ids are the site's, not the game's. */
export interface PvpUmaRef {
	id: number
	name: string
	image: string | null
}

export interface PvpSupportCardRef {
	id: number
	name: string
	image: string | null
	card_type: string | null
	rarity: number | null
}

export interface PvpSkillRef {
	id: number
	name: string
	/** The game's own description: what the chip shows on hover. */
	description: string
	/** One of the game's generic skill icons. */
	image: string | null
	rarity: number
	/** The outfit whose unique this skill is, or null. */
	unique_of: string | null
}

export interface PvpStatConfig {
	style: PvpStyle
	/** A variant's name ("901* + 1 Gold"), or "". */
	label: string
	/** As the guide writes them: "1200", "1100+", "578*". "" renders as a dash. */
	speed: string
	stamina: string
	power: string
	guts: string
	wit: string
	footnote: string
}

export interface PvpUmaRecommendation {
	/** Never "everyone": a starred uma runs one style. */
	style: PvpStyle
	stars: number
	/** A short tag on the tile ("RA", "Runaway blocker"), or "". */
	role: string
	/** Shown on hover, or "". */
	note: string
	uma: PvpUmaRef
}

export interface PvpSkillRecommendation {
	style: PvpStyle
	category: PvpSkillCategory
	/** 0 (take first) to 4, or null when the guide has no tiers. */
	tier: number | null
	order: number
	note: string
	skill: PvpSkillRef
}

export interface PvpStyleNote {
	style: PvpStyle
	/** Markdown. */
	body: string
}

export interface PvpDeckSlot {
	/** 1 to 6. */
	slot: number
	/** 0 is the card; 1 and up are alternatives for the same slot. */
	order: number
	is_borrow: boolean
	note: string
	/** Null on a note-only row ("or any speed"). */
	support_card: PvpSupportCardRef | null
}

export interface PvpDeck {
	id: number
	style: PvpStyle
	label: string
	note: string
	/** Sorted by slot, then order. */
	slots: PvpDeckSlot[]
}

export interface PvpHonorableMention {
	style: PvpStyle
	note: string
	support_card: PvpSupportCardRef
}

export interface PvpTeamComp {
	text: string
	note: string
}

export interface PvpGuide {
	event_type: "champions_meeting" | "league_of_heroes"
	/** The event's id (the `id` in champions_meeting_data / league_of_heroes_event_data). */
	event: number
	/** False only for staff previewing a draft; visitors never receive one. */
	is_published: boolean
	updated_at: string
	scenario: { id: number; name: string; image: string | null } | null
	style_ranking: string
	/** Markdown. */
	short_description: string
	/** Markdown. */
	meta_analysis: string
	team_comps: PvpTeamComp[]
	stat_configs: PvpStatConfig[]
	uma_recommendations: PvpUmaRecommendation[]
	skill_recommendations: PvpSkillRecommendation[]
	style_notes: PvpStyleNote[]
	decks: PvpDeck[]
	honorable_mentions: PvpHonorableMention[]
}
