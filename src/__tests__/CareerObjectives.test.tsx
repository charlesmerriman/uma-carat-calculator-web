import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { CareerObjectives } from "../components/encyclopedia/CareerObjectives"
import type { CareerGoal } from "../types/encyclopedia"

/**
 * An uma's career goals on her page: a list per year (one track on a phone, a
 * column each on a wider screen, by CSS), the year said once over its first goal.
 */

const GOALS: CareerGoal[] = [
	{ turn: 12, when: "Junior Year, Late Jun", race: "Junior Make Debut", grade: null, need: "Run it" },
	{ turn: 27, when: "Classic Year, Early Feb", race: "Kisaragi Sho", grade: "G3", need: "Top 5" },
	{ turn: 34, when: "Classic Year, Late May", race: "Tokyo Yushun (Japanese Derby)", grade: "G1", need: "Top 5" },
	{ turn: 72, when: "Senior Year, Late Dec", race: "Arima Kinen", grade: "G1", need: "Win" },
]

describe("CareerObjectives", () => {
	it("lists the goals in order, a list per year, naming each year once, with the race, grade and placing", () => {
		render(<CareerObjectives goals={GOALS} hidden={0} />)
		// One list per year, named for it (Daptrius, board, 2026-11-17: by year on desktop).
		expect(screen.getAllByRole("list").map((list) => list.getAttribute("aria-label"))).toEqual(["Junior Year", "Classic Year", "Senior Year"])
		expect(within(screen.getByRole("list", { name: "Classic Year" })).getAllByRole("listitem")).toHaveLength(2)
		expect(screen.getAllByRole("listitem").map((row) => row.textContent)).toEqual([
			"Junior YearLate JunJunior Make DebutRun it",
			"Classic YearEarly FebKisaragi ShoG3Top 5",
			// The second goal of a year doesn't repeat it.
			"Late MayTokyo Yushun (Japanese Derby)G1Top 5",
			"Senior YearLate DecArima KinenG1Win",
		])
		// A race she must win is a gold post.
		expect(screen.getAllByRole("listitem").map((row) => row.getAttribute("data-win"))).toEqual(["false", "false", "false", "true"])
		expect(screen.queryByText(/aren't shown yet/)).not.toBeInTheDocument()
	})

	it("shows a fan count or a placings goal as its sentence, with no grade or placing beside it", () => {
		// As Daptrius read Oguri Cap's two off the game (board, 2026-11-12).
		render(<CareerObjectives hidden={0} goals={[
			{ turn: 24, when: "Junior Year, Late Dec", kind: "fans", race: "Get 3,000 fans", grade: null, need: "" },
			{ turn: 60, when: "Senior Year, Late Jun", kind: "placings", race: "Place 3rd or better in 2 G1 races", grade: null, need: "" },
		]} />)
		expect(screen.getAllByRole("listitem").map((row) => row.textContent)).toEqual([
			"Junior YearLate DecGet 3,000 fans",
			"Senior YearLate JunPlace 3rd or better in 2 G1 races",
		])
	})

	it("says when goals it can't word yet are left out", () => {
		render(<CareerObjectives goals={GOALS} hidden={2} />)
		expect(screen.getByText(/2 more goals aren't shown yet/)).toBeInTheDocument()
	})
})
