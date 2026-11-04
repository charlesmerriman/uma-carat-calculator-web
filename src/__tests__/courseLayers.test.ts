/**
 * The course map's layers as overlays (utils/courseLayers.ts): a skill's
 * zones as spans, the style gate, label rows, and the veterans' layer.
 */
import { describe, expect, it } from "vitest"
import { firesForStyle, focusLayer, packLabels, skillSpans, verdictLines, veteranLayer, type SkillZoneEntry, type SkillZoneMap } from "../utils/courseLayers"

const ZONES: SkillZoneMap = {
	"1": { kind: "place", zones: [{ start: 550, end: 788, kind: "random" }], styles: ["front"] },
	"2": { kind: "place", zones: [{ start: 800, end: 1200, kind: "fixed" }], styles: null },
	"3": { kind: "anywhere", zones: [], styles: null },
	"4": { kind: "never", zones: [], styles: null },
	"5": { kind: "place", zones: [{ start: 422, end: 424, kind: "fixed" }], styles: null },
}

describe("skillSpans", () => {
	it("turns zones into labelled spans, anywhere into one span over the course, never into none", () => {
		// An entry without verdict fields has no words for its hover.
		expect(skillSpans(ZONES["1"], 1200, "Final Push")).toEqual([
			{ key: "Final Push-0", start: 550, end: 788, kind: "random", label: "Final Push", lane: 0, detail: "" },
		])
		expect(skillSpans(ZONES["3"], 1200, "Groundwork")).toEqual([
			{ key: "Groundwork-all", start: 0, end: 1200, kind: "anywhere", label: "Groundwork", lane: 0, detail: "Not tied to a place on the course" },
		])
		expect(skillSpans(ZONES["4"], 1200, "Tokyo")).toEqual([])
		expect(skillSpans(undefined, 1200, "Missing")).toEqual([])
	})
})

describe("firesForStyle", () => {
	it("matches the style gate, a runaway counting as a front runner", () => {
		expect(firesForStyle(ZONES["1"], "front")).toBe(true)
		expect(firesForStyle(ZONES["1"], "runaway")).toBe(true)
		expect(firesForStyle(ZONES["1"], "late")).toBe(false)
		expect(firesForStyle(ZONES["2"], "end")).toBe(true)
	})
})

describe("packLabels", () => {
	it("puts a label in the first row it fits, counting its words' width", () => {
		const rows = packLabels([
			{ start: 0, end: 100, labelShare: 0.05 },
			{ start: 50, end: 150, labelShare: 0.05 },
			{ start: 600, end: 700, labelShare: 0.05 },
		], 1200)
		expect(rows).toEqual([0, 1, 0])
	})
})

describe("veteranLayer", () => {
	const names = new Map([[1, "Final Push"], [2, "Late Charge"], [3, "Groundwork"], [5, "Triple 7s"]])

	it("draws each veteran's skills that fire at a place for her style, one group of lanes each", () => {
		const { spans, lanes } = veteranLayer([
			{ key: "spot-0", umaId: 10, style: "late", skillIds: [1, 2, 3, 4] },
			{ key: "spot-1", umaId: 11, style: "front", skillIds: [1, 5] },
		], ZONES, 1200, names, () => true)
		// The late runner: Final Push is a front runner's; Groundwork fires
		// anywhere and the never skill nowhere, so neither is drawn.
		expect(spans.filter((span) => span.lane === 0).map((span) => span.label)).toEqual(["Late Charge"])
		expect(lanes).toEqual([
			{ key: "spot-0", umaId: 10, firstLane: 0, lanes: 1 },
			{ key: "spot-1", umaId: 11, firstLane: 1, lanes: 1 },
		])
		expect(spans.filter((span) => span.lane === 1).map((span) => span.label).sort()).toEqual(["Final Push", "Triple 7s"])
	})

	it("keeps only what the filter keeps (Only the guide's), and skips a veteran left with nothing", () => {
		const { spans, lanes } = veteranLayer([
			{ key: "spot-0", umaId: 10, style: "late", skillIds: [2] },
			{ key: "spot-1", umaId: 11, style: "front", skillIds: [1, 5] },
		], ZONES, 1200, names, (skillId) => skillId === 1)
		expect(spans.map((span) => span.label)).toEqual(["Final Push"])
		expect(lanes.map((lane) => lane.key)).toEqual(["spot-1"])
	})
})

// The API's entries for Chukyo 1200 (late race at 800 m), as skill_verdicts.py
// sends them (notes/course-map-plan-2.md, the CM 21 table).
const FINAL_PUSH: SkillZoneEntry = {
	kind: "place", zones: [{ start: 550, end: 788, kind: "random" }], styles: ["front"],
	effects: ["accel"], spread: [550, 788], spurt: { from: -250, to: -12 }, needs: ["In the lead"],
}
const MAESTRO: SkillZoneEntry = {
	kind: "place", zones: [{ start: 300, end: 550, kind: "random" }], styles: null,
	effects: ["heal"], spread: [300, 550], before_spurt: 1,
}

describe("the verdict in words", () => {
	it("words the CM 21 table", () => {
		expect(verdictLines(FINAL_PUSH, 1200)).toEqual([
			"At a random point 12m to 250m before the last spurt starts",
			"Also needs: in the lead",
		])
		expect(verdictLines({
			kind: "place", zones: [{ start: 800, end: 1200, kind: "fixed" }], styles: null,
			effects: ["accel"], fires_at: 800, spurt: { from: 0, to: 0 },
		}, 1200)).toEqual(["Fires as the last spurt starts"])
		// Rule 1 with a placing: from 550 m on, once it holds.
		expect(verdictLines({
			kind: "place", zones: [{ start: 550, end: 1200, kind: "fixed" }], styles: null,
			effects: ["accel"], fires_at: 550, spurt: { from: -250, to: -250 }, needs: ["In 5th place or better"],
		}, 1200)[0]).toBe("From 250m before the last spurt starts")
		expect(verdictLines({
			kind: "place", zones: [{ start: 800, end: 900, kind: "random" }], styles: ["pace"],
			effects: ["accel"], spread: [800, 900], spurt: { from: 0, to: 100 },
		}, 1200)).toEqual(["At a random point in the first 100m of the last spurt"])
		expect(verdictLines({ kind: "never", zones: [], styles: null, effects: ["accel"] }, 1200)).toEqual(["Can't fire on this course"])
		expect(verdictLines({ kind: "place", zones: [], styles: null, effects: ["accel"], unreadable: true }, 1200)[0])
			.toBe("Part of its trigger can't be read yet, so there's no timing for it")
	})

	it("adds the odds, repeats and carry-over once the API sends them", () => {
		expect(verdictLines({ ...FINAL_PUSH, spurt: { from: -250, to: -12, odds: 0.16 } }, 1200)).toContain("16% chance to land at the spurt start")
		const corners: SkillZoneEntry = {
			kind: "place", zones: [{ start: 300, end: 788, kind: "random" }], styles: null,
			effects: ["speed"], spread: [300, 788], carry: 0.25, repeats: 3,
		}
		expect(verdictLines(corners, 1200)).toEqual([
			"At a random point from 300m to 788m",
			"25% chance to carry into the last spurt",
			"Can fire up to 3 times here",
		])
	})

	it("judges a heal against the late-race HP check, and an early one by its HP", () => {
		expect(verdictLines(MAESTRO, 1200)).toEqual([
			"At a random point from 300m to 550m",
			"Heals in time, before the late-race HP check",
		])
		expect(verdictLines({ ...MAESTRO, spread: [100, 180], before_spurt: 1 }, 1200)).toContain("Fires in the early race, while HP is still high")
		expect(verdictLines({ ...MAESTRO, spread: [600, 1200], before_spurt: 0.33 }, 1200))
			.toContain("33% chance to heal in time, before the late-race HP check")
	})

	it("keeps an unreadable clause as a plain note after the words it can read", () => {
		expect(verdictLines({ ...FINAL_PUSH, needs: ["In the lead", "Plus a condition we can't read yet"] }, 1200).at(-1))
			.toBe("Also needs: in the lead. Plus a condition we can't read yet")
	})
})

describe("the open skill's layer", () => {
	it("lights the zones with the verdict as their hover words", () => {
		const { spans, markers } = focusLayer(FINAL_PUSH, 1200, "Final Push", 88)
		expect(spans).toHaveLength(1)
		expect(spans[0].detail).toBe("At a random point 12m to 250m before the last spurt starts. Also needs: in the lead")
		expect(markers).toEqual([])
	})

	it("marks the HP check while a heal is lit, and draws a carry-over band when there is one", () => {
		expect(focusLayer(MAESTRO, 1200, "Swinging Maestro", 219).markers).toEqual([
			{ at: 800, kind: "heal-check", label: "Heal before here" },
		])
		const { spans } = focusLayer({ ...FINAL_PUSH, effects: ["speed"], carry_window: [740, 800] }, 1200, "Corner Adept", 7)
		expect(spans.find((span) => span.kind === "window")).toMatchObject({ start: 740, end: 800, lane: 1 })
	})
})
