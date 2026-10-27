/**
 * GET /rankings/guides for the Rankings page's Guide rankings tab: every
 * pick in the published guides (types/guideRankings.ts), hourly.
 */

import type { GuideRankingsPayload } from "../types/guideRankings"
import { useRankingsPayload, type RankingsState } from "./useRankingsPayload"

export function useGuideRankings(): RankingsState<GuideRankingsPayload> {
	return useRankingsPayload<GuideRankingsPayload>("/rankings/guides")
}
