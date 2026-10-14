/**
 * The team builder's picker: one uma, or one support card, for one place on
 * the team. A portal dialog in the StepUpSelectionPicker's shape (Escape and
 * the backdrop close it, search on top, a tile grid below), plus four things:
 *
 *   - SEARCH BY SKILL. The search matches a card's name OR the name of any
 *     skill it teaches, so "Groundwork" finds every card with Groundwork.
 *     Skills that match the search show as chips; a chip pins as a filter, and
 *     pinned filters stack (a card must teach all of them).
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
 * Support cards also get a row of type filters.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Search, Star, Trash2, X } from "lucide-react"
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
import { useOshiIds } from "../../hooks/useOshiIds"

/** The most skill chips a search offers at once. */
const MAX_SKILL_CHIPS = 6

const CARD_TYPES = ["speed", "stamina", "power", "guts", "wit", "friend", "group"] as const
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
		apt: null,
	}))
}

export function PvpCardPicker(props: PvpCardPickerProps) {
	const { title, skillsById, event, style, recommended, blockReason, noteFor, selectedId, onPick, onRemove, onClose, pool, initialSearch, tabs } = props
	const [search, setSearch] = useState(initialSearch ?? "")
	// The person's favourite umas get the rainbow frame (FramedUma).
	const oshiIds = useOshiIds()
	const [pinnedSkills, setPinnedSkills] = useState<number[]>([])
	const [cardType, setCardType] = useState<string | null>(null)

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

	// Skills whose name holds the query, among the skills this pool teaches.
	// Two letters at least, or "a" would chip half the skill list.
	const matchingSkills = useMemo(() => {
		if (query.length < 2) return []
		const taught = new Set(items.flatMap((item) => item.skills.map((link) => link.skill)))
		const found: CatalogueSkill[] = []
		for (const id of taught) {
			const skill = skillsById.get(id)
			if (skill && skill.name.toLocaleLowerCase().includes(query)) found.push(skill)
		}
		return found.sort((a, b) => a.name.localeCompare(b.name))
	}, [items, query, skillsById])
	const matchingSkillIds = new Set(matchingSkills.map((skill) => skill.id))

	const shown = items
		.filter((item) => {
			const skillIds = new Set(item.skills.map((link) => link.skill))
			if (!pinnedSkills.every((id) => skillIds.has(id))) return false
			if (cardType && item.cardType !== cardType) return false
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
				className="flex max-h-[min(48rem,calc(100vh-2rem))] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-gray-600 bg-gray-800 shadow-2xl"
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
							className="flex h-9 items-center gap-1.5 rounded border border-gray-600 px-3 text-sm text-gray-300 transition hover:bg-gray-700 hover:text-gray-100"
							onClick={onRemove}
						>
							<Trash2 className="h-4 w-4" />
							Remove
						</button>
					)}
					<button
						type="button"
						aria-label="Close"
						className="flex h-9 w-9 items-center justify-center rounded border border-gray-600 text-gray-300 transition hover:bg-gray-700 hover:text-gray-100"
						onClick={onClose}
					>
						<X className="h-5 w-5" />
					</button>
				</header>

				{tabs && <div className="border-b border-gray-700 px-4 py-2">{tabs}</div>}

				{(chips.length > 0 || pool === "support") && (
					<div className="flex flex-col gap-2 border-b border-gray-700 bg-gray-900/35 px-4 py-2">
						{pool === "support" && (
							<div className="flex flex-wrap gap-1.5" role="group" aria-label="Card type">
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
						<p className="py-12 text-center text-sm text-gray-400">Nothing matches that search.</p>
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
