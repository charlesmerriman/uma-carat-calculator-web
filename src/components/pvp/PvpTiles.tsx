/**
 * The small building blocks of a PvP guide: a tile for an uma or a support
 * card, a skill chip, and a one-line note that understands ==highlights==.
 *
 * Hover detail (an uma's note, a skill's description) uses the same three
 * triggers as the Timeline's FeaturedTileArt: hover, keyboard focus, and a tap
 * on touch screens. Written fresh here rather than shared, so the Timeline's
 * tile stays untouched by guide work.
 */

import { useId, useState, type ReactNode } from "react"
import { Star } from "lucide-react"
import { splitNoteText, type NotePiece } from "../../utils/remarkHighlight"
import { useSkillMentions } from "./skillMentionsContext"
import type { PvpSkillRef, PvpSupportCardRef, PvpUmaRef } from "../../types/pvpGuide"
import { GOLD_SKILL_RARITY } from "../../utils/pvpGuide"
import { JpOnlyTag, SkillDetail } from "./SkillDetail"
import { FramedUma } from "../FramedUma"
import { useOshiIds } from "../../hooks/useOshiIds"

function NotePieces({ pieces }: { pieces: NotePiece[] }) {
	return (
		<>
			{pieces.map((piece, index) =>
				piece.kind === "text" ? (
					<span key={index}>{piece.text}</span>
				) : piece.kind === "skill" ? (
					<SkillMention key={index} name={piece.name} scenarioLink={piece.scenarioLink} />
				) : (
					<mark key={index} className="bg-transparent font-semibold text-highlight">
						<NotePieces pieces={piece.pieces} />
					</mark>
				)
			)}
		</>
	)
}

/** A one-line note: `==words==` in red, `[[Skill name]]` as a skill, line breaks kept. */
export function InlineNote({ text, className = "" }: { text: string; className?: string }) {
	if (!text) return null
	return (
		<span className={`whitespace-pre-wrap ${className}`}>
			<NotePieces pieces={splitNoteText(text)} />
		</span>
	)
}

/**
 * A `[[Skill name]]` mention inside text: the skill's icon and name, with its
 * description on hover, focus or tap. Inline (a span), so it sits in a
 * sentence. A name the guide's map does not hold renders as plain text.
 *
 * Sized to the text it sits in, because it sits in very different lines: a
 * deck note is 11px at leading-tight (a 13.75px line) in a column about 120px
 * wide, a guide paragraph is 14px at leading-relaxed. `leading-none`, no
 * vertical padding and an icon of 1.1em keep the pill inside the shortest of
 * those lines; at a fixed 16px icon with padding it stood taller than a deck
 * note's line and crowded the card name above it. It may wrap (`max-w-full`,
 * no `nowrap`): a long name such as "Professor of Curvature" is wider than a
 * deck column, and unbreakable it ran into the next slot's note.
 *
 * `scenarioLink`: the guide wrote "& Scenario Link" after it (the parser
 * decides, utils/remarkHighlight.ts), so it gets a red ring to stand out
 * (Daptrius, 2026-10-17). A ring, not a border colour: a gold skill's
 * .skill-gold border would win over a border utility.
 */
export function SkillMention({ name, scenarioLink = false }: { name: string; scenarioLink?: boolean }) {
	const skill = useSkillMentions()[name.toLowerCase()]
	const detailId = useId()
	const [tapped, setTapped] = useState(false)
	if (!skill) return <>{name}</>
	const surface = skillSurface(skill, "border-gray-600 bg-gray-800 text-gray-100")
	const ring = scenarioLink ? "ring-2 ring-highlight" : ""
	return (
		<span
			role="group"
			aria-label={skill.name}
			aria-describedby={detailId}
			tabIndex={0}
			onPointerUp={(event) => {
				if (event.pointerType === "touch") setTapped((open) => !open)
			}}
			onBlur={() => setTapped(false)}
			className={`group relative inline-flex max-w-full items-center gap-1 rounded border pl-0.5 pr-1.5 align-middle text-[0.95em] font-medium leading-none outline-none focus-visible:ring-2 focus-visible:ring-brand ${surface} ${ring}`}
		>
			{skill.image ? (
				<img src={skill.image} alt="" className="h-[1.1em] w-[1.1em] shrink-0" loading="lazy" decoding="async" />
			) : (
				<span className="h-[1.1em] w-[1.1em] shrink-0 rounded-full bg-gray-700" aria-hidden="true" />
			)}
			{skill.name}
			<span
				id={detailId}
				role="tooltip"
				className={`pointer-events-none absolute left-0 top-full z-40 mt-1 w-72 max-w-[80vw] whitespace-normal rounded-lg border border-gray-600 bg-gray-900 p-2 text-left text-xs font-normal leading-snug text-gray-200 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none ${
					tapped ? "opacity-100" : "opacity-0"
				}`}
			>
				<SkillDetail skill={skill} />
			</span>
		</span>
	)
}

/**
 * Wraps a tile or chip whose extra detail shows on hover, focus or tap. With
 * no `detail` it renders the child plainly and is not focusable.
 */
function WithDetail({ label, detail, children, className = "", detailClassName = "w-64" }: {
	label: string
	detail: ReactNode
	children: ReactNode
	className?: string
	/** The detail box's width; a card's art wants a narrower box than text. */
	detailClassName?: string
}) {
	const detailId = useId()
	const [tapped, setTapped] = useState(false)
	if (!detail) return <div className={`relative ${className}`}>{children}</div>
	return (
		<div
			role="group"
			aria-label={label}
			aria-describedby={detailId}
			tabIndex={0}
			onPointerUp={(event) => {
				if (event.pointerType === "touch") setTapped((open) => !open)
			}}
			onBlur={() => setTapped(false)}
			className={`group relative outline-none focus-visible:ring-2 focus-visible:ring-brand ${className}`}
		>
			{children}
			{/* Always in the DOM so a screen reader gets it through
			    aria-describedby; faded in on hover, focus or tap. */}
			<div
				id={detailId}
				role="tooltip"
				className={`pointer-events-none absolute left-1/2 top-full z-40 mt-1 ${detailClassName} max-w-[80vw] -translate-x-1/2 rounded-lg border border-gray-600 bg-gray-900 p-2 text-left text-xs leading-snug text-gray-200 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none ${
					tapped ? "opacity-100" : "opacity-0"
				}`}
			>
				{detail}
			</div>
		</div>
	)
}

function TileArt({ src, alt }: { src: string | null; alt: string }) {
	return src ? (
		<img src={src} alt={alt} loading="lazy" decoding="async" className="block aspect-square h-auto w-full object-contain" />
	) : (
		// No art uploaded yet: an empty square. The name is already printed
		// under the tile, so the box does not repeat it.
		<div className="aspect-square w-full bg-gray-700" aria-hidden="true" />
	)
}

function Stars({ count }: { count: number }) {
	if (count <= 0) return null
	return (
		<span className="flex items-center justify-center gap-px text-highlight" aria-label={`${count} of 5 stars`}>
			{Array.from({ length: count }, (_, index) => (
				<Star key={index} className="h-3 w-3 fill-current" aria-hidden="true" />
			))}
		</span>
	)
}

/** A recommended uma: art, name, stars, an optional role tag, the note on hover. */
export function UmaTile({ uma, stars, role, note }: { uma: PvpUmaRef; stars: number; role: string; note: string }) {
	const oshiIds = useOshiIds()
	return (
		<WithDetail label={uma.name} detail={note ? <InlineNote text={note} /> : null} className="w-24 shrink-0 sm:w-28">
			<div className="overflow-hidden rounded-lg border border-gray-600 bg-gray-700">
				<div className="relative p-1.5">
					<FramedUma src={uma.portrait ?? uma.image} alt={uma.name} oshi={oshiIds.has(uma.id)} className="w-full" />
					{role && (
						<span className="absolute left-1 top-1 rounded border border-gray-600 bg-gray-800/95 px-1.5 py-0.5 text-[10px] font-semibold text-brand">
							{role}
						</span>
					)}
				</div>
				<div className="px-1 py-1 text-center">
					<Stars count={stars} />
					<div className="mt-0.5 truncate text-xs font-medium text-gray-100" title={uma.name}>
						{uma.name}
					</div>
				</div>
			</div>
		</WithDetail>
	)
}

/** A support card in a deck slot: art, name, the reason under it. */
export function SupportTile({ card, note, borrow = false }: { card: PvpSupportCardRef; note: string; borrow?: boolean }) {
	return (
		<div className="min-w-0">
			{/* A card's art bakes in its own border, so no box of ours round it:
			    only a slot with no art yet gets the grey square. The art (3:4) is
			    drawn full height in a square, centred, and the borrow tab wraps the
			    image itself, not the square, so it is as wide as the card. */}
			{card.image ? (
				<div className="flex aspect-square justify-center">
					<BorrowTab borrow={borrow} className="h-full">
						<img src={card.image} alt={card.name} loading="lazy" decoding="async" className="block h-full w-auto" />
					</BorrowTab>
				</div>
			) : (
				<BorrowTab borrow={borrow}>
					<div className="overflow-hidden rounded-lg border border-gray-600 bg-gray-700">
						<TileArt src={null} alt={card.name} />
					</div>
				</BorrowTab>
			)}
			<div className="mt-1 truncate text-center text-xs font-medium text-gray-100" title={card.name}>
				{card.name}
			</div>
			{note && (
				<div className="text-center text-[11px] leading-tight text-gray-400">
					<InlineNote text={note} />
				</div>
			)}
		</div>
	)
}

/**
 * A slot's alternative, under its main card: "or <name>" and its note. The
 * name shows the card's art on hover, focus or tap, so a reader can tell which
 * version of the card is meant (Henry, 2026-10-22: until cards get a page of
 * their own). A note-only alternative is just the note.
 *
 * The name sits on its own line and the note below it, each a block, so the
 * line can't ride up into the main card's note (Henry's phone showed it drawn
 * over a two-line skill mention above it).
 */
export function AlternateCard({ card, note }: { card: PvpSupportCardRef | null; note: string }) {
	return (
		<div className="text-center text-[11px] leading-tight text-gray-400">
			{card && (
				<div>
					or{" "}
					<WithDetail
						label={card.name}
						detail={
							<>
								<TileArt src={card.image} alt="" />
								<span className="mt-1 block text-center font-medium text-gray-100">{card.name}</span>
							</>
						}
						className="inline-block max-w-full cursor-pointer align-baseline"
						detailClassName="w-36"
					>
						<span className="text-gray-200 underline decoration-gray-500 decoration-dotted underline-offset-2">{card.name}</span>
					</WithDetail>
				</div>
			)}
			{note && (
				<div>
					<InlineNote text={note} />
				</div>
			)}
		</div>
	)
}

/** A slot with no card, only advice ("Any Wit", "or any speed"). */
export function NoteOnlyTile({ note, borrow = false }: { note: string; borrow?: boolean }) {
	return (
		<BorrowTab borrow={borrow}>
			<div className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-gray-600 bg-gray-800 p-1 text-center text-xs text-gray-300">
				<InlineNote text={note} />
			</div>
		</BorrowTab>
	)
}

/**
 * The borrowed card's marker: a grey tab behind the card, peeking out above
 * its top edge, like the game's "Friend" tag (Daptrius,
 * 2026-10-16). The card's own bottom edge stays free for the limit-break
 * diamonds.
 *
 * The tab can't live inside the tile: the art box clips its overflow, and the
 * note tile's own background would paint over a tab put behind it. So it wraps
 * the tile from outside. `isolate` opens a stacking context, which keeps the
 * tab's -z-10 behind the tile but in front of the page and panel underneath.
 * Grey tokens, not the brand gold, so it stays neutral on every theme.
 */
function BorrowTab({ borrow, className = "", children }: { borrow: boolean; className?: string; children: ReactNode }) {
	if (!borrow) return <>{children}</>
	return (
		<div className={`relative isolate ${className}`}>
			{/* As wide as the card (owner, 2026-10-23), showing 14px above it.
			    The rest (pb-2.5) runs behind the card, deeper than the card's
			    rounded corners, so the grey fills in behind those corners and
			    no square tab corner shows where the two meet. */}
			<span className="absolute inset-x-0 -top-3.5 -z-10 rounded-t-lg bg-gray-600 pb-2.5 pt-px text-center text-[10px] font-bold uppercase leading-3 tracking-wide text-gray-200">
				Borrow
			</span>
			{children}
		</div>
	)
}

// The game's skill rarities: 1 white, 2 gold, 3 to 6 the unique kinds. A gold
// skill is drawn the way the game draws it, on the gold gradient (.skill-gold
// in App.css). The rest take theme tokens, not stock palette classes, so the
// frame reads on light themes too: the step-up violet for uniques.
/** An evolved skill is drawn on the pink (.skill-evolved), whatever its rarity
 * says; otherwise `fallback`, the chip's or mention's own surface. */
function skillSurface(skill: { is_evolved: boolean }, fallback: string): string {
	return skill.is_evolved ? "skill-evolved" : fallback
}

function skillSurfaceClass(rarity: number): string {
	if (rarity === GOLD_SKILL_RARITY) return "skill-gold"
	if (rarity >= 3) return "border-step-up-border/70 bg-gray-800"
	return "border-gray-600 bg-gray-800"
}

/** A recommended skill: icon, name, whose unique it is, the full detail on hover. */
export function SkillChip({ skill, note }: { skill: PvpSkillRef; note: string }) {
	const detail = <SkillDetail skill={skill} note={note ? <InlineNote text={note} /> : undefined} />
	// On the gold the text is the gradient's own dark brown (.skill-gold), so
	// the grey text classes step aside and the note dims with opacity instead.
	const gold = skill.rarity === GOLD_SKILL_RARITY
	return (
		<WithDetail label={skill.name} detail={detail} detailClassName="w-72">
			{/* rounded-lg, not a capsule: the square icon's corners stuck out
			    through a capsule's round ends. The skills panel's rows and the
			    mention pill are rounded rectangles too. */}
			<div className={`flex max-w-full items-center gap-1.5 rounded-lg border py-0.5 pl-0.5 pr-2.5 ${skillSurface(skill, skillSurfaceClass(skill.rarity))}`}>
				{skill.image ? (
					<img src={skill.image} alt="" className="h-6 w-6 shrink-0" loading="lazy" decoding="async" />
				) : (
					<span className="h-6 w-6 shrink-0 rounded-full bg-gray-700" aria-hidden="true" />
				)}
				<span className={`truncate text-sm ${gold ? "font-medium" : "text-gray-100"}`}>
					{skill.name}
					{skill.unique_of && <span className="text-gray-400"> ({skill.unique_of})</span>}
				</span>
				{/* No ◎ badge for "has a gold version": the game prints ○/◎ in the
				    name itself, so a badge in the same glyph read as a version that
				    doesn't exist. The hover detail lists the other versions. */}
				{skill.availability === "jp" && <JpOnlyTag className="shrink-0 text-[10px]" />}
				{note && <InlineNote text={note} className={`hidden truncate text-xs sm:inline ${gold ? "opacity-80" : "text-gray-400"}`} />}
			</div>
		</WithDetail>
	)
}
