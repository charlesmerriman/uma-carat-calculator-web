/**
 * /app/cards: every support card, from the PvP catalogue (GET /pvp-catalogue,
 * public). Search by name or title, filter by type, rarity and where it is
 * out, sort by name, release, game id or what a card gives for one effect
 * (at max limit break or the player's own; notes/card-effect-sort-plan.md);
 * a tile opens the card's page. Placeholder cards ("your best SSR
 * Speed") are stand-ins, not game cards, so they have no page and aren't here.
 *
 * A tile is the card in the site's own frame (FramedCard), which already
 * carries its type icon, so under it go only the name, the title and the
 * rarity. The type's word is still there for a screen reader.
 */

import { useMemo } from "react"
import { useRememberedFilter } from "../../hooks/useRememberedFilter"
import { Link } from "react-router-dom"
import { FramedCard } from "../FramedCard"
import { usePvpCatalogue } from "../../hooks/usePvpCatalogue"
import { CARD_TYPE_LABELS } from "../../utils/cardTypes"
import { cardHref } from "../../utils/encyclopediaRoutes"
import { EncyclopediaGate, EncyclopediaTabs } from "./EncyclopediaTabs"
import { Chips, Count, SearchBox, SelectFilter, Toolbar } from "./listFilters"
import { useCardEffects } from "../../services/encyclopediaQueries"
import { useCalculatorDataSafe } from "../../services/CalculatorContext"
import { EmptyNote, GridSkeleton, JpTag, OwnedMark, RarityTag, TranslationCredit } from "./pieces"
import { useOwned } from "../../hooks/useOwned"
import {
	CARD_SORT_OPTIONS, EFFECT_AT_OPTIONS, OWNED_OPTIONS, PAGE_CONTAINER, RARITY_OPTIONS, TYPE_OPTIONS, WHERE_OPTIONS,
	countLine, effectReading, effectValue, filterCards, ownedMatches, releaseDates, sortByEffect, sortList, values,
	type CardSortOrder, type EffectAt, type OwnedFilter, type RarityFilter, type TypeFilter, type WhereFilter,
} from "../../utils/encyclopedia"

export const CardListPage = () => (
	<EncyclopediaGate>
		<CardListBody />
	</EncyclopediaGate>
)

const CardListBody = () => {
	const catalogue = usePvpCatalogue()
	// Remembered for the tab, so a trip to a card's page and back keeps them (useRememberedFilter).
	const [query, setQuery] = useRememberedFilter<string>("cards:query", "")
	const [type, setType] = useRememberedFilter<TypeFilter>("cards:type", "all", values(TYPE_OPTIONS))
	const [rarity, setRarity] = useRememberedFilter<RarityFilter>("cards:rarity", "all", values(RARITY_OPTIONS))
	const [where, setWhere] = useRememberedFilter<WhereFilter>("cards:where", "all", values(WHERE_OPTIONS))
	const owned = useOwned()
	const [ownedFilter, setOwnedFilter] = useRememberedFilter<OwnedFilter>("cards:owned", "all", values(OWNED_OPTIONS))
	const [sort, setSort] = useRememberedFilter<CardSortOrder>("cards:sort", "name", values(CARD_SORT_OPTIONS))
	// "By effect": which effect type (as text; "" = the first the data has) and at which limit break.
	const [effectPick, setEffectPick] = useRememberedFilter<string>("cards:effect", "")
	const [effectAtPick, setEffectAt] = useRememberedFilter<EffectAt>("cards:effect-at", "max", values(EFFECT_AT_OPTIONS))
	const byEffect = sort === "effect"
	// Fetched only once "By effect" is picked; until it lands the list keeps name order.
	const effects = useCardEffects(byEffect)
	const effectData = byEffect ? effects.data ?? null : null
	const effectType = effectData?.types.find((entry) => String(entry.type) === effectPick) ?? effectData?.types[0] ?? null
	// Release dates from the banners the calculator already loaded; none yet means Newest sorts by name.
	const banners = useCalculatorDataSafe()?.supportBannerData
	const dates = useMemo(() => releaseDates(banners ?? [], (banner) => banner.support_cards), [banners])
	// The Collection filter and the ticks only for a signed-in player with something in their Collection.
	const showOwned = owned.signedIn && !owned.empty
	// "My limit break" only means something with a Collection; without one it reads as max.
	const effectAt: EffectAt = showOwned ? effectAtPick : "max"
	const limitBreakOf = useMemo(
		() => (card: { id: number }) => (effectAt === "max" ? 4 : owned.cards.get(card.id) ?? null),
		[effectAt, owned]
	)
	const cards = useMemo(
		() => (catalogue.status === "ready"
			? sortList(
				filterCards(catalogue.catalogue.support_cards, query, type, rarity, where)
					.filter((card) => ownedMatches(showOwned ? ownedFilter : "all", owned.cards, card.id)),
				sort === "effect" ? "name" : sort,
				dates,
			)
			: []),
		[catalogue, query, type, rarity, where, owned, ownedFilter, showOwned, sort, dates]
	)
	const shown = useMemo(
		() => (effectData && effectType ? sortByEffect(cards, effectType.type, limitBreakOf, effectData) : cards),
		[cards, effectData, effectType, limitBreakOf]
	)

	return (
		<div className={PAGE_CONTAINER}>
			<EncyclopediaTabs />
			<Toolbar
				search={<SearchBox label="Search support cards" value={query} onChange={setQuery} />}
				count={catalogue.status === "ready" && <Count>{countLine(shown.length, "card", "cards")}</Count>}
			>
				<Chips label="Type" options={TYPE_OPTIONS} value={type} onChange={setType} />
				<Chips label="Rarity" options={RARITY_OPTIONS} value={rarity} onChange={setRarity} />
				<Chips label="Where" options={WHERE_OPTIONS} value={where} onChange={setWhere} />
				{showOwned && <Chips label="Collection" options={OWNED_OPTIONS} value={ownedFilter} onChange={setOwnedFilter} />}
				<Chips label="Sort" options={CARD_SORT_OPTIONS} value={sort} onChange={setSort} />
				{byEffect && effectData && effectType && (
					<SelectFilter
						label="Effect"
						options={effectData.types.map((entry) => ({ value: String(entry.type), label: entry.name }))}
						value={String(effectType.type)}
						onChange={setEffectPick}
					/>
				)}
				{byEffect && showOwned && <Chips label="At" options={EFFECT_AT_OPTIONS} value={effectAt} onChange={setEffectAt} />}
			</Toolbar>
			{byEffect && effects.isError && <EmptyNote>The card effects didn't load, so the list is by name. Reload to try again.</EmptyNote>}
			{catalogue.status === "loading" ? (
				<GridSkeleton label="Loading support cards" tall />
			) : catalogue.status === "error" ? (
				<EmptyNote>The card list didn't load. Reload the page to try again.</EmptyNote>
			) : shown.length === 0 ? (
				<EmptyNote>No card matches that.</EmptyNote>
			) : (
				<ul className="enc-grid">
					{shown.map((card) => {
						const limitBreak = showOwned ? owned.cards.get(card.id) : undefined
						// While sorting by an effect, the tile says what the card gives for it (owner, 2026-11-13).
						const row = effectData?.cards[String(card.id)]
						const at = limitBreakOf(card)
						const reading = effectType && row && at !== null ? effectReading(row, effectType.type, at) : null
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
									{reading && effectType && (
										<span className="enc-tile__effect">
											{effectType.name} {effectValue(reading.value, effectType.format)}
											{/* The unique has a part nobody has decoded yet, so it may give more. */}
											{reading.unsure && <abbr title="Its unique effect has a part we can't read yet, so it may give more.">+?</abbr>}
										</span>
									)}
								</Link>
							</li>
						)
					})}
				</ul>
			)}
			{/* A JP-only card's title is UmaTL's until Global (or an editor) names it. */}
			{shown.some((card) => !card.on_global && card.title) && <TranslationCredit what="Some JP only titles are" />}
		</div>
	)
}
