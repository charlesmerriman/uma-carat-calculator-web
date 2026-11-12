/**
 * /app/umas: every trainee outfit, from the PvP catalogue the team builder and
 * Ctrl+K already load (GET /pvp-catalogue, public). Search by name, filter by
 * where it is out and by starting stars; a tile opens the outfit's page.
 */

import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { FramedUma } from "../FramedUma"
import { JpOnlyTag } from "../pvp/SkillDetail"
import { useOshiIds } from "../../hooks/useOshiIds"
import { usePvpCatalogue } from "../../hooks/usePvpCatalogue"
import { umaHref } from "../../utils/encyclopediaRoutes"
import { EncyclopediaGate, EncyclopediaTabs } from "./EncyclopediaTabs"
import { Chips, SearchBox } from "./listFilters"
import { Stars } from "./pieces"
import {
	PAGE_CONTAINER, STAR_OPTIONS, WHERE_OPTIONS, countLine, filterUmas, type StarFilter, type WhereFilter,
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
	const umas = useMemo(
		() => (catalogue.status === "ready" ? filterUmas(catalogue.catalogue.umas, query, where, stars) : []),
		[catalogue, query, where, stars]
	)

	return (
		<div className={PAGE_CONTAINER}>
			<EncyclopediaTabs />
			<div className="flex flex-col gap-2">
				<SearchBox label="Search umas" value={query} onChange={setQuery} />
				<Chips label="Where" options={WHERE_OPTIONS} value={where} onChange={setWhere} />
				<Chips label="Stars" options={STAR_OPTIONS} value={stars} onChange={setStars} />
			</div>
			{catalogue.status === "loading" ? (
				<p className="flex items-center gap-2 text-sm text-gray-400" role="status">
					<Loader2 className="h-4 w-4 animate-spin" /> Loading umas...
				</p>
			) : catalogue.status === "error" ? (
				<p className="text-sm text-gray-400">The uma list didn't load. Reload the page to try again.</p>
			) : (
				<>
					<p className="text-xs text-gray-400" aria-live="polite">{countLine(umas.length, "uma", "umas")}</p>
					{umas.length === 0 ? (
						<p className="text-sm text-gray-400">No uma matches that.</p>
					) : (
						<ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
							{umas.map((uma) => (
								<li key={uma.id}>
									<Link
										to={umaHref(uma.game_id as number)}
										className="flex h-full flex-col items-center gap-1.5 rounded-lg border border-edge bg-(--card-fill) p-2 text-center text-sm text-gray-100 transition hover:border-gray-500"
									>
										<FramedUma src={uma.portrait} oshi={oshiIds.has(uma.id)} className="h-20 w-20" />
										<span className="line-clamp-2 leading-tight">{uma.name}</span>
										<span className="flex items-center gap-1.5">
											<Stars count={uma.rarity ?? 3} />
											{!uma.on_global && <JpOnlyTag className="text-[10px]" />}
										</span>
									</Link>
								</li>
							))}
						</ul>
					)}
				</>
			)}
		</div>
	)
}
