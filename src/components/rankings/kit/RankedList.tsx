/**
 * A ranked list in its panel (mock 03-guides.png, the main column): the top
 * `start` rows, then "Show all N" in the footer. Each item is drawn by the
 * caller, usually as a RankRow, so the panel owns only the cut and the
 * hairlines between rows. With a `title` it draws Panel's head (mock
 * 09-pvp.png); `footnote` sits at the footer's left (a legend), "Show all"
 * at its right. The panel is the Encyclopedia section's surface (Panel.tsx).
 */

import { useState, type ReactNode } from "react"
import { PANEL, PanelHead } from "./Panel"

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
	/**
	 * Unplaced rows drawn after the ranked ones (What wins' thin rows), each a
	 * keyed <li>. They share the top-`start` cut with `items`: collapsed, the
	 * list shows `start` rows in total, ranked first, so "Show the top 10"
	 * means ten rows on screen however many are thin.
	 */
	after?: ReactNode[]
}) {
	const [all, setAll] = useState(false)
	const extra = after ?? []
	const total = items.length + extra.length
	const shown = all ? items : items.slice(0, start)
	// Whatever room the ranked rows leave under the cut goes to the thin rows.
	const shownAfter = all ? extra : extra.slice(0, Math.max(0, start - shown.length))
	return (
		<section className={`${PANEL} gap-2`} aria-label={label}>
			{title && <PanelHead title={label} hint={hint} />}
			{total === 0 ? (
				<p className="px-1 py-2 text-sm text-gray-400">{empty}</p>
			) : (
				<ol className="flex flex-col divide-y divide-edge">
					{shown.map((item, index) => (
						<li key={itemKey(item)}>{render(item, index)}</li>
					))}
					{shownAfter}
				</ol>
			)}
			{(footnote || total > start) && (
				<div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-2 text-[13px]">
					{footnote ?? <span className="text-gray-400">{all ? `Showing all ${total}` : `Showing the top ${start}`}</span>}
					{total > start && (
						<button type="button" onClick={() => setAll(!all)} className="ml-auto font-semibold text-brand transition hover:text-brand/75">
							{all ? `Show the top ${start}` : `Show all ${total}`}
						</button>
					)}
				</div>
			)}
		</section>
	)
}
