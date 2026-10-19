import type React from "react"
import { useId, useMemo } from "react"
import { useReducedMotion } from "framer-motion"
import {
	Area,
	ComposedChart,
	CartesianGrid,
	ReferenceDot,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts"
import type { CaratForecast, ForecastMarker } from "../../utils/caratForecast"
import { formatCarats } from "../../utils/caratForecast"
import { formatDate, formatMonth } from "../../utils/dateFormat"

/**
 * THE FORECAST PLOT, drawn with Recharts. Loaded lazily (loadForecastPlot):
 * this file and Recharts form their own chunk, downloaded only by the
 * calculator, so no other page pays for the library. The heading, the data
 * and the move button live in CaratForecastChart, in the main bundle.
 */

/** 12,345 → "12.3K". Axis ticks only; readouts use full numbers. */
function compactCarats(value: number): string {
	const abs = Math.abs(value)
	if (abs < 1000) return String(Math.round(value))
	const thousands = value / 1000
	return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}K`
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

/** One row of the chart's data: a vertex of the line, maybe a banner's dot. */
interface ChartDatum {
	t: number
	value: number
	/** Set on the vertex where a banner's dot sits (its "before" value). */
	marker?: ForecastMarker
}

export interface PlotProps {
	forecast: CaratForecast
	bannerName: (marker: ForecastMarker) => string
	endDateOf: (marker: ForecastMarker) => string | null
}

const ForecastPlot: React.FC<PlotProps> = ({ forecast, bannerName, endDateOf }) => {
	const reduceMotion = useReducedMotion() ?? false
	const gradientId = useId()
	const { points, markers, start, end } = forecast

	// Recharts reads one array. Each banner's dot rides on the vertex where the
	// line meets the row's number (the first point at its instant with that
	// value), so the dot and the hover both find it there.
	const data = useMemo<ChartDatum[]>(() => {
		const rows: ChartDatum[] = points.map((p) => ({ t: p.t, value: p.value }))
		for (const marker of markers) {
			const at = rows.find((r) => r.t === marker.t && r.value === marker.before && !r.marker)
			if (at) at.marker = marker
		}
		return rows
	}, [points, markers])

	// THE SPLIT AT ZERO. One gradient, two stops at the same offset: brand above
	// zero, the over-budget colour below. The offset is where zero falls in the
	// shape's bounding box, which for both the line and the filled area runs
	// from the highest value down to the lowest (or down to zero, for an area
	// that never goes negative, where the offset is 1 and it is all brand).
	const values = points.map((p) => p.value)
	const high = Math.max(...values)
	const low = Math.min(...values)
	const zeroOffset = high <= 0 ? 0 : low >= 0 ? 1 : high / (high - low)
	const last = points[points.length - 1]

	return (
		// ResponsiveContainer fills this box, so its height is the chart's.
		<div className="h-[198px] px-1 pb-2 sm:h-[248px]">
			<ResponsiveContainer width="100%" height="100%">
				<ComposedChart data={data} margin={{ top: 16, right: 20, bottom: 4, left: 4 }}>
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
						tick={{ fill: "var(--color-gray-400)", fontSize: 11 }}
						axisLine={false}
						tickLine={false}
					/>
					<YAxis
						domain={[(dataMin: number) => Math.min(0, dataMin), "auto"]}
						tickFormatter={compactCarats}
						tick={{ fill: "var(--color-gray-400)", fontSize: 11 }}
						axisLine={false}
						tickLine={false}
						width={44}
					/>
					<ReferenceLine y={0} stroke="var(--color-gray-500)" />
					<Tooltip
						content={(props) => (
							<ForecastTooltip {...props} bannerName={bannerName} endDateOf={endDateOf} />
						)}
						cursor={{ stroke: "var(--color-gray-400)", strokeWidth: 1 }}
						// Pinned near the top of the plot, so it never covers the dot
						// it describes or runs into the heading above the chart.
						position={{ y: 8 }}
						isAnimationActive={false}
					/>
					<Area
						type="linear"
						dataKey="value"
						baseValue={0}
						stroke={`url(#${gradientId}-stroke)`}
						strokeWidth={2}
						fill={`url(#${gradientId}-fill)`}
						isAnimationActive={!reduceMotion}
						animationDuration={900}
						dot={(props: { cx?: number; cy?: number; index?: number; payload?: ChartDatum }) => {
							const marker = props.payload?.marker
							if (!marker || props.cx === undefined || props.cy === undefined) {
								return <g key={`none-${props.index}`} />
							}
							const short = marker.after < 0 && !marker.excluded
							return (
								<circle
									key={`dot-${props.index}`}
									cx={props.cx}
									cy={props.cy}
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
							)
						}}
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
			</ul>
		</div>
	)
}

// Only the two fields of Recharts' tooltip props this readout reads.
type ForecastTooltipProps = {
	active?: boolean
	payload?: ReadonlyArray<{ payload?: unknown }>
	bannerName: (marker: ForecastMarker) => string
	endDateOf: (marker: ForecastMarker) => string | null
}

/** The hover readout. Recharts hands it the nearest vertex. */
const ForecastTooltip: React.FC<ForecastTooltipProps> = ({ active, payload, bannerName, endDateOf }) => {
	const datum = payload?.[0]?.payload as ChartDatum | undefined
	if (!active || !datum) return null
	return (
		<div className="max-w-[14rem] rounded-md border border-edge bg-gray-800 px-3 py-2 text-xs shadow-lg">
			{datum.marker ? (
				<MarkerReadout
					marker={datum.marker}
					name={bannerName(datum.marker)}
					endDate={endDateOf(datum.marker)}
				/>
			) : (
				<>
					<div className="text-sm font-semibold text-gray-100 tabular-nums">
						{formatCarats(datum.value)} carats
					</div>
					<div className="text-gray-400">{formatDate(new Date(datum.t).toISOString())}</div>
				</>
			)}
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
