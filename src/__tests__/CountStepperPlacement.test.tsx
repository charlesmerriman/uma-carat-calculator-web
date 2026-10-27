import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { CountStepper } from "../components/carat-calculator/CountStepper"
import { buildQuantityChips } from "../utils/countChips"

/**
 * Where the bulk-adjust pad mounts (Daptrius, 2026-10-22, "Pop-Up lag"): inside
 * the app's scroller, `absolute`, so it scrolls with the rows on the
 * compositor; on <body>, `fixed`, only where there is no scroller. The chips'
 * maths is countStepper.test.ts.
 */

function Field() {
	return (
		<CountStepper value={10} onChange={() => {}} chips={buildQuantityChips(20)} label="Pulls">
			<input aria-label="Number of pulls" defaultValue={10} />
		</CountStepper>
	)
}

describe("CountStepper's pad", () => {
	it("opens inside the app's scroller, positioned absolutely, so it scrolls with the rows", () => {
		render(
			<div data-app-scroller="" className="relative">
				<Field />
			</div>
		)
		fireEvent.focus(screen.getByLabelText("Number of pulls"))
		const pad = screen.getByRole("group", { name: "Adjust pulls" })
		expect(pad.parentElement).toHaveAttribute("data-app-scroller")
		expect(pad).toHaveClass("absolute")
		expect(pad).not.toHaveClass("fixed")
	})

	it("stays fixed on <body> where there is no scroller", () => {
		render(<Field />)
		fireEvent.focus(screen.getByLabelText("Number of pulls"))
		const pad = screen.getByRole("group", { name: "Adjust pulls" })
		expect(pad.parentElement).toBe(document.body)
		expect(pad).toHaveClass("fixed")
	})
})
