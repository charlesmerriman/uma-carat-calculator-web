/**
 * The Guides tab for a reader without early access (redesign step 6): the
 * band from the server's totals, Overall or Umas, the top three as the
 * podium, then the supporter card. The server counted them with every box
 * ticked (backend rankings_public.py), so there are no filters to offer.
 */

import { useState } from "react"
import type { LimitedGuideRankings } from "../../types/guideRankings"
import type { PvpCatalogueIndex } from "../../hooks/usePvpCatalogue"
import { useOshiIds } from "../../hooks/useOshiIds"
import { FramedUma } from "../FramedUma"
import { formatShare } from "../../utils/guideRankings"
import { useReportUpdated } from "./rankingsUpdated"
import { CardArt } from "./kit/CardArt"
import { Lens } from "./kit/Lens"
import { Podium, type PodiumEntry } from "./kit/Podium"
import { StatBand } from "./kit/StatBand"
import { SupporterCard } from "./kit/SupporterCard"

const plural = (count: number, one: string, many = `${one}s`) => `${count.toLocaleString()} ${count === 1 ? one : many}`

export function LimitedGuides({ payload, catalogue }: { payload: LimitedGuideRankings; catalogue: PvpCatalogueIndex }) {
	useReportUpdated(payload.generated_at)
	const oshiIds = useOshiIds()
	const [lens, setLens] = useState<"overall" | "umas">("overall")
	const { totals } = payload

	const cardLeader = payload.cards[0]?.decks ?? 0
	const umaLeader = payload.umas[0]?.picks ?? 0
	const entries: PodiumEntry[] =
		lens === "umas"
			? payload.umas.map((rank) => {
					const uma = catalogue.umasById.get(rank.uma)
					return {
						key: rank.uma,
						art: <FramedUma src={uma?.portrait ?? uma?.image} oshi={oshiIds.has(rank.uma)} className="w-16" />,
						name: uma?.name ?? "Unknown uma",
						count: plural(rank.picks, "pick"),
						share: formatShare(rank.share),
						fill: umaLeader ? rank.picks / umaLeader : 0,
					}
				})
			: payload.cards.map((rank) => {
					const card = catalogue.cardsById.get(rank.card)
					return {
						key: rank.card,
						art: <CardArt card={card} className="w-14" />,
						name: card?.name ?? "Unknown card",
						count: plural(rank.decks, "deck"),
						share: formatShare(rank.share),
						fill: cardLeader ? rank.decks / cardLeader : 0,
					}
				})

	return (
		<div className="flex flex-col gap-3.5">
			<StatBand
				title="What the guides recommend"
				stats={[
					{ label: "Guides counted", value: totals.guides.toLocaleString() },
					{ label: "Decks", value: totals.decks.toLocaleString() },
					{ label: totals.scenarios === 1 ? "Scenario" : "Scenarios", value: totals.scenarios.toLocaleString() },
				]}
			>
				Every card and uma the published guides put in a deck, counted across every guide.
			</StatBand>
			<Lens
				label="Which list"
				options={[
					{ id: "overall", label: "Overall" },
					{ id: "umas", label: "Umas" },
				]}
				value={lens}
				onChange={setLens}
			/>
			<Podium entries={entries} kicker={lens === "overall" ? "overall" : ""} label={`Top three, ${lens === "umas" ? "Umas" : "Overall"}`} />
			<SupporterCard />
		</div>
	)
}
