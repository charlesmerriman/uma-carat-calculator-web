/**
 * The Rankings page's Pull plans tab (`?view=pull-plans`): the banners
 * players plan to pull on, how many plan each and how much (planners,
 * total, average, typical = the median), and when the pulls fall due.
 * The admin analytics' Popular banners tables, shown to supporters
 * (notes/rankings-page-plan.md).
 *
 * THE REDESIGN (notes/rankings-redesign-plan.md step 2, mocks 07, 08, 20):
 * the band, the month strip ("When the pulls fall due", six divs in place
 * of the Recharts chart and its table), the type and sort lenses (both
 * remembered on the device with the pinned window's choices), and one list
 * of PullPlanRow. A row opens in step 4, once the server sends its spread.
 *
 * BEHIND THE RAPTIVE GATE: guide editors only (useRankingsPullPlans) until
 * the owner lifts it; the API refuses everyone else the same way.
 *
 * Which rows show and their order is utils/pullPlanRankings.ts.
 */

import { useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { useRankingsPayload } from "../../hooks/useRankingsPayload"
import { chooseRankings, useRankingsChoices } from "../../services/rankingsPinStore"
import type { PlannedBannerType, PullPlanRankingsPayload } from "../../types/pullPlanRankings"
import { formatShare } from "../../utils/guideRankings"
import { compactNumber, monthShares, pullPlanRows, type PullPlanSort } from "../../utils/pullPlanRankings"
import { useReportUpdated } from "./rankingsUpdated"
import { Lens } from "./kit/Lens"
import { Panel } from "./kit/Panel"
import { RankedList } from "./kit/RankedList"
import { StatBand } from "./kit/StatBand"
import { PullPlanRow } from "./PullPlanRow"

type TypeChoice = PlannedBannerType | "all"
const TYPES: Array<{ id: TypeChoice; label: string }> = [
	{ id: "all", label: "All" },
	{ id: "uma", label: "Uma" },
	{ id: "support", label: "Support" },
	{ id: "step_up", label: "Step-up" },
]
const SORTS: Array<{ id: PullPlanSort; label: string }> = [
	{ id: "date", label: "By date" },
	{ id: "planners", label: "By planners" },
]

const PANEL_NOTE = "rounded-xl border border-edge bg-gray-800/60 p-4 text-sm text-gray-300"

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
	useReportUpdated(payload.generated_at)
	const choices = useRankingsChoices()["pull-plans"]
	// A remembered value from an older build falls back to the default.
	const type: TypeChoice = TYPES.some((option) => option.id === choices?.type) ? (choices?.type as TypeChoice) : "all"
	const sort: PullPlanSort = choices?.sort === "planners" ? "planners" : "date"
	const [showEnded, setShowEnded] = useState(false)
	// One clock reading per mount: which month is "now" on the strip.
	const [now] = useState(() => new Date())

	const rows = useMemo(
		() => pullPlanRows(payload.banners, { type: type === "all" ? null : type, sort, showEnded }),
		[payload, type, sort, showEnded]
	)
	const ahead = payload.banners.filter((row) => row.status !== "ended")
	const pullsAhead = ahead.filter((row) => row.unit === "pulls").reduce((sum, row) => sum + row.total, 0)
	const leader = Math.max(0, ...rows.map((row) => row.planners))
	const months = useMemo(() => monthShares(payload.demand, now), [payload, now])

	return (
		<div className="flex flex-col gap-3.5">
			<StatBand
				title="What players plan to pull on"
				stats={[
					...(payload.planners !== undefined ? [{ label: "Planners", value: payload.planners.toLocaleString() }] : []),
					{ label: "Pulls planned", value: compactNumber(pullsAhead) },
					{ label: "Banners ahead", value: ahead.length.toLocaleString() },
				]}
			>
				From the plan each player has open, staff left out. Typical is the middle planner's number; a few huge budgets can't pull
				it up.
			</StatBand>

			{payload.demand.length > 0 && (
				<Panel title="When the pulls fall due" hint={'Share of planned pulls by the month a banner ends. Undated banners sit in "Later".'}>
					<MonthStrip months={months} />
				</Panel>
			)}

			<div className="flex flex-wrap items-center gap-2">
				<Lens label="Banner type" options={TYPES} value={type} onChange={(next) => chooseRankings("pull-plans", { type: next })} />
				<Lens label="Order" options={SORTS} value={sort} onChange={(next) => chooseRankings("pull-plans", { sort: next })} />
				<span className="text-[11px] text-gray-400">
					{showEnded ? "Ended banners shown" : "Ended banners hidden"} ·{" "}
					<button type="button" aria-pressed={showEnded} onClick={() => setShowEnded(!showEnded)} className="text-brand transition hover:text-brand/75">
						{showEnded ? "hide" : "show"}
					</button>
				</span>
			</div>

			<RankedList
				label="Banners players plan"
				items={rows}
				start={20}
				itemKey={(row) => `${row.type}-${row.id}`}
				render={(row) => <PullPlanRow row={row} fill={leader > 0 ? row.planners / leader : 0} everyone={payload.planners} />}
				empty="Nobody plans a banner like that yet."
				footnote={
					<span className="text-gray-400">
						{payload.planners !== undefined ? "Planners is the share of everyone with a plan. " : ""}A step-up's figures are ladder
						steps, not pulls.
					</span>
				}
			/>
		</div>
	)
}

/**
 * Six columns, this month to "Later", each a bar of its share of the pulls
 * planned (tallest = the biggest month). The running month is drawn in the
 * running colour and says "now". Divs, no chart library.
 */
function MonthStrip({ months }: { months: ReturnType<typeof monthShares> }) {
	const top = Math.max(0, ...months.map((month) => month.share))
	return (
		<ol className="grid grid-cols-6 items-end gap-2 px-1 @min-[40rem]:gap-4" aria-label="Share of planned pulls by month">
			{months.map((month) => (
				<li key={month.key} className="flex min-w-0 flex-col items-center gap-1">
					<span className="flex h-20 w-full max-w-[3.5rem] items-end" aria-hidden="true">
						<span
							className={`block w-full rounded-t-[4px] border-t-2 ${month.current ? "border-status-running bg-status-running/35" : "border-brand bg-brand/35"}`}
							style={{ height: `${top > 0 ? Math.max(2, (month.share / top) * 100) : 2}%` }}
						/>
					</span>
					<b className="text-xs font-semibold tabular-nums text-gray-100">{formatShare(month.share)}</b>
					<span className="truncate text-[10px] tabular-nums text-gray-400">
						{month.label}
						{month.current ? " · now" : ""}
					</span>
				</li>
			))}
		</ol>
	)
}
