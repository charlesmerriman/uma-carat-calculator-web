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

const card = (id: number, name: string, skills: number[], card_type = "speed"): CatalogueSupportCard => ({
	id, name, image: null, card_type, rarity: 3, title: "", skills: skills.map((s) => ({ skill: s, source: "hint" })),
})
const CARDS = [
	card(10, "Fine Motion", [2], "wit"),
	card(11, "Kitasan Black", [1, 2]),
	card(12, "Super Creek", [3], "stamina"),
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

	it("filters by card type", () => {
		renderSupportPicker()
		fireEvent.click(within(screen.getByRole("group", { name: "Card type" })).getByRole("button", { name: "Stamina" }))
		expect(tileNames()).toEqual(["Super Creek"])
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
})
