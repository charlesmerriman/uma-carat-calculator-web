/**
 * The small building blocks of a PvP guide: a tile for an uma or a support
 * card, a skill cell (and the editor's chip), and a one-line note that
 * understands ==highlights==.
 *
 * Hover detail (an uma's note, a skill's description) uses the same three
 * triggers as the Timeline's FeaturedTileArt: hover, keyboard focus, and a tap
 * on touch screens. Written fresh here rather than shared, so the Timeline's
 * tile stays untouched by guide work.
 */

import { useId, useState, type ReactNode } from "react"
import { Star } from "lucide-react"
import { plainNoteText, splitNoteText, type NotePiece } from "../../utils/remarkHighlight"
import { useSkillMentions } from "./skillMentionsContext"
import type { PvpSkillRef, PvpSupportCardRef, PvpUmaRef } from "../../types/pvpGuide"
import { GOLD_SKILL_RARITY } from "../../utils/pvpGuide"
import { JpOnlyTag, SkillDetail } from "./SkillDetail"
import { useSkillsPreview } from "../../hooks/useSkillsPreview"
import { FramedUma } from "../FramedUma"
import { useOshiIds } from "../../hooks/useOshiIds"
import { splitOutfit } from "../../utils/umaName"
import { parseSlotNote, rarityLabel, type DeckStatType } from "../../utils/deckNotes"

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

// Gold, the recommended token: red is the site's warning colour, and a star
// rating is no warning (guide-visuals-plan.md, 2026-10-23).
export function Stars({ count }: { count: number }) {
	if (count <= 0) return null
	return (
		<span className="flex items-center justify-center gap-px text-recommended" aria-label={`${count} of 5 stars`}>
			{Array.from({ length: count }, (_, index) => (
				<Star key={index} className="h-3 w-3 fill-current" aria-hidden="true" />
			))}
		</span>
	)
}

// The first [[skill]] a note names, if any.
const FIRST_MENTION = /\[\[([^[\]\n]+)\]\]/

/**
 * A recommended uma, every tile the same size and shape (Henry, 2026-10-23:
 * the tiles changed height with what each uma had). Fixed rows, top to bottom:
 * the framed portrait (a role tag, if any, on its corner), the stars if the
 * caller shows them, the name on up to two lines, the outfit on its own line
 * (left blank when there is none), then the note's slot: its first [[skill]]
 * as a small skill face, else the note's words on up to two lines, else
 * nothing. The whole note is on hover, focus or tap.
 *
 * The guide groups its tiles under a stars header, so it passes
 * `showStars={false}`; the editor and the New-cards list keep the stars on
 * the tile. The width is the caller's (`className`); the rows are fixed.
 */
export function UmaTile({ uma, stars, role, note, showStars = true, noteSlot = true, className = "w-[7.5rem] shrink-0" }: {
	uma: PvpUmaRef
	stars: number
	role: string
	note: string
	showStars?: boolean
	/** False when no tile beside this one has a note: the row is left out on all of them. */
	noteSlot?: boolean
	className?: string
}) {
	const oshiIds = useOshiIds()
	const mentions = useSkillMentions()
	const { base, outfit } = splitOutfit(uma.name)
	const mentioned = FIRST_MENTION.exec(note)?.[1]
	const skill = mentioned ? mentions[mentioned.trim().toLowerCase()] : undefined
	return (
		<WithDetail label={uma.name} detail={note ? <InlineNote text={note} /> : null} className={className}>
			<div className="flex flex-col gap-0.5 overflow-hidden rounded-lg border border-gray-600 bg-gray-700 p-1.5 text-center">
				<div className="relative">
					<FramedUma src={uma.portrait ?? uma.image} alt={uma.name} oshi={oshiIds.has(uma.id)} className="w-full" />
					{role && (
						<span className="absolute left-0.5 top-0.5 max-w-[calc(100%-0.25rem)] truncate rounded border border-gray-600 bg-gray-800/95 px-1.5 py-0.5 text-[10px] font-semibold text-brand">
							{role}
						</span>
					)}
				</div>
				{showStars && stars > 0 && (
					<div className="mt-0.5">
						<Stars count={stars} />
					</div>
				)}
				<div className="flex h-[1.875rem] items-center justify-center">
					<span className="line-clamp-2 text-xs font-semibold leading-[0.9375rem] text-gray-100" title={uma.name}>
						{base}
					</span>
				</div>
				<div className="h-[0.9375rem] truncate text-[11px] leading-[0.9375rem] text-gray-400">{outfit ?? "\u00a0"}</div>
				{noteSlot && (
					<div className="flex h-[2.125rem] items-center justify-center">
						{skill ? (
							<SkillFace skill={skill} size="small" />
						) : note ? (
							<span className="line-clamp-2 text-[11px] leading-tight text-gray-300">{plainNoteText(note)}</span>
						) : null}
					</div>
				)}
			</div>
		</WithDetail>
	)
}

/** The game's stat icons (public/0N_CM*.png), for the stats table and an "or any Wit card" line. */
const STAT_ICONS: Record<DeckStatType, { label: string; icon: string }> = {
	speed: { label: "Speed", icon: "/00_CMSPEED1.png" },
	stamina: { label: "Stamina", icon: "/01_CMStamina1.png" },
	power: { label: "Power", icon: "/02_CMPOWER1.png" },
	guts: { label: "Guts", icon: "/03_CMGUTS1.png" },
	wit: { label: "Wit", icon: "/04_CMWits1.png" },
}

/**
 * The scenario link mark: a small gold "Link" tag in the top-left corner of
 * the card's art (owner's pick from the mock, placed where Henry asked,
 * 2026-10-23), replacing the red ring on the skill (web #160). It names the
 * scenario on hover and to a screen reader, since the band that explains it
 * may not be on screen. The brand fill with black ink is the site's primary
 * pairing, which the light themes already remap.
 */
function LinkBadge({ scenarioName }: { scenarioName: string | null }) {
	const words = scenarioName ? `Linked to ${scenarioName}` : "Linked to the scenario"
	return (
		<span
			title={words}
			aria-label={words}
			className="absolute left-1 top-1 rounded bg-brand px-1 py-0.5 text-[9.5px] font-bold uppercase leading-none tracking-wide text-black shadow-md"
		>
			Link
		</span>
	)
}

/**
 * What a slot's note says, drawn (utils/deckNotes.ts): each skill as a small
 * same-size cell with its detail on hover, the fixed tags ("2SP", "Stats",
 * "Hints", "Initial Friendship") as pills, then any other words the guide
 * wrote. Nothing is red or bold (Henry, 2026-10-23). "Scenario Link" is the
 * card's Link badge and "or any Wit" a line of its own, so neither shows here.
 */
export function SlotReasons({ note }: { note: string }) {
	const mentions = useSkillMentions()
	const { skills, tags, rest } = parseSlotNote(note)
	if (skills.length === 0 && tags.length === 0 && !rest) return null
	return (
		<div className="flex w-full flex-col items-center gap-0.5">
			{skills.map((name, index) => {
				const skill = mentions[name.toLowerCase()]
				return skill ? (
					<SkillCell key={index} skill={skill} note="" size="small" />
				) : (
					<div key={index} className="flex h-[2.125rem] w-full items-center justify-center rounded border border-gray-600 bg-gray-800 px-1 text-[11px] leading-tight text-gray-100">
						<span className="line-clamp-2">{name}</span>
					</div>
				)
			})}
			{tags.length > 0 && (
				<div className="flex flex-wrap justify-center gap-0.5">
					{tags.map((tag) => (
						<span key={tag} className="rounded-full bg-gray-700 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-gray-200">
							{tag}
						</span>
					))}
				</div>
			)}
			{rest && (
				<div className="text-center text-[11px] leading-tight text-gray-400">
					<InlineNote text={rest} />
				</div>
			)}
		</div>
	)
}

/** "or any [Wit icon] Wit card": any card of the type will do instead. */
export function AnyTypeLine({ type }: { type: DeckStatType }) {
	const { label, icon } = STAT_ICONS[type]
	return (
		<div className="flex items-center justify-center gap-1 text-[11px] leading-tight text-gray-400">
			or any <img src={icon} alt="" className="h-3.5 w-3.5" /> {label} card
		</div>
	)
}

/**
 * A support card in a deck slot: art (with the Link badge when the note says
 * "Scenario Link"), name, then the note's reasons (SlotReasons). `scenarioName`
 * is the guide's scenario, for the badge's words.
 */
export function SupportTile({ card, note, borrow = false, scenarioName = null }: {
	card: PvpSupportCardRef
	note: string
	borrow?: boolean
	scenarioName?: string | null
}) {
	const linked = parseSlotNote(note).scenarioLink
	return (
		<div className="flex min-w-0 flex-col items-center gap-1">
			{/* A card's art bakes in its own border, so no box of ours round it:
			    only a slot with no art yet gets the grey square. The art (3:4) is
			    drawn full height in a square, centred, and the borrow tab wraps the
			    image itself, not the square, so it is as wide as the card. */}
			{card.image ? (
				<div className="flex aspect-square w-full justify-center">
					<BorrowTab borrow={borrow} className="h-full">
						<span className="relative block h-full">
							<img src={card.image} alt={card.name} loading="lazy" decoding="async" className="block h-full w-auto" />
							{linked && <LinkBadge scenarioName={scenarioName} />}
						</span>
					</BorrowTab>
				</div>
			) : (
				<BorrowTab borrow={borrow} className="w-full">
					<div className="relative overflow-hidden rounded-lg border border-gray-600 bg-gray-700">
						<TileArt src={null} alt={card.name} />
						{linked && <LinkBadge scenarioName={scenarioName} />}
					</div>
				</BorrowTab>
			)}
			<div className="w-full truncate text-center text-xs font-medium text-gray-100" title={card.name}>
				{card.name}
				{rarityLabel(card.rarity) && <span className="ml-1 text-gray-400">{rarityLabel(card.rarity)}</span>}
			</div>
			<SlotReasons note={note} />
		</div>
	)
}

/**
 * One card of a swap-in row (a deck the editor marks "Swap-ins", the guide's
 * Honorable Mentions): smaller art, the name, the reasons. No slot, no borrow.
 */
export function SwapInCard({ card, note, scenarioName }: { card: PvpSupportCardRef; note: string; scenarioName: string | null }) {
	const linked = parseSlotNote(note).scenarioLink
	return (
		<div className="flex w-[6.5rem] flex-col items-center gap-1 text-center">
			<span className="relative block w-16">
				{card.image ? (
					<img src={card.image} alt={card.name} loading="lazy" decoding="async" className="block h-auto w-full" />
				) : (
					<span className="block aspect-[3/4] w-full rounded-lg border border-gray-600 bg-gray-700" aria-hidden="true" />
				)}
				{linked && <LinkBadge scenarioName={scenarioName} />}
			</span>
			<span className="line-clamp-2 text-[11px] font-semibold leading-tight text-gray-100" title={card.name}>
				{card.name}
			</span>
			<SlotReasons note={note} />
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
					{rarityLabel(card.rarity) && <span className="text-gray-300"> {rarityLabel(card.rarity)}</span>}
				</div>
			)}
			{note && <SlotReasons note={note} />}
		</div>
	)
}

/** A slot with no card, only advice ("Any Wit"). Drawn plain: nothing on a card is red. */
export function NoteOnlyTile({ note, borrow = false }: { note: string; borrow?: boolean }) {
	return (
		<BorrowTab borrow={borrow}>
			<div className="flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-gray-600 bg-gray-800 p-1 text-center text-xs text-gray-300">
				<InlineNote text={note.replace(/==/g, "")} />
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

/**
 * One skill at one size (Henry, 2026-10-23, after Hakuraku's skill list): the
 * icon and the name, the name on up to two lines, or one line and a small
 * caption under it (the unique's owner, else the guide's note as plain words).
 * Every skill in a guide's lists is this cell, so a grid of them lines up
 * whatever the names' lengths. The gold, unique and evolved surfaces stay
 * (web #158).
 *
 * `SkillCell` is the cell with its hover detail; `SkillFace` is the face
 * alone, for inside something that already has a hover of its own (an uma
 * tile), where two popups would fight.
 */
export function SkillFace({ skill, sub = "", size = "regular" }: { skill: PvpSkillRef; sub?: string; size?: "regular" | "small" }) {
	const preview = useSkillsPreview()
	const gold = skill.rarity === GOLD_SKILL_RARITY
	const small = size === "small"
	return (
		<div
			className={`flex w-full min-w-0 items-center border text-left leading-tight ${skillSurface(skill, skillSurfaceClass(skill.rarity))} ${
				small ? "h-[2.125rem] gap-1 rounded py-0.5 pl-0.5 pr-1 text-[11px]" : "h-10 gap-2 rounded-md pl-1 pr-2 text-[13px]"
			}`}
		>
			{skill.image ? (
				<img src={skill.image} alt="" className={`shrink-0 ${small ? "h-4 w-4" : "h-6 w-6"}`} loading="lazy" decoding="async" />
			) : (
				<span className={`shrink-0 rounded-full bg-gray-700 ${small ? "h-4 w-4" : "h-6 w-6"}`} aria-hidden="true" />
			)}
			<span className="flex min-w-0 flex-1 flex-col">
				<span className={`${sub ? "line-clamp-1" : "line-clamp-2"} break-words ${gold ? "font-medium" : "text-gray-100"}`}>{skill.name}</span>
				{sub && <span className={`truncate text-[11px] ${gold ? "opacity-80" : "text-gray-400"}`}>{sub}</span>}
			</span>
			{preview && skill.availability === "jp" && <JpOnlyTag className="shrink-0 text-[10px]" />}
		</div>
	)
}

export function SkillCell({ skill, note, size = "regular" }: { skill: PvpSkillRef; note: string; size?: "regular" | "small" }) {
	const detail = <SkillDetail skill={skill} note={note ? <InlineNote text={note} /> : undefined} />
	// A small cell (under a deck card) has no room for a caption.
	const sub = size === "small" ? "" : skill.unique_of ? `(${skill.unique_of})` : note ? plainNoteText(note) : ""
	return (
		<WithDetail label={skill.name} detail={detail} className="w-full min-w-0" detailClassName="w-72">
			<SkillFace skill={skill} sub={sub} size={size} />
		</WithDetail>
	)
}

/** A recommended skill: icon, name, whose unique it is, the full detail on hover. */
export function SkillChip({ skill, note }: { skill: PvpSkillRef; note: string }) {
	const preview = useSkillsPreview()
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
				{preview && skill.availability === "jp" && <JpOnlyTag className="shrink-0 text-[10px]" />}
				{note && <InlineNote text={note} className={`hidden truncate text-xs sm:inline ${gold ? "opacity-80" : "text-gray-400"}`} />}
			</div>
		</WithDetail>
	)
}
