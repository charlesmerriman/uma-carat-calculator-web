/**
 * Pure helpers behind the guide editor: the document (types/guideDocument.ts)
 * turned into what the reader draws, checked the way the server checks it,
 * and summarised for the checklist. Everything takes its inputs as
 * parameters (the document, the catalogue, the last server answer), so the
 * tests pin each rule with fixed data and nothing here touches the network.
 *
 * The edits themselves (add an uma, move a deck, ...) are in
 * utils/guideDocumentEdits.ts.
 */

import type {
	EditorError,
	GuideDeckRow,
	GuideDocument,
	GuideDocumentPut,
	GuideSection,
} from "../types/guideDocument"
import type {
	PvpGuide,
	PvpSkillCategory,
	PvpSkillRecommendation,
	PvpSkillRef,
	PvpStyle,
	PvpSupportCardRef,
	PvpUmaRef,
} from "../types/pvpGuide"
import type { PvpCatalogueIndex } from "../hooks/usePvpCatalogue"
import type { CatalogueSkill, CatalogueSupportCard, CatalogueUma } from "../types/pvpTeam"
import type { Scenario } from "../types"
import { SKILL_CATEGORY_LABELS, STYLE_LABELS, STYLE_ORDER } from "./pvpGuide"

export const DECK_SLOTS = 6
/** The editor's tab for everything that is not a running style. */
export type EditorTab = "guide" | Exclude<PvpStyle, "everyone">
export const STYLE_TABS: Array<Exclude<PvpStyle, "everyone">> = ["runaway", "front", "pace", "late", "end"]
export const EDITOR_TABS: EditorTab[] = ["guide", ...STYLE_TABS]

export const SECTIONS: GuideSection[] = [
	"stat_configs",
	"team_comps",
	"uma_recommendations",
	"skill_recommendations",
	"style_notes",
	"decks",
]

// The column lengths, the server's (calculatorapi/models/pvp_guide.py).
export const MAX_LENGTH = {
	style_ranking: 120,
	stat_label: 60,
	stat_value: 20,
	stat_footnote: 200,
	comp_text: 120,
	comp_note: 200,
	uma_role: 40,
	uma_note: 300,
	skill_note: 200,
	deck_label: 60,
	deck_note: 300,
	slot_note: 120,
} as const

// The server's sentences (pvp_guide_document.py), so a problem reads the
// same whether the editor or the save caught it.
export const NOT_IN_CATALOGUE = "Pick one from the list."
export const SKILL_NOT_ON_GLOBAL = "That skill is not on global yet."
export const SLOT_NEEDS_SOMETHING = 'Pick a card, or write a note like "or any speed".'
export const ONE_BORROW = "Only one slot can be the borrowed card."

const MENTION = /\[\[([^[\]\n]+)\]\]/g

/** The names inside [[...]] in one text, trimmed, in order. */
export function mentionsIn(text: string): string[] {
	return [...text.matchAll(MENTION)].map((match) => match[1].trim())
}

const STYLE_RANK = new Map(STYLE_ORDER.map((style, index) => [style, index]))
const styleRank = (style: PvpStyle): number => STYLE_RANK.get(style) ?? STYLE_ORDER.length

/** The body of a save: the document minus what the server owns. */
export function toPayload(document: GuideDocument): GuideDocumentPut {
	const { id: _id, event_type: _type, event: _event, is_published: _published, updated_at: _updated, ...rest } = document
	return rest
}

/** Every text an editor wrote, as (path, text): where [[mentions]] live. */
export function texts(document: GuideDocument): Array<[string, string]> {
	const found: Array<[string, string]> = [
		["short_description", document.short_description],
		["meta_analysis", document.meta_analysis],
		["admin_comments", document.admin_comments],
		["style_ranking", document.style_ranking],
	]
	document.stat_configs.forEach((row, i) => found.push([`stat_configs[${i}].footnote`, row.footnote]))
	document.team_comps.forEach((row, i) => {
		found.push([`team_comps[${i}].text`, row.text], [`team_comps[${i}].note`, row.note])
	})
	document.uma_recommendations.forEach((row, i) => found.push([`uma_recommendations[${i}].note`, row.note]))
	document.skill_recommendations.forEach((row, i) => found.push([`skill_recommendations[${i}].note`, row.note]))
	document.style_notes.forEach((row, i) => found.push([`style_notes[${i}].body`, row.body]))
	document.decks.forEach((deck, i) => {
		found.push([`decks[${i}].note`, deck.note])
		deck.slots.forEach((slot, j) => found.push([`decks[${i}].slots[${j}].note`, slot.note]))
	})
	return found
}

// ── Hydration: the document as the reader draws it ──────────────────────────

function umaRef(uma: CatalogueUma): PvpUmaRef {
	return { id: uma.id, name: uma.name, image: uma.image, portrait: uma.portrait }
}

function cardRef(card: CatalogueSupportCard): PvpSupportCardRef {
	return { id: card.id, name: card.name, image: card.image, card_type: card.card_type, rarity: card.rarity }
}

/**
 * Which outfit each unique skill belongs to, read off the catalogue's uma
 * skill links (source "unique"), the same answer the API's `unique_of`
 * gives. The lowest uma id wins a tie, as on the server.
 */
export function uniqueOwners(index: PvpCatalogueIndex): Map<number, string> {
	const owners = new Map<number, string>()
	const umas = [...index.catalogue.umas].sort((a, b) => a.id - b.id)
	for (const uma of umas) {
		for (const link of uma.skills) {
			if (link.source === "unique" && !owners.has(link.skill)) owners.set(link.skill, uma.name)
		}
	}
	return owners
}

/**
 * A skill as the reader's chip wants it. The catalogue has the icon, the
 * description and the version label; the other versions and the exact
 * unique owner come from the last answer the server gave for this guide
 * (`known`), so between autosaves a chip is at worst missing its "Also as".
 */
function skillRef(
	skill: CatalogueSkill,
	owners: Map<number, string>,
	known: Map<number, PvpSkillRef>
): PvpSkillRef {
	const previous = known.get(skill.id)
	return {
		id: skill.id,
		name: skill.name,
		description: skill.description,
		image: skill.image,
		rarity: skill.rarity,
		unique_of: previous?.unique_of ?? owners.get(skill.id) ?? null,
		version: previous?.version ?? skill.version ?? "",
		tier: previous?.tier ?? skill.tier ?? 1,
		is_evolved: previous?.is_evolved ?? false,
		versions: previous?.versions ?? [],
	}
}

/** Every skill ref the server last sent for this guide, by id. */
export function knownSkillRefs(previous: PvpGuide | null): Map<number, PvpSkillRef> {
	const known = new Map<number, PvpSkillRef>()
	if (!previous) return known
	for (const row of previous.skill_recommendations) known.set(row.skill.id, row.skill)
	for (const ref of Object.values(previous.skill_mentions ?? {})) known.set(ref.id, ref)
	return known
}

/**
 * The document -> a PvpGuide the reader's components can draw, from the
 * catalogue in memory. Rows come out in the reader's order (the API's: by
 * style, then each section's own rule), so PvpGuideView needs no change.
 * Rows naming an uma, card or skill the catalogue lacks are left out, as a
 * stale row would be on the site.
 */
export function hydrateGuide(
	document: GuideDocument,
	index: PvpCatalogueIndex,
	scenarios: Scenario[],
	previous: PvpGuide | null
): PvpGuide {
	const owners = uniqueOwners(index)
	const known = knownSkillRefs(previous)
	const scenario = document.scenario === null ? null : scenarios.find((row) => row.id === document.scenario)

	const umas = document.uma_recommendations
		.map((row, order) => ({ row, order, uma: index.umasById.get(row.uma) }))
		.filter((entry): entry is typeof entry & { uma: CatalogueUma } => entry.uma !== undefined)
		.sort((a, b) => styleRank(a.row.style) - styleRank(b.row.style) || b.row.stars - a.row.stars || a.order - b.order)
		.map(({ row, uma }) => ({ style: row.style, stars: row.stars, role: row.role, note: row.note, uma: umaRef(uma) }))

	const tierRank = (tier: number | null) => (tier === null ? Number.MAX_SAFE_INTEGER : tier)
	const skills: PvpSkillRecommendation[] = document.skill_recommendations
		.map((row, order) => ({ row, order, skill: index.skillsById.get(row.skill) }))
		.filter((entry): entry is typeof entry & { skill: CatalogueSkill } => entry.skill !== undefined)
		.sort(
			(a, b) =>
				styleRank(a.row.style) - styleRank(b.row.style) ||
				tierRank(a.row.tier) - tierRank(b.row.tier) ||
				a.order - b.order
		)
		.map(({ row, order, skill }) => ({
			style: row.style,
			category: row.category,
			tier: row.tier,
			order,
			note: row.note,
			skill: skillRef(skill, owners, known),
		}))

	const decks = document.decks
		.map((deck, order) => ({ deck, order }))
		.sort((a, b) => styleRank(a.deck.style) - styleRank(b.deck.style) || a.order - b.order)
		.map(({ deck, order }) => ({
			// A deck not saved yet has no id; a negative one keeps React keys apart.
			id: deck.id ?? -(order + 1),
			style: deck.style,
			label: deck.label,
			note: deck.note,
			slots: [...deck.slots]
				.sort((a, b) => a.slot - b.slot || a.order - b.order)
				.map((slot) => ({
					slot: slot.slot,
					order: slot.order,
					is_borrow: slot.is_borrow,
					note: slot.note,
					support_card: slot.support_card === null ? null : cardRef(index.cardsById.get(slot.support_card) ?? placeholderCard(slot.support_card)),
				})),
		}))

	// [[mentions]]: the catalogue's names, matched ignoring case like the server.
	const byLowerName = new Map<string, CatalogueSkill>()
	for (const skill of index.catalogue.skills) {
		const key = skill.name.toLowerCase()
		if (!byLowerName.has(key)) byLowerName.set(key, skill)
	}
	const mentions: Record<string, PvpSkillRef> = {}
	for (const [, text] of texts(document)) {
		for (const name of mentionsIn(text)) {
			const key = name.toLowerCase()
			const skill = byLowerName.get(key)
			if (skill && !mentions[key]) mentions[key] = skillRef(skill, owners, known)
		}
	}

	return {
		event_type: document.event_type,
		event: document.event,
		is_published: document.is_published,
		updated_at: document.updated_at,
		scenario: scenario ? { id: scenario.id, name: scenario.name, image: scenario.image } : null,
		style_ranking: document.style_ranking,
		short_description: document.short_description,
		meta_analysis: document.meta_analysis,
		team_comps: document.team_comps.map((row) => ({ text: row.text, note: row.note })),
		stat_configs: document.stat_configs
			.map((row, order) => ({ row, order }))
			.sort((a, b) => styleRank(a.row.style) - styleRank(b.row.style) || a.order - b.order)
			.map(({ row }) => ({ ...row })),
		uma_recommendations: umas,
		skill_recommendations: skills,
		style_notes: [...document.style_notes]
			.sort((a, b) => styleRank(a.style) - styleRank(b.style))
			.map((row) => ({ style: row.style, body: row.body })),
		decks,
		skill_mentions: mentions,
	}
}

function placeholderCard(id: number): CatalogueSupportCard {
	return { id, name: `Card ${id}`, image: null, card_type: null, rarity: null, title: "", skills: [] }
}

// ── Checks: the server's list, run before a save ────────────────────────────

/**
 * The problems a save would refuse, as the server reports them (path and
 * sentence). Run on every change, so most show while typing; the server's
 * own answer replaces them after a save.
 */
export function validateDocument(document: GuideDocument, index: PvpCatalogueIndex): EditorError[] {
	const found: EditorError[] = []
	const add = (path: string, message: string) => found.push({ path, message })

	if (document.style_ranking.length > MAX_LENGTH.style_ranking) add("style_ranking", tooLong(MAX_LENGTH.style_ranking))

	document.stat_configs.forEach((row, i) => {
		if (row.label.length > MAX_LENGTH.stat_label) add(`stat_configs[${i}].label`, tooLong(MAX_LENGTH.stat_label))
		for (const key of ["speed", "stamina", "power", "guts", "wit"] as const) {
			if (row[key].length > MAX_LENGTH.stat_value) add(`stat_configs[${i}].${key}`, tooLong(MAX_LENGTH.stat_value))
		}
		if (row.footnote.length > MAX_LENGTH.stat_footnote) add(`stat_configs[${i}].footnote`, tooLong(MAX_LENGTH.stat_footnote))
	})

	document.team_comps.forEach((row, i) => {
		if (!row.text.trim()) add(`team_comps[${i}].text`, "Write the team comp, like 2 Front + 1 Pace.")
		if (row.text.length > MAX_LENGTH.comp_text) add(`team_comps[${i}].text`, tooLong(MAX_LENGTH.comp_text))
		if (row.note.length > MAX_LENGTH.comp_note) add(`team_comps[${i}].note`, tooLong(MAX_LENGTH.comp_note))
	})

	const umasSeen = new Set<string>()
	document.uma_recommendations.forEach((row, i) => {
		const uma = index.umasById.get(row.uma)
		if (!uma) {
			add(`uma_recommendations[${i}].uma`, NOT_IN_CATALOGUE)
			return
		}
		const key = `${row.style}:${row.uma}`
		if (umasSeen.has(key)) add(`uma_recommendations[${i}].uma`, `${uma.name} is already in ${STYLE_LABELS[row.style]}.`)
		umasSeen.add(key)
		if (row.stars < 1 || row.stars > 5) add(`uma_recommendations[${i}].stars`, "Stars go from 1 to 5.")
		if (row.role.length > MAX_LENGTH.uma_role) add(`uma_recommendations[${i}].role`, tooLong(MAX_LENGTH.uma_role))
		if (row.note.length > MAX_LENGTH.uma_note) add(`uma_recommendations[${i}].note`, tooLong(MAX_LENGTH.uma_note))
	})

	const skillsSeen = new Set<string>()
	document.skill_recommendations.forEach((row, i) => {
		const skill = index.skillsById.get(row.skill)
		if (!skill) {
			add(`skill_recommendations[${i}].skill`, SKILL_NOT_ON_GLOBAL)
			return
		}
		const key = `${row.style}:${row.category}:${row.skill}`
		if (skillsSeen.has(key)) {
			add(
				`skill_recommendations[${i}].skill`,
				`${skill.name} is already in ${STYLE_LABELS[row.style]}'s ${SKILL_CATEGORY_LABELS[row.category]} list.`
			)
		}
		skillsSeen.add(key)
		if (row.note.length > MAX_LENGTH.skill_note) add(`skill_recommendations[${i}].note`, tooLong(MAX_LENGTH.skill_note))
	})

	const notesSeen = new Set<PvpStyle>()
	document.style_notes.forEach((row, i) => {
		if (notesSeen.has(row.style)) add(`style_notes[${i}].style`, `${STYLE_LABELS[row.style]} already has an advice box.`)
		notesSeen.add(row.style)
		if (!row.body.trim()) add(`style_notes[${i}].body`, "Write the advice, or remove the box.")
	})

	document.decks.forEach((deck, i) => deckErrors(deck, i, index, add))

	// [[mentions]] name a skill the catalogue (skills on global) has.
	const names = new Set(index.catalogue.skills.map((skill) => skill.name.toLowerCase()))
	for (const [path, text] of texts(document)) {
		const unknown = [...new Set(mentionsIn(text).filter((name) => !names.has(name.toLowerCase())))]
		if (unknown.length > 0) add(path, `No skill on global has this name: ${unknown.map((name) => `[[${name}]]`).join("; ")}`)
	}

	return found
}

function deckErrors(deck: GuideDeckRow, i: number, index: PvpCatalogueIndex, add: (path: string, message: string) => void) {
	if (!deck.label.trim()) add(`decks[${i}].label`, "Give the deck a label, like Standard.")
	if (deck.label.length > MAX_LENGTH.deck_label) add(`decks[${i}].label`, tooLong(MAX_LENGTH.deck_label))
	if (deck.note.length > MAX_LENGTH.deck_note) add(`decks[${i}].note`, tooLong(MAX_LENGTH.deck_note))
	const seen = new Map<string, number>()
	const borrowed = new Set<number>()
	deck.slots.forEach((slot, j) => {
		const path = `decks[${i}].slots[${j}]`
		if (slot.support_card !== null && !index.cardsById.has(slot.support_card)) add(`${path}.support_card`, NOT_IN_CATALOGUE)
		if (slot.support_card === null && !slot.note.trim()) add(path, SLOT_NEEDS_SOMETHING)
		if (slot.note.length > MAX_LENGTH.slot_note) add(`${path}.note`, tooLong(MAX_LENGTH.slot_note))
		const key = `${slot.slot}:${slot.order}`
		seen.set(key, (seen.get(key) ?? 0) + 1)
		if (slot.is_borrow) borrowed.add(slot.slot)
	})
	for (const [key, count] of seen) {
		if (count > 1) add(`decks[${i}]`, `Two rows share slot ${key.split(":")[0]}.`)
	}
	if (borrowed.size > 1) add(`decks[${i}]`, ONE_BORROW)
}

function tooLong(max: number): string {
	return `At most ${max} characters.`
}

// ── Where a problem or a row belongs ────────────────────────────────────────

/** The editor tab a document path lands on: a row's style, else the Guide tab. */
export function tabForPath(path: string, document: GuideDocument): EditorTab {
	const match = /^(uma_recommendations|skill_recommendations|style_notes|decks)\[(\d+)\]/.exec(path)
	if (!match) return "guide"
	const section = match[1] as "uma_recommendations" | "skill_recommendations" | "style_notes" | "decks"
	const row = document[section][Number(match[2])]
	const style = row?.style
	return style && style !== "everyone" ? style : "guide"
}

/** Problems per tab, for the tab strip's red counts. */
export function errorsByTab(errors: EditorError[], document: GuideDocument): Map<EditorTab, number> {
	const counts = new Map<EditorTab, number>()
	for (const error of errors) {
		const tab = tabForPath(error.path, document)
		counts.set(tab, (counts.get(tab) ?? 0) + 1)
	}
	return counts
}

/** Rows per tab, for the tab strip's counts. */
export function rowsByTab(document: GuideDocument): Map<EditorTab, number> {
	const counts = new Map<EditorTab, number>()
	const bump = (tab: EditorTab, by = 1) => counts.set(tab, (counts.get(tab) ?? 0) + by)
	bump("guide", document.stat_configs.length + document.team_comps.length)
	const tabOf = (style: PvpStyle): EditorTab => (style === "everyone" ? "guide" : style)
	for (const row of document.uma_recommendations) bump(tabOf(row.style))
	for (const row of document.skill_recommendations) bump(tabOf(row.style))
	for (const row of document.style_notes) bump(tabOf(row.style))
	for (const row of document.decks) bump(tabOf(row.style))
	return counts
}

export interface ChecklistItem {
	text: string
	tab: EditorTab
	/** The section the item is about, for the jump: an element id suffix. */
	section: GuideSection | "overview" | "any"
}

/**
 * What the guide does not have yet, in short sentences, the admin's
 * `missing_summary` (calculatorapi/pvp_guides.py). Skills are not nagged
 * about: many guides have none.
 */
export function missingSummary(document: GuideDocument): ChecklistItem[] {
	const items: ChecklistItem[] = []
	if (document.stat_configs.length === 0) items.push({ text: "No recommended stats yet.", tab: "guide", section: "stat_configs" })
	if (!document.style_ranking && !document.short_description && !document.meta_analysis) {
		items.push({ text: "No overview text yet.", tab: "guide", section: "overview" })
	}
	const present = new Map<PvpStyle, Set<string>>()
	const mark = (style: PvpStyle, what: string) => {
		if (style === "everyone") return
		if (!present.has(style)) present.set(style, new Set())
		present.get(style)?.add(what)
	}
	for (const row of document.uma_recommendations) mark(row.style, "umas")
	for (const row of document.style_notes) mark(row.style, "advice")
	for (const row of document.skill_recommendations) mark(row.style, "skills")
	for (const row of document.decks) mark(row.style, "decks")
	const empty = STYLE_TABS.filter((style) => !present.has(style))
	for (const style of STYLE_TABS) {
		const tables = present.get(style)
		if (!tables) continue
		const gaps = (["umas", "advice", "decks"] as const).filter((name) => !tables.has(name))
		if (gaps.length > 0) {
			const sectionOf = { umas: "uma_recommendations", advice: "style_notes", decks: "decks" } as const
			items.push({ text: `${STYLE_LABELS[style]}: no ${gaps.join(", no ")}.`, tab: style, section: sectionOf[gaps[0]] })
		}
	}
	if (empty.length === STYLE_TABS.length) {
		items.push({ text: "No style has anything yet. Pick a tab and add rows.", tab: "front", section: "any" })
	} else if (empty.length > 0) {
		items.push({ text: `Nothing yet for ${empty.map((style) => STYLE_LABELS[style]).join(", ")}.`, tab: empty[0], section: "any" })
	}
	return items
}

/** The category a "+ Add skill" button under a group starts the picker on. */
export const CATEGORY_CHOICES: PvpSkillCategory[] = ["acceleration", "other", "speed", "recovery", "green", "debuff"]

/** A skill row's tier, as the pickers and dialogs offer it. */
export const TIER_CHOICES: Array<{ value: number | null; label: string }> = [
	{ value: null, label: "No tier" },
	{ value: 0, label: "T0, take first" },
	{ value: 1, label: "T1" },
	{ value: 2, label: "T2" },
	{ value: 3, label: "T3" },
	{ value: 4, label: "T4" },
]
