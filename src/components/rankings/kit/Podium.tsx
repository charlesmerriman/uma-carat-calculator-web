/**
 * Second and third place, under the tab's hero (notes/rankings-polish-plan.md,
 * canvas shot 04; the hero is first place, kit/RankHero.tsx). Each card is
 * the art, a small caps kicker ("Overall"), the name in the display face,
 * the count and share, its place as a large numeral in her ink, and a 6 px
 * fill along the bottom in her silk (her main colour as far as the fill
 * reaches, then her second): the place's count over the leader's, like the
 * bars. Two across from 40rem of container, stacked under it.
 *
 * Draws the entries it is given, each with its own `place`.
 */

import type { CSSProperties, ReactNode } from "react"
import { Link } from "react-router-dom"
import { CARD_LINK_TITLE } from "../../../utils/hoverCards"
import { colourStyle } from "../../../utils/encyclopedia"
import { Movement, type MovementValue } from "./Movement"

export interface PodiumEntry {
	key: string | number
	/** 1-based: 2 and 3 under the hero. */
	place: number
	art: ReactNode
	name: string
	/** "176 decks" */
	count: ReactNode
	/** "29%" */
	share: ReactNode
	/** count / the leader's count. */
	fill: number
	/** Her two colours (`character_colours`), or none for the page's accent. */
	colours?: readonly string[] | null
	movement?: MovementValue | null
	/** Its Encyclopedia page (useEncyclopediaHrefs): the whole card opens it. */
	href?: string | null
	/** Its card (utils/hoverCards.ts hoverCardProps): a mouse click anywhere on the entry opens it. */
	hover?: Record<string, string>
}

export function Podium({ entries, kicker, label }: {
	entries: PodiumEntry[]
	/** Over the name in small caps: "Overall", "Speed", "Umas". */
	kicker: string
	label: string
}) {
	if (entries.length === 0) return null
	return (
		<ol aria-label={label} className="grid gap-3.5 @min-[40rem]:grid-cols-2">
			{entries.map((entry) => (
				<li
					key={entry.key}
					// The name's link is stretched over the whole entry, art included, so
					// the entry itself carries the card: a click anywhere on it lands on
					// that link, and the layer opens the card in its place.
					{...entry.hover}
					style={colourStyle(entry.colours) as CSSProperties | undefined}
					className="rk-panel rk-paint relative flex min-w-0 items-stretch gap-4 overflow-hidden px-[1.125rem] pb-5 pt-4"
				>
					<span className="flex shrink-0 items-center">{entry.art}</span>
					<span className="flex min-w-0 flex-col justify-center gap-0.5 pr-10">
						<span className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-400">{kicker}</span>
						<span className="flex min-w-0 items-center gap-1.5">
							{entry.href ? (
								// A stretched link: its ::after covers the entry (the li is
								// `relative`), so the whole entry is one click target and
								// the link's name is the entry's name alone.
								<Link
									to={entry.href}
									title={entry.hover ? CARD_LINK_TITLE : "Open in the Encyclopedia"}
									className="truncate font-display text-xl font-bold leading-tight text-gray-50 transition-colors after:absolute after:inset-0 after:rounded-[1.125rem] hover:text-brand focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-brand"
								>
									{entry.name}
								</Link>
							) : (
								<span className="truncate font-display text-xl font-bold leading-tight text-gray-50">{entry.name}</span>
							)}
							<Movement value={entry.movement} />
						</span>
						<span className="text-sm tabular-nums text-gray-400">
							<b className="font-bold text-gray-100">{entry.count}</b> · {entry.share}
						</span>
					</span>
					<span aria-label={`Place ${entry.place}`} className="absolute right-4 top-2.5 font-display text-[2.75rem] font-extrabold leading-none text-(--c1-ink)">
						{entry.place}
					</span>
					<span className="absolute inset-x-0 bottom-0 h-1.5 bg-(--enc-inset)" aria-hidden="true">
						<span className="rk-silk-fill block h-full" style={{ width: `${Math.max(0, Math.min(1, entry.fill)) * 100}%` }} />
					</span>
				</li>
			))}
		</ol>
	)
}
