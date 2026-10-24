/**
 * The guide's All tab: a quick preview of every style (owner, 2026-10-24,
 * `guide-visuals-plan-2.md` release B). One box per style, two abreast from
 * lg, in the guide's ranking order; in each, one line apiece:
 *
 *   Umas      the top six faces (stars, then the guide's order)
 *   Skills    the style's best tier, its first two cells
 *   <deck>    each deck of the ladder: its six cards as art
 *   <swap-in> each swap-in row: up to six cards
 *
 * A line with more than it shows ends in "+N", which opens the style's tab,
 * as does the box's header. Everything a style's own tab prints beyond that
 * (aptitude letters, roles, notes, the budget control, "Compared with…")
 * stays there; a face's or card's details are in its hover.
 *
 * Its own component, not StylePane with a compact switch: the two views
 * draw different things, and a flag threaded through every piece would put
 * an "if compact" in each of them. The tiles both use are shared (PvpTiles).
 *
 * Every line is the same seven-track grid (six cells and the "+N"), so faces,
 * cards and skills line up down a box, and a cell is at most 4rem.
 */

import type { CSSProperties, ReactNode } from "react"
import { ArrowRight, MessageSquare } from "lucide-react"
import { SECTION } from "./guideStyles"
import { AnyTypeLine, FaceTile, MiniCard, MiniNoteSlot, SkillCell } from "./PvpTiles"
import { guideCommentCount } from "../../services/guideComments"
import { noteOnlyType, parseSlotNote, rarityLabel, type DeckStatType } from "../../utils/deckNotes"
import { countLabel } from "../../utils/plural"
import {
	ALL_STYLES_LABEL,
	STYLE_LABELS,
	parseStyleRanking,
	styleColor,
	styleRanks,
	stylesByRank,
	tierLabel,
	topTierSkills,
	topUmas,
} from "../../utils/pvpGuide"
import type { PvpDeck, PvpDeckSlot, PvpGuide, PvpStyle } from "../../types/pvpGuide"

type ShownStyle = Exclude<PvpStyle, "everyone">

/** Six cells, then the "+N": the same tracks on every line, so they line up. */
const CELLS = 6
const LINE = "grid grid-cols-[repeat(6,minmax(0,4rem))_2rem] items-center gap-1.5"
// Two, not three: at three a cell was about 85px in a box two abreast, and
// "Victoria por plancha ☆" read "Victoria por…" (2026-10-24).
const SKILLS_SHOWN = 2

export function AllStylesPreview({ guide, styles, onStyleChange, scenarioName }: {
	guide: PvpGuide
	styles: ShownStyle[]
	onStyleChange: (style: ShownStyle) => void
	scenarioName: string | null
}) {
	const ranking = parseStyleRanking(guide.style_ranking)
	const ranks = styleRanks(ranking)
	return (
		// Stretched rows (a grid's default): two boxes side by side end level.
		<div role="tabpanel" aria-label={ALL_STYLES_LABEL} className="grid gap-3 lg:grid-cols-2">
			{stylesByRank(styles, ranking).map((style) => (
				<StylePreview
					key={style}
					guide={guide}
					style={style}
					rank={ranks.get(style) ?? null}
					onOpen={() => onStyleChange(style)}
					scenarioName={scenarioName}
				/>
			))}
		</div>
	)
}

function StylePreview({ guide, style, rank, onOpen, scenarioName }: {
	guide: PvpGuide
	style: ShownStyle
	rank: number | null
	onOpen: () => void
	scenarioName: string | null
}) {
	const label = STYLE_LABELS[style]
	const umas = topUmas(guide.uma_recommendations.filter((row) => row.style === style), CELLS)
	const skills = topTierSkills(guide.skill_recommendations, style)
	const decks = guide.decks.filter((deck) => deck.style === style)
	const ladder = decks.filter((deck) => !deck.is_highlighted)
	const swapIns = decks.filter((deck) => deck.is_highlighted)
	const comments = guideCommentCount(guide, style)
	const more = (count: number) => <MoreChip count={count} label={label} onOpen={onOpen} />
	return (
		<section className={SECTION} aria-label={label}>
			<div className="mb-3 flex items-center justify-between gap-2">
				{/* The style's name in its colour on the dark themes (.style-ink). */}
				<h3 className="style-ink text-sm font-semibold uppercase tracking-wide" style={{ "--style-color": styleColor(style) } as CSSProperties}>
					{rank !== null && <span className="mr-1.5 font-display text-xs text-gray-500">#{rank}</span>}
					{label}
				</h3>
				<button
					type="button"
					onClick={onOpen}
					aria-label={`Open ${label}, ${countLabel(comments, "comment")}`}
					className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-gray-400 transition hover:text-gray-100"
				>
					<MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
					{comments}
					<span className="text-gray-600" aria-hidden="true">·</span>
					Open {label}
					<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
				</button>
			</div>
			<dl className="flex flex-col gap-3">
				{umas.shown.length > 0 && (
					<Line label="Umas">
						<div className={LINE}>
							{umas.shown.map((row) => (
								<FaceTile key={row.uma.id} uma={row.uma} stars={row.stars} role={row.role} note={row.note} />
							))}
							{umas.more > 0 && <div className="col-start-7">{more(umas.more)}</div>}
						</div>
					</Line>
				)}
				{skills.skills.length > 0 && (
					<Line label="Skills">
						{/* The tier's badge, then its first cells (the badge stands in
						    for the line's first track pair). */}
						<div className="grid max-w-[28.25rem] grid-cols-[2.25rem_repeat(2,minmax(0,1fr))_2rem] items-center gap-1.5">
							{skills.tier !== null ? (
								<span className="w-fit rounded border border-brand/50 bg-gray-900 px-1.5 py-0.5 text-xs font-bold text-brand">{tierLabel(skills.tier)}</span>
							) : (
								<span aria-hidden="true" />
							)}
							{skills.skills.slice(0, SKILLS_SHOWN).map((row) => (
								<SkillCell key={`${row.skill.id}-${row.order}`} skill={row.skill} note={row.note} size="small" />
							))}
							{skills.skills.length > SKILLS_SHOWN && <div className="col-start-4">{more(skills.skills.length - SKILLS_SHOWN)}</div>}
						</div>
					</Line>
				)}
				{ladder.map((deck) => (
					<Line key={deck.id} label={deck.label || "Deck"} tabbed>
						<DeckLine deck={deck} scenarioName={scenarioName} />
					</Line>
				))}
				{swapIns.map((deck) => (
					<Line key={deck.id} label={deck.label || "Swap-ins"}>
						<SwapInLine deck={deck} scenarioName={scenarioName} more={more} />
					</Line>
				))}
			</dl>
		</section>
	)
}

/**
 * A label and its line: side by side from sm, the label above on a phone.
 * `tabbed`: a deck line, which keeps room above its cards for a borrow tab;
 * the label takes the same room, so it stays level with the cards.
 */
function Line({ label, tabbed = false, children }: { label: string; tabbed?: boolean; children: ReactNode }) {
	return (
		<div className="grid gap-1 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-center sm:gap-2">
			<dt className={`text-xs font-semibold leading-tight text-gray-400 ${tabbed ? "sm:pt-3.5" : ""}`}>{label}</dt>
			<dd className="min-w-0">{children}</dd>
		</div>
	)
}

/**
 * A deck's six slots as art. A slot's "or" (an alternative card, or "or any
 * Wit") joins the card's hover. A slot with no card is a dashed tile.
 * pt-3.5: room for a borrow tab, which peeks out above its card.
 */
function DeckLine({ deck, scenarioName }: { deck: PvpDeck; scenarioName: string | null }) {
	const slots = new Map<number, PvpDeckSlot[]>()
	for (const row of deck.slots) slots.set(row.slot, [...(slots.get(row.slot) ?? []), row])
	return (
		<div className={`${LINE} pt-3.5`}>
			{Array.from({ length: CELLS }, (_, index) => index + 1).map((number) => {
				const [main, ...alternates] = slots.get(number) ?? []
				if (!main) return <MiniNoteSlot key={number} note="" />
				if (!main.support_card) return <MiniNoteSlot key={number} note={main.note} borrow={main.is_borrow} />
				return (
					<MiniCard
						key={number}
						card={main.support_card}
						note={main.note}
						borrow={main.is_borrow}
						scenarioName={scenarioName}
						extra={<SlotOrs alternates={alternates} anyType={parseSlotNote(main.note).anyType} />}
					/>
				)
			})}
		</div>
	)
}

/** A slot's alternatives, as words for a card's hover: "or Light Hello R", "or any Wit card". */
function SlotOrs({ alternates, anyType }: { alternates: PvpDeckSlot[]; anyType: DeckStatType | null }) {
	const types = new Set<DeckStatType>(anyType ? [anyType] : [])
	const cards: string[] = []
	for (const alt of alternates) {
		if (alt.support_card) {
			const rarity = rarityLabel(alt.support_card.rarity)
			cards.push(rarity ? `${alt.support_card.name} ${rarity}` : alt.support_card.name)
		} else {
			const type = noteOnlyType(alt.note)
			if (type) types.add(type)
		}
	}
	if (cards.length === 0 && types.size === 0) return null
	return (
		<>
			{cards.map((name) => (
				<div key={name} className="text-[11px] text-gray-400">
					or <span className="text-gray-200">{name}</span>
				</div>
			))}
			{[...types].map((type) => (
				<AnyTypeLine key={type} type={type} />
			))}
		</>
	)
}

/** A swap-in row's first six cards, then "+N". */
function SwapInLine({ deck, scenarioName, more }: { deck: PvpDeck; scenarioName: string | null; more: (count: number) => ReactNode }) {
	const cards = [...deck.slots].sort((a, b) => a.slot - b.slot || a.order - b.order)
	return (
		<div className={LINE}>
			{cards.slice(0, CELLS).map((row, index) =>
				row.support_card ? (
					<MiniCard key={index} card={row.support_card} note={row.note} scenarioName={scenarioName} />
				) : (
					<MiniNoteSlot key={index} note={row.note} />
				)
			)}
			{cards.length > CELLS && <div className="col-start-7">{more(cards.length - CELLS)}</div>}
		</div>
	)
}

/** "+3": the rest of a line, on the style's own tab. */
function MoreChip({ count, label, onOpen }: { count: number; label: string; onOpen: () => void }) {
	return (
		<button
			type="button"
			onClick={onOpen}
			aria-label={`${count} more, open ${label}`}
			className="rounded-full border border-gray-600 bg-gray-800 px-1.5 py-0.5 text-xs font-semibold text-gray-300 transition hover:border-gray-500 hover:text-gray-100"
		>
			+{count}
		</button>
	)
}
