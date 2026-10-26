/**
 * The team builder's picker: one uma, or one support card, for one place on
 * the team. A portal dialog in the StepUpSelectionPicker's shape (Escape and
 * the backdrop close it, search on top, a tile grid below), plus four things:
 *
 *   - SEARCH BY SKILL. The search matches a card's name OR the name of any
 *     skill it teaches, so "Groundwork" finds every card with Groundwork.
 *     Skills that match the search show as chips; a chip pins as a filter, and
 *     pinned filters stack (a card must teach all of them). The ○ and ◎ of
 *     one white skill count as one (whiteSkillPairs in utils/pvpTeams):
 *     searching or pinning either finds the cards that teach either, which
 *     matters because nothing teaches a ◎ and the guides recommend the ◎.
 *   - APTITUDE BADGES (umas). The letters for this event's surface and
 *     distance and the style the place runs, from utils/courseAptitude.ts.
 *   - THE GUIDE'S STAR. Cards the event's guide recommends for this style
 *     carry a star and sort first.
 *   - RELEASE DATES. A card out after the event is blocked; one out during
 *     it carries a note (utils/cardRelease.ts, through the caller).
 *   - BLOCKED, NOT HIDDEN. A tile the team's rules refuse (already on the
 *     team, a second outfit of a character, already in this deck) stays in
 *     the grid, greyed, with the reason (the OshiPicker rule): a card that
 *     vanishes from search looks like a missing card.
 *
 * Support cards also get a rarity switch (All, SSR, SR, R; All to start) and
 * a row of type filters. Both are support-only: on the skill search's Umas
 * tab they stay set but apply to nothing, so switching back finds them as
 * left, and they never empty the uma grid.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Check, Search, Star, Trash2, X } from "lucide-react"
import { aptitudeKeysForEvent, aptitudeLetter } from "../../utils/courseAptitude"
import type { RaceEvent } from "../../types"
import type {
	CatalogueSkill,
	CatalogueSkillLink,
	CatalogueSupportCard,
	CatalogueUma,
	MemberStyle,
} from "../../types/pvpTeam"
import { FramedUma } from "../FramedUma"
import { limitBreakLabel, type OwnedForPicker } from "../../utils/roster"
import { useOshiIds } from "../../hooks/useOshiIds"
import { whiteSkillPairs } from "../../utils/pvpTeams"

/** The most skill chips a search offers at once. */
const MAX_SKILL_CHIPS = 6

const CARD_TYPES = ["speed", "stamina", "power", "guts", "wit", "friend", "group"] as const
/** The rarity switch, in the game's order. null is All; 3 / 2 / 1 are SSR / SR / R. */
const RARITIES = [
	{ id: null, label: "All" },
	{ id: 3, label: "SSR" },
	{ id: 2, label: "SR" },
	{ id: 1, label: "R" },
] as const
type RarityFilter = (typeof RARITIES)[number]["id"]

const CARD_TYPE_LABELS: Record<string, string> = {
	speed: "Speed",
	stamina: "Stamina",
	power: "Power",
	guts: "Guts",
	wit: "Wit",
	friend: "Friend",
	group: "Group",
}

interface PickerItem {
	id: number
	name: string
	/** Extra text the name search also reads (a card's title). */
	alias: string
	image: string | null
	/** An uma's borderless art, drawn in the site's frame (FramedUma); null for a support card. */
	portrait: string | null
	skills: CatalogueSkillLink[]
	cardType: string | null
	/** A support card's 1 / 2 / 3 (R / SR / SSR); null for an uma. */
	rarity: number | null
	apt: CatalogueUma["apt"] | null
}

type PvpCardPickerProps = {
	/** What the dialog is for: "Uma 2", "Card 3 for Maruzensky". */
	title: string
	skillsById: Map<number, CatalogueSkill>
	event: Pick<RaceEvent, "surface_type" | "distance" | "length">
	/** The style this place runs, for the aptitude badge and the star. */
	style: MemberStyle | null
	recommended: Set<number>
	/** Why an id can't go here, or null when it can. Blocked tiles sort last. */
	blockReason: (id: number) => string | null
	/** A note on a pickable tile, such as "Out 2026/11/5, during this event". */
	noteFor?: (id: number) => string | null
	selectedId: number | null
	onPick: (id: number) => void
	/** Shown when the place is filled: empties it. */
	onRemove?: () => void
	/** What the search box starts with: a skill's name, from the skills panel. */
	initialSearch?: string
	/**
	 * What the player owns in this pool (the Collection), or null/absent for a
	 * guest. Draws an "Owned only" switch, on by default once anything is owned
	 * (owner, 2026-10-26), a tick on an owned uma and a card's limit break.
	 * Never a rule: an unowned card is still pickable with the switch off.
	 */
	owned?: OwnedForPicker | null
	/**
	 * Drawn under the header: the Umas / Support cards switch of a skill
	 * search. Switching changes `pool` and `items` on this same mounted
	 * picker, so the search and the pinned skills carry across.
	 */
	tabs?: ReactNode
	onClose: () => void
} & ({ pool: "uma"; items: CatalogueUma[] } | { pool: "support"; items: CatalogueSupportCard[] })

function toItems(props: PvpCardPickerProps): PickerItem[] {
	if (props.pool === "uma") {
		return props.items.map((uma) => ({
			id: uma.id,
			name: uma.name,
			alias: "",
			image: uma.image,
			portrait: uma.portrait ?? uma.image,
			skills: uma.skills,
			cardType: null,
			rarity: null,
			apt: uma.apt,
		}))
	}
	return props.items.map((card) => ({
		id: card.id,
		name: card.name,
		alias: card.title,
		image: card.image,
		portrait: null,
		skills: card.skills,
		cardType: card.card_type,
		rarity: card.rarity,
		apt: null,
	}))
}

export function PvpCardPicker(props: PvpCardPickerProps) {
	const { title, skillsById, event, style, recommended, blockReason, noteFor, selectedId, onPick, onRemove, onClose, pool, initialSearch, tabs, owned } = props
	const [search, setSearch] = useState(initialSearch ?? "")
	// The person's favorite umas get the rainbow frame (FramedUma).
	const oshiIds = useOshiIds()
	const [pinnedSkills, setPinnedSkills] = useState<number[]>([])
	const [cardType, setCardType] = useState<string | null>(null)
	const [rarity, setRarity] = useState<RarityFilter>(null)
	const [ownedOnly, setOwnedOnly] = useState(() => Boolean(owned && owned.ids.size > 0))

	useEffect(() => {
		const closeOnEscape = (keydown: KeyboardEvent) => {
			if (keydown.key === "Escape") onClose()
		}
		window.addEventListener("keydown", closeOnEscape)
		return () => window.removeEventListener("keydown", closeOnEscape)
	}, [onClose])

	// props.items is stable for the dialog's life (the catalogue never changes
	// once loaded), so this runs once per open.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const items = useMemo(() => toItems(props), [props.items, props.pool])
	const query = search.trim().toLocaleLowerCase()
	// Skill id -> its ○/◎ pair, so either answers for the other. Built once:
	// the catalogue never changes while the dialog is open.
	const pairs = useMemo(() => whiteSkillPairs(skillsById.values()), [skillsById])

	// Skills whose name holds the query, among the skills this pool teaches.
	// Two letters at least, or "a" would chip half the skill list. A taught
	// white also matches by its pair's name, so "Right-Handed ◎" chips the
	// Right-Handed ○ that the cards teach.
	const matchingSkills = useMemo(() => {
		if (query.length < 2) return []
		const taught = new Set(items.flatMap((item) => item.skills.map((link) => link.skill)))
		const found: CatalogueSkill[] = []
		for (const id of taught) {
			const skill = skillsById.get(id)
			const names = (pairs.get(id) ?? [id]).map((member) => skillsById.get(member)?.name ?? "")
			if (skill && names.some((name) => name.toLocaleLowerCase().includes(query))) found.push(skill)
		}
		return found.sort((a, b) => a.name.localeCompare(b.name))
	}, [items, query, skillsById, pairs])
	const matchingSkillIds = new Set(matchingSkills.map((skill) => skill.id))

	const shown = items
		.filter((item) => {
			const skillIds = new Set(item.skills.map((link) => link.skill))
			// A pinned white is met by either half of its pair.
			if (!pinnedSkills.every((id) => (pairs.get(id) ?? [id]).some((member) => skillIds.has(member)))) return false
			if (ownedOnly && owned && !owned.ids.has(item.id)) return false
			// Support-only filters (see the header). A card with no rarity
			// reads as SSR, the convention on SupportCard.rarity.
			if (pool === "support") {
				if (cardType && item.cardType !== cardType) return false
				if (rarity !== null && (item.rarity ?? 3) !== rarity) return false
			}
			if (!query) return true
			if (item.name.toLocaleLowerCase().includes(query)) return true
			if (item.alias.toLocaleLowerCase().includes(query)) return true
			return item.skills.some((link) => matchingSkillIds.has(link.skill))
		})
		// Stable: what can be picked before what can't, the guide's picks
		// first within each, the catalogue's name order within those.
		.sort(
			(a, b) =>
				Number(blockReason(a.id) !== null) - Number(blockReason(b.id) !== null) ||
				Number(recommended.has(b.id)) - Number(recommended.has(a.id))
		)

	const aptitudes = pool === "uma" ? aptitudeKeysForEvent(event, style) : []
	// The art's own shape: an uma tile is square, a support card is 3:4 (450x600).
	const artAspect = pool === "uma" ? "aspect-square" : "aspect-[3/4]"
	const chips = [
		...pinnedSkills.map((id) => skillsById.get(id)).filter((skill): skill is CatalogueSkill => Boolean(skill)),
		...matchingSkills.filter((skill) => !pinnedSkills.includes(skill.id)),
	].slice(0, Math.max(MAX_SKILL_CHIPS, pinnedSkills.length))

	const togglePin = (id: number) =>
		setPinnedSkills((pinned) => (pinned.includes(id) ? pinned.filter((kept) => kept !== id) : [...pinned, id]))

	return createPortal(
		<div
			className="fixed inset-0 z-[10000] flex items-center justify-center bg-gray-950/75 p-4"
			onMouseDown={(mouse) => {
				if (mouse.target === mouse.currentTarget) onClose()
			}}
		>
			<section
				role="dialog"
				aria-modal="true"
				aria-label={title}
				className="flex max-h-[min(48rem,calc(100vh-2rem))] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-edge bg-gray-800 shadow-2xl"
			>
				<header className="flex flex-wrap items-center gap-3 border-b border-gray-700 px-4 py-3">
					<div className="min-w-0 flex-1">
						<h2 className="truncate text-base font-semibold text-gray-100">{title}</h2>
						<p className="text-xs text-gray-400">
							Search by name or by a skill the {pool === "uma" ? "uma" : "card"} has.
						</p>
					</div>
					<label className="relative w-full sm:w-72">
						<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
						<input
							autoFocus
							type="search"
							aria-label="Search"
							value={search}
							onChange={(change) => setSearch(change.target.value)}
							placeholder={pool === "uma" ? "Name or skill…" : "Card, title or skill…"}
							className="w-full rounded border border-gray-600 bg-gray-900 py-2 pl-9 pr-3 text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-brand"
						/>
					</label>
					{onRemove && (
						<button
							type="button"
							className="flex h-9 items-center gap-1.5 rounded-md border border-gray-600 px-3 text-sm text-gray-300 transition hover:bg-gray-700 hover:text-gray-100"
							onClick={onRemove}
						>
							<Trash2 className="h-4 w-4" />
							Remove
						</button>
					)}
					<button
						type="button"
						aria-label="Close"
						className="flex h-9 w-9 items-center justify-center rounded-md border border-gray-600 text-gray-300 transition hover:bg-gray-700 hover:text-gray-100"
						onClick={onClose}
					>
						<X className="h-5 w-5" />
					</button>
				</header>

				{tabs && <div className="border-b border-gray-700 px-4 py-2">{tabs}</div>}

				{(chips.length > 0 || pool === "support" || owned) && (
					<div className="flex flex-col gap-2 border-b border-gray-700 bg-gray-900/35 px-4 py-2">
						{owned && (
							<label className="flex w-fit items-center gap-1.5 text-xs font-medium text-gray-300">
								<input type="checkbox" checked={ownedOnly} onChange={(change) => setOwnedOnly(change.target.checked)} />
								Owned only
								<span className="text-gray-500">({owned.ids.size} in your collection)</span>
							</label>
						)}
						{pool === "support" && (
							<div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
								{/* Rarity on the left, the type chips pushed to the right
								    (owner's layout). Rarity is one of four, so a segmented
								    switch like the gallery's sort; the type chips toggle on and
								    off. */}
								<div className="flex gap-0.5 rounded-lg bg-gray-900/70 p-0.5" role="group" aria-label="Rarity">
									{RARITIES.map((option) => (
										<button
											key={option.label}
											type="button"
											aria-pressed={rarity === option.id}
											onClick={() => setRarity(option.id)}
											className={`rounded-md px-2.5 py-0.5 text-xs font-medium transition ${
												rarity === option.id ? "bg-gray-700 text-brand shadow-sm" : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
											}`}
										>
											{option.label}
										</button>
									))}
								</div>
								{/* ml-auto keeps the chips on the right even when they wrap
								    to a line of their own. */}
								<div className="ml-auto flex flex-wrap justify-end gap-1.5" role="group" aria-label="Card type">
									{CARD_TYPES.map((type) => (
										<button
											key={type}
											type="button"
											aria-pressed={cardType === type}
											onClick={() => setCardType(cardType === type ? null : type)}
											className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
												cardType === type
													? "border-brand bg-brand/15 text-brand"
													: "border-gray-600 text-gray-300 hover:border-gray-500"
											}`}
										>
											{CARD_TYPE_LABELS[type]}
										</button>
									))}
								</div>
							</div>
						)}
						{chips.length > 0 && (
							<div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Has skill">
								<span className="text-xs text-gray-500">Has skill:</span>
								{chips.map((skill) => {
									const pinned = pinnedSkills.includes(skill.id)
									return (
										<button
											key={skill.id}
											type="button"
											aria-pressed={pinned}
											title={skill.description}
											onClick={() => togglePin(skill.id)}
											className={`flex items-center gap-1 rounded-full border py-0.5 pl-0.5 pr-2 text-xs transition ${
												pinned
													? "border-brand bg-brand/15 text-brand"
													: "border-gray-600 text-gray-200 hover:border-gray-500"
											}`}
										>
											{skill.image ? (
												<img src={skill.image} alt="" className="h-4 w-4" loading="lazy" decoding="async" />
											) : (
												<span className="h-4 w-4 rounded-full bg-gray-700" aria-hidden="true" />
											)}
											{skill.name}
											{pinned && <X className="h-3 w-3" aria-hidden="true" />}
										</button>
									)
								})}
							</div>
						)}
					</div>
				)}

				<div className="min-h-0 overflow-y-auto p-4">
					{shown.length === 0 ? (
						<p className="py-12 text-center text-sm text-gray-400">
							{/* A rarity and a type can empty the grid with nothing typed. */}
							{query ? "Nothing matches that search." : "Nothing matches these filters."}
							{ownedOnly && " Turn off Owned only to see everything."}
						</p>
					) : (
						<ul className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-3">
							{shown.map((item) => {
								const reason = blockReason(item.id)
								const note = reason === null ? (noteFor?.(item.id) ?? null) : null
								const isRecommended = recommended.has(item.id)
								const isSelected = item.id === selectedId
								return (
									<li key={item.id} className="min-w-0">
										<button
											type="button"
											disabled={reason !== null}
											aria-pressed={isSelected}
											title={reason ?? item.name}
											onClick={() => onPick(item.id)}
											className={`flex w-full min-w-0 flex-col items-center rounded-lg border p-1.5 text-center transition disabled:cursor-not-allowed disabled:opacity-40 ${
												isSelected
													? "border-brand bg-brand/10"
													: "border-gray-600 bg-gray-700/50 hover:border-gray-500 hover:bg-gray-700"
											}`}
										>
											<span className="relative block w-full">
												{item.portrait ? (
													<FramedUma src={item.portrait} oshi={oshiIds.has(item.id)} className="w-full" />
												) : item.image ? (
													<img src={item.image} alt="" loading="lazy" decoding="async" className={`${artAspect} w-full rounded object-cover`} />
												) : (
													<span className={`block ${artAspect} w-full rounded bg-gray-700`} aria-hidden="true" />
												)}
												{owned?.limitBreaks.has(item.id) ? (
													<span className="absolute right-0.5 top-0.5 rounded bg-brand px-1 text-[10px] font-bold text-black" title="In your collection">
														{limitBreakLabel(owned.limitBreaks.get(item.id) ?? 0)}
													</span>
												) : (
													owned?.ids.has(item.id) && (
														<span
															className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-black"
															title="In your collection"
														>
															<Check className="h-3 w-3" aria-hidden="true" />
														</span>
													)
												)}
												{isRecommended && (
													<span
														className="absolute left-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-950/85"
														aria-label="Recommended by the guide"
														title="Recommended by the guide"
													>
														<Star className="h-3 w-3 fill-highlight text-highlight" aria-hidden="true" />
													</span>
												)}
											</span>
											<span className="mt-1 line-clamp-2 min-h-8 text-xs font-medium leading-tight text-gray-100">{item.name}</span>
											{item.apt && aptitudes.length > 0 && (
												<span className="mt-1 flex gap-1" aria-label="Aptitudes for this race">
													{aptitudes.map((aptitude) => (
														<span
															key={aptitude.key}
															title={aptitude.label}
															className="rounded border border-gray-600 bg-gray-900 px-1 text-[10px] font-bold text-gray-200"
														>
															{aptitudeLetter(item.apt?.[aptitude.key]) ?? "?"}
														</span>
													))}
												</span>
											)}
											{reason && <span className="mt-0.5 text-[10px] leading-tight text-gray-400">{reason}</span>}
											{note && (
												<span className="mt-1 rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-brand" title={note}>
													{note}
												</span>
											)}
										</button>
									</li>
								)
							})}
						</ul>
					)}
				</div>
			</section>
		</div>,
		document.body
	)
}
