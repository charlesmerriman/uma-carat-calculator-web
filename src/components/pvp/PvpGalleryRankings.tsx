/**
 * The PvP page's Rankings view (`?view=rankings`): what the players who
 * posted to this event's gallery built, counted (notes/rankings-page-plan.md,
 * Henry: "ranking based on teams that people submitted into the gallery").
 * The event on screen only. Early access only (owner, 2026-10-27), on the
 * server as well; the page shows the early-access card instead for anyone
 * else.
 *
 * THE REDESIGN (notes/rankings-redesign-plan.md step 4, mocks 17, 24): the
 * band (posted teams and decks: the gallery is public, so its counts are
 * too; never its share of every saved team, which would give that total away),
 * the two lists on the Rankings kit (TeamLists.tsx, the PvP tab's own),
 * each row saying what the event's GUIDE does with it ("Guide recommends
 * her", "Guide 3 of 12": in how many of the guide's decks the card is), and
 * the event's most copied posts, each a link to the post.
 *
 * The server counts (GET /rankings/gallery/<kind>/<id>), hourly. The guide
 * comes from the page (usePvpGuide, fetched for this view too).
 */

import { useMemo } from "react"
import { Link } from "react-router-dom"
import { Loader2 } from "lucide-react"
import type { RaceEvent } from "../../types"
import type { PvpGuide } from "../../types/pvpGuide"
import type { PvpGuideState } from "../../hooks/usePvpGuide"
import { useGalleryRankings, type GalleryRankingsPayload } from "../../hooks/useGalleryRankings"
import { usePvpCatalogue, type PvpCatalogueIndex } from "../../hooks/usePvpCatalogue"
import { useOshiIds } from "../../hooks/useOshiIds"
import { FramedUma } from "../FramedUma"
import { movement } from "../../utils/rankingsMovement"
import { formatPvpEvent, pvpEventHref, refForRaceEvent, splitEventName } from "../../utils/pvpEvent"
import { useReportUpdated } from "../rankings/rankingsUpdated"
import { Panel } from "../rankings/kit/Panel"
import { StatBand } from "../rankings/kit/StatBand"
import { CardBuildList, UmaBuildList } from "../rankings/TeamLists"

const PANEL_NOTE = "rounded-xl border border-edge bg-gray-800/60 p-4 text-sm text-gray-300"
const GRID = "grid items-start gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,26rem),1fr))]"

export function PvpGalleryRankings({ event, guide }: { event: RaceEvent; guide: PvpGuideState }) {
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
	return <GalleryBody event={event} payload={rankings.payload} catalogue={catalogue} guide={guide.status === "ready" ? guide.guide : null} />
}

function GalleryBody({ event, payload, catalogue, guide }: {
	event: RaceEvent
	payload: GalleryRankingsPayload
	catalogue: PvpCatalogueIndex
	guide: PvpGuide | null
}) {
	useReportUpdated(payload.generated_at)
	const ref = refForRaceEvent(event)
	const { title } = splitEventName(event)
	const rankingsHref = `/app/rankings?view=pvp&event=${formatPvpEvent(ref)}`

	// What the guide does with each pick: the umas it recommends (any style), and per card the decks holding it.
	const recommended = useMemo(() => new Set(guide?.uma_recommendations.map((pick) => pick.uma.id) ?? []), [guide])
	const deckCounts = useMemo(() => {
		const counts = new Map<number, number>()
		for (const deck of guide?.decks ?? []) {
			// The card itself or the borrowed card, never an "or X" alternative: the rankings' rule.
			const cards = new Set(deck.slots.filter((slot) => slot.order === 0 && slot.support_card).map((slot) => slot.support_card!.id))
			for (const card of cards) counts.set(card, (counts.get(card) ?? 0) + 1)
		}
		return counts
	}, [guide])
	const guideDecks = guide?.decks.length ?? 0

	return (
		<div className="@container flex flex-col gap-3.5">
			<StatBand
				title={`What the gallery is running for ${title}`}
				stats={[
					{ label: "Posted teams", value: payload.posts.toLocaleString() },
					{ label: "Decks", value: payload.decks.toLocaleString() },
				]}
			>
				{payload.posts === 0
					? "Nobody has posted a team for this event yet. "
					: `Counting the ${payload.posts === 1 ? "team" : `${payload.posts.toLocaleString()} teams`} posted to this event's gallery. `}
				Every saved team of three, posted or not, is on the{" "}
				<Link to={rankingsHref} className="text-brand transition hover:text-brand/75">
					Rankings page
				</Link>
				.
			</StatBand>

			{payload.posts > 0 && (
				<div className={GRID}>
					<UmaBuildList
						label="Umas"
						hint={guide ? "Share of posted teams with her, and whether the guide recommends her." : "Share of posted teams with her."}
						counts={payload}
						catalogue={catalogue}
						sub={(uma) => (recommended.has(uma) ? <span className="text-brand">Guide recommends her</span> : null)}
						moves={movement(payload.umas.map((row) => row.uma), payload.previous?.umas)}
					/>
					<CardBuildList
						label="Support cards"
						hint={guideDecks > 0 ? `Share of posted decks with the card, and how many of the guide's ${guideDecks} decks hold it.` : "Share of posted decks with the card."}
						counts={payload}
						catalogue={catalogue}
						sub={(card) => (guideDecks > 0 && deckCounts.has(card) ? <span className="text-brand">Guide {deckCounts.get(card)} of {guideDecks}</span> : null)}
						moves={movement(payload.cards.map((row) => row.card), payload.previous?.cards)}
					/>
				</div>
			)}

			{payload.copied && payload.copied.length > 0 && <MostCopied posts={payload.copied} event={event} catalogue={catalogue} />}
		</div>
	)
}

/** The event's most copied posts (mock 17-pvp-page.png): the team's three umas, the caption, and how often it was copied, each a link to the post. */
function MostCopied({ posts, event, catalogue }: {
	posts: NonNullable<GalleryRankingsPayload["copied"]>
	event: RaceEvent
	catalogue: PvpCatalogueIndex
}) {
	const oshiIds = useOshiIds()
	const base = pvpEventHref(refForRaceEvent(event))
	return (
		<Panel title="Most copied posts" hint="Teams other players copied into My team.">
			<ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-2.5">
				{posts.map((post) => (
					<li key={post.public_id}>
						<Link
							to={`${base}&view=gallery&post=${post.public_id}`}
							className="flex min-w-0 items-center gap-2.5 rounded-[10px] p-1 transition hover:bg-gray-700"
						>
							<span className="flex shrink-0 gap-1">
								{post.umas.map((id) => {
									const uma = catalogue.umasById.get(id)
									return <FramedUma key={id} src={uma?.portrait ?? uma?.image} oshi={oshiIds.has(id)} className="w-10" />
								})}
							</span>
							<span className="flex min-w-0 flex-col">
								<b className="truncate text-[13px] font-semibold text-gray-100">{post.caption || "A posted team"}</b>
								<span className="text-[11px] tabular-nums text-gray-400">
									copied {post.copies.toLocaleString()} {post.copies === 1 ? "time" : "times"}
								</span>
							</span>
						</Link>
					</li>
				))}
			</ul>
		</Panel>
	)
}
