/**
 * A ranked list in its panel (mock 03-guides.png, the main column): the top
 * `start` rows, then "Show all N" in the footer. Each item is drawn by the
 * caller, usually as a RankRow, so the panel owns only the cut and the
 * hairlines between rows. With a `title` it draws Panel's head (mock
 * 09-pvp.png); `footnote` sits at the footer's left (a legend), "Show all"
 * at its right.
 */

import { useState, type ReactNode } from "react"
import { PanelHead } from "./Panel"

export function RankedList<T>({ label, title, hint, items, render, itemKey, empty, start = 10, footnote, after }: {
	/** The list's accessible name ("Overall", "Umas"); also the drawn title when `title` is true. */
	label: string
	title?: boolean
	hint?: ReactNode
	items: T[]
	render: (item: T, index: number) => ReactNode
	itemKey: (item: T) => string | number
	empty: string
	/** How many rows show before "Show all". */
	start?: number
	/** At the footer's left: a legend. */
	footnote?: ReactNode
	/** Rows after the ranked ones, never cut (What wins' thin rows). */
	after?: ReactNode
}) {
	const [all, setAll] = useState(false)
	const shown = all ? items : items.slice(0, start)
	return (
		<section className="card-panel flex min-w-0 flex-col gap-2 p-3" aria-label={label}>
			{title && <PanelHead title={label} hint={hint} />}
			{items.length === 0 && !after ? (
				<p className="px-1 py-2 text-sm text-gray-400">{empty}</p>
			) : (
				<ol className="flex flex-col divide-y divide-edge">
					{shown.map((item, index) => (
						<li key={itemKey(item)}>{render(item, index)}</li>
					))}
					{after}
				</ol>
			)}
			{(footnote || items.length > start) && (
				<div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-1 text-[11px]">
					{footnote ?? <span className="text-gray-400">{all ? `Showing all ${items.length}` : `Showing the top ${start}`}</span>}
					{items.length > start && (
						<button type="button" onClick={() => setAll(!all)} className="ml-auto text-brand transition hover:text-brand/75">
							{all ? `Show the top ${start}` : `Show all ${items.length}`}
						</button>
					)}
				</div>
			)}
		</section>
	)
}
