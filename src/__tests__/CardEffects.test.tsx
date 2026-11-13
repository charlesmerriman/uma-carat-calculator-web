import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { CardEffects } from "../components/encyclopedia/CardEffects"
import type { CardEffect } from "../types/encyclopedia"
import { effectValue } from "../utils/encyclopedia"

/** A support card's effects table: a value per level, as the API worked them out. */

/** An effect whose value at each level is whatever `at` says (null before `unlock`). */
const effect = (type: number, name: string, format: CardEffect["format"], unlock: number, at: (level: number) => number): CardEffect => ({
	type, name, help: `What ${name} does`, format, unlock,
	values: Array.from({ length: 50 }, (_, index) => (index + 1 < unlock ? null : at(index + 1))),
})

// Special Week's SSR, at the levels Daptrius checked: Friendship Bonus 15 at 30, 16 at 35, 20 from 45.
const EFFECTS = [
	effect(1, "Friendship Bonus", "percent", 1, (level) => (level >= 45 ? 20 : level >= 35 ? 16 : 15)),
	effect(17, "Hint Levels", "level", 10, () => 2),
	effect(5, "Power Bonus", "number", 35, () => 1),
	effect(8, "Training Effectiveness", "number", 45, (level) => (level >= 50 ? 10 : 5)),
]
const CAPS = [30, 35, 40, 45, 50]
const UNIQUE = { level: 30, text: "Guts Bonus and Initial Guts" }

const row = (name: string) => screen.getByText(name).closest("li") as HTMLElement

describe("CardEffects", () => {
	it("opens at the top level, with each value written the way its format says", () => {
		render(<CardEffects effects={EFFECTS} caps={CAPS} unique={UNIQUE} />)
		expect(screen.getByText("50")).toBeInTheDocument()
		expect(row("Friendship Bonus")).toHaveTextContent("20%")
		expect(row("Hint Levels")).toHaveTextContent("Lv 2")
		expect(row("Training Effectiveness")).toHaveTextContent("10")
		expect(row("Friendship Bonus")).toHaveTextContent("What Friendship Bonus does")
		expect(screen.getByText("Guts Bonus and Initial Guts")).toBeInTheDocument()
		expect(screen.getByText("Needs max limit break")).toBeInTheDocument()
	})

	it("opens at the level the owner's limit break reaches", () => {
		render(<CardEffects effects={EFFECTS} caps={CAPS} unique={UNIQUE} limitBreak={1} />)
		expect(screen.getByRole("button", { name: "1" })).toHaveAttribute("aria-pressed", "true")
		expect(row("Friendship Bonus")).toHaveTextContent("16%")
		expect(screen.getByText("Needs limit break 1")).toBeInTheDocument()
	})

	it("greys an effect the card doesn't have yet and says when it unlocks", () => {
		render(<CardEffects effects={EFFECTS} caps={CAPS} unique={UNIQUE} limitBreak={1} />)
		expect(row("Power Bonus")).toHaveAttribute("data-locked", "false")
		expect(row("Training Effectiveness")).toHaveAttribute("data-locked", "true")
		expect(row("Training Effectiveness")).toHaveTextContent("Unlocks at level 45")
	})

	it("steps the level and jumps to a limit break's cap", () => {
		render(<CardEffects effects={EFFECTS} caps={CAPS} unique={UNIQUE} />)
		fireEvent.click(screen.getByRole("button", { name: "5 levels down" }))
		expect(row("Training Effectiveness")).toHaveTextContent("5")
		fireEvent.click(screen.getByRole("button", { name: "1 level down" }))
		expect(row("Training Effectiveness")).toHaveAttribute("data-locked", "true")
		// 44 is past the cap of limit break 2 (40), so it needs a third.
		expect(screen.getByText("Needs limit break 3")).toBeInTheDocument()
		fireEvent.click(within(screen.getByRole("group", { name: "Limit break" })).getByRole("button", { name: "0" }))
		expect(row("Friendship Bonus")).toHaveTextContent("15%")
		expect(screen.getByText("No limit break needed")).toBeInTheDocument()
		// The top level can't be stepped past.
		fireEvent.click(within(screen.getByRole("group", { name: "Limit break" })).getByRole("button", { name: "MLB" }))
		expect(screen.getByRole("button", { name: "1 level up" })).toBeDisabled()
	})

	it("locks the unique effect below its level", () => {
		const { container } = render(<CardEffects effects={EFFECTS} caps={CAPS} unique={UNIQUE} limitBreak={0} />)
		const unique = container.querySelector(".enc-unique") as HTMLElement
		expect(unique).toHaveAttribute("data-locked", "false")
		expect(unique).toHaveTextContent("From level 30")
		fireEvent.click(screen.getByRole("button", { name: "1 level down" }))
		expect(unique).toHaveAttribute("data-locked", "true")
		expect(unique).toHaveTextContent("Unlocks at level 30")
	})

	it("writes a unit only for a format that names one", () => {
		expect([effectValue(16, "percent"), effectValue(2, "level"), effectValue(21, "number"), effectValue(5, "something new")])
			.toEqual(["16%", "Lv 2", "21", "5"])
	})
})
