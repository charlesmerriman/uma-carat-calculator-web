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
import { ChevronRight } from "lucide-react"
import { useOshiIds } from "../../hooks/useOshiIds"
import { useSkillPage } from "../../services/encyclopediaQueries"
import type { SkillCondition, SkillPhrase, SkillReadable } from "../../types/pvpGuide"
import type { SkillDetailData, SkillSourceCard, SkillSourceUma } from "../../types/skills"
import { HIDE_OPTIONS, PAGE_CONTAINER, cardLine, keepCard, type HideFilter } from "../../utils/encyclopedia"
import { SKILL_LIST_PATH, cardHref, parseGameId, umaHref } from "../../utils/encyclopediaRoutes"
import { nameLang } from "../../utils/skillList"
import { SKILL_TYPE_WORDS, UMATL_URL, skillKind } from "../../utils/skillSearch"
import { hasCondition } from "../../utils/skillWords"
import { EncyclopediaGate } from "../encyclopedia/EncyclopediaTabs"
import {
	Crumbs, EmptyNote, Fact, Hero, JpTag, NotFound, PageSkeleton, Section, SectionNote, SubHeading, Switch, Tag, WhereTag,
} from "../encyclopedia/pieces"
import { SkillList, UnlockConditions } from "../encyclopedia/skillRows"
import { usePageTitle } from "../encyclopedia/usePageTitle"
import { FramedCard } from "../FramedCard"
import { FramedUma } from "../FramedUma"
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

/** A row of the block: the label down the left (its colon is for a screen reader), the words on the right. */
function HowRow({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<>
			<span className="enc-how__label">{label}<span className="sr-only">: </span></span>
			<span className="enc-how__value">{children}</span>
		</>
	)
}

/** When it fires and what it does: a block per effect slot. */
function HowItWorks({ readable }: { readable: SkillReadable }) {
	const many = readable.slots.length > 1
	return (
		<>
			<div className="enc-how">
				{readable.slots.map((slot, index) => (
					<div key={index} className="enc-how__slot">
						{many && <span className="enc-how__part">Part {index + 1}</span>}
						{hasCondition(slot.after) && <HowRow label="Only after"><Clauses condition={slot.after} /></HowRow>}
						<HowRow label="When"><Clauses condition={slot.when} /></HowRow>
						{slot.effects.length > 0 && (
							<HowRow label="Does">
								{slot.effects.map((phrase, position) => <Clause key={position} phrase={phrase} effect />)}
							</HowRow>
						)}
						{/* The label already says which; the value is the game's own figure. */}
						{slot.duration && <HowRow label="Lasts">{slot.duration === "Whole race" ? "The whole race" : slot.duration}</HowRow>}
						{slot.cooldown && (
							<HowRow label="Cooldown">
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
	return row.level !== null && row.source !== "unique" ? `${how}, level ${row.level}` : how
}

function UmaSources({ rows }: { rows: SkillSourceUma[] }) {
	const oshiIds = useOshiIds()
	if (rows.length === 0) return null
	return (
		<Section title="Umas with this skill" count={rows.length}>
			<ul className="enc-rows">
				{rows.map((row) => {
					const body = (
						<>
							<FramedUma src={row.image} oshi={oshiIds.has(row.id)} className="enc-row__art" />
							<span className="enc-row__text">
								<span className="enc-row__name">{row.name}</span>
								<span className="enc-row__sub">{umaHow(row)}</span>
							</span>
							{!row.on_global && <JpTag />}
						</>
					)
					return (
						<li key={`${row.id}-${row.source}`}>
							{row.game_id ? (
								<Link to={umaHref(row.game_id)} className="enc-row">
									{body}
									<ChevronRight className="enc-row__go" aria-hidden="true" />
								</Link>
							) : (
								<div className="enc-row">{body}</div>
							)}
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
				<ul className="enc-rows">
					{shown.map((row) => {
						const art = {
							image: row.image, image_borderless: row.image_borderless, card_type: row.card_type ?? null, rarity: row.rarity ?? null,
						}
						// A card's name is its character's, so its title leads when the API sends one.
						const line = [row.title ? row.name : null, cardLine(art), CARD_SOURCE[row.source] ?? row.source].filter(Boolean).join(" · ")
						const body = (
							<>
								<FramedCard card={art} className="enc-row__art--card" />
								<span className="enc-row__text">
									<span className="enc-row__name">{row.title || row.name}</span>
									<span className="enc-row__sub">{line}</span>
								</span>
								{!row.on_global && <JpTag />}
							</>
						)
						return (
							<li key={`${row.id}-${row.source}`}>
								{row.game_id ? (
									<Link to={cardHref(row.game_id)} className="enc-row">
										{body}
										<ChevronRight className="enc-row__go" aria-hidden="true" />
									</Link>
								) : (
									<div className="enc-row">{body}</div>
								)}
							</li>
						)
					})}
				</ul>
			)}
		</Section>
	)
}

function Evolution({ skill }: { skill: SkillDetailData }) {
	const { evolution } = skill
	if (!evolution.from && evolution.into.length === 0 && evolution.conditions.length === 0) return null
	// A skill that only evolves INTO others (most golds) gets the plain card the
	// canvas drew: "Evolves into", counted. One with a base or unlock conditions
	// needs the sub-headings below to tell its parts apart.
	if (!evolution.from && evolution.conditions.length === 0) {
		return (
			<Section title="Evolves into" count={evolution.into.length}>
				<SkillList skills={evolution.into} className="enc-ladder" />
			</Section>
		)
	}
	return (
		<Section title="Evolution">
			{evolution.from && (
				<div className="flex flex-col gap-2">
					<SubHeading>Evolves from</SubHeading>
					<SkillList skills={[evolution.from]} className="enc-ladder" />
				</div>
			)}
			{evolution.into.length > 0 && (
				<div className="flex flex-col gap-2">
					<SubHeading>Evolves into</SubHeading>
					{/* An evolution names its uma (Daptrius's list): the row's own second line does, from `owners`. */}
					<SkillList skills={evolution.into} className="enc-ladder" />
				</div>
			)}
			{evolution.conditions.length > 0 && (
				<div className="flex flex-col gap-2">
					<SubHeading>To unlock it</SubHeading>
					<UnlockConditions conditions={evolution.conditions} />
				</div>
			)}
		</Section>
	)
}

// ── The page ────────────────────────────────────────────────────────────────

export const SkillPage = () => (
	<EncyclopediaGate>
		<div className={PAGE_CONTAINER}>
			<SkillPageBody />
		</div>
	</EncyclopediaGate>
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
	const owners = skill.owners?.length ? skill.owners.join(", ") : null
	return (
		<article aria-labelledby="skill-page-name" className="flex flex-col gap-4">
			<Crumbs list="Skills" listPath={SKILL_LIST_PATH} name={skill.name} />
			<Hero
				accent={KIND_ACCENT[kind]}
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
				facts={skill.cost != null ? <Fact label="Cost">{skill.cost} SP</Fact> : undefined}
			/>

			{skill.readable.slots.length > 0 && (
				<Section title="How it works">
					<HowItWorks readable={skill.readable} />
				</Section>
			)}

			{/* Evolution straight after how it works: its unlock conditions were
			    at the bottom, under the long uma and card lists (Daptrius, 2026-11-13). */}
			<Evolution skill={skill} />

			{versions.length > 0 && (
				<Section title="Other versions" count={versions.length}>
					<SkillList skills={versions} className="enc-ladder" />
				</Section>
			)}

			<UmaSources rows={skill.sources.umas} />
			<CardSources rows={skill.sources.cards} />

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
		</article>
	)
}
