/**
 * One event's guide, the "Recommendations" view of the PvP page.
 *
 * On top, the band (GuideBand): the style ranking, the meta analysis, the
 * stats, the scenario and the team comps. Under it, two columns from xl up: a
 * narrow side column with the general skills and the whole guide's thread,
 * and a main column with one running style at a time (umas, notes, that
 * style's skills, decks). Below xl the side column follows the style.
 *
 * ONE style pane, never two. A second "compare" pane beside the first was
 * tried (2026-10-13) and read as every uma and card listed twice; removed at
 * the owner's request.
 *
 * Every section is optional and steps aside when empty; the guide model is
 * the superset of the sheet's two formats, and most guides fill only one.
 */

import { Link } from "react-router-dom"
import { useSkillsPreview } from "../../hooks/useSkillsPreview"
import { useEffect, useRef, useState, type CSSProperties } from "react"
import { Eye } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { MarkdownContent } from "../info/MarkdownContent"
import { GuideComments } from "./GuideComments"
import { GuideBand } from "./GuideBand"
import { HEADING, PARAGRAPH, SECTION, SUBHEADING } from "./guideStyles"
import { guideCommentCount } from "../../services/guideComments"
import { AlternateCard, AnyTypeLine, InlineNote, NoteOnlyTile, SkillCell, SkillMention, Stars, SupportTile, SwapInCard, UmaTile } from "./PvpTiles"
import { recalledDeckBudget, rememberDeckBudget } from "../../services/pvpPageMemory"
import { parseSlotNote, type DeckStatType } from "../../utils/deckNotes"
import { SkillMentionsContext } from "./skillMentionsContext"
import {
	ALL_STYLES_LABEL,
	ALL_STYLES_TAB,
	SKILL_CATEGORY_LABELS,
	SKILL_CATEGORY_ORDER,
	STYLE_LABELS,
	cardsInEveryDeck,
	deckChanges,
	groupSkillsByTier,
	listWords,
	parseStyleRanking,
	pickStyle,
	skillsForPosition,
	styleColor,
	styleRanks,
	styleTabs,
	stylesWithContent,
	tierLabel,
	umasByStars,
} from "../../utils/pvpGuide"
import type {
	DeckChange,
} from "../../utils/pvpGuide"
import type {
	PvpDeck,
	PvpDeckSlot,
	PvpGuide,
	PvpSkillCategory,
	PvpSkillRecommendation,
	PvpStyle,
	PvpStyleTab,
} from "../../types/pvpGuide"


// Module scope, so MarkdownContent's memoised components keep one identity.
const renderSkill = (name: string, { scenarioLink }: { scenarioLink: boolean }) => (
	<SkillMention name={name} scenarioLink={scenarioLink} />
)

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

// A tier badge's weight: the first tier in brand, fading to grey by the last.
function tierBadgeClass(tier: number): string {
	if (tier === 0) return "border-brand/50 text-brand"
	if (tier <= 2) return "border-gray-600 text-gray-300"
	return "border-gray-700 text-gray-500"
}

/**
 * Skill rows split by type, as the guide has always shown them (Henry,
 * 2026-10-23: "I don't want them to be combined"), each type's tiers a row:
 * the tier badge in a column of its own, then the skills as same-size cells
 * in a grid (SkillCell). A long tier wraps under its own badge; before, the
 * wrapped chips sat on a line with no badge and read as untiered. Untiered
 * skills (greens, every sheet-era guide) are the grid with no badge column.
 *
 * Cells are at least 9.5rem wide, 13rem once the list has 32rem to itself:
 * two columns in the side column and on a phone, three or four in a style
 * pane. A container query, because the side column is narrow at every
 * viewport width that shows it beside the style.
 */
function SkillCategories({ rows }: { rows: PvpSkillRecommendation[] }) {
	return (
		<div className="@container mt-2 flex flex-col gap-3">
			{byCategory(rows).map(([category, list]) => (
				<div key={category}>
					<h5 className="text-xs font-semibold uppercase tracking-wide text-gray-400">{CATEGORY_LABELS[category]}</h5>
					<div className="mt-1.5 flex flex-col gap-1.5">
						{groupSkillsByTier(list).map((group, index) => (
							<div key={index} className={group.tier === null ? "" : "grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-1.5"}>
								{group.tier !== null && (
									<div className="flex h-10 items-center">
										<span className={`rounded border bg-gray-900 px-1.5 py-0.5 text-xs font-bold ${tierBadgeClass(group.tier)}`}>
											{tierLabel(group.tier)}
										</span>
									</div>
								)}
								<div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-1.5 @lg:grid-cols-[repeat(auto-fill,minmax(13rem,1fr))]">
									{group.skills.map((row) => (
										<SkillCell key={`${row.style}-${row.skill.id}-${row.order}`} skill={row.skill} note={row.note} />
									))}
								</div>
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

/** "Compared with Beginner: swaps in A and B for C." */
function changeLine(change: DeckChange): string {
	const added = listWords(change.added.map((card) => card.name))
	const removed = listWords(change.removed.map((card) => card.name))
	const what = added && removed ? `swaps in ${added} for ${removed}` : added ? `adds ${added}` : removed ? `drops ${removed}` : "the same cards"
	return `Compared with ${change.previous}: ${what}.`
}

/**
 * A deck's six slots. Alternatives stack under their slot as an "or"; an
 * "or any Wit" (on the card's own note or a note-only alternative) is one line
 * with the stat icon. `showLabel`: the deck's label pill, left out when the
 * budget control above already names the one deck on screen. `change`: what it
 * changes from the deck before it in the ladder.
 */
function DeckGrid({ deck, showLabel, change, scenarioName }: {
	deck: PvpDeck
	showLabel: boolean
	change: DeckChange | undefined
	scenarioName: string | null
}) {
	const slots = new Map<number, PvpDeckSlot[]>()
	for (const row of deck.slots) slots.set(row.slot, [...(slots.get(row.slot) ?? []), row])
	return (
		<div className="pt-3">
			{(showLabel || deck.note) && (
				<div className="flex flex-wrap items-baseline gap-2">
					{showLabel && (
						<span className="rounded-full border border-brand/50 bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
							{deck.label}
						</span>
					)}
					{deck.note && <InlineNote text={deck.note.replace(/==/g, "")} className="text-xs text-gray-400" />}
				</div>
			)}
			{change && <p className="mt-1.5 text-[13px] leading-snug text-gray-400">{changeLine(change)}</p>}
			{/* Rows sit 1rem apart, and the grid 1rem below the label: room for the
			    borrow tab, which peeks out above its card. Six a row only when the
			    pane has room (a container query on StylePane): a style's box on the
			    All tab is half the width, where six cards were about 55px and their
			    notes ran into each other (2026-10-23). */}
			<div className="mt-4 grid max-w-3xl grid-cols-3 gap-x-2 gap-y-4 @2xl:grid-cols-6">
				{[1, 2, 3, 4, 5, 6].map((number) => {
					const [main, ...alternates] = slots.get(number) ?? []
					// Every "or any <type>" in the slot, once: the card's own note may
					// say it, and so may a note-only alternative.
					const anyTypes = new Set<DeckStatType>()
					for (const row of [main, ...alternates]) {
						const type = row && (row === main || !row.support_card) ? parseSlotNote(row.note).anyType : null
						if (type) anyTypes.add(type)
					}
					const shownAlternates = alternates.filter((alt) => alt.support_card || !parseSlotNote(alt.note).anyType)
					return (
						<div key={number} className="flex min-w-0 flex-col gap-1">
							{main ? (
								main.support_card ? (
									<SupportTile card={main.support_card} note={main.note} borrow={main.is_borrow} scenarioName={scenarioName} />
								) : (
									<NoteOnlyTile note={main.note} borrow={main.is_borrow} />
								)
							) : (
								<div className="aspect-square w-full rounded-lg border border-dashed border-gray-700" aria-hidden="true" />
							)}
							{shownAlternates.map((alt, index) => (
								<AlternateCard key={index} card={alt.support_card} note={alt.note} />
							))}
							{[...anyTypes].map((type) => (
								<AnyTypeLine key={type} type={type} />
							))}
						</div>
					)
				})}
			</div>
		</div>
	)
}

/**
 * A deck the editor marks "Swap-ins" (`is_highlighted`; the guide's Honorable
 * Mentions): cards that can replace one in the decks above, each with its
 * reason. A row of smaller cards in a recessed panel, so it stands apart a
 * little without reading as the top pick (Henry, 2026-10-23: the gold box made
 * it look most recommended). `bg-gray-900` is a well on both theme families:
 * below the pane on the dark themes, the grey canvas under white cards on the
 * light ones.
 */
function SwapInRow({ deck, scenarioName }: { deck: PvpDeck; scenarioName: string | null }) {
	const rows = [...deck.slots].sort((a, b) => a.slot - b.slot || a.order - b.order)
	return (
		<section aria-label={deck.label || "Swap-ins"} className="mt-4 rounded-xl border border-gray-700 bg-gray-900 p-3">
			<div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
				{deck.label && <h5 className="text-sm font-semibold text-gray-200">{deck.label}</h5>}
				{deck.note && <InlineNote text={deck.note.replace(/==/g, "")} className="text-xs text-gray-400" />}
			</div>
			<div className="mt-3 flex flex-wrap gap-x-2.5 gap-y-3">
				{rows.map((row, index) =>
					row.support_card ? (
						<SwapInCard key={index} card={row.support_card} note={row.note} scenarioName={scenarioName} />
					) : (
						<div key={index} className="flex w-[6.5rem] items-center justify-center rounded-lg border border-dashed border-gray-600 p-1 text-center text-[11px] text-gray-300">
							<InlineNote text={row.note.replace(/==/g, "")} />
						</div>
					)
				)}
			</div>
		</section>
	)
}

/** The budget control's "every deck" choice. */
const ALL_DECKS = "All"

/**
 * A style's decks (owner, 2026-10-23): one at a time, picked by budget
 * (Beginner / Standard / Whale, whatever the guide calls them), or All, which
 * opens every deck; both ways animate the height. One pick for the whole page,
 * remembered per device (PvpGuideView owns it). Above the decks: the cards in
 * every one; in each deck after the first: what it changes from the one
 * before. Swap-in decks follow as their own rows. A style with one deck draws
 * it as before, no control.
 *
 * The height animates with Framer Motion; MotionConfig's reducedMotion="user"
 * stops transforms only, so a reader who asks for less motion gets no height
 * animation through useReducedMotion. Overflow is hidden only while a deck
 * moves, so the skills' hover details are not clipped once it has settled.
 */
function DeckLadder({ decks, style, budget, onBudget, scenarioName }: {
	decks: PvpDeck[]
	style: PvpStyle
	budget: string | null
	onBudget: (label: string) => void
	scenarioName: string | null
}) {
	const reduceMotion = useReducedMotion()
	const ladder = decks.filter((deck) => !deck.is_highlighted)
	const swapIns = decks.filter((deck) => deck.is_highlighted)
	const showAll = budget === ALL_DECKS && ladder.length > 1
	const picked = ladder.find((deck) => deck.label === budget) ?? ladder[0]
	const shown = showAll ? ladder : picked ? [picked] : []
	const changes = deckChanges(ladder)
	const everyDeck = cardsInEveryDeck(ladder)
	const transition = { duration: reduceMotion ? 0 : 0.28, ease: "easeOut" as const }
	return (
		<div>
			<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
				<h4 className={SUBHEADING}>Example decks</h4>
				{ladder.length > 1 && (
					<div role="group" aria-label="Deck budget" className="inline-flex flex-wrap gap-0.5 rounded-lg border border-gray-700 bg-gray-900 p-0.5">
						{[...ladder.map((deck) => deck.label), ALL_DECKS].map((label, index) => {
							const pressed = label === ALL_DECKS ? showAll : !showAll && (label === picked?.label) && index === ladder.indexOf(picked)
							return (
								<button
									key={`${label}-${index}`}
									type="button"
									aria-pressed={pressed}
									onClick={() => onBudget(label)}
									className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
										pressed ? "bg-gray-700 text-brand" : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
									}`}
								>
									{label || "Untitled"}
								</button>
							)
						})}
					</div>
				)}
			</div>
			{everyDeck.length > 0 && (
				<p className="mt-2 text-[13px] leading-snug text-gray-400">
					<span className="font-semibold text-gray-200">In every {STYLE_LABELS[style]} deck:</span>{" "}
					{listWords(everyDeck.map((card) => card.name))}.
				</p>
			)}
			<AnimatePresence initial={false}>
				{shown.map((deck) => (
					<motion.div
						key={deck.id}
						initial={{ height: 0, opacity: 0, overflow: "hidden" }}
						animate={{ height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } }}
						exit={{ height: 0, opacity: 0, overflow: "hidden" }}
						transition={transition}
					>
						<DeckGrid
							deck={deck}
							showLabel={showAll || ladder.length === 1}
							change={showAll || deck !== ladder[0] ? changes.get(deck.id) : undefined}
							scenarioName={scenarioName}
						/>
					</motion.div>
				))}
			</AnimatePresence>
			{swapIns.map((deck) => (
				<SwapInRow key={deck.id} deck={deck} scenarioName={scenarioName} />
			))}
		</div>
	)
}

function StylePane({ guide, style, budget, onBudget }: {
	guide: PvpGuide
	style: PvpStyle
	budget: string | null
	onBudget: (label: string) => void
}) {
	const umas = guide.uma_recommendations.filter((row) => row.style === style)
	const note = guide.style_notes.find((row) => row.style === style)
	// The position's own picks; the general ones are in the side column.
	const skills = skillsForPosition(guide.skill_recommendations, style)
	const decks = guide.decks.filter((row) => row.style === style)
	// Every tile keeps a row for its note only when one of this style's umas
	// has a note: the tiles stay one size, without an empty band under each.
	const hasUmaNotes = umas.some((row) => row.note)
	return (
		<div className="@container flex flex-col gap-4">
			{umas.length > 0 && (
				<div>
					<h4 className={SUBHEADING}>Recommended umas</h4>
					{/* Grouped under their stars, so each tile can be the same size
					    without a stars row of its own. */}
					<div className="mt-2 flex flex-col gap-3">
						{umasByStars(umas).map((group) => (
							<div key={group.stars}>
								{group.stars > 0 && (
									<div className="mb-1.5 w-fit">
										<Stars count={group.stars} />
									</div>
								)}
								{/* At least 6.5rem a tile, sharing the row: three abreast on a
								    phone, where a fixed 7.5rem fitted only two. auto-fill, not
								    auto-fit, so a short row keeps its empty tracks and three tiles
								    in a wide pane stay tile-sized. (A definite max such as 7.5rem
								    would make auto-fill count columns by the max.) */}
								<div className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-2">
									{group.rows.map((row) => (
										<UmaTile
											key={row.uma.id}
											uma={row.uma}
											stars={row.stars}
											role={row.role}
											note={row.note}
											showStars={false}
											noteSlot={hasUmaNotes}
											className="w-full"
										/>
									))}
								</div>
							</div>
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
				<DeckLadder decks={decks} style={style} budget={budget} onBudget={onBudget} scenarioName={guide.scenario?.name ?? null} />
			)}
		</div>
	)
}

function tabLabel(tab: PvpStyleTab): string {
	return tab === ALL_STYLES_TAB ? ALL_STYLES_LABEL : STYLE_LABELS[tab]
}

/**
 * The running-style tabs, each with its place in the guide's ranking ("#1")
 * where the guide ranks it. The rank is `aria-hidden`: the tab's name stays
 * the style's, and the ranking itself is read out in the Overview.
 */
function StyleTabs({ styles, active, onChange, label, ranks }: {
	styles: PvpStyleTab[]
	active: PvpStyleTab
	onChange: (style: PvpStyleTab) => void
	label: string
	ranks: Map<PvpStyle, number>
}) {
	return (
		// Equal columns on a phone, so All and four ranked styles fit one line;
		// a wrapping row from sm.
		<div role="tablist" aria-label={label} className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl border border-gray-700 bg-gray-800/60 p-1 sm:flex sm:flex-wrap">
			{styles.map((style) => (
				<button
					key={style}
					type="button"
					role="tab"
					aria-selected={style === active}
					onClick={() => onChange(style)}
					className={`whitespace-nowrap rounded-lg border px-1 py-1.5 text-[13px] font-medium transition sm:px-3 sm:text-sm ${
						style === active
							? "border-brand/50 bg-brand/10 text-brand"
							: "border-transparent text-gray-400 hover:bg-gray-700/70 hover:text-gray-100"
					}`}
				>
					{style !== ALL_STYLES_TAB && (
						<span aria-hidden="true" className="mr-1.5 hidden h-2 w-2 rounded-full align-middle sm:inline-block" style={{ background: styleColor(style) }} />
					)}
					{tabLabel(style)}
					{style !== ALL_STYLES_TAB && ranks.has(style) && (
						<span aria-hidden="true" className={`ml-1 text-[10px] tabular-nums sm:ml-1.5 sm:text-[11px] ${style === active ? "text-brand/80" : "text-gray-500"}`}>
							#{ranks.get(style)}
						</span>
					)}
				</button>
			))}
		</div>
	)
}

function StyleColumn({ guide, styles, style, onStyleChange, budget, onBudget }: {
	guide: PvpGuide
	styles: Array<Exclude<PvpStyle, "everyone">>
	style: PvpStyleTab | null
	onStyleChange: (style: PvpStyleTab) => void
	budget: string | null
	onBudget: (label: string) => void
}) {
	// The page owns the pick (it is `?style=` in the URL, so a link can name
	// it). With none, or one the guide lacks (the pick is kept), the guide's
	// top-ranked style shows, else its first.
	const ranking = parseStyleRanking(guide.style_ranking)
	const shown = pickStyle(styles, style, ranking) ?? styles[0]
	return (
		<div className="flex min-w-0 flex-col gap-3">
			{/* Pinned under the View tabs while this style's column scrolls by
			    (Daptrius, 2026-10-22). The opaque strip behind the tabs' own
			    see-through box keeps the page from showing through it. */}
			<div className="sticky top-(--pvp-below-tabs,0px) z-10 -mt-1 bg-gray-900 pt-1">
				<StyleTabs styles={styleTabs(styles)} active={shown} onChange={onStyleChange} label="Running style" ranks={styleRanks(ranking)} />
			</div>
			{shown === ALL_STYLES_TAB ? (
				// Every style on one screen, the way the source sheet lays a guide
				// out (Henry, 2026-10-21): a box per style, two abreast from lg.
				// Two, not four: four columns left a deck's six cards about 50px
				// wide, too small to tell apart.
				<div role="tabpanel" aria-label={ALL_STYLES_LABEL} className="grid items-start gap-3 lg:grid-cols-2">
					{styles.map((each) => (
						<section key={each} className={SECTION} aria-label={STYLE_LABELS[each]}>
							{/* The style's name in its colour on the dark themes (.style-ink). */}
							<h3 className="style-ink mb-2 text-sm font-semibold uppercase tracking-wide" style={{ "--style-color": styleColor(each) } as CSSProperties}>
								{STYLE_LABELS[each]}
							</h3>
							<StylePane guide={guide} style={each} budget={budget} onBudget={onBudget} />
							{/* The thread lives on the style's own tab; here, its count
							    and the way there. */}
							<button
								type="button"
								onClick={() => onStyleChange(each)}
								className="mt-4 w-full border-t border-gray-700/70 pt-3 text-left text-sm font-semibold text-gray-300 transition hover:text-gray-100"
							>
								Comments ({guideCommentCount(guide, each)}) on the {STYLE_LABELS[each]} tab
							</button>
						</section>
					))}
				</div>
			) : (
				<div role="tabpanel" aria-label={STYLE_LABELS[shown]} className={SECTION}>
					<StylePane guide={guide} style={shown} budget={budget} onBudget={onBudget} />
					{/* Its own thread per style (Henry, 2026-10-21); keyed so a new
					    tab opens folded. */}
					<GuideComments
						key={shown}
						guide={guide}
						section={shown}
						placeholder={`Ask a question about ${STYLE_LABELS[shown]}, or share what worked`}
						className="mt-4 border-t border-gray-700/70 pt-3"
					/>
				</div>
			)}
		</div>
	)
}

/**
 * `style` is the running style asked for (the URL's, or the reader's last),
 * not necessarily one this guide has; `pickStyle` settles which tab shows.
 */
export function PvpGuideView({ guide, style, onStyleChange }: {
	guide: PvpGuide
	style: PvpStyleTab | null
	onStyleChange: (style: PvpStyleTab) => void
}) {
	const styles = stylesWithContent(guide)
	// General skills (style "everyone") are team-wide, like the stats, so
	// they get one section in the side column instead of a copy inside every
	// position's tab, where they read as its own picks.
	const generalSkills = skillsForPosition(guide.skill_recommendations, "everyone")
	const skillsPreview = useSkillsPreview()
	// One deck budget for the whole page (every style, the All tab), per
	// device. Read once at mount: the page renders only behind the /app gate.
	const [budget, setBudget] = useState<string | null>(recalledDeckBudget)
	const chooseBudget = (label: string) => {
		setBudget(label)
		rememberDeckBudget(label)
	}
	// Below xl the side column stacks above the style, and a guide's general
	// skills (21 in CM 21) were 866px of phone before the first uma
	// (2026-10-23), so there they start folded. Read once: the page renders
	// only behind the /app gate. "Narrow?" rather than "wide?", so a test's
	// no-match stub sees the desktop default.
	const [generalOpen] = useState(
		() => typeof window === "undefined" || typeof window.matchMedia !== "function" || !window.matchMedia("(max-width: 79.98rem)").matches
	)
	// The general skills (and the whole guide's thread) stand beside the style
	// from xl; the band above holds the rest of what is team-wide.
	const hasSide = generalSkills.length > 0
	// The tab on screen, the same pick StyleColumn makes, for the band's ladder.
	const shownStyle = pickStyle(styles, style, parseStyleRanking(guide.style_ranking))

	// The side column's height, for .pvp-side-sticky (App.css): pinned when it
	// fits on screen, scrolled with the page to its end when it doesn't.
	const sideRef = useRef<HTMLElement>(null)
	useEffect(() => {
		const side = sideRef.current
		// No ResizeObserver in jsdom; every browser the site supports has one.
		if (!side || typeof ResizeObserver === "undefined") return
		const observer = new ResizeObserver(() => side.style.setProperty("--pvp-side-h", `${side.offsetHeight}px`))
		observer.observe(side)
		return () => observer.disconnect()
	}, [hasSide])

	return (
		<SkillMentionsContext.Provider value={guide.skill_mentions ?? EMPTY_MENTIONS}>
		<div className="flex flex-col gap-4">
			{!guide.is_published && (
				<div className="flex items-center gap-2 rounded-lg border border-staging/60 bg-staging/10 px-3 py-2 text-sm font-semibold text-gray-100">
					<Eye className="h-4 w-4 shrink-0" />
					Draft, visible to staff only.
				</div>
			)}

			<GuideBand guide={guide} active={shownStyle} onStyleChange={onStyleChange} />

			<div
				className={
					hasSide && styles.length > 0
						? "grid items-start gap-4 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]"
						: "flex flex-col gap-4"
				}
			>
				{hasSide && (
					// Below xl the column follows the style: on a phone the general
					// skills (folded) and the whole guide's thread come after it.
					<aside ref={sideRef} className="pvp-side-sticky order-last flex min-w-0 flex-col gap-4 xl:order-none" aria-label="For every position">
						{generalSkills.length > 0 && (
							<section className={SECTION} aria-labelledby="pvp-general-skills">
								<details open={generalOpen} className="group/general">
									<summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
										<h3 id="pvp-general-skills" className={HEADING}>General skills</h3>
										<span className="ml-auto text-xs text-gray-400 xl:hidden">
											{generalSkills.length} {generalSkills.length === 1 ? "skill" : "skills"} · <span className="group-open/general:hidden">Show</span>
											<span className="hidden group-open/general:inline">Hide</span>
										</span>
									</summary>
									<p className="mt-1 text-xs text-gray-400">
										Recommended for every position.
										{/* The Skills page is shelved to guide editors (useSkillsPreview). */}
										{skillsPreview && (
											<>
												{" "}Look any skill up on the{" "}
												<Link to="/app/skills" className="text-brand transition hover:text-brand/75">Skills page</Link>.
											</>
										)}
									</p>
									<SkillCategories rows={generalSkills} />
								</details>
							</section>
						)}

						<div className={SECTION}>
							<GuideComments guide={guide} section="" placeholder={WHOLE_GUIDE_PROMPT} className="" />
						</div>
					</aside>
				)}

				{styles.length > 0 && (
					<StyleColumn guide={guide} styles={styles} style={style} onStyleChange={onStyleChange} budget={budget} onBudget={chooseBudget} />
				)}
			</div>
			{/* A guide with no side column still has a thread for the whole guide. */}
			{!hasSide && (
				<div className={SECTION}>
					<GuideComments guide={guide} section="" placeholder={WHOLE_GUIDE_PROMPT} className="" />
				</div>
			)}
		</div>
		</SkillMentionsContext.Provider>
	)
}

const EMPTY_MENTIONS = {}

// The whole guide's thread (section ""), in the side column.
const WHOLE_GUIDE_PROMPT = "Ask about this guide, or share what worked"
