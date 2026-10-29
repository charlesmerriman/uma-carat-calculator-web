import type { CSSProperties, ReactNode } from "react"
import { Award, Handshake } from "lucide-react"
import type { RaceEvent } from "../../../types"
import type { AptitudeKey, CatalogueSupportCard, CatalogueUma, MemberStyle, PvpNote, PvpNoteColor, PvpTeamMember } from "../../../types/pvpTeam"
import type { TrainedUma } from "../../../types/trainedUma"
import { aptitudeKeysForEvent, aptitudeLetter } from "../../../utils/courseAptitude"
import { CARD_TYPE_COLORS, CARD_TYPE_LABELS } from "../../../utils/cardTypes"
import { formatDate } from "../../../utils/dateFormat"
import { STYLE_LABELS, styleColor } from "../../../utils/pvpGuide"
import { splitEventName } from "../../../utils/pvpEvent"
import { PVP_BORROW_SLOT, PVP_TEAM_SIZE, memberAt } from "../../../utils/pvpTeams"
import { splitHighlights } from "../../../utils/remarkHighlight"
import { STRAIGHT_STYLES, STYLE_ON_STRAIGHT, courseTiles, splitUmaName, teamShape } from "../../../utils/teamPicture"
import { STAT_KEYS, STAT_LABELS } from "../../../utils/trainedUmas"
import { formatScore, gradeLabel } from "../../../utils/veteranGrade"
import { Avatar } from "../../account/Avatar"
import { FramedUma } from "../../FramedUma"
import { Wordmark } from "../../Wordmark"
import { FavoriteHeart } from "../TeamGrid"

/**
 * A PvP team as a picture, made to be posted (notes/team-picture-plan.md; the
 * owner picked the lineup, mock notes/team-picture/mocks/07).
 *
 * The pull plan's poster (PlanPicture) is its sibling: the same 960px frame
 * drawn at 2x, the theme's own glow, the racecourse in the corner, a headline
 * that says whose it is and a row of headline tiles, which here are the race
 * (course, distance, surface, weather) rather than totals.
 *
 * Then it is its own thing: the three umas stand side by side like a sports
 * lineup, so the picture reads as a team before anyone reads a word. Above
 * them the team shape strip puts each one on a straight of the course where
 * her style runs, under "2 Pace + 1 End", the way the guides write a comp.
 * Each column has her portrait, her letters for THIS race, her veteran (only
 * when the player ticks the box) and her deck.
 *
 * The event's own art, when it has some, sits behind the top, heavily faded
 * and fading out to the south (`.share-picture-art`), and the theme's glow is
 * painted over it. The tiles and the strip go a little see-through so the
 * art reads behind them; the columns stay solid.
 *
 * Draws only; the caller picks the team, the options and the account's
 * veterans. Every colour is a theme token, drawn while mounted in the page.
 */
export function TeamPicture({ event, members, teamName, notes, umasById, cardsById, isFavorite, veterans, ownerName, ownerPicture, now }: {
	event: RaceEvent
	members: PvpTeamMember[]
	/** The name the player gave the team, or null for an unnamed one ("Team 1" on the bar). */
	teamName: string | null
	/** The team's notes, or [] to leave them off ("Show notes" unticked). */
	notes: PvpNote[]
	umasById: ReadonlyMap<number, CatalogueUma>
	cardsById: ReadonlyMap<number, CatalogueSupportCard>
	/** The player's favorites, framed in the rainbow. */
	isFavorite: (umaId: number) => boolean
	/** The account's veterans when "Show my veterans" is ticked, else null: no
	 *  veteran block, and every uma shows her base letters. */
	veterans: TrainedUma[] | null
	/** Shown only when the player ticks the box; null reads "My ... team". */
	ownerName: string | null
	/** The account's picture (its first favorite uma), under the same box. */
	ownerPicture: string | null
	now: Date
}) {
	const { kicker, title } = splitEventName(event)
	const tiles = courseTiles(event)
	const art = event.image
	// See-through over the art, so it reads behind the tiles; solid without it.
	const fill = art ? "bg-[color-mix(in_srgb,var(--card-fill)_78%,transparent)]" : "bg-(--card-fill)"
	const dates = `${formatDate(event.start_date)} to ${formatDate(event.end_date)}`
	const positions = Array.from({ length: PVP_TEAM_SIZE }, (_, position) => position)

	return (
		<div className={`share-picture ${art ? "share-picture--art" : ""} relative w-[960px] overflow-hidden text-gray-100`}>
			{art && (
				<>
					<img src={art} alt="" className="share-picture-art" />
					<div className="share-picture-glow" />
				</>
			)}
			{/* A racecourse rail in the corner, in the theme's accent: decoration only. */}
			<div className="share-picture-track" />

			<header className="relative px-10 pt-9">
				<div className="flex items-start justify-between gap-8">
					<div className="flex min-w-0 items-center gap-4">
						{ownerPicture && <Avatar src={ownerPicture} size="lg" oshi />}
						<div className="min-w-0">
							{kicker && <p className="text-[13px] font-bold tracking-[0.12em] text-brand uppercase">{kicker}</p>}
							<h2 className="font-display mt-1.5 text-[2.375rem] leading-[1.08] font-bold tracking-tight text-gray-50">
								{ownerName ? `${ownerName}'s ${title} team` : `My ${title} team`}
							</h2>
							<p className="mt-2 text-[15px] text-gray-300">{teamName ? `${teamName} · ${dates}` : dates}</p>
						</div>
					</div>
					<Wordmark size="card" />
				</div>

				{tiles.length > 0 && (
					<div className="mt-6 flex gap-3">
						{tiles.map((tile) => (
							<div key={tile.label} className={`min-w-0 flex-1 rounded-xl border border-edge px-4 py-3 ${fill}`}>
								<p className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">{tile.label}</p>
								<p className="font-display mt-1.5 truncate text-[1.625rem] leading-none font-bold text-gray-50">{tile.value}</p>
								{tile.note && <p className="mt-1.5 truncate text-xs text-gray-400">{tile.note}</p>}
							</div>
						))}
					</div>
				)}
			</header>

			<ShapeStrip members={members} umasById={umasById} isFavorite={isFavorite} fill={fill} />

			<div className="relative mx-10 mt-4 grid grid-cols-3 gap-4">
				{positions.map((position) => {
					const member = memberAt(members, position)
					const uma = member ? umasById.get(member.uma) : undefined
					return member ? (
						<MemberColumn
							key={position}
							position={position}
							member={member}
							uma={uma}
							event={event}
							cardsById={cardsById}
							favorite={uma ? isFavorite(uma.id) : false}
							veteran={veterans?.find((candidate) => candidate.id === member.trained_uma) ?? null}
						/>
					) : (
						<OpenSpot key={position} position={position} />
					)
				})}
			</div>

			{notes.length > 0 && (
				<div className="relative mx-10 mt-5">
					<p className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Notes</p>
					<div className="mt-2 grid grid-cols-3 gap-2.5">
						{notes.map((note, index) => (
							<p key={index} className={`rounded-[10px] border-l-[3px] px-3 py-2.5 text-[13.5px] leading-snug whitespace-pre-line text-gray-100 ${NOTE_COLORS[note.color]}`}>
								{splitHighlights(note.text).map((piece, at) =>
									piece.highlighted ? (
										<span key={at} className="font-bold text-highlight">
											{piece.text}
										</span>
									) : (
										piece.text
									)
								)}
							</p>
						))}
					</div>
				</div>
			)}

			<footer className="relative mt-[26px] flex items-center justify-between gap-4 border-t border-edge px-10 py-[18px] text-sm">
				<p className="text-gray-300">
					Build your team at <span className="font-semibold text-brand">umacaratcalculator.com</span>
				</p>
				<p className="text-gray-400">As of {formatDate(now.toISOString())}</p>
			</footer>
		</div>
	)
}

/** TeamNotes' colours (literal strings, so Tailwind sees each one). */
const NOTE_COLORS: Record<PvpNoteColor, string> = {
	yellow: "bg-note-yellow border-note-yellow-edge",
	pink: "bg-note-pink border-note-pink-edge",
	blue: "bg-note-blue border-note-blue-edge",
	green: "bg-note-green border-note-green-edge",
}

/** A style's colour, as the variable `.style-ink` and the fills read. */
function styleVars(style: MemberStyle): CSSProperties {
	return { "--style-color": styleColor(style) } as CSSProperties
}

/** The numbered badge that ties a column to its face on the strip. */
function Gate({ position, className, children }: { position: number; className: string; children?: ReactNode }) {
	return (
		<span className={`absolute z-10 flex items-center justify-center rounded-full bg-brand font-extrabold text-black ${className}`}>
			{children ?? position + 1}
		</span>
	)
}

/**
 * One straight of the course, the goal on the right, with each uma's face
 * where her style runs (STYLE_ON_STRAIGHT) and the team's shape beside it.
 * Two of one style stand side by side; the clamp keeps a face inside the
 * rails at either end.
 */
function ShapeStrip({ members, umasById, isFavorite, fill }: {
	members: PvpTeamMember[]
	umasById: ReadonlyMap<number, CatalogueUma>
	isFavorite: (umaId: number) => boolean
	fill: string
}) {
	if (members.length === 0) return null
	const placed = [...members].sort((a, b) => a.position - b.position)
	const used = new Set(placed.map((member) => member.style))
	return (
		<div className={`relative mx-10 mt-4 flex items-stretch gap-5 rounded-xl border border-edge py-3 pr-[18px] pl-4 ${fill}`}>
			<div className="flex w-[190px] shrink-0 flex-col justify-center">
				<p className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase">Team shape</p>
				<p className="font-display mt-1.5 text-[1.625rem] leading-none font-bold text-gray-50">{teamShape(placed)}</p>
				<p className="mt-1.5 text-xs text-gray-400">Where each one runs</p>
			</div>
			<div className="relative flex-1">
				<div className="relative mt-0.5 h-[62px] rounded-full border-2 border-brand/30 bg-brand/5">
					<div className="absolute inset-[7px] rounded-full border border-dashed border-brand/20" />
					<div
						className="absolute -top-1.5 -bottom-1.5 right-[34px] w-1 rounded-sm"
						style={{ backgroundImage: "repeating-linear-gradient(to bottom, var(--color-gray-50) 0 6px, var(--color-gray-900) 6px 12px)" }}
					/>
					{placed.map((member) => {
						const same = placed.filter((other) => other.style === member.style)
						const offset = (same.indexOf(member) - (same.length - 1) / 2) * 54
						const uma = umasById.get(member.uma)
						return (
							<div
								key={member.position}
								className="absolute top-1/2 z-[1] w-12 -translate-x-1/2 -translate-y-1/2"
								style={{ left: `clamp(32px, calc(${STYLE_ON_STRAIGHT[member.style]}% + ${offset}px), calc(100% - 70px))` }}
							>
								<Gate position={member.position} className="-top-1.5 -left-1.5 h-[18px] w-[18px] text-[11px]" />
								<FramedUma src={uma?.portrait ?? uma?.image} oshi={uma ? isFavorite(uma.id) : false} className="w-full" />
							</div>
						)
					})}
				</div>
				<div className="relative mt-[5px] h-[18px] text-[10.5px] font-semibold tracking-wider whitespace-nowrap uppercase">
					{STRAIGHT_STYLES.map((style) => (
						<span
							key={style}
							className={`absolute -translate-x-1/2 ${used.has(style) ? "style-ink" : "text-gray-500"}`}
							style={{ ...styleVars(style), left: `${STYLE_ON_STRAIGHT[style]}%` }}
						>
							{STYLE_LABELS[style]}
						</span>
					))}
					<span className="absolute right-[36px] translate-x-1/2 text-gray-300">Goal</span>
				</div>
			</div>
		</div>
	)
}

/** The tone TeamGrid gives a letter: S and A in the accent, D and below red. */
function letterTone(value: number | null | undefined): string {
	return value == null ? "text-gray-500" : value >= 7 ? "text-brand" : value <= 4 ? "text-highlight" : "text-gray-200"
}

function MemberColumn({ position, member, uma, event, cardsById, favorite, veteran }: {
	position: number
	member: PvpTeamMember
	uma: CatalogueUma | undefined
	event: RaceEvent
	cardsById: ReadonlyMap<number, CatalogueSupportCard>
	favorite: boolean
	/** Her linked veteran, when the player shows veterans. */
	veteran: TrainedUma | null
}) {
	const { name, outfit } = splitUmaName(uma?.name ?? "Unknown uma")
	// Her veteran's letters once one is shown: inheritance may have fixed a D.
	// Letter by letter: a hand entry may leave one unknown (null), and then
	// the uma's own letter is the better answer than "?".
	const aptOf = (key: AptitudeKey) => veteran?.apt[key] ?? uma?.apt[key] ?? null
	const aptitudes = aptitudeKeysForEvent(event, member.style)
	const grade = veteran ? gradeLabel(veteran.rank_grade) : null
	const slots = [1, 2, 3, 4, 5, PVP_BORROW_SLOT].map((slot) => {
		const entry = member.cards.find((card) => card.slot === slot)
		return { slot, card: entry ? (cardsById.get(entry.support_card) ?? null) : null }
	})
	// "2 Speed, 1 Friend": the deck's types, in the order they first appear.
	const types = new Map<string, number>()
	for (const { card } of slots) if (card?.card_type) types.set(card.card_type, (types.get(card.card_type) ?? 0) + 1)

	return (
		<div className="flex flex-col gap-3 rounded-2xl border border-edge bg-(--card-fill) p-3.5 shadow-(--card-shadow)">
			<div className="relative">
				<Gate position={position} className="font-display -top-1.5 -left-1.5 h-[34px] w-[34px] text-lg shadow-[0_0_0_4px_var(--card-fill)]" />
				<FramedUma src={uma?.portrait ?? uma?.image} oshi={favorite} className="w-full" />
				{favorite && <FavoriteHeart className="absolute right-2 bottom-2" />}
			</div>

			<div className="flex min-h-12 items-start justify-between gap-2">
				<div className="min-w-0">
					<h3 className="font-display text-[21px] leading-[1.1] font-semibold text-gray-50">{name}</h3>
					{outfit && <p className="mt-[3px] text-[13.5px] text-gray-400">{outfit}</p>}
				</div>
				<span
					className="style-ink inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--style-color)_45%,transparent)] bg-[color-mix(in_srgb,var(--style-color)_12%,transparent)] py-1 pr-2.5 pl-2 text-xs font-bold tracking-wide uppercase"
					style={styleVars(member.style)}
				>
					<span className="h-[7px] w-[7px] rounded-full bg-(--style-color)" />
					{STYLE_LABELS[member.style]}
				</span>
			</div>

			{uma && aptitudes.length > 0 && (
				<div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${aptitudes.length}, minmax(0, 1fr))` }}>
					{aptitudes.map((aptitude) => (
						<div key={aptitude.key} className="rounded-lg border border-edge bg-gray-950/35 pt-1.5 pb-[5px] text-center">
							<p className="text-[10px] font-semibold tracking-wider text-gray-400 uppercase">{aptitude.label}</p>
							<p className={`font-display mt-0.5 text-[22px] leading-none font-bold ${letterTone(aptOf(aptitude.key))}`}>
								{aptitudeLetter(aptOf(aptitude.key)) ?? "?"}
							</p>
						</div>
					))}
				</div>
			)}

			{veteran && (
				<div className="rounded-[10px] border border-edge bg-brand/[0.06] px-2.5 pt-2 pb-2.5">
					<div className="flex items-center justify-between gap-2">
						<p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-gray-300 uppercase">
							<Award className="h-3.5 w-3.5" aria-hidden="true" />
							Veteran
						</p>
						{veteran.rank_score != null && (
							<p className="font-display text-[15px] font-bold text-gray-50 tabular-nums">
								{grade && <span className="mr-1 text-brand">{grade}</span>}
								{formatScore(veteran.rank_score)}
							</p>
						)}
					</div>
					<div className="mt-[7px] grid grid-cols-5 gap-[5px]">
						{STAT_KEYS.map((stat) => (
							<div key={stat} className="border-t-[3px] pt-1" style={{ borderColor: `var(--color-stat-${stat})` }}>
								<p className="text-[13px] leading-tight font-bold text-gray-50 tabular-nums">{veteran[stat].toLocaleString("en-US")}</p>
								<p className="truncate text-[9.5px] text-gray-400">{STAT_LABELS[stat]}</p>
							</div>
						))}
					</div>
				</div>
			)}

			<div className="mt-auto">
				{types.size > 0 && (
					<p className="mb-[7px] flex flex-wrap gap-x-2 text-[11px] text-gray-300">
						{[...types].map(([type, count]) => (
							<span key={type} className="inline-flex items-center gap-1 whitespace-nowrap">
								<span className="h-[7px] w-[7px] rounded-full" style={{ background: CARD_TYPE_COLORS[type] ?? "var(--color-gray-400)" }} />
								{count} {CARD_TYPE_LABELS[type] ?? type}
							</span>
						))}
					</p>
				)}
				<div className="grid grid-cols-3 gap-2">
					{slots.map(({ slot, card }) => (
						<div key={slot} className="min-w-0">
							{/* Square corners: a support card's frame is drawn into its art. */}
							<div className={`relative aspect-[3/4] ${card ? "bg-gray-700" : "border border-dashed border-gray-600 bg-gray-800/40"}`}>
								{card?.image && <img src={card.image} alt="" className="h-full w-full object-cover" />}
								{slot === PVP_BORROW_SLOT && card && (
									<span className="absolute right-[3px] bottom-[3px] flex h-5 w-5 items-center justify-center rounded-full bg-brand text-black">
										<Handshake className="h-3 w-3" aria-label="Borrowed" />
									</span>
								)}
							</div>
							<p className="mt-1 truncate text-center text-[10.5px] leading-tight text-gray-300">{card?.name ?? "–"}</p>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}

/** A spot with no uma yet: the column stays, so the numbers still match the strip. */
function OpenSpot({ position }: { position: number }) {
	return (
		<div className="relative flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-gray-600 text-[15px] text-gray-400">
			<Gate position={position} className="font-display top-2 left-2 h-[34px] w-[34px] text-lg" />
			Open spot
		</div>
	)
}
