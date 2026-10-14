import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { GuideSkillsBody } from "../components/pvp/GuideSkillsPanel"
import type { PvpGuide } from "../types/pvpGuide"

/**
 * Recommended skills: by category, each skill once, the team's skills ticked
 * and counted, and a row that opens to say why and where from.
 */

const skill = (id: number, name: string) => ({ id, name, description: `${name} does a thing.`, image: null, rarity: 1, unique_of: null, version: "○ white", versions: [] })
const row = (id: number, name: string, style: string, category: string, tier: number | null) =>
	({ style, category, tier, order: 0, note: "", skill: skill(id, name) })

const GUIDE = {
	skill_recommendations: [
		row(1, "Groundwork", "front", "acceleration", 1),
		row(1, "Groundwork", "pace", "acceleration", 0),
		row(2, "Swinging Maestro", "everyone", "recovery", null),
	],
} as unknown as PvpGuide

const SPOTS = [
	{ position: 0, label: "Spot 1 · Daiwa Scarlet" },
	{ position: 1, label: "Spot 2 · empty" },
	{ position: 2, label: "Spot 3 · empty" },
]

describe("GuideSkillsBody", () => {
	it("groups by category, lists each skill once and counts the team's", () => {
		render(
			<GuideSkillsBody
				guideState={{ status: "ready", guide: GUIDE }}
				teamSkillSources={new Map([[1, ["Kitasan Black (hint)"]]])}
				spots={SPOTS}
				onSearch={() => {}}
			/>
		)
		const acceleration = within(screen.getByRole("region", { name: "Acceleration" }))
		expect(acceleration.getAllByRole("button")).toHaveLength(1)
		expect(acceleration.getByText("1 of 1 on your team")).toBeInTheDocument()
		expect(acceleration.getByText("T0")).toBeInTheDocument()
		expect(within(screen.getByRole("region", { name: "Recovery" })).getByText("0 of 1 on your team")).toBeInTheDocument()
	})

	it("opens a row with the description, positions and where the team gets it", () => {
		render(
			<GuideSkillsBody
				guideState={{ status: "ready", guide: GUIDE }}
				teamSkillSources={new Map([[1, ["Kitasan Black (hint)"]]])}
				spots={SPOTS}
				onSearch={() => {}}
			/>
		)
		fireEvent.click(screen.getByRole("button", { name: /Groundwork/ }))
		expect(screen.getByText("Groundwork does a thing.")).toBeInTheDocument()
		expect(screen.getByText("For: Front, Pace")).toBeInTheDocument()
		expect(screen.getByText("Your team: Kitasan Black (hint)")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: /Swinging Maestro/ }))
		expect(screen.getByText("For: every position")).toBeInTheDocument()
		expect(screen.getByText("Not on your team yet.")).toBeInTheDocument()
	})

	it("counts a skill the team gets as another version, and says which", () => {
		const gold = { id: 7, name: "Groundwork ◎", description: "", image: null, rarity: 2, tier: 2, version: "◎ gold", is_evolved: false }
		const guide = {
			skill_recommendations: [{ ...GUIDE.skill_recommendations[0], skill: { ...skill(1, "Groundwork"), versions: [gold] } }],
		} as unknown as PvpGuide
		render(
			<GuideSkillsBody
				guideState={{ status: "ready", guide }}
				teamSkillSources={new Map([[7, ["Kitasan Black (hint)"]]])}
				spots={SPOTS}
				onSearch={() => {}}
			/>
		)
		expect(screen.getByText("1 of 1 on your team")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: /Groundwork/ }))
		expect(screen.getByText("Your team: Kitasan Black (hint), as ◎ gold")).toBeInTheDocument()
		expect(screen.getByText("Also as: Groundwork ◎ (◎ gold)")).toBeInTheDocument()
	})

	it("offers a search per team spot, with the skill's name", () => {
		const onSearch = vi.fn()
		render(
			<GuideSkillsBody guideState={{ status: "ready", guide: GUIDE }} teamSkillSources={new Map()} spots={SPOTS} onSearch={onSearch} />
		)
		fireEvent.click(screen.getByRole("button", { name: /Groundwork/ }))
		expect(screen.getAllByRole("button", { name: /^Search for Groundwork/ })).toHaveLength(3)
		fireEvent.click(screen.getByRole("button", { name: "Search for Groundwork: Spot 2 · empty" }))
		expect(onSearch).toHaveBeenCalledWith(1, "Groundwork")
	})

	it("filters by position, then by category", () => {
		const guide = {
			skill_recommendations: [
				row(1, "Groundwork", "front", "acceleration", 1),
				row(3, "Early Lead", "end", "speed", null),
				row(2, "Swinging Maestro", "everyone", "recovery", null),
			],
		} as unknown as PvpGuide
		render(<GuideSkillsBody guideState={{ status: "ready", guide }} teamSkillSources={new Map()} spots={SPOTS} onSearch={() => {}} />)
		const positions = within(screen.getByRole("group", { name: "Position" }))
		expect(positions.getAllByRole("button").map((chip) => chip.textContent)).toEqual(["All", "Front", "End"])
		fireEvent.click(positions.getByRole("button", { name: "Front" }))
		// Front's own skill and the general one; End's is gone.
		expect(screen.getByRole("button", { name: /Groundwork/ })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: /Swinging Maestro/ })).toBeInTheDocument()
		expect(screen.queryByRole("button", { name: /Early Lead/ })).not.toBeInTheDocument()
		fireEvent.click(within(screen.getByRole("group", { name: "Category" })).getByRole("button", { name: "Recovery" }))
		expect(screen.queryByRole("button", { name: /Groundwork/ })).not.toBeInTheDocument()
		// End has no recovery of its own, but the general one is still recovery.
		fireEvent.click(positions.getByRole("button", { name: "End" }))
		expect(screen.getByRole("button", { name: /Swinging Maestro/ })).toBeInTheDocument()
	})

	it("keeps the filters in view, greyed out, when the guide has no skills", () => {
		render(
			<GuideSkillsBody guideState={{ status: "ready", guide: { skill_recommendations: [] } as unknown as PvpGuide }} teamSkillSources={new Map()} spots={SPOTS} onSearch={() => {}} />
		)
		const positions = within(screen.getByRole("group", { name: "Position" }))
		expect(positions.getAllByRole("button").every((chip) => (chip as HTMLButtonElement).disabled)).toBe(true)
		expect(within(screen.getByRole("group", { name: "Category" })).getByRole("button", { name: "Acceleration" })).toBeDisabled()
		expect(screen.getByText("This event's guide has no skill picks yet.")).toBeInTheDocument()
	})
})
