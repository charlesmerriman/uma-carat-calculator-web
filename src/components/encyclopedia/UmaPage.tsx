/**
 * /app/umas/<game id>: one outfit's page (notes/encyclopedia-plan.md, "What
 * each page shows"). From GET /encyclopedia/umas/<game id>, plus the banners
 * and dates /calculator-data already holds (utils/encyclopediaBanners.ts).
 *
 * The page is a hero (her art, name, tags and release dates), a jump bar, and
 * a panel per section, all in her character's two colours (`uma.colours`,
 * from the game files; the theme's accent when they hold none). A section
 * with no data is left out, never drawn empty, and the jump bar lists only
 * the sections that are there.
 *
 * Her skills read the way the game hands them out: the unique skill first
 * with what it does, the innate ones in a row, then the awakening levels as
 * posts along a track, each evolved skill hanging off the gold skill it
 * comes from (notes/encyclopedia-redesign-plan.md).
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
	Crumbs, EmptyNote, Hero, JapaneseName, JumpBar, NotFound, OwnedLine, Page, PageSkeleton, Section, Stars,
	SubHeading, Switch, Tag, TranslationCredit, WhereTag, type JumpItem,
} from "./pieces"
import { AptitudeGrid, BannerLinks, CardList, OutfitList, ReleaseFacts, StatsSection } from "./facts"
import { SkillList, SkillRow, UniquePlate, UnlockConditions } from "./skillRows"
import { PAGE_CONTAINER, RUNNING_STYLE_COLORS, RUNNING_STYLE_WORDS, ownedStars, umaEntryNumber } from "../../utils/encyclopedia"
import { useOwned } from "../../hooks/useOwned"
import { useRememberedFilter } from "../../hooks/useRememberedFilter"
import { usePageTitle } from "./usePageTitle"
import { CareerObjectives } from "./CareerObjectives"

/**
 * Which cost an owned uma's skill rows show: what she pays at the player's hint
 * levels, or the full price (the owner, 2026-11-18: someone with hints may still
 * want to see what a skill costs without them).
 */
type CostView = "yours" | "full"
const COST_VIEWS: { value: CostView; label: string }[] = [{ value: "yours", label: "Your cost" }, { value: "full", label: "Full cost" }]

/** The highest awakening level every outfit has; JP's 6 and 7 came later. */
const BASE_TOP_LEVEL = 5

/** What unlocks an evolution, under its row (Daptrius, 2026-11-13). Nothing for any other skill. */
function unlockList(skill: PageSkill) {
	return (skill.conditions ?? []).length > 0 ? <UnlockConditions conditions={skill.conditions ?? []} /> : null
}

/**
 * Her skills in the order the game hands them out. `evolutions` are keyed by
 * the game id of the skill they grow from, so each hangs off its gold on the
 * awakening track; one whose base isn't an awakening skill on this page (the
 * files do have a few) is listed after the track instead of being dropped.
 */
function UmaSkills({ skills, hints, fullCost = false }: {
	skills: PageSkill[]
	/** Show every cost at full price, the hint levels still tagged. */
	fullCost?: boolean
	/**
	 * The player's hint levels on this outfit (skill game id -> level), when
	 * they own her and imported their Collection. The game keeps them for her
	 * innate and awakening skills only, so only those rows read it.
	 */
	hints?: ReadonlyMap<number, number>
}) {
	const byGameId = new Map(skills.map((skill) => [skill.game_id, skill]))
	const hintOf = (skill: PageSkill) => hints?.get(skill.game_id)
	const of = (source: string) => skills.filter((skill) => skill.source === source)
	const uniques = of("unique")
	const innate = of("innate")
	const awakening = of("awakening")
	const awakeningIds = new Set(awakening.map((skill) => skill.game_id))
	const hanging = (base: PageSkill) => of("evolved").filter((skill) => skill.evolves_from === base.game_id)
	const loose = of("evolved").filter((skill) => !skill.evolves_from || !awakeningIds.has(skill.evolves_from))
	// One post per awakening level, in order; a level with two skills shows both.
	const levels = [...new Set(awakening.map((skill) => skill.level ?? 0))].sort((a, b) => a - b)
	// Levels 2 to 5 are the track every outfit has. JP raised some outfits to 6
	// and 7 later, so those get a row of their own under it, never squeezed onto
	// the end of the first (the owner, 2026-11-17).
	const base = levels.filter((level) => level <= BASE_TOP_LEVEL)
	const later = levels.filter((level) => level > BASE_TOP_LEVEL)
	const track = (shown: number[], className = "enc-awake") => (
		<ol className={className}>
			{shown.map((level) => (
				<li key={level} className="enc-rung">
					<span className="enc-rung__post" aria-hidden="true">Lv<b>{level}</b></span>
					<ul className="enc-rung__skills">
						{awakening.filter((skill) => (skill.level ?? 0) === level).map((skill) => (
							<SkillRow
								key={skill.game_id}
								skill={skill}
								// The post says the level and the elbow says what it grows
								// from, so the row's own line stays its type.
								hint={skillNote(skill, byGameId)}
								hintLevel={hintOf(skill)}
								fullCost={fullCost}
								after={hanging(skill).length > 0 && (
									<ul className="enc-branches">
										{hanging(skill).map((evolved) => (
											<SkillRow key={evolved.game_id} skill={evolved} hint={skillNote(evolved, byGameId)} after={unlockList(evolved)} />
										))}
									</ul>
								)}
							/>
						))}
					</ul>
				</li>
			))}
		</ol>
	)
	return (
		<>
			{uniques.length > 0 && (
				<div className="enc-group">
					<SubHeading>{uniques.length === 1 ? "Unique skill" : "Unique skills"}</SubHeading>
					{uniques.map((skill) => (
						// An outfit that starts below three stars carries a weaker unique until then.
						<UniquePlate key={skill.game_id} skill={skill} from={uniques.length > 1 && skill.level ? `From ★${skill.level}` : undefined} />
					))}
				</div>
			)}
			{innate.length > 0 && (
				<div className="enc-group">
					<SubHeading>Innate skills</SubHeading>
					<SkillList skills={innate} hintLevel={hintOf} fullCost={fullCost} className="enc-skills enc-skills--row" />
				</div>
			)}
			{awakening.length > 0 && (
				<div className="enc-group">
					<SubHeading>Awakening skills</SubHeading>
					{track(base)}
					{later.length > 0 && (
						<div className="enc-awake-later">
							<p className="enc-awake-later__label">Added later</p>
							{track(later, "enc-awake enc-awake--later")}
						</div>
					)}
				</div>
			)}
			{loose.length > 0 && (
				<div className="enc-group">
					<SubHeading>Evolutions</SubHeading>
					<SkillList skills={loose} sub={(skill) => skillNote(skill, byGameId)} after={unlockList} />
				</div>
			)}
		</>
	)
}

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
	const hints = owned.hints.get(uma.id)
	// Kept outside the uma list's "umas:" scope, so Reset filters there leaves it.
	const [costView, setCostView] = useRememberedFilter<CostView>("uma-page:cost", "yours", ["yours", "full"])
	const calculator = useCalculatorDataSafe()
	const releases = umaReleases(calculator?.umaBannerData ?? [], uma.id)
	const hasApt = Object.values(uma.apt).some((value) => value != null)
	const hasStats = hasApt && uma.star_stats.length > 0
	const style = uma.running_style ? RUNNING_STYLE_WORDS[uma.running_style] : null
	const goals = uma.objectives ?? []
	const character = uma.name.split(" (")[0]
	// "Oguri Cap (Christmas)" -> "Christmas"; "" for her original outfit.
	const outfit = uma.name.slice(character.length).replace(/^\s*\(|\)\s*$/g, "")

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
		<Page colours={uma.colours}>
			<Crumbs list="Umas" listPath={UMA_LIST_PATH} name={uma.name} />
			<Hero
				art={<FramedUma src={uma.portrait} oshi={oshiIds.has(uma.id)} alt={uma.name} className="enc-hero__art" />}
				entry={umaEntryNumber(uma.game_id)}
				ghost={uma.jp_name || undefined}
				// The name is the character's; which outfit this is sits above it.
				eyebrow={outfit ? `Trainee · ${outfit}` : "Trainee"}
				name={character}
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
					<Section id="aptitudes" title="Aptitudes" aside={<span className="enc-section__key">A or better is highlighted</span>}>
						{/* No "from the JP game" note under these or the stats: the page's JP tag
						    already says it (Daptrius, 2026-11-13). */}
						<AptitudeGrid apt={uma.apt} />
					</Section>
					{hasStats && (
						<StatsSection
								id="stats"
								stars={uma.star_stats}
								growth={uma.growth}
								// Opens at the stars the player has her at, from their Collection
								// (Daptrius, board, 2026-11-17); else at her starting stars.
								initialStar={owned.umas.get(uma.id) ?? uma.rarity}
							/>
					)}
				</div>
			)}

			{uma.skills.length > 0 && (
				<Section
					id="skills"
					title="Skills"
					count={uma.skills.length}
					// Only an owned uma with hint levels has two costs to choose between.
					aside={hints && <Switch label="Skill cost" options={COST_VIEWS} value={costView} onChange={setCostView} />}
				>
					<UmaSkills skills={uma.skills} hints={hints} fullCost={costView === "full"} />
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
			{(uma.outfits.length > 0 || uma.cards.length > 0) && (
				<div className="enc-two">
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
				</div>
			)}
			{uma.uses_translation && <TranslationCredit />}
		</Page>
	)
}
