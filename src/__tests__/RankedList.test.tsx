/**
 * RankedList's cut: the thin rows passed as `after` (What wins' unranked
 * umas) share the top-10 cut with the ranked rows, so collapsed means ten rows
 * on screen, and "Show all" counts both.
 */
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { RankedList } from "../components/rankings/kit/RankedList"

function renderList(ranked: number, thin: number) {
	const items = Array.from({ length: ranked }, (_, i) => `ranked ${i + 1}`)
	const after = Array.from({ length: thin }, (_, i) => <li key={i}>thin {i + 1}</li>)
	render(
		<RankedList
			label="What wins"
			items={items}
			itemKey={(item) => item}
			render={(item) => <span>{item}</span>}
			empty="Nothing yet."
			after={after}
		/>
	)
}

describe("RankedList", () => {
	it("cuts the thin rows with the ranked ones, then shows them all", () => {
		renderList(12, 5)
		expect(screen.getAllByRole("listitem")).toHaveLength(10)
		expect(screen.queryByText("thin 1")).not.toBeInTheDocument()

		fireEvent.click(screen.getByRole("button", { name: "Show all 17" }))
		expect(screen.getAllByRole("listitem")).toHaveLength(17)
		expect(screen.getByText("thin 5")).toBeInTheDocument()
	})

	it("fills the room under the cut with thin rows", () => {
		renderList(4, 20)
		expect(screen.getAllByRole("listitem")).toHaveLength(10)
		expect(screen.getByText("thin 6")).toBeInTheDocument()
		expect(screen.queryByText("thin 7")).not.toBeInTheDocument()
	})

	it("shows the empty line only when there are no rows of either kind", () => {
		renderList(0, 2)
		expect(screen.queryByText("Nothing yet.")).not.toBeInTheDocument()
		expect(screen.queryByRole("button")).not.toBeInTheDocument()
	})
})
