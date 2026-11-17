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

import type { CSSProperties, ReactNode } from "react"
import { ArrowDownUp, RotateCcw, Search } from "lucide-react"
import { resetRememberedFilters, useHasRememberedFilters } from "../../hooks/useRememberedFilter"
import { directionWords } from "../../utils/encyclopedia"

/** The card: `search` and `count` on its first line, then the shared `settings`, then the filters. */
export function Toolbar({ search, count, scope, settings, children }: {
	search: ReactNode
	count?: ReactNode
	/** The list's remembered-filter scope ("cards"); with it, a "Reset filters" button shows while anything is set. */
	scope?: string
	/** Where and Collection: one setting for every list, so Reset leaves them (utils/encyclopedia.ts SHARED_WHERE_KEY). */
	settings?: ReactNode
	children: ReactNode
}) {
	return (
		<div className="enc-toolbar">
			<div className="enc-toolbar__top">
				{search}
				<div className="enc-toolbar__end">
					{scope && <ResetFilters scope={scope} />}
					{count}
				</div>
			</div>
			{/* One grid for both, so every row's chips start at one left edge. */}
			<div className="enc-filters">
				{settings && (
					<>
						{settings}
						<p className="enc-filters__divider">Set once for every list</p>
					</>
				)}
				{children}
			</div>
		</div>
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
