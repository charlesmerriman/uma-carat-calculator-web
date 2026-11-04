/**
 * The course map's layers in the block (CourseSection, CourseLayersMenu):
 * the open skill row lights its zones, the zones are fetched only once a layer
 * needs them, the Layers menu is off by default and asks a guest to sign in.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import CourseSection from "../components/course/CourseSection"
import { setCourseFocus } from "../services/courseMapStore"
import { TestQueryProvider } from "../test/TestQueryProvider"
import type { SkillZoneMap } from "../utils/courseLayers"
import { CHUKYO_1200 } from "./courseFixtures"

const ZONES: SkillZoneMap = {
	"88": { kind: "place", zones: [{ start: 550, end: 788, kind: "random" }], styles: ["front"] },
}

afterEach(() => {
	act(() => setCourseFocus(null))
	vi.restoreAllMocks()
})

describe("the course map's layers", () => {
	it("fetches nothing until a layer needs the zones", () => {
		const fetchSpy = vi.spyOn(globalThis, "fetch")
		render(<CourseSection course={CHUKYO_1200} />, { wrapper: TestQueryProvider })
		expect(fetchSpy).not.toHaveBeenCalled()
	})

	it("lights the open skill row's zones, with the legend", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(ZONES)))
		const { container } = render(<CourseSection course={CHUKYO_1200} />, { wrapper: TestQueryProvider })
		act(() => setCourseFocus({ skillId: 88, name: "Final Push" }))
		await waitFor(() => expect(container.querySelector('[data-band="layers"]')).not.toBeNull())
		const layers = within(container.querySelector('[data-band="layers"]') as HTMLElement)
		expect(layers.getAllByText("Final Push").length).toBeGreaterThan(0)
		expect(screen.getByRole("list", { name: "Layer legend" })).toBeInTheDocument()
	})

	it("offers the veterans' layer off by default, and asks a guest to sign in", () => {
		render(<CourseSection course={CHUKYO_1200} />, { wrapper: TestQueryProvider })
		fireEvent.click(screen.getByRole("button", { name: "Layers" }))
		const box = screen.getByRole("checkbox", { name: /My veterans' skills/ })
		expect(box).not.toBeChecked()
		expect(box).toBeDisabled()
		expect(screen.getByText("Sign in to show your team's veterans.")).toBeInTheDocument()
	})
})
