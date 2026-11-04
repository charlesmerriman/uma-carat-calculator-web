/**
 * An accel's grade against the late-race start (utils/courseLayers.ts grade;
 * notes/course-map-visual-plan.md): the owner's words, with the odds beside
 * a random point's.
 */
import { describe, expect, it } from "vitest"
import { grade, type SkillZoneEntry } from "../utils/courseLayers"

const place = (extra: Partial<SkillZoneEntry>): SkillZoneEntry => ({
	kind: "place", zones: [{ start: 550, end: 788, kind: "random" }], styles: null, effects: ["accel"], ...extra,
})

describe("grade", () => {
	it("grades a fixed zone by where it opens, and whether it waits on a placing", () => {
		// No Stopping Me! on CM 21: opens as the late race starts.
		expect(grade(place({ fires_at: 800, spurt: { from: 0, to: 0, odds: 1 } }))).toEqual({ word: "At the spurt", tone: "great" })
		// Sunny Breeze: opens 131 m early but waits on a placing, so it can still land at the start.
		expect(grade(place({ fires_at: 669, needs: ["In 2nd place"], spurt: { from: -131, to: -131 } }))).toEqual({ word: "Ready before it", tone: "good" })
		// Red Shift: opens 250 m early with nothing to wait for.
		expect(grade(place({ fires_at: 550, spurt: { from: -250, to: -250 } }))).toEqual({ word: "Early", tone: "poor" })
		expect(grade(place({ fires_at: 900, spurt: { from: 100, to: 100 } }))).toEqual({ word: "Late", tone: "poor" })
	})

	it("grades a random point by its odds, kept beside the word", () => {
		// Final Push on CM 21: 22%.
		expect(grade(place({ spread: [550, 788], spurt: { from: -250, to: -12, odds: 0.22 } }))).toEqual({ word: "Sometimes lands", tone: "ok", odds: 0.22 })
		expect(grade(place({ spread: [800, 900], spurt: { from: 0, to: 100, odds: 0.5 } }))).toEqual({ word: "Usually lands", tone: "good", odds: 0.5 })
		expect(grade(place({ spread: [800, 850], spurt: { from: 0, to: 50, odds: 0.95 } }))).toEqual({ word: "At the spurt", tone: "great", odds: 0.95 })
		expect(grade(place({ spread: [300, 788], spurt: { from: -500, to: -12, odds: 0.1 } }))).toEqual({ word: "Rarely lands", tone: "poor", odds: 0.1 })
	})

	it("grades nothing without a verdict, for a non-accel, or while the odds are unconfirmed", () => {
		expect(grade(undefined)).toBeNull()
		expect(grade(place({ effects: ["heal"], fires_at: 200, spurt: { from: -600, to: -600 } }))).toBeNull()
		expect(grade(place({ spread: [550, 788], spurt: { from: -250, to: -12 } }))).toBeNull()
		expect(grade(place({ unreadable: true, fires_at: 800, spurt: { from: 0, to: 0 } }))).toBeNull()
	})
})
