/**
 * Whether this visitor sees the skills work ON A GUIDE: the guide skill card's
 * readable text, sources, type, cost, "JP only" tag, UmaTL credit and its link
 * to the skill's page.
 *
 * The site's early-access rule, the one Rankings uses: any paid Patreon tier,
 * staff, or an account ticked "early access". The API's twin is
 * `pvp_guide_editing.sees_skills_preview`, and the API is the real gate (it
 * leaves JP-only skills out of a guide for everyone else); this only decides
 * what to draw.
 *
 * GUIDES ONLY since 2026-11-18. The Encyclopedia sat behind this too from
 * 2026-11-12 and is open to everyone now; asked whether the guides open with
 * it, the owner said "Not the guides" (notes/encyclopedia-open-plan.md). So
 * nothing in the Encyclopedia, the uma and card hover cards or the Timeline's
 * links reads this any more. Opening the guides later is both: return true
 * here and in the API.
 *
 * Read softly (no throw without an AuthProvider), so a component that draws a
 * skill outside the app shell, or in a test, counts as not early.
 */

import { useContext } from "react"
import { AuthContext } from "../services/AuthContext"

export function useSkillsPreview(): boolean {
	return Boolean(useContext(AuthContext)?.account?.early_access)
}
