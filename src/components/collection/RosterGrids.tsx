/**
 * The Collection's Umas and Support cards tabs: every uma or card on Global as
 * a tile. Tap a tile to mark it owned (tap again, or Remove, to unmark it), then
 * set its stars or limit break. Search, an "Owned only" switch, sorts that
 * combine (utils/rosterSort.ts, newest released first to start), and "Start
 * over", which empties the list after a confirmation (owner, 2026-10-26). No
 * "mark everything" button: too easy to fill a collection with things the
 * player doesn't have.
 *
 * Every change is a grid edit through services/rosterQueries.ts: on screen at
 * once, saved in order. An import later REPLACES the list (ImportPanel says so).
 *
 * JP-only umas and cards (`on_global: false`) are not offered: nobody owns
 * them on Global. Unowned tiles are dimmed; the uma tiles keep the site's
 * frame (FramedUma), the rule for every uma.
 */

import { useState, type ReactNode } from "react"
import { ArrowDown, ArrowUp, Check, Search, X } from "lucide-react"
import { FramedUma } from "../FramedUma"
import { LIMIT_BREAKS, STAR_LEVELS, limitBreakLabel } from "../../utils/roster"
import {
	CARD_SORTS,
	DEFAULT_SORT,
	UMA_SORTS,
	addStep,
	directionLabel,
	sortBySteps,
	typeRank,
	type CardSortKey,
	type SortStep,
	type UmaSortKey,
} from "../../utils/rosterSort"
import { parseApiDate } from "../../utils/dateFormat"
import type { CatalogueSupportCard, CatalogueUma } from "../../types/pvpTeam"
import type { OwnedCardRow, OwnedUmaRow, RosterChanges } from "../../types/roster"

const CARD_TYPES = ["speed", "stamina", "power", "guts", "wit", "friend", "group"] as const
const CARD_TYPE_LABELS: Record<string, string> = {
	speed: "Speed", stamina: "Stamina", power: "Power", guts: "Guts", wit: "Wit", friend: "Friend", group: "Group",
}

const SMALL_SELECT = "w-full rounded border border-gray-600 bg-gray-900 px-1 py-0.5 text-[11px] text-gray-200 focus:border-brand focus:outline-none"
const CHIP = "flex items-center gap-1 rounded-full border border-gray-600 py-0.5 pl-2.5 pr-1 text-xs text-gray-200"
const SMALL_BUTTON = "rounded-md border border-gray-600 px-2.5 py-1 text-xs font-medium text-gray-200 transition hover:border-brand hover:text-brand"

const matches = (name: string, query: string) => name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
const time = (iso: string | null | undefined) => (iso ? (parseApiDate(iso)?.getTime() ?? null) : null)

/** The sorts in use as chips (flip, remove), plus "Add a sort" and Reset. */
function SortBar<Key extends string>({ steps, options, onChange }: {
	steps: Array<SortStep<Key>>
	options: Array<{ key: Key; label: string; desc: boolean }>
	onChange: (steps: Array<SortStep<Key>>) => void
}) {
	const label = (key: Key) => options.find((option) => option.key === key)?.label ?? key
	const unused = options.filter((option) => !steps.some((step) => step.key === option.key))
	const isDefault = steps.length === 1 && steps[0].key === DEFAULT_SORT[0].key && steps[0].desc === DEFAULT_SORT[0].desc
	return (
		<div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Sort">
			<span className="text-xs text-gray-400">Sort by</span>
			{steps.map((step, position) => (
				<span key={step.key} className={CHIP}>
					{position > 0 && <span className="text-gray-500">then</span>}
					<button
						type="button"
						onClick={() => onChange(steps.map((each) => (each.key === step.key ? { ...each, desc: !each.desc } : each)))}
						className="flex items-center gap-1 hover:text-brand"
						title="Flip the order"
					>
						{label(step.key)}, {directionLabel(step.key, step.desc)}
						{step.desc ? <ArrowDown className="h-3 w-3" aria-hidden="true" /> : <ArrowUp className="h-3 w-3" aria-hidden="true" />}
					</button>
					{steps.length > 1 && (
						<button
							type="button"
							aria-label={`Stop sorting by ${label(step.key)}`}
							onClick={() => onChange(steps.filter((each) => each.key !== step.key))}
							className="rounded-full p-0.5 text-gray-400 hover:text-highlight"
						>
							<X className="h-3 w-3" />
						</button>
					)}
				</span>
			))}
			{unused.length > 0 && (
				<select
					aria-label="Add a sort"
					value=""
					onChange={(change) => change.target.value && onChange(addStep(steps, change.target.value as Key, options))}
					className="rounded-full border border-dashed border-gray-600 bg-gray-900 px-2 py-0.5 text-xs text-gray-300 focus:border-brand focus:outline-none"
				>
					<option value="">+ then by…</option>
					{unused.map((option) => (
						<option key={option.key} value={option.key}>
							{option.label}
						</option>
					))}
				</select>
			)}
			{!isDefault && (
				<button type="button" onClick={() => onChange([{ ...DEFAULT_SORT[0] } as SortStep<Key>])} className="text-xs text-gray-400 hover:text-brand">
					Reset
				</button>
			)}
		</div>
	)
}

/** Search, Owned only, the count and Start over, above either grid. */
function Toolbar({ query, onQuery, ownedOnly, onOwnedOnly, ownedCount, total, what, onClear, children }: {
	query: string
	onQuery: (query: string) => void
	ownedOnly: boolean
	onOwnedOnly: (on: boolean) => void
	ownedCount: number
	total: number
	/** "umas" / "support cards", for the Start over confirmation. */
	what: string
	onClear: () => void
	children?: ReactNode
}) {
	const [confirming, setConfirming] = useState(false)
	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center gap-2">
				<label className="relative w-full sm:w-64">
					<span className="sr-only">Search</span>
					<Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden="true" />
					<input
						type="search"
						value={query}
						onChange={(change) => onQuery(change.target.value)}
						placeholder="Search by name"
						className="w-full rounded-md border border-gray-600 bg-gray-800 py-1.5 pl-8 pr-2 text-sm text-gray-100 focus:border-brand focus:outline-none"
					/>
				</label>
				<label className="flex items-center gap-1.5 text-sm text-gray-300">
					<input type="checkbox" checked={ownedOnly} onChange={(change) => onOwnedOnly(change.target.checked)} />
					Owned only
				</label>
				<span className="text-sm text-gray-400">
					{ownedCount} of {total} owned
				</span>
				{ownedCount > 0 && (
					<div className="ml-auto flex items-center gap-1.5">
						{confirming ? (
							<>
								<span className="text-xs text-gray-300">Remove all {ownedCount} {what}? This can&apos;t be undone.</span>
								<button
									type="button"
									className={`${SMALL_BUTTON} border-highlight/60 text-highlight`}
									onClick={() => {
										setConfirming(false)
										onClear()
									}}
								>
									Remove all
								</button>
								<button type="button" className={SMALL_BUTTON} onClick={() => setConfirming(false)}>
									Keep
								</button>
							</>
						) : (
							<button type="button" className={SMALL_BUTTON} onClick={() => setConfirming(true)}>
								Start over
							</button>
						)}
					</div>
				)}
			</div>
			{children}
		</div>
	)
}

/** An owned tile's way back: unmark it. */
function RemoveButton({ name, onRemove }: { name: string; onRemove: () => void }) {
	return (
		<button type="button" aria-label={`Remove ${name}`} onClick={onRemove} className="text-[11px] text-gray-400 hover:text-highlight">
			Remove
		</button>
	)
}

export function OwnedUmasGrid({ umas, owned, releases, oshiIds, onEdit, onClear }: {
	umas: CatalogueUma[]
	owned: OwnedUmaRow[]
	/** First Global banner start per uma, in ms (utils/cardRelease.ts). */
	releases: ReadonlyMap<number, number>
	oshiIds: ReadonlySet<number>
	onEdit: (changes: RosterChanges) => void
	onClear: () => void
}) {
	const [query, setQuery] = useState("")
	const [ownedOnly, setOwnedOnly] = useState(false)
	const [steps, setSteps] = useState<Array<SortStep<UmaSortKey>>>([{ ...DEFAULT_SORT[0] }])
	const byUma = new Map(owned.map((row) => [row.uma, row]))
	const offered = umas.filter((uma) => uma.on_global !== false)
	const shown = sortBySteps(
		offered.filter((uma) => matches(uma.name, query) && (!ownedOnly || byUma.has(uma.id))),
		steps,
		(key, uma) => {
			const row = byUma.get(uma.id)
			if (key === "released") return releases.get(uma.id)
			if (key === "acquired") return time(row?.obtained_at)
			if (key === "rarity") return uma.rarity
			if (key === "stars") return row?.stars
			if (key === "potential") return row?.talent_level
			return uma.name
		}
	)
	return (
		<section className="flex flex-col gap-3" aria-label="Umas you own">
			<Toolbar
				query={query}
				onQuery={setQuery}
				ownedOnly={ownedOnly}
				onOwnedOnly={setOwnedOnly}
				ownedCount={offered.filter((uma) => byUma.has(uma.id)).length}
				total={offered.length}
				what="umas"
				onClear={onClear}
			>
				<SortBar steps={steps} options={UMA_SORTS} onChange={setSteps} />
			</Toolbar>
			<ul className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
				{shown.map((uma) => {
					const row = byUma.get(uma.id)
					return (
						<li key={uma.id} className="flex min-w-0 flex-col items-center gap-1">
							<button
								type="button"
								aria-pressed={row !== undefined}
								aria-label={`${uma.name}${row ? ", owned" : ""}`}
								title={row ? "Owned. Tap to unmark." : "Tap to mark as owned."}
								onClick={() => onEdit({ umas: [{ uma: uma.id, owned: !row }] })}
								className={`relative w-full transition ${row ? "" : "opacity-40 hover:opacity-70"}`}
							>
								<FramedUma src={uma.portrait ?? uma.image} oshi={oshiIds.has(uma.id)} alt="" className="w-full" />
								{row && (
									<span className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-black" aria-hidden="true">
										<Check className="h-3 w-3" />
									</span>
								)}
							</button>
							<span className="line-clamp-2 min-h-7 w-full text-center text-[11px] leading-tight text-gray-200">{uma.name}</span>
							{row && (
								<>
									<select
										aria-label={`Stars for ${uma.name}`}
										className={SMALL_SELECT}
										value={row.stars ?? ""}
										onChange={(change) =>
											onEdit({ umas: [{ uma: uma.id, owned: true, stars: change.target.value ? Number(change.target.value) : null }] })
										}
									>
										<option value="">Stars?</option>
										{STAR_LEVELS.map((stars) => (
											<option key={stars} value={stars}>
												{"★".repeat(stars)}
											</option>
										))}
									</select>
									<RemoveButton name={uma.name} onRemove={() => onEdit({ umas: [{ uma: uma.id, owned: false }] })} />
								</>
							)}
						</li>
					)
				})}
			</ul>
			{shown.length === 0 && <p className="text-sm text-gray-400">Nothing matches.</p>}
		</section>
	)
}

export function OwnedCardsGrid({ cards, owned, releases, onEdit, onClear }: {
	cards: CatalogueSupportCard[]
	owned: OwnedCardRow[]
	/** First Global banner start per card, in ms (utils/cardRelease.ts). */
	releases: ReadonlyMap<number, number>
	onEdit: (changes: RosterChanges) => void
	onClear: () => void
}) {
	const [query, setQuery] = useState("")
	const [ownedOnly, setOwnedOnly] = useState(false)
	const [cardType, setCardType] = useState<string | null>(null)
	const [steps, setSteps] = useState<Array<SortStep<CardSortKey>>>([{ ...DEFAULT_SORT[0] }])
	const byCard = new Map(owned.map((row) => [row.support_card, row]))
	const offered = cards.filter((card) => card.on_global !== false)
	const shown = sortBySteps(
		offered.filter(
			(card) =>
				(matches(card.name, query) || matches(card.title, query)) &&
				(!ownedOnly || byCard.has(card.id)) &&
				(cardType === null || card.card_type === cardType)
		),
		steps,
		(key, card) => {
			const row = byCard.get(card.id)
			if (key === "released") return releases.get(card.id)
			if (key === "acquired") return time(row?.obtained_at)
			if (key === "rarity") return card.rarity
			if (key === "limit_break") return row?.limit_break
			if (key === "type") return typeRank(card.card_type)
			return card.name
		}
	)
	return (
		<section className="flex flex-col gap-3" aria-label="Support cards you own">
			<Toolbar
				query={query}
				onQuery={setQuery}
				ownedOnly={ownedOnly}
				onOwnedOnly={setOwnedOnly}
				ownedCount={offered.filter((card) => byCard.has(card.id)).length}
				total={offered.length}
				what="support cards"
				onClear={onClear}
			>
				<div className="flex flex-wrap gap-1.5" role="group" aria-label="Card type">
					{CARD_TYPES.map((type) => (
						<button
							key={type}
							type="button"
							aria-pressed={cardType === type}
							onClick={() => setCardType(cardType === type ? null : type)}
							className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition ${
								cardType === type ? "border-brand bg-brand/15 text-brand" : "border-gray-600 text-gray-300 hover:border-gray-500"
							}`}
						>
							{CARD_TYPE_LABELS[type]}
						</button>
					))}
				</div>
				<SortBar steps={steps} options={CARD_SORTS} onChange={setSteps} />
			</Toolbar>
			<ul className="grid grid-cols-[repeat(auto-fill,minmax(5.5rem,1fr))] gap-2">
				{shown.map((card) => {
					const row = byCard.get(card.id)
					return (
						<li key={card.id} className="flex min-w-0 flex-col items-center gap-1">
							<button
								type="button"
								aria-pressed={row !== undefined}
								aria-label={`${card.name}${card.title ? ` (${card.title})` : ""}${row ? ", owned" : ""}`}
								title={row ? "Owned. Tap to unmark." : "Tap to mark as owned."}
								onClick={() => onEdit({ support_cards: [{ support_card: card.id, owned: !row }] })}
								className={`relative w-full transition ${row ? "" : "opacity-40 hover:opacity-70"}`}
							>
								{card.image ? (
									<img src={card.image} alt="" loading="lazy" decoding="async" className="aspect-[3/4] w-full rounded object-cover" />
								) : (
									<span className="block aspect-[3/4] w-full rounded bg-gray-700" aria-hidden="true" />
								)}
								{row && (
									<span className="absolute right-0.5 top-0.5 rounded bg-brand px-1 text-[10px] font-bold text-black" data-testid="limit-break-badge">
										{limitBreakLabel(row.limit_break)}
									</span>
								)}
							</button>
							<span className="line-clamp-2 min-h-7 w-full text-center text-[11px] leading-tight text-gray-200">{card.name}</span>
							{row && (
								<>
									<select
										aria-label={`Limit break for ${card.name}`}
										className={SMALL_SELECT}
										value={row.limit_break}
										onChange={(change) =>
											onEdit({ support_cards: [{ support_card: card.id, owned: true, limit_break: Number(change.target.value) }] })
										}
									>
										{LIMIT_BREAKS.map((limitBreak) => (
											<option key={limitBreak} value={limitBreak}>
												{limitBreakLabel(limitBreak)}
											</option>
										))}
									</select>
									<RemoveButton name={card.name} onRemove={() => onEdit({ support_cards: [{ support_card: card.id, owned: false }] })} />
								</>
							)}
						</li>
					)
				})}
			</ul>
			{shown.length === 0 && <p className="text-sm text-gray-400">Nothing matches.</p>}
		</section>
	)
}
