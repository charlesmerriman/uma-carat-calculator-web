/**
 * The Timeline race card's course drawer (components/course/CourseDrawer.tsx):
 * closed by default, opened by its button, holding the course's real shape
 * (fetched on open, never the strip or the schematic), the chips and the way
 * to the full map; and only on a card whose event has a course.
 */
import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import CourseDrawer from "../components/course/CourseDrawer"
import { RaceEventCard } from "../components/timeline/RaceEventCard"
import type { ChampionsMeeting } from "../types"
import { TestQueryProvider } from "../test/TestQueryProvider"
import { schematicShape } from "../utils/courseSchematic"
import { CHUKYO_1200 } from "./courseFixtures"

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
	// Any 1,001-point path will do as the "real" shape here.
	fetchMock = vi.fn(async () => new Response(JSON.stringify({ shape: schematicShape(CHUKYO_1200) })))
	vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => vi.unstubAllGlobals())

function renderDrawer() {
	return render(
		<MemoryRouter>
			<CourseDrawer course={CHUKYO_1200} guideHref="/app/pvp?event=cm-21" />
		</MemoryRouter>,
		{ wrapper: TestQueryProvider },
	)
}

describe("CourseDrawer", () => {
	it("starts closed and fetches nothing", () => {
		renderDrawer()
		expect(screen.getByRole("button", { name: "Course map" })).toHaveAttribute("aria-expanded", "false")
		expect(screen.queryByText("Chukyo turf 1,200m, left-handed")).toBeNull()
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it("opens to the course's name, its real shape as a track, the headline and the guide link", async () => {
		const { container } = renderDrawer()
		fireEvent.click(screen.getByRole("button", { name: "Course map" }))
		expect(screen.getByRole("button", { name: "Course map" })).toHaveAttribute("aria-expanded", "true")
		expect(screen.getByText("Chukyo turf 1,200m, left-handed")).toBeInTheDocument()
		// The track's callouts once the shape is in (twice: the desktop and the
		// phone track, CSS picking); never the strip.
		expect(await screen.findAllByText("Corner 3")).toHaveLength(2)
		// Both tracks call the spurt marker "Last spurt" now, the short form
		// the phone's track already used.
		expect(screen.getAllByText("Last spurt")).toHaveLength(2)
		expect(container.querySelector('[data-band="track"]')).toBeNull()
		expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(`/race-courses/${CHUKYO_1200.id}/shape`), expect.anything())
		expect(screen.getByLabelText("Read off the course")).toHaveTextContent("Final straight 412m")
		expect(screen.getByRole("link", { name: "See the full course map in the guide" })).toHaveAttribute("href", "/app/pvp?event=cm-21")
	})

	it("starts the fetch when a pointer reaches the button", () => {
		renderDrawer()
		fireEvent.pointerEnter(screen.getByRole("button", { name: "Course map" }))
		expect(fetchMock).toHaveBeenCalledTimes(1)
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
		const { unmount } = render(
			<MemoryRouter><RaceEventCard event={{ ...meeting, course: CHUKYO_1200 }} today={today} /></MemoryRouter>,
			{ wrapper: TestQueryProvider },
		)
		expect(screen.getByRole("button", { name: "Course map" })).toBeInTheDocument()
		unmount()
		render(<MemoryRouter><RaceEventCard event={{ ...meeting, course: null }} today={today} /></MemoryRouter>)
		expect(screen.queryByRole("button", { name: "Course map" })).toBeNull()
	})
})
