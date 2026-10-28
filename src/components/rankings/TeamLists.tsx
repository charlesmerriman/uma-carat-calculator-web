/**
 * The lists for a set of teams as shares (types/rankingsTabs.ts TeamSharesData),
 * shared by the Rankings page's PvP tab (every saved team) and the PvP
 * page's Rankings view (gallery posts), so the two read the same (mocks
 * 09-pvp.png and 17-pvp-page.png):
 *
 *   UmaBuildList   umas by teams with her, the bar split by running style
 *   CardBuildList  cards by member decks, the type chip and borrows under
 *                  the name
 *   TrioList       the exact three-uma teams built most
 *
 * Each takes the caller's extra line under a name (`sub`: the PvP page's
 * "Guide recommends her") and an uma row's opened breakdown (`detail`).
 * An id that left the catalogue can't be drawn, so it is left off. Every
 * figure is a share, never a count of teams or decks (owner, 2026-10-28).
 */

import type { ReactNode } from "react"
import type { TeamSharesData } from "../../types/rankingsTabs"
import type { PvpCatalogueIndex } from "../../hooks/usePvpCatalogue"
import { useOshiIds } from "../../hooks/useOshiIds"
import { FramedUma } from "../FramedUma"
import { formatShare } from "../../utils/guideRankings"
import { CardArt } from "./kit/CardArt"
import type { MovementValue } from "./kit/Movement"
import { CardTypeChip } from "./kit/CardTypeChip"
import { Panel } from "./kit/Panel"
import { RankRow } from "./kit/RankRow"
import { RankedList } from "./kit/RankedList"
import { StyleLegend } from "./kit/StyleLegend"
import { stylePart } from "./kit/stylePart"
import { MEMBER_STYLES, knownUmas, stylesOf, type UmaBuildRow } from "./teamCounts"

export function UmaBuildList({ label, hint, counts, catalogue, sub, detail, moves }: {
	label: string
	hint: string
	counts: Pick<TeamSharesData, "umas">
	catalogue: PvpCatalogueIndex
	sub?: (uma: number) => ReactNode
	detail?: (row: UmaBuildRow) => ReactNode
	/** Rank movement over the week, by uma id (utils/rankingsMovement.ts). */
	moves?: ReadonlyMap<number, MovementValue>
}) {
	const oshiIds = useOshiIds()
	const umas = knownUmas(counts, catalogue)
	const leader = umas[0]?.share ?? 0
	const used = MEMBER_STYLES.filter((style) => umas.some((row) => (row.styles[style] ?? 0) > 0))
	return (
		<RankedList
			label={label}
			title
			hint={hint}
			items={umas}
			itemKey={(row) => row.uma}
			empty="No uma to show."
			footnote={<StyleLegend entries={used.map((style) => [style, null])} />}
			render={(row, index) => {
				const uma = catalogue.umasById.get(row.uma)
				return (
					<RankRow
						place={index + 1}
						art={<FramedUma src={uma?.portrait ?? uma?.image} oshi={oshiIds.has(row.uma)} className="w-12" />}
						name={uma?.name ?? "Unknown uma"}
						movement={moves?.get(row.uma)}
						sub={sub?.(row.uma)}
						fill={leader > 0 ? row.share / leader : 0}
						parts={stylesOf(row).map(([style, share]) => stylePart(style, share))}
						count={formatShare(row.share)}
						detail={detail?.(row)}
					/>
				)
			}}
		/>
	)
}

export function CardBuildList({ label, hint, counts, catalogue, sub, moves }: {
	label: string
	hint: string
	counts: Pick<TeamSharesData, "cards">
	catalogue: PvpCatalogueIndex
	sub?: (card: number) => ReactNode
	/** Rank movement over the week, by card id. */
	moves?: ReadonlyMap<number, MovementValue>
}) {
	const cards = counts.cards.filter((row) => catalogue.cardsById.has(row.card))
	const leader = cards[0]?.share ?? 0
	return (
		<RankedList
			label={label}
			title
			hint={hint}
			items={cards}
			itemKey={(row) => row.card}
			empty="No card to show."
			render={(row, index) => {
				const card = catalogue.cardsById.get(row.card)
				return (
					<RankRow
						place={index + 1}
						art={<CardArt card={card} />}
						name={card?.name ?? "Unknown card"}
						movement={moves?.get(row.card)}
						sub={
							<>
								<CardTypeChip type={card?.card_type} />
								{sub?.(row.card)}
								{row.borrowed > 0 && <span>{formatShare(row.borrowed)} borrowed</span>}
							</>
						}
						fill={leader > 0 ? row.share / leader : 0}
						count={formatShare(row.share)}
					/>
				)
			}}
		/>
	)
}

/** The exact three-uma teams built most (mock 09-pvp.png): three portraits, the names, the share of teams. */
export function TrioList({ trios, catalogue }: {
	trios: NonNullable<TeamSharesData["trios"]>
	catalogue: PvpCatalogueIndex
}) {
	const oshiIds = useOshiIds()
	const shown = trios.filter((trio) => trio.umas.every((id) => catalogue.umasById.has(id))).slice(0, 5)
	if (shown.length === 0) return null
	return (
		<Panel title="Trios players build most" hint="Exact three-uma teams, any styles.">
			<ol className="flex flex-col gap-2.5">
				{shown.map((trio, index) => {
					const umas = trio.umas.map((id) => catalogue.umasById.get(id)!)
					return (
						<li key={trio.umas.join("-")} className="flex min-w-0 items-center gap-2.5 px-1">
							<span className="w-4 shrink-0 text-right font-mono text-xs tabular-nums text-gray-400">{index + 1}</span>
							<span className="flex shrink-0 gap-1">
								{umas.map((uma) => (
									<FramedUma key={uma.id} src={uma.portrait ?? uma.image} oshi={oshiIds.has(uma.id)} className="w-9" />
								))}
							</span>
							<span className="flex min-w-0 flex-col">
								<b className="text-[13px] font-semibold text-gray-100">{umas.map((uma) => uma.name).join(" · ")}</b>
								<span className="text-[11px] tabular-nums text-gray-400">
									{formatShare(trio.share)} of teams
								</span>
							</span>
						</li>
					)
				})}
			</ol>
		</Panel>
	)
}
