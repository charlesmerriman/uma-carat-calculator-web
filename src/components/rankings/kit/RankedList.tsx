/**
 * A ranked list in its panel (mock 03-guides.png, the main column): the top
 * `start` rows, then "Show all N" in the footer. Each item is drawn by the
 * caller, usually as a RankRow, so the panel owns only the cut and the
 * hairlines between rows.
 */

import { useState, type ReactNode } from "react"

export function RankedList<T>({ label, items, render, itemKey, empty, start = 10, footnote }: {
	/** The list's accessible name ("Overall", "Umas"). */
	label: string
	items: T[]
	render: (item: T, index: number) => ReactNode
	itemKey: (item: T) => string | number
	empty: string
	/** How many rows show before "Show all". */
	start?: number
	/** A muted line under the rows, before the footer. */
	footnote?: ReactNode
}) {
	const [all, setAll] = useState(false)
	const shown = all ? items : items.slice(0, start)
	return (
		<section className="card-panel flex min-w-0 flex-col gap-2 p-3" aria-label={label}>
			{items.length === 0 ? (
				<p className="px-1 py-2 text-sm text-gray-400">{empty}</p>
			) : (
				<ol className="flex flex-col divide-y divide-edge">
					{shown.map((item, index) => (
						<li key={itemKey(item)}>{render(item, index)}</li>
					))}
				</ol>
			)}
			{footnote}
			{items.length > start && (
				<div className="flex items-center justify-between gap-2 px-1 pt-1 text-[11px]">
					<span className="text-gray-400">{all ? `Showing all ${items.length}` : `Showing the top ${start}`}</span>
					<button type="button" onClick={() => setAll(!all)} className="text-brand transition hover:text-brand/75">
						{all ? `Show the top ${start}` : `Show all ${items.length}`}
					</button>
				</div>
			)}
		</section>
	)
}
