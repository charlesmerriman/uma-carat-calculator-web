/**
 * /app/cards/<game id>: one support card's page. From GET
 * /encyclopedia/cards/<game id>, plus its banners from /calculator-data.
 *
 * The hero draws the card large in the site's own frame (FramedCard), washed
 * in the card type's colour; when the player owns it, the limit break
 * diamonds sit on the art. That settles the owner's first-round answer 5
 * ("bordered picture for now, revisit with the visual overhaul"): framed, as
 * in the Collection. A card with no frameless art yet still draws its
 * bordered picture (FramedCard's own fallback).
 *
 * Its effects at every level are CardEffects (Phase 2), first on the page:
 * they are what a card is for.
 */

import { useParams } from "react-router-dom"
import { FramedCard } from "../FramedCard"
import { useCardPage } from "../../services/encyclopediaQueries"
import { useCalculatorDataSafe } from "../../services/CalculatorContext"
import type { CardPageData } from "../../types/encyclopedia"
import { CARD_TYPE_COLORS } from "../../utils/cardTypes"
import { cardReleases } from "../../utils/encyclopediaBanners"
import { CARD_LIST_PATH, parseGameId } from "../../utils/encyclopediaRoutes"
import { EncyclopediaGate } from "./EncyclopediaTabs"
import {
	Crumbs, EmptyNote, Hero, JapaneseName, JumpBar, NotFound, OwnedLine, PageSkeleton, RarityTag, Section, SubHeading,
	TranslationCredit, TypeTag, WhereTag, type JumpItem,
} from "./pieces"
import { BannerLinks, CardList, OutfitList, ReleaseFacts } from "./facts"
import { CardEffects } from "./CardEffects"
import { SkillList } from "./skillRows"
import { PAGE_CONTAINER, limitBreakWords } from "../../utils/encyclopedia"
import { useOwned } from "../../hooks/useOwned"
import { usePageTitle } from "./usePageTitle"

export const CardPage = () => (
	<EncyclopediaGate>
		<div className={PAGE_CONTAINER}>
			<CardPageBody />
		</div>
	</EncyclopediaGate>
)

const CardPageBody = () => {
	const gameId = parseGameId(useParams().gameId)
	const page = useCardPage(gameId)
	usePageTitle(page.data ? `${page.data.title} ${page.data.name}`.trim() : null)

	if (gameId === null || page.data === null) return <NotFound />
	if (page.isError) return <EmptyNote>This page didn't load. Reload to try again.</EmptyNote>
	if (!page.data) return <PageSkeleton label="Loading" />
	return <CardDetail card={page.data} />
}

export function CardDetail({ card }: { card: CardPageData }) {
	const calculator = useCalculatorDataSafe()
	const limitBreak = useOwned().cards.get(card.id)
	const releases = cardReleases(calculator?.supportBannerData ?? [], card.id)
	const isGroup = card.card_type === "group"
	const hints = card.skills.filter((skill) => skill.source === "hint")
	const events = card.skills.filter((skill) => skill.source === "event")
	// A card on no banner (most Rs, SRs and event SSRs) still has the game's own Global date.
	const globalDate = releases.globalDate ?? card.released_at

	const effects = card.effects ?? []
	const caps = card.caps ?? []
	const hasEffects = effects.length > 0 && caps.length > 0

	const jump = ([
		hasEffects && { id: "effects", label: "Effects", count: effects.length },
		card.skills.length > 0 && { id: "skills", label: "Skills", count: card.skills.length },
		releases.banners.length > 0 && { id: "banners", label: "Banners", count: releases.banners.length },
		card.outfits.length > 0 && { id: "trainees", label: "As a trainee", count: card.outfits.length },
		card.cards.length > 0 && { id: "cards", label: "Other cards", count: card.cards.length },
	] as (JumpItem | false)[]).filter((item): item is JumpItem => Boolean(item))

	return (
		<article className="flex flex-col gap-4">
			<Crumbs list="Support cards" listPath={CARD_LIST_PATH} name={card.title || card.name} />
			<Hero
				accent={CARD_TYPE_COLORS[card.card_type]}
				art={<FramedCard card={card} limitBreaks={limitBreak ?? null} alt={card.name} className="enc-hero__art--card" />}
				eyebrow="Support card"
				name={card.name}
				title={card.title}
				japanese={<JapaneseName name={card.jp_name} title={card.jp_title} />}
				tags={
					<>
						<RarityTag rarity={card.rarity} />
						<TypeTag type={card.card_type} />
						<WhereTag onGlobal={card.on_global} />
					</>
				}
				lead={card.purpose || undefined}
				owned={limitBreak !== undefined && <OwnedLine tab="cards" detail={limitBreakWords(limitBreak)} />}
				facts={
					<ReleaseFacts
						jpDate={releases.jpDate}
						globalDate={globalDate}
						predicted={releases.globalDate !== null && releases.predicted}
					/>
				}
			/>
			<JumpBar items={jump} />

			{hasEffects && (
				<CardEffects id="effects" effects={effects} caps={caps} unique={card.unique_effect ?? null} limitBreak={limitBreak} />
			)}
			{card.skills.length > 0 && (
				<Section id="skills" title="Skills" count={card.skills.length}>
					{hints.length > 0 && (
						<div className="flex flex-col gap-2">
							<SubHeading>Skill hints</SubHeading>
							<SkillList skills={hints} />
						</div>
					)}
					{events.length > 0 && (
						<div className="flex flex-col gap-2">
							<SubHeading>Skills from events</SubHeading>
							<SkillList skills={events} />
						</div>
					)}
				</Section>
			)}
			{releases.banners.length > 0 && (
				<Section id="banners" title="Banners" count={releases.banners.length}>
					<BannerLinks banners={releases.banners} />
				</Section>
			)}
			{card.outfits.length > 0 && (
				<Section id="trainees" title={isGroup ? "Its members as trainees" : `${card.name} as a trainee`} count={card.outfits.length}>
					<OutfitList outfits={card.outfits} />
				</Section>
			)}
			{card.cards.length > 0 && (
				<Section id="cards" title={`${card.name}'s other cards`} count={card.cards.length}>
					<CardList cards={card.cards} />
				</Section>
			)}
			{card.uses_translation && <TranslationCredit />}
		</article>
	)
}
