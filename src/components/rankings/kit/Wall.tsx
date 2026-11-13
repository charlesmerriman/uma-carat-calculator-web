/**
 * Umas as a wall of portraits (mock 11-players.png, "Favourite umas"): each
 * a 56 px FramedUma with her name and a count under it, the top `start`,
 * then "Show all". For a list where the faces are the point and a bar per
 * row would be noise.
 */

import { useState } from "react"
import { Link } from "react-router-dom"
import type { CatalogueUma } from "../../../types/pvpTeam"
import { useOshiIds } from "../../../hooks/useOshiIds"
import { FramedUma } from "../../FramedUma"
import { useEncyclopediaHrefs } from "../../../hooks/useEncyclopediaHrefs"

export function Wall({ entries, start = 20, label }: {
	entries: Array<{ uma: CatalogueUma; count: string }>
	start?: number
	label: string
}) {
	const oshiIds = useOshiIds()
	// Each face opens her Encyclopedia page (early access).
	const hrefs = useEncyclopediaHrefs()
	const [all, setAll] = useState(false)
	const shown = all ? entries : entries.slice(0, start)
	return (
		<>
			<ol aria-label={label} className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-x-1.5 gap-y-2.5">
				{shown.map(({ uma, count }, index) => {
					const page = hrefs.uma(uma.id)
					const face = (
						<>
							<FramedUma src={uma.portrait ?? uma.image} oshi={oshiIds.has(uma.id)} className="w-14" alt="" />
							<span className={`w-full truncate text-[11px] font-semibold text-gray-100 ${page ? "transition-colors group-hover:text-brand" : ""}`} title={uma.name}>
								<span className="sr-only">{index + 1}. </span>
								{uma.name}
							</span>
							<span className="text-[10px] tabular-nums text-gray-400">{count}</span>
						</>
					)
					const tile = "flex min-w-0 flex-col items-center gap-0.5 text-center"
					return (
						<li key={uma.id} className={page ? "min-w-0" : tile}>
							{page ? (
								<Link to={page} className={`group ${tile} rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-brand`}>
									{face}
								</Link>
							) : (
								face
							)}
						</li>
					)
				})}
			</ol>
			{entries.length > start && (
				<button type="button" onClick={() => setAll(!all)} className="self-end px-1 text-[11px] text-brand transition hover:text-brand/75">
					{all ? `Show the top ${start}` : `Show all ${entries.length}`}
				</button>
			)}
		</>
	)
}
