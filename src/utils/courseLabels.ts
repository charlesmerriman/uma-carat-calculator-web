/**
 * Where the course map's callouts go (components/course/CourseTrack.tsx).
 *
 * THE PROBLEM. Every callout ("Corner 3 650m", "Downhill 1%") is a chip beside
 * the track with a leader line back to its spot. Each chip has a fixed list of
 * places it may go (`spotsFor`), and a layout is one place per chip. A bad
 * layout hides words or tangles lines; this file finds the best one.
 *
 * WHAT "BEST" MEANS: one score for the whole map, compared level by level, a
 * higher level always winning over everything below it (`LEVEL`):
 *
 *   1. hidden   words hidden or broken: a chip on a chip (their clear air
 *               counted) or on the track (a place past the box's edge is
 *               scored where it slides back to), or the spurt chip outside
 *               the curve it belongs in
 *   2. order    two neighbours whose chips sit the other way round from the
 *               order a runner meets them
 *   3. lines    a leader crossing another leader, or running through
 *               another chip; the spurt chip over its own track's edge
 *   4. across   a leader that leaves the track and comes back over it
 *   5. mild     a chip in the clear air round the track or over a hill's
 *               bracket; a leader over a bracket
 *   6. rank     how far down its own list of places each chip went
 *
 * So no number of tangled lines is traded for hidden words, and so on down.
 * The owner asked for crossed lines, chips on chips, lines across the track
 * and chips on the track or off the edge to be truly minimised "all while
 * keeping them in order" (2026-11-27); order sits just under hidden words
 * because a chip nobody can read is worse than one out of sequence.
 *
 * WHAT IS MEASURED IS WHAT IS DRAWN. A leader is the line CourseTrack draws:
 * from `from` (lifted to the kerb's edge by `lift`) to the chip's centre. The
 * first version scored a simpler picture (the leader from a shifted anchor,
 * nothing about leaders through chips or order) and its counts looked far
 * better than the maps did: measured on what is drawn, 208 maps had 266
 * leaders running through chips that it could not see.
 *
 * WHERE A CHIP MAY GO (`spotsFor`): 66 places on its own side of the track,
 * nearest first, and for most chips 28 more on the OTHER side (inside the
 * loop). Those cost a little, so a chip crosses over only to clear a real
 * fault: on a course of more than one lap the goal is on the innermost ring,
 * and from outside its leader has to cross every ring beyond it.
 *
 * HOW IT SEARCHES (`search`), three steps, each only ever lowering the score:
 *   1. one chip at a time, most important first, each taking its best place
 *      given the chips already down;
 *   2. the whole map improved until nothing helps: each chip tries all its
 *      places, then every troubled pair is re-placed TOGETHER in the best
 *      way there is, then troubled threes;
 *   3. `exhaust`: when the layout still costs more than the least it
 *      possibly could, an exhaustive search (branch and bound) gets a fixed
 *      number of steps to find a better one.
 * The score is whole numbers only, so "lower" is exact and the search can't
 * go round in circles.
 *
 * HOW GOOD IT IS (2026-11-27, the 26 courses the events use, drawn the 8 ways
 * the app draws them: 208 maps, counted from what is drawn). Chips on chips
 * 20 to 0, on the track 46 to 0, past the edge 30 to 0, crossed leaders 47 to
 * 0, leaders through chips 266 to 3, neighbours out of order 239 to 0,
 * leaders across the track 243 to 124 (at least 68 are on every layout there
 * is), the spurt chip outside its curve 17 to 0 and over its track's edge 40
 * to 44 (nearly all a phone's, whose chip is wider than its curve). No map
 * worse at any level. An exhaustive search with 750 times the steps proved
 * 185 of the 208 layouts the best possible over their places, found nothing
 * better on 18, and found a slightly better one on 5 (one tangle and three
 * leaders across the track between them) that this file's step limit misses.
 * The harness that measured all this is in the notes repo (course-map-labels).
 *
 * Sizes are estimates from the text: nothing on a prerendered page may be
 * measured. The same input always gives the same layout (no randomness).
 */

export interface LabelRequest {
	key: string
	/** The point its places are counted out from (on a course drawn as rings, past the outermost pass). */
	anchor: readonly [number, number]
	/** Which way is "away from the track" there (a unit vector). */
	direction: readonly [number, number]
	/** The label's estimated box, in the shape's units, `air` included. */
	width: number
	height: number
	/** Its own first distance out, when it needs more than the shared one (a chip that must clear the track by a margin). */
	reach?: number
	/** Keeps no margin from the track (options.margin), only off the track itself: the spurt chip, inside a curve with no room for one. */
	noMargin?: boolean
	/** Where its drawn leader starts, when not the anchor: the callout's own point on the track. */
	from?: readonly [number, number]
	/** How far along the leader, from `from`, the drawn line begins: it starts at the kerb's edge, not on the track. */
	lift?: number
	/** The direction of travel at its spot (a unit vector), for keeping neighbours in the order a runner meets them. */
	travel?: readonly [number, number]
	/** The clear air included in `width` and `height` ([across, down]): the words' own box is that much smaller. */
	air?: readonly [number, number]
	/**
	 * Its first distance out on the OTHER side of the track, counted from
	 * `from`, when it may sit there too (inside the loop, for a chip whose side
	 * is the outside). Those places come after every place on its own side.
	 */
	otherSide?: number
}

/** Points a chip must keep clear of, and how far either side of them is too near. */
export interface KeepOut {
	points: readonly (readonly [number, number])[]
	halfWidth: number
}

export interface PlaceLabelsOptions {
	/**
	 * The clear air wanted round the track, wider than `track` (which is the
	 * track itself): a spot inside it is a mild fault, worth taking over a
	 * spot on another chip, on the track or out of the box.
	 */
	margin?: KeepOut
	/** More things no chip should cover: the hill brackets and their ticks. */
	keepOut?: KeepOut[]
	/** The box every chip must fit inside (the drawing's). */
	bounds?: { x: number; y: number; width: number; height: number }
	/**
	 * The track a leader should not come back over: its centre line, and the
	 * kerb's half-width. A leader may START on it (the spurt chip's runs back
	 * to its line); it is at fault once it has left the track and meets it again.
	 */
	leaderTrack?: KeepOut
	/** Lines a leader should not run over if it can help it (the hill brackets): a mild fault. */
	leaderAvoid?: KeepOut
}

// How far out (in `distance`s) and how far round (in radians either side of
// straight out) a chip may go looking for room, in the order tried. The wide
// swings let a crowded chip slide along to the next clear stretch with a
// longer leader, the way the spurt chip does (Henry, 2026-11-06: Corner 4's
// chip "next to corner 3 with a long line").
const REACHES = [1, 1.5, 2.1, 2.8, 3.6, 4.6]
// At each reach, in order: straight out, swung a little, slid sideways by part
// of the chip's own width (along the track, so two chips that want one stretch
// sit side by side), swung further, slid further, swung furthest.
const MOVES: ({ swing: number } | { slide: number })[] = [
	{ swing: 0 }, { swing: 0.45 }, { swing: -0.45 },
	{ slide: 0.6 }, { slide: -0.6 },
	{ swing: 0.9 }, { swing: -0.9 },
	{ slide: 1.2 }, { slide: -1.2 },
	{ swing: 1.35 }, { swing: -1.35 },
]

/**
 * What one fault of each level adds to the score. Powers of two, far enough
 * apart that all the faults a map holds at one level add up to less than a
 * single fault of the level above. The room each level has before it would
 * spill into the next:
 *
 *   rank    4,096   (a map of 25 chips at their LAST places is 2,325)
 *   mild      512   units of 2^12 (a chip's own are at most 9)
 *   across     32   one a chip
 *   lines   1,024   three a pair at most
 *   order     256   one a pair of neighbours
 *   hidden    511   before the total passes 2^53
 *
 * A JavaScript number holds whole numbers exactly up to 2^53, so sums and
 * comparisons are exact: no rounding can make two layouts each look better
 * than the other. No real map comes near any of these, and past them
 * nothing breaks: the top levels still decide, only less finely.
 */
const LEVEL = {
	hidden: 2 ** 44,
	order: 2 ** 36,
	lines: 2 ** 26,
	across: 2 ** 21,
	mild: 2 ** 12,
	rank: 1,
}
// Mild faults, in units of LEVEL.mild.
// A chip on the other side of the track from its own costs as much as two
// of the others, so it goes there to clear a real fault (a leader across the
// track, a tangle), not to tidy a mild one.
const MILD = { margin: 2, keepOut: 2, leaderOverBracket: 1, otherSide: 4 }
// Two neighbours count as out of order only when their chips are the wrong
// way round by more than this share of the smaller chip's extent along the
// track: chips stacked across the direction of travel are neither way round.
const ORDER_SLACK = 0.2
// Neighbours: spots no further apart than this many of the wider chip's widths.
const ORDER_NEAR_WIDTHS = 2

// The other side of the track (LabelRequest.otherSide): fewer places, nearer
// in. Inside a loop there is less room, and a long leader from in there
// would cross the far side of the course.
const OTHER_SIDE_REACHES = [1, 1.5, 2.1, 2.8]
const OTHER_SIDE_MOVES = 7

/**
 * Where a chip may go, in the order tried: each reach out from the track, and
 * at each, straight out, then swung and slid either way (REACHES, MOVES);
 * then, for a chip that may, the same on the other side of the track.
 * `ownSide` is how many of them are on its own side.
 */
function spotsFor(request: LabelRequest, distance: number): { spots: [number, number][]; ownSide: number } {
	const [ax, ay] = request.anchor
	const [dx, dy] = request.direction
	const out = Math.max(distance, request.reach ?? 0)
	// How far a slide moves the chip: part of its own extent across the direction out.
	const across = Math.abs(dy) * request.width + Math.abs(dx) * request.height
	const spots: [number, number][] = []
	// One place: `reach` times `far` from (x, y) the way (ux, uy), then the move.
	const add = (x: number, y: number, ux: number, uy: number, far: number, move: (typeof MOVES)[number]) => {
		if ("swing" in move) {
			const cos = Math.cos(move.swing)
			const sin = Math.sin(move.swing)
			spots.push([x + (ux * cos - uy * sin) * far, y + (ux * sin + uy * cos) * far])
		} else {
			// Straight out, then sideways: (-uy, ux) is the direction out turned a quarter.
			spots.push([x + ux * far - uy * across * move.slide, y + uy * far + ux * across * move.slide])
		}
	}
	for (const reach of REACHES) {
		for (const move of MOVES) add(ax, ay, dx, dy, out * reach, move)
	}
	const ownSide = spots.length
	if (request.otherSide !== undefined) {
		const [fx, fy] = request.from ?? request.anchor
		for (const reach of OTHER_SIDE_REACHES) {
			for (const move of MOVES.slice(0, OTHER_SIDE_MOVES)) add(fx, fy, -dx, -dy, request.otherSide * reach, move)
		}
	}
	return { spots, ownSide }
}

/** `value` kept between `low` and `high`; the middle when the two are the wrong way round (a chip wider than its box). */
function clamp(value: number, low: number, high: number): number {
	return low > high ? (low + high) / 2 : Math.min(high, Math.max(low, value))
}

/** Do the segments p1-p2 and q1-q2 cross? Touching at an end doesn't count. */
function segmentsCross(p1x: number, p1y: number, p2x: number, p2y: number, q1x: number, q1y: number, q2x: number, q2y: number): boolean {
	// Which side of the line a-b the point c is on: the sign of the cross product.
	const side = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => Math.sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax))
	return (
		side(p1x, p1y, p2x, p2y, q1x, q1y) * side(p1x, p1y, p2x, p2y, q2x, q2y) < 0 &&
		side(q1x, q1y, q2x, q2y, p1x, p1y) * side(q1x, q1y, q2x, q2y, p2x, p2y) < 0
	)
}

/**
 * Does the segment a-b pass through the box centred (cx, cy), w by h?
 * (Liang-Barsky: the stretch of the segment inside each pair of sides is
 * narrowed in turn; anything left is inside the box.)
 */
function segmentInBox(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, w: number, h: number): boolean {
	let enter = 0
	let leave = 1
	for (let axis = 0; axis < 2; axis++) {
		const from = axis === 0 ? ax : ay
		const delta = axis === 0 ? bx - ax : by - ay
		const low = axis === 0 ? cx - w / 2 : cy - h / 2
		const high = axis === 0 ? cx + w / 2 : cy + h / 2
		if (Math.abs(delta) < 1e-9) {
			if (from < low || from > high) return false
			continue
		}
		const first = (low - from) / delta
		const second = (high - from) / delta
		enter = Math.max(enter, Math.min(first, second))
		leave = Math.min(leave, Math.max(first, second))
		if (enter > leave) return false
	}
	return true
}

/**
 * A zone's points in a grid of square cells, so "is any point near here"
 * looks at a few cells' worth and not every point: a map asks it hundreds of
 * thousands of times (every sample along every leader, for every place of
 * every chip).
 */
function indexZone(zone: KeepOut | undefined) {
	const cell = Math.max(zone?.halfWidth ?? 1, 1e-6)
	const cells = new Map<number, number[]>()
	// One number per cell: its column and row, offset so a negative one stays positive.
	const keyOf = (column: number, row: number) => (column + 32768) * 65536 + (row + 32768)
	for (const [x, y] of zone?.points ?? []) {
		const key = keyOf(Math.floor(x / cell), Math.floor(y / cell))
		const held = cells.get(key)
		if (held) held.push(x, y)
		else cells.set(key, [x, y])
	}
	/** Is any point inside the box centred (x, y), `halfW` by `halfH` either side? */
	const inBox = (x: number, y: number, halfW: number, halfH: number) => {
		if (cells.size === 0) return false
		const lastColumn = Math.floor((x + halfW) / cell)
		const lastRow = Math.floor((y + halfH) / cell)
		for (let column = Math.floor((x - halfW) / cell); column <= lastColumn; column++) {
			for (let row = Math.floor((y - halfH) / cell); row <= lastRow; row++) {
				const held = cells.get(keyOf(column, row))
				if (!held) continue
				for (let k = 0; k < held.length; k += 2) {
					if (Math.abs(held[k] - x) < halfW && Math.abs(held[k + 1] - y) < halfH) return true
				}
			}
		}
		return false
	}
	/** Is any point within `radius` of (x, y)? */
	const near = (x: number, y: number, radius: number) => {
		if (cells.size === 0) return false
		const lastColumn = Math.floor((x + radius) / cell)
		const lastRow = Math.floor((y + radius) / cell)
		for (let column = Math.floor((x - radius) / cell); column <= lastColumn; column++) {
			for (let row = Math.floor((y - radius) / cell); row <= lastRow; row++) {
				const held = cells.get(keyOf(column, row))
				if (!held) continue
				for (let k = 0; k < held.length; k += 2) {
					if (Math.hypot(held[k] - x, held[k + 1] - y) < radius) return true
				}
			}
		}
		return false
	}
	return { inBox, near, halfWidth: zone?.halfWidth ?? 0, empty: cells.size === 0 }
}

/** One place a chip may take, with what the score needs to know about it. */
interface Spot {
	/** The chip's centre. */
	x: number
	y: number
	/** Where its drawn leader starts (`from`, lifted towards the chip). */
	startX: number
	startY: number
	/** The box round the chip (air included) and its leader together: two spots whose boxes are apart can't touch. */
	minX: number
	maxX: number
	minY: number
	maxY: number
	/** Its faults that involve no other chip, leader faults apart (`leader`, worked out when first asked for). */
	base: number
	leader: number | undefined
}

/**
 * The map as the search sees it: every chip's places, what each costs on its
 * own (`own`) and what two chips cost each other at two places (`pair`). The
 * score of a layout is every chip's `own` plus every pair's `pair`.
 */
function labelModel(requests: LabelRequest[], distance: number, track: KeepOut | undefined, options: PlaceLabelsOptions) {
	const { bounds } = options
	const trackZone = indexZone(track)
	const marginZone = indexZone(options.margin)
	const keepOutZones = (options.keepOut ?? []).map(indexZone)
	const leaderTrack = indexZone(options.leaderTrack)
	const leaderAvoid = indexZone(options.leaderAvoid)
	// The words' own box: the request's, less its clear air.
	const wordsW = requests.map((request) => request.width - (request.air?.[0] ?? 0))
	const wordsH = requests.map((request) => request.height - (request.air?.[1] ?? 0))

	const spots: Spot[][] = requests.map((request, i) => {
		const [fromX, fromY] = request.from ?? request.anchor
		const { spots: list, ownSide } = spotsFor(request, distance)
		return list.map(([rawX, rawY], rank) => {
			const { width: w, height: h } = request
			// A place past the box's edge is the place slid back inside it, which
			// is where CourseTrack would draw it: scored where it lands, so the
			// slide can't put a chip on something the score never saw.
			const x = bounds ? clamp(rawX, bounds.x + wordsW[i] / 2, bounds.x + bounds.width - wordsW[i] / 2) : rawX
			const y = bounds ? clamp(rawY, bounds.y + wordsH[i] / 2, bounds.y + bounds.height - wordsH[i] / 2) : rawY
			// The drawn leader starts `lift` along the way from `from` to the chip.
			const length = Math.hypot(x - fromX, y - fromY) || 1
			const lift = Math.min(request.lift ?? 0, length)
			const startX = fromX + ((x - fromX) / length) * lift
			const startY = fromY + ((y - fromY) / length) * lift
			let base = rank * LEVEL.rank
			if (rank >= ownSide) base += MILD.otherSide * LEVEL.mild
			if (trackZone.inBox(x, y, w / 2 + trackZone.halfWidth, h / 2 + trackZone.halfWidth)) {
				// A chip on the track hides it. The spurt chip (noMargin) is let off
				// more lightly: on a phone's oval it can't fit inside its curve clear of
				// the track's inner edge, so there it counts with the tangled lines,
				// which is still more than a leader across the track (as a mild fault,
				// other chips' leaders pushed it onto the track on 22 more maps).
				base += request.noMargin ? LEVEL.lines : LEVEL.hidden
			} else if (!request.noMargin && marginZone.inBox(x, y, w / 2 + marginZone.halfWidth, h / 2 + marginZone.halfWidth)) {
				base += MILD.margin * LEVEL.mild
			}
			if (keepOutZones.some((zone) => zone.inBox(x, y, w / 2 + zone.halfWidth, h / 2 + zone.halfWidth))) base += MILD.keepOut * LEVEL.mild
			return {
				x, y, startX, startY,
				minX: Math.min(startX, x - w / 2), maxX: Math.max(startX, x + w / 2),
				minY: Math.min(startY, y - h / 2), maxY: Math.max(startY, y + h / 2),
				base,
				leader: undefined,
			}
		})
	})

	/**
	 * Has a chip that belongs inside the curve (noMargin: the spurt chip) left
	 * it? Walked from its anchor, which is inside the curve, to its centre: any
	 * step on the track's centre line means the chip is on the far side, or
	 * lying right across the track. As bad as hidden words: the spurt chip
	 * marks the most important point on the course and never gives up its
	 * place inside (notes/course-map-plan-2.md), though it may lie over the
	 * track's inner edge when the curve is tight (a "lines" fault, set in `spots`).
	 */
	const leftItsCurve = (i: number, spot: Spot) => {
		if (!requests[i].noMargin || leaderTrack.empty) return false
		const [ax, ay] = requests[i].anchor
		const length = Math.hypot(spot.x - ax, spot.y - ay)
		const steps = Math.max(1, Math.ceil(length / (leaderTrack.halfWidth * 0.4)))
		for (let k = 0; k <= steps; k++) {
			if (leaderTrack.near(ax + ((spot.x - ax) * k) / steps, ay + ((spot.y - ay) * k) / steps, leaderTrack.halfWidth * 0.5)) return true
		}
		return false
	}
	/**
	 * A leader's own faults: across the track, over a bracket. Walked in short
	 * steps from where the line starts to the edge of its own chip. Each zone is
	 * met only once the line has been clear of it: the spurt chip's leader starts
	 * on the track and a hill's starts on its own bracket, and neither is a fault
	 * until the line comes back.
	 */
	const leaderFaults = (i: number, spot: Spot) => {
		if (leaderTrack.empty && leaderAvoid.empty) return 0
		if (leftItsCurve(i, spot)) return LEVEL.hidden
		const length = Math.hypot(spot.x - spot.startX, spot.y - spot.startY)
		const step = Math.max(leaderTrack.halfWidth, leaderAvoid.halfWidth, 1e-6) * 0.4
		const steps = Math.ceil(length / step)
		let leftTrack = false
		let leftAvoid = false
		let across = false
		let overBracket = false
		for (let k = 0; k < steps && !(across && overBracket); k++) {
			const x = spot.startX + ((spot.x - spot.startX) * k) / steps
			const y = spot.startY + ((spot.y - spot.startY) * k) / steps
			// Under its own chip the line isn't seen.
			if (Math.abs(x - spot.x) < wordsW[i] / 2 && Math.abs(y - spot.y) < wordsH[i] / 2) break
			if (!across) {
				const on = leaderTrack.near(x, y, leaderTrack.halfWidth)
				if (!leftTrack) leftTrack = !on
				else across = on
			}
			if (!overBracket) {
				const on = leaderAvoid.near(x, y, leaderAvoid.halfWidth)
				if (!leftAvoid) leftAvoid = !on
				else overBracket = on
			}
		}
		return (across ? LEVEL.across : 0) + (overBracket ? MILD.leaderOverBracket * LEVEL.mild : 0)
	}
	/** What chip i costs at its place `s`, with no other chip in the picture. */
	const own = (i: number, s: number) => {
		const spot = spots[i][s]
		return spot.base + (spot.leader ??= leaderFaults(i, spot))
	}
	/** The least place `s` of chip i could cost: its faults before the slow leader walk. */
	const ownAtLeast = (i: number, s: number) => spots[i][s].base + (spots[i][s].leader ?? 0)

	// Which pairs have an order to keep, and along which line: two spots near
	// each other on stretches heading the same way. `sign` is +1 when j is
	// further along that line than i; `slack` is how far the wrong way round
	// their chips may sit before it counts.
	const kerb = leaderTrack.halfWidth
	const ordered: ({ x: number; y: number; sign: number; slack: number } | null)[][] = requests.map((a, i) =>
		requests.map((b, j) => {
			if (i === j || !a.travel || !b.travel) return null
			const tx = a.travel[0] + b.travel[0]
			const ty = a.travel[1] + b.travel[1]
			const length = Math.hypot(tx, ty)
			// Heading apart by a quarter turn or more: no shared direction to order them along.
			if (a.travel[0] * b.travel[0] + a.travel[1] * b.travel[1] <= 0 || length === 0) return null
			const [ax, ay] = a.from ?? a.anchor
			const [bx, by] = b.from ?? b.anchor
			if (Math.hypot(bx - ax, by - ay) > ORDER_NEAR_WIDTHS * Math.max(wordsW[i], wordsW[j])) return null
			const x = tx / length
			const y = ty / length
			const along = (bx - ax) * x + (by - ay) * y
			// On the same spot, near enough (a third of the kerb): neither comes first.
			if (Math.abs(along) < kerb * 0.3) return null
			const extent = (k: number) => Math.abs(x) * wordsW[k] + Math.abs(y) * wordsH[k]
			return { x, y, sign: Math.sign(along), slack: ORDER_SLACK * Math.min(extent(i), extent(j)) }
		}),
	)

	/** What chips i and j cost each other, at places `s` and `t`. */
	const pair = (i: number, s: number, j: number, t: number) => {
		const a = spots[i][s]
		const b = spots[j][t]
		let cost = 0
		const order = ordered[i][j]
		if (order) {
			const along = ((b.x - a.x) * order.x + (b.y - a.y) * order.y) * order.sign
			if (along < -order.slack) cost += LEVEL.order
		}
		// Their chips and leaders nowhere near each other: nothing else to check.
		if (a.minX > b.maxX || b.minX > a.maxX || a.minY > b.maxY || b.minY > a.maxY) return cost
		// One chip on another, by their boxes WITH their clear air: the sizes are
		// estimates from the text, and the air is what keeps a chip that turns
		// out a little wider than its estimate off its neighbour.
		if (Math.abs(a.x - b.x) < (requests[i].width + requests[j].width) / 2 && Math.abs(a.y - b.y) < (requests[i].height + requests[j].height) / 2) cost += LEVEL.hidden
		if (segmentsCross(a.startX, a.startY, a.x, a.y, b.startX, b.startY, b.x, b.y)) cost += LEVEL.lines
		if (segmentInBox(a.startX, a.startY, a.x, a.y, b.x, b.y, wordsW[j], wordsH[j])) cost += LEVEL.lines
		if (segmentInBox(b.startX, b.startY, b.x, b.y, a.x, a.y, wordsW[i], wordsH[i])) cost += LEVEL.lines
		return cost
	}

	// Which chips can cost each other anything at all: a pair with an order to
	// keep, or whose places (chip and leader together) come anywhere near each
	// other. Most pairs on a map can't (the back straight's chips and the home
	// straight's), and the search never compares them.
	const reach = spots.map((list) => ({
		minX: Math.min(...list.map((spot) => spot.minX)),
		maxX: Math.max(...list.map((spot) => spot.maxX)),
		minY: Math.min(...list.map((spot) => spot.minY)),
		maxY: Math.max(...list.map((spot) => spot.maxY)),
	}))
	const near: number[][] = requests.map((_, i) =>
		requests.flatMap((_, j) => {
			if (i === j) return []
			const apart = reach[i].minX > reach[j].maxX || reach[j].minX > reach[i].maxX || reach[i].minY > reach[j].maxY || reach[j].minY > reach[i].maxY
			return ordered[i][j] || !apart ? [j] : []
		}),
	)

	return {
		count: requests.length,
		places: (i: number) => spots[i].length,
		spot: (i: number, s: number) => spots[i][s],
		own, ownAtLeast, pair,
		/** The chips that chip i can cost anything, or be cost anything by. */
		near: (i: number) => near[i],
	}
}

type LabelModel = ReturnType<typeof labelModel>

// How many rounds of improving, and how many three-chip re-placements in
// all, a map gets at most. Both are guards on time: a map settles in two or
// three rounds, and this runs whenever the map's layout changes.
const ROUNDS = 8
const TRIPLES = 24
// How many steps the exhaustive last step may take (`exhaust`). Most maps need
// none: the search above already sits on the least any layout could cost. Of
// the 208 maps measured, about 170 took none; 600 steps cleared one more
// leader across the track than 200 and 2,000 cleared two, at one and a half
// and three times the slowest map's time.
const EXHAUST_STEPS = 200
// A three-chip re-placement looks at each chip's best few places, not all of
// them: 94 x 94 x 94 is too many to try, and a place that is poor for a chip
// on its own is rarely part of the best three.
const TRIPLE_PLACES = 20

/**
 * The layout as the search holds it: `at[i]` is which of its places chip i
 * has. Each step below only ever LOWERS the map's score.
 */
function search(model: LabelModel): number[] {
	const { count, places, own, ownAtLeast, pair, near } = model
	// -1 until a chip is down.
	const at: number[] = new Array(count).fill(-1)

	/** Chip i at place `s` against every chip down so far, but `skip` and `skip2`. */
	const against = (i: number, s: number, skip = -1, skip2 = -1) => {
		let cost = own(i, s)
		for (const j of near(i)) {
			if (at[j] >= 0 && j !== skip && j !== skip2) cost += pair(i, s, j, at[j])
		}
		return cost
	}

	// ── One at a time, most important first ──
	for (let i = 0; i < count; i++) {
		let best = 0
		let bestCost = Infinity
		for (let s = 0; s < places(i); s++) {
			// `ownAtLeast` first: the slow leader walk is skipped for a place that can't win.
			if (ownAtLeast(i, s) >= bestCost) continue
			const cost = against(i, s)
			if (cost < bestCost) {
				best = s
				bestCost = cost
			}
		}
		at[i] = best
	}

	/** A chip to the best of its own places. True if it moved. */
	const moveOne = (i: number) => {
		const now = against(i, at[i])
		let best = at[i]
		let bestCost = now
		for (let s = 0; s < places(i); s++) {
			if (s === at[i] || ownAtLeast(i, s) >= bestCost) continue
			const cost = against(i, s)
			if (cost < bestCost) {
				best = s
				bestCost = cost
			}
		}
		if (best === at[i]) return false
		at[i] = best
		return true
	}

	/**
	 * Every place of chip i with what it costs against the chips staying put,
	 * cheapest first, so the loops below can stop at the first place that
	 * can't beat the best found.
	 */
	const ranked = (i: number, skip: number, skip2 = -1, limit = Infinity) => {
		const list: { s: number; cost: number }[] = []
		for (let s = 0; s < places(i); s++) list.push({ s, cost: against(i, s, skip, skip2) })
		list.sort((a, b) => a.cost - b.cost || a.s - b.s)
		return list.length > limit ? list.slice(0, limit) : list
	}

	/**
	 * Chips i and j re-placed together, in the best way there is with the rest
	 * staying put. One chip at a time can't find a pair that must BOTH move
	 * (two chips whose leaders cross either way round until each takes a new
	 * place). True if they moved.
	 */
	const movePair = (i: number, j: number) => {
		const listI = ranked(i, j)
		const listJ = ranked(j, i)
		let best = against(i, at[i], j) + against(j, at[j], i) + pair(i, at[i], j, at[j])
		let found: [number, number] | null = null
		for (const a of listI) {
			if (a.cost >= best) break
			for (const b of listJ) {
				if (a.cost + b.cost >= best) break
				const cost = a.cost + b.cost + pair(i, a.s, j, b.s)
				if (cost < best) {
					best = cost
					found = [a.s, b.s]
				}
			}
		}
		if (!found) return false
		;[at[i], at[j]] = found
		return true
	}

	/** Three chips re-placed together, over each one's best few places. True if they moved. */
	const moveThree = (i: number, j: number, k: number) => {
		const listI = ranked(i, j, k, TRIPLE_PLACES)
		const listJ = ranked(j, i, k, TRIPLE_PLACES)
		const listK = ranked(k, i, j, TRIPLE_PLACES)
		let best =
			against(i, at[i], j, k) + against(j, at[j], i, k) + against(k, at[k], i, j) +
			pair(i, at[i], j, at[j]) + pair(i, at[i], k, at[k]) + pair(j, at[j], k, at[k])
		let found: [number, number, number] | null = null
		for (const a of listI) {
			if (a.cost >= best) break
			for (const b of listJ) {
				if (a.cost + b.cost >= best) break
				const two = a.cost + b.cost + pair(i, a.s, j, b.s)
				if (two >= best) continue
				for (const c of listK) {
					if (two + c.cost >= best) break
					const cost = two + c.cost + pair(i, a.s, k, c.s) + pair(j, b.s, k, c.s)
					if (cost < best) {
						best = cost
						found = [a.s, b.s, c.s]
					}
				}
			}
		}
		if (!found) return false
		;[at[i], at[j], at[k]] = found
		return true
	}

	/**
	 * Has chip i a fault some other place of its own would not have? Measured
	 * against the least any of its places costs alone, so a fault it has
	 * everywhere (a leader that must cross an outer lap's ring) doesn't send the
	 * search looking for a way out that isn't there.
	 */
	const troubled = (i: number) => {
		let least = Infinity
		for (let s = 0; s < places(i); s++) least = Math.min(least, ownAtLeast(i, s))
		return against(i, at[i]) - least >= LEVEL.mild
	}
	/** Do chips i and j cost each other anything where they are? */
	const clash = (i: number, j: number) => pair(i, at[i], j, at[j]) > 0

	// ── The whole map, until nothing helps ──
	const improve = () => {
		let triples = TRIPLES
		for (let round = 0; round < ROUNDS; round++) {
			let moved = false
			for (let i = 0; i < count; i++) moved = moveOne(i) || moved
			// Pairs: a troubled chip with each chip it clashes with, then with
			// every other chip near it (its fault may be one only a bystander's move clears).
			for (let i = 0; i < count; i++) {
				if (!troubled(i)) continue
				for (const j of near(i)) {
					if (clash(i, j)) moved = movePair(Math.min(i, j), Math.max(i, j)) || moved
				}
				for (const j of near(i)) {
					if (!troubled(i)) break
					moved = movePair(Math.min(i, j), Math.max(i, j)) || moved
				}
			}
			// Threes: what is still at fault past the mild, with two of the chips it clashes with.
			for (let i = 0; i < count && triples > 0; i++) {
				if (!troubled(i) || against(i, at[i]) < LEVEL.across) continue
				const others: number[] = []
				for (const j of near(i)) if (clash(i, j)) others.push(j)
				for (let a = 0; a < others.length && triples > 0; a++) {
					for (let b = a + 1; b < others.length && triples > 0; b++) {
						triples -= 1
						moved = moveThree(i, others[a], others[b]) || moved
					}
				}
			}
			if (!moved) break
		}
	}
	improve()
	// ── Every layout there is, as far as the steps allow ──
	if (exhaust(model, at)) improve()
	return at
}

/**
 * The last step: look for a layout with fewer faults above the mild level
 * than `at`, among ALL of them, and put it in `at`. True if one was found.
 *
 * The steps before this one each change a chip or two or three and keep
 * what helps, so they can stop on a layout no small change improves while a
 * better one exists further off. This one is exhaustive (branch and bound):
 *
 *   - Chips are placed one after another. `costs[u][s]` is what an unplaced
 *     chip u would add at its place s: its own faults plus what it costs
 *     each chip placed so far.
 *   - A branch is dropped as soon as what is placed, plus the LEAST every
 *     unplaced chip could still add, can't beat the best layout known. That
 *     least is a true floor (no pair of chips ever costs less than nothing),
 *     so nothing better is ever thrown away.
 *   - The unplaced chip whose cheapest place costs the most goes next: the
 *     one in the tightest spot, where a wrong guess shows soonest.
 *
 * It usually ends at once: when the layout found already costs no more than
 * every chip's own cheapest place added up, nothing can beat it. Otherwise it
 * takes up to EXHAUST_STEPS steps and keeps the best it has seen; on a hard
 * map that is an improvement or nothing, never a worse layout.
 *
 * Only faults from "across" up are counted here (`major`): mild faults and
 * rank are left to the steps above, which run once more afterwards.
 */
function exhaust(model: LabelModel, at: number[]): boolean {
	const { count, places, own, pair } = model
	const major = (cost: number) => cost - (cost % LEVEL.across)
	// What the layout costs now, and the floor: every chip's own cheapest
	// place, added up. A chip with no fault of its own where it is can't do
	// better, so only the others have all their places looked at here (the
	// slow part: each place's leader has to be walked).
	let best = 0
	let floor = 0
	for (let i = 0; i < count; i++) {
		const mine = major(own(i, at[i]))
		best += mine
		for (const j of model.near(i)) if (j > i) best += major(pair(i, at[i], j, at[j]))
		if (mine === 0) continue
		let least = mine
		for (let s = 0; s < places(i) && least > 0; s++) least = Math.min(least, major(own(i, s)))
		floor += least
	}
	if (best <= floor) return false
	const ownMajor = Array.from({ length: count }, (_, i) => Array.from({ length: places(i) }, (_, s) => major(own(i, s))))

	// touches[u][v]: can chips u and v cost each other anything (model.near)?
	const touches = Array.from({ length: count }, (_, u) => {
		const row: boolean[] = new Array(count).fill(false)
		for (const v of model.near(u)) row[v] = true
		return row
	})

	let steps = 0
	let found: number[] | null = null
	const placed: number[] = new Array(count).fill(-1)
	const descend = (spent: number, costs: number[][]) => {
		if (++steps > EXHAUST_STEPS) return
		// The floor of this branch, and the unplaced chip in the tightest spot.
		let bound = spent
		let next = -1
		let nextLeast = -1
		for (let u = 0; u < count; u++) {
			if (placed[u] >= 0) continue
			let least = Infinity
			for (const cost of costs[u]) if (cost < least) least = cost
			bound += least
			if (least > nextLeast) {
				nextLeast = least
				next = u
			}
		}
		if (bound >= best) return
		if (next < 0) {
			best = spent
			found = [...placed]
			return
		}
		// What the OTHER unplaced chips add at the least: a place of `next` is
		// worth trying only if it, with that, can still beat the best.
		const others = bound - spent - nextLeast
		const tries = costs[next].map((cost, s) => ({ cost, s })).filter((entry) => spent + entry.cost + others < best)
		tries.sort((a, b) => a.cost - b.cost || a.s - b.s)
		for (const { cost, s } of tries) {
			if (spent + cost + others >= best || steps > EXHAUST_STEPS) break
			placed[next] = s
			const after = costs.map((list, u) => (placed[u] >= 0 || !touches[u][next] ? list : list.map((value, t) => value + major(pair(u, t, next, s)))))
			descend(spent + cost, after)
			placed[next] = -1
		}
	}
	descend(0, ownMajor)
	if (!found) return false
	for (let i = 0; i < count; i++) at[i] = (found as number[])[i]
	return true
}

/**
 * Where each callout goes: the centre of each label, by its key. See the top
 * of this file for what is being minimised and how.
 *
 * `track` (optional) is the drawn path and how far either side of it counts
 * as on it: a chip whose box covers a point of it is on the track. `options`
 * adds the other things the score counts (PlaceLabelsOptions).
 */
export function placeLabels(
	requests: LabelRequest[],
	distance: number,
	track?: KeepOut,
	options: PlaceLabelsOptions = {},
): Record<string, [number, number]> {
	const model = labelModel(requests, distance, track, options)
	const at = search(model)
	return Object.fromEntries(
		requests.map((request, index) => {
			const spot = model.spot(index, at[index])
			return [request.key, [spot.x, spot.y] as [number, number]]
		}),
	)
}
