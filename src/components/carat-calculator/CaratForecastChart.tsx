import type React from "react"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
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
 * WHY HAND-DRAWN SVG, NOT A CHART LIBRARY
 * ---------------------------------------
 * It is one series on one axis. Recharts (the usual pick) would add roughly
 * 100 KB gzipped to the calculator chunk for that, and its colours are props,
 * so every theme would need JavaScript to re-skin it. Drawn here, the marks are
 * plain SVG wearing Tailwind classes (`stroke-brand`, `fill-gray-400`), and the
 * twelve themes and colorblind mode re-skin it the way they re-skin everything
 * else: by redefining the tokens.
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
const MARGIN = { top: 16, right: 16, bottom: 26, left: 48 }
/** Hover within this many pixels of a banner's dot snaps the readout to it. */
const MARKER_SNAP_PX = 14

/** 12,345 → "12.3K". Axis ticks only; readouts use full numbers. */
function compactCarats(value: number): string {
	const abs = Math.abs(value)
	if (abs < 1000) return String(Math.round(value))
	const thousands = value / 1000
	return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}K`
}

const fullCarats = (value: number) => Math.round(value).toLocaleString("en-US")

/**
 * Round tick steps (1, 2, 2.5, 5 x 10^n) covering [min, max] in about `count`
 * steps. Always includes 0 when the range crosses it, because zero is the line
 * that matters here: below it is a carat debt.
 */
function niceTicks(min: number, max: number, count: number): number[] {
	const span = Math.max(1, max - min)
	const raw = span / count
	const magnitude = 10 ** Math.floor(Math.log10(raw))
	const step =
		[1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude
	// Outward on both ends: the first tick at or below `min`, the last at or
	// above `max`, so the line never runs off the plot.
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

/** The readout's width cap (14rem) plus its 10px gap from the crosshair. */
const TOOLTIP_ROOM = 234

/** Where the readout sits: right of the crosshair, left of it, or across the plot. */
function tooltipSide(crosshairX: number, width: number): React.CSSProperties {
	const fitsRight = crosshairX + TOOLTIP_ROOM <= width
	const fitsLeft = crosshairX - TOOLTIP_ROOM >= 0
	if (fitsRight && (!fitsLeft || crosshairX <= width / 2)) {
		return { left: crosshairX + 10, width: "max-content" }
	}
	if (fitsLeft) return { right: width - crosshairX + 10, width: "max-content" }
	return { left: MARGIN.left, right: MARGIN.right, maxWidth: "none" }
}

/** What the readout is showing: a banner's dot, or a plain day on the line. */
type Readout =
	| { kind: "marker"; marker: ForecastMarker }
	| { kind: "day"; t: number; value: number }

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
	const containerRef = useRef<HTMLDivElement>(null)
	const [width, setWidth] = useState(0)
	const [readout, setReadout] = useState<Readout | null>(null)
	// Keyboard position among the banner dots; -1 is "not stepping".
	const [keyIndex, setKeyIndex] = useState(-1)
	const reduceMotion = useReducedMotion() ?? false
	const clipId = useId()

	// The SVG is drawn at its real pixel width, not stretched through a
	// viewBox, so its text stays at its true size at every width. Measured in
	// an effect: there is no width to read during render.
	useEffect(() => {
		const el = containerRef.current
		if (!el) return
		const measure = () => setWidth(el.clientWidth)
		measure()
		const observer = new ResizeObserver(measure)
		observer.observe(el)
		return () => observer.disconnect()
	}, [])

	const height = width > 0 && width < 640 ? 190 : 240
	const plotW = Math.max(0, width - MARGIN.left - MARGIN.right)
	const plotH = height - MARGIN.top - MARGIN.bottom

	const { points, markers, start, end } = forecast
	const values = points.map((p) => p.value)
	const yTicks = niceTicks(Math.min(0, ...values), Math.max(0, ...values), height < 200 ? 3 : 4)
	const yMin = yTicks[0]
	const yMax = yTicks[yTicks.length - 1]

	const x = (t: number) => MARGIN.left + ((t - start) / (end - start)) * plotW
	const y = (v: number) => MARGIN.top + (1 - (v - yMin) / (yMax - yMin)) * plotH
	const zeroY = y(0)

	const linePath = points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.value).toFixed(1)}`).join("")
	const last = points[points.length - 1]
	const areaPath = `${linePath}L${x(last.t).toFixed(1)},${zeroY.toFixed(1)}L${x(points[0].t).toFixed(1)},${zeroY.toFixed(1)}Z`

	// Month ticks, thinned so labels never touch: about one per 72px.
	const months = monthStarts(start, end)
	const every = Math.max(1, Math.ceil(months.length / Math.max(1, Math.floor(plotW / 72))))
	const xTicks = months.filter((_, i) => i % every === 0)

	/** The line's value at an instant: the last vertex at or before it. */
	const nearestDay = (t: number): Readout => {
		let best = points[0]
		for (const p of points) {
			if (Math.abs(p.t - t) < Math.abs(best.t - t) || p.t === best.t) best = p
		}
		return { kind: "day", t: best.t, value: best.value }
	}

	const handlePointer = (event: React.PointerEvent<SVGSVGElement>) => {
		const rect = event.currentTarget.getBoundingClientRect()
		const px = event.clientX - rect.left
		if (px < MARGIN.left - 4 || px > width - MARGIN.right + 4) {
			setReadout(null)
			return
		}
		const nearMarker = markers.reduce<ForecastMarker | null>((bestMarker, m) => {
			const d = Math.abs(x(m.t) - px)
			if (d > MARKER_SNAP_PX) return bestMarker
			return !bestMarker || d < Math.abs(x(bestMarker.t) - px) ? m : bestMarker
		}, null)
		const t = start + ((px - MARGIN.left) / plotW) * (end - start)
		setReadout(nearMarker ? { kind: "marker", marker: nearMarker } : nearestDay(t))
	}

	const handleKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (markers.length === 0) return
		let nextIndex = keyIndex
		if (event.key === "ArrowRight") nextIndex = Math.min(markers.length - 1, keyIndex + 1)
		else if (event.key === "ArrowLeft") nextIndex = Math.max(0, keyIndex < 0 ? 0 : keyIndex - 1)
		else if (event.key === "Home") nextIndex = 0
		else if (event.key === "End") nextIndex = markers.length - 1
		else if (event.key === "Escape") {
			setKeyIndex(-1)
			setReadout(null)
			return
		} else return
		event.preventDefault()
		setKeyIndex(nextIndex)
		setReadout({ kind: "marker", marker: markers[nextIndex] })
	}

	const readoutX = readout ? x(readout.kind === "marker" ? readout.marker.t : readout.t) : 0
	const readoutY = readout ? y(readout.kind === "marker" ? readout.marker.before : readout.value) : 0
	const draw = reduceMotion
		? {}
		: {
				initial: { pathLength: 0 },
				animate: { pathLength: 1 },
				transition: { duration: 0.9, ease: "easeOut" as const },
		  }

	return (
		<div
			ref={containerRef}
			className="relative px-1 pb-2 outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
			style={{ height: height + 8 }}
			tabIndex={0}
			role="group"
			aria-label="Carat forecast chart. Use the left and right arrow keys to step through your banners."
			onKeyDown={handleKey}
			onBlur={() => {
				setKeyIndex(-1)
				setReadout(null)
			}}
		>
			{width > 0 && (
				<svg
					width={width}
					height={height}
					className="block touch-pan-y select-none"
					aria-hidden="true"
					onPointerMove={handlePointer}
					onPointerDown={handlePointer}
					onPointerLeave={() => setReadout(null)}
				>
					<defs>
						{/* Above zero the line wears the brand; below it, the
						    over-budget colour. Two clips, one path drawn twice. */}
						<clipPath id={`${clipId}-above`}>
							<rect x={0} y={0} width={width} height={Math.max(0, zeroY)} />
						</clipPath>
						<clipPath id={`${clipId}-below`}>
							<rect x={0} y={zeroY} width={width} height={Math.max(0, height - zeroY)} />
						</clipPath>
					</defs>

					{/* Gridlines and y labels. Zero is drawn a step stronger. */}
					{yTicks.map((tick) => (
						<g key={tick}>
							<line
								x1={MARGIN.left}
								x2={width - MARGIN.right}
								y1={y(tick)}
								y2={y(tick)}
								className={tick === 0 ? "stroke-gray-500" : "stroke-gray-700"}
								strokeWidth={1}
								shapeRendering="crispEdges"
							/>
							<text
								x={MARGIN.left - 8}
								y={y(tick)}
								dy="0.32em"
								textAnchor="end"
								className="fill-gray-400 text-[11px] tabular-nums"
							>
								{compactCarats(tick)}
							</text>
						</g>
					))}

					{xTicks.map((t) => (
						<text
							key={t}
							x={x(t)}
							y={height - 8}
							textAnchor="middle"
							className="fill-gray-400 text-[11px] tabular-nums"
						>
							{formatMonth(new Date(t))}
						</text>
					))}

					<path d={areaPath} className="fill-brand/10" clipPath={`url(#${clipId}-above)`} />
					<path d={areaPath} className="fill-(--color-pull-over)/10" clipPath={`url(#${clipId}-below)`} />
					<motion.path
						d={linePath}
						fill="none"
						className="stroke-brand"
						strokeWidth={2}
						strokeLinejoin="round"
						strokeLinecap="round"
						clipPath={`url(#${clipId}-above)`}
						{...draw}
					/>
					<motion.path
						d={linePath}
						fill="none"
						className="stroke-(--color-pull-over)"
						strokeWidth={2}
						strokeLinejoin="round"
						strokeLinecap="round"
						clipPath={`url(#${clipId}-below)`}
						{...draw}
					/>

					{/* Crosshair, under the dots so they stay on top of it. */}
					{readout && (
						<line
							x1={readoutX}
							x2={readoutX}
							y1={MARGIN.top}
							y2={MARGIN.top + plotH}
							className="stroke-gray-400"
							strokeWidth={1}
							shapeRendering="crispEdges"
						/>
					)}

					{/* One dot per banner, at what the row says is available. The
					    2px ring in the card's own fill keeps a dot legible where it
					    sits on the line. A row left out of the projection is hollow. */}
					{markers.map((m) => {
						const short = m.after < 0 && !m.excluded
						const active = readout?.kind === "marker" && readout.marker === m
						return (
							<circle
								key={`${m.index}-${m.t}`}
								cx={x(m.t)}
								cy={y(m.before)}
								r={active ? 6 : 4.5}
								strokeWidth={2}
								style={{ stroke: m.excluded ? "var(--color-brand)" : "var(--card-fill)" }}
								className={
									m.excluded
										? "fill-(--card-fill)"
										: short
										? "fill-(--color-pull-over)"
										: "fill-brand"
								}
							/>
						)
					})}

					{readout?.kind === "day" && (
						<circle
							cx={readoutX}
							cy={readoutY}
							r={4}
							strokeWidth={2}
							style={{ stroke: "var(--card-fill)" }}
							className={readout.value < 0 ? "fill-(--color-pull-over)" : "fill-brand"}
						/>
					)}

					{/* The one direct label: where the line ends up. */}
					<text
						x={width - MARGIN.right}
						y={y(last.value) - 8}
						textAnchor="end"
						className="fill-gray-200 text-[11px] font-semibold tabular-nums"
					>
						{fullCarats(last.value)}
					</text>
				</svg>
			)}

			{readout && width > 0 && (
				// Pinned to the top of the plot beside the crosshair, on whichever
				// side fits it. Above the dot it would run into the heading and be
				// cut off by the card's edge. On a phone neither side may fit, and
				// then it spans the plot's width instead.
				<div
					className="pointer-events-none absolute z-10 max-w-[14rem] rounded-md border border-edge bg-gray-800 px-3 py-2 text-xs shadow-lg"
					style={{ top: MARGIN.top, ...tooltipSide(readoutX, width) }}
					aria-live="polite"
				>
					{readout.kind === "marker" ? (
						<MarkerReadout
							marker={readout.marker}
							name={bannerName(readout.marker)}
							endDate={endDateOf(readout.marker)}
						/>
					) : (
						<>
							<div className="text-sm font-semibold text-gray-100 tabular-nums">
								{fullCarats(readout.value)} carats
							</div>
							<div className="text-gray-400">{formatDate(new Date(readout.t).toISOString())}</div>
						</>
					)}
				</div>
			)}

			{/* The table view, for screen readers: every banner's numbers in order.
			    Sighted readers have the planner rows below, which carry the same. */}
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
