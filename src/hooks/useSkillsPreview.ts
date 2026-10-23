/**
 * Whether this visitor sees the SHELVED skills work (owner, 2026-10-23): the
 * Skills page, and the hover card's readable text, sources, "JP only" tag
 * and UmaTL credit. The guide editors only, for now, the same `guide_editor`
 * flag that draws the editor tab; everyone else sees guides as before. The
 * API's twin is `pvp_guide_editing.sees_skills_preview`. Un-shelving is both:
 * return true here and there. See workspace-root skills-plan-4.md.
 *
 * Read softly (no throw without an AuthProvider), so a component that draws a
 * skill outside the app shell, or in a test, counts as not an editor.
 */

import { useContext } from "react"
import { AuthContext } from "../services/AuthContext"

export function useSkillsPreview(): boolean {
	return Boolean(useContext(AuthContext)?.account?.guide_editor)
}
