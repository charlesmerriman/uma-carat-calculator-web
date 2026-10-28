/**
 * Helpers for a set of counted teams (types/rankingsTabs.ts TeamCountsData),
 * for TeamLists.tsx and the tabs that open its rows. A plain module, so the
 * component files export components alone.
 */

import type { PvpStyle } from "../../types/pvpGuide"
import type { TeamCountsData } from "../../types/rankingsTabs"
import type { PvpCatalogueIndex } from "../../hooks/usePvpCatalogue"

export const MEMBER_STYLES: Exclude<PvpStyle, "everyone">[] = ["runaway", "front", "pace", "late", "end"]

export type UmaBuildRow = TeamCountsData["umas"][number]

/** An uma row's styles in the site's order, as [style, members] with members > 0. */
export function stylesOf(row: UmaBuildRow): Array<[PvpStyle, number]> {
	return MEMBER_STYLES.filter((style) => (row.styles[style] ?? 0) > 0).map((style) => [style, row.styles[style] ?? 0])
}

/** The umas `counts` keeps, in rank order, the catalogue's alone. */
export function knownUmas(counts: Pick<TeamCountsData, "umas">, catalogue: PvpCatalogueIndex): UmaBuildRow[] {
	return counts.umas.filter((row) => catalogue.umasById.has(row.uma))
}
