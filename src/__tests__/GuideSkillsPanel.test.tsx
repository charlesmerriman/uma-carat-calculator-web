import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { GuideSkillsBody } from "../components/pvp/GuideSkillsPanel"
import type { PvpGuide } from "../types/pvpGuide"

/**
 * Recommended skills: by category, each skill once, the team's skills ticked
 * and counted, and a row that opens to say why and where from.
 */

const skill = (id: number, name: string) => ({ id, name, description: `${name} does a thing.`, image: null, rarity: 1, unique_of: null })
const row = (id: number, name: string, style: string, category: string, tier: number | null) =>
	({ style, category, tier, order: 0, note: "", skill: skill(id, name) })

const GUIDE = {
	skill_recommendations: [
		row(1, "Groundwork", "front", "acceleration", 1),
		row(1, "Groundwork", "pace", "acceleration", 0),
		row(2, "Swinging Maestro", "everyone", "recovery", null),
	],
} as unknown as PvpGuide

describe("GuideSkillsBody", () => {
	it("groups by category, lists each skill once and counts the team's", () => {
		render(
			<GuideSkillsBody
				guideState={{ status: "ready", guide: GUIDE }}
				teamSkillSources={new Map([[1, ["Kitasan Black (hint)"]]])}
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
})
