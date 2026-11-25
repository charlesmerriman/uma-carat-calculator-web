/**
 * /app/cards: every support card, from the PvP catalogue (GET /pvp-catalogue,
 * public). Search by name, title or id, filter by type, rarity and where it is
 * out, sort by name, release, game id or what a card gives for one effect
 * (at max limit break or the player's own; notes/card-effect-sort-plan.md),
 * either way round; a tile opens the card's page. Placeholder cards ("your
 * best SSR Speed") are stand-ins, not game cards, so they have no page and
 * aren't here.
 *
 * A tile is the card in the site's own frame (FramedCard), which already
 * carries its type icon, so under it go only the name, the title and the
 * rarity, then what the list is sorted by (an effect, the id, the date). The
 * type's word is still there for a screen reader.
 */

import { useMemo } from "react"
import { useRememberedFilter, useRememberedPicks } from "../../hooks/useRememberedFilter"
import { Link } from "react-router-dom"
import { FramedCard } from "../FramedCard"
import { usePvpCatalogue } from "../../hooks/usePvpCatalogue"
import { CARD_TYPE_LABELS } from "../../utils/cardTypes"
import { CARD_TYPE_ICONS } from "../../utils/cardTypeIcons"
import { cardHref } from "../../utils/encyclopediaRoutes"
import { EncyclopediaFrame, EncyclopediaTabs } from "./EncyclopediaTabs"
import { GroupedGrid } from "./groups"
import { cardIdKey, effectKey, groupsFor, letterKey, mergeSmallGroups, releaseKey } from "../../utils/encyclopediaGroups"
import { Chips, Count, PickChips, SearchBox, SelectFilter, SortControl, Toolbar } from "./listFilters"
import { useCardEffects } from "../../services/encyclopediaQueries"
import { useCalculatorDataSafe } from "../../services/CalculatorContext"
import { EmptyNote, GridSkeleton, JpTag, OwnedMark, RarityTag, TranslationCredit } from "./pieces"
import { useOwned } from "../../hooks/useOwned"
import {
	CARD_SORT_OPTIONS, EFFECT_AT_OPTIONS, OWNED_OPTIONS, PAGE_CONTAINER, RARITY_OPTIONS, RARITY_WORDS, REVERSED_VALUES,
	SHARED_OWNED_KEY, SHARED_WHERE_KEY, SHARED_WHERE_VALUES, TYPE_OPTIONS, WHERE_OPTIONS,
	countLine, effectReading, effectValue, filterCards, listWhere, ownedMatches, releaseDates, sortByEffect, sortFact,
	sortList, values, withGameDates,
	type CardSortOrder, type EffectAt, type OwnedFilter, type SharedWhere,
} from "../../utils/encyclopedia"

// Each type chip is its icon; each rarity chip lights up in its metal once picked.
const TYPE_PICKS = TYPE_OPTIONS.map((option) => ({ ...option, icon: CARD_TYPE_ICONS[option.value] }))
const RARITY_PICKS = RARITY_OPTIONS.map((option) => ({ ...option, tone: RARITY_WORDS[Number(option.value)].toLowerCase() }))

export const CardListPage = () => (
	<EncyclopediaFrame>
		<CardListBody />
	</EncyclopediaFrame>
)

const CardListBody = () => {
	const catalogue = usePvpCatalogue()
	// Remembered for the tab, so a trip to a card's page and back keeps them (useRememberedFilter).
	const [query, setQuery] = useRememberedFilter<string>("cards:query", "")
	const [types, setTypes] = useRememberedPicks("cards:type", values(TYPE_OPTIONS))
	const [rarities, setRarities] = useRememberedPicks("cards:rarity", values(RARITY_OPTIONS))
	// Where and Collection are the settings every list shares (SHARED_WHERE_KEY).
	const [sharedWhere, setWhere] = useRememberedFilter<SharedWhere>(SHARED_WHERE_KEY, "all", SHARED_WHERE_VALUES)
	const where = listWhere(sharedWhere)
	const owned = useOwned()
	const [ownedFilter, setOwnedFilter] = useRememberedFilter<OwnedFilter>(SHARED_OWNED_KEY, "all", values(OWNED_OPTIONS))
	const [sort, setSort] = useRememberedFilter<CardSortOrder>("cards:sort", "name", values(CARD_SORT_OPTIONS))
	const [reversedFlag, setReversed] = useRememberedFilter<string>("cards:sort-reversed", "0", REVERSED_VALUES)
	const reversed = reversedFlag === "1"
	// "By effect": which effect type (as text; "" = the first the data has) and at which limit break.
	const [effectPick, setEffectPick] = useRememberedFilter<string>("cards:effect", "")
	const [effectAtPick, setEffectAt] = useRememberedFilter<EffectAt>("cards:effect-at", "max", values(EFFECT_AT_OPTIONS))
	const byEffect = sort === "effect"
	// Fetched only once "By effect" is picked; until it lands the list keeps name order.
	const effects = useCardEffects(byEffect)
	const effectData = byEffect ? effects.data ?? null : null
	const effectType = effectData?.types.find((entry) => String(entry.type) === effectPick) ?? effectData?.types[0] ?? null
	// Release dates from the banners the calculator already loaded, else the game's own date
	// (an SR, an R, a welfare SSR: on no banner); with neither, a card sorts as undated.
	const banners = useCalculatorDataSafe()?.supportBannerData
	const catalogueCards = catalogue.status === "ready" ? catalogue.catalogue.support_cards : null
	const dates = useMemo(
		() => withGameDates(releaseDates(banners ?? [], (banner) => banner.support_cards), catalogueCards ?? []),
		[banners, catalogueCards]
	)
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
				filterCards(catalogue.catalogue.support_cards, query, types, rarities, where)
					.filter((card) => ownedMatches(showOwned ? ownedFilter : "all", owned.cards, card.id)),
				// Until the effects land, "By effect" keeps name order.
				sort === "effect" ? "name" : sort,
				dates,
				sort === "effect" ? false : reversed,
			)
			: []),
		[catalogue, query, types, rarities, where, owned, ownedFilter, showOwned, sort, dates, reversed]
	)
	const shown = useMemo(
		() => (effectData && effectType ? sortByEffect(cards, effectType.type, limitBreakOf, effectData, reversed) : cards),
		[cards, effectData, effectType, limitBreakOf, reversed]
	)

	// Headings for the whole list, whatever it is sorted by: a letter, a quarter,
	// a rarity or an effect's value (utils/encyclopediaGroups.ts), filtered or not.
	const groups = useMemo(() => {
		if (byEffect) {
			// Until the effects land the list is in name order, so it gets no headings.
			if (!effectData || !effectType) return null
			const format = effectType.format
			const byValue = groupsFor(shown, (card) => {
				const row = effectData.cards[String(card.id)]
				const at = limitBreakOf(card)
				const reading = at !== null && row ? effectReading(row, effectType.type, at) : null
				return effectKey(reading?.value ?? null, at !== null, format)
			})
			// A value only one or two cards reach (a unique effect's) shares its neighbour's heading.
			return mergeSmallGroups(byValue, 3, (low, high) => `${effectValue(low, format)} to ${effectValue(high, format)}`)
		}
		return groupsFor(shown, (card) => {
			if (sort === "release") return releaseKey(dates.get(card.id))
			if (sort === "game_id") return cardIdKey(card)
			return letterKey(card.name)
		})
	}, [shown, byEffect, effectData, effectType, limitBreakOf, sort, dates])

	const tile = (card: (typeof shown)[number]) => {
		const limitBreak = showOwned ? owned.cards.get(card.id) : undefined
		// While sorting by an effect, the tile says what the card gives for it (owner, 2026-11-13).
		const row = effectData?.cards[String(card.id)]
		const at = limitBreakOf(card)
		const reading = effectType && row && at !== null ? effectReading(row, effectType.type, at) : null
		// Sorted by id or date, the tile says its id or date (board, 2026-11-17).
		const fact = sortFact(sort, card, dates)
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
					{fact && <span className="enc-tile__effect">{fact}</span>}
				</Link>
			</li>
		)

	}

	return (
		<div className={PAGE_CONTAINER}>
			<EncyclopediaTabs />
			<Toolbar
				pinned
				scope="cards"
				search={<SearchBox label="Search support cards" placeholder="Search by name or ID..." value={query} onChange={setQuery} />}
				count={catalogue.status === "ready" && <Count>{countLine(shown.length, "card", "cards")}</Count>}
				settings={
					<>
						<Chips label="Where" options={WHERE_OPTIONS} value={where} onChange={setWhere} />
						{showOwned && <Chips label="Collection" options={OWNED_OPTIONS} value={ownedFilter} onChange={setOwnedFilter} />}
					</>
				}
			>
				<PickChips label="Type" options={TYPE_PICKS} picks={types} onChange={setTypes} />
				<PickChips label="Rarity" options={RARITY_PICKS} picks={rarities} onChange={setRarities} />
				<SortControl
					options={CARD_SORT_OPTIONS}
					value={sort}
					onChange={setSort}
					reversed={reversed}
					onReverse={() => setReversed(reversed ? "0" : "1")}
				/>
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
				<GroupedGrid scope="cards" items={shown} groups={groups} tile={tile} noun={["card", "cards"]} className="enc-grid enc-grid--cards" />
			)}
			{/* A JP-only card's title is UmaTL's until Global (or an editor) names it. */}
			{shown.some((card) => !card.on_global && card.title) && <TranslationCredit what="Some JP only titles are" />}
		</div>
	)
}
