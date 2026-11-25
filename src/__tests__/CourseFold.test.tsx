/**
 * The PvP page's course map folds to its one-line answer (CourseFold, review
 * item 3): open on Recommendations, folded on the other tabs and on a phone,
 * the reader's own pick remembered for each place, and a lit skill opening it.
 */
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import CourseFold from "../components/course/CourseFold"
import { forgetMapOpen, setCourseFocus } from "../services/courseMapStore"
import { TestQueryProvider } from "../test/TestQueryProvider"
import type { RaceEvent } from "../types"
import { CHUKYO_1200 } from "./courseFixtures"

const EVENT = { id: 21, name: "Champions Meeting 21", event_type: "champions_meeting", course: CHUKYO_1200 } as unknown as RaceEvent

function draw(place: "guide" | "tools") {
	return render(<CourseFold course={CHUKYO_1200} event={EVENT} guide={null} place={place} />, { wrapper: TestQueryProvider })
}

afterEach(() => {
	act(() => {
		forgetMapOpen()
		setCourseFocus(null)
	})
	vi.restoreAllMocks()
})

describe("CourseFold", () => {
	it("starts open on the guide's tab and folded on the others", () => {
		const guide = draw("guide")
		expect(screen.getByRole("button", { name: "Hide the map" })).toBeInTheDocument()
		guide.unmount()
		draw("tools")
		expect(screen.getByRole("button", { name: "Show the map" })).toBeInTheDocument()
		expect(screen.queryByRole("button", { name: "Hide the map" })).toBeNull()
		// Folded, it still says the map's first answer.
		expect(screen.getByText(/Last spurt can start/)).toBeInTheDocument()
	})

	it("starts folded on a phone, even on the guide's tab", () => {
		vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({ matches: query.includes("max-width"), media: query, addEventListener: () => {}, removeEventListener: () => {} }) as unknown as MediaQueryList)
		draw("guide")
		expect(screen.getByRole("button", { name: "Show the map" })).toBeInTheDocument()
	})

	it("remembers the reader's pick for that place only", () => {
		const tools = draw("tools")
		fireEvent.click(screen.getByRole("button", { name: "Show the map" }))
		expect(screen.getByRole("button", { name: "Hide the map" })).toBeInTheDocument()
		tools.unmount()
		const again = draw("tools")
		expect(screen.getByRole("button", { name: "Hide the map" })).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "Hide the map" }))
		again.unmount()
		draw("guide")
		// The guide's place has its own default, untouched by the other tabs.
		expect(screen.getByRole("button", { name: "Hide the map" })).toBeInTheDocument()
	})

	it("opens while a skill is lit from the guide", () => {
		draw("tools")
		act(() => setCourseFocus({ skillId: 1, name: "Swinging Maestro" }))
		expect(screen.getByRole("button", { name: "Hide the map" })).toBeInTheDocument()
	})
})
