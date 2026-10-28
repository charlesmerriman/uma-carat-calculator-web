import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { RankRow } from "../components/rankings/kit/RankRow"
import { Movement } from "../components/rankings/kit/Movement"
import { FilterPill, FilterToolbar, Tokens } from "../components/rankings/kit/FilterToolbar"
import { tickSummary } from "../components/rankings/kit/tickSummary"

/**
 * The Rankings kit (components/rankings/kit/, notes/rankings-redesign-plan.md
 * step 1): bars scale to the list's leader, movement chips, filter pills
 * that say when they differ from "everything on", and the token line.
 */

/** The width of a row's plain bar fill: the bar column's inner span. */
function barWidths(container: HTMLElement): string[] {
	return [...container.querySelectorAll<HTMLElement>("span.border-r-2")].map((fill) => fill.style.width)
}

describe("RankRow", () => {
	it("draws the bar as count over the leader, the first row full", () => {
		const { container } = render(
			<ol>
				{[176, 88].map((decks, index) => (
					<li key={decks}>
						<RankRow place={index + 1} art={null} name={`Card ${index}`} fill={decks / 176} count={`${decks} decks`} share="29%" />
					</li>
				))}
			</ol>
		)
		expect(barWidths(container)).toEqual(["100%", "50%"])
	})

	it("opens to its detail only when it has one", () => {
		const { rerender } = render(<RankRow place={1} art={null} name="Agnes Tachyon" fill={1} count="176 decks" />)
		expect(screen.queryByRole("button")).not.toBeInTheDocument()
		rerender(<RankRow place={1} art={null} name="Agnes Tachyon" fill={1} count="176 decks" detail={<p>By event</p>} />)
		fireEvent.click(screen.getByRole("button", { expanded: false }))
		expect(screen.getByText("By event")).toBeInTheDocument()
		expect(screen.getByRole("button", { expanded: true })).toBeInTheDocument()
	})
})

describe("Movement", () => {
	it("draws up, down and new, and nothing for no change", () => {
		const { container, rerender } = render(<Movement value={2} />)
		expect(container).toHaveTextContent("▲up 2")
		rerender(<Movement value={-1} />)
		expect(container).toHaveTextContent("▼down 1")
		rerender(<Movement value="new" />)
		expect(container).toHaveTextContent("new")
		rerender(<Movement value={0} />)
		expect(container).toBeEmptyDOMElement()
	})
})

describe("FilterPill", () => {
	it("states its filter, in brand only when it differs from everything on", () => {
		expect(tickSummary(12, 12)).toBe("All")
		expect(tickSummary(3, 12)).toBe("3 of 12")
		expect(tickSummary(0, 12)).toBe("None")
		render(
			<FilterToolbar>
				<FilterPill label="Strategy" state={tickSummary(5, 5)} changed={false} title="Running style">
					<span>menu</span>
				</FilterPill>
				<FilterPill label="Scenario" state={tickSummary(3, 12)} changed title="Training scenario">
					<span>scenarios</span>
				</FilterPill>
			</FilterToolbar>
		)
		expect(screen.getByRole("button", { name: /^Strategy/ })).not.toHaveClass("border-brand")
		expect(screen.getByRole("button", { name: /^Scenario/ })).toHaveClass("border-brand")
	})

	it("opens one menu at a time and closes on Escape", () => {
		render(
			<FilterToolbar>
				<FilterPill label="Strategy" state="All" changed={false} title="Running style">
					<span>styles menu</span>
				</FilterPill>
				<FilterPill label="Scenario" state="All" changed={false} title="Training scenario">
					<span>scenarios menu</span>
				</FilterPill>
			</FilterToolbar>
		)
		fireEvent.click(screen.getByRole("button", { name: /^Strategy/ }))
		expect(screen.getByText("styles menu")).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: /^Scenario/ }))
		expect(screen.queryByText("styles menu")).not.toBeInTheDocument()
		fireEvent.keyDown(screen.getByText("scenarios menu"), { key: "Escape" })
		expect(screen.queryByText("scenarios menu")).not.toBeInTheDocument()
	})
})

describe("Tokens", () => {
	it("resets one filter from its token, and every filter from Reset", () => {
		const removeScenario = vi.fn()
		const reset = vi.fn()
		render(
			<Tokens
				summary="Showing 11 guides and 132 decks for"
				tokens={[{ key: "scenario", label: "Twinkle Legends", removeLabel: "Remove the Scenario filter", onRemove: removeScenario }]}
				onReset={reset}
			/>
		)
		fireEvent.click(screen.getByRole("button", { name: "Remove the Scenario filter" }))
		expect(removeScenario).toHaveBeenCalledOnce()
		fireEvent.click(screen.getByRole("button", { name: "Reset" }))
		expect(reset).toHaveBeenCalledOnce()
	})

	it("draws no Reset when nothing is changed", () => {
		render(<Tokens summary="Showing 51 guides and 607 decks." tokens={[]} onReset={() => {}} />)
		expect(screen.queryByRole("button", { name: "Reset" })).not.toBeInTheDocument()
	})
})
