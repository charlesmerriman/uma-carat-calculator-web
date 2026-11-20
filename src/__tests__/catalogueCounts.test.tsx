import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useCatalogueCounts } from "../hooks/useCatalogueCounts"
import { useEncyclopediaCounts } from "../utils/encyclopediaCounts"
import type { PvpCatalogueState } from "../hooks/usePvpCatalogue"
import type { PvpCatalogue } from "../types/pvpTeam"

/**
 * The Encyclopedia tabs' numbers come from one hook on every list page, so a
 * visit that starts on the Skills page counts the umas and cards too (board,
 * 2026-11-19).
 */

const uma = (id: number, gameId: number | null) => ({ id, game_id: gameId, name: `Uma ${id}`, on_global: true, rarity: 3 })
const card = (id: number) => ({ id, game_id: 30000 + id, name: `Card ${id}`, on_global: true, rarity: 3, card_type: "speed" })

function ready(catalogue: Partial<PvpCatalogue>): PvpCatalogueState {
	const full = { umas: [], support_cards: [], skills: [], ...catalogue } as unknown as PvpCatalogue
	return { status: "ready", catalogue: full, umasById: new Map(), cardsById: new Map(), skillsById: new Map() }
}

describe("useCatalogueCounts", () => {
	it("reports all three tabs' numbers once the catalogue is here", () => {
		const state = ready({
			// An outfit with no game id has no page, so the list leaves it out and so does the count.
			umas: [uma(1, 100101), uma(2, 100102), uma(3, null)] as never,
			support_cards: [card(1), card(2), card(3), card(4)] as never,
			skill_count: 2223,
		})
		const { result } = renderHook(() => {
			const totals = useCatalogueCounts(state)
			return { totals, counts: useEncyclopediaCounts() }
		})
		expect(result.current.totals).toEqual({ umas: 2, cards: 4, skills: 2223 })
		expect(result.current.counts).toMatchObject({ umas: 2, cards: 4, skills: 2223 })
	})

	it("reports nothing while the catalogue loads", () => {
		const { result } = renderHook(() => useCatalogueCounts({ status: "loading" }))
		expect(result.current).toBeNull()
	})
})
