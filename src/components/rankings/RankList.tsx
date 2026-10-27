/**
 * A ranked table on the Rankings page: a titled panel of rows, the first
 * `start` shown and the rest behind "Show all". Each row is a place, a
 * picture, a name, its count with the share beside it ("12 decks · 29%"),
 * and opens to a few short breakdown lines (by event, style, tier), never a
 * list of every deck (owner, 2026-10-27: "how many times, not every single
 * one").
 *
 * Shared by the tabs, so every table on the page reads the same.
 */

import { useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"

export interface RankListRow {
	key: number
	place: number
	art: ReactNode
	name: string
	/** The count and share line under the name. */
	counts: ReactNode
	/** The opened row's lines, as [label, content]; none and the row doesn't open. */
	details: Array<[label: string, content: ReactNode]>
}

export function RankList({ title, hint, rows, empty, start = 20 }: {
	title: string
	hint?: string
	rows: RankListRow[]
	empty: string
	/** How many rows show before "Show all". */
	start?: number
}) {
	const [all, setAll] = useState(false)
	const shown = all ? rows : rows.slice(0, start)
	return (
		<section className="card-panel flex min-w-0 flex-col gap-3 p-3 sm:p-4" aria-label={title}>
			<div className="flex flex-col gap-0.5">
				<h2 className="font-display text-base font-bold text-brand">{title}</h2>
				{hint && <p className="text-xs text-gray-400">{hint}</p>}
			</div>
			{rows.length === 0 ? (
				<p className="text-sm text-gray-400">{empty}</p>
			) : (
				<ol className="flex flex-col divide-y divide-gray-700/70">
					{shown.map((row) => (
						<li key={row.key}>
							<RankRow row={row} />
						</li>
					))}
				</ol>
			)}
			{rows.length > start && (
				<button type="button" onClick={() => setAll(!all)} className="self-start text-sm text-brand transition hover:text-brand/75">
					{all ? `Show the top ${start}` : `Show all ${rows.length}`}
				</button>
			)}
		</section>
	)
}

function RankRow({ row }: { row: RankListRow }) {
	const [open, setOpen] = useState(false)
	const opens = row.details.length > 0
	const head = (
		<>
			<span className="w-6 shrink-0 text-right font-mono text-sm tabular-nums text-gray-400">{row.place}</span>
			<span className="w-10 shrink-0">{row.art}</span>
			<span className="flex min-w-0 flex-1 flex-col">
				<span className="truncate text-sm font-semibold text-gray-100">{row.name}</span>
				<span className="text-xs tabular-nums text-gray-400">{row.counts}</span>
			</span>
		</>
	)
	if (!opens) return <div className="flex min-w-0 items-center gap-3 py-2">{head}</div>
	return (
		<div className="py-2">
			<button
				type="button"
				aria-expanded={open}
				onClick={() => setOpen(!open)}
				className="flex w-full min-w-0 items-center gap-3 rounded-md text-left transition hover:bg-gray-800/60"
			>
				{head}
				<ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden="true" />
			</button>
			{open && (
				<dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 pl-[4.75rem] text-xs tabular-nums">
					{row.details.map(([label, content]) => (
						<div key={label} className="contents">
							<dt className="text-gray-400">{label}</dt>
							<dd className="text-gray-200">{content}</dd>
						</div>
					))}
				</dl>
			)}
		</div>
	)
}
