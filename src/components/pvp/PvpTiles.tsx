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
import { hasGoldVersion } from "../../utils/pvpGuide"
import type { PvpSkillRef, PvpSupportCardRef, PvpUmaRef } from "../../types/pvpGuide"
import { FramedUma } from "../FramedUma"
import { useOshiIds } from "../../hooks/useOshiIds"

function NotePieces({ pieces }: { pieces: NotePiece[] }) {
	return (
		<>
			{pieces.map((piece, index) =>
				piece.kind === "text" ? (
					<span key={index}>{piece.text}</span>
				) : piece.kind === "skill" ? (
					<SkillMention key={index} name={piece.name} />
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
 */
export function SkillMention({ name }: { name: string }) {
	const skill = useSkillMentions()[name.toLowerCase()]
	const detailId = useId()
	const [tapped, setTapped] = useState(false)
	if (!skill) return <>{name}</>
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
			className="group relative inline-flex items-center gap-1 whitespace-nowrap rounded border border-gray-600 bg-gray-800 py-px pl-0.5 pr-1.5 align-baseline text-[0.95em] font-medium text-gray-100 outline-none focus-visible:ring-2 focus-visible:ring-brand"
		>
			{skill.image ? (
				<img src={skill.image} alt="" className="h-4 w-4 shrink-0" loading="lazy" decoding="async" />
			) : (
				<span className="h-4 w-4 shrink-0 rounded-full bg-gray-700" aria-hidden="true" />
			)}
			{skill.name}
			<span
				id={detailId}
				role="tooltip"
				className={`pointer-events-none absolute left-0 top-full z-40 mt-1 w-64 max-w-[80vw] whitespace-normal rounded-lg border border-gray-600 bg-gray-900 p-2 text-left text-xs font-normal leading-snug text-gray-200 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none ${
					tapped ? "opacity-100" : "opacity-0"
				}`}
			>
				<span className="block font-semibold text-gray-100">
					{skill.name}
					{skill.unique_of && <span className="font-normal text-gray-400"> ({skill.unique_of})</span>}
				</span>
				{skill.description}
				<SkillVersions skill={skill} />
			</span>
		</span>
	)
}

/**
 * The other versions of a skill (white, gold, evolved) under its hover
 * detail: a guide names one version, and the rest are worth knowing about
 * because a card may teach the other one. Nothing when it has none.
 */
export function SkillVersions({ skill }: { skill: PvpSkillRef }) {
	if (skill.versions.length === 0) return null
	return (
		<span className="mt-1 block border-t border-gray-700/70 pt-1 text-gray-300">
			<span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500">
				Also as {skill.version ? `(this is the ${skill.version})` : ""}
			</span>
			{skill.versions.map((version) => (
				<span key={version.id} className="mt-0.5 flex items-start gap-1">
					{version.image ? (
						<img src={version.image} alt="" className="mt-px h-3.5 w-3.5 shrink-0" loading="lazy" decoding="async" />
					) : (
						<span className="mt-px h-3.5 w-3.5 shrink-0 rounded-full bg-gray-700" aria-hidden="true" />
					)}
					<span>
						<span className="font-medium text-gray-100">{version.name}</span>
						<span className="text-gray-400"> {version.version}</span>
						{version.description && <span className="block text-gray-400">{version.description}</span>}
					</span>
				</span>
			))}
		</span>
	)
}

/**
 * Wraps a tile or chip whose extra detail shows on hover, focus or tap. With
 * no `detail` it renders the child plainly and is not focusable.
 */
function WithDetail({ label, detail, children, className = "" }: {
	label: string
	detail: ReactNode
	children: ReactNode
	className?: string
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
				className={`pointer-events-none absolute left-1/2 top-full z-40 mt-1 w-64 max-w-[80vw] -translate-x-1/2 rounded-lg border border-gray-600 bg-gray-900 p-2 text-left text-xs leading-snug text-gray-200 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none ${
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
			<div className="relative overflow-hidden rounded-lg border border-gray-600 bg-gray-700">
				<TileArt src={card.image} alt={card.name} />
				{borrow && <BorrowRibbon />}
			</div>
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

/** A slot with no card, only advice ("Any Wit", "or any speed"). */
export function NoteOnlyTile({ note, borrow = false }: { note: string; borrow?: boolean }) {
	return (
		<div className="relative flex aspect-square w-full items-center justify-center rounded-lg border border-dashed border-gray-600 bg-gray-800 p-1 text-center text-xs text-gray-300">
			<InlineNote text={note} />
			{borrow && <BorrowRibbon />}
		</div>
	)
}

function BorrowRibbon() {
	return (
		<span className="absolute inset-x-0 bottom-0 bg-brand/90 py-0.5 text-center text-[10px] font-bold uppercase tracking-wide text-black">
			Borrow
		</span>
	)
}

// The game's skill rarities: 1 white, 2 gold, 3 to 6 the unique kinds. Theme
// tokens, not stock palette classes, so the frame reads on light themes too:
// the recommended gold for gold skills, the step-up violet for uniques.
function skillRarityClass(rarity: number): string {
	if (rarity === 2) return "border-recommended/70"
	if (rarity >= 3) return "border-step-up-border/70"
	return "border-gray-600"
}

/**
 * A recommended skill: icon, name, whose unique it is, the description on
 * hover. `general` marks a pick that applies to every position; it looks the
 * same, and says so in its hover detail.
 */
export function SkillChip({ skill, note, general = false }: { skill: PvpSkillRef; note: string; general?: boolean }) {
	const detail = (
		<>
			<span className="block font-semibold text-gray-100">{skill.name}</span>
			{skill.description}
			{general && <span className="mt-1 block text-gray-400">Recommended for every position.</span>}
			{note && (
				<span className="mt-1 block text-gray-300">
					<InlineNote text={note} />
				</span>
			)}
			<SkillVersions skill={skill} />
		</>
	)
	return (
		<WithDetail label={skill.name} detail={detail}>
			<div className={`flex max-w-full items-center gap-1.5 rounded-full border bg-gray-800 py-0.5 pl-0.5 pr-2.5 ${skillRarityClass(skill.rarity)}`}>
				{skill.image ? (
					<img src={skill.image} alt="" className="h-6 w-6 shrink-0" loading="lazy" decoding="async" />
				) : (
					<span className="h-6 w-6 shrink-0 rounded-full bg-gray-700" aria-hidden="true" />
				)}
				<span className="truncate text-sm text-gray-100">
					{skill.name}
					{skill.unique_of && <span className="text-gray-400"> ({skill.unique_of})</span>}
				</span>
				{/* A white skill with a gold version: the ◎ says "there is a better one". */}
				{hasGoldVersion(skill) && (
					<span className="shrink-0 text-xs text-recommended" title="Has a gold version" aria-label="Has a gold version">
						◎
					</span>
				)}
				{note && <InlineNote text={note} className="hidden truncate text-xs text-gray-400 sm:inline" />}
			</div>
		</WithDetail>
	)
}
