/**
 * A PvP guide as the site's editor reads and writes it: ONE document, the
 * guide's tables with catalogue ids where the public route embeds objects
 * (backend/docs/api-reference.md, "PvP guide editor"; the server side is
 * calculatorapi/pvp_guide_document.py).
 *
 * Order is position: the client never sends `order` on a row, and the server
 * writes it from the array index. The one exception is a deck slot's `order`
 * (0 is the card, 1 and up an alternative under it), which says what the row
 * is, not where it sits.
 */

import type { PvpEventKind } from "../utils/pvpEvent"
import type { PvpSkillCategory, PvpStyle } from "./pvpGuide"

export interface GuideStatRow {
	style: PvpStyle
	label: string
	speed: string
	stamina: string
	power: string
	guts: string
	wit: string
	footnote: string
}

export interface GuideTeamCompRow {
	text: string
	note: string
}

export interface GuideUmaRow {
	/** Never "everyone". */
	style: PvpStyle
	uma: number
	stars: number
	role: string
	note: string
}

export interface GuideSkillRow {
	style: PvpStyle
	category: PvpSkillCategory
	/** 0 (take first) to 4, or null for no tier. */
	tier: number | null
	skill: number
	note: string
}

export interface GuideStyleNoteRow {
	style: PvpStyle
	/** Markdown. */
	body: string
}

export interface GuideSlotRow {
	/** 1 to 6. */
	slot: number
	/** 0 the card, 1 and up an "or" alternative in the same slot. */
	order: number
	is_borrow: boolean
	support_card: number | null
	note: string
}

export interface GuideDeckRow {
	/** The server's id, or null for a deck not saved yet. */
	id: number | null
	style: PvpStyle
	label: string
	note: string
	/**
	 * The gold box. Optional: a revision saved before it existed has none,
	 * and the server saves a missing one as false.
	 */
	is_highlighted?: boolean
	slots: GuideSlotRow[]
}

/** The sections, in the document's order. */
export type GuideSection =
	| "stat_configs"
	| "team_comps"
	| "uma_recommendations"
	| "skill_recommendations"
	| "style_notes"
	| "decks"

export interface GuideDocument {
	id: number
	/** The concurrency token: sent back with every save, bumped by every write. */
	version: number
	event_type: "champions_meeting" | "league_of_heroes"
	event: number
	is_published: boolean
	updated_at: string
	scenario: number | null
	style_ranking: string
	short_description: string
	meta_analysis: string
	/** Notes for editors, never shown on the site. */
	admin_comments: string
	stat_configs: GuideStatRow[]
	team_comps: GuideTeamCompRow[]
	uma_recommendations: GuideUmaRow[]
	skill_recommendations: GuideSkillRow[]
	style_notes: GuideStyleNoteRow[]
	decks: GuideDeckRow[]
}

/** The body of a save: the document minus what the server owns. */
export type GuideDocumentPut = Omit<GuideDocument, "id" | "event_type" | "event" | "is_published" | "updated_at">

/** One problem with a document, where it is ("decks[2].slots[5].note", "" for the whole). */
export interface EditorError {
	path: string
	message: string
}

export interface EditableGuideRow {
	id: number
	kind: PvpEventKind
	event: number
	name: string
	is_published: boolean
	version: number
	updated_at: string
	filled: PvpStyle[]
}

export interface EditableEvent {
	kind: PvpEventKind
	event: number
	name: string
}

/** GET /pvp-guides/editable. */
export interface EditableList {
	guides: EditableGuideRow[]
	events: EditableEvent[]
}

export type RevisionSource =
	| "site" | "admin" | "sheet" | "copy" | "track_greens" | "restore" | "publish" | "unpublish"

/** One row of GET /pvp-guides/<id>/revisions. */
export interface RevisionRow {
	number: number
	saved_at: string
	/** The author's handle, or null when the account is gone. Never a display name. */
	by: string | null
	is_you: boolean
	source: RevisionSource
	counts: Partial<Record<GuideSection, number>>
}
