import { createContext, useContext } from "react"

/**
 * Whether the guide being drawn is a player's own (a community guide,
 * notes/community-guides-plan.md) rather than the site's. Then the guide's
 * per-section comment threads stand aside (GuideComments): a community guide
 * has ONE thread, its post's, drawn under the whole guide (owner, 2026-11-27,
 * decision 5).
 */
export const CommunityGuideContext = createContext(false)

export function useIsCommunityGuide(): boolean {
	return useContext(CommunityGuideContext)
}
