/**
 * The PvP page's Rankings view (`?view=rankings`): what the players who
 * posted to this event's gallery built, counted (notes/rankings-page-plan.md,
 * Henry: "ranking based on teams that people submitted into the gallery").
 * The event on screen only. Early access only (owner, 2026-10-27), on the
 * server as well; the page shows the early-access card instead for anyone
 * else.
 *
 * The server counts (GET /rankings/gallery/<kind>/<id>), hourly; this draws
 * two tables with the Rankings page's RankList. What the GUIDES recommend is
 * the Rankings page's Guide rankings tab, linked from here.
 */

import { Link } from "react-router-dom"
import { Loader2 } from "lucide-react"
import type { RaceEvent } from "../../types"
import type { PvpStyle } from "../../types/pvpGuide"
import { useGalleryRankings } from "../../hooks/useGalleryRankings"
import { usePvpCatalogue } from "../../hooks/usePvpCatalogue"
import { useOshiIds } from "../../hooks/useOshiIds"
import { FramedUma } from "../FramedUma"
import { RankList } from "../rankings/RankList"
import { STYLE_LABELS } from "../../utils/pvpGuide"
import { refForRaceEvent } from "../../utils/pvpEvent"
import { formatShare } from "../../utils/guideRankings"
import { formatDate } from "../../utils/dateFormat"
import { formatTimeAgo } from "../../utils/relativeDate"

const STYLES: PvpStyle[] = ["runaway", "front", "pace", "late", "end"]
const PANEL_NOTE = "rounded-xl border border-edge bg-gray-800/60 p-4 text-sm text-gray-300"

export function PvpGalleryRankings({ event }: { event: RaceEvent }) {
	const rankings = useGalleryRankings(refForRaceEvent(event))
	const catalogue = usePvpCatalogue()
	const oshiIds = useOshiIds()

	if (rankings.status === "refused") return <p className={PANEL_NOTE}>Rankings are open to supporters first.</p>
	if (rankings.status === "error" || catalogue.status === "error") {
		return <p className={PANEL_NOTE}>The rankings didn't load. Reload the page to try again.</p>
	}
	if (rankings.status !== "ready" || catalogue.status !== "ready") {
		return (
			<div className="flex items-center gap-2 text-sm text-gray-400" role="status">
				<Loader2 className="h-4 w-4 animate-spin" />
				Counting the gallery...
			</div>
		)
	}

	const { payload } = rankings
	const umas = payload.umas.filter((row) => catalogue.umasById.has(row.uma))
	const cards = payload.cards.filter((row) => catalogue.cardsById.has(row.card))

	return (
		<div className="flex flex-col gap-4">
			<p className="text-sm text-gray-300">
				{payload.posts === 0
					? "Nobody has posted a team for this event yet."
					: `Counting the ${payload.posts === 1 ? "team" : `${payload.posts} teams`} posted to the gallery. `}
				<time dateTime={payload.generated_at} title={formatDate(payload.generated_at)} className="text-xs text-gray-400">
					Updated {formatTimeAgo(payload.generated_at)}.
				</time>{" "}
				<Link to="/app/rankings" className="text-xs text-brand transition hover:text-brand/75">
					What the guides recommend
				</Link>
			</p>
			{payload.posts > 0 && (
				<div className="grid items-start gap-4 lg:grid-cols-2">
					<RankList
						title="Umas"
						hint="Posted teams with her, and the strategies they run her on."
						empty="No uma to show."
						rows={umas.map((row, index) => {
							const uma = catalogue.umasById.get(row.uma)
							const styles = STYLES.filter((style) => row.styles[style]).map((style) => `${STYLE_LABELS[style]} ${row.styles[style]}`)
							return {
								key: row.uma,
								place: index + 1,
								name: uma?.name ?? "Unknown uma",
								art: <FramedUma src={uma?.portrait ?? uma?.image} oshi={oshiIds.has(row.uma)} className="w-full" />,
								counts: `${row.teams} ${row.teams === 1 ? "team" : "teams"} · ${formatShare(row.teams / payload.posts)}`,
								details: [["By strategy", styles.join(" · ")]],
							}
						})}
					/>
					<RankList
						title="Support cards"
						hint="Decks with the card, the borrowed card included."
						empty="No card to show."
						rows={cards.map((row, index) => {
							const card = catalogue.cardsById.get(row.card)
							const parts = [`${row.decks} ${row.decks === 1 ? "deck" : "decks"} · ${formatShare(row.decks / payload.decks)}`]
							if (row.borrows > 0) parts.push(`${row.borrows} borrowed`)
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
			)}
		</div>
	)
}
