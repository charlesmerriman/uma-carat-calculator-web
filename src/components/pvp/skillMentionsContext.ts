/**
 * The skills a guide's text mentions as [[Skill name]], keyed by lower-case
 * name (the API's `skill_mentions`). Provided by PvpGuideView; read by every
 * InlineNote and SkillMention inside it, so a note deep in a deck slot can
 * render its mention without the map being passed down by hand.
 *
 * Outside a guide the map is empty and a mention shows as its plain name.
 */
import { createContext, useContext } from "react"
import type { PvpSkillRef } from "../../types/pvpGuide"

export const SkillMentionsContext = createContext<Record<string, PvpSkillRef>>({})

export function useSkillMentions(): Record<string, PvpSkillRef> {
	return useContext(SkillMentionsContext)
}
