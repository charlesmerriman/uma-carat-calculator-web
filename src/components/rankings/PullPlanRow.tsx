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
 *
 * OPENED (step 4, mock 07-pull.png's first row): how planners spread what
 * they plan over five buckets, and the banners its planners also plan, each
 * a chip to that banner's Timeline card.
 */

import { useState } from "react"
import { Link } from "react-router-dom"
import { ChevronDown } from "lucide-react"
import type { PlannedBannerRank, PlannedBannerType } from "../../types/pullPlanRankings"
import { formatDate } from "../../utils/dateFormat"
import { formatShare } from "../../utils/guideRankings"
import { compactNumber, spreadLabel } from "../../utils/pullPlanRankings"
import { timelineFocusHref } from "../../utils/timelineFocus"
import { Bar } from "./kit/Bar"
import { Detail, DetailBlock } from "./kit/Detail"
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

export function PullPlanRow({ row, fill, everyone, timelineOf }: {
	row: PlannedBannerRank
	/** planners / the list's leader. */
	fill: number
	/** Everyone with a plan (the payload's `planners`), or undefined before api #191. */
	everyone: number | undefined
	/** A banner's Timeline card (its BannerTimeline id), for the "also planning" chips. */
	timelineOf: (type: PlannedBannerType, id: number) => number | null
}) {
	const [open, setOpen] = useState(false)
	const opens = Boolean(row.spread || row.also?.length)
	const steps = row.unit === "steps"
	const kind = KINDS[row.type]
	const figure = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 1 })
	const dates = row.start_date ? `${formatDate(row.start_date)}${row.end_date ? ` to ${formatDate(row.end_date)}` : ""}` : "Not dated yet"
	const head = (
		<>
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
			{opens ? (
				<ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
			) : (
				<span />
			)}
		</>
	)
	const grid =
		"grid w-full grid-cols-[auto_minmax(0,1fr)_auto_14px] items-center gap-2.5 rounded-lg px-1 py-2 text-left @min-[47.5rem]:grid-cols-[5.6rem_auto_minmax(0,1.5fr)_minmax(0,1.2fr)_minmax(6rem,auto)_minmax(6.5rem,auto)_14px]"
	if (!opens) return <div className={grid}>{head}</div>
	return (
		<div>
			<button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={`${grid} transition hover:bg-gray-700`}>
				{head}
			</button>
			{open && (
				<div className="px-2 pb-3 pt-1 @min-[47.5rem]:pl-[6.5rem]">
					<Detail>
						{row.spread && (
							<DetailBlock heading={steps ? "The steps people plan" : "The pulls people plan"}>
								<Spread spread={row.spread} unit={steps ? "steps" : "pulls"} />
							</DetailBlock>
						)}
						{row.also && row.also.length > 0 && (
							<DetailBlock heading="Its planners also plan">
								<span className="flex flex-wrap gap-1">
									{row.also.map((other) => {
										const timeline = timelineOf(other.type, other.id)
										const label = `${other.name} · ${formatShare(row.planners ? other.planners / row.planners : 0)}`
										const chip = "rounded-full border border-brand/35 px-2 py-0.5 text-[11px] tabular-nums text-brand"
										return timeline ? (
											<Link key={`${other.type}-${other.id}`} to={timelineFocusHref({ kind: "banner", id: timeline })} className={`${chip} transition hover:bg-brand/15`}>
												{label}
											</Link>
										) : (
											<span key={`${other.type}-${other.id}`} className={chip}>
												{label}
											</span>
										)
									})}
								</span>
							</DetailBlock>
						)}
					</Detail>
				</div>
			)}
		</div>
	)
}

/** Five small bars, one per bucket, each its share of the planners with a sane figure. */
function Spread({ spread, unit }: { spread: NonNullable<PlannedBannerRank["spread"]>; unit: "pulls" | "steps" }) {
	const total = spread.planners.reduce((sum, value) => sum + value, 0)
	const top = Math.max(0, ...spread.planners)
	return (
		<ol className="grid grid-cols-5 items-end gap-1.5" aria-label={`Planners by ${unit} planned`}>
			{spread.planners.map((planners, index) => (
				<li key={index} className="flex min-w-0 flex-col items-center gap-0.5">
					<span className="flex h-8 w-full items-end" aria-hidden="true">
						<span className="block w-full rounded-t-[3px] border-t-2 border-brand bg-brand/35" style={{ height: `${top ? Math.max(4, (planners / top) * 100) : 4}%` }} />
					</span>
					<span className="truncate text-[10px] tabular-nums text-gray-400">{spreadLabel(spread.edges, index)}</span>
					<b className="text-[11px] font-semibold tabular-nums text-gray-100">{formatShare(total ? planners / total : 0)}</b>
				</li>
			))}
		</ol>
	)
}
