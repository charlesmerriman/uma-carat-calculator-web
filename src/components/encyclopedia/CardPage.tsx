/**
 * /app/cards/<game id>: one support card's page. From GET
 * /encyclopedia/cards/<game id>, plus its banners from /calculator-data. The
 * card is drawn as its bordered picture (owner's first-round answer 5; the
 * visual overhaul revisits it).
 *
 * Its effects at every level come in Phase 2 (PRs 9 and 10).
 */

import { useParams } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { JpOnlyTag } from "../pvp/SkillDetail"
import { useCardPage } from "../../services/encyclopediaQueries"
import { useCalculatorDataSafe } from "../../services/CalculatorContext"
import type { CardPageData } from "../../types/encyclopedia"
import { cardReleases } from "../../utils/encyclopediaBanners"
import { CARD_LIST_PATH, parseGameId } from "../../utils/encyclopediaRoutes"
import { EncyclopediaGate } from "./EncyclopediaTabs"
import { BannerLinks, CardList, JapaneseName, OutfitList, OwnedLine, ReleaseLine, Section, SkillList } from "./pieces"
import { PAGE_CONTAINER, cardLine, limitBreakWords } from "../../utils/encyclopedia"
import { useOwned } from "../../hooks/useOwned"
import { Crumbs, NotFound } from "./UmaPage"
import { usePageTitle } from "./usePageTitle"

export const CardPage = () => (
	<EncyclopediaGate>
		<CardPageBody />
	</EncyclopediaGate>
)

const CardPageBody = () => {
	const gameId = parseGameId(useParams().gameId)
	const page = useCardPage(gameId)
	usePageTitle(page.data ? `${page.data.title} ${page.data.name}`.trim() : null)

	if (gameId === null || page.data === null) return <NotFound />
	if (page.isError) {
		return <p className={`${PAGE_CONTAINER} text-sm text-gray-400`}>This page didn't load. Reload to try again.</p>
	}
	if (!page.data) {
		return (
			<p className={`${PAGE_CONTAINER} flex items-center gap-2 text-sm text-gray-400`} role="status">
				<Loader2 className="h-4 w-4 animate-spin" /> Loading...
			</p>
		)
	}
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

	return (
		<article className={PAGE_CONTAINER}>
			<Crumbs list="Support cards" listPath={CARD_LIST_PATH} name={card.title || card.name} />
			<header className="flex items-start gap-4">
				{card.image ? (
					<img src={card.image} alt={card.name} className="aspect-[3/4] w-28 shrink-0 rounded-lg object-cover sm:w-32" />
				) : (
					<span className="aspect-[3/4] w-28 shrink-0 rounded-lg bg-gray-700 sm:w-32" aria-hidden="true" />
				)}
				<div className="flex min-w-0 flex-col gap-1">
					<h1 className="font-display text-xl font-bold text-gray-100">{card.name}</h1>
					{card.title && <p className="text-sm text-gray-300">{card.title}</p>}
					<div className="flex flex-wrap items-center gap-2 text-xs text-gray-300">
						<span>{cardLine(card)}</span>
						{card.on_global ? <span>On global</span> : <JpOnlyTag />}
					</div>
					<JapaneseName name={card.jp_name} title={card.jp_title} />
					<ReleaseLine
						jpDate={releases.jpDate}
						globalDate={globalDate}
						predicted={releases.globalDate !== null && releases.predicted}
					/>
					{card.purpose && <p className="text-sm text-gray-300">{card.purpose}</p>}
				</div>
			</header>
			{limitBreak !== undefined && <OwnedLine tab="cards" detail={limitBreakWords(limitBreak)} />}

			{hints.length > 0 && (
				<Section title="Skill hints">
					<SkillList skills={hints} />
				</Section>
			)}
			{events.length > 0 && (
				<Section title="Skills from events">
					<SkillList skills={events} />
				</Section>
			)}
			{releases.banners.length > 0 && (
				<Section title="Banners">
					<BannerLinks banners={releases.banners} />
				</Section>
			)}
			{card.outfits.length > 0 && (
				<Section title={isGroup ? "Its members as trainees" : `${card.name} as a trainee`}>
					<OutfitList outfits={card.outfits} />
				</Section>
			)}
			{card.cards.length > 0 && (
				<Section title={`${card.name}'s other cards`}>
					<CardList cards={card.cards} />
				</Section>
			)}
		</article>
	)
}
