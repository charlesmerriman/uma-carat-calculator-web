/**
 * Umas as a wall of portraits (mock 11-players.png, "Favourite umas"), drawn
 * as the Encyclopedia's tiles (notes/rankings-polish-plan.md, canvas shot 12):
 * each an 84 px FramedUma with her two-colour silk under it, her name and a
 * count, the top `start`, then "Show all". For a list where the faces are
 * the point and a bar per row would be noise.
 */

import { useState, type CSSProperties } from "react"
import { Link } from "react-router-dom"
import type { CatalogueUma } from "../../../types/pvpTeam"
import { useOshiIds } from "../../../hooks/useOshiIds"
import { FramedUma } from "../../FramedUma"
import { useEncyclopediaHrefs } from "../../../hooks/useEncyclopediaHrefs"
import { hoverCardProps } from "../../../utils/hoverCards"
import { colourStyle } from "../../../utils/encyclopedia"

export function Wall({ entries, start = 20, label, colours }: {
	entries: Array<{ uma: CatalogueUma; count: string }>
	start?: number
	label: string
	/** The catalogue's `character_colours`: each tile's silk. Without a pair, the page's accent. */
	colours?: Record<string, readonly string[]>
}) {
	const oshiIds = useOshiIds()
	// Each face opens her Encyclopedia page (early access).
	const hrefs = useEncyclopediaHrefs()
	const [all, setAll] = useState(false)
	const shown = all ? entries : entries.slice(0, start)
	return (
		<>
			<ol aria-label={label} className="grid grid-cols-[repeat(auto-fill,minmax(5.25rem,1fr))] gap-x-2.5 gap-y-3.5">
				{shown.map(({ uma, count }, index) => {
					const page = hrefs.uma(uma.id)
					const pair = uma.character_id != null ? colours?.[String(uma.character_id)] : undefined
					const face = (
						<>
							<FramedUma src={uma.portrait ?? uma.image} layers={uma.portrait_layers} oshi={oshiIds.has(uma.id)} className="w-full max-w-[5.25rem]" alt="" />
							<span className="rk-silk" aria-hidden="true" />
							<span className={`w-full truncate text-[13px] font-bold text-gray-100 ${page ? "transition-colors group-hover:text-brand" : ""}`} title={uma.name}>
								<span className="sr-only">{index + 1}. </span>
								{uma.name}
							</span>
							<span className="font-display text-sm font-bold tabular-nums text-gray-300">{count}</span>
						</>
					)
					const tile = "flex min-w-0 flex-col items-center gap-0.5 text-center"
					return (
						<li
							key={uma.id}
							style={colourStyle(pair) as CSSProperties | undefined}
							className={`rk-paint ${page ? "min-w-0" : tile}`}
							{...hoverCardProps("uma", uma.id)}
						>
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
				<button type="button" onClick={() => setAll(!all)} className="self-end px-1 text-[13px] font-semibold text-brand transition hover:text-brand/75">
					{all ? `Show the top ${start}` : `Show all ${entries.length}`}
				</button>
			)}
		</>
	)
}
