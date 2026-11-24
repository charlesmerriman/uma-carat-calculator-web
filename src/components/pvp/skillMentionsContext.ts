/**
 * The skills a guide's text mentions as [[Skill name]], keyed by lower-case
 * name (the API's `skill_mentions`). Provided by PvpGuideView; read by every
 * InlineNote and SkillMention inside it, so a note deep in a deck slot can
 * render its mention without the map being passed down by hand.
 *
 * Outside a guide the map is empty and a mention shows as its plain name.
 */
import { createContext, useContext } from "react"
import type { PvpSkillRef, PvpUmaMention } from "../../types/pvpGuide"

export const SkillMentionsContext = createContext<Record<string, PvpSkillRef>>({})

export function useSkillMentions(): Record<string, PvpSkillRef> {
	return useContext(SkillMentionsContext)
}

/**
 * The umas a guide's text names as ((Uma name)), keyed by lower-case name (the
 * API's `uma_mentions`), provided beside the skills' map. Empty outside a guide.
 */
export const UmaMentionsContext = createContext<Record<string, PvpUmaMention>>({})

export function useUmaMentions(): Record<string, PvpUmaMention> {
	return useContext(UmaMentionsContext)
}
