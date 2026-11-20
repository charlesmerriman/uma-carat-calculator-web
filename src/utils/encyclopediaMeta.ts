/**
 * An Encyclopedia detail page's <title> and description, built from its own
 * payload (notes/encyclopedia-open-plan.md, "Titles and descriptions").
 *
 * These are what a search result shows, so each page needs its own: 3,074
 * pages with one shared title read to Google as copies of one page. Only facts
 * the payload holds go in. Banners and release dates come from
 * /calculator-data, which a build-time render doesn't have, so they stay out.
 *
 * The tab titles keep what the pages set before (the name; a card's name and
 * title, character first, Daptrius 2026-11-17). A skill adds "(Skill)": skill
 * names are ordinary words ("Right-Handed ○"), and a result needs to say what
 * it is. The wording is the owner's to change.
 *
 * UmaTL's text never goes in a description: a search snippet can't carry the
 * credit the page gives it (.claude/rules/backend-models.md, UmaTL). A page
 * says only that SOME of its text is UmaTL's (`uses_translation`), and an uma's
 * or card's bracket title may be that text (`translated_title`), so a page with
 * the flag describes itself by its name alone. The <title> keeps the bracket
 * title, as the tab has since the pages shipped: it is how a reader tells one
 * character's cards apart, and the page under it carries the credit.
 */

import type { CardPageData, UmaPageData } from "../types/encyclopedia"
import type { SkillDetailData } from "../types/skills"
import { CARD_TYPE_LABELS } from "./cardTypes"
import { RARITY_WORDS, RUNNING_STYLE_WORDS } from "./encyclopedia"
import { skillKind } from "./skillSearch"

export interface PageMeta {
	/** Without the site name; useDocumentMeta appends it. */
	title: string
	description: string
}

/** "a, b and c": the site writes lists without the serial comma. */
function listWords(items: string[]): string {
	if (items.length <= 1) return items.join("")
	return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`
}

/**
 * "a" or "an" before a word, by how it is said. Good enough for these words:
 * "an SSR" is said "an ess", and "a unique" is said "a you".
 */
function article(word: string): string {
	if (/^uni/i.test(word)) return "a"
	return /^[aeiouAEIOU]|^(SSR|SR|R)\b/.test(word) ? "an" : "a"
}

/** " (JP only so far)" for a page about something not on global yet. */
function jpOnly(onGlobal: boolean): string {
	return onGlobal ? "" : " (JP only so far)"
}

export function umaPageMeta(uma: UmaPageData): PageMeta {
	const style = uma.running_style ? RUNNING_STYLE_WORDS[uma.running_style] : null
	const what = [uma.rarity ? `${uma.rarity}★` : null, style ?? "trainee"].filter(Boolean).join(" ")
	const hasApt = Object.values(uma.apt).some((value) => value != null)
	const has = [
		hasApt && "aptitudes",
		hasApt && uma.star_stats.length > 0 && "stats at every star",
		uma.skills.length > 0 && "skills",
		(uma.objectives ?? []).length > 0 && "career objectives",
		uma.outfits.length > 0 && "other outfits",
		uma.cards.length > 0 && "support cards",
	].filter((item): item is string => Boolean(item))
	const name = uma.uses_translation ? uma.name : [uma.name, uma.title].filter(Boolean).join(" ")
	const first = `${name} is ${article(what)} ${what} in Uma Musume${jpOnly(uma.on_global)}.`
	return {
		title: uma.name,
		description: has.length > 0 ? `${first} Her page has her ${listWords(has)}.` : first,
	}
}

export function cardPageMeta(card: CardPageData): PageMeta {
	const what = [RARITY_WORDS[card.rarity ?? 0], CARD_TYPE_LABELS[card.card_type]].filter(Boolean).join(" ")
	const kind = what ? `${article(what)} ${what} support card` : "a support card"
	const has = [
		(card.effects ?? []).length > 0 && "its effects at every level",
		card.unique_effect && "its unique effect",
		card.skills.some((skill) => skill.source === "hint") && "the skills it hints",
		card.skills.some((skill) => skill.source === "event") && "the skills its events give",
	].filter((item): item is string => Boolean(item))
	const name = `${card.name} ${card.title}`.trim()
	const described = card.uses_translation ? card.name : name
	const first = `${described} is ${kind} in Uma Musume${jpOnly(card.on_global)}.`
	return {
		title: name,
		description: has.length > 0 ? `${first} Its page has ${listWords(has)}.` : first,
	}
}

export function skillPageMeta(skill: SkillDetailData): PageMeta {
	// The game's own sentence leads when it is the game's. `uses_translation`
	// covers the name or the description, so either way the sentence stays out.
	const lead = skill.description && !skill.uses_translation ? `${skill.description.trim()} ` : ""
	const kind = skillKind(skill)
	const has = [
		skill.readable.slots.length > 0 && "when it activates",
		"what it does",
		(skill.sources.umas.length > 0 || skill.sources.cards.length > 0) && "who gives it",
	].filter((item): item is string => Boolean(item))
	// "Coming to global" is not on global yet either.
	const onGlobal = skill.availability === "global"
	return {
		title: `${skill.name} (Skill)`,
		description:
			`${lead}${skill.name} is ${article(kind)} ${kind} skill in Uma Musume${jpOnly(onGlobal)}. ` +
			`Its page has ${listWords(has)}.`,
	}
}
