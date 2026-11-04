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

	it("trusts the API's odds for a fixed point a few metres either side of the start", () => {
		// Encroaching Shadow on Tokyo turf 1600 opens 8 m into the late race, inside the window.
		expect(grade(place({ fires_at: 1075, spurt: { from: 8, to: 8, odds: 1 } }))).toEqual({ word: "At the spurt", tone: "great" })
		// Louder! Tracen Cheer! on CM 21 opens 12 m before it and still lands well.
		expect(grade(place({ fires_at: 788, spurt: { from: -12, to: -12, odds: 1 } }))).toEqual({ word: "At the spurt", tone: "great" })
		// Sunny Breeze on Tokyo turf 1600: 80 m early, waiting on 2nd place, is still "ready".
		expect(grade(place({ fires_at: 987, needs: ["In 2nd place"], spurt: { from: -80, to: -80, odds: 1 } }))).toEqual({ word: "Ready before it", tone: "good" })
		expect(grade(place({ fires_at: 1690, spurt: { from: 357, to: 357, odds: 0 } }))).toEqual({ word: "Late", tone: "poor" })
	})

	it("grades a random point that can't reach the window by where it lies", () => {
		// Wisdom of the Sea, an early-race accel; Final Push on Nakayama 2000, a final corner after the start.
		expect(grade(place({ spread: [0, 100], spurt: { from: -800, to: -700, odds: 0 } }))).toEqual({ word: "Early", tone: "poor" })
		expect(grade(place({ spread: [1450, 1690], spurt: { from: 117, to: 357, odds: 0 } }))).toEqual({ word: "Late", tone: "poor" })
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
