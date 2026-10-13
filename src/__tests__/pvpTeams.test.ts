import { describe, expect, it } from "vitest"
import {
	cardBlockReason,
	clearMember,
	recommendedIds,
	setCard,
	setMemberUma,
	umaBlockReason,
} from "../utils/pvpTeams"
import type { PvpGuide } from "../types/pvpGuide"
import type { PvpTeamMember } from "../types/pvpTeam"

const OGURI = { id: 1, name: "Oguri Cap", character_id: 1006, running_style: 3 }
const OGURI_XMAS = { id: 2, name: "Oguri Cap (Christmas)", character_id: 1006, running_style: 3 }
const MARU = { id: 3, name: "Maruzensky", character_id: 1004, running_style: 1 }
const UMAS = new Map([OGURI, OGURI_XMAS, MARU].map((uma) => [uma.id, uma]))

describe("pvpTeams", () => {
	it("starts a new member on the uma's own style and keeps the deck on a swap", () => {
		let members: PvpTeamMember[] = setMemberUma([], 1, OGURI)
		expect(members).toEqual([{ position: 1, uma: 1, style: "late", cards: [] }])
		members = setCard(members, 1, 6, 302)
		members = setMemberUma(members, 1, MARU)
		expect(members).toEqual([{ position: 1, uma: 3, style: "late", cards: [{ slot: 6, support_card: 302 }] }])
		expect(clearMember(members, 1)).toEqual([])
	})

	it("keeps members and cards sorted", () => {
		let members = setMemberUma(setMemberUma([], 2, OGURI), 0, MARU)
		expect(members.map((member) => member.position)).toEqual([0, 2])
		members = setCard(setCard(members, 0, 4, 10), 0, 1, 11)
		expect(members[0].cards.map((card) => card.slot)).toEqual([1, 4])
	})

	it("blocks the same uma and a second outfit, but not the place being replaced", () => {
		const members = setMemberUma([], 0, OGURI)
		expect(umaBlockReason(members, 1, OGURI, UMAS)).toBe("Already on this team")
		expect(umaBlockReason(members, 1, OGURI_XMAS, UMAS)).toBe("Oguri Cap is already on this team")
		expect(umaBlockReason(members, 0, OGURI_XMAS, UMAS)).toBeNull()
		expect(umaBlockReason(members, 1, MARU, UMAS)).toBeNull()
	})

	it("blocks a card already in the deck, borrow slot included", () => {
		const [member] = setCard(setMemberUma([], 0, MARU), 0, 1, 302)
		expect(cardBlockReason(member, 6, 302)).toBe("Already in this deck")
		expect(cardBlockReason(member, 1, 302)).toBeNull()
		expect(cardBlockReason(undefined, 1, 302)).toBeNull()
	})

	it("reads the guide's picks for a style, and front's for a runaway", () => {
		const card = (id: number) => ({ id, name: "", image: null, card_type: null, rarity: null })
		const guide = {
			uma_recommendations: [
				{ style: "front", stars: 5, role: "", note: "", uma: { id: 3, name: "", image: null } },
				{ style: "end", stars: 3, role: "", note: "", uma: { id: 1, name: "", image: null } },
			],
			decks: [{ id: 1, style: "front", label: "", note: "", slots: [{ slot: 1, order: 0, is_borrow: false, note: "", support_card: card(302) }] }],
			honorable_mentions: [{ style: "end", note: "", support_card: card(400) }],
		} as unknown as PvpGuide
		expect([...recommendedIds(guide, "runaway").umas]).toEqual([3])
		expect([...recommendedIds(guide, "front").cards]).toEqual([302])
		expect([...recommendedIds(guide, "end").cards]).toEqual([400])
		expect(recommendedIds(null, "end").umas.size).toBe(0)
	})
})
