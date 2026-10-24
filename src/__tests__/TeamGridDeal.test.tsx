/**
 * The dealing animation in My team's grid (TeamGrid's DeckDeal): only a guide
 * deck put on a spot ("Use this deck") re-keys its card slots, so the old
 * cards leave as the new ones arrive. Any other edit swaps a card at once.
 */

import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TeamGrid, type DeckDeal } from "../components/pvp/TeamGrid"
import type { CatalogueSupportCard, CatalogueUma, PvpTeamMember } from "../types/pvpTeam"

const apt = { turf: 8, dirt: 1, short: 3, mile: 7, medium: 6, long: 4, front: 5, pace: 7, late: 7, end: 3 }
const OGURI: CatalogueUma = {
	id: 1, name: "Oguri Cap", image: null, portrait: null, rarity: 3, running_style: 3, character_id: 1, is_variant: false, apt, skills: [],
}
const card = (id: number, name: string): CatalogueSupportCard => ({ id, name, image: null, card_type: "speed", rarity: 3, title: "", skills: [] })
const CARDS = new Map([card(302, "Agnes Tachyon"), card(304, "Kitasan Black"), card(305, "Special Week")].map((each) => [each.id, each]))

const team = (cardId: number): PvpTeamMember[] => [{ position: 0, uma: 1, style: "late", cards: [{ slot: 1, support_card: cardId }] }]

function grid(members: PvpTeamMember[], deal?: DeckDeal) {
	return (
		<TeamGrid
			members={members}
			umasById={new Map([[1, OGURI]])}
			cardsById={CARDS}
			onPickUma={vi.fn()}
			onPickCard={vi.fn()}
			onStyleChange={vi.fn()}
			onClearUma={vi.fn()}
			onClearCard={vi.fn()}
			deal={deal}
		/>
	)
}

const slotOne = (name: string) => screen.queryByRole("button", { name: `Change card 1 for Oguri Cap: ${name}` })

describe("TeamGrid dealing", () => {
	it("swaps a card at once on an ordinary edit", () => {
		const { rerender } = render(grid(team(304)))
		rerender(grid(team(305)))
		expect(slotOne("Special Week")).toBeInTheDocument()
		expect(slotOne("Kitasan Black")).not.toBeInTheDocument()
	})

	it("keeps the old card on its way out while a dealt deck's card comes in", () => {
		const { rerender } = render(grid(team(304), { counts: {}, now: null }))
		rerender(grid(team(302), { counts: { 0: 1 }, now: 0 }))
		expect(slotOne("Agnes Tachyon")).toBeInTheDocument()
		// Still there for its exit; gone once the animation ends.
		expect(slotOne("Kitasan Black")).toBeInTheDocument()
	})
})
