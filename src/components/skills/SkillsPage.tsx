/**
 * The Skills page (/app/skills): every skill with a name (in Japanese when it has no English one), global's
 * and JP's, from GET /skills. Search by any name a skill has had, filter by
 * colour and by where it is. A row opens the skill's own page
 * (/app/skills/<game id>, SkillPage); the side card that used to open beside
 * the list is gone (owner's answer 7), and an old `?skill=<game id>` link
 * redirects to the page.
 *
 * The list is long (~1,800), so it shows a page of rows and grows on "Show
 * more" rather than drawing them all.
 */

import { useMemo, useState } from "react"
import { Link, Navigate, useSearchParams } from "react-router-dom"
import { Loader2, Search, Zap } from "lucide-react"
import { useSkillListState } from "../../hooks/useSkillList"
import { EncyclopediaGate } from "../encyclopedia/EncyclopediaTabs"
import type { SkillListRow } from "../../types/skills"
import { GOLD_SKILL_RARITY } from "../../utils/pvpGuide"
import {
	COLOUR_FILTERS, SKILL_PARAM, UMATL_URL, WHERE_FILTERS, filterSkills, parseSkillParam, skillHref, skillKind,
	type ColourFilter, type WhereFilter,
} from "../../utils/skillSearch"
import { JpOnlyTag } from "../pvp/SkillDetail"
import { nameLang } from "../../utils/skillList"

const PAGE = 60

function FilterChips<T extends string>({ label, options, value, onChange }: {
	label: string
	options: { value: T; label: string }[]
	value: T
	onChange: (value: T) => void
}) {
	return (
		<div role="group" aria-label={label} className="flex flex-wrap gap-1">
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					aria-pressed={value === option.value}
					onClick={() => onChange(option.value)}
					className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
						value === option.value
							? "border-brand bg-brand/15 text-gray-100"
							: "border-gray-600 text-gray-300 hover:border-gray-500"
					}`}
				>
					{option.label}
				</button>
			))}
		</div>
	)
}

/** A row's surface: the game's gold or pink, else a card's fill and edge with
 * light text (a bare bg-gray-800 is the page's own colour on some themes). */
function rowSurface(row: SkillListRow): string {
	if (row.is_evolved) return "skill-evolved"
	if (row.rarity === GOLD_SKILL_RARITY) return "skill-gold"
	return "border-edge bg-(--card-fill) text-gray-100 hover:border-gray-500"
}

function SkillRow({ row }: { row: SkillListRow }) {
	return (
		<li>
			<Link
				to={skillHref(row.game_id)}
				className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm transition ${rowSurface(row)}`}
			>
				{row.image ? (
					<img src={row.image} alt="" className="h-6 w-6 shrink-0" loading="lazy" decoding="async" />
				) : (
					<span className="h-6 w-6 shrink-0 rounded-full bg-gray-700" aria-hidden="true" />
				)}
				<span className="min-w-0 flex-1 truncate" lang={nameLang(row.name)}>{row.name}</span>
				{row.availability === "jp" && <JpOnlyTag className="shrink-0 text-[10px]" />}
				<span className="shrink-0 text-xs opacity-70">{skillKind(row)}</span>
			</Link>
		</li>
	)
}

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
	const [shown, setShown] = useState(PAGE)

	const rows = useMemo(
		() => (list.status === "ready" ? filterSkills(list.rows, query, colour, where) : []),
		[list, query, colour, where]
	)

	// A new search starts from the first page again.
	const filterKey = `${query}|${colour}|${where}`
	const [shownFor, setShownFor] = useState(filterKey)
	if (shownFor !== filterKey) {
		setShownFor(filterKey)
		setShown(PAGE)
	}

	return (
		<div className="mx-auto my-3 flex w-[calc(100%-1rem)] max-w-6xl flex-col gap-4 sm:w-[calc(100%-2rem)]">
			<header>
				<h1 className="font-display flex items-center gap-2 text-xl font-bold text-brand">
					<Zap className="h-5 w-5 shrink-0" />
					Skills
				</h1>
				<p className="mt-1 text-sm leading-relaxed text-gray-300">
					Every skill in the game, on global and in JP. Search by name, then open one to see when it fires,
					what it does and which umas and cards give it.
				</p>
			</header>

			<div className="flex flex-col gap-2">
				<div className="relative w-full sm:w-80">
					<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
					<input
						type="search"
						aria-label="Search skills"
						placeholder="Search skills..."
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						className="w-full rounded-lg border border-gray-600 bg-gray-800 py-2 pl-9 pr-3 text-sm text-gray-100 placeholder-gray-500 focus:border-brand focus:outline-none"
					/>
				</div>
				<FilterChips label="Colour" options={COLOUR_FILTERS} value={colour} onChange={setColour} />
				<FilterChips label="Where" options={WHERE_FILTERS} value={where} onChange={setWhere} />
			</div>

			<div>
				<div>
					{list.status === "loading" ? (
						<p className="flex items-center gap-2 text-sm text-gray-400" role="status">
							<Loader2 className="h-4 w-4 animate-spin" /> Loading skills...
						</p>
					) : list.status === "error" ? (
						<p className="text-sm text-gray-400">The skill list didn't load. Reload the page to try again.</p>
					) : (
						<>
							<p className="mb-2 text-xs text-gray-400" aria-live="polite">
								{rows.length === 1 ? "1 skill" : `${rows.length.toLocaleString("en-US")} skills`}
							</p>
							{rows.length === 0 ? (
								<p className="text-sm text-gray-400">No skill matches that.</p>
							) : (
								<ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
									{rows.slice(0, shown).map((row) => (
										<SkillRow key={row.id} row={row} />
									))}
								</ul>
							)}
							{rows.length > shown && (
								<button
									type="button"
									onClick={() => setShown((count) => count + PAGE)}
									className="mt-3 rounded-lg border border-gray-600 px-3 py-1.5 text-sm text-gray-200 transition hover:border-gray-500"
								>
									Show more
								</button>
							)}
						</>
					)}
				</div>
			</div>

			<p className="text-xs leading-relaxed text-gray-400">
				JP only skills aren't in the global game yet, and their numbers may change when they arrive. Some English
				names and descriptions are{" "}
				<a href={UMATL_URL} target="_blank" rel="noreferrer" className="text-brand transition hover:text-brand/75">
					UmaTL
				</a>
				's fan translation, shown until global has its own. A part shown as code is one we haven't confirmed the
				meaning of yet.
			</p>
		</div>
	)
}
