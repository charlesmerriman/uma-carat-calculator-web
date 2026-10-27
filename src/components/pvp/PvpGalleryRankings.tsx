/**
 * The PvP page's Rankings view (`?view=rankings`): what the players who
 * posted to this event's gallery built, counted (notes/rankings-page-plan.md,
 * Henry: "ranking based on teams that people submitted into the gallery").
 * The event on screen only. Early access only (owner, 2026-10-27), on the
 * server as well; the page shows the early-access card instead for anyone
 * else.
 *
 * The server counts (GET /rankings/gallery/<kind>/<id>), hourly; this draws
 * the Rankings page's TeamCounts tables. What the GUIDES recommend is
 * the Rankings page's Guide rankings tab, linked from here.
 */

import { Link } from "react-router-dom"
import { Loader2 } from "lucide-react"
import type { RaceEvent } from "../../types"
import { useGalleryRankings } from "../../hooks/useGalleryRankings"
import { usePvpCatalogue } from "../../hooks/usePvpCatalogue"
import { TeamCounts } from "../rankings/TeamCounts"
import { refForRaceEvent } from "../../utils/pvpEvent"
import { formatDate } from "../../utils/dateFormat"
import { formatTimeAgo } from "../../utils/relativeDate"

const PANEL_NOTE = "rounded-xl border border-edge bg-gray-800/60 p-4 text-sm text-gray-300"

export function PvpGalleryRankings({ event }: { event: RaceEvent }) {
	const rankings = useGalleryRankings(refForRaceEvent(event))
	const catalogue = usePvpCatalogue()

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
				<TeamCounts
					counts={{ ...payload, teams: payload.posts }}
					catalogue={catalogue}
					umaHint="Posted teams with her, and the strategies they run her on."
					cardHint="Decks with the card, the borrowed card included."
				/>
			)}
		</div>
	)
}
