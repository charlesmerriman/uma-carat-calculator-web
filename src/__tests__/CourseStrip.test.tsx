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

	it("draws four phases, phase 3 (the final sixth) a band of its own, each with its metres", () => {
		const { container } = render(<CourseStrip course={CHUKYO_1200} />)
		const phases = [...band(container, "phases").children] as HTMLElement[]
		expect(phases.map((phase) => [phase.textContent, Math.round(parseFloat(phase.style.left))])).toEqual([
			["Early-race0–200m", 0], ["Mid-race200–800m", 17], ["Late-race800–1,000m", 67], ["Last spurt1,000–1,200m", 83],
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

	it("labels the marks with their metres, the spurt first in the brand colour", () => {
		const { container } = render(<CourseStrip course={CHUKYO_1200} />)
		const markers = within(band(container, "markers"))
		expect(markers.getByText("Last spurt")).toHaveClass("font-extrabold")
		expect(markers.getByText("Position keep ends")).toBeInTheDocument()
		expect(markers.getByText("800m")).toBeInTheDocument()
		expect(markers.getByText("Halfway")).toBeInTheDocument()
	})

	it("shows the ground row only where the ground changes (Tokyo dirt 1600's turf start)", () => {
		const { container, unmount } = render(<CourseStrip course={TOKYO_DIRT_1600} />)
		expect(band(container, "ground")).not.toBeNull()
		expect(within(band(container, "ground")).getByText("Dirt")).toBeInTheDocument()
		unmount()
		const chukyo = render(<CourseStrip course={CHUKYO_1200} />)
		expect(band(chukyo.container, "ground")).toBeNull()
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
