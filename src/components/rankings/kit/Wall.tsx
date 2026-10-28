/**
 * Umas as a wall of portraits (mock 11-players.png, "Favourite umas"): each
 * a 56 px FramedUma with her name and a count under it, the top `start`,
 * then "Show all". For a list where the faces are the point and a bar per
 * row would be noise.
 */

import { useState } from "react"
import type { CatalogueUma } from "../../../types/pvpTeam"
import { useOshiIds } from "../../../hooks/useOshiIds"
import { FramedUma } from "../../FramedUma"

export function Wall({ entries, start = 20, label }: {
	entries: Array<{ uma: CatalogueUma; count: string }>
	start?: number
	label: string
}) {
	const oshiIds = useOshiIds()
	const [all, setAll] = useState(false)
	const shown = all ? entries : entries.slice(0, start)
	return (
		<>
			<ol aria-label={label} className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-x-1.5 gap-y-2.5">
				{shown.map(({ uma, count }, index) => (
					<li key={uma.id} className="flex min-w-0 flex-col items-center gap-0.5 text-center">
						<FramedUma src={uma.portrait ?? uma.image} oshi={oshiIds.has(uma.id)} className="w-14" alt="" />
						<span className="w-full truncate text-[11px] font-semibold text-gray-100" title={uma.name}>
							<span className="sr-only">{index + 1}. </span>
							{uma.name}
						</span>
						<span className="text-[10px] tabular-nums text-gray-400">{count}</span>
					</li>
				))}
			</ol>
			{entries.length > start && (
				<button type="button" onClick={() => setAll(!all)} className="self-end px-1 text-[11px] text-brand transition hover:text-brand/75">
					{all ? `Show the top ${start}` : `Show all ${entries.length}`}
				</button>
			)}
		</>
	)
}
