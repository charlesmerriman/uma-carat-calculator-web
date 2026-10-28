/**
 * A small line of a pick's use across events (mock 04-guides-row-open.png):
 * inline SVG, no chart library, a brand line over a brand/35 fill and a dot
 * on the newest point. The scale starts at 0 so a flat line at the top still
 * reads as "used every time", and the label reads the series out for a
 * screen reader. `marker` draws a dashed upright at one point (the event
 * running now or next), so past and future read apart.
 */

const WIDTH = 220
const HEIGHT = 38
// Room for the end dot at the edges.
const PAD = 3

export function Sparkline({ points, label, marker = null }: { points: number[]; label: string; marker?: number | null }) {
	if (points.length === 0) return null
	const top = Math.max(1, ...points)
	const step = points.length > 1 ? (WIDTH - PAD * 2) / (points.length - 1) : 0
	const xy = points.map((value, index) => [PAD + index * step, HEIGHT - PAD - (value / top) * (HEIGHT - PAD * 2)] as const)
	const line = xy.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
	const area = `${line} L${xy[xy.length - 1][0].toFixed(1)},${HEIGHT} L${xy[0][0].toFixed(1)},${HEIGHT} Z`
	const [lastX, lastY] = xy[xy.length - 1]
	const markX = marker !== null && marker >= 0 && marker < xy.length ? xy[marker][0] : null
	return (
		<svg
			role="img"
			aria-label={`${label}: ${points.join(", ")}`}
			viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
			preserveAspectRatio="none"
			className="block h-[38px] w-full max-w-[14rem] text-brand"
		>
			<path d={area} className="fill-brand/35" />
			{markX !== null && (
				<line x1={markX} x2={markX} y1={0} y2={HEIGHT} className="stroke-gray-400" strokeWidth={1} strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
			)}
			<path d={line} fill="none" stroke="currentColor" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
			<circle cx={lastX} cy={lastY} r={2.5} fill="currentColor" />
		</svg>
	)
}
