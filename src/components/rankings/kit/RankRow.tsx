/**
 * The row every Rankings list is built from (mocks 02-kit-row.png, opened
 * 01-kit-row-open.png, in notes/rankings-redesign/mocks/): place, art, the
 * name with a sub line (a card's type chip, "N borrowed"), a bar scaled to
 * the list's leader, the count over its share, and a chevron when it opens.
 *
 * LAYOUT BY CONTAINER, NOT SCREEN: the nearest `@container` is the Rankings
 * section (RankingsSection.tsx), so the same row fits the page, a phone and
 * the pinned window. Under 40rem (640 px) of container the bar column goes
 * and a 3 px hairline under the name carries the same `fill`.
 *
 * `compact` is the pinned window's variant (step 3 of the plan): smaller
 * art, the name over the hairline, no sub line, no chevron.
 *
 * An opened row shows `detail` (the caller's drawn breakdown), never a list
 * of every deck (owner, 2026-10-27).
 */

import { useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import { Bar, type BarPart } from "./Bar"
import { Movement, type MovementValue } from "./Movement"

export interface RankRowProps {
	/** 1-based; the top three are drawn in brand. Null for a row shown but not ranked. */
	place: number | null
	art: ReactNode
	name: string
	/** The small line under the name: a type chip, "15 borrowed". */
	sub?: ReactNode
	movement?: MovementValue | null
	/** count / the leader's count, 0 to 1: the first row's is 1. */
	fill: number
	/** A stacked bar in place of the plain one (an uma's running styles). */
	parts?: BarPart[]
	/** "win": the bar in the running green (a win rate). */
	tone?: "win"
	/** "176 decks": drawn bold. */
	count: ReactNode
	/** "29%": drawn muted under the count. */
	share?: ReactNode
	/** The opened row's breakdown; without it the row doesn't open. */
	detail?: ReactNode
	compact?: boolean
	/** A row under a list's floor (fewer races than ranked): muted ink. */
	muted?: boolean
}

export function RankRow(props: RankRowProps) {
	const { place, art, name, sub, movement, fill, parts, tone, count, share, detail, compact = false, muted = false } = props
	const [open, setOpen] = useState(false)
	const top = place !== null && place <= 3
	const nameInk = muted ? "text-gray-400" : "text-gray-100"
	const placeCell = (
		<span
			className={`text-right font-mono text-xs tabular-nums ${top && !muted ? "font-bold text-brand" : "text-gray-400"}`}
			aria-label={place === null ? undefined : `Place ${place}`}
		>
			{place ?? ""}
		</span>
	)
	const countCell = (
		<span className="flex flex-col items-end gap-px whitespace-nowrap text-right text-xs tabular-nums text-gray-400">
			<b className={`text-[13px] font-semibold ${muted ? "text-gray-300" : "text-gray-100"}`}>{count}</b>
			{share !== undefined && <span>{share}</span>}
		</span>
	)

	if (compact) {
		return (
			<div className="grid grid-cols-[1.4rem_auto_minmax(0,1fr)_minmax(4rem,auto)] items-center gap-2 rounded-lg px-1 py-1.5">
				{placeCell}
				<span className="flex">{art}</span>
				<span className="flex min-w-0 flex-col gap-1">
					<span className="flex min-w-0 items-center gap-1.5">
						<span className={`truncate text-[13px] font-semibold ${nameInk}`}>{name}</span>
						<Movement value={movement} />
					</span>
					<Bar fill={fill} parts={parts} tone={tone} hairline />
				</span>
				{countCell}
			</div>
		)
	}

	const head = (
		<>
			{placeCell}
			<span className="flex">{art}</span>
			<span className="flex min-w-0 flex-col gap-0.5">
				<span className="flex min-w-0 items-center gap-1.5">
					<span className={`truncate text-[13px] font-semibold ${nameInk}`}>{name}</span>
					<Movement value={movement} />
				</span>
				{sub && <span className="flex min-w-0 items-center gap-1.5 truncate text-[11px] text-gray-400">{sub}</span>}
				{/* Under 40rem the bar column goes and this hairline carries the fill. */}
				<Bar fill={fill} parts={parts} tone={tone} hairline className="mt-1 @min-[40rem]:hidden" />
			</span>
			<Bar fill={fill} parts={parts} tone={tone} className={`hidden @min-[40rem]:block ${muted ? "opacity-60" : ""}`} />
			{countCell}
			{detail ? (
				<ChevronDown className={`h-3.5 w-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
			) : (
				<span />
			)}
		</>
	)
	// The count column has a floor so "176 decks" and "86 decks" don't shift the bars beside them.
	const grid =
		"grid w-full grid-cols-[1.4rem_auto_minmax(0,1fr)_minmax(4.5rem,auto)_14px] items-center gap-2.5 rounded-lg px-1 py-[7px] text-left @min-[40rem]:grid-cols-[1.6rem_auto_minmax(0,1.3fr)_minmax(0,1fr)_minmax(4.5rem,auto)_14px]"

	if (!detail) return <div className={grid}>{head}</div>
	return (
		<div>
			<button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={`${grid} transition hover:bg-gray-700`}>
				{head}
			</button>
			{open && <div className="px-2 pb-3 pt-1 @min-[40rem]:pl-[4.2rem]">{detail}</div>}
		</div>
	)
}
