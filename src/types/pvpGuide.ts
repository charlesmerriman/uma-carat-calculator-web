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

import type { AptitudeKey } from "./pvpTeam"

/** A running style as a guide uses it. "everyone" is the whole team. */
export type PvpStyle = "everyone" | "runaway" | "front" | "pace" | "late" | "end"

/**
 * A tab of the guide's running-style strip: one style, or "all" of them on
 * one screen, the way the source sheet lays a guide out (Henry, 2026-10-21).
 * Only the guide's tabs take "all"; a team's member is always one PvpStyle.
 */
export type PvpStyleTab = Exclude<PvpStyle, "everyone"> | "all"

export type PvpSkillCategory = "acceleration" | "speed" | "green" | "recovery" | "debuff" | "other"

/** Small embedded catalogue objects. Ids are the site's, not the game's. */
export interface PvpUmaRef {
	id: number
	name: string
	image: string | null
	/** The borderless art, drawn in the site's frame (FramedUma). Optional for older fixtures. */
	portrait?: string | null
	/**
	 * Its ten aptitudes, 1..8 (G..S) or null, as /pvp-catalogue sends them: the
	 * guide prints this course's distance and the row's style as letters.
	 * Optional: an older API answer and older fixtures have none.
	 */
	apt?: Partial<Record<AptitudeKey, number | null>> | null
}

export interface PvpSupportCardRef {
	id: number
	name: string
	image: string | null
	card_type: string | null
	rarity: number | null
}

/**
 * Another version of a recommended skill: its white, gold or evolved form.
 * Derived by the API from the game data (same group, plus the evolution
 * link); a guide names ONE version per row and these ride along.
 */
export interface PvpSkillVersion {
	id: number
	name: string
	description: string
	image: string | null
	/** 1 white, 2 gold: what says the colour (WHITE_SKILL_RARITY in utils/pvpGuide). */
	rarity: number
	/**
	 * The game's place in the group: 1 a ○, 2 a ◎ white or an ordinary gold,
	 * 3 the gold above a ◎. Never read the colour from it.
	 */
	tier: number
	/** "○ white", "◎ white", "◎ gold" or "evolved": the label a chip shows. */
	version: string
	is_evolved: boolean
}

/** Where the game has a skill (the API's Skill.availability). "jp" is tagged "JP only". */
export type SkillAvailability = "global" | "announced" | "jp"

/**
 * One phrase of a skill's readable text. `raw` is the game's own code for a
 * clause or effect nobody has confirmed the meaning of yet: shown as code.
 */
export interface SkillPhrase {
	text: string
	raw: boolean
}

/** A condition: every phrase in `all`, and one of the `any` lists (none when empty). */
export interface SkillCondition {
	all: SkillPhrase[]
	any: SkillPhrase[][]
}

/** One effect slot of a skill: a skill has one or two. */
export interface SkillSlot {
	/** The precondition: must have held earlier in the race. */
	after: SkillCondition
	when: SkillCondition
	effects: SkillPhrase[]
	/** "2.4 s", "Whole race", or null for an instant effect. */
	duration: string | null
	/** "Once per race", "30 s", or null. */
	cooldown: string | null
}

/** When a skill fires and what it does, from the game data (skill_text.describe). */
export interface SkillReadable {
	/** Rolls against Wit before it fires; null when the game data doesn't say. */
	wit_check: boolean | null
	/** False when any phrase is raw. */
	complete: boolean
	slots: SkillSlot[]
}

/** Where a player gets a skill, in short: a few of each, with the totals. */
export interface PvpSkillSources {
	umas: { name: string; source: string; level: number | null; on_global: boolean }[]
	uma_count: number
	cards: { name: string; source: string; on_global: boolean }[]
	card_count: number
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
	/** This skill's own version label: "○ white", "◎ white", "◎ gold", "evolved". */
	version: string
	/** The game's place in the group, as on PvpSkillVersion; `rarity` says the colour. */
	tier: number
	is_evolved: boolean
	/** Its other versions, white then gold then evolved; empty when it has none. */
	versions: PvpSkillVersion[]
	/**
	 * Absent on a ref the guide editor builds from the catalogue, and from an
	 * API older than 2026-10-23: every reader treats absent as "on global,
	 * global's own text, nothing more to show".
	 */
	availability?: SkillAvailability
	/** The name or description shown is UmaTL's translation: credit UmaTL. */
	uses_translation?: boolean
	readable?: SkillReadable
	sources?: PvpSkillSources
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
	/** Drawn in a gold box, to set it apart (the sheet's Honorable Mentions row). */
	is_highlighted: boolean
	/** Sorted by slot, then order. */
	slots: PvpDeckSlot[]
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
	/** The editors' "still being updated" switch: the reader shows a banner (Henry, 2026-10-24). */
	under_construction: boolean
	team_comps: PvpTeamComp[]
	stat_configs: PvpStatConfig[]
	uma_recommendations: PvpUmaRecommendation[]
	skill_recommendations: PvpSkillRecommendation[]
	style_notes: PvpStyleNote[]
	decks: PvpDeck[]
	/**
	 * Every `[[Skill name]]` in the guide's text, resolved: lower-case name ->
	 * skill. A mention missing here (a skill that went stale) renders as its
	 * plain name. Optional: an older API omits it.
	 */
	skill_mentions?: Record<string, PvpSkillRef>
	/**
	 * Visible comments per section: "" for the whole guide, else a running
	 * style. A section with none is absent. Optional: an older API omits it.
	 */
	comment_counts?: Record<string, number>
}
