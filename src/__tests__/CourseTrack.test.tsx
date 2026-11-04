/**
 * The track view (components/course/CourseTrack.tsx) and the switches that
 * reach it (CourseSection): callouts in words beside the track, one per spot,
 * and Strip | Track | Both, Real shape | Schematic (the real shape fetched
 * once a track is shown).
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import CourseSection from "../components/course/CourseSection"
import CourseTrack from "../components/course/CourseTrack"
import { TestQueryProvider } from "../test/TestQueryProvider"
import { schematicShape } from "../utils/courseSchematic"
import { CHUKYO_1200, NAKAYAMA_3600, TOKYO_DIRT_1600 } from "./courseFixtures"

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
		for (const words of ["Corner 3", "Corner 4", "Final straight", "Spurt starts", "Position keep ends", "Halfway", "Downhill 1%", "Uphill 2%", "Start", "Goal"]) {
			expect(screen.getByText(words)).toBeInTheDocument()
		}
	})

	it("draws the direction arrow beside the gate and keeps the track clean of leader dots (Henry, 2026-11-03)", () => {
		const { container } = render(<CourseTrack course={CHUKYO_1200} shape={schematicShape(CHUKYO_1200)} />)
		expect(container.querySelector('polygon[data-course="direction"]')).not.toBeNull()
		// Leaders used to put a dot on the track at each spot; now they start a
		// kerb's half-width out and nothing sits on the track.
		expect(container.querySelectorAll("g[stroke] > circle")).toHaveLength(0)
	})

	it("marks each lit skill with its icon at its arc's start and reports the arc under the pointer", () => {
		const onPreview = vi.fn()
		const overlays = {
			spans: [
				{ key: "a", start: 300, end: 500, kind: "fixed" as const, label: "Final Push", group: "lit", image: "/skills/push.png" },
				{ key: "b", start: 700, end: 900, kind: "random" as const, label: "No name chip", group: "lit" },
			],
			markers: [],
		}
		const { container } = render(<CourseTrack course={CHUKYO_1200} shape={schematicShape(CHUKYO_1200)} overlays={overlays} onPreview={onPreview} />)
		// An icon for the span with one; a name chip for the span without.
		expect(container.querySelector('[data-layer-icon="Final Push"] image')).toHaveAttribute("href", "/skills/push.png")
		expect(screen.queryByText("Final Push", { selector: "b" })).toBeNull()
		expect(screen.getByText("No name chip", { selector: "b" })).toBeInTheDocument()
		fireEvent.mouseEnter(container.querySelector('[data-layer-icon="Final Push"]') as Element)
		expect(onPreview).toHaveBeenLastCalledWith("a")
		fireEvent.mouseEnter(container.querySelectorAll("polyline[stroke]")[container.querySelectorAll("polyline[stroke]").length - 1] as Element)
		expect(onPreview).toHaveBeenLastCalledWith("b")
		fireEvent.mouseLeave(container.querySelector('[data-layer-icon="Final Push"]') as Element)
		expect(onPreview).toHaveBeenLastCalledWith(null)
	})

	it("draws the previewed layer span bolder and quietens the rest (the strip's hover, Both view)", () => {
		const overlays = {
			spans: [
				{ key: "a", start: 300, end: 500, kind: "fixed" as const, label: "A", group: "lit" },
				{ key: "b", start: 700, end: 900, kind: "random" as const, label: "B", group: "lit" },
			],
			markers: [],
		}
		const { container, rerender } = render(<CourseTrack course={CHUKYO_1200} shape={schematicShape(CHUKYO_1200)} overlays={overlays} preview="a" />)
		expect(container.querySelectorAll("polyline[data-preview]")).toHaveLength(1)
		expect(container.querySelectorAll('polyline[opacity="0.25"]')).toHaveLength(1)
		// A key the track doesn't hold (the strip's carry-over band, say) quietens nothing.
		rerender(<CourseTrack course={CHUKYO_1200} shape={schematicShape(CHUKYO_1200)} overlays={overlays} preview="elsewhere" />)
		expect(container.querySelectorAll('polyline[opacity="0.25"]')).toHaveLength(0)
	})

	it("calls out where the ground changes, and keeps the spurt on a phone's compact track", () => {
		const { unmount } = render(<CourseTrack course={TOKYO_DIRT_1600} shape={schematicShape(TOKYO_DIRT_1600)} />)
		expect(screen.getByText("Dirt from here")).toBeInTheDocument()
		unmount()
		render(<CourseTrack course={CHUKYO_1200} shape={schematicShape(CHUKYO_1200)} widthPx={340} compact />)
		expect(screen.getByText("Spurt starts")).toBeInTheDocument()
		expect(screen.queryByText("Position keep ends")).toBeNull()
	})

	it("gives a corner the course passes twice one callout with both laps' metres (Nakayama 3600)", () => {
		render(<CourseTrack course={NAKAYAMA_3600} shape={schematicShape(NAKAYAMA_3600)} />)
		expect(screen.getAllByText("Corner 1")).toHaveLength(1)
		expect(screen.getByText("290m, 1,975m")).toBeInTheDocument()
	})

	it("gives each straight one callout with every lap's start metres (Nakayama 3600)", () => {
		render(<CourseTrack course={NAKAYAMA_3600} shape={schematicShape(NAKAYAMA_3600)} />)
		// The back straight on both laps; the first lap's home straight; the
		// final straight keeps its own callout, at where it starts.
		expect(screen.getByText("790m, 2,475m")).toBeInTheDocument()
		expect(screen.getByText("1,615m")).toBeInTheDocument()
		expect(screen.getByText("3,290m")).toBeInTheDocument()
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

	it("shows the track and the strip together under Both", async () => {
		serveShape(null)
		const { container } = render(<CourseSection course={CHUKYO_1200} />, { wrapper: TestQueryProvider })
		const strips = () => container.querySelectorAll('[data-band="track"]').length
		// The phone's strip is always in the page (CSS hides it), so the
		// desktop strip makes it two.
		expect(strips()).toBe(2)
		fireEvent.click(screen.getByRole("button", { name: "Track" }))
		await waitFor(() => expect(strips()).toBe(1))
		// The track alone brings its legend (owner, 2026-11-03); with the strip
		// under it, the strip's words name every colour.
		expect(screen.getByRole("list", { name: "Track legend" })).toBeInTheDocument()
		fireEvent.click(screen.getByRole("button", { name: "Both" }))
		await waitFor(() => expect(container.querySelector("svg polyline")).not.toBeNull())
		await waitFor(() => expect(strips()).toBe(2))
		expect(screen.queryByRole("list", { name: "Track legend" })).toBeNull()
		fireEvent.click(screen.getByRole("button", { name: "Strip" }))
		await waitFor(() => expect(strips()).toBe(2))
		expect(screen.queryByRole("list", { name: "Track legend" })).toBeNull()
	})

	it("has no Walk the course button (shelved, owner 2026-11-03)", () => {
		serveShape(null)
		render(<CourseSection course={CHUKYO_1200} />, { wrapper: TestQueryProvider })
		expect(screen.queryByRole("button", { name: "Walk the course" })).toBeNull()
	})

	it("drops the corner chips from a two-lap course's compact track (Nakayama 3600)", () => {
		render(<CourseTrack course={NAKAYAMA_3600} shape={schematicShape(NAKAYAMA_3600)} widthPx={340} compact />)
		expect(screen.getByText("Spurt starts")).toBeInTheDocument()
		expect(screen.getByText("Final straight")).toBeInTheDocument()
		expect(screen.queryByText("Corner 1")).toBeNull()
	})

	it("draws the compact track over the strip on a phone, fetching the shape right away", async () => {
		// A phone-wide screen, read in an effect (owner, 2026-11-03).
		vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
		const fetchMock = serveShape(schematicShape(CHUKYO_1200))
		render(<CourseSection course={CHUKYO_1200} />, { wrapper: TestQueryProvider })
		await waitFor(() => expect(fetchMock).toHaveBeenCalled())
		// Each strip has a "Spurt starts" mark, the desktop one and the phone
		// one both being in the page. The compact track is bare until tapped
		// (Henry, 2026-11-04); its chip then makes three. The phase band is the
		// other name, "Last spurt".
		const tap = await screen.findByRole("button", { name: "Show the track's labels" })
		expect(screen.getAllByText("Spurt starts")).toHaveLength(2)
		fireEvent.click(tap)
		await waitFor(() => expect(screen.getAllByText("Spurt starts")).toHaveLength(3))
		expect(screen.getAllByText("Last spurt")).toHaveLength(2)
		expect(screen.queryByText("Position keep ends", { selector: "b" })).toBeNull()
	})
})
