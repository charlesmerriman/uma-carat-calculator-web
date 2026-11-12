/**
 * /app/umas/<game id>: one outfit's page (notes/encyclopedia-plan.md, "What
 * each page shows"). From GET /encyclopedia/umas/<game id>, plus the banners
 * and dates /calculator-data already holds (utils/encyclopediaBanners.ts).
 *
 * The page is a hero (her art, name, tags and release dates), a jump bar, and
 * a card per section. A section with no data is left out, never drawn empty,
 * and the jump bar lists only the sections that are there. A JP-only outfit's
 * aptitudes and stats are the JP client's, and the page says so.
 */

import { useParams } from "react-router-dom"
import { FramedUma } from "../FramedUma"
import { useOshiIds } from "../../hooks/useOshiIds"
import { useUmaPage } from "../../services/encyclopediaQueries"
import { useCalculatorDataSafe } from "../../services/CalculatorContext"
import type { PageSkill, UmaPageData } from "../../types/encyclopedia"
import { umaReleases } from "../../utils/encyclopediaBanners"
import { UMA_LIST_PATH, parseGameId } from "../../utils/encyclopediaRoutes"
import { EncyclopediaGate } from "./EncyclopediaTabs"
import {
	Crumbs, EmptyNote, Hero, JapaneseName, JpDataNote, JumpBar, NotFound, OwnedLine, PageSkeleton, Section, Stars,
	SubHeading, Tag, WhereTag, type JumpItem,
} from "./pieces"
import { AptitudeGrid, BannerLinks, CardList, OutfitList, ReleaseFacts, StatsSection } from "./facts"
import { SkillList } from "./skillRows"
import { PAGE_CONTAINER, RUNNING_STYLE_COLORS, RUNNING_STYLE_WORDS, ownedStars } from "../../utils/encyclopedia"
import { useOwned } from "../../hooks/useOwned"
import { usePageTitle } from "./usePageTitle"
import { CareerObjectives } from "./CareerObjectives"

/** The order and headings the game teaches skills in. */
const SKILL_GROUPS: { source: string; title: string }[] = [
	{ source: "unique", title: "Unique skill" },
	{ source: "innate", title: "Innate skills" },
	{ source: "awakening", title: "Awakening skills" },
	{ source: "evolved", title: "Evolutions" },
]

export const UmaPage = () => (
	<EncyclopediaGate>
		<div className={PAGE_CONTAINER}>
			<UmaPageBody />
		</div>
	</EncyclopediaGate>
)

const UmaPageBody = () => {
	const gameId = parseGameId(useParams().gameId)
	const page = useUmaPage(gameId)
	usePageTitle(page.data?.name)

	if (gameId === null || page.data === null) return <NotFound />
	if (page.isError) return <EmptyNote>This page didn't load. Reload to try again.</EmptyNote>
	if (!page.data) return <PageSkeleton label="Loading" />
	return <UmaDetail uma={page.data} />
}

/**
 * A skill row's second line: how she gets it. "Awakening level 3" for an
 * awakening; "Evolves from <gold>" for an evolution, by the gold's name on
 * this page. A unique or an innate skill keeps the row's own line (its type).
 */
function skillNote(skill: PageSkill, byGameId: Map<number, PageSkill>): string | undefined {
	if (skill.source === "awakening" && skill.level) return `Awakening level ${skill.level}`
	if (skill.source === "evolved" && skill.evolves_from) {
		const base = byGameId.get(skill.evolves_from)
		return base ? `Evolves from ${base.name}` : undefined
	}
	return undefined
}

export function UmaDetail({ uma }: { uma: UmaPageData }) {
	const oshiIds = useOshiIds()
	const owned = useOwned()
	const calculator = useCalculatorDataSafe()
	const releases = umaReleases(calculator?.umaBannerData ?? [], uma.id)
	const byGameId = new Map(uma.skills.map((skill) => [skill.game_id, skill]))
	const hasApt = Object.values(uma.apt).some((value) => value != null)
	const hasStats = hasApt && uma.star_stats.length > 0
	const style = uma.running_style ? RUNNING_STYLE_WORDS[uma.running_style] : null
	const goals = uma.objectives ?? []
	const character = uma.name.split(" (")[0]

	// The jump bar names only the sections this outfit has.
	const jump = ([
		hasApt && { id: "aptitudes", label: "Aptitudes" },
		hasStats && { id: "stats", label: "Stats" },
		uma.skills.length > 0 && { id: "skills", label: "Skills", count: uma.skills.length },
		goals.length > 0 && { id: "career", label: "Career", count: goals.length },
		releases.banners.length > 0 && { id: "banners", label: "Banners", count: releases.banners.length },
		uma.outfits.length > 0 && { id: "outfits", label: "Outfits", count: uma.outfits.length },
		uma.cards.length > 0 && { id: "cards", label: "Support cards", count: uma.cards.length },
	] as (JumpItem | false)[]).filter((item): item is JumpItem => Boolean(item))

	return (
		<article className="flex flex-col gap-4">
			<Crumbs list="Umas" listPath={UMA_LIST_PATH} name={uma.name} />
			<Hero
				art={<FramedUma src={uma.portrait} oshi={oshiIds.has(uma.id)} alt={uma.name} className="enc-hero__art" />}
				eyebrow="Trainee"
				name={uma.name}
				title={uma.title}
				japanese={<JapaneseName name={uma.jp_name} title={uma.jp_title} />}
				tags={
					<>
						<Stars count={uma.rarity} />
						{style && <Tag dot={RUNNING_STYLE_COLORS[uma.running_style ?? 0]}>{style}</Tag>}
						<WhereTag onGlobal={uma.on_global} />
					</>
				}
				lead={uma.purpose || undefined}
				owned={owned.umas.has(uma.id) && <OwnedLine tab="umas" detail={ownedStars(owned.umas.get(uma.id))} />}
				facts={<ReleaseFacts jpDate={releases.jpDate} globalDate={releases.globalDate} predicted={releases.predicted} />}
			/>
			<JumpBar items={jump} />

			{hasApt && (
				<div className="enc-two">
					<Section id="aptitudes" title="Aptitudes">
						<AptitudeGrid apt={uma.apt} />
						{!uma.on_global && <JpDataNote />}
					</Section>
					{hasStats && (
						<StatsSection id="stats" stars={uma.star_stats} growth={uma.growth} initialStar={uma.rarity} jpData={!uma.on_global} />
					)}
				</div>
			)}

			{uma.skills.length > 0 && (
				<Section id="skills" title="Skills" count={uma.skills.length}>
					{SKILL_GROUPS.map(({ source, title }) => {
						const skills = uma.skills.filter((skill) => skill.source === source)
						if (skills.length === 0) return null
						return (
							<div key={source} className="flex flex-col gap-2">
								<SubHeading>{title}</SubHeading>
								<SkillList skills={skills} sub={(skill) => skillNote(skill, byGameId)} />
							</div>
						)
					})}
				</Section>
			)}

			{goals.length > 0 && (
				<Section id="career" title="Career objectives" count={goals.length === 1 ? "1 goal" : `${goals.length} goals`}>
					<CareerObjectives goals={goals} hidden={uma.objectives_hidden ?? 0} />
				</Section>
			)}
			{releases.banners.length > 0 && (
				<Section id="banners" title="Banners" count={releases.banners.length}>
					<BannerLinks banners={releases.banners} />
				</Section>
			)}
			{uma.outfits.length > 0 && (
				<Section id="outfits" title="Other outfits" count={uma.outfits.length}>
					<OutfitList outfits={uma.outfits} />
				</Section>
			)}
			{uma.cards.length > 0 && (
				<Section id="cards" title={`${character}'s support cards`} count={uma.cards.length}>
					<CardList cards={uma.cards} />
				</Section>
			)}
		</article>
	)
}
