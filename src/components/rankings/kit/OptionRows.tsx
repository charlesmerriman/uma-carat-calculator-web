/**
 * Labelled bars (mock 11-players.png, "Income options"): a label with an
 * optional small note, a Bar scaled to the leader, and the share bold with
 * the count beside it. For lists of settings, where there is no art.
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
	/** Muted after the share: "6,720". */
	count: ReactNode
}

export function OptionRows({ rows }: { rows: OptionRow[] }) {
	const leader = Math.max(0, ...rows.map((row) => row.value))
	return (
		<ul className="flex flex-col gap-1">
			{rows.map((row) => (
				<li key={row.key} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_auto] items-center gap-2.5 py-0.5 @max-[30rem]:grid-cols-[minmax(0,1fr)_auto]">
					<span className="min-w-0 text-[13px] text-gray-100">
						{row.label}
						{row.note && <span className="ml-1.5 text-[10px] text-gray-400">{row.note}</span>}
					</span>
					<Bar fill={leader > 0 ? row.value / leader : 0} className="@max-[30rem]:hidden" />
					<span className="whitespace-nowrap text-right text-xs tabular-nums text-gray-400">
						<b className="text-[13px] font-semibold text-gray-100">{row.share}</b> · {row.count}
					</span>
				</li>
			))}
		</ul>
	)
}
