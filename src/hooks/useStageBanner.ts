/**
 * Staging a banner: the Timeline's "Stage banner" and Community plans' "Add
 * to my plan" are this one path.
 *
 * Staging puts a row in the Calculator's staging area (CalculatorProvider's
 * `stagedBanners`), where the player fills it in and confirms it with "Add to
 * calculator". Nothing here writes to a plan: the calculator's own checks
 * (the duplicate check, a banner picked) run at that confirm, as they always
 * have. A guest can stage too; the staged list is in memory only.
 *
 * `status` is what the button says, by the Timeline's rules: a banner already
 * in the plan, one already staged, and one that has ended can't be staged.
 * Rows are compared by type and id (plannedBannerKey), never by bare id: uma
 * and support banners have separate ids.
 */

import { useMemo } from "react"
import { toast } from "sonner"
import { useCalculatorData } from "../services/CalculatorContext"
import { nextTempId, plannedBannerKey } from "../utils/bannerHelpers"
import type { BannerKey, BannerTargetFields } from "../utils/bannerHelpers"
import type { LocalPlannedBanner } from "../types"

export type StageStatus = "available" | "staged" | "planned" | "ended"

/** A row to stage: everything but the id, which staging mints. */
export type StageableRow = Omit<LocalPlannedBanner, "tempId">

function keysOf(rows: BannerTargetFields[]): Set<BannerKey> {
	return new Set(rows.map(plannedBannerKey).filter((key): key is BannerKey => key !== null))
}

export function useStageBanner() {
	const { userPlannedBannerData, stagedBanners, setStagedBanners } = useCalculatorData()
	const plannedKeys = useMemo(() => keysOf(userPlannedBannerData), [userPlannedBannerData])
	const stagedKeys = useMemo(() => keysOf(stagedBanners), [stagedBanners])

	/** Where `row`'s banner stands. `endDate` is the banner's end, `now` the caller's clock. */
	const status = (row: BannerTargetFields, endDate: string, now: Date): StageStatus => {
		const key = plannedBannerKey(row)
		if (key === null || new Date(endDate) <= now) return "ended"
		if (plannedKeys.has(key)) return "planned"
		if (stagedKeys.has(key)) return "staged"
		return "available"
	}

	/** Stage `row`, then say so naming the banner. */
	const stage = (row: StageableRow, bannerName: string): void => {
		setStagedBanners((prev) => [
			...prev,
			// From `prev`, never from the render-scoped stagedBanners: staging two
			// banners in quick succession is the normal way to use this, and a
			// stale list would mint the same tempId twice. See nextTempId.
			{ ...row, tempId: nextTempId(userPlannedBannerData, prev) },
		])
		toast.success(`${bannerName} staged! Head to the Calculator to confirm.`)
	}

	return { status, stage }
}

