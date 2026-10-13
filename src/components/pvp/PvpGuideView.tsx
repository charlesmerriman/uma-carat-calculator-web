/**
 * One event's guide, the "Recommendations" view of the PvP page.
 *
 * Two columns from xl up: a narrow side column with what applies to the whole
 * team (overview, team comps, stats, skills for every style) and a main
 * column with one running style at a time (umas, notes, skills, decks,
 * mentions). Below xl the side column stacks on top.
 *
 * ONE style pane, never two. A second "compare" pane beside the first was
 * tried (2026-10-13) and read as every uma and card listed twice; removed at
 * the owner's request.
 *
 * Every section is optional and steps aside when empty; the guide model is
 * the superset of the sheet's two formats, and most guides fill only one.
 */

import { useState } from "react"
import { Eye, Users } from "lucide-react"
import { MarkdownContent } from "../info/MarkdownContent"
import { InlineNote, NoteOnlyTile, SkillChip, SkillMention, SupportTile, UmaTile } from "./PvpTiles"
import { SkillMentionsContext } from "./skillMentionsContext"
import { STYLE_LABELS, groupSkillsByTier, skillsForPosition, stylesWithContent } from "../../utils/pvpGuide"
import type {
	PvpDeck,
	PvpDeckSlot,
	PvpGuide,
	PvpSkillCategory,
	PvpSkillRecommendation,
	PvpStatConfig,
	PvpStyle,
} from "../../types/pvpGuide"

const SECTION = "rounded-xl border border-gray-700 bg-gray-800/60 p-3"
const HEADING = "text-sm font-semibold uppercase tracking-wide text-gray-400"
const SUBHEADING = "text-sm font-semibold text-brand"
const PARAGRAPH = "mt-2 leading-relaxed text-gray-300"

// Module scope, so MarkdownContent's memoised components keep one identity.
const renderSkill = (name: string) => <SkillMention name={name} />

// The subcategories inside a position's "Recommended skills". "other" is
// what a guide files without a category (the sheet's per-style lists), so it
// reads as the core list.
const CATEGORY_LABELS: Record<PvpSkillCategory, string> = {
	acceleration: "Acceleration",
	other: "Core skills",
	speed: "Speed",
	recovery: "Recovery",
	green: "Green skills",
	debuff: "Debuffs",
}
// Acceleration first: it is what a style lives or dies by. The rest in the
// order a player builds a skill list.
const CATEGORY_ORDER: PvpSkillCategory[] = ["acceleration", "other", "speed", "recovery", "green", "debuff"]

/** Rows split by category, in CATEGORY_ORDER, each keeping its tier order. */
function byCategory(rows: PvpSkillRecommendation[]): Array<[PvpSkillCategory, PvpSkillRecommendation[]]> {
	return CATEGORY_ORDER.map((category): [PvpSkillCategory, PvpSkillRecommendation[]] => [
		category,
		rows.filter((row) => row.category === category),
	]).filter(([, list]) => list.length > 0)
}

/**
 * A position's "Recommended skills": its own picks and the general ones
 * (every position) merged, split into subcategories, each by tier. A general
 * pick looks like any other; its hover detail says it applies everywhere.
 */
function RecommendedSkills({ rows }: { rows: PvpSkillRecommendation[] }) {
	return (
		<section aria-label="Recommended skills">
			<h4 className={SUBHEADING}>Recommended skills</h4>
			<div className="mt-2 flex flex-col gap-3 border-l-2 border-gray-700 pl-3">
			{byCategory(rows).map(([category, list]) => (
				<div key={category}>
					<h5 className="text-xs font-semibold uppercase tracking-wide text-gray-400">{CATEGORY_LABELS[category]}</h5>
					<div className="mt-1.5 flex flex-col gap-1.5">
						{groupSkillsByTier(list).map((group, index) => (
							<div key={index} className="flex flex-wrap items-center gap-1.5">
								{group.tier !== null && (
									<span className="rounded border border-gray-600 bg-gray-900 px-1.5 py-0.5 text-xs font-bold text-gray-300">
										T{group.tier}
									</span>
								)}
								{group.skills.map((row) => (
									<SkillChip
										key={`${row.style}-${row.skill.id}-${row.order}`}
										skill={row.skill}
										note={row.note}
										general={row.style === "everyone"}
									/>
								))}
							</div>
						))}
					</div>
				</div>
			))}
			</div>
		</section>
	)
}

const STAT_COLUMNS: Array<[keyof PvpStatConfig, string]> = [
	["speed", "Speed"],
	["stamina", "Stamina"],
	["power", "Power"],
	["guts", "Guts"],
	["wit", "Wit"],
]

function StatConfigTable({ rows }: { rows: PvpStatConfig[] }) {
	// One line each under the table, in order of first appearance.
	const footnotes = [...new Set(rows.map((row) => row.footnote).filter(Boolean))]
	return (
		<section className={SECTION} aria-labelledby="pvp-stats">
			<h3 id="pvp-stats" className={HEADING}>Recommended stats</h3>
			<div className="mt-2 overflow-x-auto">
				<table className="w-full border-collapse text-left text-xs sm:text-sm">
					<thead>
						<tr>
							<th className="border-b border-gray-600 px-1.5 py-1 font-semibold text-gray-300">Style</th>
							{STAT_COLUMNS.map(([, label]) => (
								<th key={label} className="border-b border-gray-600 px-1.5 py-1 text-center font-semibold text-gray-300">
									{label}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{rows.map((row, index) => (
							<tr key={index}>
								<td className="border-b border-gray-800 px-1.5 py-1 align-top">
									<span className="font-semibold text-gray-100">{STYLE_LABELS[row.style]}</span>
									{row.label && <span className="block text-xs text-gray-400">{row.label}</span>}
								</td>
								{STAT_COLUMNS.map(([key]) => (
									<td key={key} className="border-b border-gray-800 px-1.5 py-1 text-center tabular-nums text-gray-100">
										{/* An en dash for a stat the guide says nothing about. */}
										{(row[key] as string) || "–"}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{footnotes.length > 0 && (
				<ul className="mt-2 space-y-0.5 text-xs text-gray-400">
					{footnotes.map((footnote) => (
						<li key={footnote}>
							<InlineNote text={footnote} />
						</li>
					))}
				</ul>
			)}
		</section>
	)
}

/** A deck's six slots. Alternatives stack under their slot as an "or". */
function DeckGrid({ deck }: { deck: PvpDeck }) {
	const slots = new Map<number, PvpDeckSlot[]>()
	for (const row of deck.slots) slots.set(row.slot, [...(slots.get(row.slot) ?? []), row])
	return (
		<div>
			<div className="flex flex-wrap items-baseline gap-2">
				<span className="rounded-full border border-brand/50 bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
					{deck.label}
				</span>
				{deck.note && <InlineNote text={deck.note} className="text-xs text-gray-400" />}
			</div>
			<div className="mt-2 grid max-w-3xl grid-cols-3 gap-2 sm:grid-cols-6">
				{[1, 2, 3, 4, 5, 6].map((number) => {
					const [main, ...alternates] = slots.get(number) ?? []
					return (
						<div key={number} className="flex min-w-0 flex-col gap-1">
							{main ? (
								main.support_card ? (
									<SupportTile card={main.support_card} note={main.note} borrow={main.is_borrow} />
								) : (
									<NoteOnlyTile note={main.note} borrow={main.is_borrow} />
								)
							) : (
								<div className="aspect-square w-full rounded-lg border border-dashed border-gray-700" aria-hidden="true" />
							)}
							{alternates.map((alt, index) => (
								<div key={index} className="text-center text-[11px] leading-tight text-gray-400">
									{alt.support_card ? (
										<>or <span className="text-gray-200">{alt.support_card.name}</span> </>
									) : null}
									<InlineNote text={alt.note} />
								</div>
							))}
						</div>
					)
				})}
			</div>
		</div>
	)
}

function StylePane({ guide, style }: { guide: PvpGuide; style: PvpStyle }) {
	const umas = guide.uma_recommendations.filter((row) => row.style === style)
	const note = guide.style_notes.find((row) => row.style === style)
	// The position's own picks and the general ones, merged.
	const skills = skillsForPosition(guide.skill_recommendations, style)
	const decks = guide.decks.filter((row) => row.style === style)
	const mentions = guide.honorable_mentions.filter((row) => row.style === style)
	return (
		<div className="flex flex-col gap-4">
			{umas.length > 0 && (
				<div>
					<h4 className={SUBHEADING}>Recommended umas</h4>
					<div className="mt-2 flex flex-wrap gap-2">
						{umas.map((row) => (
							<UmaTile key={row.uma.id} uma={row.uma} stars={row.stars} role={row.role} note={row.note} />
						))}
					</div>
				</div>
			)}
			{note && (
				<div className="text-sm">
					<MarkdownContent markdown={note.body} paragraphClassName={PARAGRAPH} renderSkill={renderSkill} />
				</div>
			)}
			{skills.length > 0 && <RecommendedSkills rows={skills} />}
			{decks.length > 0 && (
				<div className="flex flex-col gap-4">
					<h4 className={SUBHEADING}>Example decks</h4>
					{decks.map((deck) => (
						<DeckGrid key={deck.id} deck={deck} />
					))}
				</div>
			)}
			{mentions.length > 0 && (
				<div>
					<h4 className={SUBHEADING}>Honorable mentions</h4>
					<div className="mt-2 grid max-w-3xl grid-cols-3 gap-2 sm:grid-cols-6">
						{mentions.map((row) => (
							<SupportTile key={row.support_card.id} card={row.support_card} note={row.note} />
						))}
					</div>
				</div>
			)}
		</div>
	)
}

function StyleTabs({ styles, active, onChange, label }: {
	styles: PvpStyle[]
	active: PvpStyle
	onChange: (style: PvpStyle) => void
	label: string
}) {
	return (
		<div role="tablist" aria-label={label} className="flex flex-wrap gap-1 rounded-xl border border-gray-700 bg-gray-800/60 p-1">
			{styles.map((style) => (
				<button
					key={style}
					type="button"
					role="tab"
					aria-selected={style === active}
					onClick={() => onChange(style)}
					className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
						style === active
							? "border-brand/50 bg-brand/10 text-brand"
							: "border-transparent text-gray-400 hover:bg-gray-700/70 hover:text-gray-100"
					}`}
				>
					{STYLE_LABELS[style]}
				</button>
			))}
		</div>
	)
}

function StyleColumn({ guide, styles }: { guide: PvpGuide; styles: PvpStyle[] }) {
	const [active, setActive] = useState<PvpStyle>(styles[0])
	// A guide reload with fewer styles can leave the old pick behind.
	const shown = styles.includes(active) ? active : styles[0]
	return (
		<div className="flex min-w-0 flex-col gap-3">
			<StyleTabs styles={styles} active={shown} onChange={setActive} label="Running style" />
			<div role="tabpanel" aria-label={STYLE_LABELS[shown]} className={SECTION}>
				<StylePane guide={guide} style={shown} />
			</div>
		</div>
	)
}

export function PvpGuideView({ guide }: { guide: PvpGuide }) {
	const styles = stylesWithContent(guide)
	// General skills (every position) show inside each position's tab. With
	// no position tabs at all they get a section of their own instead.
	const generalSkills = guide.skill_recommendations.filter((row) => row.style === "everyone")
	const hasOverview = guide.style_ranking || guide.short_description || guide.meta_analysis
	const hasSide =
		hasOverview || guide.team_comps.length > 0 || guide.stat_configs.length > 0

	return (
		<SkillMentionsContext.Provider value={guide.skill_mentions ?? EMPTY_MENTIONS}>
		<div className="flex flex-col gap-4">
			{!guide.is_published && (
				<div className="flex items-center gap-2 rounded-lg border border-staging/60 bg-staging/10 px-3 py-2 text-sm font-semibold text-gray-100">
					<Eye className="h-4 w-4 shrink-0" />
					Draft, visible to staff only.
				</div>
			)}

			<div
				className={
					hasSide && (styles.length > 0 || generalSkills.length > 0)
						? "grid items-start gap-4 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]"
						: "flex flex-col gap-4"
				}
			>
				{hasSide && (
					<aside className="flex min-w-0 flex-col gap-4" aria-label="For the whole team">
						{hasOverview && (
							<section className={SECTION} aria-labelledby="pvp-overview">
								<h3 id="pvp-overview" className={HEADING}>Overview</h3>
								{guide.style_ranking && (
									<p className="mt-2 text-sm text-gray-300">
										<span className="font-semibold text-gray-100">Style ranking: </span>
										{guide.style_ranking}
									</p>
								)}
								{guide.short_description && (
									<div className="text-sm">
										<MarkdownContent markdown={guide.short_description} paragraphClassName={PARAGRAPH} renderSkill={renderSkill} />
									</div>
								)}
								{guide.meta_analysis && (
									<div className="mt-3 text-sm">
										<h4 className={SUBHEADING}>Meta analysis</h4>
										<MarkdownContent markdown={guide.meta_analysis} paragraphClassName={PARAGRAPH} renderSkill={renderSkill} />
									</div>
								)}
							</section>
						)}

						{guide.team_comps.length > 0 && (
							<section className={SECTION} aria-labelledby="pvp-team-comps">
								<h3 id="pvp-team-comps" className={`flex items-center gap-1.5 ${HEADING}`}>
									<Users className="h-4 w-4" />
									Team comps
								</h3>
								<ul className="mt-2 space-y-1 text-sm text-gray-300">
									{guide.team_comps.map((comp, index) => (
										<li key={index}>
											<span className="font-medium text-gray-100">{comp.text}</span>
											{comp.note && (
												<>
													<span className="text-gray-500"> · </span>
													<InlineNote text={comp.note} />
												</>
											)}
										</li>
									))}
								</ul>
							</section>
						)}

						{guide.stat_configs.length > 0 && <StatConfigTable rows={guide.stat_configs} />}

					</aside>
				)}

				{styles.length > 0 ? (
					<StyleColumn guide={guide} styles={styles} />
				) : (
					generalSkills.length > 0 && (
						<div className={SECTION}>
							<RecommendedSkills rows={skillsForPosition(guide.skill_recommendations, "everyone")} />
						</div>
					)
				)}
			</div>
		</div>
		</SkillMentionsContext.Provider>
	)
}

const EMPTY_MENTIONS = {}
