/**
 * One banner on the Pull plans tab (mocks 07-pull.png, 20-pull-light.png):
 * the date block, the kind badge, the name over its status and how much is
 * planned, a planners bar scaled to the list's leader, planners with their
 * share of everyone planning, and the typical (median) figure with the
 * average beside it.
 *
 * A step-up's figures are ladder STEPS, never pulls (rules file step-up.md),
 * and the row says so in both places it shows one. Under 47.5rem of
 * container the date block, the bar and the typical column go; the dates
 * move into the sub line and a hairline under the name carries the bar.
 */

import type { PlannedBannerRank } from "../../types/pullPlanRankings"
import { formatDate } from "../../utils/dateFormat"
import { formatShare } from "../../utils/guideRankings"
import { compactNumber } from "../../utils/pullPlanRankings"
import { Bar } from "./kit/Bar"
import { StatusPill, type Status } from "./kit/StatusPill"

const KINDS: Record<PlannedBannerRank["type"], { label: string; className: string }> = {
	uma: { label: "Uma", className: "banner-type-tile--uma" },
	support: { label: "Support", className: "banner-type-tile--support" },
	step_up: { label: "Step-up", className: "banner-type-tile--step-up" },
}

/** Running and ended as the server says; an upcoming banner on JP-schedule dates is "Predicted". */
function statusOf(row: PlannedBannerRank): Status {
	if (row.status === "upcoming" && row.predicted) return "predicted"
	return row.status
}

export function PullPlanRow({ row, fill, everyone }: {
	row: PlannedBannerRank
	/** planners / the list's leader. */
	fill: number
	/** Everyone with a plan (the payload's `planners`), or undefined before api #191. */
	everyone: number | undefined
}) {
	const steps = row.unit === "steps"
	const kind = KINDS[row.type]
	const figure = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 })
	const dates = row.start_date ? `${formatDate(row.start_date)}${row.end_date ? ` to ${formatDate(row.end_date)}` : ""}` : "Not dated yet"
	return (
		<div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 px-1 py-2 @min-[47.5rem]:grid-cols-[5.6rem_auto_minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(6rem,auto)_minmax(6.5rem,auto)]">
			<span className="hidden flex-col @min-[47.5rem]:flex">
				<b className="text-[13px] font-semibold tabular-nums text-gray-100">{row.start_date ? formatDate(row.start_date) : "Undated"}</b>
				{row.end_date && <span className="text-[11px] tabular-nums text-gray-400">to {formatDate(row.end_date)}</span>}
			</span>
			<span className={`${kind.className} self-center rounded-[5px] px-1.5 py-1 text-[9px] font-bold uppercase leading-none tracking-wider`}>
				{kind.label}
			</span>
			<span className="flex min-w-0 flex-col gap-0.5">
				<span className="truncate text-[13px] font-semibold text-gray-100" title={row.name}>{row.name}</span>
				<span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] tabular-nums text-gray-400">
					<StatusPill status={statusOf(row)} />
					<span className="@min-[47.5rem]:hidden">{dates} ·</span>
					<span>
						{compactNumber(row.total)} {steps ? "steps" : "pulls"} planned
					</span>
				</span>
				<Bar fill={fill} hairline className="mt-1 @min-[47.5rem]:hidden" />
			</span>
			<Bar fill={fill} className="hidden @min-[47.5rem]:block" />
			<span className="flex flex-col items-end whitespace-nowrap text-right text-[11px] tabular-nums text-gray-400">
				<b className="text-[13px] font-semibold text-gray-100">{row.planners.toLocaleString()}</b>
				{everyone ? `${formatShare(row.planners / everyone)} of planners` : row.planners === 1 ? "planner" : "planners"}
			</span>
			<span className="hidden flex-col items-end whitespace-nowrap text-right text-[11px] tabular-nums text-gray-400 @min-[47.5rem]:flex">
				<b className="text-[13px] font-semibold text-gray-100">
					{figure(row.median)}
					{steps ? " steps" : ""}
				</b>
				typical · avg {figure(row.average)}
			</span>
		</div>
	)
}
