/**
 * One event's guide, the "Recommendations" view of the PvP page.
 *
 * Two columns from xl up: a narrow side column with what applies to the whole
 * team (overview, general skills, team comps, stats) and a main column with
 * one running style at a time (umas, notes, that style's skills, decks).
 * Below xl the side column stacks on top.
 *
 * ONE style pane, never two. A second "compare" pane beside the first was
 * tried (2026-10-13) and read as every uma and card listed twice; removed at
 * the owner's request.
 *
 * Every section is optional and steps aside when empty; the guide model is
 * the superset of the sheet's two formats, and most guides fill only one.
 */

import { Eye, Users } from "lucide-react"
import { MarkdownContent } from "../info/MarkdownContent"
import { InlineNote, NoteOnlyTile, SkillChip, SkillMention, SupportTile, UmaTile } from "./PvpTiles"
import { SkillMentionsContext } from "./skillMentionsContext"
import {
	SKILL_CATEGORY_LABELS,
	SKILL_CATEGORY_ORDER,
	STYLE_LABELS,
	groupSkillsByTier,
	pickStyle,
	skillsForPosition,
	stylesWithContent,
} from "../../utils/pvpGuide"
import type {
	PvpDeck,
	PvpDeckSlot,
	PvpGuide,
	PvpSkillCategory,
	PvpSkillRecommendation,
	PvpStatConfig,
	PvpStyle,
} from "../../types/pvpGuide"

const SECTION = "rounded-xl border border-edge bg-gray-800/60 p-3"
const HEADING = "text-sm font-semibold uppercase tracking-wide text-gray-400"
const SUBHEADING = "text-sm font-semibold text-brand"
const PARAGRAPH = "mt-2 leading-relaxed text-gray-300"

// Module scope, so MarkdownContent's memoised components keep one identity.
const renderSkill = (name: string) => <SkillMention name={name} />

// The category labels and order are shared with the team builder's skills
// panel: utils/pvpGuide.ts SKILL_CATEGORY_LABELS / SKILL_CATEGORY_ORDER.
const CATEGORY_LABELS = SKILL_CATEGORY_LABELS
const CATEGORY_ORDER = SKILL_CATEGORY_ORDER

/** Rows split by category, in CATEGORY_ORDER, each keeping its tier order. */
function byCategory(rows: PvpSkillRecommendation[]): Array<[PvpSkillCategory, PvpSkillRecommendation[]]> {
	return CATEGORY_ORDER.map((category): [PvpSkillCategory, PvpSkillRecommendation[]] => [
		category,
		rows.filter((row) => row.category === category),
	]).filter(([, list]) => list.length > 0)
}

/**
 * Skill rows split into subcategories, each by tier: the body of a
 * position's "Recommended skills" and of the side column's "General skills".
 */
function SkillCategories({ rows }: { rows: PvpSkillRecommendation[] }) {
	return (
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
									<SkillChip key={`${row.style}-${row.skill.id}-${row.order}`} skill={row.skill} note={row.note} />
								))}
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	)
}

/** A position's "Recommended skills": its own picks only (the general ones sit in the side column). */
function RecommendedSkills({ rows }: { rows: PvpSkillRecommendation[] }) {
	return (
		<section aria-label="Recommended skills">
			<h4 className={SUBHEADING}>Recommended skills</h4>
			<SkillCategories rows={rows} />
		</section>
	)
}

// The five stats in game order, headed by the game's own stat icons
// (public/0N_CM*.png, 84px squares shown at 32px).
const STAT_COLUMNS: Array<{ key: keyof PvpStatConfig; label: string; icon: string }> = [
	{ key: "speed", label: "Speed", icon: "/00_CMSPEED1.png" },
	{ key: "stamina", label: "Stamina", icon: "/01_CMStamina1.png" },
	{ key: "power", label: "Power", icon: "/02_CMPOWER1.png" },
	{ key: "guts", label: "Guts", icon: "/03_CMGUTS1.png" },
	{ key: "wit", label: "Wit", icon: "/04_CMWits1.png" },
]

/**
 * "1100+" -> 1100, marks "+"; "901*+1 Gold" -> 901, marks "*", extra
 * "+1 Gold". Marks (+ and *) sit beside the number as a superscript; anything
 * longer drops to a second line. Every number therefore lands on the same
 * line across a row, whatever the cells carry besides it.
 */
function splitStat(value: string): { number: string; marks: string; extra: string } {
	// A "+" right before a digit starts the extra ("901*+1 Gold"), not a mark.
	const match = /^(\d[\d,]*)((?:[+*](?!\d))*)(.*)$/.exec(value.trim())
	return match
		? { number: match[1], marks: match[2], extra: match[3].trim() }
		: { number: "", marks: "", extra: value.trim() }
}

function StatValue({ value, label }: { value: string; label: string }) {
	// An en dash for a stat the guide says nothing about.
	if (!value) return <span className="text-gray-600">–</span>
	const { number, marks, extra } = splitStat(value)
	return (
		<span title={`${label}: ${value}`}>
			{number && (
				<span className="text-[13px] font-semibold tabular-nums text-gray-100 sm:text-sm">
					{number}
					{marks && <sup className="ml-px text-[10px] font-medium text-gray-400">{marks}</sup>}
				</span>
			)}
			{extra && (
				<span className={number ? "block text-[10px] leading-tight text-gray-400" : "text-sm text-gray-100"}>
					{extra}
				</span>
			)}
		</span>
	)
}

function StatConfigTable({ rows }: { rows: PvpStatConfig[] }) {
	// One line each under the table, in order of first appearance.
	const footnotes = [...new Set(rows.map((row) => row.footnote).filter(Boolean))]
	return (
		<section className={SECTION} aria-labelledby="pvp-stats">
			<h3 id="pvp-stats" className={HEADING}>Recommended stats</h3>
			{/* Squeezed to a phone's width the five stat columns were about 50px
			    beside a 5.5rem style column, and "1100++ 900++ 1100++" ran
			    together (design polish item 26). Below sm the style column is
			    4.75rem and the numbers 13px, which at 390px leaves about 11px
			    between "1100++" and its neighbour and keeps "Everyone" clear of
			    the first stat. Under 20rem of width (the smallest
			    phones) the table scrolls sideways inside the section rather than
			    squeezing the numbers back together. */}
			<div className="mt-2 overflow-x-auto">
				<table className="w-full min-w-[20rem] table-fixed border-collapse text-left">
					<thead>
						<tr className="border-b border-gray-600">
							<th className="w-[4.75rem] pb-2 align-middle text-xs font-bold uppercase tracking-wider text-gray-300 sm:w-[5.5rem]">Style</th>
							{STAT_COLUMNS.map((column) => (
								<th key={column.key} className="pb-2 text-center" title={column.label}>
									<img src={column.icon} alt={column.label} width={32} height={32} className="mx-auto h-8 w-8" />
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{rows.map((row, index) => (
							<tr key={index} className="border-b border-gray-700/80 last:border-b-0">
								{/* align-top on every cell: the numbers share one line
								    even when a cell or the label wraps below it. */}
								<th scope="row" className="py-2 pr-1 align-top font-normal">
									<span className="block text-sm font-semibold leading-5 text-gray-100">{STYLE_LABELS[row.style]}</span>
									{row.label && <span className="block text-[11px] leading-tight text-gray-400">{row.label}</span>}
								</th>
								{STAT_COLUMNS.map((column) => (
									<td key={column.key} className="py-2 text-center align-top leading-5">
										<StatValue value={row[column.key] as string} label={column.label} />
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{footnotes.length > 0 && (
				<ul className="mt-2 space-y-0.5 border-t border-gray-700/70 pt-2 text-xs text-gray-400">
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
	// The position's own picks; the general ones are in the side column.
	const skills = skillsForPosition(guide.skill_recommendations, style)
	const decks = guide.decks.filter((row) => row.style === style)
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

function StyleColumn({ guide, styles, style, onStyleChange }: {
	guide: PvpGuide
	styles: PvpStyle[]
	style: PvpStyle | null
	onStyleChange: (style: PvpStyle) => void
}) {
	// The page owns the pick (it is `?style=` in the URL, so a link can name
	// it). A guide without that style shows its first, and the pick is kept.
	const shown = pickStyle(styles, style) ?? styles[0]
	return (
		<div className="flex min-w-0 flex-col gap-3">
			<StyleTabs styles={styles} active={shown} onChange={onStyleChange} label="Running style" />
			<div role="tabpanel" aria-label={STYLE_LABELS[shown]} className={SECTION}>
				<StylePane guide={guide} style={shown} />
			</div>
		</div>
	)
}

/**
 * `style` is the running style asked for (the URL's, or the reader's last),
 * not necessarily one this guide has; `pickStyle` settles which tab shows.
 */
export function PvpGuideView({ guide, style, onStyleChange }: {
	guide: PvpGuide
	style: PvpStyle | null
	onStyleChange: (style: PvpStyle) => void
}) {
	const styles = stylesWithContent(guide)
	// General skills (style "everyone") are team-wide, like the stats, so
	// they get one section in the side column, under the Overview, instead of
	// a copy inside every position's tab, where they read as its own picks.
	const generalSkills = skillsForPosition(guide.skill_recommendations, "everyone")
	const hasOverview = guide.style_ranking || guide.short_description || guide.meta_analysis
	const hasSide =
		hasOverview || generalSkills.length > 0 || guide.team_comps.length > 0 || guide.stat_configs.length > 0

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
					hasSide && styles.length > 0
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

						{generalSkills.length > 0 && (
							<section className={SECTION} aria-labelledby="pvp-general-skills">
								<h3 id="pvp-general-skills" className={HEADING}>General skills</h3>
								<p className="mt-1 text-xs text-gray-400">Recommended for every position.</p>
								<SkillCategories rows={generalSkills} />
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

				{styles.length > 0 && (
					<StyleColumn guide={guide} styles={styles} style={style} onStyleChange={onStyleChange} />
				)}
			</div>
		</div>
		</SkillMentionsContext.Provider>
	)
}

const EMPTY_MENTIONS = {}
