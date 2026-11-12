/**
 * The words the skill card and the skill page share for a skill's readable
 * text (the API's `readable`, backend skill_text.describe). Plain functions,
 * kept out of the component files so those export components only.
 */

import type { SkillCondition, SkillSlot } from "../types/pvpGuide"

/** Does the condition say anything? An empty one reads as "Any time". */
export function hasCondition(condition: SkillCondition): boolean {
	return condition.all.length > 0 || condition.any.length > 0
}

/** "Lasts 2.4 s" / "For the whole race"; null for an instant effect. */
export function durationWords(slot: SkillSlot): string | null {
	if (!slot.duration) return null
	return slot.duration === "Whole race" ? "For the whole race" : `Lasts ${slot.duration}`
}

/** "Once per race" / "Again after 30 s per 1,000 m"; null when the game gives none. */
export function cooldownWords(slot: SkillSlot): string | null {
	if (!slot.cooldown) return null
	return slot.cooldown === "Once per race" ? "Once per race" : `Again after ${slot.cooldown}`
}
