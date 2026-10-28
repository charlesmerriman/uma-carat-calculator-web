/**
 * The top three with big art (mock 03-guides.png, under the filters): the
 * answer before the list. Each card is the art (a 64 px uma or a 56 px wide
 * card), "#1 overall" in brand, the name, the count and share, and a 4 px
 * fill along the bottom: the place's count over the leader's, like the bars.
 * Three across from 40rem of container, stacked under it.
 */

import type { ReactNode } from "react"
import { Movement, type MovementValue } from "./Movement"

export interface PodiumEntry {
	key: string | number
	art: ReactNode
	name: string
	/** "176 decks" */
	count: ReactNode
	/** "29%" */
	share: ReactNode
	/** count / the leader's count. */
	fill: number
	movement?: MovementValue | null
}

export function Podium({ entries, kicker, label }: {
	entries: PodiumEntry[]
	/** After the place: "overall" makes "#1 overall". Empty for just "#1". */
	kicker: string
	label: string
}) {
	if (entries.length === 0) return null
	return (
		<ol aria-label={label} className="grid gap-2.5 @min-[40rem]:grid-cols-3">
			{entries.slice(0, 3).map((entry, index) => (
				<li key={entry.key} className="relative flex min-w-0 items-center gap-3 overflow-hidden rounded-xl border border-edge bg-gray-800 p-3">
					<span className="flex shrink-0">{entry.art}</span>
					<span className="flex min-w-0 flex-col gap-0.5">
						<span className="font-display text-[11px] font-bold tracking-wider text-brand">
							#{index + 1}{kicker ? ` ${kicker}` : ""}
						</span>
						<span className="flex min-w-0 items-center gap-1.5">
							<span className="truncate text-sm font-semibold text-gray-100">{entry.name}</span>
							<Movement value={entry.movement} />
						</span>
						<span className="text-xs tabular-nums text-gray-400">
							<b className="font-semibold text-gray-100">{entry.count}</b> · {entry.share}
						</span>
					</span>
					<span className="absolute inset-x-0 bottom-0 h-1 bg-brand/35" aria-hidden="true">
						<span className="block h-full bg-brand" style={{ width: `${Math.max(0, Math.min(1, entry.fill)) * 100}%` }} />
					</span>
				</li>
			))}
		</ol>
	)
}
