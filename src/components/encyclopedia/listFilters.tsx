/**
 * The filter bar the three lists share: one card holding the search box, the
 * count of what matched, the settings every list shares (Where, Collection),
 * and each filter as a small caps label with its chips, so nobody has to work
 * out what a bare row of chips does (encyclopedia.css, ".enc-toolbar").
 *
 * The board's "Encyclopedia Filter Changes" (Daptrius, 2026-11-17) set the
 * look: the chips of every row start at one left edge, whatever the label's
 * length (a grid, label above on a phone); the first chip of every row says
 * "All"; a type is its icon and a rarity lights up in its metal; and Sort is a
 * menu with a button that turns it round.
 */

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react"
import { ArrowDownUp, ChevronDown, RotateCcw, Search, SlidersHorizontal } from "lucide-react"
import { resetRememberedFilters, useHasRememberedFilters, useRememberedFilter } from "../../hooks/useRememberedFilter"
import { directionWords } from "../../utils/encyclopedia"

/**
 * The card: `search` and `count` on its first line, then the shared `settings`, then the filters.
 *
 * `pinned` (the Encyclopedia's three lists; Daptrius, board "Encyclopedia
 * sticky nav", 2026-11-25): the first line becomes a bar that stays in view
 * under the screen's bar while the list scrolls, with a Filters button that
 * shows and hides the filters under it. The filters drop down from the bar
 * wherever the list is scrolled to, so they are always one click away and
 * never in the way. Closed or open is remembered for the tab, for every list
 * at once.
 */
export function Toolbar({ search, count, scope, settings, pinned = false, children }: {
	search: ReactNode
	count?: ReactNode
	/** The list's remembered-filter scope ("cards"); with it, a "Reset filters" button shows while anything is set. */
	scope?: string
	/** Where and Collection: one setting for every list, so Reset leaves them (utils/encyclopedia.ts SHARED_WHERE_KEY). */
	settings?: ReactNode
	pinned?: boolean
	children: ReactNode
}) {
	// One grid for both, so every row's chips start at one left edge.
	const filters = (
		<div className="enc-filters">
			{settings && (
				<>
					{settings}
					<p className="enc-filters__divider">Set once for every list</p>
				</>
			)}
			{children}
		</div>
	)
	const end = (
		<>
			{scope && <ResetFilters scope={scope} />}
			{count}
		</>
	)
	if (pinned) return <PinnedToolbar search={search} end={end} scope={scope}>{filters}</PinnedToolbar>
	return (
		<div className="enc-toolbar">
			<div className="enc-toolbar__top">
				{search}
				<div className="enc-toolbar__end">{end}</div>
			</div>
			{filters}
		</div>
	)
}

// Outside every list's own scope ("skills:"), so Reset filters leaves it alone.
const FILTERS_OPEN_KEY = "enc-panel:filters"
const FLAG_VALUES = ["0", "1"] as const

/**
 * The pinned bar and its filters (Toolbar's `pinned`). Two ways to show the
 * filters, one button:
 *
 *   - AT THE TOP of the list they sit under the bar in the page, as before,
 *     and the button folds them away (remembered for the tab, every list).
 *   - SCROLLED DOWN, with those out of sight above, the button drops the
 *     same filters down from the pinned bar, over the list, scrolling inside
 *     themselves when tall. Scrolling back to the top folds the drop-down.
 *
 * Why not one block that pins with its filters: the filters would then cover a
 * third of the screen all the way down, and folding them when the bar pinned
 * would pull the list up under the reader by their height.
 *
 * `data-popup-top-bar` keeps a skill's card below the bar (pvp/hoverPopup.tsx).
 */
function PinnedToolbar({ search, end, scope, children }: { search: ReactNode; end: ReactNode; scope?: string; children: ReactNode }) {
	const [openFlag, setOpenFlag] = useRememberedFilter<"0" | "1">(FILTERS_OPEN_KEY, "1", FLAG_VALUES)
	const open = openFlag === "1"
	// A mark on the button while a filter, the sort or the search is set, so
	// filters out of sight never narrow the list unannounced.
	const active = useHasRememberedFilters(scope ?? "")
	const finderRef = useRef<HTMLDivElement>(null)
	const panelRef = useRef<HTMLDivElement>(null)
	// True while the filters in the page are out of sight under the pinned bar
	// (or folded) and the bar is pinned: the button then works the drop-down.
	const [away, setAway] = useState(false)
	const [dropped, setDropped] = useState(false)
	useEffect(() => {
		let frame = 0
		const measure = () => {
			frame = 0
			const finder = finderRef.current
			if (!finder) return
			const bar = finder.getBoundingClientRect()
			// Pinned: sitting right under the screen's bar, whichever scroller moves. Read off
			// the bar's ruler, which is the bar's full height whether or not the bar has
			// shown yet (components/ScreenHeader.tsx, `data-screen-bar-line`).
			const tabs = document.querySelector("[data-screen-bar-line]")?.getBoundingClientRect()
			const pinnedNow = tabs !== undefined && bar.height > 0 && Math.abs(bar.top - tabs.bottom) < 1
			const panel = panelRef.current?.getBoundingClientRect()
			const panelInSight = panel !== undefined && panel.height > 0 && panel.bottom > bar.bottom + 8
			const next = pinnedNow && !panelInSight
			setAway(next)
			if (!next) setDropped(false)
		}
		const later = () => {
			if (!frame) frame = requestAnimationFrame(measure)
		}
		// Capture: the desktop shell scrolls an inner box, and a scroll doesn't bubble.
		window.addEventListener("scroll", later, { capture: true, passive: true })
		window.addEventListener("resize", later)
		measure()
		return () => {
			cancelAnimationFrame(frame)
			window.removeEventListener("scroll", later, { capture: true })
			window.removeEventListener("resize", later)
		}
	}, [])
	const panelId = useId()
	const dropId = useId()
	const expanded = away ? dropped : open
	return (
		<>
			<div ref={finderRef} className="enc-finder" data-popup-top-bar="">
				<div className="enc-finder__bar">
					{search}
					<div className="enc-toolbar__end">
						{end}
						<button
							type="button"
							className="enc-finder__toggle"
							aria-expanded={expanded}
							aria-controls={away ? dropId : panelId}
							onClick={() => (away ? setDropped(!dropped) : setOpenFlag(open ? "0" : "1"))}
						>
							<SlidersHorizontal aria-hidden="true" />
							Filters
							{scope && active && (
								<>
									<span className="enc-finder__on" aria-hidden="true" />
									<span className="sr-only"> (some set)</span>
								</>
							)}
							<ChevronDown aria-hidden="true" className="enc-finder__chevron" />
						</button>
					</div>
				</div>
				{away && dropped && (
					<div id={dropId} className="enc-finder__drop enc-toolbar">
						{children}
					</div>
				)}
			</div>
			{/* The filters in the page. Out of reach while the drop-down holds the same chips. */}
			<div ref={panelRef} id={panelId} className="enc-toolbar" hidden={!open} inert={away && dropped}>
				{children}
			</div>
		</>
	)
}

/** A filter's name, with its narrow-screen word when it has one ("Dist."). */
function FilterLabel({ label, short }: { label: string; short?: string }) {
	// The group is already named for a screen reader; this is the same name for the eye.
	return (
		<span className="enc-filter__label" aria-hidden="true">
			{short ? <Words label={label} short={short} /> : label}
		</span>
	)
}

/** A word and its short form; CSS shows one by the screen's width (".enc-word"). */
function Words({ label, short }: { label: string; short: string }) {
	return (
		<>
			<span className="enc-word">{label}</span>
			<span className="enc-word enc-word--short">{short}</span>
		</>
	)
}

/**
 * Clears the search box, every filter and the sort in one go. Hidden while
 * everything is already at its default, so it never sits there doing nothing.
 */
function ResetFilters({ scope }: { scope: string }) {
	const active = useHasRememberedFilters(scope)
	if (!active) return null
	return (
		<button type="button" className="enc-reset" onClick={() => resetRememberedFilters(scope)}>
			<RotateCcw aria-hidden="true" />
			Reset filters
		</button>
	)
}

/** `label` names the box for a screen reader; `placeholder` may say more ("by skill or uma name"). */
export function SearchBox({ label, placeholder, value, onChange }: {
	label: string
	placeholder?: string
	value: string
	onChange: (value: string) => void
}) {
	return (
		<div className="enc-search">
			<Search aria-hidden="true" />
			<input
				type="search"
				aria-label={label}
				placeholder={placeholder ?? `${label}...`}
				value={value}
				onChange={(event) => onChange(event.target.value)}
			/>
		</div>
	)
}

/** "112 umas": how many matched, announced politely as the filters change. */
export function Count({ children }: { children: string }) {
	return <p className="enc-count" aria-live="polite">{children}</p>
}

/**
 * One filter with a single choice (Where, Collection, the effect sort's
 * limit break): its name, then a chip per choice. `dot` is a choice's own
 * colour, always beside its word.
 */
export function Chips<T extends string>({ label, options, value, onChange }: {
	label: string
	options: { value: T; label: string; dot?: string }[]
	value: T
	onChange: (value: T) => void
}) {
	return (
		<div role="group" aria-label={label} className="enc-filter">
			<FilterLabel label={label} />
			<div className="enc-filter__chips">
				{options.map((option) => (
					<button
						key={option.value}
						type="button"
						aria-pressed={value === option.value}
						onClick={() => onChange(option.value)}
						className="enc-chip"
					>
						{option.dot && <span className="enc-dot" style={{ "--dot": option.dot } as CSSProperties} aria-hidden="true" />}
						{option.label}
					</button>
				))}
			</div>
		</div>
	)
}

/** A choice in a multi-pick row. One of `icon` (drawn alone, the word kept for a screen reader), `dot` or `tone` may dress it. */
export interface PickOption<T extends string> {
	value: T
	label: string
	/** The chip's word on a narrow screen ("Med."). */
	short?: string
	dot?: string
	/** A picture that stands for the word: a card type's icon. */
	icon?: string
	/** A look the chip takes when picked: "ssr", "sr", "r" light up in the rarity's metal. */
	tone?: string
}

/**
 * One filter that takes several picks at once (board "Allow Encyclopedia
 * Filtering to select multiple items", 2026-11-17): "All", then a chip per
 * choice that turns on and off. Nothing picked is "All". `even` gives every
 * chip one width, so the uma list's aptitude rows line up as a grid.
 * `after` goes under the chips: the aptitude rows' "at least" grades.
 * `onToggle` replaces the plain on/off for a row whose picks hold more than
 * its chips (the skills' Type, whose picks may be sub-types).
 */
export function PickChips<T extends string>({ label, short, options, picks, onChange, onToggle, even = false, after }: {
	label: string
	short?: string
	options: PickOption<T>[]
	picks: readonly T[]
	onChange: (picks: T[]) => void
	onToggle?: (value: T) => void
	even?: boolean
	after?: ReactNode
}) {
	const toggle = onToggle ?? ((value: T) => onChange(picks.includes(value) ? picks.filter((pick) => pick !== value) : [...picks, value]))
	return (
		<div role="group" aria-label={label} className="enc-filter">
			<FilterLabel label={label} short={short} />
			<div className={`enc-filter__chips${even ? " enc-filter__chips--even" : ""}`}>
				<button type="button" aria-pressed={picks.length === 0} onClick={() => onChange([])} className="enc-chip">
					All
				</button>
				{options.map((option) => (
					<button
						key={option.value}
						type="button"
						aria-pressed={picks.includes(option.value)}
						// A short word or an icon would otherwise rename the chip for a screen reader.
						aria-label={option.short || option.icon ? option.label : undefined}
						title={option.icon ? option.label : undefined}
						onClick={() => toggle(option.value)}
						className={`enc-chip${option.icon ? " enc-chip--icon" : ""}${option.tone ? ` enc-chip--${option.tone}` : ""}`}
					>
						{option.icon ? (
							<img src={option.icon} alt="" aria-hidden="true" />
						) : (
							<>
								{option.dot && <span className="enc-dot" style={{ "--dot": option.dot } as CSSProperties} aria-hidden="true" />}
								{option.short ? <Words label={option.label} short={option.short} /> : option.label}
							</>
						)}
					</button>
				))}
				{after && <div className="enc-filter__after">{after}</div>}
			</div>
		</div>
	)
}

/**
 * A filter row whose choice is one of many (an effect type): its name, then a
 * native select, which a phone shows as its own picker.
 */
export function SelectFilter({ label, options, value, onChange }: {
	label: string
	options: { value: string; label: string }[]
	value: string
	onChange: (value: string) => void
}) {
	return (
		<div className="enc-filter">
			<FilterLabel label={label} />
			<div className="enc-filter__chips">
				<label className="enc-grade">
					<select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
						{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
					</select>
				</label>
			</div>
		</div>
	)
}

/**
 * The Sort row (board "Make Sort into a Dropdown with reversable directions",
 * 2026-11-17): a menu of sorts, then a button that turns the order round and
 * says which way it runs now ("Newest first"). An option with a `group` goes
 * under that heading in the menu (the uma list's aptitudes).
 */
export function SortControl<T extends string>({ options, value, onChange, reversed, onReverse }: {
	options: { value: T; label: string; group?: string }[]
	value: T
	onChange: (value: T) => void
	reversed: boolean
	onReverse: () => void
}) {
	const loose = options.filter((option) => !option.group)
	const groups = [...new Set(options.flatMap((option) => (option.group ? [option.group] : [])))]
	return (
		<div role="group" aria-label="Sort" className="enc-filter">
			<FilterLabel label="Sort" />
			<div className="enc-filter__chips">
				<label className="enc-grade">
					<select aria-label="Sort by" value={value} onChange={(event) => onChange(event.target.value as T)}>
						{loose.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
						{groups.map((group) => (
							<optgroup key={group} label={group}>
								{options.filter((option) => option.group === group).map((option) => (
									<option key={option.value} value={option.value}>{option.label}</option>
								))}
							</optgroup>
						))}
					</select>
				</label>
				<button type="button" className="enc-chip" title="Turn the order round" onClick={onReverse}>
					<ArrowDownUp className="h-3.5 w-3.5" aria-hidden="true" />
					{directionWords(value, reversed)}
				</button>
			</div>
		</div>
	)
}

/**
 * "Turf at least [A]": the lowest grade one picked aptitude column lets
 * through. A native select, so a phone gets its own picker for eight grades
 * rather than eight more chips.
 */
export function GradeSelect({ label, column, options, value, onChange }: {
	/** Names the select for a screen reader: "Lowest Mile grade". */
	label: string
	/** The column's word before "at least". */
	column: string
	options: { value: string; label: string }[]
	value: string
	onChange: (value: string) => void
}) {
	return (
		<label className="enc-grade">
			<span aria-hidden="true">{column} at least</span>
			<select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
				{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
			</select>
		</label>
	)
}
