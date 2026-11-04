/**
 * The Timeline race card's course drawer (components/course/CourseDrawer.tsx):
 * closed by default, opened by its button, holding the mini strip, the chips
 * and the way to the full map; and only on a card whose event has a course.
 */
import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"
import CourseDrawer from "../components/course/CourseDrawer"
import { RaceEventCard } from "../components/timeline/RaceEventCard"
import type { ChampionsMeeting } from "../types"
import { CHUKYO_1200 } from "./courseFixtures"

function renderDrawer() {
	return render(
		<MemoryRouter>
			<CourseDrawer course={CHUKYO_1200} guideHref="/app/pvp?event=cm-21" />
		</MemoryRouter>,
	)
}

describe("CourseDrawer", () => {
	it("starts closed", () => {
		renderDrawer()
		expect(screen.getByRole("button", { name: "Course map" })).toHaveAttribute("aria-expanded", "false")
		expect(screen.queryByText("Chukyo turf 1,200m, left-handed")).toBeNull()
	})

	it("opens to the course's name, the mini strip, the chips and the guide link", () => {
		const { container } = renderDrawer()
		fireEvent.click(screen.getByRole("button", { name: "Course map" }))
		expect(screen.getByRole("button", { name: "Course map" })).toHaveAttribute("aria-expanded", "true")
		expect(screen.getByText("Chukyo turf 1,200m, left-handed")).toBeInTheDocument()
		expect(container.querySelector('[data-band="track"]')).not.toBeNull()
		// The mini strip carries no words of its own.
		expect(screen.queryByText("Corner 3")).toBeNull()
		expect(screen.getByText("Final straight 412m")).toBeInTheDocument()
		expect(screen.getByRole("link", { name: "See the full course map in the guide" })).toHaveAttribute("href", "/app/pvp?event=cm-21")
	})
})

describe("RaceEventCard", () => {
	const meeting = {
		id: 21, name: "Champions Meeting 21 Capricorn Cup", event_type: "champions_meeting", cm_number: 21,
		start_date: "2099-01-10T00:00:00Z", end_date: "2099-01-17T00:00:00Z", is_predicted: false,
		jp_start_date: null, jp_end_date: null, global_start_date: null, global_end_date: null,
		schedule_offset_days: 0, applied_offset_days: 0, image: null,
		track: "Chukyo", surface_type: "Turf", distance: "Sprint", length: "1200", track_condition: "Firm",
		season: "Winter", weather: "Sunny", direction: "Left",
	} satisfies ChampionsMeeting

	it("has the drawer only when the event has a course", () => {
		const today = new Date("2099-01-01T00:00:00Z")
		const { unmount } = render(<MemoryRouter><RaceEventCard event={{ ...meeting, course: CHUKYO_1200 }} today={today} /></MemoryRouter>)
		expect(screen.getByRole("button", { name: "Course map" })).toBeInTheDocument()
		unmount()
		render(<MemoryRouter><RaceEventCard event={{ ...meeting, course: null }} today={today} /></MemoryRouter>)
		expect(screen.queryByRole("button", { name: "Course map" })).toBeNull()
	})
})
