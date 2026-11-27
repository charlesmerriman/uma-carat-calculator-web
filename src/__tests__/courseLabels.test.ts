/**
 * The course map's label placer (utils/courseLabels.ts): what a layout may
 * never do, checked with this file's own geometry so a blind spot in the
 * placer's scoring can't hide in its tests too.
 */
import { describe, expect, it } from "vitest"
import { placeLabels, type LabelRequest } from "../utils/courseLabels"

type At = readonly [number, number]
const side = (a: At, b: At, c: At) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]))
/** Do the leaders of two requests cross, each from its `from` (or anchor) to its chip's centre? */
const leadersCross = (a: LabelRequest, at: At, b: LabelRequest, bt: At) => {
	const [p, q] = [a.from ?? a.anchor, b.from ?? b.anchor]
	return side(p, at, q) * side(p, at, bt) < 0 && side(q, bt, p) * side(q, bt, at) < 0
}
/** Does the leader of `a` pass through the box of `b`'s chip? Sampled along it. */
const leaderThrough = (a: LabelRequest, at: At, b: LabelRequest, bt: At) => {
	const from = a.from ?? a.anchor
	for (let k = 0; k <= 200; k++) {
		const x = from[0] + ((at[0] - from[0]) * k) / 200
		const y = from[1] + ((at[1] - from[1]) * k) / 200
		if (Math.abs(x - bt[0]) < b.width / 2 && Math.abs(y - bt[1]) < b.height / 2) return true
	}
	return false
}
const overlap = (a: LabelRequest, at: At, b: LabelRequest, bt: At) => Math.abs(at[0] - bt[0]) < (a.width + b.width) / 2 && Math.abs(at[1] - bt[1]) < (a.height + b.height) / 2

describe("placeLabels, one chip", () => {
	// One label anchored at the origin, pointing up the page (y down), 40 wide
	// and 10 tall, placed 20 out: its first spot is centred at (0, -20).
	const request = { key: "a", anchor: [0, 0] as const, direction: [0, -1] as const, width: 40, height: 10 }

	it("takes the first spot when nothing is in the way", () => {
		const { a } = placeLabels([request], 20)
		expect(a[0]).toBeCloseTo(0, 6)
		expect(a[1]).toBeCloseTo(-20, 6)
	})

	it("moves a label off the track when its first spot would lie across it", () => {
		// A stretch of track running across the page through the first spot.
		const track = { points: Array.from({ length: 21 }, (_, i) => [i * 5 - 50, -20] as const), halfWidth: 2 }
		const { a } = placeLabels([request], 20, track)
		// Its box (10 tall) clears the track (2 either side of y = -20).
		expect(Math.abs(a[1] + 20)).toBeGreaterThan(5 + 2)
	})

	it("scores a place past the box's edge where it slides back to, and returns it inside", () => {
		// The first spot (0, -20) would reach 5 above a box that starts at y = -18:
		// slid in, it sits at y = -13, still the nearest place, and is what comes back.
		const { a } = placeLabels([request], 20, undefined, { bounds: { x: -100, y: -18, width: 200, height: 118 } })
		expect(a[0]).toBeCloseTo(0, 6)
		expect(a[1]).toBeCloseTo(-13, 6)
	})

	it("steps out of the margin round the track when a clear spot is left", () => {
		// A margin over the first spot only: the label moves off it.
		const margin = { points: [[0, -20]] as const, halfWidth: 3 }
		const { a } = placeLabels([request], 20, undefined, { margin })
		expect(Math.abs(a[0]) > 20 + 3 || Math.abs(a[1] + 20) > 5 + 3).toBe(true)
		// With the margin everywhere, every place has the fault: it keeps its first.
		const everywhere = { points: Array.from({ length: 41 * 41 }, (_, i) => [(i % 41) * 5 - 100, Math.floor(i / 41) * 5 - 100] as const), halfWidth: 2 }
		const { a: kept } = placeLabels([request], 20, undefined, { margin: everywhere })
		expect(kept[1]).toBeCloseTo(-20, 6)
	})

	it("won't run a leader back over the track when a spot without one is left", () => {
		// A short stretch of track across the leader's way, halfway out, too far
		// from the first spot's box to cover it: only the leader meets it.
		const leaderTrack = { points: Array.from({ length: 21 }, (_, i) => [i - 10, -10] as const), halfWidth: 1 }
		const { a } = placeLabels([request], 20, undefined, { leaderTrack })
		// It swings out wide enough that its leader passes the stretch's end.
		expect(Math.abs(a[0])).toBeGreaterThan(10)
	})

	it("lets a leader START on the track: the fault is coming back over it", () => {
		// The same stretch, but through the anchor itself (the spurt chip's
		// leader runs back to its line). Leaving it is no fault.
		const leaderTrack = { points: Array.from({ length: 21 }, (_, i) => [i - 10, 0] as const), halfWidth: 1 }
		const { a } = placeLabels([request], 20, undefined, { leaderTrack })
		expect(a[0]).toBeCloseTo(0, 6)
		expect(a[1]).toBeCloseTo(-20, 6)
	})

	it("crosses to the other side of the track only to clear a fault", () => {
		// The track runs across the page through the anchor (y = 0), and the
		// chip's own side is above it. Free to choose, it stays on its side.
		const either = { ...request, otherSide: 20 }
		expect(placeLabels([either], 20).a[1]).toBeLessThan(0)
		// Its own side all on the track: now below is the only clear place.
		const above = { points: Array.from({ length: 61 * 31 }, (_, i) => [(i % 61) * 5 - 150, -Math.floor(i / 61) * 5 - 5] as const), halfWidth: 2 }
		expect(placeLabels([either], 20, above).a[1]).toBeGreaterThan(0)
	})

	it("keeps a chip that belongs inside the curve inside it, even when the only clear place is across the track", () => {
		// The spurt chip's set-up: the loop's two sides are the lines x = 30
		// (its own, where its leader starts) and x = -50 (the far side). Its
		// anchor is inside, at x = 10, and it reaches left, across the infield.
		const spurt = { key: "spurt", anchor: [10, 0] as const, direction: [-1, 0] as const, width: 10, height: 6, noMargin: true, from: [30, 0] as const }
		const line = (x: number) => Array.from({ length: 201 }, (_, i) => [x, i - 100] as const)
		const leaderTrack = { points: [...line(30), ...line(-50)], halfWidth: 2 }
		// Every place inside the loop lies on track; past the far side is clear.
		const inside: (readonly [number, number])[] = []
		for (let x = -48; x <= 28; x += 4) for (let y = -100; y <= 100; y += 4) inside.push([x, y])
		const placed = placeLabels([spurt], 20, { points: inside, halfWidth: 2 }, { leaderTrack })
		// Over the track's edge inside its curve, sooner than clean outside it.
		expect(placed.spurt[0]).toBeGreaterThan(-50)
		expect(placed.spurt[0]).toBeLessThan(30)
	})

	it("keeps its first spot when every spot is on the track", () => {
		// Track everywhere: a grid over the whole neighbourhood.
		const points = Array.from({ length: 81 * 81 }, (_, i) => [(i % 81) * 5 - 200, Math.floor(i / 81) * 5 - 200] as const)
		const { a } = placeLabels([request], 20, { points, halfWidth: 2 })
		expect(a[1]).toBeCloseTo(-20, 6)
	})
})

describe("placeLabels, chips together", () => {
	const out = Math.SQRT1_2

	it("uncrosses two leaders, so the two read in the track's order", () => {
		// Two small chips pointing at each other's side: each one's first spot,
		// taken alone, sends its leader across the other's at (10, -10).
		const left = { key: "left", anchor: [0, 0] as const, direction: [out, -out] as const, width: 4, height: 4 }
		const right = { key: "right", anchor: [20, 0] as const, direction: [-out, -out] as const, width: 4, height: 4 }
		const placed = placeLabels([left, right], 20)
		expect(leadersCross(left, placed.left, right, placed.right)).toBe(false)
		expect(overlap(left, placed.left, right, placed.right)).toBe(false)
	})

	it("never lays one chip's leader through another chip", () => {
		// Two chips straight out from spots one above the other: the lower
		// one's first spot is right in the way of the upper one's leader... the
		// other way round: the upper chip sits on the lower one's leader.
		const lower = { key: "lower", anchor: [0, 0] as const, direction: [0, -1] as const, width: 30, height: 8 }
		const upper = { key: "upper", anchor: [0, -6] as const, direction: [0, -1] as const, width: 30, height: 8, reach: 8 }
		const placed = placeLabels([lower, upper], 20)
		expect(leaderThrough(lower, placed.lower, upper, placed.upper)).toBe(false)
		expect(leaderThrough(upper, placed.upper, lower, placed.lower)).toBe(false)
		expect(overlap(lower, placed.lower, upper, placed.upper)).toBe(false)
	})

	it("keeps a bunch on a straight in the order a runner meets them, with nothing crossed or hidden", () => {
		// Four spots close together along a track running left to right (the
		// way of travel), each chip far wider than the gap between spots: Henry's
		// back bend (board 1572757223967301693), straightened out.
		const travel = [1, 0] as const
		const requests: LabelRequest[] = [0, 1, 2, 3].map((n) => ({
			key: `chip-${n}`, anchor: [n * 14, 0] as const, direction: [0, -1] as const, width: 60, height: 12, travel, air: [4, 2] as const,
		}))
		// Given most important first, which is not the order along the track.
		const placed = placeLabels([requests[2], requests[0], requests[3], requests[1]], 22)
		for (let i = 0; i < 4; i++) {
			for (let j = i + 1; j < 4; j++) {
				const [a, b] = [requests[i], requests[j]]
				expect(overlap(a, placed[a.key], b, placed[b.key]), `${a.key} on ${b.key}`).toBe(false)
				expect(leadersCross(a, placed[a.key], b, placed[b.key]), `${a.key} x ${b.key}`).toBe(false)
				expect(leaderThrough(a, placed[a.key], b, placed[b.key]) || leaderThrough(b, placed[b.key], a, placed[a.key]), `${a.key} through ${b.key}`).toBe(false)
				// j is further along the track than i: its chip is not clearly behind i's.
				expect(placed[b.key][0] - placed[a.key][0], `${a.key} before ${b.key}`).toBeGreaterThan(-0.2 * 56)
			}
		}
	})

	it("gives the same layout every time", () => {
		const requests: LabelRequest[] = [0, 1, 2, 3, 4].map((n) => ({
			key: `chip-${n}`, anchor: [n * 9, (n % 2) * 4] as const, direction: [0, -1] as const, width: 50, height: 10, travel: [1, 0] as const,
		}))
		expect(placeLabels(requests, 20)).toEqual(placeLabels(requests, 20))
	})
})
