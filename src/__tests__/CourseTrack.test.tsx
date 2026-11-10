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
import { shapeBounds, withLapRings } from "../utils/courseGeometry"
import { CHUKYO_1200, NAKAYAMA_2500, NAKAYAMA_3600, TOKYO_DIRT_1600 } from "./courseFixtures"

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

	it("leaves out where the ground changes, and keeps the spurt on a phone's compact track", () => {
		// The race counts as its own surface from the gate (Daptrius, 2026-11-09).
		const { unmount } = render(<CourseTrack course={TOKYO_DIRT_1600} shape={schematicShape(TOKYO_DIRT_1600)} />)
		expect(screen.queryByText("Dirt from here")).toBeNull()
		unmount()
		render(<CourseTrack course={CHUKYO_1200} shape={schematicShape(CHUKYO_1200)} widthPx={340} compact />)
		expect(screen.getByText("Spurt starts")).toBeInTheDocument()
		expect(screen.queryByText("Position keep ends")).toBeNull()
	})

	it("turns the corner and straight icons the way the track runs, snapped to 22.5 degrees, and keeps hills upright (Daptrius, 2026-11-04)", () => {
		// One point per metre: heading left (-x) to 400 m, down (+y) to 700 m,
		// then right (+x) to the goal. Corner 3 starts at 300 m heading left; the
		// final straight starts at 788 m heading right.
		const shape: [number, number][] = []
		for (let metre = 0; metre <= 1200; metre++) {
			if (metre <= 400) shape.push([400 - metre, 0])
			else if (metre <= 700) shape.push([0, metre - 400])
			else shape.push([metre - 700, 300])
		}
		const { container } = render(<CourseTrack course={CHUKYO_1200} shape={shape} />)
		// Heading left is 180 degrees; the corner arrow starts heading up, so +90.
		expect(container.querySelector('[data-course-icon="cornerLeft"]')).toHaveStyle({ transform: "rotate(270deg)" })
		// The final straight points right already: no turn at all.
		expect(container.querySelector('[data-course-icon="finalStraight"]')).not.toHaveAttribute("style")
		for (const hill of container.querySelectorAll('[data-course-icon="uphill"], [data-course-icon="downhill"]')) {
			expect(hill).not.toHaveAttribute("style")
		}
	})

	it("gives a corner the course passes twice one callout with both laps' metres (Nakayama 3600)", () => {
		render(<CourseTrack course={NAKAYAMA_3600} shape={schematicShape(NAKAYAMA_3600)} />)
		expect(screen.getAllByText("Corner 1")).toHaveLength(1)
		expect(screen.getByText("290m, 1,975m")).toBeInTheDocument()
	})

	it("gives each straight one callout with every lap's start metres (Nakayama 3600)", () => {
		render(<CourseTrack course={NAKAYAMA_3600} shape={schematicShape(NAKAYAMA_3600)} />)
		// The back straight on both laps.
		expect(screen.getByText("790m, 2,475m")).toBeInTheDocument()
		// The first lap's home straight is the final straight's ground: one chip
		// for both (owner, 2026-11-06), not "Straight 1,615m" beside it.
		expect(screen.getByText("3,290m (1,615m a lap before)")).toBeInTheDocument()
		expect(screen.queryByText("1,615m")).not.toBeInTheDocument()
		expect(screen.getAllByText("Straight")).toHaveLength(1)
	})

	it("gives a hill run on all three passes of the home straight one chip and one bracket (Nakayama 3600)", () => {
		render(<CourseTrack course={NAKAYAMA_3600} shape={schematicShape(NAKAYAMA_3600)} />)
		// The gate's straight, lap one and the final straight each climb 2% at
		// one spot. The third pass sits two rings out, which used to split it off.
		expect(screen.getAllByText("Uphill 2%")).toHaveLength(1)
		expect(screen.getByText("40m, 1,740m, 3,425m")).toBeInTheDocument()
		// One merged hill is one bracket too: the third pass's own bracket and its
		// "3,425–3,535m" chip are gone.
		expect(screen.queryByText("3,425–3,535m")).not.toBeInTheDocument()
	})

	it("puts a chip anchored on an inner pass outside the passes beyond it (Nakayama 3600's Start)", () => {
		// Later laps run outside on Nakayama 3600, so the gate is on the
		// innermost of three passes along the bottom; its chip used to land on
		// the outermost (the red final straight). Now it sits below all three.
		// The live course draws later laps outside (the fixture's default is inside).
		const course = { ...NAKAYAMA_3600, later_laps: "outside" as const }
		const base = schematicShape(course)
		render(<CourseTrack course={course} shape={base} />)
		// The box the component draws in, the same way it builds it.
		const bounds = shapeBounds(base)
		const size = Math.max(bounds.width, bounds.height)
		const ringed = withLapRings(base, course, size * 0.045)
		const ringedBox = shapeBounds(ringed)
		const pad = size * 0.17
		// The outermost pass under the gate: the lowest point of the final
		// straight (the race's last 300 m, all on the bottom), as a page %.
		const outerY = Math.max(...ringed.slice(920).map(([, y]) => y))
		const boxTop = ringedBox.minY - pad
		const boxHeight = ringedBox.height + 2 * pad
		const boxWidth = ringedBox.width + 2 * pad
		// The chip's top edge (its centre less half its 24 px, in a 1000 px box)
		// must clear the pass's outer edge (half the track, 2% of the box, out).
		const chip = screen.getByText("Start").closest("div") as HTMLElement
		const chipTop = boxTop + (parseFloat(chip.style.top) / 100) * boxHeight - 12 * (boxWidth / 1000)
		expect(chipTop).toBeGreaterThan(outerY + boxWidth * 0.01)
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

	it("keeps the hills on a phone's compact track, as their triangle and percent, bare or with words (Henry, 2026-11-06)", () => {
		// Chukyo 1200: Downhill 1% from 100 m, Uphill 2% from 875 m.
		const { container, unmount } = render(<CourseTrack course={CHUKYO_1200} shape={schematicShape(CHUKYO_1200)} widthPx={340} compact />)
		expect(screen.getByText("1%")).toBeInTheDocument()
		expect(screen.getByText("2%")).toBeInTheDocument()
		expect(screen.queryByText("Downhill 1%")).toBeNull()
		expect(container.querySelector('[data-course-icon="downhill"]')).not.toBeNull()
		unmount()
		const bare = render(<CourseTrack course={CHUKYO_1200} shape={schematicShape(CHUKYO_1200)} widthPx={340} compact showWords={false} />)
		expect(bare.container.querySelector('[data-course-icon="uphill"]')).not.toBeNull()
		expect(bare.container.querySelector('[data-course-icon="downhill"]')).not.toBeNull()
		expect(screen.queryByText("2%")).toBeNull()
	})

	it("gives a corner number met at two different spots two callouts (Nakayama 2500's chute, Daptrius 2026-11-06)", () => {
		// The race starts on a chute that joins corner 3 partway round (100 m);
		// the next lap's corner 3 starts at its own entry (1,700 m), elsewhere.
		render(<CourseTrack course={NAKAYAMA_2500} shape={schematicShape(NAKAYAMA_2500)} />)
		expect(screen.getAllByText("Corner 3")).toHaveLength(2)
		expect(screen.getByText("100m")).toBeInTheDocument()
		expect(screen.getByText("1,700m")).toBeInTheDocument()
	})

	it("colours the track by corners and straights on request (Daptrius, 2026-11-06)", () => {
		const strokes = (container: HTMLElement) => [...container.querySelectorAll("polyline")].map((line) => line.getAttribute("stroke"))
		const { container, unmount } = render(<CourseTrack course={CHUKYO_1200} shape={schematicShape(CHUKYO_1200)} />)
		expect(strokes(container)).toContain("var(--color-course-early)")
		expect(strokes(container)).not.toContain("var(--color-course-corner)")
		unmount()
		const byCourse = render(<CourseTrack course={CHUKYO_1200} shape={schematicShape(CHUKYO_1200)} colours="course" />)
		expect(strokes(byCourse.container)).toContain("var(--color-course-corner)")
		expect(strokes(byCourse.container)).toContain("var(--color-course-straight-final)")
		expect(strokes(byCourse.container)).not.toContain("var(--color-course-early)")
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

	it("switches a phone's track between phase and course colours, outside the track's tap target", async () => {
		vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
		serveShape(schematicShape(CHUKYO_1200))
		render(<CourseSection course={CHUKYO_1200} />, { wrapper: TestQueryProvider })
		const colours = await screen.findByRole("group", { name: "Track colours" })
		fireEvent.click(within(colours).getByRole("button", { name: "Course" }))
		expect(within(colours).getByRole("button", { name: "Course" })).toHaveAttribute("aria-pressed", "true")
		// Choosing colours didn't also show the track's labels.
		expect(screen.getByRole("button", { name: "Show the track's labels" })).toBeInTheDocument()
		expect(localStorage.getItem("uma-course-map-colours")).toBe("course")
		fireEvent.click(within(colours).getByRole("button", { name: "Phase" }))
	})
})
