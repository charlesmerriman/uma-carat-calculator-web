/**
 * The Rankings page's Pull plans tab (`?view=pull-plans`): the banners
 * players plan to pull on, how many plan each and how much (planners,
 * total, average, typical = the median), and when the demand falls due.
 * The admin analytics' Popular banners tables, shown to supporters
 * (notes/rankings-page-plan.md).
 *
 * BEHIND THE RAPTIVE GATE: guide editors only (useRankingsPullPlans) until
 * the owner lifts it; the API refuses everyone else the same way.
 *
 * Which rows show and their order is utils/pullPlanRankings.ts.
 */

import { Suspense, lazy, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { useRankingsPayload } from "../../hooks/useRankingsPayload"
import type { PlannedBannerRank, PlannedBannerType, PullPlanRankingsPayload } from "../../types/pullPlanRankings"
import { pullPlanRows, type PullPlanSort } from "../../utils/pullPlanRankings"
import { formatDate } from "../../utils/dateFormat"
import { formatTimeAgo } from "../../utils/relativeDate"
import { monthLabel } from "./pullPlanLabels"

const DemandChart = lazy(() => import("./DemandChart"))

const TYPES: Array<{ id: PlannedBannerType | null; label: string }> = [
	{ id: null, label: "All" },
	{ id: "uma", label: "Uma" },
	{ id: "support", label: "Support" },
	{ id: "step_up", label: "Step-up" },
]
const TYPE_LABELS: Record<PlannedBannerType, string> = { uma: "Uma", support: "Support", step_up: "Step-up" }
const SORTS: Array<{ id: PullPlanSort; label: string }> = [
	{ id: "date", label: "By date" },
	{ id: "planners", label: "By planners" },
]

const SEGMENTS = "flex flex-wrap gap-0.5 rounded-lg bg-gray-900/70 p-0.5"
const segment = (on: boolean) =>
	`rounded-md px-2.5 py-0.5 text-xs font-medium transition ${on ? "bg-gray-700 text-brand shadow-sm" : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"}`
const PANEL_NOTE = "rounded-xl border border-edge bg-gray-800/60 p-4 text-sm text-gray-300"
const CELL = "px-2 py-1.5 text-right tabular-nums"

export function PullPlans() {
	const state = useRankingsPayload<PullPlanRankingsPayload>("/rankings/pull-plans")
	if (state.status === "refused") return <p className={PANEL_NOTE}>Pull plans aren't open yet.</p>
	if (state.status === "error") return <p className={PANEL_NOTE}>The rankings didn't load. Reload the page to try again.</p>
	if (state.status === "loading") {
		return (
			<div className="flex items-center gap-2 text-sm text-gray-400" role="status">
				<Loader2 className="h-4 w-4 animate-spin" />
				Counting the plans...
			</div>
		)
	}
	return <PullPlansBody payload={state.payload} />
}

function PullPlansBody({ payload }: { payload: PullPlanRankingsPayload }) {
	const [type, setType] = useState<PlannedBannerType | null>(null)
	const [sort, setSort] = useState<PullPlanSort>("date")
	const [showEnded, setShowEnded] = useState(false)
	const rows = useMemo(() => pullPlanRows(payload.banners, { type, sort, showEnded }), [payload, type, sort, showEnded])

	return (
		<div className="flex flex-col gap-4">
			<p className="text-xs text-gray-400">
				From the plans players keep on the site (their active plan only). Typical is the middle planner's number, which a
				few huge budgets can't pull up the way they pull up the average.{" "}
				<time dateTime={payload.generated_at} title={formatDate(payload.generated_at)}>
					Updated {formatTimeAgo(payload.generated_at)}.
				</time>
			</p>

			<section className="card-panel flex min-w-0 flex-col gap-3 p-3 sm:p-4" aria-label="Banners players plan">
				<div className="flex flex-wrap items-center gap-2">
					<h2 className="font-display mr-auto text-base font-bold text-brand">Banners players plan</h2>
					<div className={SEGMENTS} role="group" aria-label="Banner type">
						{TYPES.map((option) => (
							<button key={option.label} type="button" aria-pressed={type === option.id} onClick={() => setType(option.id)} className={segment(type === option.id)}>
								{option.label}
							</button>
						))}
					</div>
					<div className={SEGMENTS} role="group" aria-label="Sort">
						{SORTS.map((option) => (
							<button key={option.id} type="button" aria-pressed={sort === option.id} onClick={() => setSort(option.id)} className={segment(sort === option.id)}>
								{option.label}
							</button>
						))}
					</div>
					<label className="flex items-center gap-1.5 text-xs text-gray-300">
						<input type="checkbox" checked={showEnded} onChange={(event) => setShowEnded(event.target.checked)} className="accent-brand" />
						Ended banners
					</label>
				</div>
				{rows.length === 0 ? (
					<p className="text-sm text-gray-400">Nobody plans a banner like that yet.</p>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full min-w-[40rem] text-sm">
							<thead className="text-xs text-gray-400">
								<tr className="border-b border-gray-700">
									<th scope="col" className="px-2 py-1.5 text-left font-semibold">Banner</th>
									<th scope="col" className="px-2 py-1.5 text-left font-semibold">Dates</th>
									<th scope="col" className={`${CELL} font-semibold`}>Planners</th>
									<th scope="col" className={`${CELL} font-semibold`}>Total</th>
									<th scope="col" className={`${CELL} font-semibold`}>Average</th>
									<th scope="col" className={`${CELL} font-semibold`}>Typical</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-700/70 text-gray-200">
								{rows.map((row) => (
									<BannerRow key={`${row.type}-${row.id}`} row={row} />
								))}
							</tbody>
						</table>
					</div>
				)}
				<p className="text-xs text-gray-400">A step-up's figures are ladder steps, not pulls.</p>
			</section>

			{payload.demand.length > 0 && (
				<section className="card-panel flex min-w-0 flex-col gap-3 p-3 sm:p-4" aria-label="Demand by month">
					<div className="flex flex-col gap-0.5">
						<h2 className="font-display text-base font-bold text-brand">Pulls planned by month</h2>
						<p className="text-xs text-gray-400">By the month each banner ends, when the carats leave. Step-ups aren't in the pull totals.</p>
					</div>
					<Suspense fallback={<div className="h-56 w-full" />}>
						<DemandChart months={payload.demand} />
					</Suspense>
					<div className="overflow-x-auto">
						<table className="w-full min-w-[28rem] text-sm">
							<thead className="text-xs text-gray-400">
								<tr className="border-b border-gray-700">
									<th scope="col" className="px-2 py-1.5 text-left font-semibold">Month</th>
									<th scope="col" className={`${CELL} font-semibold`}>Banners</th>
									<th scope="col" className={`${CELL} font-semibold`}>Planners</th>
									<th scope="col" className={`${CELL} font-semibold`}>Pulls</th>
									<th scope="col" className={`${CELL} font-semibold`}>Step-up planners</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-700/70 text-gray-200">
								{payload.demand.map((month) => (
									<tr key={month.month}>
										<th scope="row" className="px-2 py-1.5 text-left font-normal">{monthLabel(month.month)}</th>
										<td className={CELL}>{month.banners}</td>
										<td className={CELL}>{month.planners.toLocaleString()}</td>
										<td className={CELL}>{month.total_pulls.toLocaleString()}</td>
										<td className={CELL}>{month.step_up_planners.toLocaleString()}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</section>
			)}
		</div>
	)
}

function BannerRow({ row }: { row: PlannedBannerRank }) {
	const steps = row.unit === "steps"
	const figure = (value: number) => `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}${steps ? " steps" : ""}`
	const dates =
		row.start_date === null
			? "Not dated yet"
			: `${formatDate(row.start_date)}${row.end_date ? ` to ${formatDate(row.end_date)}` : ""}`
	return (
		<tr>
			<td className="px-2 py-1.5">
				<span className="flex min-w-0 items-center gap-2">
					<span className="shrink-0 rounded bg-gray-700/70 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-300">
						{TYPE_LABELS[row.type]}
					</span>
					<span className="truncate">{row.name}</span>
				</span>
			</td>
			<td className="px-2 py-1.5 text-xs text-gray-400">
				{dates}
				{row.predicted && row.start_date !== null && <span title="Predicted from the JP schedule"> (predicted)</span>}
				{row.status === "running" && <span className="text-brand"> · running</span>}
			</td>
			<td className={CELL}>{row.planners.toLocaleString()}</td>
			<td className={CELL}>{figure(row.total)}</td>
			<td className={CELL}>{figure(row.average)}</td>
			<td className={CELL}>{figure(row.median)}</td>
		</tr>
	)
}
