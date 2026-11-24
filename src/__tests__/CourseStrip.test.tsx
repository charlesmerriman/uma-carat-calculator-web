/**
 * The course strip (components/course/CourseStrip.tsx) and the block that
 * holds it in a guide's header (CourseSection): rows at the right places,
 * words on the segments, the marks, the phone's vertical strip, the headline
 * that reads the course off, and the same course in words for screen readers.
 */
import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import CourseSection from "../components/course/CourseSection"
import CourseStrip from "../components/course/CourseStrip"
import { segmentText } from "../utils/courseStripText"
import { TestQueryProvider } from "../test/TestQueryProvider"
import { CHUKYO_1200, SANTA_ANITA_2400, TOKYO_DIRT_1600 } from "./courseFixtures"

/** The segment that holds a label. */
function segment(label: string) {
	return screen.getByText(label).parentElement as HTMLElement
}

/** A row's track cell (the segments' box), by its band name. */
function band(container: HTMLElement, name: string) {
	return container.querySelector(`[data-band="${name}"]`) as HTMLElement
}

describe("CourseStrip, across the page", () => {
	it("draws Chukyo 1200's straights and corners at their share of the race", () => {
		render(<CourseStrip course={CHUKYO_1200} />)
		expect(segment("Corner 3").style.left).toBe("25%")
		expect(parseFloat(segment("Corner 3").style.width)).toBeCloseTo(20.833, 2)
		expect(parseFloat(segment("Final straight").style.left)).toBeCloseTo(65.667, 2)
		expect(segment("Downhill 1%")).toBeInTheDocument()
		expect(segment("Uphill 2%")).toBeInTheDocument()
	})

	it("draws four phases, phase 3 (the final sixth) a band of its own, each with the metres that fit", () => {
		const { container } = render(<CourseStrip course={CHUKYO_1200} />)
		const phases = [...band(container, "phases").children] as HTMLElement[]
		// A sixth of a 1,000px strip is about 166px: room for "Late-race" and
		// its end metre, not its whole range, and none beside "Last spurt",
		// whose range was drawn over its words until review item 7.
		expect(phases.map((phase) => [phase.textContent, Math.round(parseFloat(phase.style.left))])).toEqual([
			["Early-race0–200m", 0], ["Mid-race200–800m", 17], ["Late-race1,000m", 67], ["Last spurt", 83],
		])
	})

	it("shows a stretch's metres only where they fit beside its words", () => {
		// Chukyo's corner 3, 250 of 1,200 m: both metres. Its 100 m uphill
		// (8%): the triangle and the words leave no room for metres at all.
		const { container } = render(<CourseStrip course={CHUKYO_1200} />)
		const hills = within(band(container, "hills"))
		expect(hills.queryByText("875–975m")).toBeNull()
		expect(hills.queryByText("975m")).toBeNull()
		expect(within(band(container, "track")).getByText("300–550m")).toBeInTheDocument()
	})

	it("names each row in the label column", () => {
		const { container } = render(<CourseStrip course={CHUKYO_1200} />)
		for (const name of ["Height", "Phase", "Course", "Slope", "Section"]) expect(within(container).getByText(name)).toBeInTheDocument()
	})

	it("lights the bar previewed elsewhere, quietens the rest, and draws a span's icon before its name", () => {
		const overlays = {
			spans: [
				{ key: "a", start: 300, end: 500, kind: "fixed" as const, label: "Final Push", lane: 0, image: "/skills/push.png" },
				{ key: "b", start: 700, end: 900, kind: "random" as const, label: "Neck and Neck", lane: 1 },
			],
			markers: [],
		}
		const { container } = render(<CourseStrip course={CHUKYO_1200} overlays={overlays} preview="a" />)
		expect(container.querySelectorAll('[data-previewed="true"]')).toHaveLength(1)
		expect(container.querySelectorAll('[data-previewed="false"]')).toHaveLength(1)
		expect(within(band(container, "layers")).getByText("Final Push").querySelector("img")).toHaveAttribute("src", "/skills/push.png")
	})

	it("labels the marks with their metres, the spurt first in the brand colour", () => {
		const { container } = render(<CourseStrip course={CHUKYO_1200} />)
		const markers = within(band(container, "markers"))
		expect(markers.getByText("Spurt starts")).toHaveClass("font-extrabold")
		expect(markers.getByText("Position keep ends")).toBeInTheDocument()
		expect(markers.getByText("800m")).toBeInTheDocument()
		expect(markers.getByText("Halfway")).toBeInTheDocument()
	})

	it("draws no ground row, even where the course changes surface (Tokyo dirt 1600's turf start)", () => {
		// The race counts as its own surface from the gate (Daptrius, 2026-11-09).
		const { container } = render(<CourseStrip course={TOKYO_DIRT_1600} />)
		expect(band(container, "ground")).toBeNull()
		expect(screen.queryByText("Turf start")).toBeNull()
	})

	it("draws no profile and no hills on a flat course (Funabashi dirt 1600)", () => {
		const { container } = render(<CourseStrip course={{ ...CHUKYO_1200, slopes: [] }} />)
		expect(band(container, "elevation")).toBeNull()
		expect(band(container, "hills")).toBeNull()
		expect(band(container, "track")).not.toBeNull()
	})

	it("calls corner -1 plain Corner and draws nothing in the gap before it (Santa Anita 2400)", () => {
		const { container } = render(<CourseStrip course={SANTA_ANITA_2400} />)
		expect(parseFloat(segment("Corner").style.left)).toBeCloseTo(8.333, 2)
		const track = band(container, "track")
		expect([...track.children].some((child) => (child as HTMLElement).style.left === "0%")).toBe(false)
	})

	it("colours a layer's spans in their own colour, the lit skill's by default", () => {
		const { container } = render(
			<CourseStrip
				course={CHUKYO_1200}
				overlays={{
					spans: [
						{ start: 550, end: 788, kind: "random", label: "Final Push", lane: 0 },
						{ start: 300, end: 550, kind: "fixed", label: "Swinging Maestro", lane: 1, colour: "var(--color-course-vet-1)" },
					],
					markers: [],
				}}
				laneHeads={[{ key: "spot-1", firstLane: 1, lanes: 1, head: <span>avatar</span>, colour: "var(--color-course-vet-1)" }]}
			/>,
		)
		const layers = band(container, "layers")
		expect(within(layers).getByText("Lit")).toBeInTheDocument()
		expect(within(layers).getByText("avatar")).toBeInTheDocument()
		const maestro = within(layers).getByText("Swinging Maestro").parentElement as HTMLElement
		expect(maestro.style.background).toBe("var(--color-course-vet-1)")
	})

	it("paints the finished strip first: the draw-in only ever runs after mount", () => {
		const { container } = render(<CourseStrip course={CHUKYO_1200} />)
		const reveal = container.querySelector("[data-strip-rows]") as HTMLElement
		expect(reveal.style.clipPath).toBe("inset(0 0% 0 0)")
	})

	it("hides the drawing from screen readers", () => {
		const { container } = render(<CourseStrip course={CHUKYO_1200} />)
		expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true")
	})
})

describe("CourseStrip variants", () => {
	it("vertical: the race runs down the page, the marks named in the margin", () => {
		const { container } = render(<CourseStrip course={CHUKYO_1200} orientation="vertical" />)
		expect(segment("Corner 3").style.top).toBe("25%")
		expect(segment("Corner 3").style.left).toBe("")
		expect(within(band(container, "markers")).getByText("Halfway")).toBeInTheDocument()
	})
})

describe("CourseSection", () => {
	it("names the course, leads with the spurt and says it all in words", () => {
		render(<CourseSection course={CHUKYO_1200} />, { wrapper: TestQueryProvider })
		expect(screen.getByText("Chukyo turf 1,200m, left-handed")).toBeInTheDocument()
		const headline = screen.getByLabelText("Read off the course")
		expect(headline).toHaveTextContent("Last spurt can start on the final straight, 12m into it")
		expect(headline).toHaveTextContent("Final straight 412m")
		expect(screen.getByText("Corner 3 from 300m to 550m")).toBeInTheDocument()
		expect(screen.getByText("Late-race from 800m to 1,000m")).toBeInTheDocument()
		expect(screen.getByText("Last spurt from 1,000m to the finish")).toBeInTheDocument()
		expect(screen.getByText("Last spurt: 800m")).toBeInTheDocument()
	})
})

describe("segmentText: a stretch's metres never run into its words (review item 7)", () => {
	// Tokyo dirt 1600's corner 3, 650 to 875m: 14% of the race.
	const corner = { start: 650, end: 875, distance: 1600, vertical: false, label: "Corner 3", shortLabel: "C3", ranged: true }

	it("drops the metres when the centred words leave no room beside them", () => {
		// The guide at 1,440 with Skills open: about 614px of strip.
		expect(segmentText({ ...corner, stripPx: 614 })).toEqual({ words: "Corner 3", metres: undefined })
	})

	it("keeps the end metre when only that fits, and the range when there's room", () => {
		expect(segmentText({ ...corner, stripPx: 1000 })).toEqual({ words: "Corner 3", metres: "875m" })
		expect(segmentText({ ...corner, stripPx: 1400 })).toEqual({ words: "Corner 3", metres: "650–875m" })
	})

	it("gives a long stretch its whole range", () => {
		expect(segmentText({ start: 0, end: 650, distance: 1600, vertical: false, label: "Straight", ranged: true, stripPx: 614 }).metres).toBe("0–650m")
	})
})
