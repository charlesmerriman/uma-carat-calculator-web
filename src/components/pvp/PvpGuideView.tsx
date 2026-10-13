/**
 * One event's guide: overview, stats, team-wide skills, then a pane per
 * running style. Every section is optional and steps aside when empty; the
 * guide model is the superset of the sheet's two formats, and most guides fill
 * only one of them.
 *
 * One style pane at a time; from the 2xl breakpoint a second pane sits beside
 * it with its own tab bar, defaulting to the next style, so two styles can be
 * compared on a wide monitor.
 */

import { useState } from "react"
import { Eye, Users } from "lucide-react"
import { MarkdownContent } from "../info/MarkdownContent"
import { InlineNote, NoteOnlyTile, SkillChip, SupportTile, UmaTile } from "./PvpTiles"
import { STYLE_LABELS, groupSkillsByTier, stylesWithContent } from "../../utils/pvpGuide"
import type {
	PvpDeck,
	PvpDeckSlot,
	PvpGuide,
	PvpSkillCategory,
	PvpSkillRecommendation,
	PvpStatConfig,
	PvpStyle,
} from "../../types/pvpGuide"

const SECTION = "rounded-xl border border-gray-700 bg-gray-800/60 p-3 sm:p-4"
const HEADING = "text-base font-semibold text-gray-100"
const SUBHEADING = "text-sm font-semibold text-brand"
const PARAGRAPH = "mt-2 leading-relaxed text-gray-300"

const CATEGORY_LABELS: Record<PvpSkillCategory, string> = {
	acceleration: "Acceleration",
	speed: "Speed",
	green: "Green skills",
	recovery: "Recovery",
	debuff: "Debuffs",
	other: "Recommended skills",
}
// Acceleration first: it is what a style lives or dies by. The rest in the
// order a player builds a skill list.
const CATEGORY_ORDER: PvpSkillCategory[] = ["acceleration", "speed", "recovery", "other", "green", "debuff"]

/** Rows split by category, in CATEGORY_ORDER, each keeping its tier order. */
function byCategory(rows: PvpSkillRecommendation[]): Array<[PvpSkillCategory, PvpSkillRecommendation[]]> {
	return CATEGORY_ORDER.map((category): [PvpSkillCategory, PvpSkillRecommendation[]] => [
		category,
		rows.filter((row) => row.category === category),
	]).filter(([, list]) => list.length > 0)
}

function SkillGroups({ rows }: { rows: PvpSkillRecommendation[] }) {
	return (
		<div className="flex flex-col gap-3">
			{byCategory(rows).map(([category, list]) => (
				<div key={category}>
					<h4 className={SUBHEADING}>{CATEGORY_LABELS[category]}</h4>
					<div className="mt-1.5 flex flex-col gap-1.5">
						{groupSkillsByTier(list).map((group, index) => (
							<div key={index} className="flex flex-wrap items-center gap-1.5">
								{group.tier !== null && (
									<span className="rounded border border-gray-600 bg-gray-900 px-1.5 py-0.5 text-xs font-bold text-gray-300">
										T{group.tier}
									</span>
								)}
								{group.skills.map((row) => (
									<SkillChip key={`${row.skill.id}-${row.order}`} skill={row.skill} note={row.note} />
								))}
							</div>
						))}
					</div>
				</div>
			))}
		</div>
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
				<table className="w-full min-w-[30rem] border-collapse text-left text-sm">
					<thead>
						<tr>
							<th className="border-b border-gray-600 px-2 py-1.5 font-semibold text-gray-300">Style</th>
							{STAT_COLUMNS.map(([, label]) => (
								<th key={label} className="border-b border-gray-600 px-2 py-1.5 text-center font-semibold text-gray-300">
									{label}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{rows.map((row, index) => (
							<tr key={index}>
								<td className="border-b border-gray-800 px-2 py-1.5 align-top">
									<span className="font-semibold text-gray-100">{STYLE_LABELS[row.style]}</span>
									{row.label && <span className="block text-xs text-gray-400">{row.label}</span>}
								</td>
								{STAT_COLUMNS.map(([key]) => (
									<td key={key} className="border-b border-gray-800 px-2 py-1.5 text-center tabular-nums text-gray-100">
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
			<div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
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
	const skills = guide.skill_recommendations.filter((row) => row.style === style)
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
					<MarkdownContent markdown={note.body} paragraphClassName={PARAGRAPH} />
				</div>
			)}
			{skills.length > 0 && <SkillGroups rows={skills} />}
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
					<div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
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

function StyleColumn({ guide, styles, initial, label, className = "" }: {
	guide: PvpGuide
	styles: PvpStyle[]
	initial: PvpStyle
	label: string
	className?: string
}) {
	const [active, setActive] = useState<PvpStyle>(initial)
	// A guide reload with fewer styles can leave the old pick behind.
	const shown = styles.includes(active) ? active : styles[0]
	return (
		<div className={`flex min-w-0 flex-col gap-3 ${className}`}>
			<StyleTabs styles={styles} active={shown} onChange={setActive} label={label} />
			<div role="tabpanel" aria-label={STYLE_LABELS[shown]} className={SECTION}>
				<StylePane guide={guide} style={shown} />
			</div>
		</div>
	)
}

export function PvpGuideView({ guide }: { guide: PvpGuide }) {
	const styles = stylesWithContent(guide)
	const sharedSkills = guide.skill_recommendations.filter((row) => row.style === "everyone")
	const hasOverview =
		guide.style_ranking || guide.short_description || guide.meta_analysis || guide.team_comps.length > 0

	return (
		<div className="flex flex-col gap-4">
			{!guide.is_published && (
				<div className="flex items-center gap-2 rounded-lg border border-staging/60 bg-staging/10 px-3 py-2 text-sm font-semibold text-gray-100">
					<Eye className="h-4 w-4 shrink-0" />
					Draft, visible to staff only.
				</div>
			)}

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
							<MarkdownContent markdown={guide.short_description} paragraphClassName={PARAGRAPH} />
						</div>
					)}
					{guide.meta_analysis && (
						<div className="mt-2 text-sm">
							<h4 className={SUBHEADING}>Meta analysis</h4>
							<MarkdownContent markdown={guide.meta_analysis} paragraphClassName={PARAGRAPH} />
						</div>
					)}
					{guide.team_comps.length > 0 && (
						<div className="mt-3">
							<h4 className={`flex items-center gap-1.5 ${SUBHEADING}`}>
								<Users className="h-4 w-4" />
								Team comps
							</h4>
							<ul className="mt-1.5 space-y-1 text-sm text-gray-300">
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
						</div>
					)}
				</section>
			)}

			{guide.stat_configs.length > 0 && <StatConfigTable rows={guide.stat_configs} />}

			{sharedSkills.length > 0 && (
				<section className={SECTION} aria-labelledby="pvp-shared-skills">
					<h3 id="pvp-shared-skills" className={`${HEADING} mb-2`}>For every style</h3>
					<SkillGroups rows={sharedSkills} />
				</section>
			)}

			{styles.length > 0 && (
				<section aria-label="By running style" className="grid gap-4 2xl:grid-cols-2">
					<StyleColumn guide={guide} styles={styles} initial={styles[0]} label="Running style" />
					{styles.length > 1 && (
						<StyleColumn
							guide={guide}
							styles={styles}
							initial={styles[1]}
							label="Compare with"
							className="hidden 2xl:flex"
						/>
					)}
				</section>
			)}
		</div>
	)
}
