/**
 * Labelled bars (mock 11-players.png, "Income options"): a label with an
 * optional small note, a Bar scaled to the leader, and the share bold with
 * an optional count beside it. For lists of settings, where there is no art.
 */

import type { ReactNode } from "react"
import { Bar } from "./Bar"

export interface OptionRow {
	key: string
	label: string
	/** Small and muted after the label ("starts off"). */
	note?: string
	value: number
	/** Bold: "42%". */
	share: ReactNode
	/** Muted after the share: "6,720". Never a count of players (the Rankings page shows shares). */
	count?: ReactNode
}

export function OptionRows({ rows }: { rows: OptionRow[] }) {
	const leader = Math.max(0, ...rows.map((row) => row.value))
	// The figure column is FIXED, so every bar ends on one edge ("100%" and "0%" sized an
	// `auto` column row by row). Wider when a row carries a count beside its share.
	const withCount = rows.some((row) => row.count !== undefined)
	const columns = withCount
		? "grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_7rem] @max-[30rem]:grid-cols-[minmax(0,1fr)_7rem]"
		: "grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_3.5rem] @max-[30rem]:grid-cols-[minmax(0,1fr)_3.5rem]"
	return (
		<ul className="flex flex-col gap-1">
			{rows.map((row) => (
				<li key={row.key} className={`grid ${columns} items-center gap-2.5 py-0.5`}>
					<span className="min-w-0 text-sm text-gray-100">
						{row.label}
						{row.note && <span className="ml-1.5 text-[11px] text-gray-400">{row.note}</span>}
					</span>
					<Bar fill={leader > 0 ? row.value / leader : 0} className="@max-[30rem]:hidden" />
					<span className="whitespace-nowrap text-right text-xs tabular-nums text-gray-400">
						<b className="font-display text-[15px] font-bold text-gray-100">{row.share}</b>
						{row.count !== undefined && <> · {row.count}</>}
					</span>
				</li>
			))}
		</ul>
	)
}
