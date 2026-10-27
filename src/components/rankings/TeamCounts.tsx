/**
 * Two ranked tables for a set of teams the server counted
 * (views/rankings.count_teams): umas by teams with her, with the strategies
 * they run her on, and support cards by member decks, the borrowed card
 * included and counted apart. Shared by the PvP page's Rankings view
 * (gallery posts) and the Rankings page's PvP tab (every saved team), so the
 * two read the same.
 */

import type { PvpStyle } from "../../types/pvpGuide"
import type { PvpCatalogueIndex } from "../../hooks/usePvpCatalogue"
import { useOshiIds } from "../../hooks/useOshiIds"
import { FramedUma } from "../FramedUma"
import { STYLE_LABELS } from "../../utils/pvpGuide"
import { formatShare } from "../../utils/guideRankings"
import { RankList } from "./RankList"

const STYLES: PvpStyle[] = ["runaway", "front", "pace", "late", "end"]

export interface TeamCountsData {
	/** Teams counted: an uma's share is out of this. */
	teams: number
	/** Members' decks counted: a card's share is out of this. */
	decks: number
	umas: Array<{ uma: number; teams: number; styles: Partial<Record<string, number>> }>
	cards: Array<{ card: number; decks: number; borrows: number }>
}

export function TeamCounts({ counts, catalogue, umaHint, cardHint }: {
	counts: TeamCountsData
	catalogue: PvpCatalogueIndex
	umaHint: string
	cardHint: string
}) {
	const oshiIds = useOshiIds()
	// An id that left the catalogue can't be drawn, so it is left off.
	const umas = counts.umas.filter((row) => catalogue.umasById.has(row.uma))
	const cards = counts.cards.filter((row) => catalogue.cardsById.has(row.card))
	return (
		<div className="grid items-start gap-4 @4xl:grid-cols-2">
			<RankList
				title="Umas"
				hint={umaHint}
				empty="No uma to show."
				rows={umas.map((row, index) => {
					const uma = catalogue.umasById.get(row.uma)
					const styles = STYLES.filter((style) => row.styles[style]).map((style) => `${STYLE_LABELS[style]} ${row.styles[style]}`)
					return {
						key: row.uma,
						place: index + 1,
						name: uma?.name ?? "Unknown uma",
						art: <FramedUma src={uma?.portrait ?? uma?.image} oshi={oshiIds.has(row.uma)} className="w-full" />,
						counts: `${row.teams.toLocaleString()} ${row.teams === 1 ? "team" : "teams"} · ${formatShare(row.teams / counts.teams)}`,
						details: [["By strategy", styles.join(" · ")]],
					}
				})}
			/>
			<RankList
				title="Support cards"
				hint={cardHint}
				empty="No card to show."
				rows={cards.map((row, index) => {
					const card = catalogue.cardsById.get(row.card)
					const parts = [`${row.decks.toLocaleString()} ${row.decks === 1 ? "deck" : "decks"} · ${formatShare(row.decks / counts.decks)}`]
					if (row.borrows > 0) parts.push(`${row.borrows.toLocaleString()} borrowed`)
					return {
						key: row.card,
						place: index + 1,
						name: card?.name ?? "Unknown card",
						art: card?.image ? (
							<img src={card.image} alt="" loading="lazy" decoding="async" className="block aspect-[3/4] w-full rounded object-cover" />
						) : (
							<span className="block aspect-[3/4] w-full rounded bg-gray-700" />
						),
						counts: parts.join(" · "),
						details: [],
					}
				})}
			/>
		</div>
	)
}
