/**
 * The course map's layers as overlays (utils/courseLayers.ts): a skill's
 * zones as spans, the style gate, label rows, and the veterans' layer.
 */
import { describe, expect, it } from "vitest"
import { firesForStyle, packLabels, skillSpans, veteranLayer, type SkillZoneMap } from "../utils/courseLayers"

const ZONES: SkillZoneMap = {
	"1": { kind: "place", zones: [{ start: 550, end: 788, kind: "random" }], styles: ["front"] },
	"2": { kind: "place", zones: [{ start: 800, end: 1200, kind: "fixed" }], styles: null },
	"3": { kind: "anywhere", zones: [], styles: null },
	"4": { kind: "never", zones: [], styles: null },
	"5": { kind: "place", zones: [{ start: 422, end: 424, kind: "fixed" }], styles: null },
}

describe("skillSpans", () => {
	it("turns zones into labelled spans, anywhere into one span over the course, never into none", () => {
		expect(skillSpans(ZONES["1"], 1200, "Final Push")).toEqual([
			{ key: "Final Push-0", start: 550, end: 788, kind: "random", label: "Final Push", lane: 0 },
		])
		expect(skillSpans(ZONES["3"], 1200, "Groundwork")).toEqual([
			{ key: "Groundwork-all", start: 0, end: 1200, kind: "anywhere", label: "Groundwork", lane: 0 },
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
