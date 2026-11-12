/**
 * /app/skills/<game id>: one skill's Encyclopedia page (notes/encyclopedia-plan.md,
 * PR 5). Its body is what the Skills page's side card showed (that card is
 * gone: a row opens this page now, owner's answer 7), plus the skill point
 * cost, the unique / inherited pair, each evolution's uma, every uma and card
 * as a link to its page, and "Hide R" / "Hide SR" on the cards (Daptrius's
 * list, items 3, 4 and 9).
 */

import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { useOshiIds } from "../../hooks/useOshiIds"
import { useSkillPage } from "../../services/encyclopediaQueries"
import type { SkillDetailData, SkillListRow, SkillSourceCard, SkillSourceUma } from "../../types/skills"
import { HIDE_OPTIONS, LINK_CLASS, PAGE_CONTAINER, cardLine, keepCard, type HideFilter } from "../../utils/encyclopedia"
import { SKILL_LIST_PATH, cardHref, parseGameId, umaHref } from "../../utils/encyclopediaRoutes"
import { nameLang } from "../../utils/skillList"
import { UMATL_URL, skillHref, skillKind } from "../../utils/skillSearch"
import { EncyclopediaGate } from "../encyclopedia/EncyclopediaTabs"
import { Section } from "../encyclopedia/pieces"
import { Crumbs, NotFound } from "../encyclopedia/UmaPage"
import { usePageTitle } from "../encyclopedia/usePageTitle"
import { Chips } from "../encyclopedia/listFilters"
import { FramedUma } from "../FramedUma"
import { JpOnlyTag, ReadableText } from "../pvp/SkillDetail"

type SkillRef = Omit<SkillListRow, "other_names">

function SkillIcon({ image, className = "h-6 w-6" }: { image: string | null; className?: string }) {
	return image ? (
		<img src={image} alt="" className={`${className} shrink-0`} loading="lazy" decoding="async" />
	) : (
		<span className={`${className} shrink-0 rounded-full bg-gray-700`} aria-hidden="true" />
	)
}

/** A skill named on the page (its base, an evolution, a version, its pair), as a link. */
function SkillLink({ skill, note }: { skill: SkillRef; note?: string }) {
	return (
		<Link to={skillHref(skill.game_id)} className={`inline-flex items-center gap-1 ${LINK_CLASS}`}>
			<SkillIcon image={skill.image} className="h-4 w-4" />
			<span lang={nameLang(skill.name)}>{skill.name}</span>
			<span className="text-gray-400">({note ?? skillKind(skill)})</span>
		</Link>
	)
}

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

const ROW = "flex items-center gap-2.5 rounded-lg border border-edge bg-(--card-fill) px-2 py-1.5 text-sm text-gray-100 transition hover:border-gray-500"

function UmaSources({ rows }: { rows: SkillSourceUma[] }) {
	const oshiIds = useOshiIds()
	if (rows.length === 0) return null
	return (
		<Section title={`Umas with this skill (${rows.length})`}>
			<ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
				{rows.map((row) => {
					const body = (
						<>
							<FramedUma src={row.image} oshi={oshiIds.has(row.id)} className="h-9 w-9 shrink-0" />
							<span className="min-w-0 flex-1">
								<span className="block truncate">{row.name}</span>
								<span className="block text-xs text-gray-400">{umaHow(row)}</span>
							</span>
							{!row.on_global && <JpOnlyTag className="shrink-0 text-[10px]" />}
						</>
					)
					return (
						<li key={`${row.id}-${row.source}`}>
							{row.game_id ? <Link to={umaHref(row.game_id)} className={ROW}>{body}</Link> : <div className={ROW}>{body}</div>}
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
		<Section title={`Cards that teach it (${shown.length})`}>
			<Chips label="Card rarity" options={HIDE_OPTIONS} value={hide} onChange={setHide} />
			{shown.length === 0 ? (
				<p className="text-sm text-gray-400">Only R or SR cards teach it.</p>
			) : (
				<ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
					{shown.map((row) => {
						const body = (
							<>
								{/* The card's own 3:4 shape, never a square crop (Daptrius's list). */}
								{row.image ? (
									<img src={row.image} alt="" className="aspect-[3/4] w-9 shrink-0 rounded object-cover" loading="lazy" decoding="async" />
								) : (
									<span className="aspect-[3/4] w-9 shrink-0 rounded bg-gray-700" aria-hidden="true" />
								)}
								<span className="min-w-0 flex-1">
									<span className="block truncate">{row.name}</span>
									<span className="block text-xs text-gray-400">
										{[cardLine({ rarity: row.rarity ?? null, card_type: row.card_type ?? null }), CARD_SOURCE[row.source] ?? row.source]
											.filter(Boolean).join(" · ")}
									</span>
								</span>
								{!row.on_global && <JpOnlyTag className="shrink-0 text-[10px]" />}
							</>
						)
						return (
							<li key={`${row.id}-${row.source}`}>
								{row.game_id ? <Link to={cardHref(row.game_id)} className={ROW}>{body}</Link> : <div className={ROW}>{body}</div>}
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
	return (
		<Section title="Evolution">
			<div className="space-y-1 text-sm text-gray-300">
				{evolution.from && (
					<p>
						Evolves from <SkillLink skill={evolution.from} />
					</p>
				)}
				{evolution.into.length > 0 && (
					<p>
						Evolves into{" "}
						{evolution.into.map((row, index) => (
							<span key={row.id}>
								{index > 0 && ", "}
								{/* An evolution names its uma, not "(evolved)" (Daptrius's list). */}
								<SkillLink skill={row} note={row.owners?.length ? row.owners.join(", ") : undefined} />
							</span>
						))}
					</p>
				)}
				{evolution.conditions.length > 0 && (
					<>
						<p className="text-gray-400">To unlock it:</p>
						<ul className="list-disc space-y-0.5 pl-5">
							{evolution.conditions.map((condition, index) => (
								<li key={index}>
									{condition.text}
									{condition.is_japanese && <span className="text-gray-500"> (in Japanese, no translation yet)</span>}
								</li>
							))}
						</ul>
					</>
				)}
			</div>
		</Section>
	)
}

export const SkillPage = () => (
	<EncyclopediaGate>
		<SkillPageBody />
	</EncyclopediaGate>
)

const SkillPageBody = () => {
	const gameId = parseGameId(useParams().gameId)
	const page = useSkillPage(gameId)
	usePageTitle(page.data?.name)

	if (gameId === null || page.data === null) return <NotFound />
	if (page.isError) {
		return <p className={`${PAGE_CONTAINER} text-sm text-gray-400`}>The skill didn't load. Reload to try again.</p>
	}
	if (!page.data) {
		return (
			<p className={`${PAGE_CONTAINER} flex items-center gap-2 text-sm text-gray-400`} role="status">
				<Loader2 className="h-4 w-4 animate-spin" /> Loading the skill...
			</p>
		)
	}
	return <SkillPageDetail skill={page.data} />
}

export function SkillPageDetail({ skill }: { skill: SkillDetailData }) {
	const credit = skill.uses_translation || skill.evolution.conditions.some((condition) => condition.uses_translation)
	const isInherited = skillKind(skill) === "inherited"
	return (
		<article aria-labelledby="skill-page-name" className={PAGE_CONTAINER}>
			<Crumbs list="Skills" listPath={SKILL_LIST_PATH} name={skill.name} />
			<header className="flex items-start gap-3">
				<SkillIcon image={skill.image} className="h-12 w-12" />
				<div className="min-w-0 flex-1">
					<h1 id="skill-page-name" className="font-display flex flex-wrap items-center gap-x-2 text-xl font-bold text-gray-100">
						<span lang={nameLang(skill.name)}>{skill.name}</span>
						{skill.availability === "jp" && <JpOnlyTag className="text-xs" />}
						{skill.availability === "announced" && (
							<span className="rounded border border-gray-500 px-1 text-xs font-medium text-gray-300">Coming to global</span>
						)}
					</h1>
					<p className="text-xs text-gray-400">
						{[skillKind(skill), skill.cost != null ? `${skill.cost} SP` : null, skill.owners?.length ? skill.owners.join(", ") : null]
							.filter(Boolean).join(" · ")}
					</p>
				</div>
			</header>

			{skill.description && <p className="text-sm text-gray-200">{skill.description}</p>}

			<Section title="How it works">
				<div className="rounded-lg border border-edge bg-gray-900/40 px-3 py-2 text-sm text-gray-200">
					<ReadableText readable={skill.readable} />
				</div>
			</Section>

			{skill.pair && (
				<p className="text-sm text-gray-300">
					{isInherited ? "The unique it comes from: " : "Its inherited version: "}
					<SkillLink skill={skill.pair} />
				</p>
			)}

			{skill.versions.length > 0 && (
				<Section title="Other versions">
					<ul className="space-y-0.5 text-sm">
						{skill.versions.map((version) => (
							<li key={version.id}>
								<SkillLink skill={version} />
							</li>
						))}
					</ul>
				</Section>
			)}

			<UmaSources rows={skill.sources.umas} />
			<CardSources rows={skill.sources.cards} />
			<Evolution skill={skill} />

			{/* No "also known as" line: other_names holds GameTora's names, which
			    search may match but the site never shows (owner, 2026-11-12). */}
			{skill.availability === "jp" && (
				<p className="text-xs text-gray-400">
					Not in the global game yet. Its numbers come from the JP game and may change when it reaches global.
				</p>
			)}
			{credit && (
				<p className="text-xs text-gray-400">
					English text from{" "}
					<a href={UMATL_URL} target="_blank" rel="noreferrer" className={LINK_CLASS}>UmaTL</a>
					's fan translation.
				</p>
			)}
		</article>
	)
}
