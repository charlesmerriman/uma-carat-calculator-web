import { describe, expect, it } from "vitest"
import type { PvpCatalogueIndex } from "../hooks/usePvpCatalogue"
import type { GuideDocument } from "../types/guideDocument"
import type { PvpGuide } from "../types/pvpGuide"
import type { Scenario } from "../types"
import type { CatalogueSkill, CatalogueSupportCard, CatalogueUma, PvpCatalogue } from "../types/pvpTeam"
import {
	errorsByTab,
	hydrateGuide,
	mentionsIn,
	missingSummary,
	rowsByTab,
	tabForPath,
	toPayload,
	validateDocument,
} from "../utils/guideDocument"
import {
	addAlternative,
	addDeck,
	addSkill,
	addUma,
	clearSlot,
	deckFromCards,
	duplicateDeck,
	moveRow,
	moveUma,
	removeUma,
	setBorrowSlot,
	setSlotCard,
	setStyleNote,
	updateUma,
} from "../utils/guideDocumentEdits"

/**
 * The guide editor's pure half: the document as the reader draws it, the
 * server's checks run locally, the checklist, and the edits.
 */

const apt = { turf: 8, dirt: 1, short: 6, mile: 8, medium: 7, long: 4, front: 8, pace: 5, late: 2, end: 1 }
const uma = (id: number, name: string, skills: CatalogueUma["skills"] = []): CatalogueUma => ({
	id, name, image: `${name}.png`, portrait: `${name}-p.png`, rarity: 3, running_style: 1, character_id: id, is_variant: false, apt, skills,
})
const card = (id: number, name: string): CatalogueSupportCard => ({ id, name, image: `${name}.png`, card_type: "speed", rarity: 3, title: "", skills: [] })
const skill = (id: number, name: string, version = "○ white"): CatalogueSkill => ({
	id, name, description: `${name} does a thing.`, image: null, rarity: 1, tier: 1, group_id: id, cost: 100, version,
})

const CATALOGUE: PvpCatalogue = {
	umas: [uma(41, "Maruzensky", [{ skill: 2, source: "unique" }]), uma(42, "Gold Ship"), uma(43, "Seiun Sky")],
	support_cards: [card(302, "Kitasan Black"), card(303, "Super Creek")],
	skills: [skill(1, "Groundwork"), skill(2, "Red Shift/LP1211-M", "unique"), skill(3, "Left-Handed ○")],
}
const INDEX: PvpCatalogueIndex = {
	catalogue: CATALOGUE,
	umasById: new Map(CATALOGUE.umas.map((row) => [row.id, row])),
	cardsById: new Map(CATALOGUE.support_cards.map((row) => [row.id, row])),
	skillsById: new Map(CATALOGUE.skills.map((row) => [row.id, row])),
}
const SCENARIOS = [{ id: 1, name: "Grand Live", image: null, banner_timeline: null, start_date: null }] as unknown as Scenario[]

function document(): GuideDocument {
	return {
		id: 7,
		version: 3,
		event_type: "champions_meeting",
		event: 10,
		is_published: false,
		updated_at: "2099-01-01T00:00:00Z",
		scenario: 1,
		style_ranking: "Front >> End",
		short_description: "Take [[Groundwork]] first.",
		meta_analysis: "",
		admin_comments: "private",
		stat_configs: [{ style: "everyone", label: "", speed: "1100+", stamina: "578*", power: "", guts: "", wit: "", footnote: "" }],
		team_comps: [{ text: "2 Front + 1 Pace", note: "" }],
		uma_recommendations: [
			{ style: "front", uma: 42, stars: 3, role: "", note: "" },
			{ style: "front", uma: 41, stars: 5, role: "RA", note: "Use [[Left-Handed ○]]" },
			{ style: "end", uma: 43, stars: 4, role: "", note: "" },
		],
		skill_recommendations: [
			{ style: "front", category: "acceleration", tier: 1, skill: 2, note: "" },
			{ style: "everyone", category: "green", tier: null, skill: 3, note: "" },
			{ style: "front", category: "acceleration", tier: 0, skill: 1, note: "" },
		],
		style_notes: [{ style: "front", body: "**Go early.**" }],
		decks: [
			{
				id: 90,
				style: "front",
				label: "Standard",
				note: "",
				slots: [
					{ slot: 6, order: 0, is_borrow: true, support_card: 303, note: "" },
					{ slot: 1, order: 1, is_borrow: false, support_card: null, note: "or any speed" },
					{ slot: 1, order: 0, is_borrow: false, support_card: 302, note: "Gold + Link" },
				],
			},
		],
	}
}

describe("hydrateGuide", () => {
	it("draws the document in the reader's order from the catalogue", () => {
		const guide = hydrateGuide(document(), INDEX, SCENARIOS, null)
		expect(guide.scenario?.name).toBe("Grand Live")
		// Most stars first within a style; styles in display order.
		expect(guide.uma_recommendations.map((row) => `${row.style}:${row.uma.name}:${row.stars}`)).toEqual([
			"front:Maruzensky:5",
			"front:Gold Ship:3",
			"end:Seiun Sky:4",
		])
		expect(guide.uma_recommendations[0].uma.portrait).toBe("Maruzensky-p.png")
		// Everyone first, then tier 0 before tier 1.
		expect(guide.skill_recommendations.map((row) => `${row.style}:${row.skill.name}`)).toEqual([
			"everyone:Left-Handed ○",
			"front:Groundwork",
			"front:Red Shift/LP1211-M",
		])
		// A unique's owner comes from the catalogue's skill links.
		expect(guide.skill_recommendations[2].skill.unique_of).toBe("Maruzensky")
		expect(guide.skill_recommendations[2].skill.version).toBe("unique")
		// Slots sorted by slot then order, cards embedded.
		expect(guide.decks[0].slots.map((slot) => [slot.slot, slot.order, slot.support_card?.name ?? null])).toEqual([
			[1, 0, "Kitasan Black"],
			[1, 1, null],
			[6, 0, "Super Creek"],
		])
		// Every [[mention]] in any text resolves, by lower-case name.
		expect(Object.keys(guide.skill_mentions ?? {})).toEqual(["groundwork", "left-handed ○"])
	})

	it("takes versions and uniques from the server's last answer when it has them", () => {
		const previous = {
			skill_recommendations: [
				{
					style: "front", category: "acceleration", tier: 0, order: 0, note: "",
					skill: { id: 1, name: "Groundwork", description: "d", image: null, rarity: 1, unique_of: null, version: "○ white", tier: 1, is_evolved: false, versions: [{ id: 9, name: "Groundwork ◎", description: "", image: null, rarity: 1, tier: 2, version: "◎ white", is_evolved: false }] },
				},
			],
			skill_mentions: {},
		} as unknown as PvpGuide
		const guide = hydrateGuide(document(), INDEX, SCENARIOS, previous)
		const groundwork = guide.skill_recommendations.find((row) => row.skill.id === 1)
		expect(groundwork?.skill.versions.map((version) => version.name)).toEqual(["Groundwork ◎"])
	})

	it("leaves out a row whose uma the catalogue lacks and keeps an unsaved deck apart", () => {
		const doc = document()
		doc.uma_recommendations.push({ style: "pace", uma: 999, stars: 3, role: "", note: "" })
		doc.decks.push({ id: null, style: "pace", label: "New", note: "", slots: [] })
		const guide = hydrateGuide(doc, INDEX, SCENARIOS, null)
		expect(guide.uma_recommendations.some((row) => row.uma.id === 999)).toBe(false)
		expect(guide.decks.map((deck) => deck.id)).toEqual([90, -2])
	})
})

describe("validateDocument", () => {
	it("passes a good document and names each problem by path", () => {
		expect(validateDocument(document(), INDEX)).toEqual([])
		const doc = document()
		doc.uma_recommendations.push({ style: "front", uma: 41, stars: 3, role: "", note: "" })
		doc.skill_recommendations.push({ style: "front", category: "acceleration", tier: 2, skill: 1, note: "" })
		doc.style_notes.push({ style: "front", body: "again" })
		doc.decks[0].slots.push({ slot: 2, order: 0, is_borrow: true, support_card: null, note: "  " })
		doc.short_description = "Take [[Groundwrk]]"
		doc.team_comps.push({ text: "", note: "" })
		const paths = validateDocument(doc, INDEX).map((error) => [error.path, error.message])
		expect(paths).toContainEqual(["uma_recommendations[3].uma", "Maruzensky is already in Front."])
		expect(paths).toContainEqual(["skill_recommendations[3].skill", "Groundwork is already in Front's Acceleration list."])
		expect(paths).toContainEqual(["style_notes[1].style", "Front already has an advice box."])
		expect(paths).toContainEqual(["decks[0].slots[3]", 'Pick a card, or write a note like "or any speed".'])
		expect(paths).toContainEqual(["decks[0]", "Only one slot can be the borrowed card."])
		expect(paths).toContainEqual(["short_description", "No skill on global has this name: [[Groundwrk]]"])
		expect(paths).toContainEqual(["team_comps[1].text", "Write the team comp, like 2 Front + 1 Pace."])
	})

	it("counts problems and rows per tab", () => {
		const doc = document()
		doc.decks[0].slots.push({ slot: 2, order: 0, is_borrow: true, support_card: null, note: "" })
		doc.short_description = "[[Nope]]"
		const errors = validateDocument(doc, INDEX)
		expect(tabForPath("decks[0]", doc)).toBe("front")
		expect(tabForPath("skill_recommendations[1].skill", doc)).toBe("guide")
		expect(errorsByTab(errors, doc).get("front")).toBe(2)
		expect(errorsByTab(errors, doc).get("guide")).toBe(1)
		expect(rowsByTab(doc).get("front")).toBe(6)
		expect(rowsByTab(doc).get("guide")).toBe(3)
	})
})

describe("missingSummary and payload", () => {
	it("says what the guide lacks, with where to go", () => {
		const doc = document()
		const items = missingSummary(doc)
		expect(items.map((item) => item.text)).toEqual(["End: no advice, no decks.", "Nothing yet for Runaway, Pace, Late."])
		expect(items[0]).toMatchObject({ tab: "end", section: "style_notes" })
		expect(missingSummary({ ...doc, stat_configs: [], uma_recommendations: [], style_notes: [], decks: [], skill_recommendations: [] }).map((item) => item.text)).toEqual([
			"No recommended stats yet.",
			"No style has anything yet. Pick a tab and add rows.",
		])
	})

	it("strips what the server owns from a save", () => {
		const body = toPayload(document())
		expect(Object.keys(body)).not.toContain("id")
		expect(Object.keys(body)).not.toContain("is_published")
		expect(body.version).toBe(3)
		expect(mentionsIn("Take [[Groundwork]] and [[ Left-Handed ○ ]]")).toEqual(["Groundwork", "Left-Handed ○"])
	})
})

describe("edits", () => {
	it("adds an uma after its style's last row and refuses a duplicate", () => {
		const doc = addUma(document(), "front", 43)
		// After Front's last row, before End's.
		expect(doc.uma_recommendations.map((row) => `${row.style}:${row.uma}`)).toEqual(["front:42", "front:41", "front:43", "end:43"])
		expect(doc.uma_recommendations[2]).toMatchObject({ style: "front", uma: 43, stars: 3 })
		expect(addUma(doc, "front", 43)).toBe(doc)
		expect(updateUma(doc, 2, { stars: 5 }).uma_recommendations[2].stars).toBe(5)
		expect(removeUma(doc, 2).uma_recommendations).toHaveLength(3)
	})

	it("moves a row to where another sits and leaves the rest in order", () => {
		expect(moveRow(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"])
		expect(moveRow(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"])
		expect(moveUma(document(), 1, 0).uma_recommendations.map((row) => row.uma)).toEqual([41, 42, 43])
	})

	it("adds a skill once per style and category", () => {
		const doc = addSkill(document(), "pace", "speed", 1, 2)
		expect(doc.skill_recommendations[3]).toMatchObject({ style: "pace", category: "speed", skill: 1, tier: 2 })
		expect(addSkill(doc, "pace", "speed", 1)).toBe(doc)
	})

	it("keeps one advice box per style and drops an emptied one", () => {
		const doc = setStyleNote(document(), "front", "Changed.")
		expect(doc.style_notes).toEqual([{ style: "front", body: "Changed." }])
		expect(setStyleNote(doc, "pace", "New.").style_notes).toHaveLength(2)
		expect(setStyleNote(doc, "late", "   ")).toBe(doc)
	})

	it("edits a deck's slots: card, note-only row, alternative, borrow, clear", () => {
		let doc = addDeck(document(), "front", "Whale")
		expect(doc.decks[1]).toMatchObject({ id: null, style: "front", label: "Whale", slots: [] })
		doc = setSlotCard(doc, 1, 3, 302)
		expect(doc.decks[1].slots).toEqual([{ slot: 3, order: 0, is_borrow: false, support_card: 302, note: "" }])
		doc = addAlternative(doc, 1, 3, null, "or any speed")
		expect(doc.decks[1].slots[1]).toMatchObject({ slot: 3, order: 1, support_card: null, note: "or any speed" })
		doc = setBorrowSlot(doc, 1, 3)
		expect(doc.decks[1].slots.every((slot) => slot.is_borrow)).toBe(true)
		doc = setBorrowSlot(doc, 0, 1)
		expect(doc.decks[0].slots.map((slot) => [slot.slot, slot.is_borrow])).toEqual([[6, false], [1, true], [1, true]])
		doc = clearSlot(doc, 1, 3, 1)
		expect(doc.decks[1].slots).toHaveLength(1)
		doc = clearSlot(doc, 1, 3)
		expect(doc.decks[1].slots).toHaveLength(0)
		const copied = duplicateDeck(doc, 0)
		expect(copied.decks[1]).toMatchObject({ id: null, label: "Standard (copy)" })
		expect(copied.decks[1].slots).toHaveLength(3)
		const fromTeam = deckFromCards("late", "Henry's", [{ slot: 1, support_card: 302 }, { slot: 6, support_card: 303 }])
		expect(fromTeam.slots.map((slot) => [slot.slot, slot.is_borrow])).toEqual([[1, false], [6, true]])
	})
})
