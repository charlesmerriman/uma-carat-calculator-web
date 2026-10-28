/**
 * GET /rankings/guides for the Rankings page's Guide rankings tab: every
 * pick in the published guides (types/guideRankings.ts), hourly; for a
 * reader without early access, the server's top three instead.
 */

import type { GuideRankingsResponse } from "../types/guideRankings"
import { useRankingsPayload, type RankingsState } from "./useRankingsPayload"

export function useGuideRankings(): RankingsState<GuideRankingsResponse> {
	return useRankingsPayload<GuideRankingsResponse>("/rankings/guides")
}
