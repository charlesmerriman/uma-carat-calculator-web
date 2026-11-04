/**
 * The track view (components/course/CourseTrack.tsx) and the switches that
 * reach it (CourseSection): callouts in words beside the track, one per spot,
 * and Strip | Track, Real shape | Schematic (the real shape fetched once Track
 * is chosen), Walk the course.
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import CourseSection from "../components/course/CourseSection"
import CourseTrack from "../components/course/CourseTrack"
import { TestQueryProvider } from "../test/TestQueryProvider"
import { schematicShape } from "../utils/courseSchematic"
import { CHUKYO_1200, NAKAYAMA_3600 } from "./courseFixtures"

/** The shape endpoint answers with `shape` (null: a course with no path file). */
function serveShape(shape: readonly (readonly [number, number])[] | null) {
	const fetchMock = vi.fn(async () => new Response(JSON.stringify({ shape })))
	vi.stubGlobal("fetch", fetchMock)
	return fetchMock
}

afterEach(() => vi.unstubAllGlobals())

describe("CourseTrack", () => {
	it("calls out the corners, the final straight, the markers, the hills, the start and the goal", () => {
		render(<CourseTrack course={CHUKYO_1200} shape={schematicShape(CHUKYO_1200)} />)
		for (const words of ["Corner 3", "Corner 4", "Final straight", "Last spurt can start here", "Position keep ends", "Downhill 1%", "Uphill 2%", "Start", "Goal"]) {
			expect(screen.getByText(words)).toBeInTheDocument()
		}
	})

	it("gives a corner the course passes twice one callout with both laps' metres (Nakayama 3600)", () => {
		render(<CourseTrack course={NAKAYAMA_3600} shape={schematicShape(NAKAYAMA_3600)} />)
		expect(screen.getAllByText("Corner 1")).toHaveLength(1)
		expect(screen.getByText("290m, 1,975m")).toBeInTheDocument()
	})
})

describe("CourseSection's switches", () => {
	it("opens on the strip, and Track swaps in the track view", () => {
		serveShape(null)
		const { container } = render(<CourseSection course={CHUKYO_1200} />, { wrapper: TestQueryProvider })
		const bar = within(screen.getByRole("group", { name: "Map view" }))
		expect(bar.getByRole("button", { name: "Strip" })).toHaveAttribute("aria-pressed", "true")
		expect(container.querySelector('[data-band="track"]')).not.toBeNull()
		fireEvent.click(bar.getByRole("button", { name: "Track" }))
		expect(bar.getByRole("button", { name: "Track" })).toHaveAttribute("aria-pressed", "true")
	})

	it("fetches the real shape only once Track is chosen", async () => {
		const fetchMock = serveShape(schematicShape(CHUKYO_1200))
		render(<CourseSection course={CHUKYO_1200} />, { wrapper: TestQueryProvider })
		expect(fetchMock).not.toHaveBeenCalled()
		fireEvent.click(screen.getByRole("button", { name: "Track" }))
		const shapes = within(await screen.findByRole("group", { name: "Track shape" }))
		expect(shapes.getByRole("button", { name: "Real shape" })).toHaveAttribute("aria-pressed", "true")
		expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(`/race-courses/${CHUKYO_1200.id}/shape`), expect.anything())
	})

	it("offers no Real shape | Schematic for a course with no path file", async () => {
		const fetchMock = serveShape(null)
		const { container } = render(<CourseSection course={CHUKYO_1200} />, { wrapper: TestQueryProvider })
		fireEvent.click(screen.getByRole("button", { name: "Track" }))
		// The answer comes back empty, and the track is drawn as the schematic, with no toggle.
		await waitFor(() => expect(fetchMock).toHaveBeenCalled())
		await waitFor(() => expect(container.querySelector("svg polyline")).not.toBeNull())
		expect(screen.queryByRole("group", { name: "Track shape" })).toBeNull()
	})

	it("has a Walk the course button that turns into Stop", () => {
		serveShape(null)
		render(<CourseSection course={CHUKYO_1200} />, { wrapper: TestQueryProvider })
		fireEvent.click(screen.getByRole("button", { name: "Walk the course" }))
		expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument()
	})
})
