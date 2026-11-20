/**
 * /app/umas: every trainee outfit, from the PvP catalogue the team builder and
 * Ctrl+K already load (GET /pvp-catalogue, public). Search by name or id,
 * filter by where it is out, starting stars and aptitudes, sort by name,
 * release, game id or one aptitude, either way round; a tile opens the
 * outfit's page.
 */

import { Fragment, useMemo } from "react"
import { useRememberedFilter, useRememberedPicks } from "../../hooks/useRememberedFilter"
import { Link } from "react-router-dom"
import { FramedUma } from "../FramedUma"
import { useOshiIds } from "../../hooks/useOshiIds"
import { usePvpCatalogue } from "../../hooks/usePvpCatalogue"
import { umaHref } from "../../utils/encyclopediaRoutes"
import { splitOutfit } from "../../utils/umaName"
import { EncyclopediaFrame, EncyclopediaTabs } from "./EncyclopediaTabs"
import { LetterHeading, LetterIndex } from "./letters"
import { lettersFor } from "../../utils/encyclopediaLetters"
import { useCatalogueCounts } from "../../hooks/useCatalogueCounts"
import { Chips, Count, GradeSelect, PickChips, SearchBox, SortControl, Toolbar } from "./listFilters"
import { useCalculatorDataSafe } from "../../services/CalculatorContext"
import type { AptitudeKey } from "../../types/pvpTeam"
import { EmptyNote, GridSkeleton, JpTag, OwnedMark, Stars } from "./pieces"
import { useOwned } from "../../hooks/useOwned"
import {
	APTITUDE_GROUPS, APTITUDE_KEYS, GRADE_OPTIONS, OWNED_OPTIONS, PAGE_CONTAINER, REVERSED_VALUES, SHARED_OWNED_KEY,
	SHARED_WHERE_KEY, SHARED_WHERE_VALUES, STAR_OPTIONS, UMA_SORT_OPTIONS, WHERE_OPTIONS,
	aptitudeLabel, aptitudeMatches, colourStyle, countLine, filterUmas, gradeLetter, listWhere, ownedMatches, releaseDates, sortAptitude,
	sortByValue, sortFact, sortList, sortsHighFirst, values,
	type OwnedFilter, type SharedWhere, type UmaSortOrder,
} from "../../utils/encyclopedia"

export const UmaListPage = () => (
	<EncyclopediaFrame>
		<UmaListBody />
	</EncyclopediaFrame>
)

const UmaListBody = () => {
	const catalogue = usePvpCatalogue()
	const oshiIds = useOshiIds()
	// Remembered for the tab, so a trip to an uma's page and back keeps them (useRememberedFilter).
	const [query, setQuery] = useRememberedFilter<string>("umas:query", "")
	// Where and Collection are the settings every list shares (SHARED_WHERE_KEY).
	const [sharedWhere, setWhere] = useRememberedFilter<SharedWhere>(SHARED_WHERE_KEY, "all", SHARED_WHERE_VALUES)
	const where = listWhere(sharedWhere)
	const [stars, setStars] = useRememberedPicks("umas:stars", values(STAR_OPTIONS))
	const owned = useOwned()
	const [ownedFilter, setOwnedFilter] = useRememberedFilter<OwnedFilter>(SHARED_OWNED_KEY, "all", values(OWNED_OPTIONS))
	const [sort, setSort] = useRememberedFilter<UmaSortOrder>("umas:sort", "name", values(UMA_SORT_OPTIONS))
	const [reversedFlag, setReversed] = useRememberedFilter<string>("umas:sort-reversed", "0", REVERSED_VALUES)
	const reversed = reversedFlag === "1"
	const aptitudes = useAptitudeFilter()
	const sortedAptitude = sortAptitude(sort)
	// Release dates from the banners the calculator already loaded; none yet means a date sort goes by name.
	const banners = useCalculatorDataSafe()?.umaBannerData
	const dates = useMemo(() => releaseDates(banners ?? [], (banner) => banner.umas), [banners])
	// The Collection filter and the ticks only for a signed-in player with something in their Collection.
	const showOwned = owned.signedIn && !owned.empty
	const umas = useMemo(() => {
		if (catalogue.status !== "ready") return []
		const found = filterUmas(catalogue.catalogue.umas, query, where, stars)
			.filter((uma) => ownedMatches(showOwned ? ownedFilter : "all", owned.umas, uma.id))
			.filter((uma) => aptitudes.picks.every((pick) => aptitudeMatches(uma.apt, pick.key, pick.min)))
		// An aptitude sort reads the grade, best first; an unimported one goes last.
		return sortedAptitude
			? sortByValue(found, (uma) => uma.apt[sortedAptitude] ?? null, sortsHighFirst(sort, reversed))
			: sortList(found, sort as "name" | "release" | "game_id", dates, reversed)
	}, [catalogue, query, where, stars, owned, ownedFilter, showOwned, aptitudes.picks, sort, sortedAptitude, dates, reversed])

	// The tabs' headline numbers: everything each list holds, whatever is filtered right now.
	const all = catalogue.status === "ready" ? catalogue.catalogue : null
	const totals = useCatalogueCounts(catalogue)
	// Letter headings for the whole list in name order only (components/encyclopedia/letters.tsx).
	const letters = lettersFor(umas, (uma) => uma.name, sort === "name" && totals !== null && umas.length === totals.umas)
	const colours = all?.character_colours

	const tile = (uma: (typeof umas)[number]) => {
		// "Special Week (Summer)": her name, then the outfit on its own quiet line.
		// Her original outfit shows its title instead ("Special Dreamer").
		const { base, outfit } = splitOutfit(uma.name)
		const line = outfit ?? (uma.title ?? "").replace(/^\[|\]$/g, "")
		// What the list is sorted by, under the facts: "ID 100101", a date, "Mile A".
		const grade = sortedAptitude ? uma.apt[sortedAptitude] : null
		const fact = sortedAptitude
			? (grade != null ? `${aptitudeLabel(sortedAptitude)} ${gradeLetter(grade)}` : null)
			: sortFact(sort, uma, dates)
		return (
			<li key={uma.id}>
				{/* Her character's two colours as the bar under her frame; grey for one the game files don't cover. */}
				<Link to={umaHref(uma.game_id as number)} className="enc-tile enc-tile--uma" style={colourStyle(colours?.[String(uma.character_id)])}>
					{showOwned && owned.umas.has(uma.id) && <OwnedMark />}
					<FramedUma src={uma.portrait} layers={uma.portrait_layers} oshi={oshiIds.has(uma.id)} className="enc-tile__art" />
					<span className="enc-tile__silk" aria-hidden="true" />
					<span className="enc-tile__name">{base}</span>
					{line && <span className="enc-tile__sub">{line}</span>}
					<span className="enc-tile__facts">
						<Stars count={uma.rarity ?? 3} />
						{!uma.on_global && <JpTag />}
					</span>
					{fact && <span className="enc-tile__effect">{fact}</span>}
				</Link>
			</li>
		)
	}

	return (
		<div className={PAGE_CONTAINER}>
			<EncyclopediaTabs />
			<Toolbar
				scope="umas"
				search={<SearchBox label="Search umas" placeholder="Search by name or ID..." value={query} onChange={setQuery} />}
				count={catalogue.status === "ready" && <Count>{countLine(umas.length, "uma", "umas")}</Count>}
				settings={
					<>
						<Chips label="Where" options={WHERE_OPTIONS} value={where} onChange={setWhere} />
						{showOwned && <Chips label="Collection" options={OWNED_OPTIONS} value={ownedFilter} onChange={setOwnedFilter} />}
					</>
				}
			>
				<PickChips label="Stars" options={STAR_OPTIONS} picks={stars} onChange={setStars} />
				{/* One row per kind of aptitude, the chips in even columns so Distance
				    and Style line up (Daptrius, 2026-11-17). A picked column gets its
				    own "at least" grade under the row, and an uma must pass them all. */}
				{APTITUDE_GROUPS.map((group) => (
					<PickChips
						key={group.id}
						label={group.label}
						short={group.short}
						options={group.keys}
						picks={aptitudes.columns[group.id]}
						onChange={aptitudes.setColumns[group.id]}
						even
						after={aptitudes.columns[group.id].length > 0 && aptitudes.columns[group.id].map((key) => (
							<GradeSelect
								key={key}
								label={`Lowest ${aptitudeLabel(key)} grade`}
								column={aptitudeLabel(key)}
								options={GRADE_OPTIONS}
								value={aptitudes.mins[key]}
								onChange={(min) => aptitudes.setMin(key, min)}
							/>
						))}
					/>
				))}
				<SortControl
					options={UMA_SORT_OPTIONS}
					value={sort}
					onChange={setSort}
					reversed={reversed}
					onReverse={() => setReversed(reversed ? "0" : "1")}
				/>
			</Toolbar>
			{catalogue.status === "loading" ? (
				<GridSkeleton label="Loading umas" />
			) : catalogue.status === "error" ? (
				<EmptyNote>The uma list didn't load. Reload the page to try again.</EmptyNote>
			) : umas.length === 0 ? (
				<EmptyNote>No uma matches that.</EmptyNote>
			) : (
				<div className="enc-listwrap">
					{letters && <LetterIndex scope="umas" letters={letters.map((group) => group.letter)} />}
					<ul className="enc-grid enc-grid--umas">
						{letters
							? letters.map((group) => (
								<Fragment key={group.letter}>
									<LetterHeading scope="umas" letter={group.letter} count={group.items.length} noun={["uma", "umas"]} />
									{group.items.map(tile)}
								</Fragment>
							))
							: umas.map(tile)}
					</ul>
				</div>
			)}
		</div>
	)
}

/**
 * The aptitude rows' remembered picks (utils/encyclopedia.ts APTITUDE_GROUPS):
 * each row's picked columns, and each column's lowest grade, A by default.
 * One remembered grade per column, so "Turf A and Dirt C" is two of them, and
 * a column turned off and on again keeps its grade for the tab.
 *
 * All ten grades share one stored key ("umas:apt-mins"), so one hook reads
 * them and the hooks' order never changes.
 */
function useAptitudeFilter() {
	const [surface, setSurface] = useRememberedPicks("umas:apt-surface", values(APTITUDE_GROUPS[0].keys))
	const [distance, setDistance] = useRememberedPicks("umas:apt-distance", values(APTITUDE_GROUPS[1].keys))
	const [style, setStyle] = useRememberedPicks("umas:apt-style", values(APTITUDE_GROUPS[2].keys))
	const [minsText, setMinsText] = useRememberedFilter<string>("umas:apt-mins", "")
	// "mile:5,turf:8": only the grades moved off A are kept.
	const mins = useMemo(() => {
		const read = Object.fromEntries(APTITUDE_KEYS.map((key) => [key, DEFAULT_GRADE])) as Record<AptitudeKey, string>
		for (const entry of minsText.split(",")) {
			const [key, grade] = entry.split(":")
			if (key in read && GRADE_VALUES.includes(grade)) read[key as AptitudeKey] = grade
		}
		return read
	}, [minsText])
	const setMin = (key: AptitudeKey, grade: string) => {
		const next = { ...mins, [key]: grade }
		setMinsText(APTITUDE_KEYS.filter((column) => next[column] !== DEFAULT_GRADE).map((column) => `${column}:${next[column]}`).join(","))
	}
	const picks = useMemo(
		() => [...surface, ...distance, ...style].map((key) => ({ key, min: mins[key] })),
		[surface, distance, style, mins]
	)
	return {
		columns: { surface, distance, style },
		setColumns: { surface: setSurface, distance: setDistance, style: setStyle },
		mins,
		setMin,
		picks,
	}
}

/** A picked column's grade until changed: A. */
const DEFAULT_GRADE = "7"
const GRADE_VALUES = values(GRADE_OPTIONS)
