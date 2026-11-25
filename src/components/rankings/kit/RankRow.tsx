/**
 * The row every Rankings list is built from (mocks 02-kit-row.png, opened
 * 01-kit-row-open.png, in notes/rankings-redesign/mocks/; the 2026-11-25
 * polish in notes/rankings-polish-plan.md, canvas shot 06): place, art, the
 * name with a sub line (a card's type chip, "N borrowed"), a bar scaled to
 * the list's leader, the count over its share, and a chevron when it opens.
 *
 * THE LOOK: the place and the count in the display face, the top three on a
 * plate in the page's ink; names up to two balanced lines, never cut short;
 * art 3 rem (a card) or 3.5 rem (an uma), sized by the caller; a solid bar
 * (Bar.tsx). A row under a list's floor (`muted`) keeps its bar and art at
 * full strength: only its text is muted (nothing is dimmed, owner 2026-11-17).
 *
 * LAYOUT BY CONTAINER, NOT SCREEN: the nearest `@container` is the Rankings
 * section (RankingsSection.tsx), so the same row fits the page and a phone.
 * Under 40rem (640 px) of container the bar column goes and a hairline under
 * the name carries the same `fill`.
 *
 * `compact` is the pinned window's variant: smaller art, the name over the
 * hairline, no sub line, no chevron.
 *
 * An opened row shows `detail` (the caller's drawn breakdown), never a list
 * of every deck (owner, 2026-10-27).
 */

import { useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { OpenPageLink } from "../../EncyclopediaLinks"
import { CARD_LINK_TITLE } from "../../../utils/hoverCards"
import { ChevronDown } from "lucide-react"
import { Bar, type BarPart, type BarTone } from "./Bar"
import { Movement, type MovementValue } from "./Movement"

export interface RankRowProps {
	/** 1-based; the top three are drawn on a plate. Null for a row shown but not ranked. */
	place: number | null
	art: ReactNode
	name: string
	/** The small line under the name: a type chip, "15 borrowed". */
	sub?: ReactNode
	/**
	 * A second small line under `sub` ("avg place 4.2, top 3 in 48%"), for a
	 * figure that would be cut off at the end of a one-line sub in a narrow
	 * column (a phone, the pinned panel).
	 */
	note?: ReactNode
	movement?: MovementValue | null
	/** count / the leader's count, 0 to 1: the first row's is 1. */
	fill: number
	/** A stacked bar in place of the plain one (an uma's running styles). */
	parts?: BarPart[]
	/** "win": the bar in the running green (a win rate); "loss": the highlight red. */
	tone?: BarTone
	/** A plain bar's colour: a card's type hue (CARD_TYPE_COLORS), the same as its chip's dot. */
	barColor?: string
	/** "176 decks": drawn bold. */
	count: ReactNode
	/** "29%": drawn muted under the count. */
	share?: ReactNode
	/** The opened row's breakdown; without it the row doesn't open. */
	detail?: ReactNode
	compact?: boolean
	/** A row under a list's floor (fewer races than ranked): muted text. */
	muted?: boolean
	/**
	 * The uma or card's Encyclopedia page (useEncyclopediaHrefs; null for
	 * anyone without early access). A row that opens keeps its button and
	 * starts its breakdown with "Open Encyclopedia"; a row that doesn't open is
	 * the link itself.
	 */
	href?: string | null
	/**
	 * The uma's or card's card (utils/hoverCards.ts hoverCardProps), for a row
	 * that is a link: a mouse click on it opens the card, whose "Open its
	 * page" goes on to the page. A row that opens a breakdown ignores this;
	 * its click has that job, and the breakdown has the link.
	 */
	hover?: Record<string, string>
}

/** The place: a plate in the page's ink for the top three, a plain numeral after. */
function Place({ place, muted, compact }: { place: number | null; muted: boolean; compact: boolean }) {
	if (place === null) return <span />
	const plate = place <= 3 && !muted
	const size = compact ? "h-[1.35rem] w-[1.35rem] rounded-[0.4rem] text-[13px]" : "h-[1.6rem] w-[1.6rem] rounded-lg text-[15px]"
	return (
		<span
			aria-label={`Place ${place}`}
			className={`justify-self-end font-display font-bold tabular-nums ${
				plate ? `grid place-items-center bg-(--c1-ink) text-gray-900 ${size}` : `text-gray-400 ${compact ? "text-[15px]" : "text-[17px]"}`
			}`}
		>
			{place}
		</span>
	)
}

export function RankRow(props: RankRowProps) {
	const { place, art, name, sub, note, movement, fill, parts, tone, barColor, count, share, detail, compact = false, muted = false, href = null, hover } = props
	const [open, setOpen] = useState(false)
	const nameInk = muted ? "text-gray-400" : "text-gray-100"
	const placeCell = <Place place={place} muted={muted} compact={compact} />
	const countCell = (
		<span className="flex flex-col items-end gap-px whitespace-nowrap text-right text-[13px] tabular-nums text-gray-400">
			<b className={`font-display font-bold ${compact ? "text-[15px]" : "text-[17px]"} ${muted ? "text-gray-300" : "text-gray-100"}`}>{count}</b>
			{share !== undefined && <span>{share}</span>}
		</span>
	)
	// Up to two balanced lines; the whole name stays readable on hover too.
	const nameText = (size: string) => (
		<span className={`line-clamp-2 min-w-0 font-bold leading-tight text-balance ${size} ${nameInk}`} title={name}>
			{name}
		</span>
	)

	if (compact) {
		const compactGrid = "grid grid-cols-[1.5rem_auto_minmax(0,1fr)_minmax(4rem,auto)] items-center gap-2.5 rounded-lg px-1 py-1.5"
		const cells = (
			<>
				{placeCell}
				<span className="flex">{art}</span>
				<span className="flex min-w-0 flex-col gap-1">
					<span className="flex min-w-0 items-center gap-1.5">
						{nameText("text-sm")}
						<Movement value={movement} />
					</span>
					<Bar fill={fill} parts={parts} tone={tone} color={barColor} hairline />
				</span>
				{countCell}
			</>
		)
		return href ? (
			<Link to={href} {...hover} title={hover ? CARD_LINK_TITLE : "Open in the Encyclopedia"} className={`${compactGrid} transition hover:bg-gray-700`}>
				{cells}
			</Link>
		) : (
			<div className={compactGrid}>{cells}</div>
		)
	}

	const head = (
		<>
			{placeCell}
			<span className="flex">{art}</span>
			<span className="flex min-w-0 flex-col gap-0.5">
				<span className="flex min-w-0 items-center gap-1.5">
					{nameText("text-[15px]")}
					<Movement value={movement} />
				</span>
				{sub && <span className="flex min-w-0 items-center gap-1.5 truncate text-xs text-gray-400">{sub}</span>}
				{note && <span className="min-w-0 truncate text-xs text-gray-400">{note}</span>}
				{/* Under 40rem the bar column goes and this hairline carries the fill. */}
				<Bar fill={fill} parts={parts} tone={tone} color={barColor} hairline className="mt-1 @min-[40rem]:hidden" />
			</span>
			<Bar fill={fill} parts={parts} tone={tone} color={barColor} className="hidden @min-[40rem]:block" />
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
		"grid w-full grid-cols-[1.6rem_auto_minmax(0,1fr)_minmax(4rem,auto)_14px] items-center gap-3 rounded-xl px-1.5 py-2.5 text-left @min-[40rem]:grid-cols-[2rem_auto_minmax(0,1.5fr)_minmax(0,1fr)_minmax(4rem,auto)_14px]"

	if (!detail) {
		return href ? (
			<Link to={href} {...hover} title={hover ? CARD_LINK_TITLE : "Open in the Encyclopedia"} className={`${grid} transition hover:bg-gray-700`}>
				{head}
			</Link>
		) : (
			<div className={grid}>{head}</div>
		)
	}
	return (
		<div>
			<button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={`${grid} transition hover:bg-gray-700`}>
				{head}
			</button>
			{open && (
				<div className="px-2 pb-4 pt-2 @min-[40rem]:pl-[6.3rem]">
					{href && <OpenPageLink href={href} className="mb-2" />}
					{detail}
				</div>
			)}
		</div>
	)
}
