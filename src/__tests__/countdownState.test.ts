// @vitest-environment node
//
// The countdown pill's state (data-state on the Timeline's tl-countdown), and
// the one promise it makes: the colour a theme gives a state never disagrees
// with the words getCountdownLabel prints beside it.
import { describe, expect, it } from "vitest"
import { CLOSING_SOON_DAYS, getCountdownLabel, getCountdownState } from "../components/timeline/timelineShared"

// Local noon, so the calendar day is the same in every timezone the tests run in.
const today = new Date(2026, 10, 24, 12, 0, 0)
const day = (offset: number): string => {
	const d = new Date(2026, 10, 24 + offset)
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

describe("getCountdownState", () => {
	it.each([
		{ name: "opens in two weeks", start: 14, end: 28, label: "In 14 Days", state: "upcoming" },
		{ name: "opens tomorrow", start: 1, end: 15, label: "Starts Tomorrow", state: "upcoming" },
		{ name: "opens today", start: 0, end: 14, label: "Starts Today", state: "open" },
		{ name: "running with more than three days left", start: -5, end: 9, label: "Ends in 9 Days", state: "open" },
		{ name: "four days left is not closing yet", start: -5, end: 4, label: "Ends in 4 Days", state: "open" },
		{ name: "three days left", start: -5, end: 3, label: "Ends in 3 Days", state: "closing" },
		{ name: "ends tomorrow", start: -5, end: 1, label: "Ends Tomorrow", state: "closing" },
		{ name: "ends today", start: -5, end: 0, label: "Ends Today", state: "closing" },
		{ name: "ended yesterday", start: -15, end: -1, label: "Ended", state: "ended" },
	])("$name: \"$label\" is $state", ({ start, end, label, state }) => {
		expect(getCountdownLabel(day(start), day(end), today)).toBe(label)
		expect(getCountdownState(day(start), day(end), today)).toBe(state)
	})

	it("calls a window that opens today open, even one short enough to be closing", () => {
		// The pill reads "Starts Today"; a warning colour around those words
		// would contradict them.
		expect(getCountdownLabel(day(0), day(2), today)).toBe("Starts Today")
		expect(getCountdownState(day(0), day(2), today)).toBe("open")
	})

	it("turns closing exactly at the threshold", () => {
		expect(getCountdownState(day(-1), day(CLOSING_SOON_DAYS + 1), today)).toBe("open")
		expect(getCountdownState(day(-1), day(CLOSING_SOON_DAYS), today)).toBe("closing")
	})

	it("has no state when a date is missing, as the label is empty then", () => {
		expect(getCountdownLabel("", day(3), today)).toBe("")
		expect(getCountdownState("", day(3), today)).toBeNull()
	})
})
