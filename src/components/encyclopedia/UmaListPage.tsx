/**
 * /app/umas: every trainee outfit, from the PvP catalogue the team builder and
 * Ctrl+K already load (GET /pvp-catalogue, public). Search by name, filter by
 * where it is out and by starting stars; a tile opens the outfit's page.
 */

import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { FramedUma } from "../FramedUma"
import { useOshiIds } from "../../hooks/useOshiIds"
import { usePvpCatalogue } from "../../hooks/usePvpCatalogue"
import { umaHref } from "../../utils/encyclopediaRoutes"
import { splitOutfit } from "../../utils/umaName"
import { EncyclopediaGate, EncyclopediaTabs } from "./EncyclopediaTabs"
import { Chips, Count, SearchBox, Toolbar } from "./listFilters"
import { EmptyNote, GridSkeleton, JpTag, OwnedMark, Stars } from "./pieces"
import { useOwned } from "../../hooks/useOwned"
import {
	OWNED_OPTIONS, PAGE_CONTAINER, STAR_OPTIONS, WHERE_OPTIONS, countLine, filterUmas, ownedMatches,
	type OwnedFilter, type StarFilter, type WhereFilter,
} from "../../utils/encyclopedia"

export const UmaListPage = () => (
	<EncyclopediaGate>
		<UmaListBody />
	</EncyclopediaGate>
)

const UmaListBody = () => {
	const catalogue = usePvpCatalogue()
	const oshiIds = useOshiIds()
	const [query, setQuery] = useState("")
	const [where, setWhere] = useState<WhereFilter>("all")
	const [stars, setStars] = useState<StarFilter>("all")
	const owned = useOwned()
	const [ownedFilter, setOwnedFilter] = useState<OwnedFilter>("all")
	// The Collection filter and the ticks only for a signed-in player with something in their Collection.
	const showOwned = owned.signedIn && !owned.empty
	const umas = useMemo(
		() => (catalogue.status === "ready"
			? filterUmas(catalogue.catalogue.umas, query, where, stars).filter((uma) => ownedMatches(showOwned ? ownedFilter : "all", owned.umas, uma.id))
			: []),
		[catalogue, query, where, stars, owned, ownedFilter, showOwned]
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
