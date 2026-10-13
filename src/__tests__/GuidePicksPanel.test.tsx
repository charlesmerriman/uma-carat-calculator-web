import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { GuidePicksPanel, type GuidePickActions } from "../components/pvp/GuidePicksPanel"
import type { PvpGuide } from "../types/pvpGuide"

/**
 * Guide picks: two flat lists, each pick once, and a click opens the ways to
 * add it. Which ways exist is the builder's business (TeamBuilder); here the
 * panel only has to show them, honour a disabled one, and run the chosen one.
 */

const uma = (id: number, name: string) => ({ id, name, image: null })
const card = (id: number, name: string) => ({ id, name, image: null, card_type: "speed", rarity: 3 })

const GUIDE = {
	uma_recommendations: [
		{ style: "front", stars: 5, role: "", note: "", uma: uma(41, "Maruzensky") },
		{ style: "pace", stars: 2, role: "", note: "", uma: uma(41, "Maruzensky") },
	],
	decks: [
		{ id: 1, style: "front", label: "", note: "", slots: [{ slot: 1, order: 0, is_borrow: false, note: "", support_card: card(302, "Kitasan Black") }] },
	],
	honorable_mentions: [{ style: "front", note: "", support_card: card(302, "Kitasan Black") }],
} as unknown as PvpGuide

function renderPanel(actions: Partial<GuidePickActions> = {}) {
	const run = vi.fn()
	const all: GuidePickActions = {
		uma: vi.fn(() => [
			{ key: "spot-0", label: "Spot 1 · empty", buttons: [{ label: "Add", disabledReason: null, run }] },
			{ key: "spot-1", label: "Spot 2 · Gold Ship", buttons: [{ label: "Replace", disabledReason: "Already on this team", run }] },
		]),
		card: vi.fn(() => []),
		emptyCardHint: "Add an uma to the team first, then her cards.",
		...actions,
	}
	render(
		<GuidePicksPanel
			guideState={{ status: "ready", guide: GUIDE }}
			members={[]}
			actions={all}
			onCollapse={() => {}}
		/>
	)
	return { run, all }
}

describe("GuidePicksPanel", () => {
	it("lists each uma and card once", () => {
		renderPanel()
		expect(screen.getAllByRole("button", { name: /Maruzensky/ })).toHaveLength(1)
		expect(screen.getAllByRole("button", { name: /Kitasan Black/ })).toHaveLength(1)
	})

	it("opens the ways to add a pick, with her guide styles, and runs the chosen one", () => {
		const { run, all } = renderPanel()
		fireEvent.click(screen.getByRole("button", { name: /Maruzensky/ }))
		expect(all.uma).toHaveBeenCalledWith(41, ["front", "pace"])
		const row = within(screen.getByRole("listitem", { name: "Add Maruzensky" }))
		expect(row.getByRole("button", { name: "Replace: Spot 2 · Gold Ship" })).toBeDisabled()
		fireEvent.click(row.getByRole("button", { name: "Add: Spot 1 · empty" }))
		expect(run).toHaveBeenCalledTimes(1)
		expect(screen.queryByRole("listitem", { name: "Add Maruzensky" })).not.toBeInTheDocument()
	})

	it("says what to do first when a card has nowhere to go", () => {
		renderPanel()
		fireEvent.click(screen.getByRole("button", { name: /Kitasan Black/ }))
		expect(screen.getByText("Add an uma to the team first, then her cards.")).toBeInTheDocument()
	})
})
