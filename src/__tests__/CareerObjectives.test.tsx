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

	it("shows a fan count or a placings goal as its sentence, with no grade or placing beside it", () => {
		// As Daptrius read Oguri Cap's two off the game (board, 2026-11-12).
		render(<CareerObjectives hidden={0} goals={[
			{ turn: 24, when: "Junior Year, Late Dec", kind: "fans", race: "Get 3,000 fans", grade: null, need: "" },
			{ turn: 60, when: "Senior Year, Late Jun", kind: "placings", race: "Place 3rd or better in 2 G1 races", grade: null, need: "" },
		]} />)
		expect(screen.getAllByRole("listitem").map((row) => row.textContent)).toEqual([
			"Late DecGet 3,000 fans",
			"Late JunPlace 3rd or better in 2 G1 races",
		])
	})

	it("says when goals it can't word yet are left out", () => {
		render(<CareerObjectives goals={GOALS} hidden={2} />)
		expect(screen.getByText(/2 more goals aren't shown yet/)).toBeInTheDocument()
	})
})
