/**
 * /app/cards: every support card, from the PvP catalogue (GET /pvp-catalogue,
 * public). Search by name or title, filter by type, rarity and where it is
 * out; a tile opens the card's page. Placeholder cards ("your best SSR
 * Speed") are stand-ins, not game cards, so they have no page and aren't here.
 *
 * A tile is the card in the site's own frame (FramedCard), which already
 * carries its type icon, so under it go only the name, the title and the
 * rarity. The type's word is still there for a screen reader.
 */

import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { FramedCard } from "../FramedCard"
import { usePvpCatalogue } from "../../hooks/usePvpCatalogue"
import { CARD_TYPE_LABELS } from "../../utils/cardTypes"
import { cardHref } from "../../utils/encyclopediaRoutes"
import { EncyclopediaGate, EncyclopediaTabs } from "./EncyclopediaTabs"
import { Chips, Count, SearchBox, Toolbar } from "./listFilters"
import { EmptyNote, GridSkeleton, JpTag, OwnedMark, RarityTag } from "./pieces"
import { useOwned } from "../../hooks/useOwned"
import {
	OWNED_OPTIONS, PAGE_CONTAINER, RARITY_OPTIONS, TYPE_OPTIONS, WHERE_OPTIONS, countLine, filterCards,
	ownedMatches, type OwnedFilter, type RarityFilter, type TypeFilter, type WhereFilter,
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
	const owned = useOwned()
	const [ownedFilter, setOwnedFilter] = useState<OwnedFilter>("all")
	// The Collection filter and the ticks only for a signed-in player with something in their Collection.
	const showOwned = owned.signedIn && !owned.empty
	const cards = useMemo(
		() => (catalogue.status === "ready"
			? filterCards(catalogue.catalogue.support_cards, query, type, rarity, where)
				.filter((card) => ownedMatches(showOwned ? ownedFilter : "all", owned.cards, card.id))
			: []),
		[catalogue, query, type, rarity, where, owned, ownedFilter, showOwned]
	)

	return (
		<div className={PAGE_CONTAINER}>
			<EncyclopediaTabs />
			<Toolbar
				search={<SearchBox label="Search support cards" value={query} onChange={setQuery} />}
				count={catalogue.status === "ready" && <Count>{countLine(cards.length, "card", "cards")}</Count>}
			>
				<Chips label="Type" options={TYPE_OPTIONS} value={type} onChange={setType} />
				<Chips label="Rarity" options={RARITY_OPTIONS} value={rarity} onChange={setRarity} />
				<Chips label="Where" options={WHERE_OPTIONS} value={where} onChange={setWhere} />
				{showOwned && <Chips label="Collection" options={OWNED_OPTIONS} value={ownedFilter} onChange={setOwnedFilter} />}
			</Toolbar>
			{catalogue.status === "loading" ? (
				<GridSkeleton label="Loading support cards" tall />
			) : catalogue.status === "error" ? (
				<EmptyNote>The card list didn't load. Reload the page to try again.</EmptyNote>
			) : cards.length === 0 ? (
				<EmptyNote>No card matches that.</EmptyNote>
			) : (
				<ul className="enc-grid">
					{cards.map((card) => {
						const limitBreak = showOwned ? owned.cards.get(card.id) : undefined
						return (
							<li key={card.id}>
								<Link to={cardHref(card.game_id as number)} className="enc-tile">
									{limitBreak !== undefined && <OwnedMark />}
									<FramedCard card={card} limitBreaks={limitBreak ?? null} className="enc-tile__art--card" />
									<span className="enc-tile__name">{card.name}</span>
									{card.title && <span className="enc-tile__sub">{card.title}</span>}
									<span className="enc-tile__facts">
										<RarityTag rarity={card.rarity} />
										<span className="sr-only">{CARD_TYPE_LABELS[card.card_type ?? ""]}</span>
										{!card.on_global && <JpTag />}
									</span>
								</Link>
							</li>
						)
					})}
				</ul>
			)}
		</div>
	)
}
