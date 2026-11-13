/**
 * The filter bar the three lists share: one card holding the search box, the
 * count of what matched, and each filter as a small caps label with its
 * chips, so nobody has to work out what a bare row of chips does
 * (encyclopedia.css, ".enc-toolbar"). On a phone a filter's chips are one row
 * that scrolls sideways.
 */

import type { CSSProperties, ReactNode } from "react"
import { Search } from "lucide-react"

/** The card: `search` and `count` on its first line, the filters under them. */
export function Toolbar({ search, count, children }: { search: ReactNode; count?: ReactNode; children: ReactNode }) {
	return (
		<div className="enc-toolbar">
			<div className="enc-toolbar__top">
				{search}
				{count}
			</div>
			<div className="enc-filters">{children}</div>
		</div>
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
 * One filter: its name, then a chip per choice. `dot` is a choice's own
 * colour (a card type, a skill's kind), always beside its word.
 */
export function Chips<T extends string>({ label, options, value, onChange }: {
	label: string
	options: { value: T; label: string; dot?: string }[]
	value: T
	onChange: (value: T) => void
}) {
	return (
		<div role="group" aria-label={label} className="enc-filter">
			{/* The group is already named for a screen reader; this is the same name for the eye. */}
			<span className="enc-filter__label" aria-hidden="true">{label}</span>
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
