/**
 * The Encyclopedia tabs' headline numbers (utils/encyclopediaCounts.ts),
 * counted from the PvP catalogue, for every list page that has it.
 *
 * One rule for all three pages, so the numbers never differ by the page a
 * reader started on: the uma and card lists count what they list with
 * nothing filtered, and the catalogue's `skill_count` is the Skills list's
 * length. The Skills page used to report only its own number, so a visit that
 * started there showed "Umas" and "Support cards" bare (Daptrius, board,
 * 2026-11-19: "When a link opens the Skills page directly umas and supports
 * miss their numbers").
 *
 * The catalogue is already on its way on every one of these pages: the uma
 * and card lists draw it, and on the Skills page the card layer
 * (HoverCardLayer) loads it for its hover cards. They share one request
 * (pvpTeamFetchCalls.ts), so counting from it costs nothing extra.
 */

import { useEffect, useMemo } from "react"
import type { PvpCatalogueState } from "./usePvpCatalogue"
import { reportCounts } from "../utils/encyclopediaCounts"
import { filterCards, filterUmas } from "../utils/encyclopedia"

export interface CatalogueTotals {
	umas: number
	cards: number
	skills?: number
}

/** Reports the counts once the catalogue is here, and returns them (null until then). */
export function useCatalogueCounts(catalogue: PvpCatalogueState): CatalogueTotals | null {
	const totals = useMemo<CatalogueTotals | null>(() => {
		if (catalogue.status !== "ready") return null
		const all = catalogue.catalogue
		return {
			umas: filterUmas(all.umas, "", "all", []).length,
			cards: filterCards(all.support_cards, "", [], [], "all").length,
			// The Skills tab's number before its list is opened (Daptrius, board, 2026-11-17).
			...(all.skill_count !== undefined && { skills: all.skill_count }),
		}
	}, [catalogue])
	useEffect(() => {
		if (totals) reportCounts(totals)
	}, [totals])
	return totals
}
