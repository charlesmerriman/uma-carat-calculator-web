/**
 * WHERE THE CARAT COUNTS GO on the forecast chart (the "Carat counts" layer,
 * components/carat-calculator/ForecastPlot.tsx). Pure: pixel positions in,
 * label boxes out, so the placement is testable without Recharts or a DOM.
 *
 * Each banner's dot gets its number beside it, tried in a fixed order of
 * spots: right of the dot, above it, left of it, below it. A spot is taken
 * only if it stays inside the plot, covers no other dot, no label already
 * placed, nothing the caller reserves (the end label, the pity label) and,
 * where it can, not the line itself. Labels are placed left to right, each
 * taking the first clear spot. A dot with no clear spot gets no label: an
 * unreadable pile of numbers is worse than a gap, and the hover readout still
 * has every number. Where dots crowd (a phone, two banners ending together)
 * that drops some; the owner decides whether that is the right trade.
 *
 * Right first because of the chart's shape: a banner's dot sits at the top of
 * a drop, so the line falls away under its right side and the space there is
 * usually empty until the next climb reaches that height.
 */

export interface LabelPoint {
	key: string | number
	/** The dot's centre, in the plot's pixels. */
	x: number
	y: number
	text: string
}

export interface Box {
	x0: number
	y0: number
	x1: number
	y1: number
}

export interface PlacedLabel {
	key: string | number
	/** Where the text goes: its anchor point and alignment (SVG text-anchor), and the baseline. */
	x: number
	y: number
	anchor: "start" | "middle" | "end"
	box: Box
}

/** The label's type size and the gap between a dot and its label. */
export const LABEL_FONT_SIZE = 10
const LINE_HEIGHT = 12
const GAP = 7
/** A banner dot's radius (4.5) plus its 2px stroke, as a box other labels keep off. */
const DOT_RADIUS = 6
/** The least room between two labels, so "90.0K" and "69.5K" never read as one number. */
const LABEL_SPACING = 4

/**
 * About how wide `text` draws at LABEL_FONT_SIZE, semibold, with tabular
 * digits. An estimate (no DOM to measure in), kept on the generous side so a
 * collision is never missed: digits ~0.62em, "." and "," ~0.3em.
 */
export function estimateTextWidth(text: string, fontSize = LABEL_FONT_SIZE): number {
	let width = 0
	for (const char of text) width += /[.,()\s]/.test(char) ? 0.32 : 0.66
	return width * fontSize + 2
}

const grow = (box: Box, by: number): Box => ({ x0: box.x0 - by, y0: box.y0 - by, x1: box.x1 + by, y1: box.y1 + by })
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1

/** Whether the segment p-q crosses (or lies inside) the box. Liang-Barsky clipping. */
function segmentHitsBox(px: number, py: number, qx: number, qy: number, box: Box): boolean {
	let t0 = 0
	let t1 = 1
	const dx = qx - px
	const dy = qy - py
	const edges: [number, number][] = [
		[-dx, px - box.x0],
		[dx, box.x1 - px],
		[-dy, py - box.y0],
		[dy, box.y1 - py],
	]
	for (const [p, q] of edges) {
		if (p === 0) {
			if (q < 0) return false
			continue
		}
		const r = q / p
		if (p < 0) {
			if (r > t1) return false
			if (r > t0) t0 = r
		} else {
			if (r < t0) return false
			if (r < t1) t1 = r
		}
	}
	return true
}

/** A line as drawn: its vertices in pixels, left to right. */
export type PixelLine = readonly { x: number; y: number }[]

/** Whether the polyline (sorted by x) crosses the box. */
function lineHitsBox(line: PixelLine, box: Box): boolean {
	for (let i = 1; i < line.length; i++) {
		const a = line[i - 1]
		const b = line[i]
		if (Math.max(a.x, b.x) < box.x0) continue
		if (Math.min(a.x, b.x) > box.x1) break
		if (segmentHitsBox(a.x, a.y, b.x, b.y, box)) return true
	}
	return false
}

/** The four spots for one label, in the order they are tried. */
function candidates(point: LabelPoint): Omit<PlacedLabel, "key">[] {
	const width = estimateTextWidth(point.text)
	const half = LINE_HEIGHT / 2
	// The baseline sits a little under the box's middle, so the digits centre on it.
	const baseline = (top: number) => top + LINE_HEIGHT - 2.5
	const { x, y } = point
	return [
		{ x: x + GAP, y: baseline(y - half), anchor: "start", box: { x0: x + GAP, y0: y - half, x1: x + GAP + width, y1: y + half } },
		{ x, y: baseline(y - GAP - LINE_HEIGHT), anchor: "middle", box: { x0: x - width / 2, y0: y - GAP - LINE_HEIGHT, x1: x + width / 2, y1: y - GAP } },
		{ x: x - GAP, y: baseline(y - half), anchor: "end", box: { x0: x - GAP - width, y0: y - half, x1: x - GAP, y1: y + half } },
		{ x, y: baseline(y + GAP), anchor: "middle", box: { x0: x - width / 2, y0: y + GAP, x1: x + width / 2, y1: y + GAP + LINE_HEIGHT } },
	]
}

/**
 * Place every label that fits. `lines` are the drawn lines (the free line,
 * and the paid band's top edge when it shows); `reserved` are boxes nothing
 * may cover; `bounds` is where labels may go.
 *
 * Two passes: first only spots clear of the line, then, for the labels still
 * without one, spots that cross it (the text has a halo in the card's colour,
 * so it stays readable over a line, never over another label).
 */
export function placeForecastLabels(
	points: readonly LabelPoint[],
	lines: readonly PixelLine[],
	reserved: readonly Box[],
	bounds: Box
): PlacedLabel[] {
	const ordered = [...points].sort((a, b) => a.x - b.x)
	const dots: Box[] = ordered.map((p) => ({ x0: p.x - DOT_RADIUS, y0: p.y - DOT_RADIUS, x1: p.x + DOT_RADIUS, y1: p.y + DOT_RADIUS }))
	const taken: Box[] = [...reserved]
	const placed = new Map<string | number, PlacedLabel>()

	const fits = (box: Box, avoidLine: boolean) =>
		box.x0 >= bounds.x0 &&
		box.x1 <= bounds.x1 &&
		box.y0 >= bounds.y0 &&
		box.y1 <= bounds.y1 &&
		!taken.some((other) => overlaps(grow(box, LABEL_SPACING), other)) &&
		!dots.some((dot) => overlaps(box, dot)) &&
		!(avoidLine && lines.some((line) => lineHitsBox(line, box)))

	for (const avoidLine of [true, false]) {
		for (const point of ordered) {
			if (placed.has(point.key)) continue
			const spot = candidates(point).find((candidate) => fits(candidate.box, avoidLine))
			if (!spot) continue
			placed.set(point.key, { key: point.key, ...spot })
			taken.push(spot.box)
		}
	}
	// Back in the caller's order, for a stable render.
	return points.flatMap((point) => {
		const label = placed.get(point.key)
		return label ? [label] : []
	})
}

/**
 * A carat count as a label: "47.5K", "140.3K", "850", "-1.2K". One decimal,
 * like the axis, because a full "140,302" is twice as wide and the labels are
 * for reading the plan at a glance; the hover readout has the exact number.
 */
export function formatLabelCarats(value: number): string {
	const rounded = Math.round(value)
	if (Math.abs(rounded) < 1000) return String(rounded)
	return `${(rounded / 1000).toFixed(1)}K`
}
