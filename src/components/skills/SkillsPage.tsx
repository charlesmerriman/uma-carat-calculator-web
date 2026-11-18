/**
 * The Skills page (/app/skills): every skill with a name (in Japanese when it has no English one), global's
 * and JP's, from GET /skills. Search by any name a skill has had, its id or an
 * uma's name, filter by colours, types and where it is, sort by name, id or
 * skill point cost either way round. A row opens the skill's own page
 * (/app/skills/<game id>, SkillPage), and hovering one opens its card; an old
 * `?skill=<game id>` link redirects to the page.
 *
 * The list is long (~2,200), so it shows a page of rows and grows on "Show
 * more" rather than drawing them all.
 */

import { useEffect, useMemo, useState } from "react"
import { Navigate, useSearchParams } from "react-router-dom"
import { useSkillListState } from "../../hooks/useSkillList"
import { reportCounts } from "../../utils/encyclopediaCounts"
import { EncyclopediaGate, EncyclopediaTabs } from "../encyclopedia/EncyclopediaTabs"
import { Chips, Count, PickChips, SearchBox, SortControl, Toolbar } from "../encyclopedia/listFilters"
import { EmptyNote } from "../encyclopedia/pieces"
import { SkillList } from "../encyclopedia/skillRows"
import {
	PAGE_CONTAINER, REVERSED_VALUES, SHARED_WHERE_KEY, SHARED_WHERE_VALUES, countLine, sortByValue, sortList, values,
	type SharedWhere,
} from "../../utils/encyclopedia"
import { useRememberedFilter, useRememberedPicks } from "../../hooks/useRememberedFilter"
import {
	COLOUR_FILTERS, DOES_TAGS, RACE_TAGS, SKILL_PARAM, STYLE_TAGS, TYPE_FILTERS, UMATL_URL, WHEN_TAGS, WHERE_FILTERS,
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
 * Part of the Encyclopedia, so supporters and staff first (EncyclopediaGate,
 * owner 2026-11-12): anyone else gets the supporters note, and the route is
 * neither prerendered nor in the sitemap until it opens to everyone.
 */
export const SkillsPage = () => {
	// An old link (Discord, a bookmark) named the skill as ?skill=<id>; its page is its own address now.
	const [searchParams] = useSearchParams()
	const oldLink = parseSkillParam(searchParams.get(SKILL_PARAM))
	if (oldLink !== null) return <Navigate to={skillHref(oldLink)} replace />
	return (
		<EncyclopediaGate>
			<SkillsPageBody />
		</EncyclopediaGate>
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
	const [shown, setShown] = useState(PAGE)

	// The Skills tab's headline number, once the list is here.
	const total = list.status === "ready" ? list.rows.length : null
	useEffect(() => {
		if (total !== null) reportCounts({ skills: total })
	}, [total])

	const rows = useMemo(() => {
		if (list.status !== "ready") return []
		const found = filterSkills(list.rows, query, colours, where, types, { picks: tagPicks, match })
		// By name the API's order stands (it sorts names the way the game does), turned round on asking.
		if (sort === "name") return reversed ? [...found].reverse() : found
		// A unique has no cost and goes last either way round.
		if (sort === "cost") return sortByValue(found, (row) => row.cost ?? null, reversed)
		return sortList(found, sort, undefined, reversed)
	}, [list, query, colours, where, types, tagPicks, match, sort, reversed])

	// A new search starts from the first page again.
	const filterKey = `${query}|${colours.join()}|${where}|${types.join()}|${tagPicks.join()}|${match}|${sort}|${reversed}`
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
				<div role="status" aria-label="Loading skills" className="enc-skills">
					{Array.from({ length: 18 }, (_, index) => <div key={index} className="enc-skeleton h-12" />)}
				</div>
			) : list.status === "error" ? (
				<EmptyNote>The skill list didn't load. Reload the page to try again.</EmptyNote>
			) : rows.length === 0 ? (
				<EmptyNote>No skill matches that.</EmptyNote>
			) : (
				<>
					<SkillList skills={rows.slice(0, shown)} faces />
					{rows.length > shown && (
						<div className="enc-more">
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
