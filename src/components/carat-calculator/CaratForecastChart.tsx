import type React from "react"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { useReducedMotion } from "framer-motion"
import {
	Area,
	ComposedChart,
	CartesianGrid,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts"
import { AlertTriangle, ArrowDownToLine, ArrowUpToLine, ChevronDown } from "lucide-react"
import { useCalculatorData } from "../../services/CalculatorContext"
import type { BannerResources } from "../../hooks/bannerResources"
import { createIncomeProjection, projectionWalkOrder } from "../../utils/incomeProjection"
import { buildCaratForecast } from "../../utils/caratForecast"
import type { ForecastMarker } from "../../utils/caratForecast"
import { plannedBannerTarget, plannedBannerTimeline } from "../../utils/bannerHelpers"
import { formatDate, formatMonth } from "../../utils/dateFormat"
import type { ForecastPosition } from "../../hooks/useForecastPosition"

/**
 * THE CARAT FORECAST: free carats from today to past the last planned banner,
 * dropping at each banner by what its pulls spend.
 *
 * The data is utils/caratForecast, built from the engine's own `incomeTo` and
 * the rows' own results, so every dot on the line is the number its row shows.
 * This file only draws it.
 *
 * DRAWN WITH RECHARTS
 * --------------------
 * Recharts owns the plumbing: scales, ticks, resizing (ResponsiveContainer),
 * the hover crosshair and tooltip, keyboard stepping (its accessibility layer)
 * and the draw-in animation. This file owns what Recharts cannot know: the
 * data, the dots at each banner, the colour split at zero, and the readout.
 *
 * Colours are passed as CSS variables (`var(--color-brand)`), never hex, so
 * the twelve themes and colorblind mode still re-skin it by redefining tokens.
 *
 * FORM, PER THE DATAVIZ RULES
 * ---------------------------
 * - One series, so no legend; the heading names it.
 * - 2px line, a 10% wash under it, hairline solid gridlines.
 * - Selective direct labels: only the line's last value. Every other figure is
 *   in the crosshair tooltip, and in the screen-reader list below the chart
 *   (the "table view"); the planner rows under it are the visible table.
 * - Below zero the line turns the over-budget status colour, the same token the
 *   pull field uses, and the headline says "Short by" with an icon, so the
 *   warning never rides on colour alone.
 */

/** localStorage: whether the viewer folded the chart away. Absent means open. */
const OPEN_STORAGE_KEY = "uma-planner-forecast-open"
/** 12,345 → "12.3K". Axis ticks only; readouts use full numbers. */
function compactCarats(value: number): string {
	const abs = Math.abs(value)
	if (abs < 1000) return String(Math.round(value))
	const thousands = value / 1000
	return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}K`
}

const fullCarats = (value: number) => Math.round(value).toLocaleString("en-US")

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

interface CaratForecastChartProps {
	resources: BannerResources[]
	/** Which slot the page put it in; names the move button's direction. */
	position: ForecastPosition
	onMove: () => void
	/** Scroll into view on mount: true when it just moved here. */
	scrollIntoViewOnMount: boolean
	className?: string
}

export const CaratForecastChart: React.FC<CaratForecastChartProps> = ({
	resources,
	position,
	onMove,
	scrollIntoViewOnMount,
	className = "",
}) => {
	const {
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		leagueOfHeroesRankData,
		userPlannedBannerData,
		anniversaryEventData,
		userPlannedPurchaseData,
		incomeLedger,
		calculationConstants,
	} = useCalculatorData()

	const forecast = useMemo(() => {
		if (!userStatsData) return null
		return buildCaratForecast({
			projection: createIncomeProjection({
				userStatsData,
				clubRankData,
				teamTrialsRankData,
				championsMeetingRankData,
				leagueOfHeroesRankData,
				anniversaryEventData,
				userPlannedPurchaseData,
				incomeLedger,
				constants: calculationConstants,
			}),
			walkOrder: projectionWalkOrder(userPlannedBannerData),
			resources,
			currentFreeCarats: userStatsData.current_carat || 0,
		})
	}, [
		userStatsData,
		clubRankData,
		teamTrialsRankData,
		championsMeetingRankData,
		leagueOfHeroesRankData,
		anniversaryEventData,
		userPlannedPurchaseData,
		incomeLedger,
		calculationConstants,
		userPlannedBannerData,
		resources,
	])

	// Folded or open, remembered per device. Read in an effect, never in the
	// initialiser: the calculator route is prerendered (frontend-ui.md).
	const [open, setOpen] = useState(true)
	useEffect(() => {
		try {
			// eslint-disable-next-line react-hooks/set-state-in-effect -- storage only exists after mount, as in TeamDrawerProvider
			if (localStorage.getItem(OPEN_STORAGE_KEY) === "false") setOpen(false)
		} catch {
			// Storage blocked: stay open, which is the default anyway.
		}
	}, [])
	const toggleOpen = () => {
		setOpen((was) => {
			try {
				localStorage.setItem(OPEN_STORAGE_KEY, String(!was))
			} catch {
				// Not remembered this time; the toggle itself still works.
			}
			return !was
		})
	}

	const sectionRef = useRef<HTMLElement>(null)
	useEffect(() => {
		if (!scrollIntoViewOnMount) return
		const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
		sectionRef.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" })
	}, [scrollIntoViewOnMount])

	if (!forecast) return null

	// The headline: the plan's tightest moment, after the banner that causes it.
	const charged = forecast.markers.filter((m) => !m.excluded)
	const lowest = charged.reduce<ForecastMarker | null>(
		(low, m) => (!low || m.after < low.after ? m : low),
		null
	)
	const moveLabel = position === "top" ? "Move below banners" : "Move above banners"
	const bannerName = (marker: ForecastMarker) => {
		const banner = userPlannedBannerData[marker.index]
		const target = banner ? plannedBannerTarget(banner) : null
		return target?.banner?.name ?? "a banner"
	}

	return (
		<section
			ref={sectionRef}
			className={`card-panel overflow-hidden ${className}`}
			aria-labelledby="carat-forecast-heading"
		>
			{/* Two buttons side by side, never one inside the other: the heading
			    folds the chart, the button on the right moves it. */}
			<div className="flex items-start gap-2 pr-3">
				<button
					type="button"
					onClick={toggleOpen}
					aria-expanded={open}
					className="flex min-w-0 flex-1 items-start gap-2 py-3 pl-4 text-left transition hover:opacity-80"
				>
					<ChevronDown
						className={`mt-0.5 h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "" : "-rotate-90"}`}
						aria-hidden="true"
					/>
					<div className="min-w-0 flex-1">
						<h2 id="carat-forecast-heading" className="font-display text-sm font-semibold text-gray-100">
							Carat forecast
						</h2>
						{lowest && (
							<p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-400">
								{lowest.after < 0 ? (
									<>
										<AlertTriangle
											className="h-3.5 w-3.5 shrink-0 text-(--color-pull-over)"
											aria-hidden="true"
										/>
										<span className="truncate">
											Short by <span className="font-semibold text-gray-200">{fullCarats(-lowest.after)}</span>{" "}
											carats after {bannerName(lowest)}
										</span>
									</>
								) : (
									<span className="truncate">
										Lowest point:{" "}
										<span className="font-semibold text-gray-200">{fullCarats(lowest.after)}</span>{" "}
										carats, after {bannerName(lowest)}
									</span>
								)}
							</p>
						)}
					</div>
				</button>
				<button
					type="button"
					onClick={onMove}
					title={moveLabel}
					aria-label={moveLabel}
					className="mt-2 inline-flex shrink-0 items-center gap-1.5 rounded-md border border-edge px-2 py-1 text-xs font-medium text-gray-300 transition hover:bg-gray-700/40 hover:text-gray-100"
				>
					{position === "top" ? (
						<ArrowDownToLine className="h-3.5 w-3.5" aria-hidden="true" />
					) : (
						<ArrowUpToLine className="h-3.5 w-3.5" aria-hidden="true" />
					)}
					{/* The icon alone on a phone, where the headline needs the room. */}
					<span className="hidden sm:inline" aria-hidden="true">
						{moveLabel}
					</span>
				</button>
			</div>
			{open && (
				<ForecastPlot
					forecast={forecast}
					bannerName={bannerName}
					endDateOf={(marker) => {
						const banner = userPlannedBannerData[marker.index]
						return banner ? plannedBannerTimeline(banner)?.end_date ?? null : null
					}}
				/>
			)}
		</section>
	)
}

interface PlotProps {
	forecast: NonNullable<ReturnType<typeof buildCaratForecast>>
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
				</ComposedChart>
			</ResponsiveContainer>

			{/* The table view, for screen readers: every banner's numbers in order.
			    Sighted readers have the planner rows, which carry the same. */}
			<ul className="sr-only">
				{markers.map((m) => (
					<li key={`${m.index}-${m.t}`}>
						{bannerName(m)}, ends {formatDate(endDateOf(m))}: {fullCarats(m.before)} free carats
						available
						{m.excluded ? ", left out of the projection" : `, ${fullCarats(m.after)} left after its pulls`}
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
						{fullCarats(datum.value)} carats
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
				{fullCarats(marker.before)} carats
			</div>
			<div className="font-medium text-gray-300">{name}</div>
			<div className="text-gray-400">Ends {formatDate(endDate)}</div>
			{marker.excluded ? (
				<div className="mt-1 text-gray-400">Left out of the projection</div>
			) : spent > 0 ? (
				<div className="mt-1 text-gray-400">
					Pulls spend {fullCarats(spent)},{" "}
					{marker.after < 0 ? (
						<span className="font-semibold text-(--color-pull-over)">
							short by {fullCarats(-marker.after)}
						</span>
					) : (
						<>leaving {fullCarats(marker.after)}</>
					)}
				</div>
			) : (
				<div className="mt-1 text-gray-400">No free carats spent here</div>
			)}
		</>
	)
}
