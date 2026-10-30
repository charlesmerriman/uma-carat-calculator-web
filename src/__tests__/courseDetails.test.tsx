/**
 * The course as four pairs (utils/courseDetails.ts), read from fields an editor
 * types, "TBD" and all, and drawn as four columns by CoursePairs (the Timeline
 * card, the PvP header) and as tiles by the team picture.
 */
import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { CoursePairs } from "../components/timeline/CourseDetails"
import type { RaceEvent } from "../types"
import { announcedCoursePairs, coursePairs } from "../utils/courseDetails"

// Capricorn Cup's fields as the API sends them (CM 21).
const CAPRICORN = {
	id: 21, event_type: "champions_meeting", cm_number: 21, name: "Champions Meeting 21 Capricorn Cup",
	start_date: "2026-10-31T22:00:00Z", end_date: "2026-11-06T21:59:59Z", image: null,
	track: "Chukyo", surface_type: "Turf", distance: "Sprint", length: "1200", direction: "Left",
	track_condition: "Firm", season: "Winter", weather: "Sunny",
} as unknown as RaceEvent

describe("coursePairs", () => {
	it("pairs each headline with what belongs under it", () => {
		expect(coursePairs(CAPRICORN)).toEqual([
			{ label: "Racecourse", value: "Chukyo", detail: "Left-handed" },
			{ label: "Distance", value: "1,200m", detail: "Sprint" },
			{ label: "Surface", value: "Turf", detail: "Firm ground" },
			{ label: "Season", value: "Winter", detail: "Sunny" },
		])
	})

	it("leaves what isn't announced as null, and drops a pair with nothing in it", () => {
		const announced = { ...CAPRICORN, track: "TBD", weather: " ", season: "TBD", length: "TBD", direction: "Left", track_condition: "TBD" } as RaceEvent
		expect(coursePairs(announced)).toEqual([
			{ label: "Racecourse", value: null, detail: "Left-handed" },
			{ label: "Distance", value: "Sprint", detail: null },
			{ label: "Surface", value: "Turf", detail: null },
			{ label: "Season", value: null, detail: null },
		])
		expect(announcedCoursePairs(announced).map((pair) => pair.label)).toEqual(["Racecourse", "Distance", "Surface"])
	})

	it("finds the metres in either field and shows odd values as typed", () => {
		// Real rows: the metres typed as the distance, the band as the length,
		// a "2600m" length, and a direction that isn't one.
		const swapped = { ...CAPRICORN, distance: "2200", length: "Medium", direction: "Straight O", track_condition: "Random" } as RaceEvent
		expect(coursePairs(swapped)).toEqual([
			{ label: "Racecourse", value: "Chukyo", detail: "Straight O" },
			{ label: "Distance", value: "2,200m", detail: "Medium" },
			{ label: "Surface", value: "Turf", detail: "Random" },
			{ label: "Season", value: "Winter", detail: "Sunny" },
		])
		expect(coursePairs({ ...CAPRICORN, length: "2600m", distance: "Long" } as RaceEvent)[1]).toEqual({ label: "Distance", value: "2,600m", detail: "Long" })
	})
})

describe("CoursePairs", () => {
	it("puts each detail under its own title, and TBD where the headline isn't out", () => {
		render(<CoursePairs event={{ ...CAPRICORN, track: "TBD" } as RaceEvent} />)
		const column = (label: string) => within(screen.getByText(label).parentElement as HTMLElement)
		expect(column("Racecourse").getByText("TBD")).toBeInTheDocument()
		expect(column("Racecourse").getByText("Left-handed")).toBeInTheDocument()
		expect(column("Distance").getByText("1,200m")).toBeInTheDocument()
		expect(column("Distance").getByText("Sprint")).toBeInTheDocument()
		expect(column("Season").getByText("Sunny")).toBeInTheDocument()
	})

	it("draws nothing for a course with nothing announced", () => {
		const unknown = { ...CAPRICORN, track: "TBD", surface_type: "TBD", distance: "TBD", length: "TBD", direction: "TBD", track_condition: "TBD", season: "TBD", weather: "TBD" } as RaceEvent
		const { container } = render(<CoursePairs event={unknown} />)
		expect(container).toBeEmptyDOMElement()
	})
})
