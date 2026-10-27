/**
 * Pull plans' "Demand by month" bars: the pulls players plan to spend on the
 * banners ending each month (analytics.banners.demand_calendar). One series,
 * so one colour (the brand) and no legend; the heading names it. Hovering a
 * bar shows its month's planners and banners. The same numbers sit in a table
 * under the chart (PullPlans), for screen readers and anyone who wants them
 * exact.
 *
 * Its own chunk with Recharts, loaded lazily (PullPlans), like ForecastPlot:
 * no other page pays for the library.
 */

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { DemandMonth } from "../../types/pullPlanRankings"
import { monthLabel } from "./pullPlanLabels"

const AXIS_TICK = { fill: "var(--color-gray-400)", fontSize: 11 }

function compact(value: number): string {
	if (Math.abs(value) < 1000) return String(Math.round(value))
	const thousands = value / 1000
	return thousands < 1000 ? `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}K` : `${(thousands / 1000).toFixed(1)}M`
}

export default function DemandChart({ months }: { months: DemandMonth[] }) {
	const data = months.map((month) => ({ ...month, label: monthLabel(month.month) }))
	return (
		<div className="h-56 w-full" role="img" aria-label="Pulls planned by the month each banner ends. The table below has the same numbers.">
			<ResponsiveContainer width="100%" height="100%">
				<BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }} barCategoryGap="30%">
					<CartesianGrid vertical={false} stroke="var(--color-gray-700)" />
					<XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
					<YAxis tickFormatter={compact} tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} />
					<Tooltip
						cursor={{ fill: "var(--color-gray-700)", opacity: 0.4 }}
						content={({ active, payload }) => {
							const month = active ? (payload?.[0]?.payload as (DemandMonth & { label: string }) | undefined) : undefined
							if (!month) return null
							return (
								<div className="rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-xs text-gray-200 shadow">
									<p className="font-semibold text-gray-100">{month.label}</p>
									<p className="tabular-nums">{month.total_pulls.toLocaleString()} pulls planned</p>
									<p className="tabular-nums text-gray-400">
										{month.planners.toLocaleString()} {month.planners === 1 ? "planner" : "planners"} · {month.banners}{" "}
										{month.banners === 1 ? "banner" : "banners"}
									</p>
								</div>
							)
						}}
					/>
					<Bar dataKey="total_pulls" fill="var(--color-brand)" radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
				</BarChart>
			</ResponsiveContainer>
		</div>
	)
}
