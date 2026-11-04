/**
 * The course strip (components/course/CourseStrip.tsx) and the block that
 * holds it in a guide's header (CourseSection): bands at the right places,
 * words on the segments, the markers, the phone's vertical
 * strip, and the same course in words for screen readers.
 */
import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import CourseSection from "../components/course/CourseSection"
import CourseStrip from "../components/course/CourseStrip"
import { TestQueryProvider } from "../test/TestQueryProvider"
import { CHUKYO_1200, SANTA_ANITA_2400, TOKYO_DIRT_1600 } from "./courseFixtures"

/** The band's box: the segment that holds a label. */
function segment(label: string) {
	return screen.getByText(label).parentElement as HTMLElement
}

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

	it("keeps the end metre alone on a stretch too narrow for both", () => {
		// Chukyo's corner 4 is 238 of 1,200 m wide (20%): both. Its corner 3,
		// 250 m: both. A 1,200 m course's 100 m uphill (8%): no metres at all.
		const { container } = render(<CourseStrip course={CHUKYO_1200} />)
		const hills = within(band(container, "hills"))
		expect(hills.queryByText("875–975m")).toBeNull()
		expect(within(band(container, "track")).getByText("300–550m")).toBeInTheDocument()
	})

	it("labels the markers with their metres", () => {
		const { container } = render(<CourseStrip course={CHUKYO_1200} />)
		const markers = within(band(container, "markers"))
		expect(markers.getByText("Last spurt")).toBeInTheDocument()
		expect(markers.getByText("Position keep ends")).toBeInTheDocument()
		expect(markers.getByText("800m")).toBeInTheDocument()
		expect(markers.getByText("Halfway")).toBeInTheDocument()
	})

	it("shows the ground band only where the ground changes (Tokyo dirt 1600's turf start)", () => {
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

	it("paints the finished strip first: the draw-in only ever runs after mount", () => {
		const { container } = render(<CourseStrip course={CHUKYO_1200} />)
		const reveal = band(container, "elevation").parentElement as HTMLElement
		expect(reveal.style.clipPath).toBe("inset(0 0% 0 0)")
	})

	it("hides the drawing from screen readers", () => {
		const { container } = render(<CourseStrip course={CHUKYO_1200} />)
		expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true")
	})
})

describe("CourseStrip variants", () => {
	it("vertical: the race runs down the page", () => {
		render(<CourseStrip course={CHUKYO_1200} orientation="vertical" />)
		expect(segment("Corner 3").style.top).toBe("25%")
		expect(segment("Corner 3").style.left).toBe("")
	})
})

describe("CourseSection", () => {
	it("names the course, reads off the chips and says it all in words", () => {
		render(<CourseSection course={CHUKYO_1200} />, { wrapper: TestQueryProvider })
		expect(screen.getByText("Chukyo turf 1,200m, left-handed")).toBeInTheDocument()
		const chips = within(screen.getByRole("list", { name: "Read off the course" }))
		expect(chips.getByText("Final straight 412m")).toBeInTheDocument()
		expect(screen.getByText("Corner 3 from 300m to 550m")).toBeInTheDocument()
		expect(screen.getByText("Late-race from 800m to 1,000m")).toBeInTheDocument()
		expect(screen.getByText("Last spurt from 1,000m to the finish")).toBeInTheDocument()
		expect(screen.getByText("Last spurt: 800m")).toBeInTheDocument()
	})
})
