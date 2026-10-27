import { renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useCardReleases } from "../hooks/useCardReleases"
import { loadPvpCatalogue } from "../services/pvpTeamFetchCalls"
import type { CatalogueSupportCard } from "../types/pvpTeam"

/**
 * Placeholder support cards ("your best SSR Speed card", owner 2026-10-27):
 * the catalogue load names and orders them, and the release rule counts them
 * out for every event. The deck rules and the picker are in pvpTeams.test.ts
 * and PvpCardPicker.test.tsx.
 */

vi.mock("../services/CalculatorContext", () => ({
	useCalculatorData: () => ({ umaBannerData: [], supportBannerData: [] }),
}))

const card = (id: number, name: string, card_type: string, rarity: number, placeholder = false): CatalogueSupportCard => ({
	id, name, image: null, card_type, rarity, title: name, skills: [], on_global: false, placeholder,
})

afterEach(() => vi.unstubAllGlobals())

describe("placeholder cards", () => {
	it("are renamed for players and listed first, SSR first, on load", async () => {
		const support_cards = [
			card(1, "Kitasan Black", "speed", 3),
			card(2, "R Friend", "friend", 1, true),
			card(3, "SSR Wit", "wit", 3, true),
			card(4, "SSR Speed", "speed", 3, true),
		]
		vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ umas: [], support_cards, skills: [] }))))
		const catalogue = await loadPvpCatalogue()
		expect(catalogue.support_cards.map((row) => row.name)).toEqual([
			"Your best SSR Speed card",
			"Your best SSR Wit card",
			"Your best R Friend card",
			"Kitasan Black",
		])
		// The admin's name is gone from the search's alias too.
		expect(catalogue.support_cards[0].title).toBe("")
	})

	it("are out for every event, unlike a card that isn't on global", () => {
		const cardsById = new Map([
			[1, card(1, "JP Card", "speed", 3)],
			[2, card(2, "SSR Speed", "speed", 3, true)],
		])
		const event = { start_date: "2026-11-01T00:00:00Z", end_date: "2026-11-08T00:00:00Z" }
		const { result } = renderHook(() => useCardReleases(event, { umasById: new Map(), cardsById }))
		expect(result.current("support", 1)).toEqual({ kind: "unreleased" })
		expect(result.current("support", 2)).toEqual({ kind: "available" })
	})
})
