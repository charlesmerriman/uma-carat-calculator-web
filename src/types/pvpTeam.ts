/**
 * The PvP team builder: its catalogue (GET /pvp-catalogue) and a team (the
 * /pvp-teams routes, and the guest's device store).
 *
 * Mirrors backend/calculatorapi/views/pvp_catalogue.py and views/pvp_team.py;
 * shapes and refusals in backend/docs/api-reference.md ("/pvp-teams").
 */

import type { SkillAvailability } from "./pvpGuide"
import type { PvpEventKind } from "../utils/pvpEvent"
import type { PvpStyle } from "./pvpGuide"

// ── The catalogue ────────────────────────────────────────────────────────────

/** The ten aptitude columns. 1..8 = G..S, null when not imported. */
export type AptitudeKey =
	| "turf" | "dirt"
	| "short" | "mile" | "medium" | "long"
	| "front" | "pace" | "late" | "end"

export interface CatalogueSkillLink {
	skill: number
	/** unique / innate / awakening / evolved on an uma; hint / event on a card. */
	source: string
	level?: number | null
}

export interface CatalogueUma {
	id: number
	name: string
	/** The game's outfit id, for matching the sheet's exports. Absent from an older API. */
	game_id?: number | null
	image: string | null
	/** The borderless art when there is one, else the bordered art. */
	portrait: string | null
	rarity: number | null
	running_style: number | null
	/** The game's character: two outfits of one character share it. */
	character_id: number | null
	is_variant: boolean
	/** In the global game today (has skill links from the global snapshot). */
	on_global?: boolean
	apt: Record<AptitudeKey, number | null>
	skills: CatalogueSkillLink[]
}

export interface CatalogueSupportCard {
	id: number
	name: string
	/** The game's five-digit card id ("30086 Narita Top Road" in the sheet). Absent from an older API. */
	game_id?: number | null
	image: string | null
	card_type: string | null
	rarity: number | null
	title: string
	/**
	 * A group card's umas, by name (Team Sirius's six), from the game data.
	 * The deck rules count the card as one of each (utils/pvpTeams.ts). [] on
	 * every other card; absent from an API older than the field.
	 */
	group_members?: string[]
	/** In the global game today (has skill links from the global snapshot). */
	on_global?: boolean
	skills: CatalogueSkillLink[]
}

export interface CatalogueSkill {
	id: number
	name: string
	description: string
	image: string | null
	rarity: number
	tier: number | null
	group_id: number | null
	cost: number | null
	game_id?: number | null
	/** "○ white", "◎ white", "◎ gold" or "evolved": the tag the guide editor's picker shows. */
	version?: string
	/**
	 * Only on the rows the guide editor adds from GET /skills (withShownSkills):
	 * where the game has it, and every other name a [[mention]] may use.
	 * The builder's own catalogue rows have neither: they are all on global.
	 */
	availability?: SkillAvailability
	other_names?: string[]
}

export interface PvpCatalogue {
	umas: CatalogueUma[]
	support_cards: CatalogueSupportCard[]
	skills: CatalogueSkill[]
}

// ── A team ───────────────────────────────────────────────────────────────────

/** A style a team member runs: every guide style except "everyone". */
export type MemberStyle = Exclude<PvpStyle, "everyone">

export type PvpNoteColor = "yellow" | "pink" | "blue" | "green"

export interface PvpNote {
	text: string
	color: PvpNoteColor
}

export interface PvpTeamCardSlot {
	/** 1..6; 6 is the borrowed card. */
	slot: number
	support_card: number
}

export interface PvpTeamMember {
	/** 0..2. A missing position is an empty row. */
	position: number
	uma: number
	style: MemberStyle
	/** Filled slots only, any order on the wire; kept sorted by slot here. */
	cards: PvpTeamCardSlot[]
}

/** What a team holds, the same on the server and on the device. */
export interface PvpTeamContent {
	name: string
	notes: PvpNote[]
	members: PvpTeamMember[]
}

/** One team as the server sends it. */
export interface PvpTeamPayload extends PvpTeamContent {
	id: number
	kind: PvpEventKind
	event: number
	is_focus: boolean
	updated_at: string
	/** The public id of the gallery post copied from this team, or null. Out only. */
	post?: string | null
}

/**
 * One team in the client's state.
 *
 * `key` names it for React and for every edit, and never changes: a team made
 * while signed in exists on screen before the server has given it an id, so
 * the id cannot be the key. `id` is the server's, null for a guest's team and
 * for an account team whose create has not come back yet.
 */
export interface PvpTeam extends PvpTeamContent {
	key: string
	id: number | null
	kind: PvpEventKind
	event: number
	isFocus: boolean
	/**
	 * When it was last changed, in ms (0 when unknown). Picks between two
	 * teams for one event: the team drawer shows the one edited last.
	 */
	updatedAt: number
	/**
	 * The public id of this team's gallery post, or null/absent when it is not
	 * posted. Only an account's team can be posted; a guest's never is.
	 */
	post?: string | null
}
