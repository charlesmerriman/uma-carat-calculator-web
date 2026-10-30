/**
 * The Collection's Umas and Support cards tabs: every uma or card on Global as
 * a tile, with a summary of what the player owns above it (the redesign, owner
 * 2026-10-27; notes/collection-redesign-plan.md, PR 3).
 *
 * A tile shows its state on the art: an uma's stars and potential, a card's
 * limit break and spare copies. Tapping one the player doesn't own adds it (an
 * uma at her base stars); tapping an owned one opens a small editor under it
 * (stars and potential, or limit break and spares, and Remove). Search, All /
 * Owned / Missing, sorts that combine (utils/rosterSort.ts, newest released
 * first to start) and, in the ⋯ menu, "Start over", which empties the list
 * after a confirmation (owner, 2026-10-26). No "mark everything" button: too
 * easy to fill a collection with things the player doesn't have.
 *
 * Every change is a grid edit through services/rosterQueries.ts: on screen at
 * once, saved in order. An import later REPLACES the list (ImportPanel says so).
 *
 * JP-only umas and cards (`on_global: false`) are not offered: nobody owns
 * them on Global. Unowned tiles are greyed; the uma tiles keep the site's
 * frame (FramedUma), the rule for every uma, and an open editor rings it.
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react"
import { Link } from "react-router-dom"
import { ArrowDown, ArrowUp, Minus, MoreHorizontal, Plus, Search, X } from "lucide-react"
import { FramedUma } from "../FramedUma"
import { LIMIT_BREAKS, STAR_LEVELS, cardSummary, limitBreakLabel, umaSummary, type RosterView } from "../../utils/roster"
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
import { collectionCardRelease, earliestRelease } from "../../utils/cardRelease"
import { parseApiDate } from "../../utils/dateFormat"
import { CARD_TYPE_COLORS } from "../../utils/cardTypes"
import type { CatalogueSupportCard, CatalogueUma } from "../../types/pvpTeam"
import type { OwnedCardRow, OwnedUmaRow, RosterChanges } from "../../types/roster"

const CARD_TYPES = ["speed", "stamina", "power", "guts", "wit", "friend", "group"] as const
const CARD_TYPE_LABELS: Record<string, string> = {
	speed: "Speed", stamina: "Stamina", power: "Power", guts: "Guts", wit: "Wit", friend: "Friend", group: "Group",
}
const RARITIES = [
	{ rarity: 3, label: "SSR" },
	{ rarity: 2, label: "SR" },
	{ rarity: 1, label: "R" },
]
const RARITY_LABELS: Record<number, string> = { 3: "SSR", 2: "SR", 1: "R" }
/** The API's ceiling on spare copies (ROSTER_SPARE_COPIES_MAX). */
const SPARE_COPIES_MAX = 99

const CONTROL =
	"min-h-9 rounded-lg border border-gray-600 bg-gray-800 px-2.5 text-sm text-gray-100 focus:border-brand focus:outline-none"
const CHIP = "flex min-h-8 items-center gap-1 rounded-full border border-gray-600 bg-(--card-fill) pl-3 pr-1 text-xs text-gray-100"
const SMALL_BUTTON =
	"min-h-9 rounded-lg border border-gray-600 px-3 text-sm font-medium text-gray-100 transition hover:border-brand hover:text-brand"
const PILL = (on: boolean) =>
	`flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition ${
		on ? "border-brand bg-brand/15 text-brand" : "border-gray-600 text-gray-200 hover:border-gray-500"
	}`

const matches = (name: string, query: string) => name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
const time = (iso: string | null | undefined) => (iso ? (parseApiDate(iso)?.getTime() ?? null) : null)
const inView = (view: RosterView, owned: boolean) => view === "all" || (view === "owned") === owned

/** Close something open on Escape or a press outside `ref`. Re-subscribes per render, which is cheap. */
function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
	useEffect(() => {
		if (!open) return
		const onPointer = (event: PointerEvent) => {
			if (!ref.current?.contains(event.target as Node)) onClose()
		}
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") onClose()
		}
		document.addEventListener("pointerdown", onPointer)
		document.addEventListener("keydown", onKey)
		return () => {
			document.removeEventListener("pointerdown", onPointer)
			document.removeEventListener("keydown", onKey)
		}
	}, [ref, open, onClose])
}

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
			<span className="text-xs text-gray-400">Sort</span>
			{steps.map((step, position) => (
				<span key={step.key} className={`${CHIP} ${steps.length > 1 ? "" : "pr-3"}`}>
					{position > 0 && <span className="text-gray-400">then</span>}
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
							className="rounded-full p-1.5 text-gray-400 hover:text-highlight"
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
					className="min-h-8 rounded-full border border-dashed border-gray-600 bg-transparent px-3 text-xs text-gray-300 focus:border-brand focus:outline-none"
				>
					<option value="">+ Then by…</option>
					{unused.map((option) => (
						<option key={option.key} value={option.key}>
							{option.label}
						</option>
					))}
				</select>
			)}
			{!isDefault && (
				<button type="button" onClick={() => onChange([{ ...DEFAULT_SORT[0] } as SortStep<Key>])} className="px-1 text-xs text-gray-400 hover:text-brand">
					Reset
				</button>
			)}
		</div>
	)
}

/** All / Owned / Missing, each with its count. */
function ViewSwitch({ view, onView, owned, total }: { view: RosterView; onView: (view: RosterView) => void; owned: number; total: number }) {
	const views: Array<{ id: RosterView; label: string; count: number }> = [
		{ id: "all", label: "All", count: total },
		{ id: "owned", label: "Owned", count: owned },
		{ id: "missing", label: "Missing", count: total - owned },
	]
	return (
		<div role="group" aria-label="Show" className="inline-flex rounded-xl border border-gray-600 bg-gray-800 p-0.5">
			{views.map((entry) => (
				<button
					key={entry.id}
					type="button"
					aria-pressed={view === entry.id}
					onClick={() => onView(entry.id)}
					className={`min-h-8 rounded-lg px-3 text-sm font-semibold transition ${
						view === entry.id ? "bg-gray-700 text-gray-100" : "text-gray-300 hover:text-gray-100"
					}`}
				>
					{entry.label} <span className={`font-medium ${view === entry.id ? "text-brand" : "text-gray-400"}`}>{entry.count}</span>
				</button>
			))}
		</div>
	)
}

/** The ⋯ menu: Start over, which asks once before emptying the list. */
function MoreMenu({ ownedCount, what, onClear }: {
	ownedCount: number
	/** "umas" / "support cards", for the confirmation. */
	what: string
	onClear: () => void
}) {
	const [open, setOpen] = useState(false)
	const [confirming, setConfirming] = useState(false)
	const ref = useRef<HTMLDivElement>(null)
	const close = () => {
		setOpen(false)
		setConfirming(false)
	}
	useDismiss(ref, open, close)
	return (
		<div ref={ref} className="relative">
			<button
				type="button"
				aria-label="More list actions"
				aria-expanded={open}
				onClick={() => (open ? close() : setOpen(true))}
				className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-600 bg-gray-800 text-gray-200 transition hover:border-brand hover:text-brand"
			>
				<MoreHorizontal className="h-4 w-4" />
			</button>
			{open && (
				<div className="absolute right-0 top-full z-30 mt-2 flex w-72 flex-col gap-2 rounded-xl border border-gray-600 bg-gray-800 p-3 shadow-lg">
					{confirming ? (
						<>
							<p className="text-sm text-gray-200">Remove all {ownedCount} {what}? This can&apos;t be undone.</p>
							<div className="flex gap-2">
								<button
									type="button"
									className={`${SMALL_BUTTON} border-highlight/60 text-highlight`}
									onClick={() => {
										close()
										onClear()
									}}
								>
									Remove all
								</button>
								<button type="button" className={SMALL_BUTTON} onClick={() => setConfirming(false)}>
									Keep
								</button>
							</div>
						</>
					) : (
						<>
							<button type="button" className={`${SMALL_BUTTON} self-start`} disabled={ownedCount === 0} onClick={() => setConfirming(true)}>
								Start over
							</button>
							<p className="text-xs text-gray-400">
								{ownedCount === 0 ? "Nothing to remove yet." : `Empties your ${what}, to mark them again or import them fresh.`}
							</p>
						</>
					)}
				</div>
			)}
		</div>
	)
}

/** Search, the view switch, anything else the grid adds, and the ⋯ menu; then the sorts. */
function Toolbar({ query, onQuery, placeholder, view, onView, ownedCount, total, what, onClear, extra, children }: {
	query: string
	onQuery: (query: string) => void
	placeholder: string
	view: RosterView
	onView: (view: RosterView) => void
	ownedCount: number
	total: number
	what: string
	onClear: () => void
	/** More controls on the first line (the cards' rarity chips). */
	extra?: ReactNode
	/** Lines under it (type chips, the sorts). */
	children?: ReactNode
}) {
	return (
		<div className="flex flex-col gap-2.5">
			<div className="flex flex-wrap items-center gap-2">
				<label className="relative min-w-48 flex-[0_1_19rem]">
					<span className="sr-only">Search</span>
					<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" aria-hidden="true" />
					<input type="search" value={query} onChange={(change) => onQuery(change.target.value)} placeholder={placeholder} className={`${CONTROL} w-full pl-9`} />
				</label>
				<ViewSwitch view={view} onView={onView} owned={ownedCount} total={total} />
				{extra}
				<span className="flex-1" />
				<MoreMenu ownedCount={ownedCount} what={what} onClear={onClear} />
			</div>
			{children}
		</div>
	)
}

/** A summary card above a grid: what the player owns at a glance, and the save line. */
function Summary({ label, children, status }: { label: string; children: ReactNode; status: ReactNode }) {
	return (
		<section aria-label={label} className="card-panel flex flex-wrap items-center gap-x-7 gap-y-3 px-5 py-3.5">
			{children}
			<span className="ml-auto">{status}</span>
		</section>
	)
}

function Figure({ value, label }: { value: ReactNode; label: ReactNode }) {
	return (
		<span className="flex flex-col">
			<span className="font-display text-xl font-bold text-gray-100">{value}</span>
			<span className="text-xs text-gray-400">{label}</span>
		</span>
	)
}

/**
 * The editor an owned tile opens, under it: a non-modal dialog that closes on
 * Escape, a press outside the tile, Done or ×. Centred under the tile and
 * nudged back inside the screen at the grid's edges.
 */
function TileEditor({ label, title, subtitle, onClose, onRemove, removeText, children }: {
	/** The dialog's accessible name. */
	label: string
	title: string
	subtitle?: string
	onClose: () => void
	onRemove: () => void
	removeText: string
	children: ReactNode
}) {
	const ref = useRef<HTMLDivElement>(null)
	useLayoutEffect(() => {
		const node = ref.current
		if (!node) return
		// Inside the /app gate, so the window is there to measure against.
		const box = node.getBoundingClientRect()
		const margin = 8
		const shift = box.left < margin ? margin - box.left : box.right > window.innerWidth - margin ? window.innerWidth - margin - box.right : 0
		node.style.marginLeft = `${shift}px`
		node.focus()
	}, [])
	return (
		<div
			ref={ref}
			role="dialog"
			aria-label={label}
			tabIndex={-1}
			className="absolute left-1/2 top-full z-20 mt-2.5 flex w-64 -translate-x-1/2 flex-col gap-3 rounded-2xl border border-gray-600 bg-gray-800 p-3.5 text-left shadow-xl outline-none"
		>
			<div className="flex items-start justify-between gap-2">
				<span className="flex min-w-0 flex-col">
					<span className="text-sm font-bold text-gray-100">{title}</span>
					{subtitle && <span className="truncate text-xs text-gray-400">{subtitle}</span>}
				</span>
				<button type="button" aria-label="Close" onClick={onClose} className="-m-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:text-gray-100">
					<X className="h-4 w-4" />
				</button>
			</div>
			{children}
			<div className="flex items-center justify-between gap-2 border-t border-edge pt-2.5">
				<button type="button" onClick={onRemove} className="min-h-9 px-1 text-sm font-semibold text-highlight hover:underline">
					{removeText}
				</button>
				<button type="button" onClick={onClose} className="min-h-9 rounded-lg bg-brand px-3.5 text-sm font-bold text-gray-900 transition hover:bg-brand/85">
					Done
				</button>
			</div>
		</div>
	)
}

/** One row of buttons in a tile editor (Stars, Potential, Limit break), one pressed. */
function Choices<Value extends number>({ label, values, current, onPick, face, name }: {
	label: string
	values: readonly Value[]
	current: Value | null
	onPick: (value: Value) => void
	face: (value: Value) => ReactNode
	name: (value: Value) => string
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<span className="text-xs font-semibold text-gray-300">{label}</span>
			<div role="group" aria-label={label} className="grid grid-cols-5 gap-1">
				{values.map((value) => (
					<button
						key={value}
						type="button"
						aria-pressed={current === value}
						aria-label={name(value)}
						onClick={() => onPick(value)}
						className={`h-10 rounded-lg border text-sm font-bold transition ${
							current === value ? "border-brand bg-brand/15 text-brand" : "border-gray-600 bg-gray-900/50 text-gray-200 hover:border-gray-500"
						}`}
					>
						{face(value)}
					</button>
				))}
			</div>
		</div>
	)
}

/**
 * A tile's open/close: the editor is open while `open`, and closing it by
 * keyboard or a button hands focus back to the tile. A press outside the tile
 * closes it and leaves focus where the press went.
 */
function useTileEditor(open: boolean, onToggle: (open: boolean) => void) {
	const tileRef = useRef<HTMLLIElement>(null)
	const buttonRef = useRef<HTMLButtonElement>(null)
	const close = () => {
		onToggle(false)
		buttonRef.current?.focus()
	}
	useDismiss(tileRef, open, () => onToggle(false))
	return { tileRef, buttonRef, close }
}

/** An outfit's base stars, what a tap adds her at: her rarity (1 to 3) in the game. */
const baseStars = (uma: CatalogueUma): number | null => (uma.rarity && uma.rarity >= 1 && uma.rarity <= 3 ? uma.rarity : null)

function UmaTile({ uma, row, oshi, veterans, open, onToggle, onEdit }: {
	uma: CatalogueUma
	row: OwnedUmaRow | undefined
	oshi: boolean
	/** How many of the player's veterans are this outfit: a link to them. */
	veterans: number
	open: boolean
	onToggle: (open: boolean) => void
	onEdit: (changes: RosterChanges) => void
}) {
	const { tileRef, buttonRef, close } = useTileEditor(open, onToggle)
	const set = (change: { stars?: number; talent_level?: number }) => onEdit({ umas: [{ uma: uma.id, owned: true, ...change }] })
	return (
		<li ref={tileRef} className="relative flex min-w-0 flex-col items-center gap-1.5">
			<button
				ref={buttonRef}
				type="button"
				data-tile=""
				aria-label={row ? `${uma.name}, owned` : uma.name}
				aria-haspopup={row ? "dialog" : undefined}
				aria-expanded={row ? open : undefined}
				title={row ? "Tap to change her stars or potential." : "Tap to add her."}
				onClick={() => (row ? onToggle(!open) : onEdit({ umas: [{ uma: uma.id, owned: true, stars: baseStars(uma) }] }))}
				className={`relative w-full rounded-[10.75%] transition ${open ? "ring-2 ring-brand ring-offset-2 ring-offset-gray-900" : ""}`}
			>
				<FramedUma src={uma.portrait ?? uma.image} oshi={oshi} alt="" className={`w-full transition ${row ? "" : "opacity-40 grayscale hover:opacity-70"}`} />
				{row ? (
					<>
						<span className="art-badge absolute inset-x-[9%] bottom-[8%] flex justify-center rounded-md text-xs leading-4 tracking-tighter" aria-hidden="true">
							{STAR_LEVELS.map((stars) => (
								<span key={stars} className={stars <= (row.stars ?? 0) ? "art-on" : "art-off"}>
									★
								</span>
							))}
						</span>
						{row.talent_level !== null && (
							<span className="art-badge absolute right-[8%] top-[8%] rounded-md px-1.5 text-[10.5px] font-bold leading-[17px]" aria-hidden="true">
								P{row.talent_level}
							</span>
						)}
					</>
				) : (
					<AddBadge />
				)}
			</button>
			<span className={`line-clamp-2 min-h-8 w-full text-center text-xs leading-tight ${row ? "text-gray-100" : "text-gray-400"}`}>{uma.name}</span>
			{veterans > 0 && (
				<Link to={`/app/collection?uma=${uma.id}`} className="-mt-1 text-[11.5px] font-medium text-brand hover:underline">
					{veterans === 1 ? "1 veteran" : `${veterans} veterans`}
				</Link>
			)}
			{open && row && (
				<TileEditor
					label={`${uma.name}: stars and potential`}
					title={uma.name}
					onClose={close}
					onRemove={() => {
						close()
						onEdit({ umas: [{ uma: uma.id, owned: false }] })
					}}
					removeText="Remove"
				>
					<Choices
						label="Stars"
						values={STAR_LEVELS}
						current={row.stars}
						onPick={(stars) => set({ stars })}
						face={(stars) => <span className={`text-lg leading-none ${stars <= (row.stars ?? 0) ? "text-brand" : "text-gray-500"}`}>★</span>}
						name={(stars) => (stars === 1 ? "1 star" : `${stars} stars`)}
					/>
					<Choices
						label="Potential"
						values={STAR_LEVELS}
						current={row.talent_level}
						onPick={(talent_level) => set({ talent_level })}
						face={(level) => level}
						name={(level) => `Potential ${level}`}
					/>
				</TileEditor>
			)}
		</li>
	)
}

function AddBadge() {
	return (
		<span className="absolute bottom-[7%] right-[7%] flex h-6 w-6 items-center justify-center rounded-full border border-gray-500 bg-gray-800 text-gray-200" aria-hidden="true">
			<Plus className="h-3.5 w-3.5" strokeWidth={2.6} />
		</span>
	)
}

export function OwnedUmasGrid({ umas, owned, releases, oshiIds, veteranCounts, status, onEdit, onClear }: {
	umas: CatalogueUma[]
	owned: OwnedUmaRow[]
	/** First Global banner start per uma, in ms (utils/cardRelease.ts). */
	releases: ReadonlyMap<number, number>
	oshiIds: ReadonlySet<number>
	/** How many veterans the player has of each outfit. */
	veteranCounts: ReadonlyMap<number, number>
	/** The save line (SaveStatus), drawn in the summary. */
	status: ReactNode
	onEdit: (changes: RosterChanges) => void
	onClear: () => void
}) {
	const [query, setQuery] = useState("")
	const [view, setView] = useState<RosterView>("all")
	const [steps, setSteps] = useState<Array<SortStep<UmaSortKey>>>([{ ...DEFAULT_SORT[0] }])
	const [editing, setEditing] = useState<number | null>(null)
	const byUma = new Map(owned.map((row) => [row.uma, row]))
	const offered = umas.filter((uma) => uma.on_global !== false)
	const ownedOffered = owned.filter((row) => offered.some((uma) => uma.id === row.uma))
	const summary = umaSummary(ownedOffered)
	const launch = earliestRelease(releases)
	const shown = sortBySteps(
		offered.filter((uma) => matches(uma.name, query) && inView(view, byUma.has(uma.id))),
		steps,
		(key, uma) => {
			const row = byUma.get(uma.id)
			if (key === "released") return releases.get(uma.id) ?? launch
			if (key === "acquired") return time(row?.obtained_at)
			if (key === "rarity") return uma.rarity
			if (key === "stars") return row?.stars
			if (key === "potential") return row?.talent_level
			return uma.name
		}
	)
	return (
		<section className="flex flex-col gap-4" aria-label="Umas you own">
			<Summary label="Your umas at a glance" status={status}>
				{/* Four across, a phone included, so the card stays short. */}
				<span className="grid w-full grid-cols-4 gap-3 sm:flex sm:w-auto sm:gap-6">
					{/* The count big, what it counts under it: "★5 4" ran together and read as 54. */}
					<Figure value={summary.five} label={<><span className="text-brand">★</span> five stars</>} />
					<Figure value={summary.four} label={<><span className="text-brand">★</span> four stars</>} />
					<Figure value={summary.threeOrFewer} label={<><span className="text-brand">★</span> three or fewer</>} />
					<Figure value={summary.potentialFive} label="at potential 5" />
				</span>
				<p className="min-w-0 flex-[1_1_16rem] text-sm text-gray-300">
					Tap an uma you own to change her stars or potential, or one you don&apos;t to add her.
				</p>
			</Summary>
			<Toolbar
				query={query}
				onQuery={setQuery}
				placeholder="Search by name"
				view={view}
				onView={setView}
				ownedCount={ownedOffered.length}
				total={offered.length}
				what="umas"
				onClear={onClear}
			>
				<SortBar steps={steps} options={UMA_SORTS} onChange={setSteps} />
			</Toolbar>
			<ul className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-x-3 gap-y-4">
				{shown.map((uma) => (
					<UmaTile
						key={uma.id}
						uma={uma}
						row={byUma.get(uma.id)}
						oshi={oshiIds.has(uma.id)}
						veterans={veteranCounts.get(uma.id) ?? 0}
						open={editing === uma.id}
						onToggle={(open) => setEditing(open ? uma.id : null)}
						onEdit={onEdit}
					/>
				))}
			</ul>
			{shown.length === 0 && <p className="text-sm text-gray-400">Nothing matches.</p>}
		</section>
	)
}

function CardTile({ card, row, open, onToggle, onEdit }: {
	card: CatalogueSupportCard
	row: OwnedCardRow | undefined
	open: boolean
	onToggle: (open: boolean) => void
	onEdit: (changes: RosterChanges) => void
}) {
	const { tileRef, buttonRef, close } = useTileEditor(open, onToggle)
	const named = `${card.name}${card.title ? ` (${card.title})` : ""}`
	const set = (change: { limit_break?: number; spare_copies?: number }) =>
		onEdit({ support_cards: [{ support_card: card.id, owned: true, ...change }] })
	const rarity = card.rarity ? RARITY_LABELS[card.rarity] : undefined
	return (
		<li ref={tileRef} className="relative flex min-w-0 flex-col gap-1.5">
			<button
				ref={buttonRef}
				type="button"
				data-tile=""
				aria-label={`${named}${row ? ", owned" : ""}`}
				aria-haspopup={row ? "dialog" : undefined}
				aria-expanded={row ? open : undefined}
				title={row ? "Tap to change its limit break or spare copies." : "Tap to add it."}
				onClick={() => (row ? onToggle(!open) : onEdit({ support_cards: [{ support_card: card.id, owned: true }] }))}
				className={`relative block w-full rounded-md transition ${open ? "ring-2 ring-brand ring-offset-2 ring-offset-gray-900" : ""}`}
			>
				{card.image ? (
					<img
						src={card.image}
						alt=""
						loading="lazy"
						decoding="async"
						className={`aspect-[3/4] w-full rounded-md object-cover transition ${row ? "" : "opacity-40 grayscale hover:opacity-70"}`}
					/>
				) : (
					<span className="block aspect-[3/4] w-full rounded-md bg-gray-700" aria-hidden="true" />
				)}
				{row ? (
					<>
						<span
							className="art-badge absolute inset-x-[6%] bottom-[5%] flex items-center justify-center gap-1.5 rounded-md py-1"
							data-testid="limit-break-badge"
						>
							<span className="flex gap-1" aria-hidden="true">
								{[0, 1, 2, 3].map((pip) => (
									<span key={pip} className={`h-1.5 w-1.5 rotate-45 ${pip < row.limit_break ? "art-pip-on" : "art-pip-off"}`} />
								))}
							</span>
							{row.limit_break >= 4 ? (
								<span className="art-on text-[10.5px] font-extrabold leading-none">MLB</span>
							) : (
								<span className="sr-only">{limitBreakLabel(row.limit_break)}</span>
							)}
						</span>
						{row.spare_copies > 0 && (
							<span className="art-badge absolute right-[6%] top-[5%] rounded-md px-1.5 text-[10.5px] font-bold leading-[17px]" title="Spare copies">
								+{row.spare_copies}
							</span>
						)}
					</>
				) : (
					<AddBadge />
				)}
			</button>
			<span className="flex min-w-0 flex-col">
				<span className={`flex min-w-0 items-center gap-1.5 text-xs font-semibold ${row ? "text-gray-100" : "text-gray-400"}`}>
					<span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CARD_TYPE_COLORS[card.card_type ?? ""] ?? "var(--color-gray-500)" }} aria-hidden="true" />
					<span className="truncate">{card.name}</span>
				</span>
				{card.title && <span className="truncate text-[11px] text-gray-400">{card.title}</span>}
			</span>
			{open && row && (
				<TileEditor
					label={`${card.name}: limit break and spare copies`}
					title={card.name}
					subtitle={[rarity, card.title].filter(Boolean).join(" · ")}
					onClose={close}
					onRemove={() => {
						close()
						onEdit({ support_cards: [{ support_card: card.id, owned: false }] })
					}}
					removeText="Remove"
				>
					<Choices
						label="Limit break"
						values={LIMIT_BREAKS}
						current={row.limit_break}
						onPick={(limit_break) => set({ limit_break })}
						face={(limitBreak) => (limitBreak >= 4 ? "MLB" : limitBreak)}
						name={limitBreakLabel}
					/>
					<div className="flex items-center justify-between gap-2">
						<span className="flex min-w-0 flex-col">
							<span className="text-xs font-semibold text-gray-300">Spare copies</span>
							<span className="text-[11px] text-gray-400">Beyond the one in use</span>
						</span>
						<span className="inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-gray-600 bg-gray-900/50 p-0.5">
							<button
								type="button"
								aria-label="One fewer spare copy"
								disabled={row.spare_copies <= 0}
								onClick={() => set({ spare_copies: row.spare_copies - 1 })}
								className="flex h-8 w-8 items-center justify-center rounded-md text-gray-200 hover:bg-gray-700 disabled:opacity-40"
							>
								<Minus className="h-4 w-4" />
							</button>
							<span className="min-w-6 text-center text-sm font-bold text-gray-100" aria-live="polite">
								{row.spare_copies}
							</span>
							<button
								type="button"
								aria-label="One more spare copy"
								disabled={row.spare_copies >= SPARE_COPIES_MAX}
								onClick={() => set({ spare_copies: row.spare_copies + 1 })}
								className="flex h-8 w-8 items-center justify-center rounded-md text-gray-200 hover:bg-gray-700 disabled:opacity-40"
							>
								<Plus className="h-4 w-4" />
							</button>
						</span>
					</div>
				</TileEditor>
			)}
		</li>
	)
}

export function OwnedCardsGrid({ cards, owned, releases, status, onEdit, onClear }: {
	cards: CatalogueSupportCard[]
	owned: OwnedCardRow[]
	/** First Global banner start per card, in ms (utils/cardRelease.ts). */
	releases: ReadonlyMap<number, number>
	/** The save line (SaveStatus), drawn in the summary. */
	status: ReactNode
	onEdit: (changes: RosterChanges) => void
	onClear: () => void
}) {
	const [query, setQuery] = useState("")
	const [view, setView] = useState<RosterView>("all")
	const [cardType, setCardType] = useState<string | null>(null)
	const [rarity, setRarity] = useState<number | null>(null)
	const [steps, setSteps] = useState<Array<SortStep<CardSortKey>>>([{ ...DEFAULT_SORT[0] }])
	const [editing, setEditing] = useState<number | null>(null)
	const byCard = new Map(owned.map((row) => [row.support_card, row]))
	const offered = cards.filter((card) => card.on_global !== false)
	const summary = cardSummary(offered, owned, CARD_TYPES)
	const shown = sortBySteps(
		offered.filter(
			(card) =>
				(matches(card.name, query) || matches(card.title, query)) &&
				inView(view, byCard.has(card.id)) &&
				(cardType === null || card.card_type === cardType) &&
				(rarity === null || card.rarity === rarity)
		),
		steps,
		(key, card) => {
			const row = byCard.get(card.id)
			if (key === "released") return collectionCardRelease(card, releases)
			if (key === "acquired") return time(row?.obtained_at)
			if (key === "rarity") return card.rarity
			if (key === "limit_break") return row?.limit_break
			if (key === "type") return typeRank(card.card_type)
			return card.name
		}
	)
	return (
		<section className="flex flex-col gap-4" aria-label="Support cards you own">
			<Summary label="Your support cards at a glance" status={status}>
				<Figure value={<><span className="text-brand">{summary.mlb}</span> at MLB</>} label={`of the ${summary.owned} you own`} />
				{/* Three across on a phone: at four, "Stamina" and "Friend" were cut to "Sta" and "Frien". */}
				<ul className="grid min-w-0 flex-[1_1_28rem] grid-cols-3 gap-x-3 gap-y-2 sm:grid-cols-4 lg:grid-cols-7">
					{summary.byType.map((entry) => (
						<li key={entry.type} className="flex min-w-0 flex-col gap-1">
							<span className="flex items-center justify-between gap-1 text-xs">
								<span className="flex items-center gap-1.5 truncate text-gray-200">
									<span className="h-2 w-2 shrink-0 rounded-full" style={{ background: CARD_TYPE_COLORS[entry.type] }} aria-hidden="true" />
									{CARD_TYPE_LABELS[entry.type]}
								</span>
								<span className="tabular-nums text-gray-400">
									{entry.owned}/{entry.total}
								</span>
							</span>
							<span className="block h-1 overflow-hidden rounded-full bg-gray-700" aria-hidden="true">
								<span
									className="block h-full rounded-full"
									style={{ width: `${entry.total ? (entry.owned / entry.total) * 100 : 0}%`, background: CARD_TYPE_COLORS[entry.type] }}
								/>
							</span>
						</li>
					))}
				</ul>
			</Summary>
			<Toolbar
				query={query}
				onQuery={setQuery}
				placeholder="Search a name or a title"
				view={view}
				onView={setView}
				ownedCount={summary.owned}
				total={offered.length}
				what="support cards"
				onClear={onClear}
				extra={
					<div className="flex gap-1" role="group" aria-label="Rarity">
						{RARITIES.map((entry) => (
							<button
								key={entry.rarity}
								type="button"
								aria-pressed={rarity === entry.rarity}
								onClick={() => setRarity(rarity === entry.rarity ? null : entry.rarity)}
								className={PILL(rarity === entry.rarity)}
							>
								{entry.label}
							</button>
						))}
					</div>
				}
			>
				<div className="flex flex-wrap gap-1.5" role="group" aria-label="Card type">
					{CARD_TYPES.map((type) => (
						<button key={type} type="button" aria-pressed={cardType === type} onClick={() => setCardType(cardType === type ? null : type)} className={PILL(cardType === type)}>
							<span className="h-2 w-2 rounded-full" style={{ background: CARD_TYPE_COLORS[type] }} aria-hidden="true" />
							{CARD_TYPE_LABELS[type]}
						</button>
					))}
				</div>
				<SortBar steps={steps} options={CARD_SORTS} onChange={setSteps} />
			</Toolbar>
			<ul className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-x-3 gap-y-4">
				{shown.map((card) => (
					<CardTile
						key={card.id}
						card={card}
						row={byCard.get(card.id)}
						open={editing === card.id}
						onToggle={(open) => setEditing(open ? card.id : null)}
						onEdit={onEdit}
					/>
				))}
			</ul>
			{shown.length === 0 && <p className="text-sm text-gray-400">Nothing matches.</p>}
		</section>
	)
}
