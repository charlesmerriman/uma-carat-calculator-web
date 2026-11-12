/**
 * /app/cards: every support card, from the PvP catalogue (GET /pvp-catalogue,
 * public). Search by name or title, filter by type, rarity and where it is
 * out; a tile opens the card's page. Placeholder cards ("your best SSR
 * Speed") are stand-ins, not game cards, so they have no page and aren't here.
 */

import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { JpOnlyTag } from "../pvp/SkillDetail"
import { usePvpCatalogue } from "../../hooks/usePvpCatalogue"
import { cardHref } from "../../utils/encyclopediaRoutes"
import { EncyclopediaGate, EncyclopediaTabs } from "./EncyclopediaTabs"
import { Chips, SearchBox } from "./listFilters"
import {
	PAGE_CONTAINER, RARITY_OPTIONS, TYPE_OPTIONS, WHERE_OPTIONS, cardLine, countLine, filterCards,
	type RarityFilter, type TypeFilter, type WhereFilter,
} from "../../utils/encyclopedia"

export const CardListPage = () => (
	<EncyclopediaGate>
		<CardListBody />
	</EncyclopediaGate>
)

const CardListBody = () => {
	const catalogue = usePvpCatalogue()
	const [query, setQuery] = useState("")
	const [type, setType] = useState<TypeFilter>("all")
	const [rarity, setRarity] = useState<RarityFilter>("all")
	const [where, setWhere] = useState<WhereFilter>("all")
	const cards = useMemo(
		() => (catalogue.status === "ready" ? filterCards(catalogue.catalogue.support_cards, query, type, rarity, where) : []),
		[catalogue, query, type, rarity, where]
	)

	return (
		<div className={PAGE_CONTAINER}>
			<EncyclopediaTabs />
			<div className="flex flex-col gap-2">
				<SearchBox label="Search support cards" value={query} onChange={setQuery} />
				<Chips label="Type" options={TYPE_OPTIONS} value={type} onChange={setType} />
				<Chips label="Rarity" options={RARITY_OPTIONS} value={rarity} onChange={setRarity} />
				<Chips label="Where" options={WHERE_OPTIONS} value={where} onChange={setWhere} />
			</div>
			{catalogue.status === "loading" ? (
				<p className="flex items-center gap-2 text-sm text-gray-400" role="status">
					<Loader2 className="h-4 w-4 animate-spin" /> Loading support cards...
				</p>
			) : catalogue.status === "error" ? (
				<p className="text-sm text-gray-400">The card list didn't load. Reload the page to try again.</p>
			) : (
				<>
					<p className="text-xs text-gray-400" aria-live="polite">{countLine(cards.length, "card", "cards")}</p>
					{cards.length === 0 ? (
						<p className="text-sm text-gray-400">No card matches that.</p>
					) : (
						<ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
							{cards.map((card) => (
								<li key={card.id}>
									<Link
										to={cardHref(card.game_id as number)}
										className="flex h-full flex-col items-center gap-1.5 rounded-lg border border-edge bg-(--card-fill) p-2 text-center text-sm text-gray-100 transition hover:border-gray-500"
									>
										{card.image ? (
											<img src={card.image} alt="" className="aspect-[3/4] w-20 rounded object-cover" loading="lazy" decoding="async" />
										) : (
											<span className="aspect-[3/4] w-20 rounded bg-gray-700" aria-hidden="true" />
										)}
										<span className="line-clamp-2 leading-tight">{card.name}</span>
										<span className="line-clamp-1 text-xs text-gray-400">{card.title}</span>
										<span className="flex items-center gap-1.5 text-xs text-gray-300">
											{cardLine({ rarity: card.rarity, card_type: card.card_type ?? "" })}
											{!card.on_global && <JpOnlyTag className="text-[10px]" />}
										</span>
									</Link>
								</li>
							))}
						</ul>
					)}
				</>
			)}
		</div>
	)
}
