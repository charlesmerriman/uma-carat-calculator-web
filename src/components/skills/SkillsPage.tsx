/**
 * The Skills page (/app/skills): every skill with a name (in Japanese when it has no English one), global's
 * and JP's, from GET /skills. Search by any name a skill has had, its id or an
 * uma's name, filter by colours, types and where it is, sort by name, id or
 * skill point cost either way round. A row opens the skill's own page
 * (/app/skills/<game id>, SkillPage), and hovering one opens its card; an old
 * `?skill=<game id>` link redirects to the page.
 *
 * The list is long (~2,200), so it draws a page of rows and grows as the
 * last one scrolls into view ("Show more" does the same by hand). Like the
 * Umas and Support cards lists it files under headings for every sort, with
 * a jump list down the side (encyclopedia/groups.tsx): letters by name, the
 * cost by cost, an id block by game ID.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { Navigate, useSearchParams } from "react-router-dom"
import { rememberSkillRowsDrawn, skillRowsDrawn, useSkillListState } from "../../hooks/useSkillList"
import { usePvpCatalogue } from "../../hooks/usePvpCatalogue"
import { useCatalogueCounts } from "../../hooks/useCatalogueCounts"
import { reportCounts } from "../../utils/encyclopediaCounts"
import { EncyclopediaFrame, EncyclopediaTabs } from "../encyclopedia/EncyclopediaTabs"
import { Chips, Count, PickChips, SearchBox, SortControl, Toolbar } from "../encyclopedia/listFilters"
import { EmptyNote } from "../encyclopedia/pieces"
import { SkillRow } from "../encyclopedia/skillRows"
import { GroupedGrid } from "../encyclopedia/groups"
import { costKey, groupsFor, letterKey, mergeSmallGroups, skillIdKey } from "../../utils/encyclopediaGroups"
import {
	PAGE_CONTAINER, REVERSED_VALUES, SHARED_WHERE_KEY, SHARED_WHERE_VALUES, countLine, sortByValue, sortList, umaColourLookup, values,
	type SharedWhere,
} from "../../utils/encyclopedia"
import { useRememberedFilter, useRememberedPicks } from "../../hooks/useRememberedFilter"
import {
	COLOUR_FILTERS, DOES_TAGS, RACE_TAGS, SKILL_PARAM, SKILL_TYPE_WORDS, STYLE_TAGS, TYPE_FILTERS, UMATL_URL, WHEN_TAGS, WHERE_FILTERS,
	filterSkills, parseSkillParam, pickedParents, skillHref, subTypePicks, toggleSubTypePick, toggleTypePick,
	type ColourFilter, type SkillTag, type TagMatch, type TypeFilter,
} from "../../utils/skillSearch"

/** The Skills list's sorts: a skill has no release date of its own, but has a cost (Daptrius, 2026-11-17). */
type SkillSortOrder = "name" | "game_id" | "cost"
const SKILL_SORT_OPTIONS: { value: SkillSortOrder; label: string }[] = [
	{ value: "name", label: "Name" },
	{ value: "game_id", label: "Game ID" },
	{ value: "cost", label: "Skill point cost" },
]

const PAGE = 60

// "Match": a skill must carry every picked condition and effect, or any one is enough (Daptrius's list, item 2).
const MATCH_OPTIONS: { value: TagMatch; label: string }[] = [
	{ value: "all", label: "All of them" },
	{ value: "any", label: "Any of them" },
]

/**
 * Each colour's dot on its filter chip, the hue its rows wear down their left
 * edge (encyclopedia.css, ".enc-skill"): the game's gold, pink and a unique's
 * violet are fixed; white and inherited take the theme's greys.
 */
const COLOUR_DOTS: Partial<Record<ColourFilter, string>> = {
	white: "var(--color-gray-300)",
	gold: "#e8b51a",
	unique: "#c9b1ff",
	inherited: "var(--color-gray-500)",
	evolved: "#f28cbc",
}
const COLOUR_OPTIONS = COLOUR_FILTERS.map((option) => ({ ...option, dot: COLOUR_DOTS[option.value] }))
// The chip row draws "All" itself. No "Unique" chip: the Color filter already
// has Unique, Inherited and Evolved, and the type only caught the skills the
// game data gives no icon (Daptrius, 2026-11-13). The type stays in
// TYPE_FILTERS so a row still has its word.
const TYPE_OPTIONS = TYPE_FILTERS.filter(({ value }) => value !== "all" && value !== "unique")
// Every value the Type filter can hold: the chips and their sub-types' chips.
const TYPE_VALUES = TYPE_OPTIONS.flatMap(({ value, subs }) => [value, ...(subs ?? []).map((sub) => sub.value)])

/**
 * Part of the Encyclopedia, open to everyone since 2026-11-18. The route is
 * prerendered and in the sitemap like every /app tab: the shell and its head
 * tags at build time, the list itself in the browser.
 */
export const SkillsPage = () => {
	// An old link (Discord, a bookmark) named the skill as ?skill=<id>; its page is its own address now.
	const [searchParams] = useSearchParams()
	const oldLink = parseSkillParam(searchParams.get(SKILL_PARAM))
	if (oldLink !== null) return <Navigate to={skillHref(oldLink)} replace />
	return (
		<EncyclopediaFrame>
			<SkillsPageBody />
		</EncyclopediaFrame>
	)
}

const SkillsPageBody = () => {
	const list = useSkillListState()
	// Remembered for the tab, so a trip to a skill's page and back keeps them (useRememberedFilter).
	const [query, setQuery] = useRememberedFilter<string>("skills:query", "")
	const [colours, setColours] = useRememberedPicks<ColourFilter>("skills:colour", values(COLOUR_FILTERS))
	// Where is the setting every list shares (SHARED_WHERE_KEY); only skills have "Coming to global".
	const [where, setWhere] = useRememberedFilter<SharedWhere>(SHARED_WHERE_KEY, "all", SHARED_WHERE_VALUES)
	const [types, setTypes] = useRememberedPicks<TypeFilter>("skills:type", TYPE_VALUES)
	const [sort, setSort] = useRememberedFilter<SkillSortOrder>("skills:sort", "name", values(SKILL_SORT_OPTIONS))
	const [reversedFlag, setReversed] = useRememberedFilter<string>("skills:sort-reversed", "0", REVERSED_VALUES)
	const reversed = reversedFlag === "1"
	// The condition and effect filters, one remembered row each so Reset clears them with the rest.
	const [when, setWhen] = useRememberedPicks<SkillTag>("skills:when", values(WHEN_TAGS))
	const [race, setRace] = useRememberedPicks<SkillTag>("skills:race", values(RACE_TAGS))
	const [style, setStyle] = useRememberedPicks<SkillTag>("skills:style", values(STYLE_TAGS))
	const [does, setDoes] = useRememberedPicks<SkillTag>("skills:does", values(DOES_TAGS))
	const [match, setMatch] = useRememberedFilter<TagMatch>("skills:match", "all", values(MATCH_OPTIONS))
	const tagPicks = useMemo(() => [...when, ...race, ...style, ...does], [when, race, style, does])
	// Whether those rows are open. Kept outside the "skills:" scope, so opening
	// them isn't a filter for Reset to clear; open whenever one is set, so a
	// remembered pick never hides behind a closed button.
	const [openFlag, setOpen] = useRememberedFilter<string>("skills-panel:conditions", "0", REVERSED_VALUES)
	const conditionsOpen = openFlag === "1" || tagPicks.length > 0
	// Every setting that changes which rows the list holds and in what order.
	const filterKey = `${query}|${colours.join()}|${where}|${types.join()}|${tagPicks.join()}|${match}|${sort}|${reversed}`
	// Back on the list with the filters it was left with, it draws as many rows
	// as it had then, in one go, so the restored scroll lands on them
	// (skillRowsDrawn, hooks/useSkillList.ts). Otherwise one page.
	const [shown, setShown] = useState(() => skillRowsDrawn(filterKey) ?? PAGE)
	useEffect(() => {
		rememberSkillRowsDrawn(filterKey, shown)
	}, [filterKey, shown])

	// The tabs' headline numbers. The Umas and Support cards tabs count from the
	// catalogue, which the hover cards already load on this page; the Skills
	// tab's own number, once the list is here, is the list's length.
	const catalogue = usePvpCatalogue()
	useCatalogueCounts(catalogue)
	// The same catalogue paints an owned skill's plate in her character's two
	// colours (notes/skills-list-plan.md). The list draws without waiting for
	// it: until it lands those plates keep their grey, and nothing moves.
	const colourOf = useMemo(() => umaColourLookup(catalogue.status === "ready" ? catalogue.catalogue : null), [catalogue])
	const total = list.status === "ready" ? list.rows.length : null
	useEffect(() => {
		if (total !== null) reportCounts({ skills: total })
	}, [total])

	const rows = useMemo(() => {
		if (list.status !== "ready") return []
		const found = filterSkills(list.rows, query, colours, where, types, { picks: tagPicks, match })
		// A unique has no cost and goes last either way round.
		if (sort === "cost") return sortByValue(found, (row) => row.cost ?? null, reversed)
		// By name, the client's own order (utils/nameOrder.ts), never the API's:
		// production's database skipped a leading "#" or "…" while the headings
		// didn't, so every such name split its letter in two (Daptrius, 2026-11-25).
		// The sort is stable, so a unique and its inherited copy keep the API's id order.
		return sortList(found, sort, undefined, reversed)
	}, [list, query, colours, where, types, tagPicks, match, sort, reversed])

	// Headings for whatever the list is sorted by, filtered or not, as the
	// other two lists have them. A cost only one or two skills have (60 SP,
	// 320 SP) shares its neighbour's heading as a range.
	const groups = useMemo(() => {
		if (sort === "cost") {
			return mergeSmallGroups(groupsFor(rows, (row) => costKey(row.cost)), 3, (low, high) => `${low} to ${high} SP`)
		}
		return groupsFor(rows, (row) => (sort === "game_id" ? skillIdKey(row.game_id) : letterKey(row.name)))
	}, [rows, sort])

	// The next page draws itself once "Show more" scrolls into view.
	const moreRef = useRef<HTMLDivElement>(null)
	const hasMore = rows.length > shown
	useEffect(() => {
		const target = moreRef.current
		if (!hasMore || !target || typeof IntersectionObserver === "undefined") return
		const observer = new IntersectionObserver((entries) => {
			if (entries.some((entry) => entry.isIntersecting)) setShown((count) => count + PAGE)
		}, { rootMargin: "600px 0px" })
		observer.observe(target)
		return () => observer.disconnect()
	}, [hasMore, shown])

	// A new search starts from the first page again.
	const [shownFor, setShownFor] = useState(filterKey)
	if (shownFor !== filterKey) {
		setShownFor(filterKey)
		setShown(PAGE)
	}

	return (
		<div className={PAGE_CONTAINER}>
			<EncyclopediaTabs />
			<Toolbar
				scope="skills"
				search={<SearchBox label="Search skills" placeholder="Search by skill, uma or ID..." value={query} onChange={setQuery} />}
				count={list.status === "ready" && <Count>{countLine(rows.length, "skill", "skills")}</Count>}
				settings={<Chips label="Where" options={WHERE_FILTERS} value={where} onChange={setWhere} />}
			>
				{/* American spelling on screen (Daptrius, 2026-11-13); the code keeps "colour". */}
				<PickChips label="Color" options={COLOUR_OPTIONS} picks={colours} onChange={setColours} />
				{/* The Type chips are the types; each picked type with sub-types (the
				    greens, the debuffs) opens a row of its own under them. */}
				<PickChips
					label="Type"
					options={TYPE_OPTIONS}
					picks={pickedParents(types).map((option) => option.value)}
					onChange={setTypes}
					onToggle={(parent) => setTypes(toggleTypePick(types, parent))}
				/>
				{pickedParents(types).filter((parent) => parent.subs).map((parent) => {
					const subs = subTypePicks(types, parent.value)
					return (
						<div key={parent.value} role="group" aria-label={parent.label} className="enc-filter">
							<span className="enc-filter__label" aria-hidden="true">{parent.label}</span>
							<div className="enc-filter__chips">
								<button
									type="button"
									className="enc-chip"
									aria-pressed={subs.length === 0}
									onClick={() => setTypes(toggleSubTypePick(types, parent.value, parent.value))}
								>
									All
								</button>
								{(parent.subs ?? []).map((sub) => (
									<button
										key={sub.value}
										type="button"
										className="enc-chip"
										aria-pressed={subs.includes(sub.value)}
										onClick={() => setTypes(toggleSubTypePick(types, parent.value, sub.value))}
									>
										{sub.label}
									</button>
								))}
							</div>
						</div>
					)
				})}
				{/* When it fires, the race it asks for and what it does: folded away until
				    asked for, since most visits only search (Daptrius's list, item 2). */}
				<div role="group" aria-label="Conditions and effects" className="enc-filter">
					<span className="enc-filter__label" aria-hidden="true">More</span>
					<div className="enc-filter__chips">
						<button
							type="button"
							className="enc-chip"
							aria-expanded={conditionsOpen}
							// Can't fold while a pick is set: the picks would still filter, out of sight.
							disabled={tagPicks.length > 0}
							onClick={() => setOpen(conditionsOpen ? "0" : "1")}
						>
							{conditionsOpen ? "Hide conditions and effects" : "Show conditions and effects"}
						</button>
					</div>
				</div>
				{conditionsOpen && (
					<>
						<PickChips label="When" options={WHEN_TAGS} picks={when} onChange={setWhen} />
						<PickChips label="Race" options={RACE_TAGS} picks={race} onChange={setRace} />
						<PickChips label="Strategy" options={STYLE_TAGS} picks={style} onChange={setStyle} />
						<PickChips label="Does" options={DOES_TAGS} picks={does} onChange={setDoes} />
						<Chips label="Match" options={MATCH_OPTIONS} value={match} onChange={setMatch} />
					</>
				)}
				<SortControl
					options={SKILL_SORT_OPTIONS}
					value={sort}
					onChange={setSort}
					reversed={reversed}
					onReverse={() => setReversed(reversed ? "0" : "1")}
				/>
			</Toolbar>

			{list.status === "loading" ? (
				<div role="status" aria-label="Loading skills" className="enc-skills enc-skills--plates">
					{/* The plates' own height, so the list doesn't jump when it lands. */}
					{Array.from({ length: 18 }, (_, index) => <div key={index} className="enc-skeleton h-[4.75rem] rounded-2xl" />)}
				</div>
			) : list.status === "error" ? (
				<EmptyNote>The skill list didn't load. Reload the page to try again.</EmptyNote>
			) : rows.length === 0 ? (
				<EmptyNote>No skill matches that.</EmptyNote>
			) : (
				<>
					<GroupedGrid
						scope="skills"
						items={rows}
						groups={groups}
						limit={shown}
						// A jump to a heading not drawn yet draws up to it, and a page past it.
						onReveal={(before) => setShown((count) => Math.max(count, before + PAGE))}
						noun={["skill", "skills"]}
						// Plates: the list's own look for the shared row (encyclopedia.css).
						className="enc-skills enc-skills--plates"
						tile={(row) => (
							<SkillRow
								key={row.game_id}
								skill={row}
								face
								colours={colourOf.get(row.owner_umas?.[0]?.id ?? -1)}
								// Sorted by game ID, the row says its ID first, as the other lists' tiles do.
								sub={sort === "game_id"
									? [`ID ${row.game_id}`, SKILL_TYPE_WORDS[row.type ?? ""], row.owners?.join(", ")].filter(Boolean).join(" · ")
									: undefined}
							/>
						)}
					/>
					{hasMore && (
						<div className="enc-more" ref={moreRef}>
							<span>Showing {shown.toLocaleString("en-US")} of {rows.length.toLocaleString("en-US")}</span>
							<button type="button" onClick={() => setShown((count) => count + PAGE)}>Show more</button>
						</div>
					)}
				</>
			)}

			<p className="enc-foot">
				JP only skills aren't in the global game yet, and their numbers may change when they arrive. Some English
				names and descriptions are{" "}
				<a href={UMATL_URL} target="_blank" rel="noreferrer">UmaTL</a>
				's fan translation, shown until global has its own. A part shown as code is one we haven't confirmed the
				meaning of yet. Under conditions, a strategy, distance or surface finds the skills that ask for it.
			</p>
		</div>
	)
}
