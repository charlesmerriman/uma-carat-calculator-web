/**
 * Whether this visitor sees the Rankings page's Pull plans tab: the guide
 * editors only, until the owner says Raptive (the ad network) has approved
 * the site. Henry, 2026-10-27: the pull-plan tables stay "hidden until we
 * get raptive approval (similar to skills tab)". The API's twin is
 * views/rankings.sees_pull_plans; un-gating is both: return true here and
 * there. The page's own early-access rule still applies.
 *
 * Read softly (no throw without an AuthProvider), like useSkillsPreview.
 */

import { useContext } from "react"
import { AuthContext } from "../services/AuthContext"

export function useRankingsPullPlans(): boolean {
	return Boolean(useContext(AuthContext)?.account?.guide_editor)
}
