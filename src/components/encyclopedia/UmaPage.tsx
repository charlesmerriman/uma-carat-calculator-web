/**
 * /app/umas/<game id>: one outfit's page (notes/encyclopedia-plan.md, "What
 * each page shows"). From GET /encyclopedia/umas/<game id>, plus the banners
 * and dates /calculator-data already holds (utils/encyclopediaBanners.ts).
 *
 * A section with no data is left out, never drawn empty. A JP-only outfit's
 * aptitudes and stats are the JP client's, and the page says so.
 */

import { Link, useParams } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { FramedUma } from "../FramedUma"
import { JpOnlyTag } from "../pvp/SkillDetail"
import { useOshiIds } from "../../hooks/useOshiIds"
import { useUmaPage } from "../../services/encyclopediaQueries"
import { useCalculatorDataSafe } from "../../services/CalculatorContext"
import type { PageSkill, UmaPageData } from "../../types/encyclopedia"
import { umaReleases } from "../../utils/encyclopediaBanners"
import { UMA_LIST_PATH, parseGameId } from "../../utils/encyclopediaRoutes"
import { EncyclopediaGate } from "./EncyclopediaTabs"
import {
	AptitudeGrid, BannerLinks, CardList, JapaneseName, JpDataNote, OutfitList, ReleaseLine,
	OwnedLine, Section, SkillList, StarStatsTable, Stars,
} from "./pieces"
import { LINK_CLASS as LINK, PAGE_CONTAINER, RUNNING_STYLE_WORDS, ownedStars } from "../../utils/encyclopedia"
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
		<UmaPageBody />
	</EncyclopediaGate>
)

const UmaPageBody = () => {
	const gameId = parseGameId(useParams().gameId)
	const page = useUmaPage(gameId)
	usePageTitle(page.data?.name)

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
	return <UmaDetail uma={page.data} />
}

export function NotFound() {
	return (
		<p className={`${PAGE_CONTAINER} text-sm text-gray-400`}>
			There's no page for that.{" "}
			<Link to={UMA_LIST_PATH} className={LINK}>Back to the Encyclopedia</Link>
		</p>
	)
}

export function Crumbs({ list, listPath, name }: { list: string; listPath: string; name: string }) {
	return (
		<nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-gray-400">
			<Link to={UMA_LIST_PATH} className={LINK}>Encyclopedia</Link>
			<span aria-hidden="true">/</span>
			<Link to={listPath} className={LINK}>{list}</Link>
			<span aria-hidden="true">/</span>
			<span className="truncate text-gray-300">{name}</span>
		</nav>
	)
}

/** "level 3" for an awakening; "from <gold>" for an evolution, by the gold's name on this page. */
function skillNote(skill: PageSkill, byGameId: Map<number, PageSkill>): string | undefined {
	if (skill.source === "awakening" && skill.level) return `level ${skill.level}`
	if (skill.source === "evolved" && skill.evolves_from) {
		const base = byGameId.get(skill.evolves_from)
		return base ? `from ${base.name}` : undefined
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
	const style = uma.running_style ? RUNNING_STYLE_WORDS[uma.running_style] : null

	return (
		<article className={PAGE_CONTAINER}>
			<Crumbs list="Umas" listPath={UMA_LIST_PATH} name={uma.name} />
			<header className="flex items-start gap-4">
				<FramedUma src={uma.portrait} oshi={oshiIds.has(uma.id)} alt={uma.name} className="h-28 w-28 shrink-0 sm:h-32 sm:w-32" />
				<div className="flex min-w-0 flex-col gap-1">
					<h1 className="font-display text-xl font-bold text-gray-100">{uma.name}</h1>
					{uma.title && <p className="text-sm text-gray-300">{uma.title}</p>}
					<div className="flex flex-wrap items-center gap-2 text-xs text-gray-300">
						<Stars count={uma.rarity} />
						{style && <span>{style}</span>}
						{uma.on_global ? <span>On global</span> : <JpOnlyTag />}
					</div>
					<JapaneseName name={uma.jp_name} title={uma.jp_title} />
					<ReleaseLine jpDate={releases.jpDate} globalDate={releases.globalDate} predicted={releases.predicted} />
					{uma.purpose && <p className="text-sm text-gray-300">{uma.purpose}</p>}
				</div>
			</header>
			{owned.umas.has(uma.id) && <OwnedLine tab="umas" detail={ownedStars(owned.umas.get(uma.id))} />}

			{hasApt && (
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<Section title="Aptitudes">
						<AptitudeGrid apt={uma.apt} />
					</Section>
					{uma.star_stats.length > 0 && (
						<Section title="Stats">
							<StarStatsTable stars={uma.star_stats} growth={uma.growth} initialStar={uma.rarity} />
						</Section>
					)}
				</div>
			)}
			{hasApt && !uma.on_global && <JpDataNote />}

			{SKILL_GROUPS.map(({ source, title }) => {
				const skills = uma.skills.filter((skill) => skill.source === source)
				if (skills.length === 0) return null
				return (
					<Section key={source} title={title}>
						<SkillList skills={skills} note={(skill) => skillNote(skill, byGameId)} />
					</Section>
				)
			})}

			{(uma.objectives?.length ?? 0) > 0 && (
				<Section title="Career objectives">
					<CareerObjectives goals={uma.objectives ?? []} hidden={uma.objectives_hidden ?? 0} />
				</Section>
			)}
			{releases.banners.length > 0 && (
				<Section title="Banners">
					<BannerLinks banners={releases.banners} />
				</Section>
			)}
			{uma.outfits.length > 0 && (
				<Section title="Other outfits">
					<OutfitList outfits={uma.outfits} />
				</Section>
			)}
			{uma.cards.length > 0 && (
				<Section title={`${uma.name.split(" (")[0]}'s support cards`}>
					<CardList cards={uma.cards} />
				</Section>
			)}
		</article>
	)
}
