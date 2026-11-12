import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { CareerObjectives } from "../components/encyclopedia/CareerObjectives"
import type { CareerGoal } from "../types/encyclopedia"

/** An uma's career goals on her page, grouped by year. */

const GOALS: CareerGoal[] = [
	{ turn: 12, when: "Junior Year, Late Jun", race: "Junior Make Debut", grade: null, need: "Run it" },
	{ turn: 27, when: "Classic Year, Early Feb", race: "Kisaragi Sho", grade: "G3", need: "Top 5" },
	{ turn: 34, when: "Classic Year, Late May", race: "Tokyo Yushun (Japanese Derby)", grade: "G1", need: "Top 5" },
	{ turn: 72, when: "Senior Year, Late Dec", race: "Arima Kinen", grade: "G1", need: "Win" },
]

describe("CareerObjectives", () => {
	it("groups the goals by year, in order, with the race, grade and placing", () => {
		render(<CareerObjectives goals={GOALS} hidden={0} />)
		expect(screen.getAllByRole("heading").map((heading) => heading.textContent)).toEqual([
			"Junior Year", "Classic Year", "Senior Year",
		])
		const classic = screen.getByRole("heading", { name: "Classic Year" }).parentElement as HTMLElement
		const rows = within(classic).getAllByRole("listitem")
		expect(rows.map((row) => row.textContent)).toEqual([
			"Early FebKisaragi ShoG3Top 5",
			"Late MayTokyo Yushun (Japanese Derby)G1Top 5",
		])
		expect(screen.queryByText(/aren't shown yet/)).not.toBeInTheDocument()
	})

	it("says when goals it can't word yet are left out", () => {
		render(<CareerObjectives goals={GOALS} hidden={2} />)
		expect(screen.getByText(/2 more goals aren't shown yet/)).toBeInTheDocument()
	})
})
