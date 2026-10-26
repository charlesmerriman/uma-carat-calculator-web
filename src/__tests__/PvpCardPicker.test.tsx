import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { PvpCardPicker } from "../components/pvp/PvpCardPicker"
import type { CatalogueSkill, CatalogueSupportCard, CatalogueUma } from "../types/pvpTeam"

/**
 * The team builder's picker: search by name or skill, skill chips that pin,
 * the aptitude badges, the guide's star, and blocked tiles that stay visible.
 */

const skill = (id: number, name: string): CatalogueSkill => ({
	id, name, description: `${name} does a thing.`, image: null, rarity: 1, tier: 1, group_id: null, cost: null,
})
const SKILLS = new Map([skill(1, "Lead the Pack"), skill(2, "Groundwork"), skill(3, "Leader's Pride")].map((s) => [s.id, s]))

const card = (id: number, name: string, skills: number[], card_type = "speed", rarity: number | null = 3): CatalogueSupportCard => ({
	id, name, image: null, card_type, rarity, title: "", skills: skills.map((s) => ({ skill: s, source: "hint" })),
})
const CARDS = [
	card(10, "Fine Motion", [2], "wit"),
	card(11, "Kitasan Black", [1, 2]),
	card(12, "Super Creek", [3], "stamina", 2),
]

const apt = (front: number, medium: number) => ({
	turf: 8, dirt: 1, short: 3, mile: 6, medium, long: 4, front, pace: 5, late: 2, end: 1,
})
const uma = (id: number, name: string, front: number, medium: number): CatalogueUma => ({
	id, name, image: null, portrait: null, rarity: 3, running_style: 1, character_id: id, is_variant: false,
	apt: apt(front, medium), skills: [],
})

const COURSE = { surface_type: "Turf", distance: "Medium", length: "2000" }

function renderSupportPicker(props: Partial<Parameters<typeof PvpCardPicker>[0]> = {}) {
	const onPick = vi.fn()
	render(
		<PvpCardPicker
			pool="support"
			items={CARDS}
			title="Card 1 for Maruzensky"
			skillsById={SKILLS}
			event={COURSE}
			style="front"
			recommended={new Set()}
			blockReason={() => null}
			selectedId={null}
			onPick={onPick}
			onClose={() => {}}
			{...(props as object)}
		/>
	)
	return { onPick }
}

const tileNames = () =>
	within(screen.getByRole("dialog"))
		.getAllByRole("listitem")
		.map((item) => item.querySelector("button span.line-clamp-2")?.textContent)

describe("PvpCardPicker", () => {
	it("finds cards by a skill they teach and offers the skill as a chip", () => {
		renderSupportPicker()
		fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), { target: { value: "lead" } })
		expect(tileNames()).toEqual(["Kitasan Black", "Super Creek"])
		const chips = within(screen.getByRole("group", { name: "Has skill" }))
		expect(chips.getAllByRole("button").map((chip) => chip.textContent)).toEqual(["Lead the Pack", "Leader's Pride"])
	})

	it("pins a chip as a filter that outlasts the search", () => {
		renderSupportPicker()
		fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), { target: { value: "ground" } })
		fireEvent.click(screen.getByRole("button", { name: "Groundwork" }))
		fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), { target: { value: "" } })
		expect(tileNames()).toEqual(["Fine Motion", "Kitasan Black"])
		expect(screen.getByRole("button", { name: "Groundwork" })).toHaveAttribute("aria-pressed", "true")
	})

	it("treats a white's ○ and ◎ as one skill, and keeps its gold apart", () => {
		// A green skill's family as the game files it. No card teaches the ◎,
		// which is the version the guides recommend.
		const green = (id: number, name: string, rarity: number, tier: number): CatalogueSkill => ({
			id, name, description: "", image: null, rarity, tier, group_id: 20001, cost: null,
		})
		const skills = new Map([
			green(20, "Right-Handed ○", 1, 1),
			green(21, "Right-Handed ◎", 1, 2),
			green(22, "Right-Handed Demon", 2, 3),
			green(23, "Right-Handed ×", 1, -1),
		].map((s) => [s.id, s]))
		renderSupportPicker({
			skillsById: skills,
			items: [card(30, "Fine Motion", [20]), card(31, "Kitasan Black", [21]), card(32, "Super Creek", [22])],
		})
		const search = screen.getByRole("searchbox", { name: "Search" })

		fireEvent.change(search, { target: { value: "Right-Handed ◎" } })
		expect(tileNames()).toEqual(["Fine Motion", "Kitasan Black"])
		fireEvent.change(search, { target: { value: "Right-Handed Demon" } })
		expect(tileNames()).toEqual(["Super Creek"])

		// A pinned ○ is met by a card teaching the ◎ too, and the gold stays out.
		fireEvent.change(search, { target: { value: "Right-Handed ○" } })
		fireEvent.click(screen.getByRole("button", { name: "Right-Handed ○" }))
		fireEvent.change(search, { target: { value: "" } })
		expect(tileNames()).toEqual(["Fine Motion", "Kitasan Black"])
	})

	it("filters by card type", () => {
		renderSupportPicker()
		fireEvent.click(within(screen.getByRole("group", { name: "Card type" })).getByRole("button", { name: "Stamina" }))
		expect(tileNames()).toEqual(["Super Creek"])
	})

	it("filters by rarity, starting on All", () => {
		renderSupportPicker({ items: [...CARDS, card(13, "Sakura Bakushin O", [], "speed", 1), card(14, "No Rarity Yet", [], "speed", null)] })
		const rarity = within(screen.getByRole("group", { name: "Rarity" }))
		expect(rarity.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true")
		expect(tileNames()).toHaveLength(5)
		fireEvent.click(rarity.getByRole("button", { name: "SR" }))
		expect(tileNames()).toEqual(["Super Creek"])
		fireEvent.click(rarity.getByRole("button", { name: "R" }))
		expect(tileNames()).toEqual(["Sakura Bakushin O"])
		// A card with no rarity reads as SSR.
		fireEvent.click(rarity.getByRole("button", { name: "SSR" }))
		expect(tileNames()).toEqual(["Fine Motion", "Kitasan Black", "No Rarity Yet"])
		expect(rarity.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "false")
		fireEvent.click(rarity.getByRole("button", { name: "All" }))
		expect(tileNames()).toHaveLength(5)
	})

	it("says the filters, not the search, emptied the grid", () => {
		renderSupportPicker()
		fireEvent.click(within(screen.getByRole("group", { name: "Rarity" })).getByRole("button", { name: "R" }))
		expect(screen.getByText("Nothing matches these filters.")).toBeInTheDocument()
	})

	it("keeps the card filters off the umas when a skill search switches tabs", () => {
		const shared = {
			title: "Find", skillsById: SKILLS, event: COURSE, style: "front" as const, recommended: new Set<number>(),
			blockReason: () => null, selectedId: null, onPick: () => {}, onClose: () => {},
		}
		const { rerender } = render(<PvpCardPicker {...shared} pool="support" items={CARDS} />)
		fireEvent.click(within(screen.getByRole("group", { name: "Rarity" })).getByRole("button", { name: "SR" }))
		fireEvent.click(within(screen.getByRole("group", { name: "Card type" })).getByRole("button", { name: "Stamina" }))
		rerender(<PvpCardPicker {...shared} pool="uma" items={[uma(1, "Maruzensky", 8, 7)]} />)
		expect(tileNames()).toEqual(["Maruzensky"])
		// Back on the cards, both are still set.
		rerender(<PvpCardPicker {...shared} pool="support" items={CARDS} />)
		expect(tileNames()).toEqual(["Super Creek"])
		expect(within(screen.getByRole("group", { name: "Rarity" })).getByRole("button", { name: "SR" })).toHaveAttribute("aria-pressed", "true")
	})

	it("stars the guide's picks and puts them first", () => {
		renderSupportPicker({ recommended: new Set([12]) })
		expect(tileNames()[0]).toBe("Super Creek")
		expect(screen.getAllByLabelText("Recommended by the guide")).toHaveLength(1)
	})

	it("keeps a blocked card in the grid, disabled, with the reason", () => {
		const { onPick } = renderSupportPicker({ blockReason: (id: number) => (id === 11 ? "Already in this deck" : null) })
		const blocked = screen.getByTitle("Already in this deck")
		expect(blocked).toBeDisabled()
		fireEvent.click(blocked)
		expect(onPick).not.toHaveBeenCalled()
		fireEvent.click(screen.getByTitle("Fine Motion"))
		expect(onPick).toHaveBeenCalledWith(10)
	})

	it("badges umas with the race's surface, distance and style letters", () => {
		render(
			<PvpCardPicker
				pool="uma"
				items={[uma(1, "Maruzensky", 8, 7)]}
				title="Uma 1"
				skillsById={SKILLS}
				event={COURSE}
				style="front"
				recommended={new Set()}
				blockReason={() => null}
				selectedId={null}
				onPick={() => {}}
				onClose={() => {}}
			/>
		)
		const badges = screen.getByLabelText("Aptitudes for this race")
		expect([...badges.children].map((badge) => `${badge.getAttribute("title")} ${badge.textContent}`)).toEqual([
			"Turf S",
			"Medium A",
			"Front S",
		])
	})

	it("closes on Escape", () => {
		const onClose = vi.fn()
		renderSupportPicker({ onClose })
		fireEvent.keyDown(window, { key: "Escape" })
		expect(onClose).toHaveBeenCalled()
	})

	it("starts with a skill search already typed, from the skills panel", () => {
		renderSupportPicker({ initialSearch: "Groundwork" })
		expect(screen.getByRole("searchbox", { name: "Search" })).toHaveValue("Groundwork")
		expect(tileNames()).toEqual(["Fine Motion", "Kitasan Black"])
	})

	it("sorts what can't be picked last and notes what lands mid-event", () => {
		renderSupportPicker({
			blockReason: (id: number) => (id === 10 ? "Out 2026/12/1, after this event" : null),
			noteFor: (id: number) => (id === 12 ? "Out 2026/11/5, during this event" : null),
		})
		expect(tileNames()).toEqual(["Kitasan Black", "Super Creek", "Fine Motion"])
		expect(screen.getByText("Out 2026/11/5, during this event")).toBeInTheDocument()
		expect(screen.getByTitle("Out 2026/12/1, after this event")).toBeDisabled()
	})
})

describe("the Owned filter (the player's Collection)", () => {
	const owned = { ids: new Set([11]), limitBreaks: new Map([[11, 4]]) }

	it("shows only owned cards by default, with their limit break, and everything once switched off", () => {
		renderSupportPicker({ owned })
		expect(tileNames()).toEqual(["Kitasan Black"])
		expect(within(screen.getByRole("dialog")).getByText("MLB")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("checkbox", { name: /Owned only/ }))
		expect(tileNames()).toEqual(["Fine Motion", "Kitasan Black", "Super Creek"])
	})

	it("starts switched off when nothing is owned", () => {
		renderSupportPicker({ owned: { ids: new Set(), limitBreaks: new Map() } })
		expect(screen.getByRole("checkbox", { name: /Owned only/ })).not.toBeChecked()
		expect(tileNames()).toHaveLength(3)
	})

	it("is absent without a collection (a guest)", () => {
		renderSupportPicker()
		expect(screen.queryByRole("checkbox", { name: /Owned only/ })).toBeNull()
	})
})

