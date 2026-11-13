/**
 * /app/umas: every trainee outfit, from the PvP catalogue the team builder and
 * Ctrl+K already load (GET /pvp-catalogue, public). Search by name, filter by
 * where it is out, starting stars and aptitudes, sort by name, release or game
 * id; a tile opens the outfit's page.
 */

import { useMemo } from "react"
import { useRememberedFilter } from "../../hooks/useRememberedFilter"
import { Link } from "react-router-dom"
import { FramedUma } from "../FramedUma"
import { useOshiIds } from "../../hooks/useOshiIds"
import { usePvpCatalogue } from "../../hooks/usePvpCatalogue"
import { umaHref } from "../../utils/encyclopediaRoutes"
import { splitOutfit } from "../../utils/umaName"
import { EncyclopediaGate, EncyclopediaTabs } from "./EncyclopediaTabs"
import { Chips, Count, GradeSelect, SearchBox, Toolbar } from "./listFilters"
import { useCalculatorDataSafe } from "../../services/CalculatorContext"
import type { AptitudeKey } from "../../types/pvpTeam"
import { EmptyNote, GridSkeleton, JpTag, OwnedMark, Stars } from "./pieces"
import { useOwned } from "../../hooks/useOwned"
import {
	APTITUDE_GROUPS, GRADE_OPTIONS, OWNED_OPTIONS, PAGE_CONTAINER, SORT_OPTIONS, STAR_OPTIONS, WHERE_OPTIONS,
	aptitudeMatches, countLine, filterUmas, ownedMatches, releaseDates, sortList, values,
	type OwnedFilter, type SortOrder, type StarFilter, type WhereFilter,
} from "../../utils/encyclopedia"

export const UmaListPage = () => (
	<EncyclopediaGate>
		<UmaListBody />
	</EncyclopediaGate>
)

const UmaListBody = () => {
	const catalogue = usePvpCatalogue()
	const oshiIds = useOshiIds()
	// Remembered for the tab, so a trip to an uma's page and back keeps them (useRememberedFilter).
	const [query, setQuery] = useRememberedFilter<string>("umas:query", "")
	const [where, setWhere] = useRememberedFilter<WhereFilter>("umas:where", "all", values(WHERE_OPTIONS))
	const [stars, setStars] = useRememberedFilter<StarFilter>("umas:stars", "all", values(STAR_OPTIONS))
	const owned = useOwned()
	const [ownedFilter, setOwnedFilter] = useRememberedFilter<OwnedFilter>("umas:owned", "all", values(OWNED_OPTIONS))
	const [sort, setSort] = useRememberedFilter<SortOrder>("umas:sort", "name", values(SORT_OPTIONS))
	const aptitudes = useAptitudeFilter()
	// Release dates from the banners the calculator already loaded; none yet means Newest sorts by name.
	const banners = useCalculatorDataSafe()?.umaBannerData
	const dates = useMemo(() => releaseDates(banners ?? [], (banner) => banner.umas), [banners])
	// The Collection filter and the ticks only for a signed-in player with something in their Collection.
	const showOwned = owned.signedIn && !owned.empty
	const umas = useMemo(
		() => (catalogue.status === "ready"
			? sortList(
				filterUmas(catalogue.catalogue.umas, query, where, stars)
					.filter((uma) => ownedMatches(showOwned ? ownedFilter : "all", owned.umas, uma.id))
					.filter((uma) => aptitudes.rows.every((row) => aptitudeMatches(uma.apt, row.key, row.min))),
				sort,
				dates,
			)
			: []),
		[catalogue, query, where, stars, owned, ownedFilter, showOwned, aptitudes.rows, sort, dates]
	)

	return (
		<div className={PAGE_CONTAINER}>
			<EncyclopediaTabs />
			<Toolbar
				search={<SearchBox label="Search umas" value={query} onChange={setQuery} />}
				count={catalogue.status === "ready" && <Count>{countLine(umas.length, "uma", "umas")}</Count>}
			>
				<Chips label="Where" options={WHERE_OPTIONS} value={where} onChange={setWhere} />
				<Chips label="Stars" options={STAR_OPTIONS} value={stars} onChange={setStars} />
				{showOwned && <Chips label="Collection" options={OWNED_OPTIONS} value={ownedFilter} onChange={setOwnedFilter} />}
				{/* One row per kind of aptitude; the grade appears once a column is picked. */}
				{APTITUDE_GROUPS.map((group, index) => {
					const row = aptitudes.rows[index]
					return (
						<Chips
							key={group.id}
							label={group.label}
							options={group.keys}
							value={row.key}
							onChange={row.setKey}
							after={row.key !== "any" && (
								<GradeSelect
									label={`Lowest ${group.keys.find((key) => key.value === row.key)?.label} grade`}
									options={GRADE_OPTIONS}
									value={row.min}
									onChange={row.setMin}
								/>
							)}
						/>
					)
				})}
				<Chips label="Sort" options={SORT_OPTIONS} value={sort} onChange={setSort} />
			</Toolbar>
			{catalogue.status === "loading" ? (
				<GridSkeleton label="Loading umas" />
			) : catalogue.status === "error" ? (
				<EmptyNote>The uma list didn't load. Reload the page to try again.</EmptyNote>
			) : umas.length === 0 ? (
				<EmptyNote>No uma matches that.</EmptyNote>
			) : (
				<ul className="enc-grid">
					{umas.map((uma) => {
						// "Special Week (Summer)": her name, then the outfit on its own quiet line.
						const { base, outfit } = splitOutfit(uma.name)
						return (
							<li key={uma.id}>
								<Link to={umaHref(uma.game_id as number)} className="enc-tile">
									{showOwned && owned.umas.has(uma.id) && <OwnedMark />}
									<FramedUma src={uma.portrait} oshi={oshiIds.has(uma.id)} className="enc-tile__art" />
									<span className="enc-tile__name">{base}</span>
									{outfit && <span className="enc-tile__sub">{outfit}</span>}
									<span className="enc-tile__facts">
										<Stars count={uma.rarity ?? 3} />
										{!uma.on_global && <JpTag />}
									</span>
								</Link>
							</li>
						)
					})}
				</ul>
			)}
		</div>
	)
}

/**
 * The three aptitude rows' remembered picks (utils/encyclopedia.ts
 * APTITUDE_GROUPS), in that order: a column or "any", and the lowest grade,
 * A by default. Spelled out hook by hook so the hooks' order never changes.
 */
function useAptitudeFilter() {
	const grades = values(GRADE_OPTIONS)
	const [surface, setSurface] = useRememberedFilter<"any" | AptitudeKey>("umas:apt-surface", "any", values(APTITUDE_GROUPS[0].keys))
	const [surfaceMin, setSurfaceMin] = useRememberedFilter<string>("umas:apt-surface-min", "7", grades)
	const [distance, setDistance] = useRememberedFilter<"any" | AptitudeKey>("umas:apt-distance", "any", values(APTITUDE_GROUPS[1].keys))
	const [distanceMin, setDistanceMin] = useRememberedFilter<string>("umas:apt-distance-min", "7", grades)
	const [style, setStyle] = useRememberedFilter<"any" | AptitudeKey>("umas:apt-style", "any", values(APTITUDE_GROUPS[2].keys))
	const [styleMin, setStyleMin] = useRememberedFilter<string>("umas:apt-style-min", "7", grades)
	const rows = useMemo(() => [
		{ key: surface, min: surfaceMin, setKey: setSurface, setMin: setSurfaceMin },
		{ key: distance, min: distanceMin, setKey: setDistance, setMin: setDistanceMin },
		{ key: style, min: styleMin, setKey: setStyle, setMin: setStyleMin },
	], [surface, surfaceMin, setSurface, setSurfaceMin, distance, distanceMin, setDistance, setDistanceMin, style, styleMin, setStyle, setStyleMin])
	return { rows }
}
