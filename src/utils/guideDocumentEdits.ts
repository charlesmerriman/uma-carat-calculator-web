/**
 * The edits the guide editor makes, each a pure function from a document to
 * a new document (the old one untouched, so undo is a list of documents).
 *
 * Rows are addressed by their index in the document's section, which is
 * also their order (order is position: utils/guideDocument.ts). Moving a row
 * within a style keeps the other styles' rows where they are, because the
 * editor shows one style at a time and a drag inside Front must never shift
 * Pace.
 */

import type {
	GuideDeckRow,
	GuideDocument,
	GuideSkillRow,
	GuideSlotRow,
	GuideStatRow,
	GuideTeamCompRow,
	GuideUmaRow,
} from "../types/guideDocument"
import type { PvpSkillCategory, PvpStyle } from "../types/pvpGuide"
import { DECK_SLOTS } from "./guideDocument"

type Doc = GuideDocument

function replaceAt<T>(rows: T[], index: number, row: T): T[] {
	return rows.map((current, i) => (i === index ? row : current))
}

function removeAt<T>(rows: T[], index: number): T[] {
	return rows.filter((_, i) => i !== index)
}

/**
 * Move the row at `from` to sit where `to` is, both indices into the whole
 * section. Rows between them shift by one; nothing else moves.
 */
export function moveRow<T>(rows: T[], from: number, to: number): T[] {
	if (from === to || from < 0 || to < 0 || from >= rows.length || to >= rows.length) return rows
	const next = [...rows]
	const [row] = next.splice(from, 1)
	next.splice(to, 0, row)
	return next
}

// ── Overview ─────────────────────────────────────────────────────────────────

export function setField(doc: Doc, field: "style_ranking" | "short_description" | "meta_analysis" | "admin_comments", value: string): Doc {
	return { ...doc, [field]: value }
}

export function setUnderConstruction(doc: Doc, underConstruction: boolean): Doc {
	return { ...doc, under_construction: underConstruction }
}

export function setScenario(doc: Doc, scenario: number | null): Doc {
	return { ...doc, scenario }
}

// ── Stats ────────────────────────────────────────────────────────────────────

export function addStat(doc: Doc, style: PvpStyle = "everyone"): Doc {
	const row: GuideStatRow = { style, label: "", speed: "", stamina: "", power: "", guts: "", wit: "", footnote: "" }
	return { ...doc, stat_configs: [...doc.stat_configs, row] }
}

export function updateStat(doc: Doc, index: number, patch: Partial<GuideStatRow>): Doc {
	return { ...doc, stat_configs: replaceAt(doc.stat_configs, index, { ...doc.stat_configs[index], ...patch }) }
}

export function removeStat(doc: Doc, index: number): Doc {
	return { ...doc, stat_configs: removeAt(doc.stat_configs, index) }
}

export function moveStat(doc: Doc, from: number, to: number): Doc {
	return { ...doc, stat_configs: moveRow(doc.stat_configs, from, to) }
}

// ── Team comps ───────────────────────────────────────────────────────────────

export function addTeamComp(doc: Doc, text = ""): Doc {
	const row: GuideTeamCompRow = { text, note: "" }
	return { ...doc, team_comps: [...doc.team_comps, row] }
}

export function updateTeamComp(doc: Doc, index: number, patch: Partial<GuideTeamCompRow>): Doc {
	return { ...doc, team_comps: replaceAt(doc.team_comps, index, { ...doc.team_comps[index], ...patch }) }
}

export function removeTeamComp(doc: Doc, index: number): Doc {
	return { ...doc, team_comps: removeAt(doc.team_comps, index) }
}

export function moveTeamComp(doc: Doc, from: number, to: number): Doc {
	return { ...doc, team_comps: moveRow(doc.team_comps, from, to) }
}

// ── Umas ─────────────────────────────────────────────────────────────────────

/** Add an uma to a style, after that style's last row. No-op if it is there already. */
export function addUma(doc: Doc, style: PvpStyle, umaId: number, stars = 3): Doc {
	if (doc.uma_recommendations.some((row) => row.style === style && row.uma === umaId)) return doc
	const row: GuideUmaRow = { style, uma: umaId, stars, role: "", note: "" }
	return { ...doc, uma_recommendations: insertAfterStyle(doc.uma_recommendations, style, row) }
}

export function updateUma(doc: Doc, index: number, patch: Partial<GuideUmaRow>): Doc {
	return { ...doc, uma_recommendations: replaceAt(doc.uma_recommendations, index, { ...doc.uma_recommendations[index], ...patch }) }
}

export function removeUma(doc: Doc, index: number): Doc {
	return { ...doc, uma_recommendations: removeAt(doc.uma_recommendations, index) }
}

export function moveUma(doc: Doc, from: number, to: number): Doc {
	return { ...doc, uma_recommendations: moveRow(doc.uma_recommendations, from, to) }
}

/**
 * Insert `row` right after the last row of its style, so it lands at the end
 * of that tab; a style with no rows yet gets it at the end of the section.
 */
function insertAfterStyle<T extends { style: PvpStyle }>(rows: T[], style: PvpStyle, row: T): T[] {
	let last = -1
	rows.forEach((current, i) => {
		if (current.style === style) last = i
	})
	const next = [...rows]
	next.splice(last === -1 ? rows.length : last + 1, 0, row)
	return next
}

// ── Skills ───────────────────────────────────────────────────────────────────

export function addSkill(doc: Doc, style: PvpStyle, category: PvpSkillCategory, skillId: number, tier: number | null = null): Doc {
	if (doc.skill_recommendations.some((row) => row.style === style && row.category === category && row.skill === skillId)) return doc
	const row: GuideSkillRow = { style, category, tier, skill: skillId, note: "" }
	return { ...doc, skill_recommendations: insertAfterStyle(doc.skill_recommendations, style, row) }
}

export function updateSkill(doc: Doc, index: number, patch: Partial<GuideSkillRow>): Doc {
	return { ...doc, skill_recommendations: replaceAt(doc.skill_recommendations, index, { ...doc.skill_recommendations[index], ...patch }) }
}

export function removeSkill(doc: Doc, index: number): Doc {
	return { ...doc, skill_recommendations: removeAt(doc.skill_recommendations, index) }
}

export function moveSkill(doc: Doc, from: number, to: number): Doc {
	return { ...doc, skill_recommendations: moveRow(doc.skill_recommendations, from, to) }
}

// ── Advice ───────────────────────────────────────────────────────────────────

/** Set a style's advice; an empty body removes the box. */
export function setStyleNote(doc: Doc, style: PvpStyle, body: string): Doc {
	const index = doc.style_notes.findIndex((row) => row.style === style)
	if (!body.trim() && index === -1) return doc
	if (index === -1) return { ...doc, style_notes: [...doc.style_notes, { style, body }] }
	return { ...doc, style_notes: replaceAt(doc.style_notes, index, { style, body }) }
}

// ── Decks ────────────────────────────────────────────────────────────────────

export function addDeck(doc: Doc, style: PvpStyle, label = "Standard"): Doc {
	const deck: GuideDeckRow = { id: null, style, label, note: "", slots: [] }
	return { ...doc, decks: insertAfterStyle(doc.decks, style, deck) }
}

export function updateDeck(doc: Doc, index: number, patch: Partial<Omit<GuideDeckRow, "slots">>): Doc {
	return { ...doc, decks: replaceAt(doc.decks, index, withBorrow({ ...doc.decks[index], ...patch })) }
}

/**
 * The borrow is slot 6, always, and a swap-ins deck (the guide's row of cards
 * that can replace one, Henry's "Honorable Mentions") has none (Henry, board
 * 1575020815450116199, 2026-11-25: a card put back in slot 6 lost its BORROW
 * band, because the mark was a per-slot button). Applied on every slot edit
 * and on the Swap-ins switch, so no edit can leave it anywhere else.
 */
function withBorrow(deck: GuideDeckRow): GuideDeckRow {
	const borrowed = (row: GuideSlotRow) => !deck.is_highlighted && row.slot === DECK_SLOTS
	if (deck.slots.every((row) => row.is_borrow === borrowed(row))) return deck
	return { ...deck, slots: deck.slots.map((row) => ({ ...row, is_borrow: borrowed(row) })) }
}

export function removeDeck(doc: Doc, index: number): Doc {
	return { ...doc, decks: removeAt(doc.decks, index) }
}

export function moveDeck(doc: Doc, from: number, to: number): Doc {
	return { ...doc, decks: moveRow(doc.decks, from, to) }
}

/** A copy of a deck, unsaved, right after it. */
export function duplicateDeck(doc: Doc, index: number): Doc {
	const source = doc.decks[index]
	const copy: GuideDeckRow = { ...source, id: null, label: `${source.label} (copy)`, slots: source.slots.map((slot) => ({ ...slot })) }
	const next = [...doc.decks]
	next.splice(index + 1, 0, copy)
	return { ...doc, decks: next }
}

/** A deck built from six catalogue card ids (a team member's cards), slot 6 the borrow. */
export function deckFromCards(style: PvpStyle, label: string, cards: Array<{ slot: number; support_card: number }>): GuideDeckRow {
	return {
		id: null,
		style,
		label,
		note: "",
		slots: cards
			.filter((card) => card.slot >= 1 && card.slot <= DECK_SLOTS)
			.map((card) => ({ slot: card.slot, order: 0, is_borrow: card.slot === DECK_SLOTS, support_card: card.support_card, note: "", limit_break: null })),
	}
}

function slotRows(deck: GuideDeckRow, slot: number): GuideSlotRow[] {
	return deck.slots.filter((row) => row.slot === slot).sort((a, b) => a.order - b.order)
}

function withSlots(doc: Doc, index: number, slots: GuideSlotRow[]): Doc {
	return { ...doc, decks: replaceAt(doc.decks, index, withBorrow({ ...doc.decks[index], slots })) }
}

/**
 * Put a card in a slot's main row (order 0), creating the row if the slot is
 * empty. Taking the card away drops its limit break too: only a card has one.
 */
export function setSlotCard(doc: Doc, deckIndex: number, slot: number, cardId: number | null): Doc {
	const deck = doc.decks[deckIndex]
	const main = deck.slots.find((row) => row.slot === slot && row.order === 0)
	if (main) {
		const changed = cardId === null ? { support_card: null, limit_break: null } : { support_card: cardId }
		return withSlots(doc, deckIndex, deck.slots.map((row) => (row === main ? { ...row, ...changed } : row)))
	}
	const row: GuideSlotRow = { slot, order: 0, is_borrow: false, support_card: cardId, note: "", limit_break: null }
	return withSlots(doc, deckIndex, [...deck.slots, row])
}

/** Change one slot row (by slot and order). */
export function updateSlot(doc: Doc, deckIndex: number, slot: number, order: number, patch: Partial<GuideSlotRow>): Doc {
	const deck = doc.decks[deckIndex]
	return withSlots(
		doc,
		deckIndex,
		deck.slots.map((row) => (row.slot === slot && row.order === order ? { ...row, ...patch } : row))
	)
}

/** Remove one slot row. Removing the main row removes its alternatives too. */
export function clearSlot(doc: Doc, deckIndex: number, slot: number, order = 0): Doc {
	const deck = doc.decks[deckIndex]
	return withSlots(
		doc,
		deckIndex,
		deck.slots.filter((row) => !(row.slot === slot && (order === 0 ? true : row.order === order)))
	)
}

/**
 * Swap two slots of one deck, everything with them: the card, its note and
 * limit break, its "or" alternatives and the borrow mark all travel together,
 * because each is a field on the slot's rows (Henry, 2026-11-24: "the notes
 * and everything also transfer over"). An empty `to` makes it a plain move.
 *
 * Only the `slot` numbers change, in place: the rows keep their array
 * positions, so an error drawn at `decks[i].slots[j]` stays on its row, and
 * `toPayload` sorts by slot anyway. The borrow mark riding with its card is
 * deliberate: a slot number is only where a card sits, and moving the
 * borrowed card must not quietly make another card the borrow.
 */
export function swapSlots(doc: Doc, deckIndex: number, from: number, to: number): Doc {
	if (from === to) return doc
	const deck = doc.decks[deckIndex]
	return withSlots(
		doc,
		deckIndex,
		deck.slots.map((row) => (row.slot === from ? { ...row, slot: to } : row.slot === to ? { ...row, slot: from } : row))
	)
}

/**
 * The slots a note could be copied to: every deck's main row holding `cardId`
 * whose note isn't `note` already, in decks of `style` (null: every style).
 * The slot the note came from matches its own note, so it never counts.
 * "or" rows are left alone: the editor shows no note on an alternative card.
 */
function isCopyTarget(deck: GuideDeckRow, row: GuideSlotRow, cardId: number, note: string, style: PvpStyle | null): boolean {
	return (style === null || deck.style === style) && row.order === 0 && row.support_card === cardId && row.note !== note
}

export function countNoteCopies(doc: Doc, cardId: number, note: string, style: PvpStyle | null): number {
	return doc.decks.reduce((total, deck) => total + deck.slots.filter((row) => isCopyTarget(deck, row, cardId, note, style)).length, 0)
}

/**
 * Give every appearance of a card the same slot note (Daptrius, 2026-11-24:
 * a guide repeats one card's note across many decks, and typing it into
 * each was the slow part). `style` keeps it to one style's decks; null
 * reaches every style. Decks with nothing to change keep their identity.
 */
export function copyNoteToCard(doc: Doc, cardId: number, note: string, style: PvpStyle | null): Doc {
	return {
		...doc,
		decks: doc.decks.map((deck) =>
			deck.slots.some((row) => isCopyTarget(deck, row, cardId, note, style))
				? { ...deck, slots: deck.slots.map((row) => (isCopyTarget(deck, row, cardId, note, style) ? { ...row, note } : row)) }
				: deck
		),
	}
}

/** Add an "or" alternative under a slot: a card, or a note like "or any speed". */
export function addAlternative(doc: Doc, deckIndex: number, slot: number, cardId: number | null, note = ""): Doc {
	const deck = doc.decks[deckIndex]
	const rows = slotRows(deck, slot)
	const order = rows.length === 0 ? 1 : Math.max(...rows.map((row) => row.order)) + 1
	const main = rows.find((row) => row.order === 0)
	const row: GuideSlotRow = { slot, order, is_borrow: main?.is_borrow ?? false, support_card: cardId, note, limit_break: null }
	return withSlots(doc, deckIndex, [...deck.slots, row])
}

