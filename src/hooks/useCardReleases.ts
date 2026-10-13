/**
 * Release checks for one PvP event, from the banners the /app load already
 * fetched: `(pool, id) => ReleaseStatus`. The rule is utils/cardRelease.ts.
 */

import { useMemo } from "react"
import { useCalculatorData } from "../services/CalculatorContext"
import { cardReleases, releaseStatus, type ReleaseStatus } from "../utils/cardRelease"
import type { RaceEvent } from "../types"

export type ReleaseCheck = (pool: "uma" | "support", id: number) => ReleaseStatus

export function useCardReleases(event: Pick<RaceEvent, "start_date" | "end_date">): ReleaseCheck {
	const { umaBannerData, supportBannerData } = useCalculatorData()
	const releases = useMemo(
		() => cardReleases(umaBannerData ?? [], supportBannerData ?? []),
		[umaBannerData, supportBannerData]
	)
	return (pool, id) => releaseStatus((pool === "uma" ? releases.umas : releases.supports).get(id), event)
}
