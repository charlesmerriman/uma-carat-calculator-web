/**
 * A list's grid with its group headings and the thumb index down its left
 * edge, as a printed encyclopedia has them (the redesign,
 * notes/encyclopedia-redesign-plan.md). Letters when sorted by name; a
 * quarter, an id block, a rarity, a grade or a value for the other sorts
 * (utils/encyclopediaGroups.ts says which).
 *
 * However the list is filtered (owner, 2026-11-25). `groupsFor` decides;
 * with no groups (an empty list) this draws the plain grid.
 */

import { Fragment, type ReactNode } from "react"
import { useReducedMotion } from "framer-motion"
import { firstRows, groupId, indexEntries, rowsBefore, type ListGroup } from "../../utils/encyclopediaGroups"

/**
 * `limit` draws only the first rows (the Skills list, a page at a time); the
 * index still lists every group, and a jump to one not drawn yet asks
 * `onReveal` for enough rows to reach it, then scrolls once it is drawn.
 */
export function GroupedGrid<T>({ scope, items, groups, tile, noun, className, limit, onReveal }: {
	scope: string
	items: T[]
	groups: ListGroup<T>[] | null
	tile: (item: T) => ReactNode
	noun: [string, string]
	className: string
	limit?: number
	onReveal?: (rows: number) => void
}) {
	const drawn = groups && limit !== undefined ? firstRows(groups, limit) : groups
	const reveal = groups && onReveal ? (key: string) => onReveal(rowsBefore(groups, key)) : undefined
	return (
		<div className="enc-listwrap">
			{groups && <GroupIndex scope={scope} groups={groups} reveal={reveal} />}
			<ul className={className}>
				{drawn
					? drawn.map((group) => (
						<Fragment key={group.key}>
							<GroupHeading scope={scope} group={group} noun={noun} />
							{group.items.map(tile)}
						</Fragment>
					))
					: (limit !== undefined ? items.slice(0, limit) : items).map(tile)}
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
	const count = group.total ?? group.items.length
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
function GroupIndex<T>({ scope, groups, reveal }: { scope: string; groups: ListGroup<T>[]; reveal?: (key: string) => void }) {
	const reducedMotion = useReducedMotion()
	const entries = indexEntries(groups)
	// Years and ids ("2025", "100") need a wider column than letters.
	const wide = entries.some((entry) => entry.label.length > 2)
	if (entries.length === 0) return null
	const jump = (key: string) => {
		const scroll = () => document.getElementById(groupId(scope, key))?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" })
		if (document.getElementById(groupId(scope, key)) || !reveal) return scroll()
		// Not drawn yet: draw up to it, then scroll once React has painted it.
		reveal(key)
		requestAnimationFrame(() => requestAnimationFrame(scroll))
	}
	return (
		<nav aria-label="Jump to a section" className={wide ? "enc-index enc-index--wide" : "enc-index"}>
			{entries.map((entry) => (
				<button
					key={entry.key}
					type="button"
					onClick={() => jump(entry.key)}
				>
					{entry.label}
				</button>
			))}
		</nav>
	)
}
