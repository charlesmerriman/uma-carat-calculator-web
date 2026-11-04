/**
 * The small building blocks of a PvP guide: a tile for an uma or a support
 * card, a skill cell (and the editor's chip), and a one-line note that
 * understands ==highlights==.
 *
 * Hover detail (an uma's note, a skill's description) uses the same three
 * triggers as the Timeline's FeaturedTileArt: hover, keyboard focus, and a tap
 * on touch screens. Written fresh here rather than shared, so the Timeline's
 * tile stays untouched by guide work. The popup is drawn on <body>
 * (useHoverPopup), and nothing inside a tile with a detail opens a detail of
 * its own (InsideHoverContext).
 */

import { createContext, useContext, useId, useState, type ReactNode } from "react"
import {
	autoUpdate,
	flip,
	FloatingPortal,
	offset,
	shift,
	useDismiss,
	useFloating,
	useFocus,
	useHover,
	useInteractions,
	useTransitionStyles,
	type Placement,
} from "@floating-ui/react"
import { useReducedMotion } from "framer-motion"
import { Star } from "lucide-react"
import { plainNoteText, splitNoteText, type NotePiece } from "../../utils/remarkHighlight"
import { useSkillMentions } from "./skillMentionsContext"
import type { PvpSkillRef, PvpSupportCardRef, PvpUmaRef } from "../../types/pvpGuide"
import { GOLD_SKILL_RARITY, type UmaAptitude } from "../../utils/pvpGuide"
import { JpOnlyTag, SkillDetail } from "./SkillDetail"
import { useSkillsPreview } from "../../hooks/useSkillsPreview"
import { FramedUma } from "../FramedUma"
import { FramedCard } from "../FramedCard"
import { useOshiIds } from "../../hooks/useOshiIds"
import { splitOutfit } from "../../utils/umaName"
import { DECK_STAT_LABELS, noteOnlyType, parseSlotNote, rarityLabel, type DeckStatType } from "../../utils/deckNotes"
import { clearCourseFocus, setCourseFocus } from "../../services/courseMapStore"
import CourseVerdict from "../course/CourseVerdict"

/**
 * A skill name with its trailing mark (○ ◎ × ☆ ♡) held to the word before it
 * by a no-break space, so a wrapped name never leaves the mark alone on the
 * last line ("Corner Acceleration / ○").
 */
function keepMarkWithName(name: string): string {
	return name.replace(/ (?=[○◎×☆♡]$)/u, "\u00a0")
}

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
 * True inside a tile or chip that has a hover detail (WithDetail), on its face
 * and in its detail alike. Tailwind's `group-hover:` answers to ANY hovered
 * `.group` above it, not the nearest, so a [[mention]] in a tile's note opened
 * its own popup the moment the tile was hovered, drawn over the tile's: two
 * at once for "Activate [[A]] with [[B]]" (2026-11-02). A mention on a chip's
 * face did the same. Inside one, a mention draws its pill alone, and the
 * detail lists what the note names at its bottom (MentionedSkills).
 */
const InsideHoverContext = createContext(false)

// How long the pointer rests on a tile before its popup opens, so a mouse
// crossing a grid of skills doesn't flash a popup per cell. Focus and a tap
// open it at once.
const HOVER_OPEN_DELAY_MS = 120

/**
 * The popup of a hover detail (WithDetail, SkillMention): opened by hover,
 * keyboard focus (`:focus-visible` only, as before) or a tap on a touch
 * screen, and drawn in a portal on <body> by Floating UI (2026-11-02).
 *
 * Why a portal: drawn inside its tile, a popup could rise only as high as the
 * tile's stacking context, and the guide makes several. The General skills
 * column is `position: sticky` and each deck cell is a framer-motion `layout`
 * box, so a popup from that column slid under the cards beside it (the
 * owner's "Perfect Spot!" screenshot). On <body> nothing covers it. Floating
 * UI also opens it above when there's no room below (`flip`), keeps it on
 * screen (`shift`) and follows the tile while the page scrolls (`autoUpdate`,
 * only while it's open).
 *
 * The popup is in the DOM only while open, so it is `aria-hidden`: the
 * screen reader's copy is the caller's `sr-only` element, always in the DOM
 * and named by `aria-describedby`, as the old in-place popup was.
 *
 * `onOpenChange` hears every open and close: a skill's card lights the skill
 * on the course map while it is open (notes/course-map-plan-2.md, section 8).
 */
function useHoverPopup(placement: Placement, onOpenChange?: (open: boolean) => void) {
	const [open, setOpenState] = useState(false)
	const setOpen = (next: boolean) => {
		setOpenState(next)
		onOpenChange?.(next)
	}
	const reducedMotion = useReducedMotion()
	const { refs, floatingStyles, context } = useFloating({
		open,
		onOpenChange: setOpen,
		placement,
		middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
		whileElementsMounted: autoUpdate,
	})
	const { getReferenceProps } = useInteractions([
		useHover(context, { mouseOnly: true, delay: { open: HOVER_OPEN_DELAY_MS } }),
		useFocus(context, { visibleOnly: true }),
		// Escape, or a tap anywhere else, closes it.
		useDismiss(context),
	])
	// A short fade in and out; none for a reader who asked for less motion.
	const { isMounted, styles } = useTransitionStyles(context, { duration: reducedMotion ? 0 : 150 })
	const referenceProps = {
		ref: refs.setReference,
		...getReferenceProps({
			// A touch screen has no hover, and a tap's focus isn't
			// :focus-visible, so a tap toggles it.
			onPointerUp(event) {
				if (event.pointerType === "touch") setOpen(!open)
			},
		}),
	}
	const popup = (content: ReactNode, widthClassName: string) =>
		isMounted && (
			<FloatingPortal>
				<div
					ref={refs.setFloating}
					aria-hidden="true"
					style={{ ...floatingStyles, ...styles }}
					className={`pointer-events-none z-50 max-w-[80vw] rounded-lg border border-gray-600 bg-gray-900 p-2 text-left text-xs leading-snug text-gray-200 shadow-lg ${widthClassName}`}
				>
					<InsideHoverContext.Provider value={true}>{content}</InsideHoverContext.Provider>
				</div>
			</FloatingPortal>
		)
	return { referenceProps, popup }
}

// The skills a note's pieces mention that the guide's map holds, each once,
// in the order the note names them. Walks into ==highlights==, which can hold
// a mention of their own.
function mentionedSkills(pieces: NotePiece[], mentions: Record<string, PvpSkillRef>, found = new Map<number, PvpSkillRef>()): PvpSkillRef[] {
	for (const piece of pieces) {
		if (piece.kind === "highlight") mentionedSkills(piece.pieces, mentions, found)
		else if (piece.kind === "skill") {
			const skill = mentions[piece.name.toLowerCase()]
			if (skill && !found.has(skill.id)) found.set(skill.id, skill)
		}
	}
	return [...found.values()]
}

/**
 * The skills a note mentions, listed at the bottom of the detail the note sits
 * in: icon, name, whose unique it is, the description. Inside a hover a
 * mention is a bare pill, so this is where the reader learns what it does (the
 * owner's pick, 2026-11-02: one box, never a popup on a popup). Under a rule,
 * each icon hanging; a skill's other versions (SkillDetail) take a bar down
 * the left instead, so the two lists read apart. `skip` leaves out the skill
 * the detail is already about, when a skill's note names itself.
 */
function MentionedSkills({ text, skip }: { text: string; skip?: number }) {
	const mentions = useSkillMentions()
	const skills = mentionedSkills(splitNoteText(text), mentions).filter((skill) => skill.id !== skip)
	if (skills.length === 0) return null
	return (
		<span className="mt-1 block border-t border-gray-700/70 pt-1 text-gray-300">
			{skills.map((skill) => (
				<span key={skill.id} className="mt-0.5 flex items-start gap-1">
					{skill.image ? (
						<img src={skill.image} alt="" className="mt-px h-3.5 w-3.5 shrink-0" loading="lazy" decoding="async" />
					) : (
						<span className="mt-px h-3.5 w-3.5 shrink-0 rounded-full bg-gray-700" aria-hidden="true" />
					)}
					<span>
						<span className="font-medium text-gray-100">{skill.name}</span>
						{skill.unique_of && <span className="text-gray-400"> ({skill.unique_of})</span>}
						{skill.description && <span className="block text-gray-400">{skill.description}</span>}
					</span>
				</span>
			))}
			{/* UmaTL's text is credited wherever it shows (.claude/rules/backend-models.md). */}
			{skills.some((skill) => skill.uses_translation) && (
				<span className="mt-1 block text-[0.9em] text-gray-500">English text: UmaTL fan translation.</span>
			)}
		</span>
	)
}

/**
 * A `[[Skill name]]` mention inside text: the skill's icon and name, with its
 * description on hover, focus or tap. Inline (a span), so it sits in a
 * sentence. A name the guide's map does not hold renders as plain text.
 * Inside a tile or chip with a detail of its own it is the pill alone
 * (InsideHoverContext).
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
	const insideHover = useContext(InsideHoverContext)
	const detailId = useId()
	const { referenceProps, popup } = useHoverPopup("bottom-start", (open) => skill && lightOnCourseMap(skill, open))
	if (!skill) return <>{name}</>
	const surface = skillSurface(skill, "border-gray-600 bg-gray-800 text-gray-100")
	const ring = scenarioLink ? "ring-2 ring-highlight" : ""
	const pill = `inline-flex max-w-full items-center gap-1 rounded border pl-0.5 pr-1.5 align-middle text-[0.95em] font-medium leading-none ${surface} ${ring}`
	const face = (
		<>
			{skill.image ? (
				<img src={skill.image} alt="" className="h-[1.1em] w-[1.1em] shrink-0" loading="lazy" decoding="async" />
			) : (
				<span className="h-[1.1em] w-[1.1em] shrink-0 rounded-full bg-gray-700" aria-hidden="true" />
			)}
			{keepMarkWithName(skill.name)}
		</>
	)
	// Not focusable either: there is nothing for focus to open.
	if (insideHover) return <span className={pill}>{face}</span>
	return (
		<span
			{...referenceProps}
			role="group"
			aria-label={skill.name}
			aria-describedby={detailId}
			tabIndex={0}
			className={`outline-none focus-visible:ring-2 focus-visible:ring-brand ${pill}`}
		>
			{face}
			<span id={detailId} role="tooltip" className="sr-only">
				<SkillDetail skill={skill} />
			</span>
			{popup(<><SkillDetail skill={skill} /><CourseVerdict skillId={skill.id} /></>, "w-72")}
		</span>
	)
}

/**
 * A skill's card lights it on the course map while it is open, and unlights
 * it on close unless something else lit another skill meanwhile
 * (notes/course-map-plan-2.md, section 8).
 */
function lightOnCourseMap(skill: PvpSkillRef, open: boolean) {
	if (open) setCourseFocus({ skillId: skill.id, name: skill.name, image: skill.image })
	else clearCourseFocus(skill.id)
}

/**
 * An uma's tile lights her unique while its detail is open, with her as its
 * owner on the verdict card (course-map-plan-2.md, "Left for later", 1; the
 * owner's yes, 2026-11-04). Her ref carries the unique (the guide payload).
 */
function lightUniqueOnCourseMap(uma: PvpUmaRef, open: boolean) {
	if (!uma.unique) return
	if (open) {
		setCourseFocus({
			skillId: uma.unique.id,
			name: uma.unique.name,
			image: uma.unique.image,
			owner: { name: uma.name, portrait: uma.portrait ?? uma.image, inherited: false },
		})
	} else {
		clearCourseFocus(uma.unique.id)
	}
}

/**
 * Wraps a tile or chip whose extra detail shows on hover, focus or tap. With
 * no `detail` it renders the child plainly and is not focusable.
 */
function WithDetail({ label, detail, children, className = "", detailClassName = "w-64", onOpenChange }: {
	label: string
	detail: ReactNode
	children: ReactNode
	className?: string
	/** The detail box's width; a card's art wants a narrower box than text. */
	detailClassName?: string
	/** Hears the detail open and close (a skill chip lights the course map). */
	onOpenChange?: (open: boolean) => void
}) {
	const detailId = useId()
	const { referenceProps, popup } = useHoverPopup("bottom", onOpenChange)
	if (!detail) return <div className={`relative ${className}`}>{children}</div>
	return (
		<div
			{...referenceProps}
			role="group"
			aria-label={label}
			aria-describedby={detailId}
			tabIndex={0}
			className={`relative outline-none focus-visible:ring-2 focus-visible:ring-brand ${className}`}
		>
			<InsideHoverContext.Provider value={true}>{children}</InsideHoverContext.Provider>
			{/* The screen reader's copy, always in the DOM; the popup
			    draws its own while open (useHoverPopup). */}
			<div id={detailId} role="tooltip" className="sr-only">
				<InsideHoverContext.Provider value={true}>{detail}</InsideHoverContext.Provider>
			</div>
			{popup(detail, detailClassName)}
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

// A weak letter in the warning colours: C amber, D and below red.
function aptitudeClass(value: number): string {
	if (value >= 7) return "text-gray-100"
	if (value === 6) return "text-gray-300"
	if (value === 5) return "text-staging"
	return "text-highlight"
}

/**
 * "Sprint A  Pace A", the letters bold and coloured by how good they are.
 * Each pair stays whole and the line wraps between pairs, never cuts: a tile
 * is about 90px inside on a phone and on the All tab, where "Medium A · Front
 * A", or a weak surface's third pair ("Turf E"), did not fit one line and lost
 * its last letter (2026-10-24). A gap, not a dot, between pairs, so a wrapped
 * line never starts with one. UmaTile keeps its neighbours level when this
 * wraps (the note slot is pinned to the bottom).
 */
function AptitudeLine({ aptitudes }: { aptitudes: UmaAptitude[] }) {
	const words = aptitudes.map((aptitude) => `${aptitude.label} ${aptitude.letter}`).join(", ")
	return (
		<div className="flex min-h-4 flex-wrap justify-center gap-x-2 text-[11px] leading-4 text-gray-400" title={words || undefined}>
			{aptitudes.map((aptitude) => (
				<span key={aptitude.label} className="whitespace-nowrap">
					{aptitude.label} <b className={`font-display font-semibold ${aptitudeClass(aptitude.value)}`}>{aptitude.letter}</b>
				</span>
			))}
		</div>
	)
}

// The first [[skill]] a note names, if any.
const FIRST_MENTION = /\[\[([^[\]\n]+)\]\]/

/**
 * A recommended uma, every tile the same size and shape (Henry, 2026-10-23:
 * the tiles changed height with what each uma had). Fixed rows, top to bottom:
 * the framed portrait (a role tag, if any, on its corner), the stars if the
 * caller shows them, the name on up to two lines, the outfit on its own line
 * (left blank when there is none), the course's aptitude letters (one line,
 * two when they do not fit), then the note's slot: its first [[skill]] as a
 * small skill face, else the note's words on up to two lines, else nothing.
 * The whole note is on hover, focus or tap.
 *
 * The guide groups its tiles under a stars header, so it passes
 * `showStars={false}`; the editor and the New-cards list keep the stars on
 * the tile. The width is the caller's (`className`); the rows are fixed.
 */
export function UmaTile({ uma, stars, role, note, showStars = true, noteSlot = true, aptitudes = null, className = "w-[7.5rem] shrink-0" }: {
	uma: PvpUmaRef
	stars: number
	role: string
	note: string
	showStars?: boolean
	/** False when no tile beside this one has a note: the row is left out on all of them. */
	noteSlot?: boolean
	/**
	 * This course's aptitude letters (guideUmaAptitudes). Null leaves the row
	 * out; an empty list keeps an empty row, so the tiles beside stay level.
	 */
	aptitudes?: UmaAptitude[] | null
	className?: string
}) {
	const oshiIds = useOshiIds()
	const mentions = useSkillMentions()
	const { base, outfit } = splitOutfit(uma.name)
	const mentioned = FIRST_MENTION.exec(note)?.[1]
	const skill = mentioned ? mentions[mentioned.trim().toLowerCase()] : undefined
	return (
		<WithDetail
			label={uma.name}
			// With no note, her unique's name is the detail: the hover that lights it needs one.
			detail={note
				? <><InlineNote text={note} /><MentionedSkills text={note} /></>
				: uma.unique ? <p className="text-xs text-gray-300">Unique: {uma.unique.name}</p> : null}
			className={className}
			onOpenChange={(open) => lightUniqueOnCourseMap(uma, open)}
		>
			{/* h-full: in a grid the tile fills its row, so when one tile's
			    letters wrap the others grow with it and every note slot, pinned
			    to the bottom (mt-auto), stays level. */}
			<div className="flex h-full flex-col gap-0.5 overflow-hidden rounded-lg border border-gray-600 bg-gray-700 p-1.5 text-center">
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
				{aptitudes && <AptitudeLine aptitudes={aptitudes} />}
				{noteSlot && (
					<div className="mt-auto flex h-[2.125rem] items-center justify-center">
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
	speed: { label: DECK_STAT_LABELS.speed, icon: "/00_CMSPEED1.png" },
	stamina: { label: DECK_STAT_LABELS.stamina, icon: "/01_CMStamina1.png" },
	power: { label: DECK_STAT_LABELS.power, icon: "/02_CMPOWER1.png" },
	guts: { label: DECK_STAT_LABELS.guts, icon: "/03_CMGUTS1.png" },
	wit: { label: DECK_STAT_LABELS.wit, icon: "/04_CMWits1.png" },
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
		// role="img" so a screen reader reads the label rather than skipping a
		// labelled span.
		<span
			role="img"
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
export function SlotReasons({ note, faces = false }: {
	note: string
	/** Bare skill faces with no hover of their own, for inside another hover (a card's on the All tab). */
	faces?: boolean
}) {
	const mentions = useSkillMentions()
	const { skills, tags, rest } = parseSlotNote(note)
	if (skills.length === 0 && tags.length === 0 && !rest) return null
	return (
		<div className="flex w-full flex-col items-center gap-0.5">
			{skills.map((name, index) => {
				const skill = mentions[name.toLowerCase()]
				return skill ? (
					faces ? <SkillFace key={index} skill={skill} size="small" /> : <SkillCell key={index} skill={skill} note="" size="small" />
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
		// Inline, not flex, so in a narrow phone column it wraps as one sentence.
		<div className="text-center text-[11px] leading-tight text-gray-400">
			or any <img src={icon} alt="" className="inline-block h-3.5 w-3.5 align-[-0.2em]" /> {label} card
		</div>
	)
}

/**
 * A support card in a deck slot: art (with the Link badge when the note says
 * "Scenario Link"), name, then the note's reasons (SlotReasons). `scenarioName`
 * is the guide's scenario, for the badge's words. `limitBreak` is the least the
 * guide recommends, drawn as the game's diamonds on the card.
 */
export function SupportTile({ card, note, borrow = false, scenarioName = null, limitBreak = null }: {
	card: PvpSupportCardRef
	note: string
	borrow?: boolean
	scenarioName?: string | null
	limitBreak?: number | null
}) {
	const linked = parseSlotNote(note).scenarioLink
	return (
		<div className="flex min-w-0 flex-col items-center gap-1">
			{/* The card is its own frame (FramedCard), so no box of ours round it:
			    only a slot with no art yet gets the grey square. The card (3:4) is
			    drawn full height in a square, centred, and the borrow tab wraps the
			    card itself, not the square, so it is as wide as the card. */}
			{card.image || card.image_borderless ? (
				<div className="flex aspect-square w-full justify-center">
					<BorrowTab borrow={borrow} className="h-full">
						<span className="relative block h-full">
							<FramedCard card={card} limitBreaks={limitBreak} alt={card.name} className="h-full" />
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
			{/* The name on up to two balanced lines, in a box two lines tall so
			    every card's reasons start level, like the uma tiles. One line
			    cut "Marvelous Sun…" on a phone (2026-10-24). The rarity rides
			    the last word (a no-break space), so it wraps with the name and
			    is never the part cut. */}
			<div className="flex h-8 w-full items-center justify-center text-xs font-medium leading-4" title={card.name}>
				<span className="line-clamp-2 text-balance text-center text-gray-100">
					{card.name}
					{rarityLabel(card.rarity) && <span className="text-gray-400">{" "}{rarityLabel(card.rarity)}</span>}
				</span>
			</div>
			<SlotReasons note={note} />
		</div>
	)
}

/**
 * One card of a swap-in row (a deck the editor marks "Swap-ins", the guide's
 * Honorable Mentions): smaller art, the name, the reasons. No slot, no borrow.
 */
export function SwapInCard({ card, note, scenarioName, limitBreak = null }: {
	card: PvpSupportCardRef
	note: string
	scenarioName: string | null
	limitBreak?: number | null
}) {
	const linked = parseSlotNote(note).scenarioLink
	return (
		<div className="flex min-w-0 flex-col items-center gap-1 text-center">
			<span className="relative block w-16">
				{card.image || card.image_borderless ? (
					<FramedCard card={card} limitBreaks={limitBreak} alt={card.name} className="w-full" />
				) : (
					<span className="block aspect-[3/4] w-full rounded-lg border border-gray-600 bg-gray-700" aria-hidden="true" />
				)}
				{linked && <LinkBadge scenarioName={scenarioName} />}
			</span>
			{/* Two lines' room for every name, balanced ("Sakura / Bakushin O",
			    never "Sakura Bakushin / O"), so the reasons in a row start level. */}
			<span className="flex h-7 w-full min-w-0 items-center justify-center">
				<span className="line-clamp-2 text-balance text-[11px] font-semibold leading-tight text-gray-100" title={card.name}>
					{card.name}
				</span>
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
								<FramedCard card={card} className="mx-auto w-3/4" />
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
 * The All tab's small pieces (owner, 2026-10-24: the All tab is a quick
 * preview of every style, `guide-visuals-plan-2.md`). Each is the picture
 * alone at the line's cell width; everything else a full tile prints (the
 * name, outfit, stars, role, notes) moves into its hover, focus or tap.
 */

/** An uma as her framed face, everything else in the hover. */
export function FaceTile({ uma, stars, role, note }: { uma: PvpUmaRef; stars: number; role: string; note: string }) {
	const oshiIds = useOshiIds()
	const { base, outfit } = splitOutfit(uma.name)
	const detail = (
		<div className="flex flex-col gap-1">
			<div>
				<div className="font-semibold text-gray-100">{base}</div>
				{outfit && <div className="text-gray-400">{outfit}</div>}
			</div>
			{stars > 0 && (
				<div className="w-fit">
					<Stars count={stars} />
				</div>
			)}
			{role && <div className="font-semibold text-brand">{role}</div>}
			{note && <InlineNote text={note} />}
			{note && <MentionedSkills text={note} />}
		</div>
	)
	return (
		<WithDetail label={uma.name} detail={detail} className="w-full" detailClassName="w-48">
			<FramedUma src={uma.portrait ?? uma.image} alt={uma.name} oshi={oshiIds.has(uma.id)} className="w-full" />
		</WithDetail>
	)
}

/**
 * A deck's card as its art alone: the Link badge and the borrow tab stay,
 * since they say something about the card itself; its name, rarity and the
 * slot's reasons (and any "or" the slot offers, `extra`) move to the hover.
 */
export function MiniCard({ card, note, borrow = false, scenarioName, extra = null, limitBreak = null }: {
	card: PvpSupportCardRef
	note: string
	borrow?: boolean
	scenarioName: string | null
	extra?: ReactNode
	limitBreak?: number | null
}) {
	const linked = parseSlotNote(note).scenarioLink
	const rarity = rarityLabel(card.rarity)
	const detail = (
		<div className="flex flex-col items-center gap-1 text-center">
			<div className="font-semibold text-gray-100">
				{card.name}
				{rarity && <span className="font-normal text-gray-400">{"\u00a0"}{rarity}</span>}
			</div>
			<SlotReasons note={note} faces />
			{extra}
		</div>
	)
	return (
		<WithDetail label={card.name} detail={detail} className="w-full" detailClassName="w-44">
			<BorrowTab borrow={borrow}>
				<span className="relative block">
					{card.image || card.image_borderless ? (
						<FramedCard card={card} limitBreaks={limitBreak} alt={card.name} className="w-full" />
					) : (
						<span className="block aspect-[3/4] w-full rounded-md border border-gray-600 bg-gray-700" aria-hidden="true" />
					)}
					{linked && <LinkBadge scenarioName={scenarioName} />}
				</span>
			</BorrowTab>
		</WithDetail>
	)
}

/**
 * A slot with no card, at a card's size: the stat icon for "Any Wit", else
 * the note's first words; the whole note in the hover. No note: an empty
 * dashed slot.
 */
export function MiniNoteSlot({ note, borrow = false }: { note: string; borrow?: boolean }) {
	const anyType = noteOnlyType(note)
	const box = (
		<BorrowTab borrow={borrow}>
			<span className="flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-md border border-dashed border-gray-600 bg-gray-800 p-0.5 text-center text-[10px] leading-tight text-gray-300">
				{anyType ? (
					<img src={STAT_ICONS[anyType].icon} alt={`Any ${STAT_ICONS[anyType].label}`} className="h-5 w-5" />
				) : (
					<span className="line-clamp-4 break-words">{plainNoteText(note)}</span>
				)}
			</span>
		</BorrowTab>
	)
	if (!note) return <span aria-hidden="true">{box}</span>
	return (
		<WithDetail label={plainNoteText(note)} detail={<><InlineNote text={note.replace(/==/g, "")} /><MentionedSkills text={note} /></>} className="w-full" detailClassName="w-40">
			{box}
		</WithDetail>
	)
}


/**
 * The borrowed card's marker: a grey tab behind the card, peeking out above
 * its top edge, like the game's "Friend" tag (Daptrius,
 * 2026-10-16). The card's own bottom edge stays free for the limit-break
 * diamonds.
 *
 * The part behind the card is a share of its height (12%), not a fixed
 * depth: FramedCard's corners grow with the card (about 6% of its height), so
 * a depth that covered them on a small card would leave a gap on a big one
 * (the canvas's version 5, owner 2026-11-02).
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
			    The rest (down to 12% of the card) runs behind the card, deeper
			    than its rounded corners, so the grey fills in behind those
			    corners and no square tab corner shows where the two meet. */}
			<span className="absolute inset-x-0 -top-3.5 bottom-[88%] -z-10 rounded-t-lg bg-gray-600 pt-px text-center text-[10px] font-bold uppercase leading-3 tracking-wide text-gray-200">
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
			{/* hyphens-auto (the page is lang="en"): a long word breaks as
			    "Concen-tration", never "Concentratio / n". */}
			{/* The name takes two lines when it needs them, and the caption
			    shows only while there is room under it: a column that wraps,
			    in a box the cell's height, so a caption that no longer fits
			    moves to a second column, outside the box, and is clipped. No
			    measuring, and no width rule: "Shooting Star of Dioskouroi" cut
			    to "Shooting Star of…" in a 13rem cell under the old 11rem one,
			    while a short name in a narrow cell lost its owner (2026-10-24).
			    The caption stays in the hover detail and for a screen reader. */}
			<span className="flex min-w-0 flex-1 flex-col flex-wrap content-start justify-center self-stretch overflow-hidden">
				<span className={`line-clamp-2 w-full hyphens-auto break-words ${gold ? "font-medium" : "text-gray-100"}`}>
					{keepMarkWithName(skill.name)}
				</span>
				{sub && <span className={`w-full truncate text-[11px] ${gold ? "opacity-80" : "text-gray-400"}`}>{sub}</span>}
			</span>
			{preview && skill.availability === "jp" && <JpOnlyTag className="shrink-0 text-[10px]" />}
		</div>
	)
}

export function SkillCell({ skill, note, size = "regular" }: { skill: PvpSkillRef; note: string; size?: "regular" | "small" }) {
	const detail = (
		<>
			<SkillDetail skill={skill} note={note ? <InlineNote text={note} /> : undefined} />
			<MentionedSkills text={note} skip={skill.id} />
		</>
	)
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
	const detail = (
		<>
			<SkillDetail skill={skill} note={note ? <InlineNote text={note} /> : undefined} />
			<MentionedSkills text={note} skip={skill.id} />
			<CourseVerdict skillId={skill.id} />
		</>
	)
	// On the gold the text is the gradient's own dark brown (.skill-gold), so
	// the grey text classes step aside and the note dims with opacity instead.
	const gold = skill.rarity === GOLD_SKILL_RARITY
	return (
		<WithDetail label={skill.name} detail={detail} detailClassName="w-72" onOpenChange={(open) => lightOnCourseMap(skill, open)}>
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
					{keepMarkWithName(skill.name)}
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
