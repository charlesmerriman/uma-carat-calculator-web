/**
 * The Skills page (/app/skills): every skill with a name (in Japanese when it has no English one), global's
 * and JP's, from GET /skills. Search by any name a skill has had or by an
 * uma's name, filter by colour, type and where it is. A row opens the skill's
 * own page (/app/skills/<game id>, SkillPage), and hovering one opens its
 * card; an old `?skill=<game id>` link redirects to the page.
 *
 * The list is long (~2,200), so it shows a page of rows and grows on "Show
 * more" rather than drawing them all.
 */

import { useMemo, useState } from "react"
import { Navigate, useSearchParams } from "react-router-dom"
import { useSkillListState } from "../../hooks/useSkillList"
import { EncyclopediaGate, EncyclopediaTabs } from "../encyclopedia/EncyclopediaTabs"
import { Chips, Count, SearchBox, Toolbar } from "../encyclopedia/listFilters"
import { EmptyNote } from "../encyclopedia/pieces"
import { SkillList } from "../encyclopedia/skillRows"
import { PAGE_CONTAINER, countLine } from "../../utils/encyclopedia"
import {
	COLOUR_FILTERS, SKILL_PARAM, TYPE_FILTERS, UMATL_URL, WHERE_FILTERS, filterSkills, parseSkillParam, skillHref,
	type ColourFilter, type TypeFilter, type WhereFilter,
} from "../../utils/skillSearch"

const PAGE = 60

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
// The filter's own name says "Type", so its first chip needn't.
const TYPE_OPTIONS = TYPE_FILTERS.map((option) => (option.value === "all" ? { ...option, label: "Any" } : option))

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
	const [query, setQuery] = useState("")
	const [colour, setColour] = useState<ColourFilter>("all")
	const [where, setWhere] = useState<WhereFilter>("all")
	const [type, setType] = useState<TypeFilter>("all")
	const [shown, setShown] = useState(PAGE)

	const rows = useMemo(
		() => (list.status === "ready" ? filterSkills(list.rows, query, colour, where, type) : []),
		[list, query, colour, where, type]
	)

	// A new search starts from the first page again.
	const filterKey = `${query}|${colour}|${where}|${type}`
	const [shownFor, setShownFor] = useState(filterKey)
	if (shownFor !== filterKey) {
		setShownFor(filterKey)
		setShown(PAGE)
	}

	return (
		<div className={PAGE_CONTAINER}>
			<EncyclopediaTabs />
			<Toolbar
				search={<SearchBox label="Search skills" placeholder="Search by skill or uma name..." value={query} onChange={setQuery} />}
				count={list.status === "ready" && <Count>{countLine(rows.length, "skill", "skills")}</Count>}
			>
				<Chips label="Colour" options={COLOUR_OPTIONS} value={colour} onChange={setColour} />
				<Chips label="Type" options={TYPE_OPTIONS} value={type} onChange={setType} />
				<Chips label="Where" options={WHERE_FILTERS} value={where} onChange={setWhere} />
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
					<SkillList skills={rows.slice(0, shown)} />
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
				meaning of yet.
			</p>
		</div>
	)
}
