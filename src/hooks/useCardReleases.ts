/**
 * Release checks for one PvP event, from the banners the /app load already
 * fetched: `(pool, id) => ReleaseStatus`. The rule is utils/cardRelease.ts.
 */

import { useMemo } from "react"
import { useCalculatorData } from "../services/CalculatorContext"
import { cardReleases, releaseStatus, type ReleaseStatus } from "../utils/cardRelease"
import type { RaceEvent } from "../types"
import type { PvpCatalogueIndex } from "./usePvpCatalogue"

export type ReleaseCheck = (pool: "uma" | "support", id: number) => ReleaseStatus

/** `index` supplies each card's on_global, which decides a card on no banner. */
export function useCardReleases(
	event: Pick<RaceEvent, "start_date" | "end_date">,
	index: Pick<PvpCatalogueIndex, "umasById" | "cardsById">
): ReleaseCheck {
	const { umaBannerData, supportBannerData } = useCalculatorData()
	const releases = useMemo(
		() => cardReleases(umaBannerData ?? [], supportBannerData ?? []),
		[umaBannerData, supportBannerData]
	)
	return (pool, id) =>
		// A placeholder is a stand-in, out for every event (owner, 2026-10-27).
		pool === "support" && index.cardsById.get(id)?.placeholder
			? { kind: "available" }
			: releaseStatus(
			(pool === "uma" ? releases.umas : releases.supports).get(id),
			event,
			(pool === "uma" ? index.umasById : index.cardsById).get(id)?.on_global
		)
}
