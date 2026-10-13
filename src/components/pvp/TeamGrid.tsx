/**
 * A PvP team: three panels, one per uma, each holding her portrait, her five
 * support cards and the borrowed card (slot six), set apart by a divider.
 *
 * SCALES AS ONE PICTURE. Every tile keeps its art's shape (the portrait is
 * square, a support card 3:4, the game's 450x600 art) and the row is a fixed
 * set of fractional columns, so the same component fills the PvP page's My team view
 * and (R2b) the 26rem team drawer. Nothing in here measures the screen; card
 * names under the tiles drop out below `sm`, where they would not fit.
 *
 * It draws and reports clicks; it owns no state. The caller opens the picker
 * and applies the edit (components/pvp/TeamBuilder.tsx).
 */

import type { ReactNode } from "react"
import { ChevronDown, Handshake, Plus, Star, UserPlus, X } from "lucide-react"
import { STYLE_LABELS } from "../../utils/pvpGuide"
import { MEMBER_STYLES, PVP_BORROW_SLOT, PVP_TEAM_SIZE, memberAt } from "../../utils/pvpTeams"
import { aptitudeKeysForEvent, aptitudeLetter } from "../../utils/courseAptitude"
import type { RaceEvent } from "../../types"
import type { CatalogueSupportCard, CatalogueUma, MemberStyle, PvpTeamMember } from "../../types/pvpTeam"

interface TeamGridProps {
	members: PvpTeamMember[]
	umasById: Map<number, CatalogueUma>
	cardsById: Map<number, CatalogueSupportCard>
	/** The event's course, for each uma's aptitude letters. Omitted: no letters. */
	course?: Pick<RaceEvent, "surface_type" | "distance" | "length">
	/** Does the event's guide recommend this pick for this style? Draws a star. */
	isRecommended?: (pool: "uma" | "support", id: number, style: MemberStyle) => boolean
	onPickUma: (position: number) => void
	onPickCard: (position: number, slot: number) => void
	onStyleChange: (position: number, style: MemberStyle) => void
	onClearUma: (position: number) => void
	onClearCard: (position: number, slot: number) => void
}

const OWNED_SLOTS = [1, 2, 3, 4, 5]
const POSITIONS = Array.from({ length: PVP_TEAM_SIZE }, (_, index) => index)

/**
 * The portrait is a little wider than a card so it reads as the row's
 * subject, and at 1.35fr its square is as tall as a 1fr card at 3:4 (1.33),
 * so the row's tops and bottoms line up. The 2px column is the divider
 * before the borrowed card.
 */
const ROW_COLUMNS = "minmax(0,1.35fr) repeat(5,minmax(0,1fr)) 2px minmax(0,1fr)"

export function TeamGrid(props: TeamGridProps) {
	return (
		<div className="flex flex-col gap-3" aria-label="Your team">
			{POSITIONS.map((position) => (
				<MemberPanel key={position} position={position} {...props} />
			))}
		</div>
	)
}

function MemberPanel({
	position,
	members,
	umasById,
	cardsById,
	course,
	isRecommended,
	onPickUma,
	onPickCard,
	onStyleChange,
	onClearUma,
	onClearCard,
}: TeamGridProps & { position: number }) {
	const member = memberAt(members, position)
	const uma = member ? umasById.get(member.uma) : undefined
	const umaLabel = uma?.name ?? `uma ${position + 1}`
	const starred = (pool: "uma" | "support", id: number) =>
		member !== undefined && (isRecommended?.(pool, id, member.style) ?? false)

	const cardTile = (slot: number) => {
		const entry = member?.cards.find((card) => card.slot === slot)
		const card = entry ? cardsById.get(entry.support_card) : undefined
		const borrow = slot === PVP_BORROW_SLOT
		const slotName = borrow ? "Borrow" : `Card ${slot}`
		return (
			<Tile
				key={slot}
				art={entry ? (card?.image ?? null) : undefined}
				caption={entry ? (card?.name ?? "Unknown card") : slotName}
				disabled={!member}
				disabledHint="Pick an uma first"
				shape="card"
				starred={entry ? starred("support", entry.support_card) : false}
				badge={borrow && entry ? <Handshake className="h-3 w-3" aria-label="Borrowed" /> : null}
				label={
					entry
						? `Change ${borrow ? "the borrowed card" : `card ${slot}`} for ${umaLabel}: ${card?.name ?? "unknown"}`
						: `Add ${borrow ? "the borrowed card" : `card ${slot}`} for ${umaLabel}`
				}
				onClick={() => onPickCard(position, slot)}
				onClear={entry ? () => onClearCard(position, slot) : undefined}
				clearLabel={`Remove ${card?.name ?? "this card"}`}
				empty={<Plus className="h-4 w-4" />}
			/>
		)
	}

	// An empty spot is one slim row, not a grid of blank squares: three of
	// those read as a form nobody has started. The slots appear with the uma.
	if (!member) {
		return (
			<button
				type="button"
				aria-label={`Add uma ${position + 1}`}
				onClick={() => onPickUma(position)}
				className="group flex w-full items-center gap-3 rounded-xl border border-dashed border-gray-600 bg-gray-800/40 p-2.5 text-left transition hover:border-brand hover:bg-brand/5 sm:p-3"
			>
				<span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-700 text-xs font-bold text-gray-400 transition group-hover:bg-brand group-hover:text-black" aria-hidden="true">
					{position + 1}
				</span>
				<UserPlus className="h-5 w-5 shrink-0 text-gray-500 transition group-hover:text-brand" aria-hidden="true" />
				<span className="min-w-0">
					<span className="block text-sm font-semibold text-gray-200 group-hover:text-brand">Add an uma</span>
					<span className="block truncate text-xs text-gray-500">Then pick her five support cards and a borrowed one.</span>
				</span>
			</button>
		)
	}

	return (
		<section className="rounded-xl border border-gray-600 bg-gray-800 p-2.5 shadow-md sm:p-3" aria-label={umaLabel}>
			<header className="mb-2.5 flex items-center gap-2">
				<span
					className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-black"
					aria-hidden="true"
				>
					{position + 1}
				</span>
				<div className="min-w-0 flex-1">
					<h3 className="truncate text-sm font-semibold text-gray-100">{umaLabel}</h3>
					{course && uma && <AptitudeLetters uma={uma} course={course} style={member.style} />}
				</div>
				<label className="relative shrink-0">
					<span className="sr-only">Running style for {umaLabel}</span>
					<select
						value={member.style}
						onChange={(change) => onStyleChange(position, change.target.value as MemberStyle)}
						className="cursor-pointer appearance-none rounded-full border border-gray-600 bg-gray-900 py-1 pl-3 pr-7 text-xs font-semibold text-brand outline-none transition hover:border-gray-500 focus-visible:border-brand"
					>
						{MEMBER_STYLES.map((style) => (
							<option key={style} value={style}>
								{STYLE_LABELS[style]}
							</option>
						))}
					</select>
					<ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
				</label>
				<button
					type="button"
					aria-label={`Remove ${umaLabel} from the team`}
					title="Remove from the team"
					onClick={() => onClearUma(position)}
					className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-700 hover:text-gray-100"
				>
					<X className="h-4 w-4" />
				</button>
			</header>

			<div className="grid items-start gap-1.5 sm:gap-2" style={{ gridTemplateColumns: ROW_COLUMNS }}>
				<Tile
					art={uma?.portrait ?? uma?.image ?? null}
					large
					starred={starred("uma", member.uma)}
					label={`Change uma ${position + 1}: ${umaLabel}`}
					onClick={() => onPickUma(position)}
					empty={null}
				/>
				{OWNED_SLOTS.map(cardTile)}
				<span className="self-stretch rounded-full bg-gray-600" aria-hidden="true" />
				{cardTile(PVP_BORROW_SLOT)}
			</div>
		</section>
	)
}

/**
 * One square. `art` undefined means empty (a dashed box with `empty` in it);
 * null means filled but with no picture uploaded.
 */
function Tile({
	art,
	label,
	onClick,
	empty,
	caption,
	shape = "square",
	large = false,
	disabled = false,
	disabledHint,
	starred = false,
	badge = null,
	onClear,
	clearLabel,
}: {
	art: string | null | undefined
	label: string
	onClick: () => void
	empty: ReactNode
	caption?: string
	/** "card" is the support art's 3:4; the default is the portrait's square. */
	shape?: "square" | "card"
	large?: boolean
	disabled?: boolean
	disabledHint?: string
	starred?: boolean
	badge?: ReactNode
	onClear?: () => void
	clearLabel?: string
}) {
	const filled = art !== undefined
	return (
		<div className="min-w-0">
			<div className="group relative">
				<button
					type="button"
					aria-label={label}
					title={disabled ? disabledHint : caption}
					disabled={disabled}
					onClick={onClick}
					className={`${shape === "card" ? "aspect-[3/4]" : "aspect-square"} w-full overflow-hidden rounded-lg outline-none transition focus-visible:ring-2 focus-visible:ring-brand ${
						filled
							? "block bg-gray-700 ring-1 ring-gray-600 hover:ring-2 hover:ring-brand/70"
							: `flex items-center justify-center border border-dashed text-gray-500 ${
									disabled
										? "cursor-not-allowed border-gray-700/70 bg-gray-900/30 text-gray-700"
										: "border-gray-600 bg-gray-900/50 hover:border-brand hover:bg-brand/5 hover:text-brand"
								}`
					}`}
				>
					{filled ? (
						art ? (
							<img src={art} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
						) : (
							<span className="block h-full w-full bg-gray-700" aria-hidden="true" />
						)
					) : (
						empty
					)}
				</button>
				{starred && (
					<span
						className={`pointer-events-none absolute left-1 top-1 flex items-center justify-center rounded-full bg-gray-950/85 ${large ? "h-6 w-6" : "h-5 w-5"}`}
						title="Recommended by the guide"
					>
						<Star className={`fill-highlight text-highlight ${large ? "h-3.5 w-3.5" : "h-3 w-3"}`} aria-label="Recommended by the guide" />
					</span>
				)}
				{badge && (
					<span className="pointer-events-none absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-black">
						{badge}
					</span>
				)}
				{onClear && (
					<button
						type="button"
						aria-label={clearLabel}
						onClick={onClear}
						className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-gray-500 bg-gray-900 text-gray-300 opacity-0 shadow transition hover:bg-gray-700 hover:text-gray-100 focus-visible:opacity-100 group-hover:opacity-100"
					>
						<X className="h-3 w-3" />
					</button>
				)}
			</div>
			{caption && (
				<p
					className={`mt-1 hidden truncate text-center text-[11px] leading-tight sm:block ${
						filled ? "text-gray-300" : "text-gray-500"
					}`}
					title={caption}
				>
					{caption}
				</p>
			)}
		</div>
	)
}

/**
 * "Turf A · Medium S · Front B": the letters this race asks of her. A and S
 * in gold, D and below in red, so a poor fit stands out before race day.
 */
function AptitudeLetters({ uma, course, style }: {
	uma: CatalogueUma
	course: Pick<RaceEvent, "surface_type" | "distance" | "length">
	style: MemberStyle
}) {
	const aptitudes = aptitudeKeysForEvent(course, style)
	if (aptitudes.length === 0) return null
	return (
		<p className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-gray-400" aria-label="Aptitudes for this race">
			{aptitudes.map((aptitude) => {
				const value = uma.apt[aptitude.key]
				const letter = aptitudeLetter(value) ?? "?"
				const tone = value == null ? "text-gray-500" : value >= 7 ? "text-brand" : value <= 4 ? "text-highlight" : "text-gray-200"
				return (
					<span key={aptitude.key}>
						{aptitude.label} <span className={`font-bold ${tone}`}>{letter}</span>
					</span>
				)
			})}
		</p>
	)
}
