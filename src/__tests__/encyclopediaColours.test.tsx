import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { Hero, Page } from "../components/encyclopedia/pieces"
import { colourStyle, isTopAptitude, umaEntryNumber } from "../utils/encyclopedia"

/** A character's two colours on a page (notes/encyclopedia-redesign-plan.md). */

describe("colourStyle", () => {
	it("turns the API's pair into the page's two variables", () => {
		expect(colourStyle(["#3A7AD2", "#ECE7E7"])).toEqual({ "--c1": "#3A7AD2", "--c2": "#ECE7E7" })
	})

	it("is nothing without a pair, so the stylesheet's defaults stand", () => {
		expect(colourStyle(null)).toBeUndefined()
		expect(colourStyle(undefined)).toBeUndefined()
		expect(colourStyle(["#3A7AD2"])).toBeUndefined()
	})

	it("refuses anything that isn't a plain hex colour: it goes into a style attribute", () => {
		expect(colourStyle(["red", "#ECE7E7"])).toBeUndefined()
		expect(colourStyle(["#3A7AD2;background:url(x)", "#ECE7E7"])).toBeUndefined()
	})
})

describe("the page's furniture", () => {
	it("sets the colours on the page and draws the hero's number and faint name", () => {
		const { container } = render(
			<MemoryRouter>
				<Page colours={["#3A7AD2", "#ECE7E7"]}>
					<Hero art={<span />} entry={umaEntryNumber(100601)} ghost="オグリキャップ" eyebrow="Trainee" name="Oguri Cap" />
				</Page>
			</MemoryRouter>
		)
		const page = container.querySelector(".enc-page") as HTMLElement
		expect(page.style.getPropertyValue("--c1")).toBe("#3A7AD2")
		expect(page.style.getPropertyValue("--c2")).toBe("#ECE7E7")
		expect(screen.getByText("No. 1006 · 01")).toBeInTheDocument()
		// The faint name is decoration: the readable Japanese line is the page's own.
		expect(screen.getByText("オグリキャップ")).toHaveAttribute("aria-hidden", "true")
	})

	it("leaves the page uncoloured when the files hold no pair", () => {
		const { container } = render(<MemoryRouter><Page colours={null}><p>x</p></Page></MemoryRouter>)
		expect((container.querySelector(".enc-page") as HTMLElement).getAttribute("style")).toBeNull()
	})
})

describe("aptitudes", () => {
	it("highlights A or better and nothing below", () => {
		expect([8, 7, 6, 1].map(isTopAptitude)).toEqual([true, true, false, false])
		expect(isTopAptitude(null)).toBe(false)
	})
})
