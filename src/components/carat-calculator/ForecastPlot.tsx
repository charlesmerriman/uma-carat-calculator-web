import type React from "react"
import { useId, useMemo, useRef, useState } from "react"
import { useReducedMotion } from "framer-motion"
import {
	Area,
	Bar,
	Cell,
	ComposedChart,
	CartesianGrid,
	ReferenceDot,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts"
import type { CaratForecast, ForecastMarker, PullBar, SkipMarker } from "../../utils/caratForecast"
import { formatCarats } from "../../utils/caratForecast"
import { formatDate, formatMonth } from "../../utils/dateFormat"

/**
 * THE FORECAST PLOT, drawn with Recharts. Loaded lazily (loadForecastPlot):
 * this file and Recharts form their own chunk, downloaded only by the
 * calculator, so no other page pays for the library. The heading, the data,
 * the unit switch and the move button live in CaratForecastChart, in the main
 * bundle.
 *
 * TWO VIEWS
 * ---------
 * - Carats: free carats over time, a dot at each banner where the line meets
 *   its row, a red dot at each skipped PvP event where it would have paid.
 * - Pulls: one bar per banner, the row's Max Pulls without the banner's own
 *   free pulls. A bar, not a line, because that figure exists only at a
 *   banner: it depends on the banner's kind (uma or support tickets) and its
 *   paid-pull settings, so there is no honest value for the days between.
 *
 * Both views draw the 200-pull pity line and send a click on a banner back to
 * the page, which scrolls to that row and flashes it.
 */

/** 12,345 → "12.3K". Axis ticks only; readouts use full numbers. */
function compactCarats(value: number): string {
	const abs = Math.abs(value)
	if (abs < 1000) return String(Math.round(value))
	const thousands = value / 1000
	return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}K`
}

/**
 * Round ticks (1, 2, 5 x 10^n) covering [min, max] in about `count` steps,
 * outward on both ends so nothing runs off the plot. Ours rather than
 * Recharts': its own rounding picked 12.5K steps, which nobody counts in.
 */
function niceTicks(min: number, max: number, count: number): number[] {
	const span = Math.max(1, max - min)
	const raw = span / count
	const magnitude = 10 ** Math.floor(Math.log10(raw))
	const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude
	const first = Math.floor(min / step)
	const last = Math.max(first + 1, Math.ceil(max / step))
	const ticks: number[] = []
	for (let i = first; i <= last; i++) ticks.push(Math.round(i * step))
	return ticks
}

/** First-of-month UTC instants inside [start, end]. */
function monthStarts(start: number, end: number): number[] {
	const out: number[] = []
	const d = new Date(start)
	let cursor = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)
	while (cursor <= end) {
		out.push(cursor)
		const c = new Date(cursor)
		cursor = Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + 1, 1)
	}
	return out
}

/** One row of the carats view's data: a vertex of the line, maybe a dot. */
interface LineDatum {
	t: number
	value: number
	/** Set on the vertex where a banner's dot sits (its "before" value). */
	marker?: ForecastMarker
	/** Set on a vertex added for a skipped PvP event (on the line already). */
	skip?: SkipMarker
}

/** One bar of the pulls view. */
interface BarDatum {
	label: string
	pulls: number
	bar: PullBar
}

export type ForecastUnit = "carats" | "pulls"

export interface PlotProps {
	forecast: CaratForecast
	unit: ForecastUnit
	pullBars: PullBar[]
	skipMarkers: SkipMarker[]
	/** Pulls per pity copy (PULLS_PER_PITY_COPY, 200). */
	pityPulls: number
	/** Carats per pull, from the API's calculation constants. */
	pullCost: number
	bannerName: (marker: ForecastMarker) => string
	endDateOf: (marker: ForecastMarker) => string | null
	/** Scroll to this banner's row and flash it. */
	onSelectMarker: (marker: ForecastMarker) => void
}

const AXIS_TICK = { fill: "var(--color-gray-400)", fontSize: 11 }
const RACE_KIND_LABEL: Record<string, string> = {
	champions_meeting: "Champions Meeting",
	league_of_heroes: "League of Heroes",
}

const ForecastPlot: React.FC<PlotProps> = ({
	forecast,
	unit,
	pullBars,
	skipMarkers,
	pityPulls,
	pullCost,
	bannerName,
	endDateOf,
	onSelectMarker,
}) => {
	const reduceMotion = useReducedMotion() ?? false
	const gradientId = useId()
	const { points, markers, start, end } = forecast

	// TOUCH: tap once to read, tap again to go. On a phone the tap that opens
	// the readout is also a click; jumping on it would scroll the reader away
	// from what they just asked to see. A mouse has hover for reading, so a
	// click goes at once.
	const [touch, setTouch] = useState(false)
	const armedRef = useRef<number | null>(null)
	const select = (marker: ForecastMarker) => {
		if (touch && armedRef.current !== marker.index) {
			armedRef.current = marker.index
			return
		}
		armedRef.current = null
		onSelectMarker(marker)
	}

	// Recharts reads one array. Each banner's dot rides on the vertex where the
	// line meets the row's number; a skipped event gets a vertex of its own,
	// placed ON the line (buildSkipMarkers), so the line's shape is unchanged.
	const lineData = useMemo<LineDatum[]>(() => {
		const rows: LineDatum[] = points.map((p) => ({ t: p.t, value: p.value }))
		for (const marker of markers) {
			const at = rows.find((r) => r.t === marker.t && r.value === marker.before && !r.marker)
			if (at) at.marker = marker
		}
		for (const skip of skipMarkers) {
			// After every vertex at or before its instant, so it never splits a
			// banner's arrival from its drop.
			const i = rows.findIndex((r) => r.t > skip.t)
			rows.splice(i === -1 ? rows.length : i, 0, { t: skip.t, value: skip.value, skip })
		}
		return rows
	}, [points, markers, skipMarkers])

	const barData = useMemo<BarDatum[]>(
		() =>
			pullBars.map((bar) => ({
				label: formatDate(endDateOf(bar.marker)),
				pulls: bar.pulls,
				bar,
			})),
		[pullBars, endDateOf]
	)

	// THE SPLIT AT ZERO (carats view). One gradient, two stops at the same
	// offset: brand above zero, the over-budget colour below. The offset is
	// where zero falls in the shape's bounding box, which for both the line and
	// the filled area runs from the highest value to the lowest (or to zero).
	const values = points.map((p) => p.value)
	const high = Math.max(...values)
	const low = Math.min(...values)
	const zeroOffset = high <= 0 ? 0 : low >= 0 ? 1 : high / (high - low)
	const last = points[points.length - 1]

	// THE PITY LINE. In pulls it is always drawn: reaching it is the question
	// the view answers. In carats it is 200 pulls' worth, drawn only when the
	// line comes near it; otherwise a plan holding 8,000 would be squashed
	// flat under an empty band up to 30,000.
	const pityCarats = pityPulls * pullCost
	const showCaratPity = high > 0 && pityCarats <= high * 1.25
	const caratTicks = niceTicks(Math.min(0, low), Math.max(high, showCaratPity ? pityCarats : high), 4)
	const pullTicks = niceTicks(0, Math.max(pityPulls, ...pullBars.map((b) => b.pulls)), 4)
	// Set just ABOVE its line ("inside bottom left" of the band above it):
	// below it, it sat on the first bar and on the start of the line.
	const pityLabel = `${pityPulls} pulls (pity)`

	const tooltip = (
		<Tooltip
			content={(props) => (
				<ForecastTooltip
					active={props.active}
					payload={props.payload}
					touch={touch}
					pityPulls={pityPulls}
					bannerName={bannerName}
					endDateOf={endDateOf}
				/>
			)}
			cursor={unit === "carats" ? { stroke: "var(--color-gray-400)", strokeWidth: 1 } : { fill: "var(--color-gray-700)", fillOpacity: 0.35 }}
			// Pinned near the top of the plot, so it never covers the mark it
			// describes or runs into the heading above the chart.
			position={{ y: 8 }}
			isAnimationActive={false}
		/>
	)

	if (unit === "pulls" && barData.length === 0) {
		return (
			<p className="px-4 pb-4 text-sm text-gray-400">
				There are no pull banners in this plan to show. Step-ups count steps, so they only
				appear in the carats view.
			</p>
		)
	}

	return (
		<div
			// ResponsiveContainer fills this box, so its height is the chart's.
			className="h-[198px] px-1 pb-2 sm:h-[248px]"
			onPointerDown={(event) => setTouch(event.pointerType === "touch")}
		>
			<ResponsiveContainer width="100%" height="100%">
				{unit === "carats" ? (
					<ComposedChart data={lineData} margin={{ top: 16, right: 20, bottom: 4, left: 4 }}>
						<defs>
							<linearGradient id={`${gradientId}-stroke`} x1="0" y1="0" x2="0" y2="1">
								<stop offset={zeroOffset} style={{ stopColor: "var(--color-brand)" }} />
								<stop offset={zeroOffset} style={{ stopColor: "var(--color-pull-over)" }} />
							</linearGradient>
							<linearGradient id={`${gradientId}-fill`} x1="0" y1="0" x2="0" y2="1">
								<stop offset={zeroOffset} style={{ stopColor: "var(--color-brand)", stopOpacity: 0.1 }} />
								<stop offset={zeroOffset} style={{ stopColor: "var(--color-pull-over)", stopOpacity: 0.1 }} />
							</linearGradient>
						</defs>
						<CartesianGrid vertical={false} stroke="var(--color-gray-700)" />
						<XAxis
							dataKey="t"
							type="number"
							scale="time"
							domain={[start, end]}
							ticks={monthStarts(start, end)}
							tickFormatter={(t: number) => formatMonth(new Date(t))}
							minTickGap={28}
							tick={AXIS_TICK}
							axisLine={false}
							tickLine={false}
						/>
						<YAxis
							domain={[caratTicks[0], caratTicks[caratTicks.length - 1]]}
							ticks={caratTicks}
							tickFormatter={compactCarats}
							tick={AXIS_TICK}
							axisLine={false}
							tickLine={false}
							width={44}
						/>
						<ReferenceLine y={0} stroke="var(--color-gray-500)" />
						{showCaratPity && (
							<ReferenceLine
								y={pityCarats}
								stroke="var(--color-gray-400)"
								label={{ value: pityLabel, position: "insideBottomLeft", fill: "var(--color-gray-400)", fontSize: 11 }}
							/>
						)}
						{tooltip}
						<Area
							type="linear"
							dataKey="value"
							baseValue={0}
							stroke={`url(#${gradientId}-stroke)`}
							strokeWidth={2}
							fill={`url(#${gradientId}-fill)`}
							isAnimationActive={!reduceMotion}
							animationDuration={900}
							dot={(props: { cx?: number; cy?: number; index?: number; payload?: LineDatum }) => (
								<LineDot key={`dot-${props.index}`} {...props} onSelect={select} />
							)}
							activeDot={{ r: 5, stroke: "var(--card-fill)", strokeWidth: 2, fill: "var(--color-brand)" }}
						/>
						{/* The one direct label: where the line ends up. An invisible
						    dot at the last point, carrying the number above it. */}
						<ReferenceDot
							x={last.t}
							y={last.value}
							r={0}
							label={{
								value: formatCarats(last.value),
								// For a zero-size dot, "inside bottom right" means above
								// and to the left of the point, clear of the plot's edge.
								position: "insideBottomRight",
								offset: 8,
								fill: "var(--color-gray-200)",
								fontSize: 11,
								fontWeight: 600,
							}}
						/>
					</ComposedChart>
				) : (
					<ComposedChart data={barData} margin={{ top: 16, right: 20, bottom: 4, left: 4 }}>
						<CartesianGrid vertical={false} stroke="var(--color-gray-700)" />
						<XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={12} />
						<YAxis
							domain={[0, pullTicks[pullTicks.length - 1]]}
							ticks={pullTicks}
							tick={AXIS_TICK}
							axisLine={false}
							tickLine={false}
							width={44}
						/>
						{tooltip}
						<Bar
							dataKey="pulls"
							maxBarSize={24}
							radius={[4, 4, 0, 0]}
							isAnimationActive={!reduceMotion}
							animationDuration={600}
							cursor="pointer"
							onClick={(_data: unknown, index: number) => {
								const bar = barData[index]?.bar
								if (bar) select(bar.marker)
							}}
						>
							{/* Solid where the bar reaches the pity, faint where it falls
							    short, hollow for a row left out of the projection. The
							    readout says the same in words. */}
							{barData.map(({ bar }) => (
								<Cell
									key={`${bar.marker.index}-${bar.marker.t}`}
									style={{
										fill: bar.marker.excluded ? "var(--card-fill)" : "var(--color-brand)",
										fillOpacity: bar.marker.excluded || bar.pulls >= pityPulls ? 1 : 0.45,
										stroke: bar.marker.excluded ? "var(--color-brand)" : "none",
										strokeWidth: 1.5,
									}}
								/>
							))}
						</Bar>
						{/* After the bars, so the line reads across them. */}
						<ReferenceLine
							y={pityPulls}
							stroke="var(--color-gray-300)"
							label={{ value: pityLabel, position: "insideBottomLeft", fill: "var(--color-gray-300)", fontSize: 11 }}
						/>
					</ComposedChart>
				)}
			</ResponsiveContainer>

			{/* The table view, for screen readers: every banner's numbers in order.
			    Sighted readers have the planner rows, which carry the same. */}
			<ul className="sr-only">
				{markers.map((m) => (
					<li key={`${m.index}-${m.t}`}>
						{bannerName(m)}, ends {formatDate(endDateOf(m))}: {formatCarats(m.before)} free carats
						available
						{m.excluded ? ", left out of the projection" : `, ${formatCarats(m.after)} left after its pulls`}
					</li>
				))}
				{skipMarkers.map((s) => (
					<li key={`skip-${s.kind}-${s.t}`}>
						Skipping {s.name}, {formatDate(new Date(s.t).toISOString())}: its rewards are not counted
					</li>
				))}
			</ul>
		</div>
	)
}

/**
 * A dot on the line: a banner (clickable, with a hit area wider than the dot)
 * or a skipped PvP event (red). Every other vertex draws nothing.
 */
const LineDot: React.FC<{
	cx?: number
	cy?: number
	payload?: LineDatum
	onSelect: (marker: ForecastMarker) => void
}> = ({ cx, cy, payload, onSelect }) => {
	if (cx === undefined || cy === undefined || !payload) return <g />
	if (payload.skip) {
		// Red, the over-budget token: a skip is money left on the table, and
		// the token follows the theme and colorblind mode like the rest.
		return (
			<circle
				cx={cx}
				cy={cy}
				r={4.5}
				strokeWidth={2}
				style={{ stroke: "var(--card-fill)", fill: "var(--color-pull-over)" }}
			/>
		)
	}
	const marker = payload.marker
	if (!marker) return <g />
	const short = marker.after < 0 && !marker.excluded
	return (
		<g className="cursor-pointer" onClick={() => onSelect(marker)}>
			{/* The hit area: a 24px target around an 9px dot. */}
			<circle cx={cx} cy={cy} r={12} fill="transparent" />
			<circle
				cx={cx}
				cy={cy}
				r={4.5}
				strokeWidth={2}
				style={{
					stroke: marker.excluded ? "var(--color-brand)" : "var(--card-fill)",
					fill: marker.excluded
						? "var(--card-fill)"
						: short
						? "var(--color-pull-over)"
						: "var(--color-brand)",
				}}
			/>
		</g>
	)
}

// Only the fields of Recharts' tooltip props this readout reads.
type ForecastTooltipProps = {
	active?: boolean
	payload?: ReadonlyArray<{ payload?: unknown }>
	touch: boolean
	pityPulls: number
	bannerName: (marker: ForecastMarker) => string
	endDateOf: (marker: ForecastMarker) => string | null
}

/** The hover readout. Recharts hands it the nearest vertex or bar. */
const ForecastTooltip: React.FC<ForecastTooltipProps> = ({
	active,
	payload,
	touch,
	pityPulls,
	bannerName,
	endDateOf,
}) => {
	const datum = payload?.[0]?.payload as (LineDatum & Partial<BarDatum>) | undefined
	if (!active || !datum) return null
	const goHint = touch ? "Tap again to go to its row" : "Click to go to its row"

	let body: React.ReactNode
	if (datum.bar) {
		const { bar } = datum
		const short = pityPulls - bar.pulls
		body = (
			<>
				<div className="text-sm font-semibold text-gray-100 tabular-nums">{bar.pulls} pulls</div>
				<div className="font-medium text-gray-300">{bannerName(bar.marker)}</div>
				<div className="text-gray-400">Ends {formatDate(endDateOf(bar.marker))}</div>
				<div className="mt-1 text-gray-400 tabular-nums">
					{bar.breakdown.tickets} from tickets, {bar.breakdown.freeCaratPulls} from free carats,{" "}
					{bar.breakdown.paidPulls} from paid
				</div>
				<div className="text-gray-400">
					{bar.marker.excluded
						? "Left out of the projection"
						: short <= 0
						? `Enough for a ${pityPulls}-pull pity`
						: `${short} short of a ${pityPulls}-pull pity`}
				</div>
				<div className="mt-1 text-gray-500">{goHint}</div>
			</>
		)
	} else if (datum.marker) {
		body = (
			<>
				<MarkerReadout marker={datum.marker} name={bannerName(datum.marker)} endDate={endDateOf(datum.marker)} />
				<div className="mt-1 text-gray-500">{goHint}</div>
			</>
		)
	} else if (datum.skip) {
		body = (
			<>
				<div className="text-sm font-semibold text-(--color-pull-over)">Skipped</div>
				<div className="font-medium text-gray-300">{datum.skip.name}</div>
				<div className="text-gray-400">
					{RACE_KIND_LABEL[datum.skip.kind] ?? "PvP event"}, {formatDate(new Date(datum.t).toISOString())}
				</div>
				<div className="mt-1 text-gray-400">Its rewards aren't counted in your carats.</div>
			</>
		)
	} else {
		body = (
			<>
				<div className="text-sm font-semibold text-gray-100 tabular-nums">
					{formatCarats(datum.value)} carats
				</div>
				<div className="text-gray-400">{formatDate(new Date(datum.t).toISOString())}</div>
			</>
		)
	}

	return (
		<div className="max-w-[15rem] rounded-md border border-edge bg-gray-800 px-3 py-2 text-xs shadow-lg">
			{body}
		</div>
	)
}

const MarkerReadout: React.FC<{ marker: ForecastMarker; name: string; endDate: string | null }> = ({
	marker,
	name,
	endDate,
}) => {
	const spent = marker.before - marker.after
	return (
		<>
			<div className="text-sm font-semibold text-gray-100 tabular-nums">
				{formatCarats(marker.before)} carats
			</div>
			<div className="font-medium text-gray-300">{name}</div>
			<div className="text-gray-400">Ends {formatDate(endDate)}</div>
			{marker.excluded ? (
				<div className="mt-1 text-gray-400">Left out of the projection</div>
			) : spent > 0 ? (
				<div className="mt-1 text-gray-400">
					Pulls spend {formatCarats(spent)},{" "}
					{marker.after < 0 ? (
						<span className="font-semibold text-(--color-pull-over)">
							short by {formatCarats(-marker.after)}
						</span>
					) : (
						<>leaving {formatCarats(marker.after)}</>
					)}
				</div>
			) : (
				<div className="mt-1 text-gray-400">No free carats spent here</div>
			)}
		</>
	)
}

export default ForecastPlot
