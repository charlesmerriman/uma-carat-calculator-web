/**
 * A list's grid with its group headings and the thumb index down its left
 * edge, as a printed encyclopedia has them (the redesign,
 * notes/encyclopedia-redesign-plan.md). Letters when sorted by name; a
 * quarter, an id block, a rarity, a grade or a value for the other sorts
 * (utils/encyclopediaGroups.ts says which).
 *
 * Filtered or not (owner, 2026-11-25); only a list of a handful is one plain
 * grid. `groupsFor` decides; with no groups this draws the plain grid.
 */

import { Fragment, type ReactNode } from "react"
import { useReducedMotion } from "framer-motion"
import { groupId, indexEntries, type ListGroup } from "../../utils/encyclopediaGroups"

export function GroupedGrid<T>({ scope, items, groups, tile, noun, className }: {
	scope: string
	items: T[]
	groups: ListGroup<T>[] | null
	tile: (item: T) => ReactNode
	noun: [string, string]
	className: string
}) {
	return (
		<div className="enc-listwrap">
			{groups && <GroupIndex scope={scope} groups={groups} />}
			<ul className={className}>
				{groups
					? groups.map((group) => (
						<Fragment key={group.key}>
							<GroupHeading scope={scope} group={group} noun={noun} />
							{group.items.map(tile)}
						</Fragment>
					))
					: items.map(tile)}
			</ul>
		</div>
	)
}

/**
 * A group's heading inside the grid: it spans the row. `role="presentation"`
 * keeps it out of the list's items for a screen reader; the heading inside
 * still names the run. A long label ("Q3 2025") is set a size down from a
 * letter, and a tail group's ("No date") smaller again.
 */
function GroupHeading<T>({ scope, group, noun }: { scope: string; group: ListGroup<T>; noun: [string, string] }) {
	const count = group.items.length
	const extra = [group.note, group.mark].filter(Boolean).join(", ")
	return (
		<li
			role="presentation"
			id={groupId(scope, group.key)}
			className="enc-letter"
			data-tone={group.tone}
			data-size={group.tail ? "tail" : group.label.length > 3 ? "long" : undefined}
		>
			<h2>{group.label}</h2>
			<span>
				{count} {count === 1 ? noun[0] : noun[1]}
				{extra && ` · ${extra}`}
			</span>
		</li>
	)
}

/** The thumb index: one button per index label the list has, jumping to its first heading. Wide screens only. */
function GroupIndex<T>({ scope, groups }: { scope: string; groups: ListGroup<T>[] }) {
	const reducedMotion = useReducedMotion()
	const entries = indexEntries(groups)
	// Years and ids ("2025", "100") need a wider column than letters.
	const wide = entries.some((entry) => entry.label.length > 2)
	return (
		<nav aria-label="Jump to a section" className={wide ? "enc-index enc-index--wide" : "enc-index"}>
			{entries.map((entry) => (
				<button
					key={entry.key}
					type="button"
					onClick={() => document.getElementById(groupId(scope, entry.key))?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" })}
				>
					{entry.label}
				</button>
			))}
		</nav>
	)
}
