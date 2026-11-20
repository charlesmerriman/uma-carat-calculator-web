/**
 * /app/skills/<game id>: one skill's Encyclopedia page (notes/encyclopedia-plan.md,
 * PR 5): the skill point cost, the unique / inherited pair, each evolution's
 * uma, every uma and card as a link to its page, and "Hide R" / "Hide SR" on
 * the cards (Daptrius's list, items 3, 4 and 9).
 *
 * The visual overhaul's page (encyclopedia.css): a hero washed in the skill's
 * own colour with its kind, type and cost; "How it works" as labelled rows
 * where each clause is a chip of its own; and every relation (versions, umas,
 * cards, evolutions) as a card of link rows.
 */

import { Fragment, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useOshiIds } from "../../hooks/useOshiIds"
import { useRememberedFilter } from "../../hooks/useRememberedFilter"
import { useSkillPage } from "../../services/encyclopediaQueries"
import type { SkillCondition, SkillPhrase, SkillReadable } from "../../types/pvpGuide"
import type { SkillDetailData, SkillOwnerUma, SkillSourceCard, SkillSourceUma } from "../../types/skills"
import { HIDE_OPTIONS, PAGE_CONTAINER, cardLine, keepCard, type HideFilter } from "../../utils/encyclopedia"
import { SKILL_LIST_PATH, cardHref, parseGameId, umaHref } from "../../utils/encyclopediaRoutes"
import { nameLang } from "../../utils/skillList"
import { SKILL_TYPE_WORDS, UMATL_URL, skillKind } from "../../utils/skillSearch"
import { hasCondition, slotLabel } from "../../utils/skillWords"
import { EncyclopediaFrame } from "../encyclopedia/EncyclopediaTabs"
import {
	Crumbs, EmptyNote, Fact, Hero, JpTag, NotFound, PageSkeleton, Section, SectionNote, SubHeading, Switch, Tag, WhereTag, Page,
} from "../encyclopedia/pieces"
import { SkillList, UnlockConditions } from "../encyclopedia/skillRows"
import { usePageTitle } from "../encyclopedia/usePageTitle"
import { FramedCard } from "../FramedCard"
import { FramedUma } from "../FramedUma"
import { ScalingPopover } from "./ScalingPopover"
import { KindPill } from "../pvp/SkillDetail"

/** The hero's wash, by the skill's kind: the game's gold, pink or a unique's violet; the brand otherwise. */
const KIND_ACCENT: Record<string, string> = { gold: "#e8b51a", evolved: "#f28cbc", unique: "#c9b1ff" }

// ── How it works ────────────────────────────────────────────────────────────

/** One clause as a chip. A clause nobody has confirmed the meaning of shows as the game's own code. */
function Clause({ phrase, effect = false }: { phrase: SkillPhrase; effect?: boolean }) {
	if (phrase.raw) return <code className="enc-clause enc-clause--raw">{phrase.text}</code>
	return <span className={`enc-clause ${effect ? "enc-clause--effect" : ""}`}>{phrase.text}</span>
}

/** A condition as chips: every clause of `all`, then "one of" the alternatives, each alternative boxed when it has several clauses. */
function Clauses({ condition }: { condition: SkillCondition }) {
	if (!hasCondition(condition)) return <>Any time</>
	return (
		<>
			{condition.all.map((phrase, index) => <Clause key={index} phrase={phrase} />)}
			{condition.any.length > 0 && (
				<>
					<span className="enc-how__join">{condition.all.length > 0 ? "and one of" : "one of"}</span>
					{condition.any.map((alternative, index) => (
						<Fragment key={index}>
							{index > 0 && <span className="enc-how__join">or</span>}
							{alternative.length === 1 ? (
								<Clause phrase={alternative[0]} />
							) : (
								<span className="inline-flex flex-wrap gap-1 rounded-md border border-dashed border-gray-600 p-0.5">
									{alternative.map((phrase, position) => <Clause key={position} phrase={phrase} />)}
								</span>
							)}
						</Fragment>
					))}
				</>
			)}
		</>
	)
}

/**
 * One step of how a skill works: its label over its words (the label's colon
 * is for a screen reader). The steps of a slot read left to right as a
 * sentence: when it fires, what it does, how long it lasts, when it can fire
 * again. `step` lets the stylesheet make "Does" the loudest.
 */
function HowRow({ label, step, children }: { label: string; step: "after" | "when" | "does" | "lasts" | "cooldown"; children: React.ReactNode }) {
	return (
		<div className="enc-step" data-step={step}>
			<span className="enc-how__label">{label}<span className="sr-only">: </span></span>
			<span className="enc-how__value">{children}</span>
		</div>
	)
}

/**
 * The game's own condition code, under the reworded chips in the Detailed
 * view (Daptrius's list, item 8). `@` separates alternatives (any one fires
 * it), so each goes on its own line; `&` joins clauses that must all hold.
 */
function GameCode({ code }: { code: string | undefined }) {
	if (!code) return null
	return (
		<code className="enc-how__code" aria-label="The game's condition code">
			{code.split("@").map((alternative, index) => (
				<span key={index} className="block">{index > 0 && "or "}{alternative.split("&").join(" & ")}</span>
			))}
		</code>
	)
}

/** The Detailed view's switch: the reworded clauses alone, or with the game's code under them. */
type HowView = "plain" | "detailed"
const HOW_VIEWS: { value: HowView; label: string }[] = [{ value: "plain", label: "Plain" }, { value: "detailed", label: "Detailed" }]

/** When it fires and what it does: a block per effect slot. */
function HowItWorks({ readable, raw, detailed }: {
	readable: SkillReadable
	/** The game's code per slot; shown only when `detailed`. */
	raw?: { after: string; when: string }[]
	detailed: boolean
}) {
	const many = readable.slots.length > 1
	return (
		<>
			<div className="enc-how">
				{readable.slots.map((slot, index) => (
					<div key={index} className="enc-how__slot">
						{many && <span className="enc-how__part">{slotLabel(readable, index)}</span>}
						{hasCondition(slot.after) && (
							<HowRow label="Only after" step="after">
								<Clauses condition={slot.after} />
								{detailed && <GameCode code={raw?.[index]?.after} />}
							</HowRow>
						)}
						<HowRow label="When" step="when">
							<Clauses condition={slot.when} />
							{detailed && <GameCode code={raw?.[index]?.when} />}
						</HowRow>
						{slot.effects.length > 0 && (
							<HowRow label="Does" step="does">
								{slot.effects.map((phrase, position) => phrase.scaling ? (
									// A scaled effect and its button stay together as one line, so
									// a second effect never lands beside the first one's button.
									<span key={position} className="enc-scaled">
										<Clause phrase={phrase} effect />
										<ScalingPopover scaling={phrase.scaling} title={phrase.text} column="Value" />
									</span>
								) : (
									<Clause key={position} phrase={phrase} effect />
								))}
							</HowRow>
						)}
						{/* The label already says which; the value is the game's own figure. */}
						{slot.duration && (
							<HowRow label="Lasts" step="lasts">
								{slot.duration === "Whole race" ? "The whole race" : slot.duration}
								{slot.duration_scaling && (
									<ScalingPopover scaling={slot.duration_scaling} title={`Lasts ${slot.duration}`} column="Lasts" />
								)}
							</HowRow>
						)}
						{slot.cooldown && (
							<HowRow label="Cooldown" step="cooldown">
								{slot.cooldown === "Once per race" ? slot.cooldown : `Can fire again after ${slot.cooldown}`}
							</HowRow>
						)}
					</div>
				))}
			</div>
			{/* Each scaled time already reads "per 1,000 m", so no note explains it again (Daptrius, 2026-11-13). */}
			{readable.wit_check && <SectionNote>Rolls Wit check.</SectionNote>}
		</>
	)
}

/** The outfit a skill belongs to, framed as every uma is, linking to her page. */
function OwnerFace({ uma }: { uma: SkillOwnerUma }) {
	const oshiIds = useOshiIds()
	const body = (
		<>
			<FramedUma src={uma.portrait} oshi={oshiIds.has(uma.id)} className="enc-owner__art" />
			<span>{uma.name}</span>
		</>
	)
	return uma.game_id
		? <Link to={umaHref(uma.game_id)} className="enc-owner">{body}</Link>
		: <span className="enc-owner">{body}</span>
}

// ── Where it comes from ─────────────────────────────────────────────────────

const UMA_SOURCE: Record<string, string> = {
	unique: "Unique skill",
	innate: "Innate",
	awakening: "Awakening",
	evolved: "Evolution",
}
const CARD_SOURCE: Record<string, string> = { hint: "Hint", event: "Event" }

function umaHow(row: SkillSourceUma): string {
	const how = UMA_SOURCE[row.source] ?? row.source
	const said = row.level !== null && row.source !== "unique" ? `${how}, level ${row.level}` : how
	return row.via ? `${said} · ${row.via}` : said
}

function UmaSources({ rows }: { rows: SkillSourceUma[] }) {
	const oshiIds = useOshiIds()
	if (rows.length === 0) return null
	return (
		<Section title="Umas with this skill" count={rows.length}>
			<ul className="enc-tiles">
				{rows.map((row) => {
					const body = (
						<>
							<FramedUma src={row.image} oshi={oshiIds.has(row.id)} className="enc-pic__art" />
							<span className="enc-pic__name">{row.name}</span>
							<span className="enc-pic__sub">{umaHow(row)}</span>
							{!row.on_global && <JpTag />}
						</>
					)
					return (
						<li key={`${row.id}-${row.source}`}>
							{row.game_id
								? <Link to={umaHref(row.game_id)} className="enc-pic">{body}</Link>
								: <div className="enc-pic">{body}</div>}
						</li>
					)
				})}
			</ul>
		</Section>
	)
}

function CardSources({ rows }: { rows: SkillSourceCard[] }) {
	const [hide, setHide] = useState<HideFilter>("none")
	if (rows.length === 0) return null
	const shown = rows.filter((row) => keepCard(row, hide))
	return (
		<Section
			title="Cards that teach it"
			count={shown.length}
			aside={<Switch label="Card rarity" options={HIDE_OPTIONS} value={hide} onChange={setHide} />}
		>
			{shown.length === 0 ? (
				<EmptyNote>Only R or SR cards teach it.</EmptyNote>
			) : (
				<ul className="enc-tiles">
					{shown.map((row) => {
						const art = {
							image: row.image, image_borderless: row.image_borderless, card_type: row.card_type ?? null, rarity: row.rarity ?? null,
						}
						// A card's name is its character's, so its title leads when the API sends one.
						// On a ◎ page a card that teaches the ○ says so: its hint counts for the ◎ too.
						const how = CARD_SOURCE[row.source] ?? row.source
						const line = [row.title ? row.name : null, cardLine(art), row.via ? `${how} · ${row.via}` : how].filter(Boolean).join(" · ")
						const body = (
							<>
								<FramedCard card={art} className="enc-pic__art" />
								<span className="enc-pic__name">{row.title || row.name}</span>
								<span className="enc-pic__sub">{line}</span>
								{!row.on_global && <JpTag />}
							</>
						)
						return (
							<li key={`${row.id}-${row.source}`}>
								{row.game_id
									? <Link to={cardHref(row.game_id)} className="enc-pic enc-pic--card">{body}</Link>
									: <div className="enc-pic enc-pic--card">{body}</div>}
							</li>
						)
					})}
				</ul>
			)}
		</Section>
	)
}

/**
 * The skill's family on one line, left to right: what it grows from and its
 * other versions (a white's gold, a unique's inherited copy), the skill
 * itself, then what it evolves into. What unlocks it, when it is an
 * evolution, sits under the line. Three separate lists until the redesign;
 * drawn together they show where the skill stands.
 */
function Family({ skill, versions }: { skill: SkillDetailData; versions: SkillDetailData["versions"] }) {
	const { evolution } = skill
	const total = (evolution.from ? 1 : 0) + versions.length + evolution.into.length
	if (total === 0 && evolution.conditions.length === 0) return null
	const kind = skillKind(skill)
	return (
		<Section title="The family" count={total > 0 ? total + 1 : undefined}>
			{total > 0 && (
				<div className="enc-family">
					{(evolution.from || versions.length > 0) && (
						<div className="enc-family__col">
							{evolution.from && (
								<div className="enc-group">
									<SubHeading>Evolves from</SubHeading>
									<SkillList skills={[evolution.from]} className="enc-ladder" />
								</div>
							)}
							{versions.length > 0 && (
								<div className="enc-group">
									<SubHeading>Other versions <span className="enc-section__count">{versions.length}</span></SubHeading>
									<SkillList skills={versions} className="enc-ladder" />
								</div>
							)}
						</div>
					)}
					<div className="enc-family__col enc-family__col--here">
						<div className="enc-group">
							<SubHeading>This skill</SubHeading>
							<div className="enc-skill enc-skill--here" data-kind={kind}>
								{skill.image
									? <img src={skill.image} alt="" className="enc-skill__icon" />
									: <span className="enc-skill__icon bg-gray-700" aria-hidden="true" />}
								<span className="enc-skill__text">
									<span className="enc-skill__name" lang={nameLang(skill.name)}>{skill.name}</span>
									<span className="enc-skill__sub"><KindPill kind={kind} /></span>
								</span>
							</div>
						</div>
					</div>
					{evolution.into.length > 0 && (
						<div className="enc-family__col">
							<div className="enc-group">
								<SubHeading>Evolves into</SubHeading>
								{/* An evolution names its uma (Daptrius's list): the row's own second line does, from `owners`. */}
								<SkillList skills={evolution.into} className="enc-ladder" />
							</div>
						</div>
					)}
				</div>
			)}
			{evolution.conditions.length > 0 && (
				<div className="enc-group">
					<SubHeading>To unlock it</SubHeading>
					<UnlockConditions conditions={evolution.conditions} />
				</div>
			)}
		</Section>
	)
}

// ── The page ────────────────────────────────────────────────────────────────

export const SkillPage = () => (
	<EncyclopediaFrame>
		<div className={PAGE_CONTAINER}>
			<SkillPageBody />
		</div>
	</EncyclopediaFrame>
)

const SkillPageBody = () => {
	const gameId = parseGameId(useParams().gameId)
	const page = useSkillPage(gameId)
	usePageTitle(page.data?.name)

	if (gameId === null || page.data === null) return <NotFound />
	if (page.isError) return <EmptyNote>The skill didn't load. Reload to try again.</EmptyNote>
	if (!page.data) return <PageSkeleton label="Loading the skill" />
	return <SkillPageDetail skill={page.data} />
}

export function SkillPageDetail({ skill }: { skill: SkillDetailData }) {
	const credit = skill.uses_translation || skill.evolution.conditions.some((condition) => condition.uses_translation)
		|| skill.sources.cards.some((card) => card.title_translated)
	// A unique and its inherited copy are each other's other version, listed the
	// way a white and its gold are (Daptrius, board "Inherit and Unique
	// parity", 2026-11-12). The game links them by nothing but the id.
	const versions = skill.pair ? [skill.pair, ...skill.versions] : skill.versions
	const kind = skillKind(skill)
	const type = SKILL_TYPE_WORDS[skill.type ?? ""]
	// Remembered for the tab, so a reader who wants the code keeps it from skill to skill.
	const [howView, setHowView] = useRememberedFilter<HowView>("skill:how-view", "plain", ["plain", "detailed"])
	const owners = skill.owners?.length ? skill.owners.join(", ") : null
	// Her face in the hero when the skill is one outfit's (a unique, an evolution).
	const owner = skill.owner_umas?.length === 1 ? skill.owner_umas[0] : null
	return (
		<Page colours={skill.colours} labelledBy="skill-page-name">
			<Crumbs list="Skills" listPath={SKILL_LIST_PATH} name={skill.name} />
			<Hero
				// A skill that is one character's wears her colours; any other keeps its kind's.
				accent={skill.colours ? undefined : KIND_ACCENT[kind]}
				shape="skill"
				art={skill.image ? (
					<img src={skill.image} alt="" className="enc-hero__art--skill" />
				) : (
					<span className="enc-hero__art--skill bg-gray-700" aria-hidden="true" />
				)}
				eyebrow={owners ? `Skill · ${owners}` : "Skill"}
				name={skill.name}
				nameId="skill-page-name"
				nameLang={nameLang(skill.name)}
				tags={
					<>
						<KindPill kind={kind} />
						{type && <Tag>{type}</Tag>}
						{skill.availability === "announced" ? <Tag dot="var(--color-status-upcoming)">Coming to global</Tag> : <WhereTag onGlobal={skill.availability !== "jp"} />}
					</>
				}
				lead={skill.description || undefined}
				facts={(skill.cost != null || owner) ? (
					<>
						{skill.cost != null && <Fact label="Cost">{skill.cost} SP</Fact>}
						{owner && (
							<Fact label={kind === "evolved" ? "Evolved by" : "Unique to"}>
								<OwnerFace uma={owner} />
							</Fact>
						)}
					</>
				) : undefined}
			/>

			{skill.readable.slots.length > 0 && (
				<Section
					title="How it works"
					// Only offered when the API sent the code (an older API doesn't).
					aside={skill.raw_conditions && <Switch label="Condition view" options={HOW_VIEWS} value={howView} onChange={setHowView} />}
				>
					<HowItWorks readable={skill.readable} raw={skill.raw_conditions} detailed={howView === "detailed"} />
				</Section>
			)}

			{/* The family straight after how it works: an evolution's unlock conditions
			    were at the bottom, under the long uma and card lists (Daptrius, 2026-11-13). */}
			<Family skill={skill} versions={versions} />

			{/* Side by side when the skill has both; either one alone takes the row. */}
			<div className={skill.sources.umas.length > 0 && skill.sources.cards.length > 0 ? "enc-two" : "contents"}>
				<UmaSources rows={skill.sources.umas} />
				<CardSources rows={skill.sources.cards} />
			</div>

			{/* No "also known as" line: other_names holds GameTora's names, which
			    search may match but the site never shows (owner, 2026-11-12). */}
			{(skill.availability === "jp" || credit) && (
				<p className="enc-foot">
					{skill.availability === "jp" && "Not in the global game yet. Its numbers come from the JP game and may change when it reaches global. "}
					{credit && (
						<>
							English text from{" "}
							<a href={UMATL_URL} target="_blank" rel="noreferrer">UmaTL</a>
							's fan translation.
						</>
					)}
				</p>
			)}
		</Page>
	)
}
