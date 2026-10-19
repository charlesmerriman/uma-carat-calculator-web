import type React from "react"
import { memo, useId, useMemo, useRef, useState } from "react"
import { useReducedMotion } from "framer-motion"
import {
	Area,
	ComposedChart,
	CartesianGrid,
	Line,
	ReferenceDot,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts"
import type {
	CaratForecast,
	ForecastMarker,
	PullBar,
	PullPoint,
	SkipMarker,
} from "../../utils/caratForecast"
import { forecastValueAt, formatCarats } from "../../utils/caratForecast"
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
 *   Paid carats can stack on top as a grey band (an optional layer, off
 *   until the viewer checks it), so the top edge is the total and a
 *   step-up's paid spend shows as a drop there.
 * - Pulls: two lines, day by day (buildPullSeries): "Uma pulls" (carats and
 *   uma tickets) and "Support pulls" (carats and support tickets), since a
 *   banner spends only its own kind of ticket. Each banner's dot sits on its
 *   own kind's line, at its row's Max Pulls without free pulls.
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
	/** Paid carats, stacked on top of `value` as the paid band. */
	paid: number
	/** Set on the vertex where a banner's dot sits (its "before" value). */
	marker?: ForecastMarker
	/** Set on a vertex added for a skipped PvP event (on the line already). */
	skip?: SkipMarker
}

/** One row of the pulls view's data: a vertex of both lines, maybe a dot. */
interface PullDatum extends PullPoint {
	skip?: SkipMarker
}

/** Which pulls line a series is. */
type PullLine = "uma" | "support"

const LINE_LABEL: Record<PullLine, string> = { uma: "Uma pulls", support: "Support pulls" }
const LINE_COLOR: Record<PullLine, string> = {
	uma: "var(--color-series-uma)",
	support: "var(--color-series-support)",
}

export type ForecastUnit = "carats" | "pulls"

export interface PlotProps {
	forecast: CaratForecast
	unit: ForecastUnit
	/** Draw the paid band (an optional layer, switched on by the viewer). */
	showPaid: boolean
	/** The pulls view's two lines (buildPullSeries). */
	pullSeries: PullPoint[]
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
	showPaid,
	pullSeries,
	skipMarkers,
	pityPulls,
	pullCost,
	bannerName,
	endDateOf,
	onSelectMarker,
}) => {
	const reduceMotion = useReducedMotion() ?? false
	// ANIMATE ONCE PER VIEW. Recharts replays a series' animation whenever its
	// data changes, and the data changes on every planner edit: typing a pull
	// count restarted a 900ms redraw each keystroke, which read as lag. So
	// each view animates on its first draw only, and every later change
	// lands at once. Remembered per view, so switching to the other one
	// still draws it in. A paid band switched on later appears at once too.
	const [enteredUnit, setEnteredUnit] = useState<ForecastUnit | null>(null)
	const animate = !reduceMotion && enteredUnit !== unit
	const entered = () => setEnteredUnit(unit)
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
		const rows: LineDatum[] = points.map((p) => ({
			t: p.t,
			value: p.value,
			paid: Math.max(0, p.paid),
			...(p.marker !== undefined && { marker: markers[p.marker] }),
		}))
		return withSkips(rows, skipMarkers, (skip) => ({
			t: skip.t,
			value: skip.value,
			paid: Math.max(0, forecastValueAt(points, skip.t, (p) => p.paid)),
			skip,
		}))
	}, [points, markers, skipMarkers])

	// The pulls lines, with each skipped event placed on both of them: a skip
	// lowers every balance, so it is on both lines' path.
	const pullData = useMemo<PullDatum[]>(
		() =>
			withSkips<PullDatum>(
				pullSeries.map((p) => ({ ...p })),
				skipMarkers,
				(skip) => ({
					t: skip.t,
					uma: Math.round(forecastValueAt(pullSeries, skip.t, (p) => p.uma)),
					support: Math.round(forecastValueAt(pullSeries, skip.t, (p) => p.support)),
					skip,
				})
			),
		[pullSeries, skipMarkers]
	)

	// THE SPLIT AT ZERO (carats view). One gradient, two stops at the same
	// offset: brand above zero, the over-budget colour below. The offset is
	// where zero falls in the shape's bounding box, which for both the line and
	// the filled area runs from the highest value to the lowest (or to zero).
	const values = points.map((p) => p.value)
	// THE PAID BAND. An optional layer: the parent passes `showPaid` only when
	// the viewer switched it on and the plan ever holds paid carats.
	const hasPaid = showPaid
	// The axis must reach the TOP of the stack (free + paid), not the free line.
	const high = Math.max(...points.map((p) => p.value + (hasPaid ? Math.max(0, p.paid) : 0)))
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
	const pullHigh = Math.max(pityPulls, ...pullSeries.map((p) => Math.max(p.uma, p.support)))
	const pullTicks = niceTicks(0, pullHigh, 4)
	// End labels name the two lines where they finish. When the two ends are
	// within ~14px of each other they would collide, so the legend alone
	// carries the names (dataviz: never stack colliding end labels).
	const lastPull = pullSeries[pullSeries.length - 1]
	const pullSpan = pullTicks[pullTicks.length - 1] || 1
	const endLabelsFit = Math.abs(lastPull.uma - lastPull.support) / pullSpan >= 0.09
	// Set just ABOVE its line ("inside bottom left" of the band above it):
	// below it, it sat on the start of the lines.
	const pityLabel = `${pityPulls} pulls (pity)`

	const tooltip = (
		<Tooltip
			content={(props) => (
				<ForecastTooltip
					active={props.active}
					payload={props.payload}
					touch={touch}
					hasPaid={hasPaid}
					pityPulls={pityPulls}
					bannerName={bannerName}
					endDateOf={endDateOf}
				/>
			)}
			cursor={{ stroke: "var(--color-gray-400)", strokeWidth: 1 }}
			// Pinned near the top of the plot, so it never covers the mark it
			// describes or runs into the heading above the chart.
			position={{ y: 8 }}
			isAnimationActive={false}
		/>
	)

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
							name="Free carats"
							// One stack: the paid band sits on top of this area, so its
							// top edge is the total. Recharts stacks in order, from 0.
							stackId={hasPaid ? "carats" : undefined}
							baseValue={0}
							stroke={`url(#${gradientId}-stroke)`}
							strokeWidth={2}
							fill={`url(#${gradientId}-fill)`}
							isAnimationActive={animate}
							animationDuration={900}
							onAnimationEnd={entered}
							dot={(props: { cx?: number; cy?: number; index?: number; payload?: LineDatum }) => (
								// A step-up's dot rides the paid band instead (below), unless
								// there is no band to ride.
								<LineDot key={`dot-${props.index}`} {...props} onSelect={select} skipStepUps={hasPaid} />
							)}
							activeDot={{ r: 5, stroke: "var(--card-fill)", strokeWidth: 2, fill: "var(--color-brand)" }}
						/>
						{hasPaid && (
							// Grey on purpose: the free layer wears each theme's brand
							// colour (gold, blue, green, red, purple across the twelve),
							// so any second hue clashes with one of them. A neutral reads
							// as the secondary balance on all of them.
							<Area
								type="linear"
								dataKey="paid"
								name="Paid carats"
								stackId="carats"
								stroke="var(--color-gray-400)"
								strokeWidth={1.5}
								fill="var(--color-gray-400)"
								fillOpacity={0.16}
								isAnimationActive={animate}
								animationDuration={900}
								dot={(props: { cx?: number; cy?: number; index?: number; payload?: LineDatum }) => (
									<StepUpDot key={`paid-dot-${props.index}`} {...props} onSelect={select} />
								)}
								activeDot={{ r: 4, stroke: "var(--card-fill)", strokeWidth: 2, fill: "var(--color-gray-400)" }}
							/>
						)}
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
					<ComposedChart data={pullData} margin={{ top: 16, right: 20, bottom: 4, left: 4 }}>
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
							domain={[0, pullTicks[pullTicks.length - 1]]}
							ticks={pullTicks}
							tick={AXIS_TICK}
							axisLine={false}
							tickLine={false}
							width={44}
						/>
						<ReferenceLine
							y={pityPulls}
							stroke="var(--color-gray-400)"
							label={{ value: pityLabel, position: "insideBottomLeft", fill: "var(--color-gray-400)", fontSize: 11 }}
						/>
						{tooltip}
						{(["support", "uma"] as const).map((line) => (
							<Line
								key={line}
								type="linear"
								dataKey={line}
								name={LINE_LABEL[line]}
								stroke={LINE_COLOR[line]}
								strokeWidth={2}
								isAnimationActive={animate}
								animationDuration={900}
								onAnimationEnd={entered}
								dot={(props: { cx?: number; cy?: number; index?: number; payload?: PullDatum }) => (
									<PullDot key={`${line}-${props.index}`} {...props} line={line} onSelect={select} />
								)}
								activeDot={{ r: 4, stroke: "var(--card-fill)", strokeWidth: 2, fill: LINE_COLOR[line] }}
							/>
						))}
						{endLabelsFit &&
							(["uma", "support"] as const).map((line) => (
								<ReferenceDot
									key={`end-${line}`}
									x={lastPull.t}
									y={lastPull[line]}
									r={0}
									label={{
										value: `${line === "uma" ? "Uma" : "Support"} ${lastPull[line]}`,
										position: "insideBottomRight",
										offset: 8,
										fill: "var(--color-gray-200)",
										fontSize: 11,
										fontWeight: 600,
									}}
								/>
							))}
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
						{!m.excluded && m.paidBefore - m.paidAfter > 0
							? `; ${formatCarats(m.paidBefore - m.paidAfter)} paid carats spent, ${formatCarats(m.paidAfter)} left`
							: ""}
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
 * Rows with a vertex added for each skipped event, after every vertex at or
 * before its instant, so it never splits a banner's arrival from its drop.
 */
function withSkips<R extends { t: number }>(
	rows: R[],
	skips: SkipMarker[],
	make: (skip: SkipMarker) => R
): R[] {
	const out = [...rows]
	for (const skip of skips) {
		const i = out.findIndex((r) => r.t > skip.t)
		out.splice(i === -1 ? out.length : i, 0, make(skip))
	}
	return out
}

/** The red dot for a skipped PvP event, on whichever line it sits. */
const SkipDot: React.FC<{ cx: number; cy: number }> = ({ cx, cy }) => (
	// Red, the over-budget token: a skip is rewards left on the table, and the
	// token follows the theme and colorblind mode like the rest.
	<circle cx={cx} cy={cy} r={4.5} strokeWidth={2} style={{ stroke: "var(--card-fill)", fill: "var(--color-pull-over)" }} />
)

/**
 * A dot on a pulls line: a banner's, on its own kind's line only (clickable),
 * or a skipped event's (red, on both lines).
 */
const PullDot: React.FC<{
	cx?: number
	cy?: number
	payload?: PullDatum
	line: PullLine
	onSelect: (marker: ForecastMarker) => void
}> = ({ cx, cy, payload, line, onSelect }) => {
	if (cx === undefined || cy === undefined || !payload) return <g />
	if (payload.skip) return <SkipDot cx={cx} cy={cy} />
	if (!payload.bar || payload.kind !== line) return <g />
	const { marker } = payload.bar
	return (
		<g className="cursor-pointer" onClick={() => onSelect(marker)}>
			<circle cx={cx} cy={cy} r={12} fill="transparent" />
			<circle
				cx={cx}
				cy={cy}
				r={4.5}
				strokeWidth={2}
				style={{
					stroke: marker.excluded ? LINE_COLOR[line] : "var(--card-fill)",
					fill: marker.excluded ? "var(--card-fill)" : LINE_COLOR[line],
				}}
			/>
		</g>
	)
}

/**
 * A step-up's dot, on the paid band's top edge: a step-up spends paid carats
 * only, so that is the edge it moves. In the step-up purple the planner row's
 * type tile wears (`--color-step-up`, which every theme and colorblind mode
 * set), clickable like every banner's dot.
 */
const StepUpDot: React.FC<{
	cx?: number
	cy?: number
	payload?: LineDatum
	onSelect: (marker: ForecastMarker) => void
}> = ({ cx, cy, payload, onSelect }) => {
	const marker = payload?.marker
	if (cx === undefined || cy === undefined || !marker?.stepUp) return <g />
	return (
		<g className="cursor-pointer" onClick={() => onSelect(marker)}>
			<circle cx={cx} cy={cy} r={12} fill="transparent" />
			<circle
				cx={cx}
				cy={cy}
				r={4.5}
				strokeWidth={2}
				style={{
					stroke: marker.excluded ? "var(--color-step-up)" : "var(--card-fill)",
					fill: marker.excluded ? "var(--card-fill)" : "var(--color-step-up)",
				}}
			/>
		</g>
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
	/** Leave step-ups to the paid band's StepUpDot. */
	skipStepUps: boolean
}> = ({ cx, cy, payload, onSelect, skipStepUps }) => {
	if (cx === undefined || cy === undefined || !payload) return <g />
	if (payload.skip) return <SkipDot cx={cx} cy={cy} />
	const marker = payload.marker
	if (!marker || (skipStepUps && marker.stepUp)) return <g />
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
	/** The plan holds paid carats: a day's readout lists both layers. */
	hasPaid: boolean
	pityPulls: number
	bannerName: (marker: ForecastMarker) => string
	endDateOf: (marker: ForecastMarker) => string | null
}

/** The hover readout. Recharts hands it the nearest vertex. */
const ForecastTooltip: React.FC<ForecastTooltipProps> = ({
	active,
	payload,
	touch,
	hasPaid,
	pityPulls,
	bannerName,
	endDateOf,
}) => {
	const datum = payload?.[0]?.payload as (Partial<LineDatum> & Partial<PullDatum>) | undefined
	if (!active || !datum) return null
	const goHint = touch ? "Tap again to go to its row" : "Click to go to its row"

	let body: React.ReactNode
	if (datum.bar) {
		const { bar } = datum as { bar: PullBar }
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
					{RACE_KIND_LABEL[datum.skip.kind] ?? "PvP event"}, {formatDate(new Date(datum.skip.t).toISOString())}
				</div>
				<div className="mt-1 text-gray-400">Its rewards aren't counted in your carats.</div>
			</>
		)
	} else if (datum.uma !== undefined && datum.support !== undefined) {
		// Values lead, labels follow, keyed by a short stroke of each line's
		// colour (dataviz: line keys, not boxes).
		body = (
			<>
				{(["uma", "support"] as const).map((line) => (
					<div key={line} className="flex items-center gap-2">
						<span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: LINE_COLOR[line] }} />
						<span className="text-sm font-semibold text-gray-100 tabular-nums">{datum[line]}</span>
						<span className="text-gray-400">{LINE_LABEL[line].toLowerCase()}</span>
					</div>
				))}
				<div className="text-gray-400">{formatDate(new Date(datum.t!).toISOString())}</div>
			</>
		)
	} else if (hasPaid) {
		// Values lead, labels follow, keyed by a short stroke of each layer.
		body = (
			<>
				{[
					{ key: "free", label: "free carats", value: datum.value ?? 0, color: "var(--color-brand)" },
					{ key: "paid", label: "paid carats", value: datum.paid ?? 0, color: "var(--color-gray-400)" },
				].map((row) => (
					<div key={row.key} className="flex items-center gap-2">
						<span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: row.color }} />
						<span className="text-sm font-semibold text-gray-100 tabular-nums">{formatCarats(row.value)}</span>
						<span className="text-gray-400">{row.label}</span>
					</div>
				))}
				<div className="text-gray-400">{formatDate(new Date(datum.t!).toISOString())}</div>
			</>
		)
	} else {
		body = (
			<>
				<div className="text-sm font-semibold text-gray-100 tabular-nums">
					{formatCarats(datum.value ?? 0)} carats
				</div>
				<div className="text-gray-400">{formatDate(new Date(datum.t!).toISOString())}</div>
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
	const paidSpent = marker.paidBefore - marker.paidAfter
	if (marker.stepUp) {
		// A step-up's money is paid carats only, so that is what it leads with.
		return (
			<>
				<div className="text-sm font-semibold text-gray-100 tabular-nums">
					{formatCarats(marker.paidBefore)} paid carats
				</div>
				<div className="font-medium text-gray-300">{name}</div>
				<div className="text-gray-400">Ends {formatDate(endDate)}</div>
				<div className="mt-1 text-gray-400">
					{marker.excluded
						? "Left out of the projection"
						: paidSpent > 0 ? (
							<>
								Steps spend {formatCarats(paidSpent)} paid,{" "}
								{marker.paidAfter < 0 ? (
									// Over-planned past the budget: the deficit is the message,
									// as on the step-up row itself.
									<span className="font-semibold text-(--color-pull-over)">
										short by {formatCarats(-marker.paidAfter)}
									</span>
								) : (
									<>leaving {formatCarats(marker.paidAfter)}</>
								)}
							</>
						) : (
							"No paid carats spent here"
						)}
				</div>
			</>
		)
	}
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
			{!marker.excluded && paidSpent > 0 && (
				<div className="text-gray-400">
					and {formatCarats(paidSpent)} paid,{" "}
					{marker.paidAfter < 0 ? (
						<span className="font-semibold text-(--color-pull-over)">
							short by {formatCarats(-marker.paidAfter)}
						</span>
					) : (
						<>leaving {formatCarats(marker.paidAfter)}</>
					)}
				</div>
			)}
		</>
	)
}

// Memoised: the page re-renders for many reasons that change nothing here,
// and each re-render would redraw the whole Recharts tree. The parent keeps
// every prop stable (memoised data, useCallback'd functions) for this to hold.
export default memo(ForecastPlot)
