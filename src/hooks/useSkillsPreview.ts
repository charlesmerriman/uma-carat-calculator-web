/**
 * Whether this visitor sees the skills work and the Encyclopedia: the Skills
 * page, the uma and card pages, and the guide hover card's readable text,
 * sources, "JP only" tag and UmaTL credit.
 *
 * Shelved to the guide editors from 2026-10-23; since the Encyclopedia (owner,
 * 2026-11-12: "supporters/staff only first, to be enabled for all later") it
 * is the site's early-access rule, the one Rankings uses: any paid Patreon
 * tier, staff, or an account ticked "early access". The API's twin is
 * `pvp_guide_editing.sees_skills_preview`, and the API is the real gate; this
 * only decides what to draw. Opening it to everyone is both: return true here
 * and there (notes/encyclopedia-plan.md, "Opening it to everyone").
 *
 * Read softly (no throw without an AuthProvider), so a component that draws a
 * skill outside the app shell, or in a test, counts as not early.
 */

import { useContext } from "react"
import { AuthContext } from "../services/AuthContext"

export function useSkillsPreview(): boolean {
	return Boolean(useContext(AuthContext)?.account?.early_access)
}
